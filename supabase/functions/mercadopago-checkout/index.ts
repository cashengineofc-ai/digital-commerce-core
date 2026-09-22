import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as QRCode from "https://esm.sh/qrcode@1.5.4";
import { buildStaticPixPayload, normalizePixTxid } from "../_shared/pix-brcode.ts";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers":
    "authorization, x-client-info, apikey, content-type, x-idempotency-key",
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

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
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

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "Cliente",
    lastName: parts.slice(1).join(" ") || "Cash Engine",
  };
}

function validProduct(product: Record<string, any> | null) {
  if (!product || product.deleted_at || product.status !== "publicado") return false;
  if (!product.gerencia_estoque) return true;
  return Number(product.estoque ?? 0) - Number(product.estoque_reservado ?? 0) > 0;
}

function valueText(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function rpcCode(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const known = [
    "checkout_order_invalid_input",
    "payment_provider_invalid",
    "checkout_unavailable",
    "offer_unavailable",
    "payment_link_unavailable",
    "payment_link_expired",
    "payment_link_limit_reached",
    "product_unavailable",
    "product_out_of_stock",
    "customer_not_found",
    "invalid_checkout_amount",
    "amount_below_minimum",
    "amount_above_maximum",
    "duplicate_order_bump",
    "invalid_order_bumps",
    "order_bump_combination_not_allowed",
  ];
  return known.find((code) => message.includes(code)) ?? "checkout_order_create_failed";
}

async function getPixConfig(supabase: any, hasProvider: boolean) {
  const { data, error } = await supabase
    .from("admin_global_config")
    .select("chave,valor")
    .in("chave", [
      "pix_modo_recebimento",
      "pix_chave",
      "pix_recebedor_nome",
      "pix_recebedor_cidade",
    ]);
  if (error) throw error;

  const map = new Map<string, string>(
    (data ?? []).map((row: any): [string, string] => [
      String(row.chave),
      valueText(row.valor),
    ]),
  );
  const configuredMode = map.get("pix_modo_recebimento") || "desativado";

  if (configuredMode === "chave") {
    const key = map.get("pix_chave") || "";
    const receiverName = map.get("pix_recebedor_nome") || "";
    const receiverCity = map.get("pix_recebedor_cidade") || "";
    return key && receiverName && receiverCity
      ? { mode: "chave" as const, key, receiverName, receiverCity, available: true, confirmation: "manual" as const }
      : { mode: "chave" as const, key: "", receiverName: "", receiverCity: "", available: false, confirmation: "manual" as const };
  }

  if (configuredMode === "provedor") {
    return {
      mode: "provedor" as const,
      key: "",
      receiverName: "",
      receiverCity: "",
      available: hasProvider,
      confirmation: "automatic" as const,
    };
  }

  return {
    mode: "desativado" as const,
    key: "",
    receiverName: "",
    receiverCity: "",
    available: false,
    confirmation: null,
  };
}

type Source = {
  checkout: Record<string, any>;
  version: Record<string, any>;
  offer: Record<string, any>;
  product: Record<string, any>;
  link: Record<string, any> | null;
  empresaId: string;
};

type PublishedBump = {
  id: string;
  product_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  amount: number;
  group: string | null;
  max_group_selection: number | null;
};

async function findCheckoutByPublicValue(supabase: any, value: string) {
  if (isUuid(value)) {
    const byToken = await supabase
      .from("checkouts")
      .select("*")
      .eq("public_token", value)
      .eq("status", "publicado")
      .is("deleted_at", null)
      .maybeSingle();
    if (byToken.error) throw byToken.error;
    if (byToken.data) return byToken.data;
  }

  const bySlug = await supabase
    .from("checkouts")
    .select("*")
    .eq("slug", value)
    .eq("status", "publicado")
    .is("deleted_at", null)
    .limit(2);
  if (bySlug.error) throw bySlug.error;
  if ((bySlug.data ?? []).length !== 1) return null;
  return bySlug.data![0];
}

async function loadSource(supabase: any, body: Record<string, any>): Promise<Source> {
  let link: Record<string, any> | null = null;
  let checkout: Record<string, any> | null = null;
  const paymentLinkValue = typeof body.payment_link_code === "string" ? body.payment_link_code.trim() : "";
  const checkoutValue = typeof body.checkout_slug === "string" ? body.checkout_slug.trim() : "";

  if (paymentLinkValue) {
    const { data, error } = await supabase
      .from("links_pagamento")
      .select("*")
      .or(`public_token.eq.${paymentLinkValue},codigo_unico.eq.${paymentLinkValue}`)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data || data.status !== "ativo") throw new Error("payment_link_unavailable");
    if (data.data_expiracao && new Date(data.data_expiracao).getTime() <= Date.now()) throw new Error("payment_link_expired");
    if (data.max_usos != null && Number(data.contador_usos ?? 0) >= Number(data.max_usos)) throw new Error("payment_link_limit_reached");

    const paymentLink = data as Record<string, any>;
    link = paymentLink;
    if (!paymentLink.checkout_id) throw new Error("checkout_unavailable");
    const result = await supabase
      .from("checkouts")
      .select("*")
      .eq("id", paymentLink.checkout_id)
      .eq("status", "publicado")
      .is("deleted_at", null)
      .maybeSingle();
    if (result.error) throw result.error;
    checkout = result.data;
  } else if (checkoutValue) {
    checkout = await findCheckoutByPublicValue(supabase, checkoutValue);
  } else {
    throw new Error("checkout_source_required");
  }

  if (!checkout || !checkout.publicado_versao_id || !checkout.oferta_id) throw new Error("checkout_unavailable");

  const versionResult = await supabase
    .from("checkout_versions")
    .select("*")
    .eq("id", checkout.publicado_versao_id)
    .eq("estado", "publicado")
    .maybeSingle();
  if (versionResult.error) throw versionResult.error;
  if (!versionResult.data) throw new Error("checkout_unavailable");

  const offerId = link?.oferta_id ?? checkout.oferta_id;
  const offerResult = await supabase
    .from("ofertas")
    .select("*")
    .eq("id", offerId)
    .eq("empresa_id", checkout.empresa_id)
    .eq("status", "ativa")
    .is("deleted_at", null)
    .maybeSingle();
  if (offerResult.error) throw offerResult.error;
  const offer = offerResult.data;
  if (!offer) throw new Error("offer_unavailable");
  if (offer.vigencia_inicio && new Date(offer.vigencia_inicio).getTime() > Date.now()) throw new Error("offer_unavailable");
  if (offer.vigencia_fim && new Date(offer.vigencia_fim).getTime() <= Date.now()) throw new Error("offer_unavailable");

  const productResult = await supabase
    .from("produtos")
    .select("*")
    .eq("id", offer.produto_id)
    .eq("empresa_id", checkout.empresa_id)
    .maybeSingle();
  if (productResult.error) throw productResult.error;
  if (!validProduct(productResult.data)) throw new Error("product_unavailable");
  if (link && (link.checkout_id !== checkout.id || (link.oferta_id && link.oferta_id !== offer.id))) throw new Error("payment_link_mismatch");

  return {
    checkout,
    version: versionResult.data,
    offer,
    product: productResult.data!,
    link,
    empresaId: checkout.empresa_id,
  };
}

