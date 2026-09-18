-- Cash Engine PRO — estornos reais, parciais/totais, conciliação e reversão proporcional.
-- Chargebacks permanecem distintos e só existem quando há ocorrência real.

ALTER TABLE public.estornos
  ADD COLUMN IF NOT EXISTS pedido_id uuid REFERENCES public.pedidos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS idempotency_key uuid,
  ADD COLUMN IF NOT EXISTS ocorrencia_tipo text NOT NULL DEFAULT 'estorno'
    CHECK(ocorrencia_tipo IN ('estorno','pix_ocorrencia')),
  ADD COLUMN IF NOT EXISTS modo_processamento text NOT NULL DEFAULT 'manual'
    CHECK(modo_processamento IN ('manual','provedor')),
  ADD COLUMN IF NOT EXISTS referencia_conciliacao text,
  ADD COLUMN IF NOT EXISTS evidencia_conciliacao text,
  ADD COLUMN IF NOT EXISTS conciliado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conciliado_em timestamptz,
  ADD COLUMN IF NOT EXISTS regra_reversao_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.comissoes
  ADD COLUMN IF NOT EXISTS valor_estornado numeric(15,2) NOT NULL DEFAULT 0
    CHECK(valor_estornado>=0);

CREATE UNIQUE INDEX IF NOT EXISTS idx_estornos_empresa_idempotency
ON public.estornos(empresa_id,idempotency_key)
WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.estorno_split_reversoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estorno_id uuid NOT NULL REFERENCES public.estornos(id) ON DELETE RESTRICT,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  transacao_id uuid NOT NULL REFERENCES public.transacoes(id) ON DELETE RESTRICT,
  split_distribuicao_id uuid REFERENCES public.split_distribuicoes(id) ON DELETE RESTRICT,
  beneficiario_tipo text NOT NULL
    CHECK(beneficiario_tipo IN ('produtor','afiliado','plataforma','autorizado','custo_nao_reembolsavel')),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  afiliado_id uuid REFERENCES public.afiliados(id) ON DELETE SET NULL,
  valor_delta numeric(15,2) NOT NULL CHECK(valor_delta>=0),
  valor_acumulado_apos numeric(15,2) NOT NULL CHECK(valor_acumulado_apos>=0),
  politica_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(estorno_id,split_distribuicao_id,beneficiario_tipo)
);

CREATE TABLE IF NOT EXISTS public.estorno_processamento_tentativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estorno_id uuid NOT NULL REFERENCES public.estornos(id) ON DELETE RESTRICT,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  provedor text NOT NULL,
  idempotency_key uuid NOT NULL UNIQUE,
  status text NOT NULL
    CHECK(status IN ('preparada','enviada','incerta','confirmada','falhou','cancelada')),
  referencia_externa text,
  request_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  erro text,
  criada_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(estorno_id,idempotency_key)
);

