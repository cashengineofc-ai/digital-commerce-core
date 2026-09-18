import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-dispatch-secret",
};

type Delivery = {
  delivery_id: string;
  notificacao_id: string;
  profile_id: string | null;
  canal: "email" | "push";
  tentativa: number;
  titulo: string;
  mensagem: string;
  url_destino: string | null;
  email_destino: string | null;
  push_subscriptions: Array<{
    subscription_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    device_id: string;
  }>;
};

function required(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name}_not_configured`);
  return value;
}

async function postJson(url: string, token: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { response, text, json };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const expected = required("NOTIFICATION_DISPATCH_SECRET");
    if (req.headers.get("x-dispatch-secret") !== expected) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...cors, "content-type": "application/json" },
      });
    }

    const supabaseUrl = required("SUPABASE_URL");
    const serviceRole = required("SUPABASE_SERVICE_ROLE_KEY");
    const client = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const payload = await req.json().catch(() => ({}));
    const limit = Math.max(1, Math.min(Number(payload?.limit ?? 25), 100));

    const { data, error } = await client.rpc("fn_notification_delivery_claim", {
      p_limit: limit,
    });
    if (error) throw error;

    const deliveries = (data ?? []) as Delivery[];
    const results: Array<Record<string, unknown>> = [];

    for (const delivery of deliveries) {
      try {
        if (delivery.canal === "email") {
          const providerUrl = required("NOTIFICATION_EMAIL_PROVIDER_URL");
          const providerToken = required("NOTIFICATION_EMAIL_PROVIDER_TOKEN");
          if (!delivery.email_destino) throw new Error("email_destination_missing");

          const sent = await postJson(providerUrl, providerToken, {
            to: delivery.email_destino,
            subject: delivery.titulo,
            text: delivery.mensagem,
            url: delivery.url_destino,
            notification_id: delivery.notificacao_id,
            idempotency_key: `notification:${delivery.notificacao_id}:email`,
          });

          if (!sent.response.ok) {
            throw new Error(`email_provider_${sent.response.status}:${sent.text.slice(0,300)}`);
          }

          const providerId = String(sent.json?.id ?? sent.json?.message_id ?? "");
          await client.rpc("fn_notification_delivery_finish", {
            p_delivery_id: delivery.delivery_id,
            p_success: true,
            p_provider_id: providerId || null,
            p_error: null,
            p_retry_after_seconds: null,
          });
          results.push({ id: delivery.delivery_id, channel: "email", ok: true });
          continue;
        }

        const providerUrl = required("NOTIFICATION_PUSH_PROVIDER_URL");
        const providerToken = required("NOTIFICATION_PUSH_PROVIDER_TOKEN");
        if (!delivery.push_subscriptions?.length) {
          throw new Error("no_active_push_subscription");
        }

        let delivered = 0;
        const failures: string[] = [];

        for (const subscription of delivery.push_subscriptions) {
          const sent = await postJson(providerUrl, providerToken, {
            subscription: {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            notification: {
              title: delivery.titulo,
              body: delivery.mensagem,
              url: delivery.url_destino ?? "/app",
            },
            idempotency_key: `notification:${delivery.notificacao_id}:push:${subscription.subscription_id}`,
          });

          if (sent.response.ok) {
            delivered += 1;
            await client.rpc("fn_push_subscription_success", {
              p_subscription_id: subscription.subscription_id,
            });
          } else {
            const expired = [404, 410].includes(sent.response.status);
            const reason = `push_provider_${sent.response.status}:${sent.text.slice(0,250)}`;
            failures.push(reason);
            await client.rpc("fn_push_subscription_fail", {
              p_subscription_id: subscription.subscription_id,
              p_error: reason,
              p_expired: expired,
            });
          }
        }

        if (delivered === 0) {
          throw new Error(failures.join(" | ") || "push_delivery_failed");
        }

        await client.rpc("fn_notification_delivery_finish", {
          p_delivery_id: delivery.delivery_id,
          p_success: true,
          p_provider_id: `subscriptions:${delivered}`,
          p_error: failures.length ? failures.join(" | ").slice(0, 900) : null,
          p_retry_after_seconds: null,
        });
        results.push({
          id: delivery.delivery_id,
          channel: "push",
          ok: true,
          delivered,
          failed: failures.length,
        });
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        const retry = delivery.tentativa < 5
          ? Math.min(3600, 60 * 2 ** Math.max(0, delivery.tentativa - 1))
          : null;

        await client.rpc("fn_notification_delivery_finish", {
          p_delivery_id: delivery.delivery_id,
          p_success: false,
          p_provider_id: null,
          p_error: message,
          p_retry_after_seconds: retry,
        });
        results.push({
          id: delivery.delivery_id,
          channel: delivery.canal,
          ok: false,
          error: message,
          retry_after_seconds: retry,
        });
      }
    }

    return new Response(
      JSON.stringify({ ok: true, processed: results.length, results }),
      { headers: { ...cors, "content-type": "application/json" } },
    );
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...cors, "content-type": "application/json" },
    });
  }
});
