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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
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
    .select("id,status,status_detalhe_provedor,data_pagamento,pix_expiracao")
    .eq("id", body.transaction_id)
    .eq("idempotency_key", body.idempotency_key)
    .maybeSingle();

  if (error) {
    console.error("Payment status lookup failed", error);
    return json({ error: "status_lookup_failed" }, 500);
  }
  if (!data) return json({ error: "payment_not_found" }, 404);

  return json({
    ok: true,
    transaction_id: data.id,
    status: data.status,
    status_detail: data.status_detalhe_provedor,
    paid_at: data.data_pagamento,
    pix_expires_at: data.pix_expiracao,
  });
});
