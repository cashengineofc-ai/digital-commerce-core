-- Cash Engine PRO — resumo de extrato reconciliável.
CREATE OR REPLACE FUNCTION public.fn_extrato_resumo(
  p_entidade text DEFAULT 'empresa',
  p_inicio timestamptz DEFAULT NULL,
  p_fim timestamptz DEFAULT NULL
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
SET search_path=public
AS $$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_afiliado uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  IF p_entidade='afiliado' THEN
    SELECT a.id INTO v_afiliado
    FROM public.afiliados a
    WHERE a.profile_id=auth.uid() AND a.status='ativo' AND a.deleted_at IS NULL
    ORDER BY a.created_at LIMIT 1;
    IF v_afiliado IS NULL THEN RAISE EXCEPTION 'affiliate_not_found'; END IF;
  ELSIF p_entidade<>'empresa' THEN
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
$$;

REVOKE ALL ON FUNCTION public.fn_extrato_resumo(text,timestamptz,timestamptz)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_extrato_resumo(text,timestamptz,timestamptz)
TO authenticated;