async function loadPublishedBumps(supabase: any, source: Source): Promise<PublishedBump[]> {
  const { data: snapshots, error: snapshotError } = await supabase
    .from("checkout_version_order_bumps")
    .select("id,produto_id,titulo_snapshot,descricao_snapshot,imagem_snapshot,preco_publicado_snapshot,grupo_combinacao,max_selecao_grupo,ordem")
    .eq("checkout_version_id", source.version.id)
    .eq("checkout_id", source.checkout.id)
    .eq("empresa_id", source.empresaId)
    .order("ordem", { ascending: true });
  if (snapshotError) throw snapshotError;
  if (!(snapshots ?? []).length) return [];

  const productIds = [...new Set((snapshots ?? []).map((item: any) => item.produto_id))];
  const { data: products, error: productsError } = await supabase
    .from("produtos")
    .select("id,status,deleted_at,gerencia_estoque,estoque,estoque_reservado")
    .in("id", productIds)
    .eq("empresa_id", source.empresaId);
  if (productsError) throw productsError;
  const byId = new Map((products ?? []).map((item: any) => [item.id, item]));

  return (snapshots ?? []).flatMap((snapshot: any) => {
    const product = byId.get(snapshot.produto_id) as Record<string, any> | undefined;
    if (!product || !validProduct(product)) return [];
    return [{
      id: String(snapshot.id),
      product_id: String(snapshot.produto_id),
      name: String(snapshot.titulo_snapshot ?? "Item adicional"),
      description: snapshot.descricao_snapshot ? String(snapshot.descricao_snapshot) : null,
      image_url: snapshot.imagem_snapshot ? String(snapshot.imagem_snapshot) : null,
      amount: Number(snapshot.preco_publicado_snapshot ?? 0),
      group: snapshot.grupo_combinacao ? String(snapshot.grupo_combinacao) : null,
      max_group_selection: snapshot.max_selecao_grupo == null ? null : Number(snapshot.max_selecao_grupo),
    }];
  });
}

