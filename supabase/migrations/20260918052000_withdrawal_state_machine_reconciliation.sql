-- Cash Engine PRO — saques reais com reserva contábil, máquina de estados e conciliação.
-- Nenhuma função desta migration executa transferência bancária externa.

ALTER TABLE public.saques
  ADD COLUMN IF NOT EXISTS idempotency_key uuid,
  ADD COLUMN IF NOT EXISTS solicitado_por_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS destino_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS modo_processamento text NOT NULL DEFAULT 'manual'
    CHECK(modo_processamento IN ('manual','provedor')),
  ADD COLUMN IF NOT EXISTS referencia_conciliacao text,
  ADD COLUMN IF NOT EXISTS evidencia_conciliacao text,
  ADD COLUMN IF NOT EXISTS conciliado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conciliado_em timestamptz,
  ADD COLUMN IF NOT EXISTS reserva_liberada_em timestamptz,
  ADD COLUMN IF NOT EXISTS reservado_em timestamptz,
  ADD COLUMN IF NOT EXISTS ultima_tentativa_em timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_saques_idempotency
ON public.saques(
  coalesce(empresa_id,'00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(profile_id,'00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(afiliado_id,'00000000-0000-0000-0000-000000000000'::uuid),
  idempotency_key
)
WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.saque_processamento_tentativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  saque_id uuid NOT NULL REFERENCES public.saques(id) ON DELETE RESTRICT,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE RESTRICT,
  afiliado_id uuid REFERENCES public.afiliados(id) ON DELETE RESTRICT,
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
  UNIQUE(saque_id,idempotency_key)
);

ALTER TABLE public.saque_processamento_tentativas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS saque_tentativas_admin_only ON public.saque_processamento_tentativas;
CREATE POLICY saque_tentativas_admin_only
ON public.saque_processamento_tentativas
FOR SELECT TO authenticated
USING(public.fn_is_admin_global());

