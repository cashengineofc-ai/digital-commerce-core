import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = { "content-type": "application/json" };
const respond = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (request) => {
  if (request.method !== "POST") return respond(405, { error: "method_not_allowed" });

  const rawBody = await request.text();
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return respond(400, { error: "invalid_json" });
  }

  // Não processa pagamentos sem a chave de assinatura configurada.
  if (!Deno.env.get("MP_WEBHOOK_SECRET")) {
    return respond(503, { error: "webhook_not_configured" });
  }

  const externalEventId = String(event.id ?? (event.data as Record<string, unknown> | undefined)?.id ?? "");
  if (!externalEventId) return respond(400, { error: "missing_event_id" });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // O índice único torna o recebimento idempotente. O processador posterior deve
  // consultar o pagamento no Mercado Pago antes de modificar qualquer saldo.
  const { data, error } = await supabase
    .from("webhook_events")
    .upsert({
      provider: "mercado_pago",
      external_event_id: externalEventId,
      event_type: String(event.type ?? event.action ?? "unknown"),
      payload: event,
      status: "received",
      attempts: 1,
    }, { onConflict: "provider,external_event_id", ignoreDuplicates: true })
    .select("id")
    .maybeSingle();

  if (error) return respond(500, { error: "event_persist_failed" });
  return respond(202, { received: true, event_id: data?.id ?? null });
});
