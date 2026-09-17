import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import QRCode from "https://esm.sh/qrcode@1.5.4";
import { buildStaticPixPayload, normalizePixTxid } from "../_shared/pix-brcode.ts";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-idempotency-key",
  "access-control-allow-methods": "POST, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "content-type": "application/json; charset=utf-8" };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}
function digits(value: unknown) {
  return typeof value === "string" ? value.replace(/\D/g, "") : "";
}
function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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
  return { firstName: parts[0] ?? "Cliente", lastName: parts.slice(1).join(" ") || "Cash Engine" };
}
function activePromotionPrice(product: Record<string, any>) {
  const normal = Number(product.preco ?? 0);
  const promo = product.preco_promocional == null ? null : Number(product.preco_promocional);
  if (promo == null || !Number.isFinite(promo) || promo < 0) return normal;
  const now = Date.now();
  if (product.promocao_inicio && now < new Date(product.promocao_inicio).getTime()) return normal;
  if (product.promocao_fim && now >= new Date(product.promocao_fim).getTime()) return normal;
  return promo;
}
function validProduct(product: Record<string, any> | null) {
  return Boolean(product && !product.deleted_at && product.status === "publicado" && (!product.gerencia_estoque || Number(product.estoque ?? 0) > 0));
}
function valueText(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

async function getPixConfig(supabase: ReturnType<typeof createClient>, hasProvider: boolean) {
  const { data, error } = await supabase
    .from("admin_global_config")
    .select("chave,valor")
    .in("chave", ["pix_modo_recebimento", "pix_chave", "pix_recebedor_nome", "pix_recebedor_cidade"]);
  if (error) throw error;
  const map = new Map((data ?? []).map((row: any) => [row.chave, valueText(row.valor)]));
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
    return { mode: "provedor" as const, key: "", receiverName: "", receiverCity: "", available: hasProvider, confirmation: "automatic" as const };
  }
  return { mode: "desativado" as const, key: "", receiverName: "", receiverCity: "", available: false, confirmation: null };
}

type Source = {
  checkout: Record<string, any>;
  version: Record<string, any>;
  offer: Record<string, any>;
  product: Record<string, any>;
  link: Record<string, any> | null;
  empresaId: string;
};

async function findCheckoutByPublicValue(supabase: ReturnType<typeof createClient>, value: string) {
  const byToken = await supabase.from("checkouts").select("*").eq("public_token", value).eq("status", "publicado").is("deleted_at", null).maybeSingle();
  if (byToken.error) throw byToken.error;
  if (byToken.data) return byToken.data;
  const bySlug = await supabase.from("checkouts").select("*").eq("slug", value).eq("status", "publicado").is("deleted_at", null).limit(2);
  if (bySlug.error) throw bySlug.error;
  if ((bySlug.data ?? []).length !== 1) return null;
  return bySlug.data![0];
}

async function loadSource(supabase: ReturnType<typeof createClient>, body: Record<string, any>): Promise<Source> {
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
    link = data;
    if (!link.checkout_id) throw new Error("checkout_unavailable");
    const result = await supabase.from("checkouts").select("*").eq("id", link.checkout_id).eq("status", "publicado").is("deleted_at", null).maybeSingle();
    if (result.error) throw result.error;
    checkout = result.data;
  } else if (checkoutValue) {
    checkout = await findCheckoutByPublicValue(supabase, checkoutValue);
  } else {
    throw new Error("checkout_source_required");
  }

  if (!checkout || !checkout.publicado_versao_id || !checkout.oferta_id) throw new Error("checkout_unavailable");
  const versionResult = await supabase.from("checkout_versions").select("*").eq("id", checkout.publicado_versao_id).eq("estado", "publicado").maybeSingle();
  if (versionResult.error) throw versionResult.error;
  if (!versionResult.data) throw new Error("checkout_unavailable");

  const offerId = link?.oferta_id ?? checkout.oferta_id;
  const offerResult = await supabase.from("ofertas").select("*").eq("id", offerId).eq("empresa_id", checkout.empresa_id).eq("status", "ativa").is("deleted_at", null).maybeSingle();
  if (offerResult.error) throw offerResult.error;
  const offer = offerResult.data;
  if (!offer) throw new Error("offer_unavailable");
  if (offer.vigencia_inicio && new Date(offer.vigencia_inicio).getTime() > Date.now()) throw new Error("offer_unavailable");
  if (offer.vigencia_fim && new Date(offer.vigencia_fim).getTime() <= Date.now()) throw new Error("offer_unavailable");

  const productResult = await supabase.from("produtos").select("*").eq("id", offer.produto_id).eq("empresa_id", checkout.empresa_id).maybeSingle();
  if (productResult.error) throw productResult.error;
  if (!validProduct(productResult.data)) throw new Error("product_unavailable");
  if (link && (link.checkout_id !== checkout.id || (link.oferta_id && link.oferta_id !== offer.id))) throw new Error("payment_link_mismatch");

  return { checkout, version: versionResult.data, offer, product: productResult.data!, link, empresaId: checkout.empresa_id };
}

