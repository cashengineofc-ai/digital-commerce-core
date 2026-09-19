-- Cash Engine PRO
-- Fecha entrypoints financeiros legados/internos e aplica permissões granulares
-- aos RPCs atuais de extrato, saques e ocorrências.

BEGIN;

-- Resumo de extrato empresarial exige a mesma permissão do extrato detalhado.
CREATE OR REPLACE FUNCTION public.fn_extrato_resumo(
  p_entidade text DEFAULT 'empresa'::text,
  p_inicio timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_fim timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS TABLE(
  saldo_abertura numeric,
  creditos numeric,
  debitos numeric,
  movimento_liquido numeric,
  saldo_fechamento numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_afiliado uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_entidade='afiliado' THEN
    SELECT a.id INTO v_afiliado
    FROM public.afiliados a
    WHERE a.profile_id=auth.uid()
      AND a.status='ativo'
      AND a.deleted_at IS NULL
    ORDER BY a.created_at
    LIMIT 1;
    IF v_afiliado IS NULL THEN
      RAISE EXCEPTION 'affiliate_not_found';
    END IF;
  ELSIF p_entidade='empresa' THEN
    IF v_empresa IS NULL THEN
      RAISE EXCEPTION 'company_not_found';
    END IF;
    IF NOT (
      public.fn_is_admin_global()
      OR public.fn_is_empresa_owner(v_empresa)
      OR public.fn_tem_permissao(
        'financeiro','extrato','read'::public.tipo_operacao
      )
    ) THEN
      RAISE EXCEPTION 'permission_denied';
    END IF;
  ELSE
    RAISE EXCEPTION 'invalid_statement_entity';
  END IF;

  RETURN QUERY
  WITH rows AS (
    SELECT
      l.data_lancamento,
      l.bucket,
      CASE
        WHEN l.bucket='devedor'
          THEN CASE WHEN l.tipo_lancamento='C' THEN -l.valor ELSE l.valor END
        ELSE CASE WHEN l.tipo_lancamento='C' THEN l.valor ELSE -l.valor END
      END AS signed_value
    FROM public.lancamentos_contabeis l
    WHERE (
      (p_entidade='empresa'
       AND l.empresa_id=v_empresa
       AND l.profile_id IS NULL
       AND l.afiliado_id IS NULL)
      OR
      (p_entidade='afiliado' AND l.afiliado_id=v_afiliado)
    )
    AND l.bucket IN ('a_receber','disponivel','reservado','bloqueado','devedor')
  ),
  opening AS (
    SELECT coalesce(sum(signed_value),0) AS v
    FROM rows
    WHERE p_inicio IS NOT NULL AND data_lancamento<p_inicio
  ),
  period AS (
    SELECT
      coalesce(sum(signed_value) FILTER (WHERE signed_value>0),0) AS c,
      abs(coalesce(sum(signed_value) FILTER (WHERE signed_value<0),0)) AS d,
      coalesce(sum(signed_value),0) AS m
    FROM rows
    WHERE (p_inicio IS NULL OR data_lancamento>=p_inicio)
      AND (p_fim IS NULL OR data_lancamento<p_fim)
  )
  SELECT
    round((SELECT v FROM opening),2),
    round((SELECT c FROM period),2),
    round((SELECT d FROM period),2),
    round((SELECT m FROM period),2),
    round((SELECT v FROM opening)+(SELECT m FROM period),2);
END;
$function$;

-- Listagem empresarial de saques exige permissão de leitura.
CREATE OR REPLACE FUNCTION public.fn_saques_listar(
  p_entidade text DEFAULT 'empresa'::text,
  p_status text DEFAULT NULL::text,
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
  data_solicitacao timestamp with time zone,
  data_pagamento timestamp with time zone,
  destino jsonb,
  referencia_conciliacao text,
  modo_processamento text,
  total_registros bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_afiliado uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_entidade='afiliado' THEN
    SELECT a.id INTO v_afiliado
    FROM public.afiliados a
    WHERE a.profile_id=auth.uid()
      AND a.deleted_at IS NULL
    ORDER BY a.created_at
    LIMIT 1;
    IF v_afiliado IS NULL THEN
      RAISE EXCEPTION 'affiliate_not_found';
    END IF;
  ELSIF p_entidade='empresa' THEN
    IF v_empresa IS NULL THEN
      RAISE EXCEPTION 'company_not_found';
    END IF;
    IF NOT (
      public.fn_is_admin_global()
      OR public.fn_is_empresa_owner(v_empresa)
      OR public.fn_tem_permissao(
        'financeiro','saques','read'::public.tipo_operacao
      )
    ) THEN
      RAISE EXCEPTION 'permission_denied';
    END IF;
  ELSE
    RAISE EXCEPTION 'invalid_withdraw_entity';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.protocolo::text,
    s.valor_solicitado,
    s.taxa_saque,
    s.valor_liquido,
    CASE
      WHEN s.status='processando' THEN 'em_processamento'
      WHEN s.status='rejeitado' THEN 'recusado'
      ELSE s.status::text
    END,
    s.data_solicitacao,
    s.data_pagamento,
    s.destino_snapshot,
    s.referencia_conciliacao::text,
    s.modo_processamento::text,
    count(*) OVER()
  FROM public.saques s
  WHERE (
    (p_entidade='empresa' AND s.empresa_id=v_empresa)
    OR (p_entidade='afiliado' AND s.afiliado_id=v_afiliado)
  )
    AND (
      coalesce(trim(p_status),'')=''
      OR CASE
        WHEN s.status='processando' THEN 'em_processamento'
        WHEN s.status='rejeitado' THEN 'recusado'
        ELSE s.status::text
      END = p_status
    )
  ORDER BY s.data_solicitacao DESC,s.id DESC
  LIMIT greatest(1,least(coalesce(p_limit,50),200))
  OFFSET greatest(coalesce(p_offset,0),0);
END;
$function$;

-- Ocorrências combinadas respeitam separadamente estornos/read e chargebacks/read.
CREATE OR REPLACE FUNCTION public.fn_ocorrencias_financeiras_listar(
  p_tipo text DEFAULT NULL::text,
  p_status text DEFAULT NULL::text,
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
  data_ocorrencia timestamp with time zone,
  modo_processamento text,
  referencia text,
  total_registros bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_can_refunds boolean:=false;
  v_can_chargebacks boolean:=false;
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_can_refunds :=
    public.fn_is_admin_global()
    OR public.fn_is_empresa_owner(v_empresa)
    OR public.fn_tem_permissao(
      'financeiro','estornos','read'::public.tipo_operacao
    );

  v_can_chargebacks :=
    public.fn_is_admin_global()
    OR public.fn_is_empresa_owner(v_empresa)
    OR public.fn_tem_permissao(
      'financeiro','chargebacks','read'::public.tipo_operacao
    );

  IF NOT v_can_refunds AND NOT v_can_chargebacks THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  RETURN QUERY
  WITH source_rows AS (
    SELECT
      e.id AS origem_id,
      e.ocorrencia_tipo::text AS tipo,
      e.transacao_id,
      t.pedido_numero::text,
      coalesce(e.valor_efetivamente_estornado,e.valor_solicitado_estorno)::numeric AS valor,
      e.status::text AS status,
      e.motivo::text AS motivo,
      coalesce(e.data_conclusao,e.data_solicitacao)::timestamptz AS data_ocorrencia,
      e.modo_processamento::text AS modo_processamento,
      e.referencia_conciliacao::text AS referencia
    FROM public.estornos e
    JOIN public.transacoes t ON t.id=e.transacao_id
    WHERE v_can_refunds
      AND e.empresa_id=v_empresa

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
    WHERE v_can_chargebacks
      AND c.empresa_id=v_empresa
  ),
  filtered AS (
    SELECT *
    FROM source_rows
    WHERE (coalesce(trim(p_tipo),'')='' OR tipo=p_tipo)
      AND (coalesce(trim(p_status),'')='' OR status=p_status)
  )
  SELECT
    f.origem_id,
    f.tipo,
    f.transacao_id,
    f.pedido_numero,
    f.valor,
    f.status,
    f.motivo,
    f.data_ocorrencia,
    f.modo_processamento,
    f.referencia,
    count(*) OVER()
  FROM filtered f
  ORDER BY f.data_ocorrencia DESC,f.origem_id DESC
  LIMIT greatest(1,least(coalesce(p_limit,50),200))
  OFFSET greatest(coalesce(p_offset,0),0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_ocorrencias_financeiras_resumo()
RETURNS TABLE(
  estornos_concluidos numeric,
  estornos_pendentes numeric,
  chargebacks_reais numeric,
  total_estornos bigint,
  total_chargebacks bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_can_refunds boolean:=false;
  v_can_chargebacks boolean:=false;
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_can_refunds :=
    public.fn_is_admin_global()
    OR public.fn_is_empresa_owner(v_empresa)
    OR public.fn_tem_permissao(
      'financeiro','estornos','read'::public.tipo_operacao
    );

  v_can_chargebacks :=
    public.fn_is_admin_global()
    OR public.fn_is_empresa_owner(v_empresa)
    OR public.fn_tem_permissao(
      'financeiro','chargebacks','read'::public.tipo_operacao
    );

  IF NOT v_can_refunds AND NOT v_can_chargebacks THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  RETURN QUERY
  SELECT
    CASE WHEN v_can_refunds THEN coalesce((
      SELECT sum(coalesce(e.valor_efetivamente_estornado,0))
      FROM public.estornos e
      WHERE e.empresa_id=v_empresa AND e.status='concluido'
    ),0) ELSE 0 END::numeric,
    CASE WHEN v_can_refunds THEN coalesce((
      SELECT sum(e.valor_solicitado_estorno)
      FROM public.estornos e
      WHERE e.empresa_id=v_empresa
        AND e.status IN ('solicitado','processando','aprovado_parcial','aprovado_total','em_disputa')
    ),0) ELSE 0 END::numeric,
    CASE WHEN v_can_chargebacks THEN coalesce((
      SELECT sum(c.valor_chargeback)
      FROM public.chargebacks c
      WHERE c.empresa_id=v_empresa
    ),0) ELSE 0 END::numeric,
    CASE WHEN v_can_refunds THEN (
      SELECT count(*) FROM public.estornos e WHERE e.empresa_id=v_empresa
    ) ELSE 0 END::bigint,
    CASE WHEN v_can_chargebacks THEN (
      SELECT count(*) FROM public.chargebacks c WHERE c.empresa_id=v_empresa
    ) ELSE 0 END::bigint;
END;
$function$;

-- Chargebacks: isolamento por tenant + permissão específica de leitura.
DROP POLICY IF EXISTS chargebacks_select_secure ON public.chargebacks;
CREATE POLICY chargebacks_select_secure
ON public.chargebacks
FOR SELECT
TO authenticated
USING (
  public.fn_is_admin_global()
  OR (
    empresa_id=public.current_empresa_id()
    AND (
      public.fn_is_empresa_owner(empresa_id)
      OR public.fn_tem_permissao(
        'financeiro','chargebacks','read'::public.tipo_operacao
      )
    )
  )
);

-- Roles anônimas não precisam consultar registros financeiros internos.
REVOKE SELECT ON TABLE public.chargebacks FROM anon;
REVOKE SELECT ON TABLE public.estornos FROM anon;
REVOKE SELECT ON TABLE public.transacoes FROM anon;

-- Entry points legados/internos. Mantemos as funções para dependências de banco,
-- mas removemos chamadas diretas pelo navegador.
REVOKE EXECUTE ON FUNCTION public.fn_solicitar_saque(numeric,uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_solicitar_estorno(uuid,numeric,text,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_extrato_financeiro(text,timestamp with time zone,timestamp with time zone,text,text,integer,integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_aplicar_reversao_financeira(uuid,numeric,numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_confirmar_estorno_provedor(uuid,text,jsonb,numeric,numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_definir_data_disponivel_transacao() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_recalcular_agregados_transacao(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_recalcular_pedido_financeiro(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_recalcular_saldo_entidade(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_sync_agregados_transacao() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_sync_pedido_por_transacao() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_trigger_processar_financeiro_transacao() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_trigger_recalcular_pedido_financeiro() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_trigger_recalcular_saldo_ledger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_notificar_estorno_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_notificar_saque_status() FROM PUBLIC, anon, authenticated;

-- Rotinas manuais/admin continuam disponíveis para authenticated porque validam
-- Admin Global internamente, mas a role anônima não precisa enxergá-las.
REVOKE EXECUTE ON FUNCTION public.fn_confirmar_estorno_manual(uuid,text,text,timestamp with time zone) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_confirmar_saque_manual(uuid,text,text,timestamp with time zone) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_saque_admin_transicionar(uuid,public.status_saque,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_admin_financeiro_saques(integer,integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_estornos_contestacoes(integer,integer) FROM anon;

COMMIT;
