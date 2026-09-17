-- Cash Engine PRO — reversão de parceiros autorizados em estornos.
-- Cada beneficiário responde proporcionalmente pela participação que recebeu.

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
      WHEN 'plataforma' THEN
        v_platform_delta:=v_platform_delta+v_delta;
      WHEN 'autorizado' THEN
        IF v_split.profile_id IS NULL THEN
          RAISE EXCEPTION 'authorized_split_profile_missing';
        END IF;
        PERFORM public.fn_ledger_debitar_entidade(
          'refund:'||v_e.id||':authorized:'||v_split.profile_id,
          v_e.empresa_id,v_split.profile_id,NULL,v_delta,
          'ESTORNO_SPLIT_AUTORIZADO',
          'Reversão proporcional de participação autorizada',
          v_t.id,v_e.id,v_e.protocolo,
          jsonb_build_object(
            'valor_estornado',p_valor_efetivo,
            'split_distribution_id',v_split.id,
            'rule_id',v_split.regra_id,
            'rule_version',v_split.regra_versao
          )
        );
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
