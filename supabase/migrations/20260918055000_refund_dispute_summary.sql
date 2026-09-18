-- Cash Engine PRO — resumo da área unificada de estornos/contestações.
CREATE OR REPLACE FUNCTION public.fn_ocorrencias_financeiras_resumo()
RETURNS TABLE(
  estornos_concluidos numeric,
  estornos_pendentes numeric,
  chargebacks_reais numeric,
  total_estornos bigint,
  total_chargebacks bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
  SELECT
    coalesce((
      SELECT sum(coalesce(e.valor_efetivamente_estornado,0))
      FROM public.estornos e
      WHERE e.empresa_id=public.current_empresa_id()
        AND e.status='concluido'
    ),0)::numeric,
    coalesce((
      SELECT sum(e.valor_solicitado_estorno)
      FROM public.estornos e
      WHERE e.empresa_id=public.current_empresa_id()
        AND e.status IN ('solicitado','processando','aprovado_parcial','aprovado_total','em_disputa')
    ),0)::numeric,
    coalesce((
      SELECT sum(c.valor_chargeback)
      FROM public.chargebacks c
      WHERE c.empresa_id=public.current_empresa_id()
    ),0)::numeric,
    (
      SELECT count(*) FROM public.estornos e
      WHERE e.empresa_id=public.current_empresa_id()
    )::bigint,
    (
      SELECT count(*) FROM public.chargebacks c
      WHERE c.empresa_id=public.current_empresa_id()
    )::bigint;
$$;

REVOKE ALL ON FUNCTION public.fn_ocorrencias_financeiras_resumo()
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_ocorrencias_financeiras_resumo()
TO authenticated;
