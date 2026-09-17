-- Cash Engine PRO — corrige KPIs operacionais do dashboard.
-- Inclui vendas por link de pagamento e exclui 'autorizada' dos status pagos.

CREATE OR REPLACE FUNCTION public.fn_dashboard_operacional(
    p_empresa_id UUID,
    p_inicio TIMESTAMPTZ,
    p_fim TIMESTAMPTZ
)
RETURNS TABLE(
    volume_processado NUMERIC,
    vendas_pagas BIGINT,
    receita_liquida NUMERIC,
    tentativas_validas BIGINT,
    pagamentos_aprovados BIGINT
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT
        COALESCE(
            SUM(t.valor_bruto) FILTER (
                WHERE t.tipo IN ('venda','assinatura','link_pagamento')
                  AND t.status IN ('aprovada','capturada','paga','disponivel')
            ),
            0
        ) AS volume_processado,

        COALESCE(
            COUNT(*) FILTER (
                WHERE t.tipo IN ('venda','assinatura','link_pagamento')
                  AND t.status IN ('aprovada','capturada','paga','disponivel')
            ),
            0
        ) AS vendas_pagas,

        COALESCE(
            SUM(t.valor_liquido) FILTER (
                WHERE t.tipo IN ('venda','assinatura','link_pagamento')
                  AND t.status IN ('aprovada','capturada','paga','disponivel')
            ),
            0
        ) AS receita_liquida,

        COALESCE(
            COUNT(*) FILTER (
                WHERE t.tipo IN ('venda','assinatura','link_pagamento')
                  AND t.status NOT IN ('cancelada','expirada')
            ),
            0
        ) AS tentativas_validas,

        COALESCE(
            COUNT(*) FILTER (
                WHERE t.tipo IN ('venda','assinatura','link_pagamento')
                  AND t.status IN ('aprovada','capturada','paga','disponivel')
            ),
            0
        ) AS pagamentos_aprovados

    FROM public.transacoes t
    WHERE t.empresa_id = p_empresa_id
      AND t.created_at >= p_inicio
      AND t.created_at < p_fim;
$$;
