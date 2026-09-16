-- Cash Engine PRO — RPCs reais do dashboard.
-- Executar depois das migrations base e de runtime_integrity.
-- Não cria dados demonstrativos e respeita a empresa do usuário autenticado.

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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id UUID;
    v_granularidade TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN;
    END IF;

    v_empresa_id := public.fn_get_empresa_usuario();
    IF v_empresa_id IS NULL THEN
        RETURN;
    END IF;

    IF p_inicio IS NULL OR p_fim IS NULL OR p_fim <= p_inicio THEN
        RAISE EXCEPTION 'Período inválido';
    END IF;

    v_granularidade := CASE LOWER(COALESCE(p_granularidade, 'day'))
        WHEN 'hour' THEN 'hour'
        WHEN 'month' THEN 'month'
        ELSE 'day'
    END;

    RETURN QUERY
    SELECT
        date_trunc(v_granularidade, t.created_at) AS bucket_start,
        COALESCE(SUM(t.valor_bruto), 0)::NUMERIC AS volume,
        COUNT(*)::BIGINT AS sales
    FROM public.transacoes t
    WHERE t.empresa_id = v_empresa_id
      AND t.created_at >= p_inicio
      AND t.created_at < p_fim
      AND t.tipo IN ('venda', 'assinatura', 'link_pagamento')
      AND t.status IN ('aprovada', 'autorizada', 'capturada', 'paga', 'disponivel')
    GROUP BY 1
    ORDER BY 1;
END;
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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id UUID;
    v_limit INTEGER;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN;
    END IF;

    v_empresa_id := public.fn_get_empresa_usuario();
    IF v_empresa_id IS NULL THEN
        RETURN;
    END IF;

    IF p_inicio IS NULL OR p_fim IS NULL OR p_fim <= p_inicio THEN
        RAISE EXCEPTION 'Período inválido';
    END IF;

    v_limit := LEAST(GREATEST(COALESCE(p_limit, 5), 1), 50);

    RETURN QUERY
    SELECT
        p.id AS product_id,
        p.nome::TEXT AS product_name,
        COUNT(t.id)::BIGINT AS sales,
        COALESCE(SUM(t.valor_bruto), 0)::NUMERIC AS revenue,
        COALESCE(p.taxa_comissao_afiliado, 0)::NUMERIC AS commission_rate
    FROM public.transacoes t
    INNER JOIN public.produtos p
        ON p.id = t.produto_id
       AND p.empresa_id = v_empresa_id
       AND p.deleted_at IS NULL
    WHERE t.empresa_id = v_empresa_id
      AND t.created_at >= p_inicio
      AND t.created_at < p_fim
      AND t.tipo IN ('venda', 'assinatura', 'link_pagamento')
      AND t.status IN ('aprovada', 'autorizada', 'capturada', 'paga', 'disponivel')
      AND t.produto_id IS NOT NULL
    GROUP BY p.id, p.nome, p.taxa_comissao_afiliado
    ORDER BY revenue DESC, sales DESC, p.nome ASC
    LIMIT v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_dashboard_top_products(TIMESTAMPTZ, TIMESTAMPTZ, INTEGER)
TO authenticated;

CREATE INDEX IF NOT EXISTS idx_transacoes_empresa_period_product_runtime
    ON public.transacoes (empresa_id, created_at DESC, produto_id)
    WHERE tipo IN ('venda', 'assinatura', 'link_pagamento');
