-- Cash Engine PRO: base operacional para pagamentos e webhooks.
-- Esta migration não cria dados demonstrativos. Todos os valores começam em zero.

CREATE TABLE IF NOT EXISTS public.webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    external_event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processing', 'processed', 'failed', 'ignored')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    error TEXT,
    transaction_id UUID REFERENCES public.transacoes(id) ON DELETE SET NULL,
    UNIQUE (provider, external_event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_status_received
    ON public.webhook_events (status, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_transaction
    ON public.webhook_events (transaction_id);

ALTER TABLE public.transacoes
    ADD COLUMN IF NOT EXISTS provedor_pagamento TEXT,
    ADD COLUMN IF NOT EXISTS idempotency_key UUID,
    ADD COLUMN IF NOT EXISTS status_detalhe_provedor TEXT,
    ADD COLUMN IF NOT EXISTS payload_provedor JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transacoes_empresa_idempotency
    ON public.transacoes (empresa_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_transacoes_provedor_externo
    ON public.transacoes (provedor_pagamento, id_transacao_gateway)
    WHERE id_transacao_gateway IS NOT NULL;

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_events_admin_only" ON public.webhook_events
    FOR ALL
    USING (public.fn_is_admin_global())
    WITH CHECK (public.fn_is_admin_global());

CREATE OR REPLACE FUNCTION public.fn_dashboard_operacional(
    p_empresa_id UUID,
    p_inicio TIMESTAMPTZ,
    p_fim TIMESTAMPTZ
)
RETURNS TABLE (
    volume_processado NUMERIC,
    vendas_pagas BIGINT,
    receita_liquida NUMERIC,
    tentativas_validas BIGINT,
    pagamentos_aprovados BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
    SELECT
        COALESCE(SUM(t.valor_bruto) FILTER (WHERE t.status IN ('aprovada', 'autorizada', 'capturada', 'paga', 'disponivel')), 0),
        COALESCE(COUNT(*) FILTER (WHERE t.tipo IN ('venda', 'assinatura') AND t.status IN ('aprovada', 'autorizada', 'capturada', 'paga', 'disponivel')), 0),
        COALESCE(SUM(t.valor_liquido) FILTER (WHERE t.status IN ('aprovada', 'autorizada', 'capturada', 'paga', 'disponivel')), 0),
        COALESCE(COUNT(*) FILTER (WHERE t.tipo IN ('venda', 'assinatura') AND t.status NOT IN ('cancelada', 'expirada')), 0),
        COALESCE(COUNT(*) FILTER (WHERE t.tipo IN ('venda', 'assinatura') AND t.status IN ('aprovada', 'autorizada', 'capturada', 'paga', 'disponivel')), 0)
    FROM public.transacoes t
    WHERE t.empresa_id = p_empresa_id
      AND t.created_at >= p_inicio
      AND t.created_at < p_fim;
$$;

GRANT EXECUTE ON FUNCTION public.fn_dashboard_operacional(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
