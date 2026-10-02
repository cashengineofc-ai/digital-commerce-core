import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json; charset=utf-8" },
  });
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function mapOrderStatus(status?: string, detail?: string) {
  if (status === "processed" && detail === "accredited") return "teste_aprovada";
  if (status === "processed") return "teste_aprovada";
  if (status === "processing") return "processando";
  if (status === "canceled") return "cancelada";
  if (status === "expired") return "expirada";
  if (status === "failed") return "falhou";
  if (status === "refunded") return "reembolsada";
  if (status === "charged_back") return "chargeback";
  return "pendente";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "status_not_configured" }, 503);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  if (!isUuid(body.transaction_id) || !isUuid(body.idempotency_key)) {
    return json({ error: "invalid_status_credentials" }, 422);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("transacoes")
    .select("id,status,status_detalhe_provedor,data_pagamento,pix_expiracao,id_transacao_gateway,payload_provedor,provedor_pagamento")
    .eq("id", body.transaction_id)
    .eq("idempotency_key", body.idempotency_key)
    .maybeSingle();

  if (error) {
    console.error("Payment status lookup failed", error);
    return json({ error: "status_lookup_failed" }, 500);
  }
  if (!data) return json({ error: "payment_not_found" }, 404);

  const providerPayload =
    data.payload_provedor && typeof data.payload_provedor === "object"
      ? data.payload_provedor as Record<string, any>
      : null;
  const cashEngineMeta =
    providerPayload?._cash_engine && typeof providerPayload._cash_engine === "object"
      ? providerPayload._cash_engine as Record<string, any>
      : null;
  const sandboxOrder =
    data.provedor_pagamento === "mercadopago" &&
    cashEngineMeta?.sandbox === true &&
    cashEngineMeta?.provider_api === "orders" &&
    typeof data.id_transacao_gateway === "string" &&
    data.id_transacao_gateway.startsWith("ORD");

  if (sandboxOrder) {
    if (!accessToken) return json({ error: "mercadopago_not_configured" }, 503);

    let providerOrder: Record<string, any>;
    try {
      const response = await fetch(
        `https://api.mercadopago.com/v1/orders/${encodeURIComponent(data.id_transacao_gateway)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(12_000),
        },
      );
      if (!response.ok) {
        console.error("Sandbox order status lookup failed", response.status);
        return json({ error: "provider_status_lookup_failed" }, 502);
      }
      providerOrder = await response.json();
    } catch (statusError) {
      console.error("Sandbox order status request failed", statusError);
      return json({ error: "provider_status_lookup_failed" }, 502);
    }

    const referenceMatches = providerOrder.external_reference === data.id;
    const expectedCollector =
      cashEngineMeta?.collector_id == null ? null : String(cashEngineMeta.collector_id);
    const receivedCollector =
      providerOrder.user_id == null ? null : String(providerOrder.user_id);
    const collectorMatches =
      expectedCollector == null ||
      receivedCollector == null ||
      expectedCollector === receivedCollector;

    if (!referenceMatches || !collectorMatches) {
      return json({ error: "provider_status_validation_failed" }, 422);
    }

    const virtualStatus = mapOrderStatus(
      typeof providerOrder.status === "string" ? providerOrder.status : undefined,
      typeof providerOrder.status_detail === "string" ? providerOrder.status_detail : undefined,
    );

    return json({
      ok: true,
      sandbox: true,
      transaction_id: data.id,
      status: virtualStatus,
      status_detail: providerOrder.status_detail ?? providerOrder.status ?? null,
      provider_order_status: providerOrder.status ?? null,
      paid_at: virtualStatus === "teste_aprovada"
        ? providerOrder.last_updated_date ?? providerOrder.created_date ?? null
        : null,
      pix_expires_at: data.pix_expiracao,
    });
  }

  return json({
    ok: true,
    transaction_id: data.id,
    status: data.status,
    status_detail: data.status_detalhe_provedor,
    paid_at: data.data_pagamento,
    pix_expires_at: data.pix_expiracao,
  });
});
