import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-idempotency-key",
  "access-control-allow-methods": "POST, OPTIONS",
};

const jsonHeaders = {
  ...corsHeaders,
  "content-type": "application/json; charset=utf-8",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function digits(value: unknown) {
  return typeof value === "string" ? value.replace(/\D/g, "") : "";
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "Cliente",
    lastName: parts.slice(1).join(" ") || "Cash Engine",
  };
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

function mapPaymentMethod(paymentMethodId?: string, paymentTypeId?: string) {
  if (paymentMethodId === "pix") return "pix";
  switch (paymentTypeId) {
    case "credit_card":
      return "cartao_credito";
    case "debit_card":
      return "cartao_debito";
    case "ticket":
      return "boleto";
    case "bank_transfer":
      return paymentMethodId === "pix" ? "pix" : "transferencia";
    case "account_money":
      return "mercadopago";
    default:
      return "outro";
  }
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function activePromotionPrice(product: Record<string, any>) {
  const normal = Number(product.preco ?? 0);
  const promo = product.preco_promocional == null ? null : Number(product.preco_promocional);
  if (promo == null || !Number.isFinite(promo) || promo < 0) return normal;

  const now = Date.now();
  const starts = product.promocao_inicio ? new Date(product.promocao_inicio).getTime() : null;
  const ends = product.promocao_fim ? new Date(product.promocao_fim).getTime() : null;
  if (starts && now < starts) return normal;
  if (ends && now > ends) return normal;
  return promo;
}

function resolveCheckoutProductId(checkout: Record<string, any>) {
  if (checkout.produto_id) return checkout.produto_id as string;
  const config = Array.isArray(checkout.produtos_config) ? checkout.produtos_config : [];
  const first = config[0];
  if (!first || typeof first !== "object") return null;
  return (first.produto_id ?? first.product_id ?? first.id ?? null) as string | null;
}

function resolveAmount(
  checkout: Record<string, any> | null,
  link: Record<string, any> | null,
  product: Record<string, any>,
  requestedAmount: unknown,
) {
  if (link) {
    const fixed = Number(link.valor ?? 0);
    if (!link.permite_editar_valor) return fixed;

    const requested = Number(requestedAmount);
    return Number.isFinite(requested) && requested > 0 ? requested : fixed;
  }

  const productPrice = activePromotionPrice(product);
  if (!checkout?.permitir_valor_personalizado) return productPrice;

  const requested = Number(requestedAmount);
  const fallback = Number(checkout.valor_sugerido ?? productPrice);
  let amount = Number.isFinite(requested) && requested > 0 ? requested : fallback;
  const min = checkout.valor_minimo == null ? null : Number(checkout.valor_minimo);
  const max = checkout.valor_maximo == null ? null : Number(checkout.valor_maximo);

  if (min != null && Number.isFinite(min)) amount = Math.max(amount, min);
  if (max != null && Number.isFinite(max)) amount = Math.min(amount, max);
  return amount;
}

async function loadSource(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, any>,
) {
  let checkout: Record<string, any> | null = null;
  let link: Record<string, any> | null = null;

  if (typeof body.payment_link_code === "string" && body.payment_link_code.trim()) {
    const { data, error } = await supabase
      .from("links_pagamento")
      .select("id,empresa_id,checkout_id,produto_id,titulo,descricao,codigo_unico,valor,moeda,status,max_usos,contador_usos,permite_editar_valor,data_expiracao,url_redirecionamento_sucesso,metadata,deleted_at")
      .eq("codigo_unico", body.payment_link_code.trim())
      .maybeSingle();

    if (error) throw error;
    if (!data || data.deleted_at || data.status !== "ativo") {
      throw new Error("payment_link_unavailable");
    }
    if (data.data_expiracao && new Date(data.data_expiracao).getTime() <= Date.now()) {
      throw new Error("payment_link_expired");
    }
    if (data.max_usos != null && Number(data.contador_usos ?? 0) >= Number(data.max_usos)) {
      throw new Error("payment_link_limit_reached");
    }
    link = data;
  } else if (typeof body.checkout_slug === "string" && body.checkout_slug.trim()) {
    const { data, error } = await supabase
      .from("checkouts")
      .select("id,empresa_id,template_id,produto_id,nome,slug,descricao,imagem_url,banner_url,status,produtos_config,valor_minimo,valor_maximo,valor_sugerido,permitir_valor_personalizado,prazo_expiracao,unidade_expiracao,url_sucesso,url_falha,url_cancelamento,deleted_at")
      .eq("slug", body.checkout_slug.trim())
      .eq("status", "publicado")
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("checkout_unavailable");
    checkout = data;
  } else {
    throw new Error("checkout_source_required");
  }

  if (!checkout && link?.checkout_id) {
    const { data, error } = await supabase
      .from("checkouts")
      .select("id,empresa_id,template_id,produto_id,nome,slug,descricao,imagem_url,banner_url,status,produtos_config,valor_minimo,valor_maximo,valor_sugerido,permitir_valor_personalizado,prazo_expiracao,unidade_expiracao,url_sucesso,url_falha,url_cancelamento,deleted_at")
      .eq("id", link.checkout_id)
      .maybeSingle();
    if (error) throw error;
    checkout = data;
  }

  const productId = link?.produto_id ?? (checkout ? resolveCheckoutProductId(checkout) : null);
  if (!productId) throw new Error("checkout_product_missing");

  const { data: product, error: productError } = await supabase
    .from("produtos")
    .select("id,empresa_id,nome,slug,descricao_curta,tipo,preco,preco_promocional,promocao_inicio,promocao_fim,moeda,imagem_principal_url,status,permite_parcelamento,max_parcelas,parcela_minima,deleted_at")
    .eq("id", productId)
    .eq("status", "publicado")
    .is("deleted_at", null)
    .maybeSingle();

  if (productError) throw productError;
  if (!product) throw new Error("product_unavailable");

  const empresaId = link?.empresa_id ?? checkout?.empresa_id;
  if (!empresaId || product.empresa_id !== empresaId) throw new Error("checkout_product_mismatch");

  let template: Record<string, any> | null = null;
  if (checkout?.template_id) {
    const { data } = await supabase
      .from("templates_checkout")
      .select("id,logo_url,banner_url,titulo_checkout,subtitulo_checkout,mensagem_sucesso,cor_primaria,cor_secundaria,cor_fundo,cor_texto,mostrar_pagamento_pix,mostrar_pagamento_boleto,mostrar_pagamento_cartao,pedir_cpf,pedir_telefone,pedir_endereco,parcelamento_maximo,ativo,deleted_at")
      .eq("id", checkout.template_id)
      .maybeSingle();
    if (data?.ativo && !data.deleted_at) template = data;
  }

  return { checkout, link, product, template, empresaId };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "checkout_not_configured" }, 503);
  }

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let source: Awaited<ReturnType<typeof loadSource>>;
  try {
    source = await loadSource(supabase, body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "checkout_load_failed";
    const publicErrors = new Set([
      "payment_link_unavailable",
      "payment_link_expired",
      "payment_link_limit_reached",
      "checkout_unavailable",
      "checkout_source_required",
      "checkout_product_missing",
      "product_unavailable",
      "checkout_product_mismatch",
    ]);
    console.error("Checkout load failed", error);
    return jsonResponse({ error: publicErrors.has(message) ? message : "checkout_load_failed" }, publicErrors.has(message) ? 404 : 500);
  }

  const { checkout, link, product, template, empresaId } = source;
  const amount = Number(resolveAmount(checkout, link, product, body.amount).toFixed(2));
  if (!Number.isFinite(amount) || amount <= 0) {
    return jsonResponse({ error: "invalid_checkout_amount" }, 422);
  }

  if (body.action === "load") {
    return jsonResponse({
      checkout: {
        id: checkout?.id ?? null,
        slug: checkout?.slug ?? null,
        name: checkout?.nome ?? link?.titulo ?? product.nome,
        description: checkout?.descricao ?? link?.descricao ?? product.descricao_curta ?? null,
        image_url: checkout?.imagem_url ?? product.imagem_principal_url ?? null,
        banner_url: checkout?.banner_url ?? template?.banner_url ?? null,
        success_url: link?.url_redirecionamento_sucesso ?? checkout?.url_sucesso ?? null,
        allow_custom_amount: Boolean(link?.permite_editar_valor ?? checkout?.permitir_valor_personalizado),
        min_amount: checkout?.valor_minimo ?? null,
        max_amount: checkout?.valor_maximo ?? null,
      },
      product: {
        id: product.id,
        name: product.nome,
        type: product.tipo,
        image_url: product.imagem_principal_url ?? null,
        amount,
        currency: product.moeda ?? link?.moeda ?? "BRL",
        allows_installments: Boolean(product.permite_parcelamento),
        max_installments: Number(product.max_parcelas ?? template?.parcelamento_maximo ?? 1),
      },
      payment_methods: {
        pix: template?.mostrar_pagamento_pix ?? true,
        card: template?.mostrar_pagamento_cartao ?? true,
        boleto: template?.mostrar_pagamento_boleto ?? false,
      },
      fields: {
        cpf: template?.pedir_cpf ?? true,
        phone: template?.pedir_telefone ?? true,
        address: template?.pedir_endereco ?? false,
      },
      theme: {
        primary: template?.cor_primaria ?? "#2563eb",
        secondary: template?.cor_secundaria ?? "#0f172a",
        background: template?.cor_fundo ?? "#050505",
        text: template?.cor_texto ?? "#ffffff",
        logo_url: template?.logo_url ?? null,
        title: template?.titulo_checkout ?? "Finalizar compra",
        subtitle: template?.subtitulo_checkout ?? null,
      },
    });
  }

  if (body.action !== "pay") {
    return jsonResponse({ error: "invalid_action" }, 400);
  }
  if (!accessToken) {
    return jsonResponse({ error: "mercadopago_not_configured" }, 503);
  }

  const payer = body.payer && typeof body.payer === "object" ? body.payer : {};
  const fullName = typeof payer.name === "string" ? payer.name.trim() : "";
  const email = typeof payer.email === "string" ? payer.email.trim().toLowerCase() : "";
  const cpf = digits(payer.cpf);
  const phone = digits(payer.phone);

  if (!fullName || !email || !email.includes("@")) {
    return jsonResponse({ error: "payer_name_and_email_required" }, 422);
  }
  if ((template?.pedir_cpf ?? true) && cpf.length !== 11) {
    return jsonResponse({ error: "valid_cpf_required" }, 422);
  }

  let customer: { id: string } | null = null;
  const byEmail = await supabase
    .from("clientes")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("email", email)
    .is("deleted_at", null)
    .maybeSingle();
  if (byEmail.error) return jsonResponse({ error: "customer_lookup_failed" }, 500);
  customer = byEmail.data;

  if (!customer && cpf) {
    const byCpf = await supabase
      .from("clientes")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("cpf", cpf)
      .is("deleted_at", null)
      .maybeSingle();
    if (byCpf.error) return jsonResponse({ error: "customer_lookup_failed" }, 500);
    customer = byCpf.data;
  }

  if (customer) {
    const { error } = await supabase
      .from("clientes")
      .update({
        nome_completo: fullName,
        email,
        cpf: cpf || null,
        celular: phone || null,
        origem_captacao: link ? "link_pagamento" : "checkout",
        status: "ativo",
        updated_at: new Date().toISOString(),
      })
      .eq("id", customer.id);
    if (error) return jsonResponse({ error: "customer_update_failed" }, 500);
  } else {
    const { data, error } = await supabase
      .from("clientes")
      .insert({
        empresa_id: empresaId,
        nome_completo: fullName,
        email,
        cpf: cpf || null,
        celular: phone || null,
        origem_captacao: link ? "link_pagamento" : "checkout",
        status: "ativo",
      })
      .select("id")
      .single();
    if (error) {
      console.error("Customer insert failed", error);
      return jsonResponse({ error: "customer_create_failed" }, 500);
    }
    customer = data;
  }

  const idempotencyKey = isUuid(body.idempotency_key)
    ? body.idempotency_key
    : isUuid(request.headers.get("x-idempotency-key"))
      ? request.headers.get("x-idempotency-key")!
      : crypto.randomUUID();

  const existingTransaction = await supabase
    .from("transacoes")
    .select("id,id_transacao_gateway,status,status_detalhe_provedor,payload_provedor")
    .eq("empresa_id", empresaId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existingTransaction.error) {
    return jsonResponse({ error: "idempotency_lookup_failed" }, 500);
  }

  if (existingTransaction.data?.id_transacao_gateway) {
    const payload = existingTransaction.data.payload_provedor as Record<string, any> | null;
    return jsonResponse({
      ok: true,
      duplicate: true,
      transaction_id: existingTransaction.data.id,
      payment_id: existingTransaction.data.id_transacao_gateway,
      status: existingTransaction.data.status,
      status_detail: existingTransaction.data.status_detalhe_provedor,
      pix: payload?.point_of_interaction?.transaction_data
        ? {
            qr_code: payload.point_of_interaction.transaction_data.qr_code ?? null,
            qr_code_base64: payload.point_of_interaction.transaction_data.qr_code_base64 ?? null,
          }
        : null,
    });
  }

  let transactionId = existingTransaction.data?.id as string | undefined;
  if (!transactionId) {
    const orderNumber = `CE-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const { data, error } = await supabase
      .from("transacoes")
      .insert({
        empresa_id: empresaId,
        cliente_id: customer.id,
        produto_id: product.id,
        checkout_id: checkout?.id ?? null,
        link_pagamento_id: link?.id ?? null,
        pedido_numero: orderNumber,
        codigo_externo: link?.codigo_unico ?? checkout?.slug ?? null,
        tipo: link ? "link_pagamento" : "venda",
        metodo_pagamento: "outro",
        status: "pendente",
        valor_bruto: amount,
        valor_liquido: amount,
        moeda: product.moeda ?? link?.moeda ?? "BRL",
        idempotency_key: idempotencyKey,
        provedor_pagamento: "mercadopago",
        origem_dispositivo: "web",
        ip_cliente: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 45) ?? null,
        metadata: {
          checkout_source: link ? "payment_link" : "checkout",
          public_checkout: true,
        },
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        const raced = await supabase
          .from("transacoes")
          .select("id")
          .eq("empresa_id", empresaId)
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();
        if (!raced.data) return jsonResponse({ error: "transaction_create_failed" }, 500);
        transactionId = raced.data.id;
      } else {
        console.error("Transaction insert failed", error);
        return jsonResponse({ error: "transaction_create_failed" }, 500);
      }
    } else {
      transactionId = data.id;
    }
  }

  const paymentMethodId = typeof body.payment_method_id === "string" ? body.payment_method_id : "pix";
  const { firstName, lastName } = splitName(fullName);
  const paymentBody: Record<string, any> = {
    transaction_amount: amount,
    description: product.nome,
    payment_method_id: paymentMethodId,
    payer: {
      email,
      first_name: firstName,
      last_name: lastName,
      ...(cpf
        ? {
            identification: {
              type: "CPF",
              number: cpf,
            },
          }
        : {}),
    },
    external_reference: transactionId,
    metadata: {
      cash_engine_transaction_id: transactionId,
      empresa_id: empresaId,
      produto_id: product.id,
      checkout_id: checkout?.id ?? null,
      link_pagamento_id: link?.id ?? null,
    },
    notification_url: `${supabaseUrl}/functions/v1/mercadopago-webhook`,
  };

  if (typeof body.token === "string" && body.token) paymentBody.token = body.token;
  if (Number.isInteger(Number(body.installments)) && Number(body.installments) > 0) {
    paymentBody.installments = Number(body.installments);
  } else if (paymentMethodId !== "pix") {
    paymentBody.installments = 1;
  }
  if (body.issuer_id != null && String(body.issuer_id).trim()) paymentBody.issuer_id = String(body.issuer_id);

  let paymentResponse: Response;
  let payment: Record<string, any>;
  try {
    paymentResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(paymentBody),
    });
    payment = await paymentResponse.json();
  } catch (error) {
    await supabase
      .from("transacoes")
      .update({ status: "falhou", status_detalhe_provedor: "gateway_unreachable" })
      .eq("id", transactionId);
    console.error("Mercado Pago request failed", error);
    return jsonResponse({ error: "mercadopago_unreachable" }, 502);
  }

  if (!paymentResponse.ok || !payment.id) {
    await supabase
      .from("transacoes")
      .update({
        status: "falhou",
        status_detalhe_provedor: payment?.message ?? payment?.error ?? `http_${paymentResponse.status}`,
        payload_provedor: payment ?? {},
      })
      .eq("id", transactionId);

    return jsonResponse(
      {
        error: "payment_rejected_by_gateway",
        status: payment?.status ?? null,
        status_detail: payment?.status_detail ?? payment?.message ?? null,
      },
      422,
    );
  }

  const fees = Array.isArray(payment.fee_details)
    ? payment.fee_details.reduce((sum: number, fee: Record<string, any>) => sum + Number(fee.amount ?? 0), 0)
    : 0;
  const netAmount = Number(payment.transaction_details?.net_received_amount ?? amount);
  const pixData = payment.point_of_interaction?.transaction_data ?? null;

  const { error: updateError } = await supabase
    .from("transacoes")
    .update({
      id_transacao_gateway: String(payment.id),
      provedor_pagamento: "mercadopago",
      status: mapStatus(payment.status),
      status_detalhe_provedor: payment.status_detail ?? null,
      metodo_pagamento: mapPaymentMethod(payment.payment_method_id, payment.payment_type_id),
      valor_bruto: Number(payment.transaction_amount ?? amount),
      valor_liquido: Number.isFinite(netAmount) ? netAmount : amount,
      valor_taxa_processamento: Number.isFinite(fees) ? fees : 0,
      parcelas: Number(payment.installments ?? 1),
      data_pagamento: payment.date_approved ?? null,
      pix_qrcode: pixData?.qr_code_base64 ?? null,
      pix_copia_cola: pixData?.qr_code ?? null,
      pix_expiracao: payment.date_of_expiration ?? null,
      cartao_final: payment.card?.last_four_digits ?? null,
      cartao_bandeira: payment.payment_method_id ?? null,
      payload_provedor: payment,
      updated_at: new Date().toISOString(),
    })
    .eq("id", transactionId);

  if (updateError) {
    console.error("Failed persisting Mercado Pago response", updateError);
    return jsonResponse({ error: "payment_persist_failed", transaction_id: transactionId }, 500);
  }

  return jsonResponse({
    ok: true,
    transaction_id: transactionId,
    payment_id: String(payment.id),
    status: mapStatus(payment.status),
    status_detail: payment.status_detail ?? null,
    pix: pixData
      ? {
          qr_code: pixData.qr_code ?? null,
          qr_code_base64: pixData.qr_code_base64 ?? null,
          ticket_url: pixData.ticket_url ?? null,
        }
      : null,
    success_url: link?.url_redirecionamento_sucesso ?? checkout?.url_sucesso ?? null,
  });
});
