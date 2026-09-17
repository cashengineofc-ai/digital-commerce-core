import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type MercadoPagoNotification = {
  id?: string | number;
  type?: string;
  action?: string;
  data?: { id?: string | number };
};

type MercadoPagoPayment = {
  id: number;
  collector_id?: number | string | null;
  status?: string;
  status_detail?: string;
  payment_method_id?: string;
  payment_type_id?: string;
  transaction_amount?: number;
  transaction_amount_refunded?: number;
  installments?: number;
  date_approved?: string | null;
  date_last_updated?: string | null;
  external_reference?: string | null;
  metadata?: Record<string, unknown> | null;
  card?: { last_four_digits?: string | null } | null;
  transaction_details?: { net_received_amount?: number | null } | null;
  fee_details?: Array<{ amount?: number | null; type?: string | null }> | null;
};

type LocalTransaction = {
  id: string;
  pedido_id: string | null;
  empresa_id: string;
  valor_bruto: number;
  id_transacao_gateway: string | null;
  payload_provedor: Record<string, unknown> | null;
  provedor_pagamento: string | null;
  metodo_pagamento: string | null;
};

const jsonHeaders = { "content-type": "application/json; charset=utf-8" };
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}
function parseSignature(value: string | null) {
  if (!value) return { ts: null as string | null, v1: null as string | null };
  let ts: string | null = null;
  let v1: string | null = null;
  for (const part of value.split(",")) {
    const [rawKey, ...rest] = part.split("=");
    const key = rawKey?.trim();
    const parsedValue = rest.join("=").trim();
    if (key === "ts") ts = parsedValue;
    if (key === "v1") v1 = parsedValue;
  }
  return { ts, v1 };
}
function buildManifest(dataId: string | null, requestId: string | null, ts: string | null) {
  const parts: string[] = [];
  if (dataId) parts.push(`id:${dataId}`);
  if (requestId) parts.push(`request-id:${requestId}`);
  if (ts) parts.push(`ts:${ts}`);
  return parts.length ? `${parts.join(";")};` : "";
}
async function hmacSha256Hex(secret: string, message: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function mapStatus(status?: string) {
  switch (status) {
    case "approved": return "aprovada";
    case "authorized": return "autorizada";
    case "in_process": return "processando";
    case "in_mediation": return "em_disputa";
    case "rejected": return "rejeitada";
    case "cancelled": return "cancelada";
    case "refunded": return "reembolsada";
    case "charged_back": return "chargeback";
    default: return "pendente";
  }
}
function numberOrUndefined(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
function collectorFromPayload(payload: Record<string, unknown> | null) {
  if (!payload) return null;
  const value = payload.collector_id;
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
  const webhookSecret = Deno.env.get("MERCADO_PAGO_WEBHOOK_SECRET");
  if (!supabaseUrl || !serviceRoleKey || !accessToken || !webhookSecret) {
    console.error("Mercado Pago webhook is missing required secrets");
    return jsonResponse({ error: "webhook_not_configured" }, 503);
  }

  let notification: MercadoPagoNotification;
  try { notification = await request.json(); } catch { return jsonResponse({ error: "invalid_json" }, 400); }

  const url = new URL(request.url);
  const requestId = request.headers.get("x-request-id");
  const { ts, v1 } = parseSignature(request.headers.get("x-signature"));
  const rawQueryDataId = url.searchParams.get("data.id") ?? url.searchParams.get("data_id");
  const signatureDataId = rawQueryDataId ? rawQueryDataId.toLowerCase() : null;
  const bodyDataId = notification.data?.id != null ? String(notification.data.id) : null;
  const dataId = rawQueryDataId ?? bodyDataId;
  const manifest = buildManifest(signatureDataId, requestId, ts);
  if (!v1 || !ts || !manifest) return jsonResponse({ error: "missing_signature_data" }, 401);
  const expectedSignature = await hmacSha256Hex(webhookSecret, manifest);
  if (!constantTimeEqual(expectedSignature, v1.toLowerCase())) return jsonResponse({ error: "invalid_signature" }, 401);

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const eventType = notification.type ?? notification.action ?? "unknown";
  const externalEventId = requestId ?? (notification.id != null ? String(notification.id) : null) ?? `${eventType}:${dataId ?? "unknown"}:${ts}`;
  const existingEvent = await supabase.from("webhook_events").select("id,status,transaction_id,attempts").eq("provider", "mercadopago").eq("external_event_id", externalEventId).maybeSingle();
  if (existingEvent.error) return jsonResponse({ error: "webhook_event_lookup_failed" }, 500);
  if (existingEvent.data?.status === "processed" || existingEvent.data?.status === "ignored") return jsonResponse({ ok: true, duplicate: true });

  let eventId = existingEvent.data?.id as string | undefined;
  const attempts = Number(existingEvent.data?.attempts ?? 0) + 1;
  if (eventId) {
    const result = await supabase.from("webhook_events").update({ status: "processing", attempts, payload: notification, error: null }).eq("id", eventId);
    if (result.error) return jsonResponse({ error: "webhook_event_update_failed" }, 500);
  } else {
    const result = await supabase.from("webhook_events").insert({ provider: "mercadopago", external_event_id: externalEventId, event_type: eventType, payload: notification, status: "processing", attempts }).select("id").single();
    if (result.error) {
      if (result.error.code === "23505") return jsonResponse({ ok: true, duplicate: true });
      return jsonResponse({ error: "webhook_event_insert_failed" }, 500);
    }
    eventId = result.data.id;
  }

  const finishEvent = async (status: "processed" | "failed" | "ignored", values: { transaction_id?: string | null; error?: string | null } = {}) => {
    if (!eventId) return;
    const result = await supabase.from("webhook_events").update({
      status,
      processed_at: status === "processed" || status === "ignored" ? new Date().toISOString() : null,
      transaction_id: values.transaction_id ?? null,
      error: values.error ?? null,
    }).eq("id", eventId);
    if (result.error) console.error("Failed finalizing webhook event", result.error);
  };

  const isPaymentNotification = notification.type === "payment" || notification.action?.startsWith("payment.");
  if (!isPaymentNotification || !dataId) {
    await finishEvent("ignored", { error: "unsupported_event" });
    return jsonResponse({ ok: true, ignored: true });
  }

  let payment: MercadoPagoPayment;
  try {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });
    if (!response.ok) {
      const errorBody = await response.text();
      await finishEvent("failed", { error: `mercadopago_${response.status}:${errorBody.slice(0, 500)}` });
      return jsonResponse({ error: "payment_lookup_failed" }, response.status >= 500 ? 500 : 502);
    }
    payment = await response.json();
  } catch (error) {
    await finishEvent("failed", { error: error instanceof Error ? error.message : "payment_lookup_failed" });
    return jsonResponse({ error: "payment_lookup_failed" }, 500);
  }

  if (payment.payment_method_id !== "pix") {
    await finishEvent("failed", { error: "non_pix_payment_not_supported" });
    return jsonResponse({ error: "payment_method_unavailable" }, 422);
  }

  const paymentId = String(payment.id);
  const metadataTransactionId = typeof payment.metadata?.cash_engine_transaction_id === "string" ? payment.metadata.cash_engine_transaction_id : null;
  const externalReference = payment.external_reference || null;
  const selectFields = "id,pedido_id,empresa_id,valor_bruto,id_transacao_gateway,payload_provedor,provedor_pagamento,metodo_pagamento";
  let transaction: LocalTransaction | null = null;

  const byGateway = await supabase.from("transacoes").select(selectFields).eq("provedor_pagamento", "mercadopago").eq("id_transacao_gateway", paymentId).maybeSingle();
  if (byGateway.error) {
    await finishEvent("failed", { error: byGateway.error.message });
    return jsonResponse({ error: "transaction_lookup_failed" }, 500);
  }
  transaction = byGateway.data as LocalTransaction | null;

  if (!transaction && metadataTransactionId) {
    const result = await supabase.from("transacoes").select(selectFields).eq("id", metadataTransactionId).maybeSingle();
    if (result.error) {
      await finishEvent("failed", { error: result.error.message });
      return jsonResponse({ error: "transaction_lookup_failed" }, 500);
    }
    transaction = result.data as LocalTransaction | null;
  }
  if (!transaction && externalReference && /^[0-9a-f-]{36}$/i.test(externalReference)) {
    const result = await supabase.from("transacoes").select(selectFields).eq("id", externalReference).maybeSingle();
    if (result.error) {
      await finishEvent("failed", { error: result.error.message });
      return jsonResponse({ error: "transaction_lookup_failed" }, 500);
    }
    transaction = result.data as LocalTransaction | null;
  }
  if (!transaction) {
    await finishEvent("ignored", { error: "local_transaction_not_found" });
    return jsonResponse({ ok: true, ignored: true, reason: "local_transaction_not_found" });
  }

  const validationErrors: string[] = [];
  if (transaction.provedor_pagamento !== "mercadopago") validationErrors.push("provider_mismatch");
  if (transaction.metodo_pagamento !== "pix") validationErrors.push("method_mismatch");
  if (transaction.id_transacao_gateway && transaction.id_transacao_gateway !== paymentId) validationErrors.push("payment_id_mismatch");
  if (metadataTransactionId && metadataTransactionId !== transaction.id) validationErrors.push("metadata_reference_mismatch");
  if (externalReference && externalReference !== transaction.id) validationErrors.push("external_reference_mismatch");
  if (!metadataTransactionId && !externalReference) validationErrors.push("missing_local_reference");
  const paymentAmount = numberOrUndefined(payment.transaction_amount);
  if (paymentAmount === undefined || Math.abs(paymentAmount - Number(transaction.valor_bruto)) > 0.01) validationErrors.push("amount_mismatch");
  const expectedCollector = collectorFromPayload(transaction.payload_provedor);
  const receivedCollector = payment.collector_id == null ? null : String(payment.collector_id);
  if (expectedCollector && receivedCollector !== expectedCollector) validationErrors.push("collector_mismatch");

  if (validationErrors.length) {
    const reason = `payment_validation_failed:${validationErrors.join(",")}`;
    await finishEvent("failed", { transaction_id: transaction.id, error: reason });
    console.error(reason, { transaction_id: transaction.id, payment_id: paymentId });
    return jsonResponse({ error: "payment_validation_failed" }, 422);
  }

  const processingFee = Array.isArray(payment.fee_details)
    ? payment.fee_details.reduce((sum, fee) => sum + (numberOrUndefined(fee.amount) ?? 0), 0)
    : undefined;
  const mappedStatus = mapStatus(payment.status);
  const refundedAmount = numberOrUndefined(payment.transaction_amount_refunded);
  const updatePayload: Record<string, unknown> = {
    provedor_pagamento: "mercadopago",
    id_transacao_gateway: paymentId,
    status: mappedStatus,
    status_detalhe_provedor: payment.status_detail ?? null,
    metodo_pagamento: "pix",
    payload_provedor: payment,
    updated_at: new Date().toISOString(),
  };
  if (numberOrUndefined(payment.transaction_details?.net_received_amount) !== undefined) updatePayload.valor_liquido = payment.transaction_details?.net_received_amount;
  if (processingFee !== undefined) updatePayload.valor_taxa_processamento = processingFee;
  if (typeof payment.installments === "number") updatePayload.parcelas = payment.installments;
  if (payment.date_approved) updatePayload.data_pagamento = payment.date_approved;
  if (refundedAmount !== undefined && refundedAmount > 0) updatePayload.data_estorno = payment.date_last_updated ?? new Date().toISOString();

  const transactionUpdate = await supabase.from("transacoes").update(updatePayload).eq("id", transaction.id);
  if (transactionUpdate.error) {
    await finishEvent("failed", { transaction_id: transaction.id, error: transactionUpdate.error.message });
    return jsonResponse({ error: "transaction_update_failed" }, 500);
  }

  if (transaction.pedido_id) {
    if (["aprovada", "capturada", "paga", "disponivel"].includes(mappedStatus)) {
      const orderUpdate = await supabase.from("pedidos").update({ status: "pago", confirmado_em: payment.date_approved ?? new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", transaction.pedido_id).neq("status", "pago");
      if (orderUpdate.error) {
        await finishEvent("failed", { transaction_id: transaction.id, error: `order_update:${orderUpdate.error.message}` });
        return jsonResponse({ error: "order_update_failed" }, 500);
      }
    } else if (["rejected", "cancelled"].includes(payment.status ?? "")) {
      await supabase.from("pedidos").update({ status: "cancelado", updated_at: new Date().toISOString() }).eq("id", transaction.pedido_id).neq("status", "pago");
    }
  }

  await finishEvent("processed", { transaction_id: transaction.id });
  return jsonResponse({ ok: true, transaction_id: transaction.id, payment_id: paymentId, status: mappedStatus });
});
