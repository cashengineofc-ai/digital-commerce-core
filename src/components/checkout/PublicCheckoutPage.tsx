import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Copy,
  CreditCard,
  FileText,
  Loader2,
  LockKeyhole,
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
  offer_id: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  offer_text: string | null;
  amount: number;
  presentation: Record<string, unknown>;
  combination_rules: Record<string, unknown>;
};

type CheckoutData = {
  checkout: {
    id: string;
    slug: string;
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
  pix_mode: "desativado" | "chave" | "provedor";
  pix_confirmation: "manual" | "automatic" | null;
  pix_unavailable_reason: string | null;
  fields: { cpf: boolean; phone: boolean; address: boolean };
  theme: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
    logo_url: string | null;
    title: string;
    subtitle: string | null;
    button_text?: string;
    font?: string;
  };
};

type PaymentResult = {
  ok: boolean;
  duplicate?: boolean;
  order_id: string;
  transaction_id: string;
  payment_id: string;
  status: string;
  status_detail: string | null;
  amount: number;
  receiver_name?: string | null;
  receiver_city?: string | null;
  manual_confirmation: boolean;
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
  offer_unavailable: "Esta oferta não está disponível.",
  product_unavailable: "O produto não está disponível para compra.",
  payer_name_and_email_required: "Preencha seu nome e e-mail.",
  valid_cpf_required: "Informe um CPF válido com 11 dígitos.",
  pix_not_configured: "O Pix ainda não está configurado para este checkout.",
  mercadopago_not_configured: "A integração do provedor Pix ainda não está configurada.",
  payment_method_unavailable: "Este meio de pagamento ainda não está disponível.",
  invalid_order_bumps: "Uma das ofertas adicionais selecionadas não está mais disponível.",
  invalid_order_bump_ids: "As ofertas adicionais selecionadas são inválidas.",
  order_create_failed: "Não foi possível criar o pedido. Revise os dados e tente novamente.",
  payment_rejected_by_gateway: "O provedor não conseguiu criar o pagamento Pix.",
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
    const initialStatus = paymentStatus ?? payment.status;
    if (paidStatuses.has(initialStatus) || terminalFailureStatuses.has(initialStatus)) return;

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
        // A fonte de verdade continua sendo o backend. Falha de polling não aprova pagamento.
      }
    };

    void poll();
    const interval = window.setInterval(poll, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [payment?.transaction_id, payment?.status, paymentStatus]);

  const currentStatus = paymentStatus ?? payment?.status ?? null;
  const isPaid = currentStatus ? paidStatuses.has(currentStatus) : false;
  const isFailed = currentStatus ? terminalFailureStatuses.has(currentStatus) : false;

  const baseAmount = useMemo(() => {
    if (!checkout) return 0;
    if (!checkout.checkout.allow_custom_amount) return Number(checkout.product.amount ?? 0);
    const parsed = Number(customAmount.replace(",", "."));
    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : Number(checkout.product.amount ?? 0);
  }, [checkout, customAmount]);

  const selectedBumpRows = useMemo(() => {
    if (!checkout) return [];
    return checkout.order_bumps.filter((bump) => selectedBumps.has(bump.id));
  }, [checkout, selectedBumps]);

  const visualTotal = useMemo(
    () => baseAmount + selectedBumpRows.reduce((sum, bump) => sum + Number(bump.amount || 0), 0),
    [baseAmount, selectedBumpRows],
  );

  const accent = checkout?.theme.primary || "#2563eb";
  const manualPix = checkout?.pix_mode === "chave";

  function toggleBump(id: string) {
    setSelectedBumps((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setPayment(null);
    setPaymentStatus(null);
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
        payment_method_id: "pix",
        order_bump_ids: [...selectedBumps],
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
      idempotencyKeyRef.current = null;
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

  return (
    <main
      className="min-h-screen px-4 py-8 text-white sm:py-12"
      style={{ background: checkout.theme.background || "#05070a", fontFamily: checkout.theme.font || "Inter, sans-serif" }}
    >
      <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] shadow-2xl">
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em]" style={{ color: accent }}>
              <ShieldCheck className="h-4 w-4" /> Checkout seguro
            </div>

            {checkout.theme.logo_url && (
              <img src={checkout.theme.logo_url} alt="" className="mt-5 max-h-10 max-w-[180px] object-contain" />
            )}

            <div className="mt-5 flex gap-4">
              {(checkout.checkout.image_url || checkout.product.image_url) && (
                <img
                  src={checkout.checkout.image_url || checkout.product.image_url || ""}
                  alt={checkout.product.name}
                  className="h-20 w-20 shrink-0 rounded-xl border border-white/10 object-cover"
                />
              )}
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">{checkout.checkout.name}</h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/55">
                  {checkout.checkout.description || checkout.product.name}
                </p>
              </div>
            </div>

            {checkout.order_bumps.length > 0 && (
              <div className="mt-7 space-y-3">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/45">
                  Ofertas adicionais
                </p>
                {checkout.order_bumps.map((bump) => {
                  const checked = selectedBumps.has(bump.id);
                  return (
                    <button
                      key={bump.id}
                      type="button"
                      onClick={() => toggleBump(bump.id)}
                      aria-pressed={checked}
                      className="flex w-full items-start gap-3 rounded-xl border p-4 text-left transition hover:bg-white/[0.05]"
                      style={{ borderColor: checked ? accent : "rgba(255,255,255,0.1)" }}
                    >
                      <span
                        className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border text-xs"
                        style={checked ? { backgroundColor: accent, borderColor: accent } : { borderColor: "rgba(255,255,255,.2)" }}
                      >
                        {checked ? "✓" : ""}
                      </span>
                      {bump.image_url && (
                        <img src={bump.image_url} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-3">
                          <span className="font-medium text-white">{bump.name}</span>
                          <strong className="whitespace-nowrap text-sm">+ {formatBRL(Number(bump.amount))}</strong>
                        </span>
                        {bump.offer_text && <span className="mt-1 block text-xs font-medium" style={{ color: accent }}>{bump.offer_text}</span>}
                        {bump.description && <span className="mt-1 block text-xs leading-5 text-white/45">{bump.description}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-8 rounded-xl border border-white/10 bg-black/20 p-5">
              <div className="flex items-center justify-between gap-4 text-sm text-white/55">
                <span>Produto principal</span>
                <span className="tabular-nums">{formatBRL(baseAmount)}</span>
              </div>
              {selectedBumpRows.map((bump) => (
                <div key={bump.id} className="mt-2 flex items-center justify-between gap-4 text-sm text-white/55">
                  <span className="truncate">{bump.name}</span>
                  <span className="tabular-nums">{formatBRL(Number(bump.amount))}</span>
                </div>
              ))}
              {checkout.checkout.allow_custom_amount && (
                <div className="mt-4">
                  <label className="text-xs text-white/55">Valor do produto principal</label>
                  <input
                    inputMode="decimal"
                    value={customAmount}
                    onChange={(event) => {
                      setCustomAmount(event.target.value);
                      idempotencyKeyRef.current = null;
                    }}
                    className="mt-1.5 h-11 w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 text-white outline-none focus:border-blue-500/60"
                  />
                </div>
              )}
              <div className="mt-4 flex items-center justify-between gap-4 border-t border-white/10 pt-4">
                <span className="text-sm text-white/70">Total</span>
                <strong className="text-2xl tabular-nums">{formatBRL(visualTotal)}</strong>
              </div>
              <p className="mt-2 text-[11px] text-white/35">O valor final é recalculado e validado no servidor antes da geração do Pix.</p>
            </div>

            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/45">
              <span className="inline-flex items-center gap-1.5"><LockKeyhole className="h-3.5 w-3.5" /> Dados protegidos</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> {manualPix ? "Pix por chave · conciliação manual" : "Pix com confirmação por provedor"}</span>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.045] p-6 shadow-2xl sm:p-8">
          {!payment ? (
            <form onSubmit={submit}>
              <h2 className="text-lg font-semibold">{checkout.theme.title || "Seus dados"}</h2>
              <p className="mt-1 text-sm text-white/50">{checkout.theme.subtitle || "Preencha os dados para gerar o Pix da compra."}</p>

              <div className="mt-6 space-y-4">
                <label className="block">
                  <span className="text-xs text-white/55">Nome completo</span>
                  <input required autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5 h-11 w-full rounded-lg border border-white/10 bg-black/20 px-3 outline-none focus:border-blue-500/60" />
                </label>
                <label className="block">
                  <span className="text-xs text-white/55">E-mail</span>
                  <input required type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1.5 h-11 w-full rounded-lg border border-white/10 bg-black/20 px-3 outline-none focus:border-blue-500/60" />
                </label>
                {checkout.fields.cpf && (
                  <label className="block">
                    <span className="text-xs text-white/55">CPF</span>
                    <input required inputMode="numeric" autoComplete="off" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" className="mt-1.5 h-11 w-full rounded-lg border border-white/10 bg-black/20 px-3 outline-none focus:border-blue-500/60" />
                  </label>
                )}
                {checkout.fields.phone && (
                  <label className="block">
                    <span className="text-xs text-white/55">Telefone</span>
                    <input inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1.5 h-11 w-full rounded-lg border border-white/10 bg-black/20 px-3 outline-none focus:border-blue-500/60" />
                  </label>
                )}
              </div>

              <div className="mt-6 grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-blue-500/30 bg-blue-500/[0.08] p-3 text-center">
                  <QrCode className="mx-auto h-5 w-5 text-blue-400" />
                  <p className="mt-2 text-xs font-medium">Pix</p>
                  <p className="mt-1 text-[10px] text-white/40">{manualPix ? "Conferência manual" : "Confirmação automática"}</p>
                </div>
                <div aria-disabled="true" className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center opacity-45">
                  <CreditCard className="mx-auto h-5 w-5" />
                  <p className="mt-2 text-xs font-medium">Cartão</p>
                  <p className="mt-1 text-[10px] text-white/45">Em breve</p>
                </div>
                <div aria-disabled="true" className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-center opacity-45">
                  <FileText className="mx-auto h-5 w-5" />
                  <p className="mt-2 text-xs font-medium">Boleto</p>
                  <p className="mt-1 text-[10px] text-white/45">Em breve</p>
                </div>
              </div>

              {manualPix && (
                <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-xs leading-5 text-amber-100/75">
                  Este Pix usa uma chave configurada pela administração. A geração do QR Code não confirma a venda; o status permanece aguardando conferência bancária.
                </p>
              )}

              {payError && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{payError}</p>}

              <button
                type="submit"
                disabled={paying || !checkout.payment_methods.pix}
                className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: accent }}
              >
                {paying ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando Pix...</> : <>{checkout.theme.button_text || "Gerar Pix"} · {formatBRL(visualTotal)}</>}
              </button>

              {!checkout.payment_methods.pix && (
                <p className="mt-3 text-center text-xs text-amber-300">Pix está indisponível até a administração concluir a configuração real.</p>
              )}
            </form>
          ) : isPaid ? (
            <div className="py-8 text-center">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-400"><CheckCircle2 className="h-8 w-8" /></span>
              <h2 className="mt-5 text-2xl font-semibold">Pagamento confirmado</h2>
              <p className="mt-2 text-sm text-white/55">A confirmação real foi registrada no sistema.</p>
              {payment.success_url && <a href={payment.success_url} className="mt-6 inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-semibold text-white" style={{ backgroundColor: accent }}>Continuar</a>}
            </div>
          ) : (
            <div>
              <div className="text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-blue-500/10 text-blue-400"><QrCode className="h-6 w-6" /></span>
                <h2 className="mt-4 text-xl font-semibold">Pix gerado</h2>
                <p className="mt-1 text-sm text-white/50">Escaneie o QR Code ou copie o código abaixo.</p>
              </div>

              <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-4"><span className="text-xs text-white/50">Valor</span><strong>{formatBRL(Number(payment.amount))}</strong></div>
                {payment.receiver_name && <div className="mt-2 flex items-center justify-between gap-4"><span className="text-xs text-white/50">Recebedor</span><span className="text-right text-sm">{payment.receiver_name}</span></div>}
                {payment.receiver_city && <div className="mt-2 flex items-center justify-between gap-4"><span className="text-xs text-white/50">Cidade</span><span className="text-sm">{payment.receiver_city}</span></div>}
              </div>

              {payment.pix?.qr_code_base64 && (
                <div className="mx-auto mt-6 w-fit rounded-2xl bg-white p-3">
                  <img src={`data:image/png;base64,${payment.pix.qr_code_base64}`} alt="QR Code Pix" className="h-56 w-56" />
                </div>
              )}

              {payment.pix?.qr_code && (
                <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="line-clamp-3 break-all font-mono text-[11px] leading-5 text-white/55">{payment.pix.qr_code}</p>
                  <button type="button" onClick={copyPix} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] text-sm font-medium hover:bg-white/[0.08]">
                    {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copiado" : "Copiar Pix copia e cola"}
                  </button>
                </div>
              )}

              <div className={`mt-5 rounded-xl border p-4 ${isFailed ? "border-red-500/20 bg-red-500/[0.07]" : "border-amber-500/20 bg-amber-500/[0.06]"}`}>
                <div className="flex items-center gap-2 text-sm font-medium">
                  {!isFailed && <Loader2 className="h-4 w-4 animate-spin text-amber-300" />}
                  {isFailed ? "Pagamento não concluído" : payment.manual_confirmation ? "Aguardando conferência" : "Aguardando confirmação do provedor"}
                </div>
                <p className="mt-1 text-xs leading-5 text-white/45">
                  {payment.manual_confirmation
                    ? "Copiar, visualizar ou pagar o QR não altera o status. A venda só é confirmada após conciliação bancária documentada pela administração."
                    : "A aprovação só ocorre quando o webhook autenticado confirmar a operação."}
                </p>
                <p className="mt-1 text-[11px] text-white/35">Status: {currentStatus ?? "pendente"}</p>
              </div>

              {isFailed && (
                <button
                  type="button"
                  onClick={() => {
                    setPayment(null);
                    setPaymentStatus(null);
                    setPayError(null);
                    idempotencyKeyRef.current = null;
                  }}
                  className="mt-4 h-11 w-full rounded-lg border border-white/10 text-sm font-medium hover:bg-white/[0.05]"
                >
                  Tentar novamente
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      <p className="mx-auto mt-6 flex max-w-5xl items-center justify-center gap-2 text-center text-[11px] text-white/30">
        <Zap className="h-3 w-3" /> Cash Engine PRO · infraestrutura de pagamentos
      </p>
    </main>
  );
}
