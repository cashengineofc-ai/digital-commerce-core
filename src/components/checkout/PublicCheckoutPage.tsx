import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Copy, Loader2, LockKeyhole, QrCode, ShieldCheck, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";

type CheckoutSource =
  | { checkoutSlug: string; paymentLinkCode?: never }
  | { paymentLinkCode: string; checkoutSlug?: never };

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
  payment_methods: { pix: boolean; card: boolean; boleto: boolean };
  fields: { cpf: boolean; phone: boolean; address: boolean };
  theme: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
    logo_url: string | null;
    title: string;
    subtitle: string | null;
  };
};

type PaymentResult = {
  ok: boolean;
  transaction_id: string;
  payment_id: string;
  status: string;
  status_detail: string | null;
  pix: {
    qr_code: string | null;
    qr_code_base64: string | null;
    ticket_url: string | null;
  } | null;
  success_url: string | null;
};

const paidStatuses = new Set(["aprovada", "autorizada", "capturada", "paga", "disponivel"]);
const terminalFailureStatuses = new Set(["cancelada", "rejeitada", "falhou", "expirada", "reembolsada", "chargeback"]);

const errorLabels: Record<string, string> = {
  checkout_unavailable: "Este checkout não está disponível.",
  payment_link_unavailable: "Este link de pagamento não está disponível.",
  payment_link_expired: "Este link de pagamento expirou.",
  payment_link_limit_reached: "Este link atingiu o limite de utilizações.",
  product_unavailable: "O produto não está disponível para compra.",
  invalid_checkout_amount: "O valor da compra é inválido.",
  payer_name_and_email_required: "Preencha seu nome e e-mail.",
  valid_cpf_required: "Informe um CPF válido com 11 dígitos.",
  mercadopago_not_configured: "O meio de pagamento ainda não foi configurado.",
  payment_rejected_by_gateway: "O pagamento não pôde ser criado. Revise os dados e tente novamente.",
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
  const [form, setForm] = useState({ name: "", email: "", cpf: "", phone: "" });
  const idempotencyKeyRef = useRef<string | null>(null);

  const sourceKey = "checkoutSlug" in source ? `checkout:${source.checkoutSlug}` : `link:${source.paymentLinkCode}`;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    setCheckout(null);
    setPayment(null);
    setPaymentStatus(null);
    idempotencyKeyRef.current = null;

    invokeFunction<CheckoutData>("mercadopago-checkout", {
      action: "load",
      ...sourceBody(source),
    })
      .then((data) => {
        if (!active) return;
        setCheckout(data);
        if (data.checkout.allow_custom_amount) setCustomAmount(String(data.product.amount));
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
    if (paidStatuses.has(paymentStatus ?? payment.status) || terminalFailureStatuses.has(paymentStatus ?? payment.status)) return;

    let cancelled = false;
    const transactionId = payment.transaction_id;
    const key = idempotencyKeyRef.current;

    const poll = async () => {
      try {
        const status = await invokeFunction<{ ok: boolean; status: string }>("mercadopago-payment-status", {
          transaction_id: transactionId,
          idempotency_key: key,
        });
        if (!cancelled) setPaymentStatus(status.status);
      } catch {
        // O webhook continua sendo a fonte de verdade; uma falha temporária de polling não muda o pagamento.
      }
    };

    poll();
    const interval = window.setInterval(poll, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [payment?.transaction_id, payment?.status, paymentStatus]);

  const currentStatus = paymentStatus ?? payment?.status ?? null;
  const isPaid = currentStatus ? paidStatuses.has(currentStatus) : false;
  const isFailed = currentStatus ? terminalFailureStatuses.has(currentStatus) : false;

  const amount = useMemo(() => {
    if (!checkout) return 0;
    if (!checkout.checkout.allow_custom_amount) return Number(checkout.product.amount ?? 0);
    const parsed = Number(customAmount.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : Number(checkout.product.amount ?? 0);
  }, [checkout, customAmount]);

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
        amount: checkout.checkout.allow_custom_amount ? amount : undefined,
        payment_method_id: "pix",
        idempotency_key: idempotencyKeyRef.current,
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
          <p className="mt-2 text-sm leading-6 text-white/60">{loadError ?? "Não foi possível abrir esta página."}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#05070a] px-4 py-8 text-white sm:py-12">
      <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] shadow-2xl">
          {checkout.checkout.banner_url && (
            <img src={checkout.checkout.banner_url} alt="" className="h-40 w-full object-cover" />
          )}
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-blue-400">
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
                <h1 className="text-2xl font-semibold tracking-tight">{checkout.checkout.name}</h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/55">
                  {checkout.checkout.description || checkout.product.name}
                </p>
              </div>
            </div>

            <div className="mt-8 rounded-xl border border-white/10 bg-black/20 p-5">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-white/55">Total</span>
                <strong className="text-2xl tabular-nums">{formatBRL(amount)}</strong>
              </div>
              {checkout.checkout.allow_custom_amount && (
                <div className="mt-4">
                  <label className="text-xs text-white/55">Valor</label>
                  <input
                    inputMode="decimal"
                    value={customAmount}
                    onChange={(event) => setCustomAmount(event.target.value)}
                    className="mt-1.5 h-11 w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 text-white outline-none focus:border-blue-500/60"
                  />
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/45">
              <span className="inline-flex items-center gap-1.5"><LockKeyhole className="h-3.5 w-3.5" /> Dados protegidos</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Processado pelo Mercado Pago</span>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.045] p-6 shadow-2xl sm:p-8">
          {!payment ? (
            <form onSubmit={submit}>
              <h2 className="text-lg font-semibold">Seus dados</h2>
              <p className="mt-1 text-sm text-white/50">Preencha para gerar o Pix da compra.</p>

              <div className="mt-6 space-y-4">
                <label className="block">
                  <span className="text-xs text-white/55">Nome completo</span>
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5 h-11 w-full rounded-lg border border-white/10 bg-black/20 px-3 outline-none focus:border-blue-500/60" />
                </label>
                <label className="block">
                  <span className="text-xs text-white/55">E-mail</span>
                  <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1.5 h-11 w-full rounded-lg border border-white/10 bg-black/20 px-3 outline-none focus:border-blue-500/60" />
                </label>
                {checkout.fields.cpf && (
                  <label className="block">
                    <span className="text-xs text-white/55">CPF</span>
                    <input required inputMode="numeric" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" className="mt-1.5 h-11 w-full rounded-lg border border-white/10 bg-black/20 px-3 outline-none focus:border-blue-500/60" />
                  </label>
                )}
                {checkout.fields.phone && (
                  <label className="block">
                    <span className="text-xs text-white/55">Telefone</span>
                    <input inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1.5 h-11 w-full rounded-lg border border-white/10 bg-black/20 px-3 outline-none focus:border-blue-500/60" />
                  </label>
                )}
              </div>

              <div className="mt-6 rounded-xl border border-blue-500/20 bg-blue-500/[0.07] p-4">
                <div className="flex items-center gap-3">
                  <QrCode className="h-5 w-5 text-blue-400" />
                  <div><p className="text-sm font-medium">Pix</p><p className="text-xs text-white/45">Aprovação acompanhada automaticamente</p></div>
                </div>
              </div>

              {payError && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{payError}</p>}

              <button
                type="submit"
                disabled={paying || !checkout.payment_methods.pix}
                className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {paying ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando Pix...</> : <>Pagar {formatBRL(amount)} com Pix</>}
              </button>
              {!checkout.payment_methods.pix && <p className="mt-3 text-center text-xs text-amber-300">Pix está desativado neste checkout.</p>}
            </form>
          ) : isPaid ? (
            <div className="py-8 text-center">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-400"><CheckCircle2 className="h-8 w-8" /></span>
              <h2 className="mt-5 text-2xl font-semibold">Pagamento aprovado</h2>
              <p className="mt-2 text-sm text-white/55">A confirmação foi recebida e sua compra foi registrada.</p>
              {payment.success_url && (
                <a href={payment.success_url} className="mt-6 inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-semibold hover:bg-blue-500">Continuar</a>
              )}
            </div>
          ) : (
            <div>
              <div className="text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-blue-500/10 text-blue-400"><QrCode className="h-6 w-6" /></span>
                <h2 className="mt-4 text-xl font-semibold">Pix gerado</h2>
                <p className="mt-1 text-sm text-white/50">Escaneie o QR Code ou copie o código abaixo.</p>
              </div>

              {payment.pix?.qr_code_base64 && (
                <div className="mx-auto mt-6 w-fit rounded-2xl bg-white p-3">
                  <img src={`data:image/png;base64,${payment.pix.qr_code_base64}`} alt="QR Code Pix" className="h-56 w-56" />
                </div>
              )}

              {payment.pix?.qr_code && (
                <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="line-clamp-3 break-all font-mono text-[11px] leading-5 text-white/55">{payment.pix.qr_code}</p>
                  <button onClick={copyPix} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] text-sm font-medium hover:bg-white/[0.08]">
                    {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copiado" : "Copiar Pix copia e cola"}
                  </button>
                </div>
              )}

              <div className={`mt-5 rounded-xl border p-4 ${isFailed ? "border-red-500/20 bg-red-500/[0.07]" : "border-amber-500/20 bg-amber-500/[0.06]"}`}>
                <div className="flex items-center gap-2 text-sm font-medium">
                  {!isFailed && <Loader2 className="h-4 w-4 animate-spin text-amber-300" />}
                  {isFailed ? "Pagamento não concluído" : "Aguardando pagamento"}
                </div>
                <p className="mt-1 text-xs text-white/45">Status: {currentStatus ?? "pendente"}</p>
              </div>

              {isFailed && (
                <button
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
