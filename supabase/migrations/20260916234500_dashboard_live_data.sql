-- Cash Engine PRO — analytics reais do dashboard.
-- Não cria dados demonstrativos. Usa somente transações reais do tenant logado.

CREATE OR REPLACE FUNCTION public.fn_dashboard_series(
    p_inicio TIMESTAMPTZ,
    p_fim TIMESTAMPTZ,
    p_granularidade TEXT DEFAULT 'day'
)
RETURNS TABLE (
    bucket_start TIMESTAMPTZ,
    volume NUMERIC,
    sales BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
    SELECT
        CASE
            WHEN p_granularidade = 'hour' THEN date_trunc('hour', t.created_at)
            WHEN p_granularidade = 'month' THEN date_trunc('month', t.created_at)
            ELSE date_trunc('day', t.created_at)
        END AS bucket_start,
        COALESCE(SUM(t.valor_bruto), 0)::NUMERIC AS volume,
        COUNT(*)::BIGINT AS sales
    FROM public.transacoes t
    WHERE t.empresa_id = public.fn_get_empresa_usuario()
      AND t.created_at >= p_inicio
      AND t.created_at < p_fim
      AND t.tipo IN ('venda', 'assinatura', 'link_pagamento')
      AND t.status IN ('aprovada', 'autorizada', 'capturada', 'paga', 'disponivel')
    GROUP BY 1
    ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.fn_dashboard_series(TIMESTAMPTZ, TIMESTAMPTZ, TEXT)
TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_dashboard_top_products(
    p_inicio TIMESTAMPTZ,
    p_fim TIMESTAMPTZ,
    p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
    product_id UUID,
    product_name TEXT,
    sales BIGINT,
    revenue NUMERIC,
    commission_rate NUMERIC
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
    SELECT
        p.id AS product_id,
        p.nome::TEXT AS product_name,
        COUNT(t.id)::BIGINT AS sales,
        COALESCE(SUM(t.valor_bruto), 0)::NUMERIC AS revenue,
        COALESCE(p.taxa_comissao_afiliado, 0)::NUMERIC AS commission_rate
    FROM public.transacoes t
    JOIN public.produtos p ON p.id = t.produto_id
    WHERE t.empresa_id = public.fn_get_empresa_usuario()
      AND p.empresa_id = public.fn_get_empresa_usuario()
      AND t.created_at >= p_inicio
      AND t.created_at < p_fim
      AND t.tipo IN ('venda', 'assinatura', 'link_pagamento')
      AND t.status IN ('aprovada', 'autorizada', 'capturada', 'paga', 'disponivel')
      AND p.deleted_at IS NULL
    GROUP BY p.id, p.nome, p.taxa_comissao_afiliado
    ORDER BY revenue DESC, sales DESC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 5), 20));
$$;

GRANT EXECUTE ON FUNCTION public.fn_dashboard_top_products(TIMESTAMPTZ, TIMESTAMPTZ, INTEGER)
TO authenticated;
