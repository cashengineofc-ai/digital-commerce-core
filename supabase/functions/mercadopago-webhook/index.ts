import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type MercadoPagoNotification = {
  id?: string | number;
  type?: string;
  action?: string;
  data?: { id?: string | number };
};

type MercadoPagoPayment = {
  id: number;
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
  card?: {
    last_four_digits?: string | null;
  } | null;
  transaction_details?: {
    net_received_amount?: number | null;
  } | null;
  fee_details?: Array<{
    amount?: number | null;
    type?: string | null;
  }> | null;
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
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function mapStatus(status?: string) {
  switch (status) {
    case "approved":
      return "aprovada";
    case "authorized":
      return "autorizada";
    case "in_process":
      return "processando";
    case "in_mediation":
      return "em_disputa";
    case "rejected":
      return "rejeitada";
    case "cancelled":
      return "cancelada";
    case "refunded":
      return "reembolsada";
    case "charged_back":
      return "chargeback";
    case "pending":
    default:
      return "pendente";
  }
}

function mapPaymentMethod(payment: MercadoPagoPayment) {
  if (payment.payment_method_id === "pix") return "pix";

  switch (payment.payment_type_id) {
    case "credit_card":
      return "cartao_credito";
    case "debit_card":
      return "cartao_debito";
    case "ticket":
      return "boleto";
    case "bank_transfer":
      return payment.payment_method_id === "pix" ? "pix" : "transferencia";
    case "account_money":
      return "mercadopago";
    default:
      return "outro";
  }
}

function numberOrUndefined(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
  const webhookSecret = Deno.env.get("MERCADO_PAGO_WEBHOOK_SECRET");

  if (!supabaseUrl || !serviceRoleKey || !accessToken || !webhookSecret) {
    console.error("Mercado Pago webhook is missing required secrets");
    return jsonResponse({ error: "webhook_not_configured" }, 503);
  }

  let notification: MercadoPagoNotification;
  try {
    notification = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const url = new URL(request.url);
  const requestId = request.headers.get("x-request-id");
  const signatureHeader = request.headers.get("x-signature");
  const { ts, v1 } = parseSignature(signatureHeader);

  const rawQueryDataId = url.searchParams.get("data.id") ?? url.searchParams.get("data_id");
  const signatureDataId = rawQueryDataId ? rawQueryDataId.toLowerCase() : null;
  const bodyDataId = notification.data?.id != null ? String(notification.data.id) : null;
  const dataId = rawQueryDataId ?? bodyDataId;
  const manifest = buildManifest(signatureDataId, requestId, ts);

  if (!v1 || !ts || !manifest) {
    return jsonResponse({ error: "missing_signature_data" }, 401);
  }

  const expectedSignature = await hmacSha256Hex(webhookSecret, manifest);
  if (!constantTimeEqual(expectedSignature, v1.toLowerCase())) {
    return jsonResponse({ error: "invalid_signature" }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const eventType = notification.type ?? notification.action ?? "unknown";
  const externalEventId =
    requestId ??
    (notification.id != null ? String(notification.id) : null) ??
    `${eventType}:${dataId ?? "unknown"}:${ts}`;

  const { data: existingEvent, error: existingEventError } = await supabase
    .from("webhook_events")
    .select("id,status,transaction_id,attempts")
    .eq("provider", "mercadopago")
    .eq("external_event_id", externalEventId)
    .maybeSingle();

  if (existingEventError) {
    console.error("Failed reading webhook event", existingEventError);
    return jsonResponse({ error: "webhook_event_lookup_failed" }, 500);
  }

  if (existingEvent?.status === "processed" || existingEvent?.status === "ignored") {
    return jsonResponse({ ok: true, duplicate: true });
  }

  let eventId = existingEvent?.id as string | undefined;
  const attempts = Number(existingEvent?.attempts ?? 0) + 1;

  if (eventId) {
    const { error } = await supabase
      .from("webhook_events")
      .update({
        status: "processing",
        attempts,
        payload: notification,
        error: null,
      })
      .eq("id", eventId);

    if (error) {
      console.error("Failed marking webhook as processing", error);
      return jsonResponse({ error: "webhook_event_update_failed" }, 500);
    }
  } else {
    const { data, error } = await supabase
      .from("webhook_events")
      .insert({
        provider: "mercadopago",
        external_event_id: externalEventId,
        event_type: eventType,
        payload: notification,
        status: "processing",
        attempts,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        return jsonResponse({ ok: true, duplicate: true });
      }
      console.error("Failed inserting webhook event", error);
      return jsonResponse({ error: "webhook_event_insert_failed" }, 500);
    }

    eventId = data.id;
  }

  const finishEvent = async (
    status: "processed" | "failed" | "ignored",
    values: { transaction_id?: string | null; error?: string | null } = {},
  ) => {
    if (!eventId) return;
    const { error } = await supabase
      .from("webhook_events")
      .update({
        status,
        processed_at: status === "processed" || status === "ignored" ? new Date().toISOString() : null,
        transaction_id: values.transaction_id ?? null,
        error: values.error ?? null,
      })
      .eq("id", eventId);

    if (error) console.error("Failed finalizing webhook event", error);
  };

  const isPaymentNotification =
    notification.type === "payment" || notification.action?.startsWith("payment.");

  if (!isPaymentNotification || !dataId) {
    await finishEvent("ignored", { error: "unsupported_event" });
    return jsonResponse({ ok: true, ignored: true });
  }

  let payment: MercadoPagoPayment;
  try {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

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

  const paymentId = String(payment.id);
  const metadataTransactionId =
    typeof payment.metadata?.cash_engine_transaction_id === "string"
      ? payment.metadata.cash_engine_transaction_id
      : null;
  const externalReference = payment.external_reference || null;

  let transaction: { id: string } | null = null;

  const byGateway = await supabase
    .from("transacoes")
    .select("id")
    .eq("provedor_pagamento", "mercadopago")
    .eq("id_transacao_gateway", paymentId)
    .maybeSingle();

  if (byGateway.error) {
    await finishEvent("failed", { error: byGateway.error.message });
    return jsonResponse({ error: "transaction_lookup_failed" }, 500);
  }
  transaction = byGateway.data;

  if (!transaction && metadataTransactionId) {
    const byMetadata = await supabase
      .from("transacoes")
      .select("id")
      .eq("id", metadataTransactionId)
      .maybeSingle();

    if (byMetadata.error) {
      await finishEvent("failed", { error: byMetadata.error.message });
      return jsonResponse({ error: "transaction_lookup_failed" }, 500);
    }
    transaction = byMetadata.data;
  }

  if (!transaction && externalReference) {
    const byReference = await supabase
      .from("transacoes")
      .select("id")
      .or(`id.eq.${externalReference},pedido_numero.eq.${externalReference},codigo_externo.eq.${externalReference}`)
      .limit(1)
      .maybeSingle();

    if (byReference.error) {
      await finishEvent("failed", { error: byReference.error.message });
      return jsonResponse({ error: "transaction_lookup_failed" }, 500);
    }
    transaction = byReference.data;
  }

  if (!transaction) {
    await finishEvent("ignored", { error: "local_transaction_not_found" });
    return jsonResponse({ ok: true, ignored: true, reason: "local_transaction_not_found" });
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
    metodo_pagamento: mapPaymentMethod(payment),
    payload_provedor: payment,
    updated_at: new Date().toISOString(),
  };

  if (numberOrUndefined(payment.transaction_amount) !== undefined) {
    updatePayload.valor_bruto = payment.transaction_amount;
  }
  if (numberOrUndefined(payment.transaction_details?.net_received_amount) !== undefined) {
    updatePayload.valor_liquido = payment.transaction_details?.net_received_amount;
  }
  if (processingFee !== undefined) {
    updatePayload.valor_taxa_processamento = processingFee;
  }
  if (typeof payment.installments === "number") {
    updatePayload.parcelas = payment.installments;
  }
  if (payment.date_approved) {
    updatePayload.data_pagamento = payment.date_approved;
  }
  if (payment.card?.last_four_digits) {
    updatePayload.cartao_final = payment.card.last_four_digits;
  }
  if (refundedAmount !== undefined && refundedAmount > 0) {
    updatePayload.data_estorno = payment.date_last_updated ?? new Date().toISOString();
  }

  const { error: transactionUpdateError } = await supabase
    .from("transacoes")
    .update(updatePayload)
    .eq("id", transaction.id);

  if (transactionUpdateError) {
    await finishEvent("failed", {
      transaction_id: transaction.id,
      error: transactionUpdateError.message,
    });
    return jsonResponse({ error: "transaction_update_failed" }, 500);
  }

  await finishEvent("processed", { transaction_id: transaction.id });

  return jsonResponse({
    ok: true,
    transaction_id: transaction.id,
    payment_id: paymentId,
    status: mappedStatus,
  });
});
