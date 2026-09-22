import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  CheckCircle2,
  Copy,
  Loader2,
  LockKeyhole,
  Plus,
  QrCode,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";

type CheckoutSource =
  | { checkoutSlug: string; paymentLinkCode?: never }
  | { paymentLinkCode: string; checkoutSlug?: never };

type OrderBump = {
  id: string;
  product_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  amount: number;
  group?: string | null;
  max_group_selection?: number | null;
};

type CheckoutData = {
  checkout: {
    id: string | null;
    slug: string | null;
    name: string;
    description: string | null;
    image_url: string | null;
    banner_url: string | null;
    success_url: string | null;
    allow_custom_amount: boolean;
    min_amount: number | null;
    max_amount: number | null;
  };
  product: {
    id: string;
    name: string;
    type: string;
    image_url: string | null;
    amount: number;
    currency: string;
    allows_installments: boolean;
    max_installments: number;
  };
  order_bumps: OrderBump[];
  payment_methods: {
    pix: boolean;
    card: boolean;
    boleto: boolean;
    card_status?: string;
    boleto_status?: string;
  };
  pix_mode: "chave" | "provedor" | "desativado";
  pix_confirmation: "manual" | "automatic" | null;
  pix_unavailable_reason?: string | null;
  fields: { cpf: boolean; phone: boolean; address: boolean };
  theme: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
    logo_url: string | null;
    title: string;
    subtitle: string | null;
    button_text?: string | null;
    font?: string | null;
  };
  banners: {
    desktop_url?: string | null;
    mobile_url?: string | null;
    image_url?: string | null;
    alt?: string | null;
  };
  legal: {
    terms_url: string | null;
    privacy_url: string | null;
  };
};

type PaymentResult = {
  ok: boolean;
  order_id?: string;
  transaction_id: string;
  payment_id: string;
  status: string;
  status_detail: string | null;
  amount?: number;
  receiver_name?: string | null;
  receiver_city?: string | null;
  manual_confirmation?: boolean;
  message?: string | null;
  pix: {
    qr_code: string | null;
    qr_code_base64: string | null;
    ticket_url: string | null;
  } | null;
  success_url: string | null;
};

const paidStatuses = new Set(["aprovada", "capturada", "paga", "disponivel"]);
const terminalFailureStatuses = new Set([
  "cancelada",
  "rejeitada",
  "falhou",
  "expirada",
  "reembolsada",
  "chargeback",
]);

const errorLabels: Record<string, string> = {
  checkout_unavailable: "Este checkout não está disponível.",
  payment_link_unavailable: "Este link de pagamento não está disponível.",
  payment_link_expired: "Este link de pagamento expirou.",
  payment_link_limit_reached: "Este link atingiu o limite de utilizações.",
  payment_link_mismatch: "Este link não pertence a este checkout.",
  offer_unavailable: "A oferta não está disponível.",
  product_unavailable: "O produto não está disponível para compra.",
  product_out_of_stock: "Este produto está indisponível no momento.",
  invalid_checkout_amount: "O valor da compra é inválido.",
  amount_below_minimum: "O valor informado está abaixo do mínimo permitido.",
  amount_above_maximum: "O valor informado está acima do máximo permitido.",
  invalid_order_bumps: "Um dos itens adicionais não está mais disponível.",
  duplicate_order_bump: "Um item adicional foi selecionado mais de uma vez.",
  order_bump_combination_not_allowed: "A combinação de itens adicionais não é permitida.",
  payer_name_and_email_required: "Preencha seu nome e e-mail.",
  valid_cpf_required: "Informe um CPF válido com 11 dígitos.",
  pix_not_configured: "O Pix ainda não foi configurado para este checkout.",
  mercadopago_not_configured: "O provedor Pix automático ainda não foi configurado.",
  payment_method_unavailable: "Este método de pagamento ainda não está disponível.",
  payment_rejected_by_gateway: "O pagamento não pôde ser criado pelo provedor.",
};

