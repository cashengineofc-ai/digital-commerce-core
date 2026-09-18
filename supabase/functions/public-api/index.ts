import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...extra,
    },
  });
}

function intParam(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function apiPath(pathname: string) {
  const marker = "/v1/";
  const index = pathname.indexOf(marker);
  return index >= 0 ? pathname.slice(index) : pathname;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "server_configuration_missing" }, 500);
  }

  const authorization = req.headers.get("Authorization") ?? "";
  const secret = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  if (!secret.startsWith("ce_")) {
    return json({ error: "invalid_api_key" }, 401);
  }

  const url = new URL(req.url);
  const path = apiPath(url.pathname);
  const limit = intParam(url.searchParams.get("limit"), 50, 1, 100);
  const page = intParam(url.searchParams.get("page"), 1, 1, 1000000);
  const offset = (page - 1) * limit;

  let scope = "";
  if (path === "/v1/products") scope = "products:read";
  else if (path === "/v1/orders") scope = "orders:read";
  else if (path === "/v1/reports/summary") scope = "reports:read";
  else return json({ error: "not_found" }, 404);

  const client = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authResult, error: authError } = await client.rpc(
    "fn_api_key_validate",
    {
      p_secret: secret,
      p_required_scope: scope,
    },
  );

  if (authError) {
    return json({ error: "api_key_validation_failed" }, 500);
  }
  if (!authResult?.empresa_id) {
    return json({ error: "invalid_api_key_or_scope" }, 403);
  }

  const empresaId = String(authResult.empresa_id);

  if (path === "/v1/products") {
    const { data, error } = await client.rpc("fn_api_products", {
      p_empresa_id: empresaId,
      p_limit: limit,
      p_offset: offset,
    });
    if (error) return json({ error: "query_failed", detail: error.message }, 500);

    const total = Number(data?.[0]?.total_records ?? 0);
    const items = (data ?? []).map(
      ({ total_records: _total, ...row }: Record<string, unknown>) => row,
    );
    return json({
      data: items,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  }

  if (path === "/v1/orders") {
    const status = url.searchParams.get("status")?.trim() || null;
    const { data, error } = await client.rpc("fn_api_orders", {
      p_empresa_id: empresaId,
      p_limit: limit,
      p_offset: offset,
      p_status: status,
    });
    if (error) return json({ error: "query_failed", detail: error.message }, 500);

    const total = Number(data?.[0]?.total_records ?? 0);
    const items = (data ?? []).map(
      ({ total_records: _total, ...row }: Record<string, unknown>) => row,
    );
    return json({
      data: items,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  }

  const end = url.searchParams.get("end")
    ? new Date(String(url.searchParams.get("end")))
    : new Date();
  const start = url.searchParams.get("start")
    ? new Date(String(url.searchParams.get("start")))
    : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end <= start
  ) {
    return json({ error: "invalid_period" }, 400);
  }

  const { data, error } = await client.rpc("fn_api_report_summary", {
    p_empresa_id: empresaId,
    p_start: start.toISOString(),
    p_end: end.toISOString(),
  });
  if (error) return json({ error: "query_failed", detail: error.message }, 500);

  return json({ data });
});
