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

function isBlockedHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.startsWith("127.") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    host.startsWith("169.254.") ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host)
  ) {
    return true;
  }
  return false;
}

async function hmacSha256(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "server_configuration_missing" }, 500);
  }

  const authorization = req.headers.get("Authorization") ?? "";
  if (authorization !== `Bearer ${serviceKey}`) {
    return json({ error: "service_role_required" }, 401);
  }

  const client = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: deliveries, error: claimError } = await client.rpc(
    "fn_webhook_dispatch_claim",
    { p_limit: 25 },
  );
  if (claimError) return json({ error: claimError.message }, 500);

  const results: Array<Record<string, unknown>> = [];

  for (const delivery of deliveries ?? []) {
    const id = String(delivery.delivery_id);
    const endpoint = String(delivery.endpoint_url ?? "");
    const secret = String(delivery.signing_secret ?? "");
    const event = String(delivery.evento ?? "");
    const idempotencyKey = String(delivery.idempotency_key ?? "");
    const payload = delivery.payload ?? {};
    const timeoutMs = Number(delivery.timeout_ms ?? 10000);
    const attempt = Number(delivery.attempt ?? 1);

    let ok = false;
    let status = 0;
    let duration = 0;
    let responseBody = "";
    let responseHeaders: Record<string, string> = {};
    let errorMessage = "";
    let signature = "";

    const started = performance.now();
    try {
      const url = new URL(endpoint);
      if (url.protocol !== "https:" || isBlockedHost(url.hostname)) {
        throw new Error("webhook_endpoint_not_allowed");
      }
      if (!secret) throw new Error("webhook_signing_secret_missing");

      const body = JSON.stringify(payload);
      const timestamp = Math.floor(Date.now() / 1000).toString();
      signature = await hmacSha256(secret, `${timestamp}.${body}`);

      const customHeaders =
        delivery.custom_headers &&
        typeof delivery.custom_headers === "object" &&
        !Array.isArray(delivery.custom_headers)
          ? (delivery.custom_headers as Record<string, unknown>)
          : {};

      const headers = new Headers({
        "Content-Type": "application/json",
        "User-Agent": "CashEnginePRO-Webhooks/1.0",
        "X-Cash-Engine-Event": event,
        "X-Cash-Engine-Delivery": id,
        "X-Cash-Engine-Timestamp": timestamp,
        "X-Cash-Engine-Signature": `v1=${signature}`,
        "Idempotency-Key": idempotencyKey,
      });

      for (const [key, value] of Object.entries(customHeaders)) {
        const normalized = key.toLowerCase();
        if (
          ["authorization", "host", "content-length", "x-cash-engine-signature"].includes(
            normalized,
          )
        ) {
          continue;
        }
        if (typeof value === "string" && value.length <= 1000) {
          headers.set(key, value);
        }
      }

      const response = await fetch(url.toString(), {
        method: "POST",
        headers,
        body,
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs),
      });

      status = response.status;
      ok = response.ok;
      responseBody = (await response.text()).slice(0, 4000);
      response.headers.forEach((value, key) => {
        if (
          ["content-type", "date", "server", "retry-after", "x-request-id"].includes(
            key.toLowerCase(),
          )
        ) {
          responseHeaders[key] = value.slice(0, 500);
        }
      });
      if (!ok) errorMessage = `http_${status}`;
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : "webhook_delivery_failed";
    } finally {
      duration = Math.max(0, Math.round(performance.now() - started));
    }

    const { error: completeError } = await client.rpc(
      "fn_webhook_dispatch_complete",
      {
        p_delivery_id: id,
        p_success: ok,
        p_status: status,
        p_duration_ms: duration,
        p_response_headers: responseHeaders,
        p_response_body: responseBody,
        p_error: errorMessage || null,
        p_signature: signature || null,
      },
    );

    results.push({
      delivery_id: id,
      event,
      attempt,
      ok,
      status,
      duration_ms: duration,
      persisted: !completeError,
      persistence_error: completeError?.message ?? null,
    });
  }

  return json({
    claimed: deliveries?.length ?? 0,
    processed: results.length,
    results,
  });
});