function sourceBody(source: CheckoutSource) {
  return "checkoutSlug" in source
    ? { checkout_slug: source.checkoutSlug }
    : { payment_link_code: source.paymentLinkCode };
}

async function invokeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const maybeCode = (data as { error?: string } | null)?.error;
    throw new Error(maybeCode || error.message || "request_failed");
  }
  if ((data as { error?: string } | null)?.error) {
    throw new Error((data as { error: string }).error);
  }
  return data as T;
}

function groupSelectionAllowed(
  bumps: OrderBump[],
  selected: Set<string>,
  candidate: OrderBump,
) {
  if (!candidate.group) return true;
  const inGroup = bumps.filter(
    (item) => item.group === candidate.group && selected.has(item.id),
  ).length;
  return inGroup < (candidate.max_group_selection ?? 1);
}

export function PublicCheckoutPage({ source }: { source: CheckoutSource }) {
  const [checkout, setCheckout] = useState<CheckoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentResult | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [selectedBumps, setSelectedBumps] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ name: "", email: "", cpf: "", phone: "" });
  const idempotencyKeyRef = useRef<string | null>(null);
  const affiliateCodeRef = useRef("");

  const sourceKey =
    "checkoutSlug" in source
      ? `checkout:${source.checkoutSlug}`
      : `link:${source.paymentLinkCode}`;

  useEffect(() => {
    let active = true;
    const searchParams = new URLSearchParams(window.location.search);
    affiliateCodeRef.current =
      ["ref", "aff", "affiliate"]
        .map((key) => searchParams.get(key)?.trim() ?? "")
        .find(Boolean) ?? "";

    setLoading(true);
    setLoadError(null);
    setCheckout(null);
    setPayment(null);
    setPaymentStatus(null);
    setSelectedBumps(new Set());
    idempotencyKeyRef.current = null;

    invokeFunction<CheckoutData>("mercadopago-checkout", {
      action: "load",
      ...sourceBody(source),
      affiliate_code: affiliateCodeRef.current,
    })
      .then((data) => {
        if (!active) return;
        setCheckout(data);
        if (data.checkout.allow_custom_amount) {
          setCustomAmount(String(data.product.amount));
        }
      })
      .catch((error) => {
        if (!active) return;
        const code = error instanceof Error ? error.message : "checkout_load_failed";
        setLoadError(errorLabels[code] ?? "Não foi possível carregar este checkout agora.");
      })
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [sourceKey]);

  useEffect(() => {
    if (!payment?.transaction_id || !idempotencyKeyRef.current) return;
    const current = paymentStatus ?? payment.status;
    if (paidStatuses.has(current) || terminalFailureStatuses.has(current)) return;

    let cancelled = false;
    const transactionId = payment.transaction_id;
    const key = idempotencyKeyRef.current;

    const poll = async () => {
      try {
        const status = await invokeFunction<{ ok: boolean; status: string }>(
          "mercadopago-payment-status",
          { transaction_id: transactionId, idempotency_key: key },
        );
        if (!cancelled) setPaymentStatus(status.status);
      } catch {
        // Webhook/conciliação continuam sendo a fonte de verdade.
      }
    };

    void poll();
    const interval = window.setInterval(poll, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [payment?.transaction_id, payment?.status, paymentStatus]);

  const baseAmount = useMemo(() => {
    if (!checkout) return 0;
    if (!checkout.checkout.allow_custom_amount) return Number(checkout.product.amount ?? 0);
    const parsed = Number(customAmount.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : Number(checkout.product.amount ?? 0);
  }, [checkout, customAmount]);

  const bumpAmount = useMemo(() => {
    if (!checkout) return 0;
    return checkout.order_bumps
      .filter((bump) => selectedBumps.has(bump.id))
      .reduce((sum, bump) => sum + Number(bump.amount || 0), 0);
  }, [checkout, selectedBumps]);

  const visualTotal = Number((baseAmount + bumpAmount).toFixed(2));
  const currentStatus = paymentStatus ?? payment?.status ?? null;
  const isPaid = currentStatus ? paidStatuses.has(currentStatus) : false;
  const isFailed = currentStatus ? terminalFailureStatuses.has(currentStatus) : false;
  const displayedPaymentAmount = payment?.amount ?? visualTotal;

  function toggleBump(bump: OrderBump) {
    setPayError(null);
    setSelectedBumps((current) => {
      const next = new Set(current);
      if (next.has(bump.id)) {
        next.delete(bump.id);
        return next;
      }
      if (!checkout || !groupSelectionAllowed(checkout.order_bumps, current, bump)) {
        setPayError("Este grupo de adicionais já atingiu o limite permitido.");
        return current;
      }
      next.add(bump.id);
      return next;
    });
    idempotencyKeyRef.current = null;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!checkout || paying || !checkout.payment_methods.pix) return;

    setPayError(null);
    setPaying(true);
    setPayment(null);
    setPaymentStatus(null);

    if (!idempotencyKeyRef.current) idempotencyKeyRef.current = crypto.randomUUID();

    try {
      const result = await invokeFunction<PaymentResult>("mercadopago-checkout", {
        action: "pay",
        ...sourceBody(source),
        amount: checkout.checkout.allow_custom_amount ? baseAmount : undefined,
        order_bump_ids: [...selectedBumps],
        payment_method_id: "pix",
        idempotency_key: idempotencyKeyRef.current,
        affiliate_code: affiliateCodeRef.current,
        payer: {
          name: form.name.trim(),
          email: form.email.trim(),
          cpf: form.cpf,
          phone: form.phone,
        },
      });
      setPayment(result);
      setPaymentStatus(result.status);
    } catch (error) {
      const code = error instanceof Error ? error.message : "payment_failed";
      setPayError(errorLabels[code] ?? "Não foi possível gerar o Pix. Tente novamente.");
    } finally {
      setPaying(false);
    }
  }

  async function copyPix() {
    const value = payment?.pix?.qr_code;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#05070a] text-white">
        <div className="flex items-center gap-3 text-sm text-white/70">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando checkout seguro...
        </div>
      </main>
    );
  }

  if (!checkout || loadError) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#05070a] p-6 text-white">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-7 text-center shadow-2xl">
          <Zap className="mx-auto h-9 w-9 text-blue-400" />
          <h1 className="mt-4 text-xl font-semibold">Checkout indisponível</h1>
          <p className="mt-2 text-sm leading-6 text-white/60">
            {loadError ?? "Não foi possível abrir esta página."}
          </p>
        </div>
      </main>
    );
  }

  const manualPix = checkout.pix_confirmation === "manual";
  const primary = checkout.theme.primary || "#2563eb";
  const secondary = checkout.theme.secondary || "#0f172a";
  const text = checkout.theme.text || "#ffffff";
  const desktopBanner = checkout.banners.desktop_url || checkout.banners.image_url || checkout.checkout.banner_url;
  const mobileBanner = checkout.banners.mobile_url || desktopBanner;
  const themedStyle = {
    "--checkout-primary": primary,
    "--checkout-secondary": secondary,
    "--checkout-text": text,
    background: checkout.theme.background || "#05070a",
    color: text,
    fontFamily: checkout.theme.font || "Inter",
  } as CSSProperties;
  const panelStyle = { backgroundColor: `color-mix(in srgb, ${secondary} 78%, transparent)` };
  const subtlePanelStyle = { backgroundColor: `color-mix(in srgb, ${secondary} 58%, transparent)` };

  return (
    <main
      className="min-h-screen px-4 py-8 sm:py-12"
      style={themedStyle}
    >
      <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="overflow-hidden rounded-2xl border border-current/10 shadow-2xl" style={panelStyle}>
          {desktopBanner && (
            <picture>
              {mobileBanner && <source media="(max-width: 639px)" srcSet={mobileBanner} />}
              <img
                src={desktopBanner}
                alt={checkout.banners.alt ?? ""}
                className="h-40 w-full object-cover"
              />
            </picture>
          )}
          <div className="p-6 sm:p-8">
            {checkout.theme.logo_url && (
              <img
                src={checkout.theme.logo_url}
                alt="Logo"
                className="mb-5 max-h-10 max-w-[180px] object-contain"
              />
            )}
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em]" style={{ color: primary }}>
              <ShieldCheck className="h-4 w-4" /> Checkout seguro
            </div>
            <div className="mt-5 flex gap-4">
              {(checkout.checkout.image_url || checkout.product.image_url) && (
                <img
                  src={checkout.checkout.image_url || checkout.product.image_url || ""}
                  alt={checkout.product.name}
                  className="h-20 w-20 shrink-0 rounded-xl border border-white/10 object-cover"
                />
              )}
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  {checkout.theme.title || checkout.checkout.name}
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-6 opacity-55">
                  {checkout.theme.subtitle ||
                    checkout.checkout.description ||
                    checkout.product.name}
                </p>
              </div>
            </div>

            {checkout.order_bumps.length > 0 && (
              <div className="mt-8 space-y-3">
                <p className="text-xs font-medium uppercase tracking-[0.14em] opacity-45">
                  Adicione à sua compra
                </p>
                {checkout.order_bumps.map((bump) => {
                  const selected = selectedBumps.has(bump.id);
                  return (
                    <button
                      type="button"
                      key={bump.id}
                      onClick={() => toggleBump(bump)}
                      className="flex w-full items-center gap-3 rounded-xl border border-current/10 p-3 text-left transition hover:opacity-90"
                      style={selected ? {
                        borderColor: `color-mix(in srgb, ${primary} 55%, transparent)`,
                        backgroundColor: `color-mix(in srgb, ${primary} 10%, ${secondary})`,
                      } : subtlePanelStyle}
                    >
                      <span
                        className="grid h-5 w-5 shrink-0 place-items-center rounded border border-current/20"
                        style={selected ? { borderColor: primary, backgroundColor: primary, color: text } : undefined}
                      >
                        {selected && <CheckCircle2 className="h-3.5 w-3.5" />}
                      </span>
                      {bump.image_url && (
                        <img
                          src={bump.image_url}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-12 w-12 rounded-lg object-cover"
                        />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{bump.name}</span>
                        {bump.description && (
                          <span className="mt-0.5 line-clamp-2 block text-xs opacity-45">
                            {bump.description}
                          </span>
                        )}
                      </span>
                      <strong className="text-sm tabular-nums">
                        + {formatBRL(bump.amount)}
                      </strong>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-8 rounded-xl border border-current/10 p-5" style={subtlePanelStyle}>
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm opacity-55">Total</span>
                <strong className="text-2xl tabular-nums">{formatBRL(visualTotal)}</strong>
              </div>
              {checkout.checkout.allow_custom_amount && (
                <div className="mt-4">
                  <label className="text-xs opacity-55">Valor principal</label>
                  <input
                    inputMode="decimal"
                    value={customAmount}
                    onChange={(event) => {
                      setCustomAmount(event.target.value);
                      idempotencyKeyRef.current = null;
                    }}
                    className="mt-1.5 h-11 w-full rounded-lg border border-current/10 bg-transparent px-3 text-current outline-none focus:border-[var(--checkout-primary)]"
                  />
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs opacity-45">
              <span className="inline-flex items-center gap-1.5">
                <LockKeyhole className="h-3.5 w-3.5" /> Dados protegidos
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                {manualPix
                  ? "Pix sujeito à conferência bancária"
                  : "Confirmação automática pelo provedor"}
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-current/10 p-6 shadow-2xl sm:p-8" style={panelStyle}>
          {!payment ? (
            <form onSubmit={submit}>
              <h2 className="text-lg font-semibold">Seus dados</h2>
              <p className="mt-1 text-sm opacity-50">
                Preencha para gerar o Pix da compra.
              </p>

              <div className="mt-6 space-y-4">
                <label className="block">
                   <span className="text-xs opacity-55">Nome completo</span>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="mt-1.5 h-11 w-full rounded-lg border border-current/10 bg-transparent px-3 text-current outline-none focus:border-[var(--checkout-primary)]"
                  />
                </label>
                <label className="block">
                   <span className="text-xs opacity-55">E-mail</span>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="mt-1.5 h-11 w-full rounded-lg border border-current/10 bg-transparent px-3 text-current outline-none focus:border-[var(--checkout-primary)]"
                  />
                </label>
                {checkout.fields.cpf && (
                  <label className="block">
                    <span className="text-xs opacity-55">CPF</span>
                    <input
                      required
                      inputMode="numeric"
                      value={form.cpf}
                      onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                      placeholder="000.000.000-00"
                      className="mt-1.5 h-11 w-full rounded-lg border border-current/10 bg-transparent px-3 text-current outline-none focus:border-[var(--checkout-primary)]"
                    />
                  </label>
                )}
                {checkout.fields.phone && (
                  <label className="block">
                    <span className="text-xs opacity-55">Telefone</span>
                    <input
                      inputMode="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="mt-1.5 h-11 w-full rounded-lg border border-current/10 bg-transparent px-3 text-current outline-none focus:border-[var(--checkout-primary)]"
                    />
                  </label>
                )}
              </div>

              <div className="mt-6 rounded-xl border p-4" style={{ borderColor: `color-mix(in srgb, ${primary} 28%, transparent)`, backgroundColor: `color-mix(in srgb, ${primary} 9%, ${secondary})` }}>
                <div className="flex items-center gap-3">
                  <QrCode className="h-5 w-5" style={{ color: primary }} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Pix</p>
                    <p className="text-xs opacity-45">
                      {manualPix
                        ? "Pix por chave · conciliação manual"
                        : "Confirmação automática quando o provedor informar o pagamento"}
                    </p>
                  </div>
                </div>
              </div>

              {(checkout.payment_methods.card || checkout.payment_methods.boleto) && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {checkout.payment_methods.card && <div className="rounded-lg border border-current/10 px-3 py-2 text-xs opacity-35">Cartão</div>}
                  {checkout.payment_methods.boleto && <div className="rounded-lg border border-current/10 px-3 py-2 text-xs opacity-35">Boleto</div>}
                </div>
              )}

              {payError && (
                <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {payError}
                </p>
              )}

              <button
                type="submit"
                disabled={paying || !checkout.payment_methods.pix}
                className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: primary, color: text }}
              >
                {paying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Gerando Pix...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    {checkout.theme.button_text || "Gerar Pix"} · {formatBRL(visualTotal)}
                  </>
                )}
              </button>
              {!checkout.payment_methods.pix && (
                <p className="mt-3 text-center text-xs text-amber-300">
                  Pix está indisponível neste checkout.
                </p>
              )}
            </form>
          ) : isPaid ? (
            <div className="py-8 text-center">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
                <CheckCircle2 className="h-8 w-8" />
              </span>
              <h2 className="mt-5 text-2xl font-semibold">Pagamento confirmado</h2>
              <p className="mt-2 text-sm opacity-55">
                O recebimento foi confirmado e o pedido foi atualizado.
              </p>
              {payment.order_id && (
                <p className="mt-2 font-mono text-[11px] opacity-30">
                  Pedido {payment.order_id}
                </p>
              )}
              {payment.success_url && (
                <a
                  href={payment.success_url}
                  className="mt-6 inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-semibold hover:opacity-90"
                  style={{ backgroundColor: primary, color: text }}
                >
                  Continuar
                </a>
              )}
            </div>
          ) : (
            <div>
              <div className="text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl" style={{ backgroundColor: `color-mix(in srgb, ${primary} 12%, transparent)`, color: primary }}>
                  <QrCode className="h-6 w-6" />
                </span>
                <h2 className="mt-4 text-xl font-semibold">Pix gerado</h2>
                <p className="mt-1 text-sm opacity-50">
                  Escaneie o QR Code ou copie o código abaixo.
                </p>
              </div>

              <div className="mt-5 grid gap-2 rounded-xl border border-current/10 p-4 text-sm" style={subtlePanelStyle}>
                <div className="flex items-center justify-between gap-4">
                  <span className="opacity-45">Valor</span>
                  <strong>{formatBRL(displayedPaymentAmount)}</strong>
                </div>
                {payment.receiver_name && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="opacity-45">Recebedor</span>
                    <span className="text-right">{payment.receiver_name}</span>
                  </div>
                )}
                {payment.receiver_city && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="opacity-45">Cidade</span>
                    <span className="text-right">{payment.receiver_city}</span>
                  </div>
                )}
              </div>

              {payment.pix?.qr_code_base64 && (
                <div className="mx-auto mt-6 w-fit rounded-2xl bg-white p-3">
                  <img
                    src={`data:image/png;base64,${payment.pix.qr_code_base64}`}
                    alt="QR Code Pix"
                    className="h-56 w-56"
                  />
                </div>
              )}

              {payment.pix?.qr_code && (
                <div className="mt-5 rounded-xl border border-current/10 p-3" style={subtlePanelStyle}>
                  <p className="line-clamp-3 break-all font-mono text-[11px] leading-5 opacity-55">
                    {payment.pix.qr_code}
                  </p>
                  <button
                    onClick={copyPix}
                    className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-current/10 text-sm font-medium hover:opacity-80"
                  >
                    {copied ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {copied ? "Copiado" : "Copiar Pix copia e cola"}
                  </button>
                </div>
              )}

              <div
                className={
                  "mt-5 rounded-xl border p-4 " +
                  (isFailed
                    ? "border-red-500/20 bg-red-500/[0.07]"
                    : "border-amber-500/20 bg-amber-500/[0.06]")
                }
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  {!isFailed && <Loader2 className="h-4 w-4 animate-spin text-amber-300" />}
                  {isFailed
                    ? "Pagamento não concluído"
                    : payment.manual_confirmation
                      ? "Aguardando conferência"
                      : "Aguardando confirmação do pagamento"}
                </div>
                <p className="mt-1 text-xs opacity-45">
                  {payment.manual_confirmation
                    ? "Gerar ou copiar o Pix não marca a venda como paga. A confirmação depende da conciliação bancária."
                    : "A situação será atualizada quando o provedor confirmar o recebimento."}
                </p>
                <p className="mt-2 text-[11px] opacity-35">
                  Status: {currentStatus ?? "pendente"}
                </p>
              </div>

              {isFailed && (
                <button
                  onClick={() => {
                    setPayment(null);
                    setPaymentStatus(null);
                    setPayError(null);
                    idempotencyKeyRef.current = null;
                  }}
                  className="mt-4 h-11 w-full rounded-lg border border-current/10 text-sm font-medium hover:opacity-80"
                >
                  Tentar novamente
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      <footer className="mx-auto mt-6 flex max-w-5xl flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center text-[11px] opacity-35">
        <span className="inline-flex items-center gap-2"><Zap className="h-3 w-3" style={{ color: primary }} /> Cash Engine PRO · infraestrutura de pagamentos</span>
        {checkout.legal.terms_url && <a href={checkout.legal.terms_url} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline" style={{ color: primary }}>Termos</a>}
        {checkout.legal.privacy_url && <a href={checkout.legal.privacy_url} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline" style={{ color: primary }}>Privacidade</a>}
      </footer>
    </main>
  );
}