function displayBaseAmount(source: Source) {
  const linkValue = Number(source.link?.valor ?? 0);
  if (source.link && linkValue > 0) return linkValue;
  return Number(source.offer.preco ?? 0);
}

async function resolveAffiliate(supabase: any, code: string, source: Source) {
  if (!code) return null;
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("links_afiliados")
    .select("id,empresa_id,afiliado_id,produto_id,checkout_id,link_pagamento_id,status,data_inicio,data_fim,deleted_at")
    .eq("codigo_rastreio", code)
    .eq("status", "ativo")
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  if (data.empresa_id !== source.empresaId) return null;
  if (data.data_inicio && data.data_inicio > now) return null;
  if (data.data_fim && data.data_fim < now) return null;
  if (data.produto_id && data.produto_id !== source.product.id) return null;
  if (data.checkout_id && data.checkout_id !== source.checkout.id) return null;
  if (data.link_pagamento_id && data.link_pagamento_id !== source.link?.id) return null;

  const affiliate = await supabase
    .from("afiliados")
    .select("id,status,profile_id")
    .eq("id", data.afiliado_id)
    .eq("empresa_id", source.empresaId)
    .maybeSingle();
  if (affiliate.error || affiliate.data?.status !== "ativo") return null;

  const authorization = await supabase
    .from("afiliados_produtos")
    .select("ativo,data_inicio,data_fim")
    .eq("afiliado_id", data.afiliado_id)
    .eq("produto_id", source.product.id)
    .eq("empresa_id", source.empresaId)
    .maybeSingle();
  if (authorization.error || !authorization.data?.ativo) return null;
  if (authorization.data.data_inicio && authorization.data.data_inicio > now) return null;
  if (authorization.data.data_fim && authorization.data.data_fim < now) return null;

  return { afiliado_id: data.afiliado_id as string, link_afiliado_id: data.id as string };
}

async function mercadoPagoCollectorId(accessToken: string) {
  const response = await fetch("https://api.mercadopago.com/users/me", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`provider_identity_${response.status}`);
  const body = await response.json();
  if (body?.id == null) throw new Error("provider_identity_missing");
  return String(body.id);
}