async function loadBumps(supabase: ReturnType<typeof createClient>, source: Source) {
  const rows = Array.isArray(source.checkout.produtos_config) ? source.checkout.produtos_config : [];
  const configured = rows.flatMap((item: unknown) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, any>;
    if (row.tipo !== "order_bump" && row.type !== "order_bump" && row.order_bump !== true) return [];
    const productId = row.produto_id ?? row.product_id;
    const id = row.id ?? row.bump_id ?? productId;
    return typeof productId === "string" && productId && typeof id === "string" && id ? [{ id, productId }] : [];
  });
  if (!configured.length) return [];
  const productsResult = await supabase.from("produtos").select("*").in("id", [...new Set(configured.map((row) => row.productId))]).eq("empresa_id", source.empresaId).eq("status", "publicado").is("deleted_at", null);
  if (productsResult.error) throw productsResult.error;
  const products = new Map((productsResult.data ?? []).map((product: any) => [product.id, product]));
  const seen = new Set<string>();
  return configured.flatMap((row) => {
    if (seen.has(row.id)) return [];
    const product = products.get(row.productId) as Record<string, any> | undefined;
    if (!product || !validProduct(product)) return [];
    const amount = Number(activePromotionPrice(product).toFixed(2));
    if (!Number.isFinite(amount) || amount < 0) return [];
    seen.add(row.id);
    return [{ id: row.id, product_id: product.id, name: product.nome, amount }];
  });
}

function checkoutBaseAmount(source: Source, requested: unknown) {
  const fixed = Number(source.offer.preco);
  if (!source.offer.permitir_valor_personalizado && !source.link?.permite_editar_valor) return fixed;
  let amount = Number(requested);
  if (!Number.isFinite(amount) || amount <= 0) amount = fixed;
  const min = source.offer.valor_minimo == null ? null : Number(source.offer.valor_minimo);
  const max = source.offer.valor_maximo == null ? null : Number(source.offer.valor_maximo);
  if (min != null && Number.isFinite(min)) amount = Math.max(amount, min);
  if (max != null && Number.isFinite(max)) amount = Math.min(amount, max);
  return amount;
}

