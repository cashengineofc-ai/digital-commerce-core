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

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const configuredSalt = Deno.env.get("AFFILIATE_CLICK_SALT");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "tracking_not_configured" }, 503);

  let body: { code?: string };
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const code = typeof body.code === "string" ? body.code.trim().toLowerCase() : "";
  if (!/^[a-f0-9]{24}$/.test(code)) return json({ ok: true, tracked: false });

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: link, error } = await supabase
    .from("links_afiliados")
    .select("id,empresa_id,afiliado_id,status,data_inicio,data_fim,deleted_at")
    .eq("codigo_rastreio", code)
    .maybeSingle();
  if (error) return json({ error: "tracking_lookup_failed" }, 500);
  if (!link || link.deleted_at || link.status !== "ativo") return json({ ok: true, tracked: false });
  const now = Date.now();
  if (link.data_inicio && new Date(link.data_inicio).getTime() > now) return json({ ok: true, tracked: false });
  if (link.data_fim && new Date(link.data_fim).getTime() <= now) return json({ ok: true, tracked: false });

  const ip = (request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("cf-connecting-ip") || "unknown").trim().slice(0, 80);
  const ua = (request.headers.get("user-agent") || "unknown").slice(0, 500);
  let referrerHost: string | null = null;
  const ref = request.headers.get("referer");
  if (ref) {
    try { referrerHost = new URL(ref).hostname.slice(0, 255); } catch { referrerHost = null; }
  }
  const salt = configuredSalt || serviceRoleKey;
  const ipHash = await sha256(`${salt}|ip|${ip}`);
  const uaHash = await sha256(`${salt}|ua|${ua}`);
  const fingerprintHash = await sha256(`${salt}|fp|${ipHash}|${uaHash}`);
  const bucketMs = 10 * 60 * 1000;
  const bucketDate = new Date(Math.floor(now / bucketMs) * bucketMs).toISOString();
  const dedupeKey = await sha256(`${link.id}|${fingerprintHash}|${bucketDate}`);

  const insert = await supabase.from("afiliado_cliques").insert({
    empresa_id: link.empresa_id,
    link_afiliado_id: link.id,
    afiliado_id: link.afiliado_id,
    fingerprint_hash: fingerprintHash,
    ip_hash: ipHash,
    user_agent_hash: uaHash,
    referrer_host: referrerHost,
    dedupe_bucket: bucketDate,
    dedupe_key: dedupeKey,
  }).select("id").single();

  if (insert.error?.code === "23505") return json({ ok: true, tracked: false, duplicate: true });
  if (insert.error) {
    console.error("Affiliate click insert failed", insert.error);
    return json({ error: "tracking_insert_failed" }, 500);
  }

  await Promise.all([
    supabase.rpc("fn_increment_link_afiliado_clique", { p_link_id: link.id }),
    supabase.rpc("fn_increment_afiliado_clique", { p_afiliado_id: link.afiliado_id }),
  ]);

  return json({ ok: true, tracked: true });
});
