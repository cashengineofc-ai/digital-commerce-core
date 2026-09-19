-- Cash Engine PRO
-- Protege RPCs SECURITY DEFINER de leitura/sincronização financeira.
-- Não altera saldos, transações ou lançamentos durante a migration.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_sincronizar_saldo_empresa()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_row record;
  v_total integer:=0;
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT (
    public.fn_is_admin_global()
    OR public.fn_is_empresa_owner(v_empresa)
    OR public.fn_tem_permissao(
      'financeiro', 'saldo', 'read'::public.tipo_operacao
    )
  ) THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  FOR v_row IN
    SELECT id
    FROM public.transacoes
    WHERE empresa_id=v_empresa
      AND status IN ('aprovada','capturada','paga','disponivel')
      AND saldo_processado_em IS NULL
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
  LOOP
    IF public.fn_financeiro_snapshot_venda(v_row.id) THEN
      v_total:=v_total+1;
    END IF;
  END LOOP;

  FOR v_row IN
    SELECT id
    FROM public.transacoes
    WHERE empresa_id=v_empresa
      AND status IN ('aprovada','capturada','paga','disponivel')
      AND saldo_processado_em IS NOT NULL
      AND saldo_liberado_em IS NULL
      AND (
        status='disponivel'
        OR (data_disponivel IS NOT NULL AND data_disponivel<=now())
      )
    ORDER BY coalesce(data_disponivel,created_at)
    FOR UPDATE SKIP LOCKED
  LOOP
    IF public.fn_financeiro_liberar_transacao(v_row.id) THEN
      v_total:=v_total+1;
    END IF;
  END LOOP;

  PERFORM public.fn_saldo_recalcular_entidade(v_empresa,NULL,NULL);
  RETURN v_total;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_extrato_financeiro_v2(
  p_entidade text DEFAULT 'empresa'::text,
  p_inicio timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_fim timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_tipo text DEFAULT NULL::text,
  p_bucket text DEFAULT NULL::text,
  p_busca text DEFAULT NULL::text,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  data_lancamento timestamp with time zone,
  descricao text,
  conta text,
  bucket text,
  tipo text,
  valor numeric,
  valor_assinado numeric,
  documento text,
  transacao_id uuid,
  saque_id uuid,
  estorno_id uuid,
  saldo_abertura numeric,
  movimento_periodo numeric,
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
        'financeiro', 'extrato', 'read'::public.tipo_operacao
      )
    ) THEN
      RAISE EXCEPTION 'permission_denied';
    END IF;
  ELSE
    RAISE EXCEPTION 'invalid_statement_entity';
  END IF;

  IF coalesce(trim(p_tipo),'')<>'' AND p_tipo NOT IN ('credito','debito') THEN
    RAISE EXCEPTION 'invalid_statement_type';
  END IF;

  RETURN QUERY
  WITH entity_rows AS (
    SELECT
      l.*,
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
  ),
  opening AS (
    SELECT coalesce(sum(er.signed_value),0) AS value
    FROM entity_rows er
    WHERE p_inicio IS NOT NULL
      AND er.data_lancamento<p_inicio
      AND er.bucket IN ('a_receber','disponivel','reservado','bloqueado','devedor')
  ),
  filtered AS (
    SELECT *
    FROM entity_rows er
    WHERE (p_inicio IS NULL OR er.data_lancamento>=p_inicio)
      AND (p_fim IS NULL OR er.data_lancamento<p_fim)
      AND (coalesce(trim(p_tipo),'')='' OR
        (p_tipo='credito' AND er.signed_value>=0)
        OR (p_tipo='debito' AND er.signed_value<0)
      )
      AND (coalesce(trim(p_bucket),'')='' OR er.bucket=p_bucket)
      AND (
        coalesce(trim(p_busca),'')=''
        OR er.descricao ILIKE '%'||trim(p_busca)||'%'
        OR coalesce(er.documento_referencia,'') ILIKE '%'||trim(p_busca)||'%'
        OR er.conta_contabil ILIKE '%'||trim(p_busca)||'%'
        OR er.id::text ILIKE '%'||trim(p_busca)||'%'
      )
  ),
  period_total AS (
    SELECT coalesce(sum(signed_value),0) AS value FROM filtered
  )
  SELECT
    f.id,
    f.data_lancamento,
    f.descricao::text,
    f.conta_contabil::text,
    f.bucket::text,
    CASE WHEN f.signed_value>=0 THEN 'credito' ELSE 'debito' END::text,
    f.valor,
    f.signed_value,
    f.documento_referencia::text,
    f.transacao_id,
    f.saque_id,
    f.estorno_id,
    (SELECT value FROM opening),
    (SELECT value FROM period_total),
    count(*) OVER()
  FROM filtered f
  ORDER BY f.data_lancamento DESC,f.id DESC
  LIMIT greatest(1,least(coalesce(p_limit,50),200))
  OFFSET greatest(coalesce(p_offset,0),0);
END;
$function$;

COMMIT;
