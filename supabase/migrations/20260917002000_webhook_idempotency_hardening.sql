-- Cash Engine PRO — hardening de idempotência e observabilidade dos webhooks.
-- Compatível com a Edge Function mercadopago-webhook atual.

ALTER TABLE public.webhook_events
    ENABLE ROW LEVEL SECURITY;

-- Garante idempotência por provedor + evento externo.
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_provider_external_unique
    ON public.webhook_events (provider, external_event_id);

-- Fila operacional: facilita localizar eventos pendentes/falhos para retry/monitoramento.
CREATE INDEX IF NOT EXISTS idx_webhook_events_retry_queue
    ON public.webhook_events (provider, status, received_at ASC)
    WHERE status IN ('received', 'processing', 'failed');

-- Histórico por tipo de evento.
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_type_received
    ON public.webhook_events (provider, event_type, received_at DESC);

-- Mantém acesso direto restrito a Admin Global; Edge Functions com service_role bypassam RLS.
DROP POLICY IF EXISTS "webhook_events_admin_only"
ON public.webhook_events;

CREATE POLICY "webhook_events_admin_only"
ON public.webhook_events
FOR ALL
TO authenticated
USING (public.fn_is_admin_global())
WITH CHECK (public.fn_is_admin_global());