async function markFailed(
  supabase: any,
  transactionId: string,
  detail: string,
  payload?: Record<string, unknown>,
) {
  await supabase
    .from("transacoes")
    .update({
      status: "falhou",
      status_detalhe_provedor: detail,
      ...(payload ? { payload_provedor: payload } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", transactionId)
    .in("status", ["pendente", "processando", "autorizada"]);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
  const webhookSecret = Deno.env.get("MERCADO_PAGO_WEBHOOK_SECRET");
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: "checkout_not_configured" }, 503);

  let body: Record<string, any>;
  try { body = await request.json(); } catch { return jsonResponse({ error: "invalid_json" }, 400); }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let source: Source;
  let pixConfig: Awaited<ReturnType<typeof getPixConfig>>;
  let bumps: PublishedBump[];
  try {
    [source, pixConfig] = await Promise.all([
      loadSource(supabase, body),
      getPixConfig(supabase, Boolean(accessToken && webhookSecret)),
    ]);
    bumps = await loadPublishedBumps(supabase, source);
  } catch (error) {
    const code = error instanceof Error ? error.message : "checkout_load_failed";
    const notFound = new Set([
      "checkout_unavailable",
      "payment_link_unavailable",
      "payment_link_expired",
      "payment_link_limit_reached",
      "offer_unavailable",
      "product_unavailable",
      "payment_link_mismatch",
    ]);
    console.error("Checkout load failed", error);
    return jsonResponse({ error: code }, notFound.has(code) ? 404 : 500);
  }

  const config = source.version.config && typeof source.version.config === "object" ? source.version.config : {};
  const buyerFields = config.buyer_fields && typeof config.buyer_fields === "object" ? config.buyer_fields : {};
  const paymentUi = config.payment_ui && typeof config.payment_ui === "object" ? config.payment_ui : {};
  const pixEnabledByCheckout = paymentUi.pix !== false;

  if (body.action === "load") {
    return jsonResponse({
      checkout: {
        id: source.checkout.id,
        slug: source.checkout.public_token,
        name: source.checkout.nome,
        description: source.checkout.descricao ?? source.product.descricao_curta ?? null,
        image_url: source.product.imagem_principal_url ?? null,
        banner_url: config.banners?.desktop_url ?? config.banners?.image_url ?? null,
        success_url: source.link?.url_redirecionamento_sucesso ?? source.checkout.url_sucesso ?? config.confirmation?.redirect_url ?? null,
        allow_custom_amount: Boolean(source.offer.permitir_valor_personalizado || source.link?.permite_editar_valor),
        min_amount: source.offer.valor_minimo ?? null,
        max_amount: source.offer.valor_maximo ?? null,
      },
      product: {
        id: source.product.id,
        name: source.product.nome,
        type: source.product.tipo,
        image_url: source.product.imagem_principal_url ?? null,
        amount: displayBaseAmount(source),
        currency: source.offer.moeda ?? "BRL",
        allows_installments: false,
        max_installments: 1,
      },
      order_bumps: bumps,
      payment_methods: {
        pix: pixEnabledByCheckout && pixConfig.available,
        card: false,
        boleto: false,
        card_status: "em_breve",
        boleto_status: "em_breve",
      },
      pix_mode: pixConfig.mode,
      pix_confirmation: pixConfig.available ? pixConfig.confirmation : null,
      pix_unavailable_reason: pixEnabledByCheckout && !pixConfig.available
        ? pixConfig.mode === "provedor" ? "provider_not_configured" : "pix_not_configured"
        : null,
      fields: {
        cpf: buyerFields.cpf !== false,
        phone: buyerFields.phone !== false,
        address: Boolean(buyerFields.address),
      },
      theme: {
        primary: config.theme?.primary ?? "#2563eb",
        secondary: config.theme?.secondary ?? "#0f172a",
        background: config.theme?.background ?? "#050505",
        text: config.theme?.text ?? "#ffffff",
        logo_url: config.theme?.logo_url ?? null,
        title: config.texts?.title ?? "Finalizar compra",
        subtitle: config.texts?.subtitle ?? null,
        button_text: config.texts?.pay_button ?? "Gerar Pix",
        font: config.theme?.font ?? "Inter",
      },
      banners: config.banners ?? {},
      legal: {
        terms_url: config.legal?.terms_url ?? null,
        privacy_url: config.legal?.privacy_url ?? null,
      },
    });
  }

  if (body.action !== "pay") return jsonResponse({ error: "invalid_action" }, 400);
  if (body.payment_method_id && body.payment_method_id !== "pix") return jsonResponse({ error: "payment_method_unavailable" }, 422);
  if (!pixEnabledByCheckout || !pixConfig.available) return jsonResponse({ error: "pix_not_configured" }, 503);

  const payer = body.payer && typeof body.payer === "object" ? body.payer : {};
  const fullName = typeof payer.name === "string" ? payer.name.trim() : "";
  const email = typeof payer.email === "string" ? payer.email.trim().toLowerCase() : "";
  const cpf = digits(payer.cpf);
  const phone = digits(payer.phone);
  if (!fullName || !email || !email.includes("@")) return jsonResponse({ error: "payer_name_and_email_required" }, 422);
  if (buyerFields.cpf !== false && cpf.length !== 11) return jsonResponse({ error: "valid_cpf_required" }, 422);

  let customer: { id: string } | null = null;
  const byEmail = await supabase
    .from("clientes")
    .select("id")
    .eq("empresa_id", source.empresaId)
    .eq("email", email)
    .is("deleted_at", null)
    .maybeSingle();
  if (byEmail.error) return jsonResponse({ error: "customer_lookup_failed" }, 500);
  customer = byEmail.data;

  if (!customer && cpf) {
    const byCpf = await supabase
      .from("clientes")
      .select("id")
      .eq("empresa_id", source.empresaId)
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
        origem_captacao: source.link ? "link_pagamento" : "checkout",
        status: "ativo",
        updated_at: new Date().toISOString(),
      })
      .eq("id", customer.id);
    if (error) return jsonResponse({ error: "customer_update_failed" }, 500);
  } else {
    const result = await supabase
      .from("clientes")
      .insert({
        empresa_id: source.empresaId,
        nome_completo: fullName,
        email,
        cpf: cpf || null,
        celular: phone || null,
        origem_captacao: source.link ? "link_pagamento" : "checkout",
        status: "ativo",
      })
      .select("id")
      .single();
    if (result.error) return jsonResponse({ error: "customer_create_failed" }, 500);
    customer = result.data;
  }

  const idempotencyKey = isUuid(body.idempotency_key)
    ? body.idempotency_key
    : isUuid(request.headers.get("x-idempotency-key"))
      ? request.headers.get("x-idempotency-key")!
      : crypto.randomUUID();

  const selectedBumpIds = Array.isArray(body.order_bump_ids)
    ? (body.order_bump_ids.filter((id: unknown) => typeof id === "string" && isUuid(id)) as string[])
    : [];
  if (
    Array.isArray(body.order_bump_ids) &&
    (selectedBumpIds.length !== body.order_bump_ids.length || new Set(selectedBumpIds).size !== selectedBumpIds.length)
  ) return jsonResponse({ error: "invalid_order_bump_ids" }, 422);

  const affiliateCode = typeof body.affiliate_code === "string" ? body.affiliate_code.trim() : "";
  const attribution = await resolveAffiliate(supabase, affiliateCode, source);
  const provider = pixConfig.mode === "chave" ? "pix_chave" : "mercadopago";

  const { data: orderRows, error: orderError } = await (supabase as any).rpc(
    "fn_checkout_criar_pedido_pix",
    {
      p_empresa_id: source.empresaId,
      p_cliente_id: customer!.id,
      p_checkout_id: source.checkout.id,
      p_link_pagamento_id: source.link?.id ?? null,
      p_idempotency_key: idempotencyKey,
      p_valor_solicitado:
        source.offer.permitir_valor_personalizado || source.link?.permite_editar_valor
          ? Number(body.amount)
          : null,
      p_order_bump_ids: selectedBumpIds,
      p_afiliado_id: attribution?.afiliado_id ?? null,
      p_link_afiliado_id: attribution?.link_afiliado_id ?? null,
      p_provedor: provider,
    },
  );
  if (orderError) {
    console.error("Atomic checkout order failed", orderError);
    return jsonResponse({ error: rpcCode(orderError) }, 422);
  }

  const created = Array.isArray(orderRows) ? orderRows[0] : orderRows;
  if (!created?.transacao_id || !created?.pedido_id) return jsonResponse({ error: "checkout_order_create_failed" }, 500);

  const { data: tx, error: txError } = await supabase
    .from("transacoes")
    .select("id,pedido_id,status,status_detalhe_provedor,id_transacao_gateway,pix_copia_cola,pix_qrcode,pix_modo,pix_recebedor_nome,pix_recebedor_cidade,payload_provedor,valor_bruto,afiliado_id,link_afiliado_id")
    .eq("id", created.transacao_id)
    .eq("empresa_id", source.empresaId)
    .single();
  if (txError || !tx) return jsonResponse({ error: "transaction_lookup_failed" }, 500);

  const persistedTotal = Number(tx.valor_bruto);
  const orderId = tx.pedido_id ?? created.pedido_id;
  const terminalFailure = new Set(["cancelada", "rejeitada", "falhou", "expirada", "reembolsada", "chargeback"]);
  if (terminalFailure.has(tx.status)) return jsonResponse({ error: "payment_previous_attempt_failed" }, 409);

  if (provider === "pix_chave") {
    if (tx.pix_copia_cola && tx.pix_qrcode) {
      return jsonResponse({
        ok: true,
        duplicate: true,
        order_id: orderId,
        transaction_id: tx.id,
        payment_id: tx.id,
        status: tx.status,
        status_detail: tx.status_detalhe_provedor,
        amount: persistedTotal,
        receiver_name: tx.pix_recebedor_nome,
        receiver_city: tx.pix_recebedor_cidade,
        manual_confirmation: true,
        message: "Aguardando conferência",
        pix: { qr_code: tx.pix_copia_cola, qr_code_base64: tx.pix_qrcode, ticket_url: null },
        success_url: source.link?.url_redirecionamento_sucesso ?? source.checkout.url_sucesso ?? null,
      });
    }

    const txid = normalizePixTxid(tx.id);
    let payload: string;
    let qrDataUrl: string;
    try {
      payload = buildStaticPixPayload({
        key: pixConfig.key,
        receiverName: pixConfig.receiverName,
        receiverCity: pixConfig.receiverCity,
        amount: persistedTotal,
        txid,
      });
      qrDataUrl = await QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 2, width: 480 });
    } catch (error) {
      console.error("Static Pix generation failed", error);
      await markFailed(supabase, tx.id, "pix_generation_failed");
      return jsonResponse({ error: "pix_generation_failed" }, 500);
    }

    const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, "");
    const { error: updateError } = await supabase
      .from("transacoes")
      .update({
        metodo_pagamento: "pix",
        provedor_pagamento: "pix_chave",
        status: "pendente",
        status_detalhe_provedor: "aguardando_conferencia_manual",
        pix_copia_cola: payload,
        pix_qrcode: qrBase64,
        pix_expiracao: null,
        pix_modo: "chave",
        pix_txid: txid,
        pix_chave_snapshot: pixConfig.key,
        pix_recebedor_nome: pixConfig.receiverName,
        pix_recebedor_cidade: pixConfig.receiverCity,
        pix_gerado_em: new Date().toISOString(),
        payload_provedor: { mode: "chave", confirmation: "manual", br_code: "BR Code/EMV", version: 1 },
        updated_at: new Date().toISOString(),
      })
      .eq("id", tx.id)
      .eq("status", "pendente")
      .is("pix_copia_cola", null);

    if (updateError) {
      await markFailed(supabase, tx.id, "pix_persist_failed");
      return jsonResponse({ error: "pix_persist_failed" }, 500);
    }

    const persisted = await supabase
      .from("transacoes")
      .select("status,status_detalhe_provedor,pix_copia_cola,pix_qrcode,pix_recebedor_nome,pix_recebedor_cidade,valor_bruto")
      .eq("id", tx.id)
      .single();
    if (persisted.error || !persisted.data?.pix_copia_cola || !persisted.data.pix_qrcode) {
      await markFailed(supabase, tx.id, "pix_persist_failed");
      return jsonResponse({ error: "pix_persist_failed" }, 500);
    }

    return jsonResponse({
      ok: true,
      order_id: orderId,
      transaction_id: tx.id,
      payment_id: tx.id,
      status: persisted.data.status,
      status_detail: persisted.data.status_detalhe_provedor,
      amount: Number(persisted.data.valor_bruto),
      receiver_name: persisted.data.pix_recebedor_nome,
      receiver_city: persisted.data.pix_recebedor_cidade,
      manual_confirmation: true,
      message: "Aguardando conferência",
      pix: { qr_code: persisted.data.pix_copia_cola, qr_code_base64: persisted.data.pix_qrcode, ticket_url: null },
      success_url: source.link?.url_redirecionamento_sucesso ?? source.checkout.url_sucesso ?? null,
    });
  }

  if (!accessToken || !webhookSecret) return jsonResponse({ error: "mercadopago_not_configured" }, 503);

  if (tx.id_transacao_gateway) {
    const payload = tx.payload_provedor as Record<string, any> | null;
    const pix = payload?.point_of_interaction?.transaction_data;
    return jsonResponse({
      ok: true,
      duplicate: true,
      order_id: orderId,
      transaction_id: tx.id,
      payment_id: tx.id_transacao_gateway,
      status: tx.status,
      status_detail: tx.status_detalhe_provedor,
      amount: persistedTotal,
      manual_confirmation: false,
      message: null,
      pix: pix ? { qr_code: pix.qr_code ?? null, qr_code_base64: pix.qr_code_base64 ?? null, ticket_url: pix.ticket_url ?? null } : null,
      success_url: source.link?.url_redirecionamento_sucesso ?? source.checkout.url_sucesso ?? null,
    });
  }

  let expectedCollectorId: string;
  try {
    expectedCollectorId = await mercadoPagoCollectorId(accessToken);
  } catch (error) {
    console.error("Mercado Pago identity lookup failed", error);
    await markFailed(supabase, tx.id, "provider_identity_unavailable");
    return jsonResponse({ error: "mercadopago_identity_unavailable" }, 503);
  }

  const trustedIdentityPayload = {
    collector_id: expectedCollectorId,
    identity_source: "mercadopago_users_me",
  };
  const { error: identityPersistError } = await supabase
    .from("transacoes")
    .update({
      pix_modo: "provedor",
      payload_provedor: trustedIdentityPayload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tx.id);
  if (identityPersistError) {
    await markFailed(supabase, tx.id, "provider_identity_persist_failed");
    return jsonResponse({ error: "payment_persist_failed" }, 500);
  }

  const { firstName, lastName } = splitName(fullName);
  const paymentBody: Record<string, any> = {
    transaction_amount: persistedTotal,
    description: source.product.nome,
    payment_method_id: "pix",
    payer: {
      email,
      first_name: firstName,
      last_name: lastName,
      ...(cpf ? { identification: { type: "CPF", number: cpf } } : {}),
    },
    external_reference: tx.id,
    metadata: {
      cash_engine_transaction_id: tx.id,
      cash_engine_order_id: orderId ?? null,
      empresa_id: source.empresaId,
      produto_id: source.product.id,
      checkout_id: source.checkout.id,
      link_pagamento_id: source.link?.id ?? null,
      afiliado_id: tx.afiliado_id ?? null,
      link_afiliado_id: tx.link_afiliado_id ?? null,
    },
    notification_url: `${supabaseUrl}/functions/v1/mercadopago-webhook`,
  };

  let response: Response;
  let payment: Record<string, any>;
  try {
    response = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(paymentBody),
      signal: AbortSignal.timeout(15_000),
    });
    payment = await response.json();
  } catch (error) {
    console.error("Mercado Pago request failed", error);
    await markFailed(supabase, tx.id, "gateway_unreachable", {
      ...trustedIdentityPayload,
      provider_error: "gateway_unreachable",
    });
    return jsonResponse({ error: "mercadopago_unreachable" }, 502);
  }

  if (!response.ok || !payment.id) {
    await markFailed(
      supabase,
      tx.id,
      payment?.message ?? payment?.error ?? `http_${response.status}`,
      { ...trustedIdentityPayload, provider_error: payment ?? {} },
    );
    return jsonResponse(
      {
        error: "payment_rejected_by_gateway",
        status: payment?.status ?? null,
        status_detail: payment?.status_detail ?? payment?.message ?? null,
      },
      422,
    );
  }

  if (
    payment.payment_method_id !== "pix" ||
    payment.collector_id == null ||
    String(payment.collector_id) !== expectedCollectorId
  ) {
    await markFailed(supabase, tx.id, "provider_identity_mismatch", {
      ...trustedIdentityPayload,
      received_collector_id: payment.collector_id ?? null,
      payment_id: String(payment.id),
    });
    return jsonResponse({ error: "payment_provider_identity_mismatch" }, 422);
  }

  const pixData = payment.point_of_interaction?.transaction_data ?? null;
  const fees = Array.isArray(payment.fee_details)
    ? payment.fee_details.reduce((sum: number, fee: Record<string, any>) => sum + Number(fee.amount ?? 0), 0)
    : 0;
  const net = Number(payment.transaction_details?.net_received_amount ?? persistedTotal);
  const mapped = mapStatus(payment.status);

  const updateResult = await supabase
    .from("transacoes")
    .update({
      id_transacao_gateway: String(payment.id),
      provedor_pagamento: "mercadopago",
      status: mapped,
      status_detalhe_provedor: payment.status_detail ?? null,
      metodo_pagamento: "pix",
      valor_bruto: Number(payment.transaction_amount ?? persistedTotal),
      valor_liquido: Number.isFinite(net) ? net : persistedTotal,
      valor_taxa_processamento: Number.isFinite(fees) ? fees : 0,
      parcelas: 1,
      data_pagamento: payment.date_approved ?? null,
      pix_qrcode: pixData?.qr_code_base64 ?? null,
      pix_copia_cola: pixData?.qr_code ?? null,
      pix_expiracao: payment.date_of_expiration ?? null,
      pix_modo: "provedor",
      payload_provedor: payment,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tx.id);
  if (updateResult.error) {
    await markFailed(supabase, tx.id, "payment_persist_failed", {
      ...trustedIdentityPayload,
      payment_id: String(payment.id),
    });
    return jsonResponse({ error: "payment_persist_failed" }, 500);
  }

  return jsonResponse({
    ok: true,
    order_id: orderId,
    transaction_id: tx.id,
    payment_id: String(payment.id),
    status: mapped,
    status_detail: payment.status_detail ?? null,
    amount: persistedTotal,
    manual_confirmation: false,
    message: null,
    pix: pixData
      ? { qr_code: pixData.qr_code ?? null, qr_code_base64: pixData.qr_code_base64 ?? null, ticket_url: pixData.ticket_url ?? null }
      : null,
    success_url: source.link?.url_redirecionamento_sucesso ?? source.checkout.url_sucesso ?? null,
  });
});