async function resolveAffiliate(supabase: ReturnType<typeof createClient>, code: string, source: Source) {
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
  const affiliate = await supabase.from("afiliados").select("id,status,profile_id").eq("id", data.afiliado_id).eq("empresa_id", source.empresaId).maybeSingle();
  if (affiliate.error || affiliate.data?.status !== "ativo") return null;
  const authorization = await supabase.from("afiliados_produtos").select("ativo,data_inicio,data_fim").eq("afiliado_id", data.afiliado_id).eq("produto_id", source.product.id).eq("empresa_id", source.empresaId).maybeSingle();
  if (authorization.error || !authorization.data?.ativo) return null;
  if (authorization.data.data_inicio && authorization.data.data_inicio > now) return null;
  if (authorization.data.data_fim && authorization.data.data_fim < now) return null;
  return { afiliado_id: data.afiliado_id as string, link_afiliado_id: data.id as string };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const accessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: "checkout_not_configured" }, 503);

  let body: Record<string, any>;
  try { body = await request.json(); } catch { return jsonResponse({ error: "invalid_json" }, 400); }
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  let source: Source;
  let pixConfig: Awaited<ReturnType<typeof getPixConfig>>;
  let bumps: Awaited<ReturnType<typeof loadBumps>>;
  try {
    [source, pixConfig] = await Promise.all([loadSource(supabase, body), getPixConfig(supabase, Boolean(accessToken))]);
    bumps = await loadBumps(supabase, source);
  } catch (error) {
    const code = error instanceof Error ? error.message : "checkout_load_failed";
    const notFound = new Set(["checkout_unavailable", "payment_link_unavailable", "payment_link_expired", "payment_link_limit_reached", "offer_unavailable", "product_unavailable", "payment_link_mismatch"]);
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
        banner_url: null,
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
        amount: Number(source.offer.preco),
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
      pix_unavailable_reason: pixEnabledByCheckout && !pixConfig.available ? (pixConfig.mode === "provedor" ? "provider_not_configured" : "pix_not_configured") : null,
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
  const byEmail = await supabase.from("clientes").select("id").eq("empresa_id", source.empresaId).eq("email", email).is("deleted_at", null).maybeSingle();
  if (byEmail.error) return jsonResponse({ error: "customer_lookup_failed" }, 500);
  customer = byEmail.data;
  if (!customer && cpf) {
    const byCpf = await supabase.from("clientes").select("id").eq("empresa_id", source.empresaId).eq("cpf", cpf).is("deleted_at", null).maybeSingle();
    if (byCpf.error) return jsonResponse({ error: "customer_lookup_failed" }, 500);
    customer = byCpf.data;
  }
  if (customer) {
    const { error } = await supabase.from("clientes").update({ nome_completo: fullName, email, cpf: cpf || null, celular: phone || null, origem_captacao: source.link ? "link_pagamento" : "checkout", status: "ativo", updated_at: new Date().toISOString() }).eq("id", customer.id);
    if (error) return jsonResponse({ error: "customer_update_failed" }, 500);
  } else {
    const result = await supabase.from("clientes").insert({ empresa_id: source.empresaId, nome_completo: fullName, email, cpf: cpf || null, celular: phone || null, origem_captacao: source.link ? "link_pagamento" : "checkout", status: "ativo" }).select("id").single();
    if (result.error) return jsonResponse({ error: "customer_create_failed" }, 500);
    customer = result.data;
  }

  const idempotencyKey = isUuid(body.idempotency_key)
    ? body.idempotency_key
    : isUuid(request.headers.get("x-idempotency-key"))
      ? request.headers.get("x-idempotency-key")!
      : crypto.randomUUID();
  const selectedBumps = Array.isArray(body.order_bump_ids) ? [...new Set(body.order_bump_ids.filter(isUuid))] : [];
  if (Array.isArray(body.order_bump_ids) && selectedBumps.length !== body.order_bump_ids.length) return jsonResponse({ error: "invalid_order_bump_ids" }, 422);

  const affiliateCode = typeof body.affiliate_code === "string" ? body.affiliate_code.trim() : "";
  const attribution = await resolveAffiliate(supabase, affiliateCode, source);
  const provider = pixConfig.mode === "chave" ? "pix_chave" : "mercadopago";
  const customAmount = source.offer.permitir_valor_personalizado || source.link?.permite_editar_valor ? Number(body.amount) : null;

  const orderResult = await supabase.rpc("fn_criar_pedido_checkout_pix", {
    p_checkout_id: source.checkout.id,
    p_link_id: source.link?.id ?? null,
    p_cliente_id: customer!.id,
    p_order_bump_ids: selectedBumps,
    p_custom_amount: Number.isFinite(customAmount) && customAmount! > 0 ? customAmount : null,
    p_idempotency_key: idempotencyKey,
    p_afiliado_id: attribution?.afiliado_id ?? null,
    p_link_afiliado_id: attribution?.link_afiliado_id ?? null,
    p_provedor: provider,
  });
  if (orderResult.error || !orderResult.data?.length) {
    console.error("Order creation failed", orderResult.error);
    const msg = orderResult.error?.message ?? "order_create_failed";
    return jsonResponse({ error: msg.includes("Order bump") || msg.includes("Combinação") ? "invalid_order_bumps" : "order_create_failed" }, 422);
  }
  const order = orderResult.data[0] as { pedido_id: string; transacao_id: string; pedido_numero: string; total: number };
  const total = Number(order.total);

  const existing = await supabase.from("transacoes").select("id,status,status_detalhe_provedor,id_transacao_gateway,pix_copia_cola,pix_qrcode,pix_modo,pix_recebedor_nome,pix_recebedor_cidade,payload_provedor").eq("id", order.transacao_id).single();
  if (existing.error) return jsonResponse({ error: "transaction_lookup_failed" }, 500);
  const tx = existing.data;

  if (provider === "pix_chave") {
    if (tx.pix_copia_cola && tx.pix_qrcode) {
      return jsonResponse({ ok: true, duplicate: true, order_id: order.pedido_id, transaction_id: tx.id, payment_id: tx.id, status: tx.status, status_detail: tx.status_detalhe_provedor, amount: total, receiver_name: tx.pix_recebedor_nome, receiver_city: tx.pix_recebedor_cidade, manual_confirmation: true, message: "Aguardando conferência", pix: { qr_code: tx.pix_copia_cola, qr_code_base64: tx.pix_qrcode, ticket_url: null }, success_url: source.link?.url_redirecionamento_sucesso ?? source.checkout.url_sucesso ?? null });
    }
    const txid = normalizePixTxid(tx.id);
    let payload: string;
    let qrDataUrl: string;
    try {
      payload = buildStaticPixPayload({ key: pixConfig.key, receiverName: pixConfig.receiverName, receiverCity: pixConfig.receiverCity, amount: total, txid });
      qrDataUrl = await QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 2, width: 480 });
    } catch (error) {
      console.error("Static Pix generation failed", error);
      return jsonResponse({ error: "pix_generation_failed" }, 500);
    }
    const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, "");
    const { error: updateError } = await supabase.from("transacoes").update({
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
    }).eq("id", tx.id).eq("status", "pendente");
    if (updateError) return jsonResponse({ error: "pix_persist_failed" }, 500);
    return jsonResponse({ ok: true, order_id: order.pedido_id, transaction_id: tx.id, payment_id: tx.id, status: "pendente", status_detail: "aguardando_conferencia_manual", amount: total, receiver_name: pixConfig.receiverName, receiver_city: pixConfig.receiverCity, manual_confirmation: true, message: "Aguardando conferência", pix: { qr_code: payload, qr_code_base64: qrBase64, ticket_url: null }, success_url: source.link?.url_redirecionamento_sucesso ?? source.checkout.url_sucesso ?? null });
  }

  if (!accessToken) return jsonResponse({ error: "mercadopago_not_configured" }, 503);
  if (tx.id_transacao_gateway) {
    const payload = tx.payload_provedor as Record<string, any> | null;
    const pix = payload?.point_of_interaction?.transaction_data;
    return jsonResponse({ ok: true, duplicate: true, order_id: order.pedido_id, transaction_id: tx.id, payment_id: tx.id_transacao_gateway, status: tx.status, status_detail: tx.status_detalhe_provedor, amount: total, manual_confirmation: false, message: null, pix: pix ? { qr_code: pix.qr_code ?? null, qr_code_base64: pix.qr_code_base64 ?? null, ticket_url: pix.ticket_url ?? null } : null, success_url: source.link?.url_redirecionamento_sucesso ?? source.checkout.url_sucesso ?? null });
  }

  const { firstName, lastName } = splitName(fullName);
  const paymentBody: Record<string, any> = {
    transaction_amount: total,
    description: source.product.nome,
    payment_method_id: "pix",
    payer: { email, first_name: firstName, last_name: lastName, ...(cpf ? { identification: { type: "CPF", number: cpf } } : {}) },
    external_reference: tx.id,
    metadata: { cash_engine_transaction_id: tx.id, pedido_id: order.pedido_id, empresa_id: source.empresaId, produto_id: source.product.id, checkout_id: source.checkout.id, link_pagamento_id: source.link?.id ?? null, afiliado_id: attribution?.afiliado_id ?? null, link_afiliado_id: attribution?.link_afiliado_id ?? null },
    notification_url: `${supabaseUrl}/functions/v1/mercadopago-webhook`,
  };
  let response: Response;
  let payment: Record<string, any>;
  try {
    response = await fetch("https://api.mercadopago.com/v1/payments", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", "X-Idempotency-Key": idempotencyKey }, body: JSON.stringify(paymentBody) });
    payment = await response.json();
  } catch (error) {
    await supabase.from("transacoes").update({ status: "falhou", status_detalhe_provedor: "gateway_unreachable", updated_at: new Date().toISOString() }).eq("id", tx.id);
    return jsonResponse({ error: "mercadopago_unreachable" }, 502);
  }
  if (!response.ok || !payment.id) {
    await supabase.from("transacoes").update({ status: "falhou", status_detalhe_provedor: payment?.message ?? payment?.error ?? `http_${response.status}`, payload_provedor: payment ?? {}, updated_at: new Date().toISOString() }).eq("id", tx.id);
    return jsonResponse({ error: "payment_rejected_by_gateway", status: payment?.status ?? null, status_detail: payment?.status_detail ?? payment?.message ?? null }, 422);
  }
  const pixData = payment.point_of_interaction?.transaction_data ?? null;
  const fees = Array.isArray(payment.fee_details) ? payment.fee_details.reduce((sum: number, fee: Record<string, any>) => sum + Number(fee.amount ?? 0), 0) : 0;
  const net = Number(payment.transaction_details?.net_received_amount ?? total);
  const mapped = mapStatus(payment.status);
  const updateError = await supabase.from("transacoes").update({
    id_transacao_gateway: String(payment.id),
    provedor_pagamento: "mercadopago",
    status: mapped,
    status_detalhe_provedor: payment.status_detail ?? null,
    metodo_pagamento: "pix",
    valor_bruto: Number(payment.transaction_amount ?? total),
    valor_liquido: Number.isFinite(net) ? net : total,
    valor_taxa_processamento: Number.isFinite(fees) ? fees : 0,
    parcelas: 1,
    data_pagamento: payment.date_approved ?? null,
    pix_qrcode: pixData?.qr_code_base64 ?? null,
    pix_copia_cola: pixData?.qr_code ?? null,
    pix_expiracao: payment.date_of_expiration ?? null,
    pix_modo: "provedor",
    payload_provedor: payment,
    updated_at: new Date().toISOString(),
  }).eq("id", tx.id);
  if (updateError.error) return jsonResponse({ error: "payment_persist_failed" }, 500);
  if (["aprovada", "capturada", "paga", "disponivel"].includes(mapped)) {
    await supabase.from("pedidos").update({ status: "pago", confirmado_em: payment.date_approved ?? new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", order.pedido_id);
  }
  return jsonResponse({ ok: true, order_id: order.pedido_id, transaction_id: tx.id, payment_id: String(payment.id), status: mapped, status_detail: payment.status_detail ?? null, amount: total, manual_confirmation: false, message: null, pix: pixData ? { qr_code: pixData.qr_code ?? null, qr_code_base64: pixData.qr_code_base64 ?? null, ticket_url: pixData.ticket_url ?? null } : null, success_url: source.link?.url_redirecionamento_sucesso ?? source.checkout.url_sucesso ?? null });
});