ALTER TABLE public.estorno_split_reversoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estorno_processamento_tentativas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS estorno_split_read ON public.estorno_split_reversoes;
CREATE POLICY estorno_split_read
ON public.estorno_split_reversoes
FOR SELECT TO authenticated
USING (
  public.fn_is_admin_global()
  OR empresa_id=public.current_empresa_id()
  OR afiliado_id IN (
    SELECT a.id FROM public.afiliados a
    WHERE a.profile_id=auth.uid() AND a.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS estorno_attempts_admin ON public.estorno_processamento_tentativas;
CREATE POLICY estorno_attempts_admin
ON public.estorno_processamento_tentativas
FOR SELECT TO authenticated
USING(public.fn_is_admin_global());

-- =========================================================
-- DÉBITO CONTÁBIL SEGURO
-- Consome disponível, depois a receber; falta vira saldo devedor explícito.
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_ledger_debitar_entidade(
  p_key_prefix text,
  p_empresa_id uuid,
  p_profile_id uuid,
  p_afiliado_id uuid,
  p_valor numeric,
  p_conta text,
  p_descricao text,
  p_transacao_id uuid,
  p_estorno_id uuid,
  p_documento text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_remaining numeric(15,2):=round(coalesce(p_valor,0),2);
  v_available numeric(15,2);
  v_receivable numeric(15,2);
  v_debt numeric(15,2);
  v_take numeric(15,2);
BEGIN
  IF v_remaining<=0 THEN RETURN 0; END IF;

  v_available:=greatest(round(
    public.fn_ledger_saldo_bucket(p_empresa_id,p_profile_id,p_afiliado_id,'disponivel'),2
  ),0);
  v_debt:=greatest(round(
    public.fn_ledger_saldo_bucket(p_empresa_id,p_profile_id,p_afiliado_id,'devedor'),2
  ),0);
  v_available:=greatest(v_available-v_debt,0);
  v_receivable:=greatest(round(
    public.fn_ledger_saldo_bucket(p_empresa_id,p_profile_id,p_afiliado_id,'a_receber'),2
  ),0);

  IF v_available>0 THEN
    v_take:=least(v_remaining,v_available);
    PERFORM public.fn_ledger_registrar(
      p_key_prefix||':available',
      p_empresa_id,p_profile_id,p_afiliado_id,p_transacao_id,NULL,p_estorno_id,NULL,NULL,
      p_conta,p_descricao,'D',v_take,'disponivel','reversao',
      p_documento,'estorno',p_estorno_id,NULL,p_metadata
    );
    v_remaining:=round(v_remaining-v_take,2);
  END IF;

  IF v_remaining>0 AND v_receivable>0 THEN
    v_take:=least(v_remaining,v_receivable);
    PERFORM public.fn_ledger_registrar(
      p_key_prefix||':receivable',
      p_empresa_id,p_profile_id,p_afiliado_id,p_transacao_id,NULL,p_estorno_id,NULL,NULL,
      p_conta,p_descricao,'D',v_take,'a_receber','reversao',
      p_documento,'estorno',p_estorno_id,NULL,p_metadata
    );
    v_remaining:=round(v_remaining-v_take,2);
  END IF;

  IF v_remaining>0 THEN
    -- Crédito no bucket devedor representa obrigação ainda não coberta por saldo interno.
    PERFORM public.fn_ledger_registrar(
      p_key_prefix||':debt',
      p_empresa_id,p_profile_id,p_afiliado_id,p_transacao_id,NULL,p_estorno_id,NULL,NULL,
      'SALDO_DEVEDOR','Débito gerado por estorno sem saldo suficiente','C',
      v_remaining,'devedor','efetivo',
      p_documento,'estorno',p_estorno_id,NULL,
      coalesce(p_metadata,'{}'::jsonb)||jsonb_build_object('origem_conta',p_conta)
    );
  END IF;

  RETURN v_remaining;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_ledger_debitar_entidade(
  text,uuid,uuid,uuid,numeric,text,text,uuid,uuid,text,jsonb
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ledger_debitar_entidade(
  text,uuid,uuid,uuid,numeric,text,text,uuid,uuid,text,jsonb
) TO service_role;

-- =========================================================
-- SOLICITAÇÃO
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_estorno_solicitar(
  p_transacao_id uuid,
  p_valor numeric,
  p_motivo text,
  p_detalhes text,
  p_idempotency_key uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_t public.transacoes%ROWTYPE;
  v_existing uuid;
  v_reserved numeric(15,2);
  v_remaining numeric(15,2);
  v_id uuid;
  v_protocol text;
  v_tipo text;
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT (
    public.fn_is_admin_global()
    OR public.fn_is_empresa_owner(v_empresa)
    OR public.fn_tem_permissao('financeiro','estornos','create'::public.tipo_operacao)
  ) THEN RAISE EXCEPTION 'permission_denied'; END IF;

  IF p_idempotency_key IS NULL THEN RAISE EXCEPTION 'refund_idempotency_required'; END IF;
  IF p_valor IS NULL OR p_valor<=0 THEN RAISE EXCEPTION 'refund_value_invalid'; END IF;
  IF trim(coalesce(p_motivo,''))='' THEN RAISE EXCEPTION 'refund_reason_required'; END IF;

  SELECT id INTO v_existing
  FROM public.estornos
  WHERE empresa_id=v_empresa AND idempotency_key=p_idempotency_key
  LIMIT 1;
  IF FOUND THEN RETURN v_existing; END IF;

  SELECT * INTO v_t
  FROM public.transacoes
  WHERE id=p_transacao_id AND empresa_id=v_empresa
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'transaction_not_found'; END IF;
  IF v_t.status NOT IN ('aprovada','capturada','paga','disponivel','estornada_parcial') THEN
    RAISE EXCEPTION 'transaction_not_refundable';
  END IF;

  -- Garante snapshot financeiro original antes de reservar um estorno.
  IF v_t.saldo_processado_em IS NULL THEN
    PERFORM public.fn_processar_financeiro_transacao(v_t.id);
    SELECT * INTO v_t FROM public.transacoes WHERE id=v_t.id FOR UPDATE;
  END IF;

  SELECT coalesce(sum(
    CASE
      WHEN e.status='concluido' THEN coalesce(e.valor_efetivamente_estornado,0)
      ELSE e.valor_solicitado_estorno
    END
  ),0)
  INTO v_reserved
  FROM public.estornos e
  WHERE e.transacao_id=v_t.id
    AND e.status NOT IN ('rejeitado','cancelado');

  v_remaining:=round(v_t.valor_bruto-v_reserved,2);
  IF p_valor>v_remaining THEN RAISE EXCEPTION 'refund_exceeds_remaining_amount'; END IF;

  v_tipo:=CASE WHEN round(p_valor,2)=v_remaining THEN 'total' ELSE 'parcial' END;

  LOOP
    v_protocol:='RF-'||upper(substr(encode(gen_random_bytes(16),'hex'),1,20));
    EXIT WHEN NOT EXISTS(SELECT 1 FROM public.estornos WHERE protocolo=v_protocol);
  END LOOP;

  INSERT INTO public.estornos(
    empresa_id,transacao_id,pedido_id,cliente_id,protocolo,
    valor_original,valor_solicitado_estorno,motivo,detalhamento_motivo,
    tipo_estorno,status,metodo_estorno,data_solicitacao,solicitado_por,
    idempotency_key,ocorrencia_tipo,modo_processamento,regra_reversao_snapshot,
    metadata
  ) VALUES (
    v_t.empresa_id,v_t.id,v_t.pedido_id,v_t.cliente_id,v_protocol,
    v_t.valor_bruto,round(p_valor,2),trim(p_motivo),
    nullif(trim(coalesce(p_detalhes,'')),''),
    v_tipo,'solicitado','origem',now(),auth.uid(),
    p_idempotency_key,'estorno',
    CASE WHEN v_t.provedor_pagamento='mercadopago' THEN 'provedor' ELSE 'manual' END,
    jsonb_build_object(
      'split_source','split_distribuicoes',
      'commission_source','pedido_itens.comissao_valor_snapshot',
      'rounding','numeric_round_2'
    ),
    jsonb_build_object(
      'provedor_pagamento',v_t.provedor_pagamento,
      'metodo_pagamento',v_t.metodo_pagamento
    )
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_estorno_solicitar(uuid,numeric,text,text,uuid)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_estorno_solicitar(uuid,numeric,text,text,uuid)
TO authenticated;

-- =========================================================
-- CONCILIAÇÃO EFETIVA
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_admin_estorno_conciliar_manual(
  p_estorno_id uuid,
  p_valor_efetivo numeric,
  p_referencia text,
  p_evidencia text,
  p_data_conclusao timestamptz DEFAULT now()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_e public.estornos%ROWTYPE;
  v_t public.transacoes%ROWTYPE;
  v_cumulative_before numeric(15,2);
  v_cumulative_after numeric(15,2);
  v_ratio numeric;
  v_split record;
  v_target numeric(15,2);
  v_delta numeric(15,2);
  v_platform_refundable boolean:=true;
  v_company_burden numeric(15,2):=0;
  v_affiliate_delta numeric(15,2):=0;
  v_platform_delta numeric(15,2):=0;
  v_producer_delta numeric(15,2):=0;
  v_nonrefund_fee_delta numeric(15,2):=0;
  v_shortfall numeric(15,2);
  v_commission public.comissoes%ROWTYPE;
BEGIN
  IF NOT public.fn_is_admin_global() THEN RAISE EXCEPTION 'platform_admin_required'; END IF;
  IF p_valor_efetivo IS NULL OR p_valor_efetivo<=0 THEN RAISE EXCEPTION 'refund_effective_value_invalid'; END IF;
  IF trim(coalesce(p_referencia,''))='' OR trim(coalesce(p_evidencia,''))='' THEN
    RAISE EXCEPTION 'refund_reconciliation_evidence_required';
  END IF;

  SELECT * INTO v_e FROM public.estornos WHERE id=p_estorno_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'refund_not_found'; END IF;
  IF v_e.status IN ('concluido','rejeitado','cancelado') THEN
    RAISE EXCEPTION 'refund_already_finalized';
  END IF;
  IF p_valor_efetivo>v_e.valor_solicitado_estorno THEN
    RAISE EXCEPTION 'refund_effective_exceeds_requested';
  END IF;

  SELECT * INTO v_t FROM public.transacoes WHERE id=v_e.transacao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'transaction_not_found'; END IF;

  SELECT coalesce(sum(valor_efetivamente_estornado),0)
  INTO v_cumulative_before
  FROM public.estornos
  WHERE transacao_id=v_t.id
    AND id<>v_e.id
    AND status='concluido';

  v_cumulative_after:=round(v_cumulative_before+p_valor_efetivo,2);
  IF v_cumulative_after>v_t.valor_bruto THEN
    RAISE EXCEPTION 'refund_total_exceeds_transaction';
  END IF;

  v_ratio:=CASE WHEN v_t.valor_bruto>0 THEN v_cumulative_after/v_t.valor_bruto ELSE 0 END;

  SELECT coalesce(
    (tos.regra_snapshot->>'reembolsar_em_estorno')::boolean,
    true
  )
  INTO v_platform_refundable
  FROM public.taxa_operacao_snapshots tos
  WHERE tos.transacao_id=v_t.id AND tos.operacao='venda'
  LIMIT 1;
  v_platform_refundable:=coalesce(v_platform_refundable,true);

  -- Alvo acumulado evita erros de arredondamento em vários estornos parciais.
  FOR v_split IN
    SELECT *
    FROM public.split_distribuicoes
    WHERE transacao_id=v_t.id
    ORDER BY beneficiario_tipo,id
    FOR UPDATE
  LOOP
    IF v_split.beneficiario_tipo='plataforma' AND NOT v_platform_refundable THEN
      v_target:=0;
    ELSE
      v_target:=least(
        v_split.valor_distribuido,
        round(v_split.valor_distribuido*v_ratio,2)
      );
    END IF;

    v_delta:=greatest(round(v_target-v_split.valor_revertido,2),0);
    IF v_delta<=0 THEN CONTINUE; END IF;

    UPDATE public.split_distribuicoes
    SET valor_revertido=round(valor_revertido+v_delta,2)
    WHERE id=v_split.id;

    INSERT INTO public.estorno_split_reversoes(
      estorno_id,empresa_id,transacao_id,split_distribuicao_id,
      beneficiario_tipo,profile_id,afiliado_id,valor_delta,
      valor_acumulado_apos,politica_snapshot
    ) VALUES (
      v_e.id,v_e.empresa_id,v_t.id,v_split.id,
      v_split.beneficiario_tipo,v_split.profile_id,v_split.afiliado_id,
      v_delta,v_target,
      jsonb_build_object(
        'cumulative_refund',v_cumulative_after,
        'gross',v_t.valor_bruto,
        'ratio',v_ratio,
        'platform_fee_refundable',v_platform_refundable
      )
    )
    ON CONFLICT(estorno_id,split_distribuicao_id,beneficiario_tipo)
    DO NOTHING;

    CASE v_split.beneficiario_tipo
      WHEN 'produtor' THEN v_producer_delta:=v_producer_delta+v_delta;
      WHEN 'afiliado' THEN v_affiliate_delta:=v_affiliate_delta+v_delta;
      WHEN 'plataforma' THEN v_platform_delta:=v_platform_delta+v_delta;
      ELSE NULL;
    END CASE;
  END LOOP;

  -- Se a taxa da plataforma não é reembolsável, o custo correspondente fica com o produtor.
  IF NOT v_platform_refundable THEN
    SELECT greatest(
      round(
        coalesce(sum(sd.valor_distribuido),0)*v_ratio
        - coalesce(sum(sd.valor_revertido),0),
        2
      ),0)
    INTO v_nonrefund_fee_delta
    FROM public.split_distribuicoes sd
    WHERE sd.transacao_id=v_t.id
      AND sd.beneficiario_tipo='plataforma';

    -- Queremos apenas o delta desta conciliação, não o acumulado.
    SELECT greatest(
      v_nonrefund_fee_delta
      - coalesce(sum(r.valor_delta),0),
      0
    )
    INTO v_nonrefund_fee_delta
    FROM public.estorno_split_reversoes r
    WHERE r.transacao_id=v_t.id
      AND r.beneficiario_tipo='custo_nao_reembolsavel'
      AND r.estorno_id<>v_e.id;

    IF v_nonrefund_fee_delta>0 THEN
      INSERT INTO public.estorno_split_reversoes(
        estorno_id,empresa_id,transacao_id,beneficiario_tipo,
        valor_delta,valor_acumulado_apos,politica_snapshot
      ) VALUES (
        v_e.id,v_e.empresa_id,v_t.id,'custo_nao_reembolsavel',
        v_nonrefund_fee_delta,v_nonrefund_fee_delta,
        jsonb_build_object('platform_fee_refundable',false)
      )
      ON CONFLICT(estorno_id,split_distribuicao_id,beneficiario_tipo)
      DO NOTHING;
    END IF;
  END IF;

  v_company_burden:=round(v_producer_delta+v_nonrefund_fee_delta,2);

  IF v_company_burden>0 THEN
    v_shortfall:=public.fn_ledger_debitar_entidade(
      'refund:'||v_e.id||':company',
      v_e.empresa_id,NULL,NULL,v_company_burden,
      'ESTORNO_PRODUTOR','Reversão de venda por estorno',
      v_t.id,v_e.id,v_e.protocolo,
      jsonb_build_object(
        'valor_estornado',p_valor_efetivo,
        'producer_delta',v_producer_delta,
        'nonrefundable_fee_delta',v_nonrefund_fee_delta
      )
    );
  END IF;

  IF v_affiliate_delta>0 AND v_t.afiliado_id IS NOT NULL THEN
    PERFORM public.fn_ledger_debitar_entidade(
      'refund:'||v_e.id||':affiliate:'||v_t.afiliado_id,
      v_e.empresa_id,NULL,v_t.afiliado_id,v_affiliate_delta,
      'ESTORNO_COMISSAO','Reversão proporcional de comissão',
      v_t.id,v_e.id,v_e.protocolo,
      jsonb_build_object('valor_estornado',p_valor_efetivo)
    );

    SELECT * INTO v_commission
    FROM public.comissoes
    WHERE transacao_id=v_t.id
      AND afiliado_id=v_t.afiliado_id
      AND deleted_at IS NULL
    ORDER BY created_at LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
      UPDATE public.comissoes
      SET valor_estornado=least(
            valor_comissao_liquida,
            round(valor_estornado+v_affiliate_delta,2)
          ),
          status=CASE
            WHEN round(valor_estornado+v_affiliate_delta,2)>=valor_comissao_liquida
            THEN 'estornada'::public.status_comissao
            ELSE status
          END,
          data_cancelamento=CASE
            WHEN round(valor_estornado+v_affiliate_delta,2)>=valor_comissao_liquida
            THEN now()
            ELSE data_cancelamento
          END,
          motivo_cancelamento=CASE
            WHEN round(valor_estornado+v_affiliate_delta,2)>=valor_comissao_liquida
            THEN 'Comissão integralmente revertida por estorno'
            ELSE motivo_cancelamento
          END,
          updated_at=now()
      WHERE id=v_commission.id;
    END IF;
  END IF;

  UPDATE public.estornos
  SET valor_aprovado_estorno=p_valor_efetivo,
      valor_efetivamente_estornado=p_valor_efetivo,
      status='concluido',
      data_aprovacao=coalesce(data_aprovacao,now()),
      data_conclusao=p_data_conclusao,
      aprovado_por=auth.uid(),
      referencia_conciliacao=trim(p_referencia),
      evidencia_conciliacao=trim(p_evidencia),
      conciliado_por=auth.uid(),
      conciliado_em=now(),
      regra_reversao_snapshot=regra_reversao_snapshot || jsonb_build_object(
        'platform_fee_refundable',v_platform_refundable,
        'producer_delta',v_producer_delta,
        'affiliate_delta',v_affiliate_delta,
        'platform_delta',v_platform_delta,
        'nonrefundable_fee_delta',v_nonrefund_fee_delta
      ),
      updated_at=now()
  WHERE id=v_e.id;

  UPDATE public.transacoes
  SET status=CASE
        WHEN v_cumulative_after>=valor_bruto THEN 'reembolsada'::public.status_transacao
        ELSE 'estornada_parcial'::public.status_transacao
      END,
      data_estorno=p_data_conclusao,
      updated_at=now()
  WHERE id=v_t.id;

  IF v_t.pedido_id IS NOT NULL THEN
    UPDATE public.pedidos
    SET valor_devolvido=v_cumulative_after,
        status=CASE
          WHEN v_cumulative_after>=valor_total THEN 'reembolsado_total'
          ELSE 'reembolsado_parcial'
        END,
        status_pagamento=CASE
          WHEN v_cumulative_after>=valor_total THEN 'reembolsado_total'
          ELSE 'reembolsado_parcial'
        END,
        updated_at=now()
    WHERE id=v_t.pedido_id;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_estorno_conciliar_manual(
  uuid,numeric,text,text,timestamptz
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_estorno_conciliar_manual(
  uuid,numeric,text,text,timestamptz
) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_estorno_rejeitar(
  p_estorno_id uuid,
  p_motivo text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v_e public.estornos%ROWTYPE;
BEGIN
  IF NOT public.fn_is_admin_global() THEN RAISE EXCEPTION 'platform_admin_required'; END IF;
  IF trim(coalesce(p_motivo,''))='' THEN RAISE EXCEPTION 'refund_rejection_reason_required'; END IF;

  SELECT * INTO v_e FROM public.estornos WHERE id=p_estorno_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'refund_not_found'; END IF;
  IF v_e.status IN ('concluido','rejeitado','cancelado') THEN
    RAISE EXCEPTION 'refund_already_finalized';
  END IF;

  UPDATE public.estornos
  SET status='rejeitado',rejeitado_por=auth.uid(),
      observacoes_internas=concat_ws(E'\n',observacoes_internas,'Rejeitado: '||trim(p_motivo)),
      updated_at=now()
  WHERE id=v_e.id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_estorno_rejeitar(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_estorno_rejeitar(uuid,text) TO authenticated;

-- Provedor: prepara tentativa, mas não faz chamada externa.
CREATE OR REPLACE FUNCTION public.fn_admin_estorno_preparar_tentativa_provedor(
  p_estorno_id uuid,
  p_provedor text,
  p_idempotency_key uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_e public.estornos%ROWTYPE;
  v_id uuid;
BEGIN
  IF NOT public.fn_is_admin_global() THEN RAISE EXCEPTION 'platform_admin_required'; END IF;
  IF trim(coalesce(p_provedor,''))='' OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'provider_and_idempotency_required';
  END IF;

  SELECT * INTO v_e FROM public.estornos WHERE id=p_estorno_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'refund_not_found'; END IF;
  IF v_e.status NOT IN ('solicitado','processando') THEN
    RAISE EXCEPTION 'refund_not_ready_for_provider';
  END IF;

  IF EXISTS(
    SELECT 1 FROM public.estorno_processamento_tentativas
    WHERE estorno_id=v_e.id AND status IN ('enviada','incerta')
  ) THEN
    RAISE EXCEPTION 'refund_provider_result_must_be_queried_before_retry';
  END IF;

  INSERT INTO public.estorno_processamento_tentativas(
    estorno_id,empresa_id,provedor,idempotency_key,status,
    request_snapshot,criada_por
  ) VALUES (
    v_e.id,v_e.empresa_id,trim(p_provedor),p_idempotency_key,'preparada',
    jsonb_build_object(
      'transacao_id',v_e.transacao_id,
      'valor',v_e.valor_solicitado_estorno
    ),
    auth.uid()
  )
  ON CONFLICT(idempotency_key) DO UPDATE SET updated_at=now()
  RETURNING id INTO v_id;

  UPDATE public.estornos
  SET status='processando',modo_processamento='provedor',updated_at=now()
  WHERE id=v_e.id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_estorno_preparar_tentativa_provedor(uuid,text,uuid)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_estorno_preparar_tentativa_provedor(uuid,text,uuid)
TO authenticated;

-- =========================================================
-- RLS DE ESTORNOS
-- =========================================================
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='estornos'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.estornos',p.policyname);
  END LOOP;
END $$;

CREATE POLICY estornos_read
ON public.estornos
FOR SELECT TO authenticated
USING (
  public.fn_is_admin_global()
  OR (
    empresa_id=public.current_empresa_id()
    AND (
      public.fn_is_empresa_owner(empresa_id)
      OR public.fn_tem_permissao('financeiro','estornos','read'::public.tipo_operacao)
    )
  )
  OR EXISTS (
    SELECT 1
    FROM public.transacoes t
    JOIN public.afiliados a ON a.id=t.afiliado_id
    WHERE t.id=estornos.transacao_id
      AND a.profile_id=auth.uid()
      AND a.deleted_at IS NULL
  )
);

-- =========================================================
-- ÁREA ÚNICA: ESTORNOS + CONTESTAÇÕES
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_ocorrencias_financeiras_listar(
  p_tipo text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  origem_id uuid,
  tipo text,
  transacao_id uuid,
  pedido_numero text,
  valor numeric,
  status text,
  motivo text,
  data_ocorrencia timestamptz,
  modo_processamento text,
  referencia text,
  total_registros bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
  WITH rows AS (
    SELECT
      e.id AS origem_id,
      e.ocorrencia_tipo::text AS tipo,
      e.transacao_id,
      t.pedido_numero::text,
      coalesce(e.valor_efetivamente_estornado,e.valor_solicitado_estorno)::numeric AS valor,
      e.status::text,
      e.motivo::text,
      coalesce(e.data_conclusao,e.data_solicitacao)::timestamptz AS data_ocorrencia,
      e.modo_processamento::text,
      e.referencia_conciliacao::text AS referencia
    FROM public.estornos e
    JOIN public.transacoes t ON t.id=e.transacao_id
    WHERE e.empresa_id=public.current_empresa_id()

    UNION ALL

    SELECT
      c.id,
      'chargeback'::text,
      c.transacao_id,
      t.pedido_numero::text,
      c.valor_chargeback::numeric,
      c.status::text,
      coalesce(c.motivo_banco,'Contestação do emissor')::text,
      coalesce(c.data_ocorrencia,c.data_notificacao)::timestamptz,
      'provedor'::text,
      c.codigo_chargeback_banco::text
    FROM public.chargebacks c
    JOIN public.transacoes t ON t.id=c.transacao_id
    WHERE c.empresa_id=public.current_empresa_id()
  ),
  filtered AS (
    SELECT *
    FROM rows
    WHERE (coalesce(trim(p_tipo),'')='' OR tipo=p_tipo)
      AND (coalesce(trim(p_status),'')='' OR status=p_status)
  )
  SELECT
    f.origem_id,f.tipo,f.transacao_id,f.pedido_numero,f.valor,f.status,
    f.motivo,f.data_ocorrencia,f.modo_processamento,f.referencia,
    count(*) OVER()
  FROM filtered f
  ORDER BY f.data_ocorrencia DESC,f.origem_id DESC
  LIMIT greatest(1,least(coalesce(p_limit,50),200))
  OFFSET greatest(coalesce(p_offset,0),0);
$$;

REVOKE ALL ON FUNCTION public.fn_ocorrencias_financeiras_listar(text,text,integer,integer)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_ocorrencias_financeiras_listar(text,text,integer,integer)
TO authenticated;
