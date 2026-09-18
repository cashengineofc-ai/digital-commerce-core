import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("Authorization");

  if (!supabaseUrl || !anonKey || !serviceKey || !authorization) {
    return json({ error: "server_configuration_missing" }, 500);
  }

  let integrationId = "";
  try {
    const body = await req.json();
    integrationId = String(body?.integration_id ?? "").trim();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!integrationId) return json({ error: "integration_id_required" }, 400);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json({ error: "unauthorized" }, 401);

  const { data: canManage, error: permissionError } = await userClient.rpc(
    "fn_integracao_pode_gerenciar",
  );
  if (permissionError || !canManage) return json({ error: "permission_denied" }, 403);

  const { data: visibleRows, error: visibleError } = await userClient.rpc(
    "fn_integracoes_listar_safe",
  );
  if (visibleError) return json({ error: visibleError.message }, 400);

  const visible = (visibleRows ?? []).some(
    (row: Record<string, unknown>) =>
      String(row.integracao_id ?? "") === integrationId,
  );
  if (!visible) return json({ error: "integration_not_available_in_context" }, 404);

  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: secretRows, error: secretError } = await serviceClient.rpc(
    "fn_integracao_service_secret",
    { p_integracao_id: integrationId },
  );
  if (secretError) {
    return json({ error: "integration_secret_unavailable", detail: secretError.message }, 400);
  }
  const secretRow = Array.isArray(secretRows) ? secretRows[0] : secretRows;
  const provider = String(secretRow?.provider ?? "");
  const secret = String(secretRow?.secret ?? "");

  if (!provider || !secret) {
    return json({ error: "integration_secret_unavailable" }, 400);
  }

  let success = false;
  let status = 0;
  let detail = "";

  try {
    if (provider === "mercado_pago") {
      const response = await fetch("https://api.mercadopago.com/users/me", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${secret}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10_000),
      });
      status = response.status;
      success = response.ok;

      if (!response.ok) {
        const text = await response.text();
        detail = text.slice(0, 700) || `HTTP ${response.status}`;
      }
    } else {
      status = 422;
      detail = "provider_test_not_implemented";
    }
  } catch (error) {
    status = 0;
    detail = error instanceof Error ? error.message : "provider_request_failed";
  }

  const { error: recordError } = await serviceClient.rpc(
    "fn_integracao_test_result",
    {
      p_integracao_id: integrationId,
      p_success: success,
      p_status: status,
      p_error: success ? null : detail,
    },
  );

  if (recordError) {
    return json(
      {
        error: "test_completed_but_result_persistence_failed",
        provider_status: status,
        detail: recordError.message,
      },
      500,
    );
  }

  return json({
    ok: success,
    provider,
    provider_status: status,
    error: success ? null : detail || "connection_test_failed",
  }, success ? 200 : 400);
});