CREATE OR REPLACE FUNCTION public.fn_saque_entidade_dados(
  p_entidade text
)
RETURNS TABLE(
  empresa_id uuid,
  profile_id uuid,
  afiliado_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_afiliado uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  IF p_entidade='empresa' THEN
    IF v_empresa IS NULL THEN RAISE EXCEPTION 'company_not_found'; END IF;
    RETURN QUERY SELECT v_empresa,NULL::uuid,NULL::uuid;
    RETURN;
  END IF;

  IF p_entidade='afiliado' THEN
    SELECT a.id INTO v_afiliado
    FROM public.afiliados a
    WHERE a.profile_id=auth.uid()
      AND a.status='ativo'
      AND a.deleted_at IS NULL
    ORDER BY a.created_at
    LIMIT 1;

    IF v_afiliado IS NULL THEN RAISE EXCEPTION 'affiliate_not_found'; END IF;
    RETURN QUERY SELECT NULL::uuid,NULL::uuid,v_afiliado;
    RETURN;
  END IF;

  IF p_entidade='profile' THEN
    RETURN QUERY SELECT NULL::uuid,auth.uid(),NULL::uuid;
    RETURN;
  END IF;

  RAISE EXCEPTION 'invalid_withdraw_entity';
END;
$$;

REVOKE ALL ON FUNCTION public.fn_saque_entidade_dados(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_saque_entidade_dados(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_saque_taxa_snapshot(
  p_saque_id uuid,
  p_empresa_id uuid,
  p_valor numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_rule public.taxas_plataforma%ROWTYPE;
  v_fee numeric(15,2):=0;
BEGIN
  SELECT *
  INTO v_rule
  FROM public.fn_taxa_regra_aplicavel(
    p_empresa_id,'saque','pix'::public.metodo_pagamento,now()
  )
  LIMIT 1;

  IF FOUND THEN
    v_fee:=public.fn_taxa_calcular(
      p_valor,v_rule.taxa_percentual,v_rule.taxa_fixa,v_rule.taxa_minima,v_rule.taxa_maxima
    );

    INSERT INTO public.taxa_operacao_snapshots(
      empresa_id,regra_id,saque_id,operacao,base_valor,
      percentual_snapshot,fixo_snapshot,minimo_snapshot,maximo_snapshot,
      valor_calculado,regra_snapshot
    ) VALUES (
      p_empresa_id,v_rule.id,p_saque_id,'saque',p_valor,
      v_rule.taxa_percentual,v_rule.taxa_fixa,v_rule.taxa_minima,v_rule.taxa_maxima,
      v_fee,
      coalesce(v_rule.regra_snapshot,'{}'::jsonb)
        || jsonb_build_object('rule_id',v_rule.id,'versao',v_rule.versao)
    )
    ON CONFLICT(saque_id,operacao) WHERE saque_id IS NOT NULL
    DO NOTHING;
  END IF;

  RETURN v_fee;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_saque_taxa_snapshot(uuid,uuid,numeric)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_saque_taxa_snapshot(uuid,uuid,numeric)
TO service_role;

CREATE OR REPLACE FUNCTION public.fn_solicitar_saque_v2(
  p_valor numeric,
  p_conta_bancaria_id uuid,
  p_idempotency_key uuid,
  p_entidade text DEFAULT 'empresa'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_empresa uuid;
  v_profile uuid;
  v_afiliado uuid;
  v_cb public.contas_bancarias%ROWTYPE;
  v_saldo public.saldos%ROWTYPE;
  v_saque uuid;
  v_existing uuid;
  v_protocolo text;
  v_fee numeric(15,2);
  v_net numeric(15,2);
  v_doc text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_valor IS NULL OR p_valor<=0 THEN RAISE EXCEPTION 'invalid_withdraw_amount'; END IF;
  IF p_idempotency_key IS NULL THEN RAISE EXCEPTION 'withdraw_idempotency_required'; END IF;

  SELECT empresa_id,profile_id,afiliado_id
  INTO v_empresa,v_profile,v_afiliado
  FROM public.fn_saque_entidade_dados(p_entidade)
  LIMIT 1;

  SELECT id INTO v_existing
  FROM public.saques
  WHERE idempotency_key=p_idempotency_key
    AND empresa_id IS NOT DISTINCT FROM v_empresa
    AND profile_id IS NOT DISTINCT FROM v_profile
    AND afiliado_id IS NOT DISTINCT FROM v_afiliado
  LIMIT 1;
  IF FOUND THEN RETURN v_existing; END IF;

  SELECT * INTO v_cb
  FROM public.contas_bancarias
  WHERE id=p_conta_bancaria_id
    AND deleted_at IS NULL
    AND (
      (v_empresa IS NOT NULL AND empresa_id=v_empresa)
      OR (v_profile IS NOT NULL AND profile_id=v_profile)
      OR (v_afiliado IS NOT NULL AND afiliado_id=v_afiliado)
    )
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'withdraw_bank_account_invalid'; END IF;

  -- Garante saldo materializado e serializa pedidos concorrentes pela carteira.
  IF v_empresa IS NOT NULL THEN
    PERFORM public.fn_saldo_recalcular_entidade(v_empresa,NULL,NULL);
    SELECT * INTO v_saldo FROM public.saldos
    WHERE empresa_id=v_empresa AND profile_id IS NULL AND afiliado_id IS NULL
    FOR UPDATE;
  ELSIF v_profile IS NOT NULL THEN
    PERFORM public.fn_saldo_recalcular_entidade(NULL,v_profile,NULL);
    SELECT * INTO v_saldo FROM public.saldos
    WHERE profile_id=v_profile FOR UPDATE;
  ELSE
    PERFORM public.fn_saldo_recalcular_entidade(NULL,NULL,v_afiliado);
    SELECT * INTO v_saldo FROM public.saldos
    WHERE afiliado_id=v_afiliado FOR UPDATE;
  END IF;

  IF NOT FOUND THEN RAISE EXCEPTION 'wallet_not_found'; END IF;
  IF v_saldo.saldo_disponivel < p_valor THEN RAISE EXCEPTION 'insufficient_available_balance'; END IF;

  LOOP
    v_protocolo:='SQ-'||upper(substr(encode(gen_random_bytes(16),'hex'),1,20));
    EXIT WHEN NOT EXISTS(SELECT 1 FROM public.saques WHERE protocolo=v_protocolo);
  END LOOP;

  INSERT INTO public.saques(
    empresa_id,profile_id,afiliado_id,conta_bancaria_id,protocolo,
    valor_solicitado,taxa_saque,valor_liquido,moeda,metodo_saque,status,
    data_solicitacao,idempotency_key,solicitado_por_profile_id,
    destino_snapshot,modo_processamento,reservado_em,metadata
  ) VALUES (
    v_empresa,v_profile,v_afiliado,v_cb.id,v_protocolo,
    round(p_valor,2),0,round(p_valor,2),'BRL','pix','solicitado',
    now(),p_idempotency_key,auth.uid(),
    jsonb_build_object(
      'titular',v_cb.titular,
      'documento_titular',v_cb.documento_titular,
      'banco_codigo',v_cb.banco_codigo,
      'banco_nome',v_cb.banco_nome,
      'agencia',v_cb.agencia,
      'agencia_dv',v_cb.agencia_dv,
      'conta',v_cb.conta,
      'conta_dv',v_cb.conta_dv,
      'tipo_conta',v_cb.tipo_conta,
      'chave_pix',v_cb.chave_pix,
      'tipo_chave_pix',v_cb.tipo_chave_pix
    ),
    'manual',now(),
    jsonb_build_object('origem_entidade',p_entidade)
  )
  RETURNING id INTO v_saque;

  -- Taxa da plataforma é snapshot separado. Se não houver regra configurada, fica zero.
  IF v_empresa IS NOT NULL THEN
    v_fee:=public.fn_saque_taxa_snapshot(v_saque,v_empresa,p_valor);
  ELSE
    -- Conta de afiliado/profile pode pertencer a uma empresa operacional; taxa só é aplicada
    -- quando houver empresa inequivocamente associada. Não inventamos taxa global aqui.
    v_fee:=0;
  END IF;

  v_net:=round(p_valor-v_fee,2);
  IF v_net<=0 THEN RAISE EXCEPTION 'withdraw_net_must_be_positive'; END IF;

  UPDATE public.saques
  SET taxa_saque=v_fee,valor_liquido=v_net,updated_at=now()
  WHERE id=v_saque;

  v_doc:=v_protocolo;

  -- Reserva o valor solicitado inteiro; taxa já está incluída dentro do valor reservado.
  PERFORM public.fn_ledger_registrar(
    'withdraw:'||v_saque||':reserve:debit',
    v_empresa,v_profile,v_afiliado,NULL,v_saque,NULL,NULL,NULL,
    'SAQUE_RESERVA','Reserva para saque','D',p_valor,'disponivel','efetivo',
    v_doc,'saque',v_saque,NULL,
    jsonb_build_object('taxa_snapshot',v_fee,'valor_liquido',v_net)
  );

  PERFORM public.fn_ledger_registrar(
    'withdraw:'||v_saque||':reserve:credit',
    v_empresa,v_profile,v_afiliado,NULL,v_saque,NULL,NULL,NULL,
    'SAQUE_RESERVA','Valor reservado para saque','C',p_valor,'reservado','efetivo',
    v_doc,'saque',v_saque,NULL,
    jsonb_build_object('taxa_snapshot',v_fee,'valor_liquido',v_net)
  );

  RETURN v_saque;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_solicitar_saque_v2(numeric,uuid,uuid,text)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_solicitar_saque_v2(numeric,uuid,uuid,text)
TO authenticated;

-- Compatibilidade: continua disponível, mas novos frontends devem usar a versão idempotente.
CREATE OR REPLACE FUNCTION public.fn_solicitar_saque(
  p_valor numeric,
  p_conta_bancaria_id uuid
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path=public
AS $$
  SELECT public.fn_solicitar_saque_v2(
    p_valor,p_conta_bancaria_id,gen_random_uuid(),'empresa'
  );
$$;

REVOKE ALL ON FUNCTION public.fn_solicitar_saque(numeric,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_solicitar_saque(numeric,uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.fn_saque_liberar_reserva(uuid,text);
CREATE OR REPLACE FUNCTION public.fn_saque_liberar_reserva(
  p_saque_id uuid,
  p_motivo text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v_s public.saques%ROWTYPE;
BEGIN
  SELECT * INTO v_s FROM public.saques WHERE id=p_saque_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_s.reserva_liberada_em IS NOT NULL OR v_s.status='pago' THEN RETURN false; END IF;

  PERFORM public.fn_ledger_registrar(
    'withdraw:'||v_s.id||':release:debit',
    v_s.empresa_id,v_s.profile_id,v_s.afiliado_id,NULL,v_s.id,NULL,NULL,NULL,
    'SAQUE_RESERVA_LIBERADA','Liberação de reserva de saque','D',
    v_s.valor_solicitado,'reservado','reversao',v_s.protocolo,
    'saque',v_s.id,NULL,jsonb_build_object('motivo',p_motivo)
  );

  PERFORM public.fn_ledger_registrar(
    'withdraw:'||v_s.id||':release:credit',
    v_s.empresa_id,v_s.profile_id,v_s.afiliado_id,NULL,v_s.id,NULL,NULL,NULL,
    'SAQUE_RESERVA_LIBERADA','Saldo devolvido após cancelamento/recusa','C',
    v_s.valor_solicitado,'disponivel','reversao',v_s.protocolo,
    'saque',v_s.id,NULL,jsonb_build_object('motivo',p_motivo)
  );

  UPDATE public.saques
  SET reserva_liberada_em=now(),updated_at=now()
  WHERE id=v_s.id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_saque_liberar_reserva(uuid,text)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_saque_liberar_reserva(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_cancelar_saque(p_saque_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_s public.saques%ROWTYPE;
  v_owns boolean:=false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_s FROM public.saques WHERE id=p_saque_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'withdraw_not_found'; END IF;

  v_owns :=
    v_s.solicitado_por_profile_id=auth.uid()
    OR v_s.profile_id=auth.uid()
    OR v_s.afiliado_id IN (
      SELECT a.id FROM public.afiliados a
      WHERE a.profile_id=auth.uid() AND a.deleted_at IS NULL
    )
    OR (
      v_s.empresa_id=public.current_empresa_id()
      AND public.fn_is_empresa_owner(v_s.empresa_id)
    )
    OR public.fn_is_admin_global();

  IF NOT v_owns THEN RAISE EXCEPTION 'withdraw_access_denied'; END IF;
  IF v_s.status NOT IN ('solicitado','em_analise') THEN
    RAISE EXCEPTION 'withdraw_cannot_be_cancelled';
  END IF;

  UPDATE public.saques
  SET status='cancelado',
      data_cancelamento=now(),
      cancelado_por=auth.uid(),
      motivo_cancelamento=coalesce(motivo_cancelamento,'Cancelado pelo solicitante'),
      updated_at=now()
  WHERE id=v_s.id;

  PERFORM public.fn_saque_liberar_reserva(v_s.id,'cancelado_pelo_solicitante');
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_cancelar_saque(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_cancelar_saque(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_saque_transicionar(
  p_saque_id uuid,
  p_novo_status text,
  p_motivo text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v_s public.saques%ROWTYPE;
BEGIN
  IF NOT public.fn_is_admin_global() THEN RAISE EXCEPTION 'platform_admin_required'; END IF;

  SELECT * INTO v_s FROM public.saques WHERE id=p_saque_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'withdraw_not_found'; END IF;

  IF p_novo_status='em_analise' AND v_s.status='solicitado' THEN
    UPDATE public.saques
    SET status='em_analise',data_analise=now(),analisado_por=auth.uid(),updated_at=now()
    WHERE id=v_s.id;
    RETURN true;
  END IF;

  IF p_novo_status='aprovado' AND v_s.status='em_analise' THEN
    UPDATE public.saques
    SET status='aprovado',data_aprovacao=now(),aprovado_por=auth.uid(),updated_at=now()
    WHERE id=v_s.id;
    RETURN true;
  END IF;

  IF p_novo_status='processando' AND v_s.status='aprovado' THEN
    UPDATE public.saques
    SET status='processando',ultima_tentativa_em=now(),updated_at=now()
    WHERE id=v_s.id;
    RETURN true;
  END IF;

  IF p_novo_status='rejeitado' AND v_s.status IN ('solicitado','em_analise','aprovado') THEN
    IF trim(coalesce(p_motivo,''))='' THEN RAISE EXCEPTION 'withdraw_rejection_reason_required'; END IF;
    UPDATE public.saques
    SET status='rejeitado',data_rejeicao=now(),rejeitado_por=auth.uid(),
        motivo_rejeicao=trim(p_motivo),updated_at=now()
    WHERE id=v_s.id;
    PERFORM public.fn_saque_liberar_reserva(v_s.id,'saque_recusado:'||trim(p_motivo));
    RETURN true;
  END IF;

  IF p_novo_status='falhou' AND v_s.status IN ('aprovado','processando','enviado') THEN
    IF trim(coalesce(p_motivo,''))='' THEN RAISE EXCEPTION 'withdraw_failure_reason_required'; END IF;
    UPDATE public.saques
    SET status='falhou',
        observacoes=concat_ws(E'\n',observacoes,'Falha definitiva: '||trim(p_motivo)),
        updated_at=now()
    WHERE id=v_s.id;
    PERFORM public.fn_saque_liberar_reserva(v_s.id,'falha_definitiva:'||trim(p_motivo));
    RETURN true;
  END IF;

  RAISE EXCEPTION 'invalid_withdraw_transition:%->%',v_s.status,p_novo_status;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_saque_transicionar(uuid,text,text)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_saque_transicionar(uuid,text,text)
TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_saque_registrar_pagamento_manual(
  p_saque_id uuid,
  p_referencia_bancaria text,
  p_evidencia text,
  p_data_pagamento timestamptz DEFAULT now()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v_s public.saques%ROWTYPE;
BEGIN
  IF NOT public.fn_is_admin_global() THEN RAISE EXCEPTION 'platform_admin_required'; END IF;
  IF trim(coalesce(p_referencia_bancaria,''))=''
     OR trim(coalesce(p_evidencia,''))='' THEN
    RAISE EXCEPTION 'withdraw_reconciliation_evidence_required';
  END IF;

  SELECT * INTO v_s FROM public.saques WHERE id=p_saque_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'withdraw_not_found'; END IF;
  IF v_s.status NOT IN ('aprovado','processando','enviado') THEN
    RAISE EXCEPTION 'withdraw_not_ready_for_reconciliation';
  END IF;
  IF v_s.conciliado_em IS NOT NULL OR v_s.status='pago' THEN
    RAISE EXCEPTION 'withdraw_already_reconciled';
  END IF;

  -- Saída da reserva para histórico liquidado. O valor líquido foi pago;
  -- a taxa permanece parte do valor consumido da carteira, já snapshotada.
  PERFORM public.fn_ledger_registrar(
    'withdraw:'||v_s.id||':paid:reserve_debit',
    v_s.empresa_id,v_s.profile_id,v_s.afiliado_id,NULL,v_s.id,NULL,NULL,NULL,
    'SAQUE_PAGO','Saque conciliado','D',v_s.valor_solicitado,
    'reservado','efetivo',v_s.protocolo,'saque',v_s.id,NULL,
    jsonb_build_object('referencia',p_referencia_bancaria)
  );

  PERFORM public.fn_ledger_registrar(
    'withdraw:'||v_s.id||':paid:liquidated_credit',
    v_s.empresa_id,v_s.profile_id,v_s.afiliado_id,NULL,v_s.id,NULL,NULL,NULL,
    'SAQUE_PAGO','Saque liquidado','C',v_s.valor_solicitado,
    'liquidado','efetivo',v_s.protocolo,'saque',v_s.id,NULL,
    jsonb_build_object(
      'referencia',trim(p_referencia_bancaria),
      'evidencia',trim(p_evidencia),
      'valor_liquido_pago',v_s.valor_liquido,
      'taxa_saque',v_s.taxa_saque
    )
  );

  UPDATE public.saques
  SET status='pago',
      data_pagamento=p_data_pagamento,
      referencia_conciliacao=trim(p_referencia_bancaria),
      evidencia_conciliacao=trim(p_evidencia),
      conciliado_por=auth.uid(),
      conciliado_em=now(),
      comprovante_url=coalesce(comprovante_url,trim(p_evidencia)),
      updated_at=now()
  WHERE id=v_s.id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_saque_registrar_pagamento_manual(
  uuid,text,text,timestamptz
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_saque_registrar_pagamento_manual(
  uuid,text,text,timestamptz
) TO authenticated;

-- Tentativa automática apenas registra intenção/estado. Envio real depende de Edge Function
-- com provedor de transferência configurado e nunca acontece por esta RPC.
CREATE OR REPLACE FUNCTION public.fn_admin_saque_preparar_tentativa_provedor(
  p_saque_id uuid,
  p_provedor text,
  p_idempotency_key uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_s public.saques%ROWTYPE;
  v_id uuid;
BEGIN
  IF NOT public.fn_is_admin_global() THEN RAISE EXCEPTION 'platform_admin_required'; END IF;
  IF trim(coalesce(p_provedor,''))='' OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'provider_and_idempotency_required';
  END IF;

  SELECT * INTO v_s FROM public.saques WHERE id=p_saque_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'withdraw_not_found'; END IF;
  IF v_s.status NOT IN ('aprovado','processando') THEN
    RAISE EXCEPTION 'withdraw_not_ready_for_provider';
  END IF;

  IF EXISTS(
    SELECT 1 FROM public.saque_processamento_tentativas
    WHERE saque_id=v_s.id AND status IN ('enviada','incerta')
  ) THEN
    RAISE EXCEPTION 'withdraw_provider_result_must_be_queried_before_retry';
  END IF;

  INSERT INTO public.saque_processamento_tentativas(
    saque_id,empresa_id,afiliado_id,provedor,idempotency_key,status,
    request_snapshot,criada_por
  ) VALUES (
    v_s.id,v_s.empresa_id,v_s.afiliado_id,trim(p_provedor),p_idempotency_key,'preparada',
    jsonb_build_object(
      'valor_liquido',v_s.valor_liquido,
      'moeda',v_s.moeda,
      'destino',v_s.destino_snapshot
    ),
    auth.uid()
  )
  ON CONFLICT(idempotency_key) DO UPDATE
    SET updated_at=now()
  RETURNING id INTO v_id;

  UPDATE public.saques
  SET modo_processamento='provedor',status='processando',
      ultima_tentativa_em=now(),updated_at=now()
  WHERE id=v_s.id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_saque_preparar_tentativa_provedor(uuid,text,uuid)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_saque_preparar_tentativa_provedor(uuid,text,uuid)
TO authenticated;

-- RLS de saques: solicitante vê o próprio; administradores financeiros da empresa veem a empresa;
-- admin global vê tudo.
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='saques'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.saques',p.policyname);
  END LOOP;
END $$;

CREATE POLICY saques_read
ON public.saques
FOR SELECT TO authenticated
USING (
  public.fn_is_admin_global()
  OR solicitado_por_profile_id=auth.uid()
  OR profile_id=auth.uid()
  OR afiliado_id IN (
    SELECT a.id FROM public.afiliados a
    WHERE a.profile_id=auth.uid() AND a.deleted_at IS NULL
  )
  OR (
    empresa_id=public.current_empresa_id()
    AND (
      public.fn_is_empresa_owner(empresa_id)
      OR public.fn_tem_permissao('financeiro','saques','read'::public.tipo_operacao)
    )
  )
);

CREATE OR REPLACE FUNCTION public.fn_saques_listar(
  p_entidade text DEFAULT 'empresa',
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  protocolo text,
  valor_solicitado numeric,
  taxa_saque numeric,
  valor_liquido numeric,
  status text,
  data_solicitacao timestamptz,
  data_pagamento timestamptz,
  destino jsonb,
  referencia_conciliacao text,
  modo_processamento text,
  total_registros bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_afiliado uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  IF p_entidade='afiliado' THEN
    SELECT a.id INTO v_afiliado FROM public.afiliados a
    WHERE a.profile_id=auth.uid() AND a.deleted_at IS NULL
    ORDER BY a.created_at LIMIT 1;
    IF v_afiliado IS NULL THEN RAISE EXCEPTION 'affiliate_not_found'; END IF;
  ELSIF p_entidade<>'empresa' THEN
    RAISE EXCEPTION 'invalid_withdraw_entity';
  END IF;

  RETURN QUERY
  SELECT
    s.id,s.protocolo::text,s.valor_solicitado,s.taxa_saque,s.valor_liquido,
    CASE
      WHEN s.status='processando' THEN 'em_processamento'
      WHEN s.status='rejeitado' THEN 'recusado'
      ELSE s.status::text
    END,
    s.data_solicitacao,s.data_pagamento,s.destino_snapshot,
    s.referencia_conciliacao::text,s.modo_processamento::text,
    count(*) OVER()
  FROM public.saques s
  WHERE (
    (p_entidade='empresa' AND s.empresa_id=v_empresa)
    OR (p_entidade='afiliado' AND s.afiliado_id=v_afiliado)
  )
    AND (coalesce(trim(p_status),'')='' OR
      CASE
        WHEN s.status='processando' THEN 'em_processamento'
        WHEN s.status='rejeitado' THEN 'recusado'
        ELSE s.status::text
      END = p_status
    )
  ORDER BY s.data_solicitacao DESC,s.id DESC
  LIMIT greatest(1,least(coalesce(p_limit,50),200))
  OFFSET greatest(coalesce(p_offset,0),0);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_saques_listar(text,text,integer,integer)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_saques_listar(text,text,integer,integer)
TO authenticated;
