import { useEffect, useMemo, useState } from "react";
import { Copy, Link2, Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateTime, formatInt } from "@/lib/format";
import { TableSkeleton } from "@/components/app/Skeletons";
import { EmptyState } from "@/components/app/EmptyState";

type PaymentLink = {
  id: string;
  code: string;
  title: string;
  product: string;
  amount: number;
  sales: number;
  revenue: number;
  expiresAt: string | null;
  status: string;
};

const APPROVED_STATUSES = new Set(["aprovada", "autorizada", "capturada", "paga", "disponivel"]);

function makeCode() {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
}

export function PaymentLinksPage() {
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      setUserId(auth.user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (!profile?.empresa_id) return;
      setEmpresaId(profile.empresa_id);

      const [{ data: links, error: linksError }, { data: transactions, error: transactionsError }] =
        await Promise.all([
          supabase
            .from("links_pagamento")
            .select("id,codigo_unico,titulo,valor,status,data_expiracao,produtos(nome)")
            .eq("empresa_id", profile.empresa_id)
            .is("deleted_at", null)
            .order("created_at", { ascending: false }),
          supabase
            .from("transacoes")
            .select("link_pagamento_id,valor_bruto,status")
            .eq("empresa_id", profile.empresa_id)
            .not("link_pagamento_id", "is", null),
        ]);

      if (linksError) throw linksError;
      if (transactionsError) throw transactionsError;

      const metrics = new Map<string, { sales: number; revenue: number }>();
      for (const transaction of transactions ?? []) {
        if (!transaction.link_pagamento_id || !APPROVED_STATUSES.has(String(transaction.status))) continue;
        const current = metrics.get(transaction.link_pagamento_id) ?? { sales: 0, revenue: 0 };
        current.sales += 1;
        current.revenue += Number(transaction.valor_bruto ?? 0);
        metrics.set(transaction.link_pagamento_id, current);
      }

      setPaymentLinks(
        ((links ?? []) as unknown as Array<any>).map((row) => {
          const metric = metrics.get(row.id) ?? { sales: 0, revenue: 0 };
          return {
            id: row.id,
            code: row.codigo_unico,
            title: row.titulo,
            product: row.produtos?.nome ?? row.titulo,
            amount: Number(row.valor ?? 0),
            sales: metric.sales,
            revenue: metric.revenue,
            expiresAt: row.data_expiracao ?? null,
            status: row.status,
          };
        }),
      );
    } catch (error) {
      console.error("Falha ao carregar links de pagamento", error);
      setPaymentLinks([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return paymentLinks.filter(
      (l) =>
        !q ||
        l.code.toLowerCase().includes(q) ||
        l.product.toLowerCase().includes(q) ||
        l.title.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q),
    );
  }, [paymentLinks, query]);

  async function createLink() {
    if (!empresaId || !userId) return;
    const title = window.prompt("Título do link de pagamento");
    if (!title?.trim()) return;
    const rawValue = window.prompt("Valor do link em reais (ex.: 97,00)", "0,00");
    if (rawValue === null) return;
    const value = Number(rawValue.replace(".", "").replace(",", "."));
    if (!Number.isFinite(value) || value < 0) {
      window.alert("Informe um valor válido.");
      return;
    }

    const { error } = await supabase.from("links_pagamento").insert({
      empresa_id: empresaId,
      criado_por: userId,
      titulo: title.trim(),
      codigo_unico: makeCode(),
      valor: value,
      tipo: "simples",
      status: "ativo",
    });

    if (error) {
      console.error("Falha ao criar link", error);
      window.alert("Não foi possível criar o link de pagamento.");
      return;
    }
    await load();
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
    } catch (error) {
      console.error("Falha ao copiar código", error);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Links de pagamento
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Links curtos para compartilhar vendas em redes, WhatsApp ou e-mail.
          </p>
        </div>
        <button
          onClick={createLink}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Criar link
        </button>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por código, título ou produto"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/15"
          />
        </div>
      </div>

      <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {loading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Link2}
            title="Nenhum link de pagamento encontrado"
            description="Crie um link real para compartilhar em qualquer canal e acompanhar as vendas registradas por ele."
            action={
              <button
                onClick={createLink}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                Criar link
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Link</th>
                  <th className="px-5 py-3 font-medium">Produto / título</th>
                  <th className="px-5 py-3 text-right font-medium">Valor</th>
                  <th className="px-5 py-3 text-right font-medium">Vendas</th>
                  <th className="px-5 py-3 text-right font-medium">Receita</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Expira em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((l) => (
                  <tr key={l.id} className="transition-colors hover:bg-muted/50">
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => copyCode(l.code)}
                        className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-primary hover:underline"
                        title="Copiar código"
                      >
                        {l.code}
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <p className="mt-0.5 text-xs text-muted-foreground">{l.id}</p>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-foreground">{l.product}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-foreground">
                      {formatBRL(l.amount)}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-muted-foreground">
                      {formatInt(l.sales)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold tabular-nums text-foreground">
                      {formatBRL(l.revenue)}
                    </td>
                    <td className="px-5 py-3.5 capitalize text-muted-foreground">{l.status}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                      {l.expiresAt ? formatDateTime(l.expiresAt) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
