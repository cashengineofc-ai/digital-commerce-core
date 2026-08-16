import { useMemo, useState } from "react";
import { Link2, Plus, Search } from "lucide-react";
import { paymentLinks, type PaymentLink } from "@/lib/mock/data";
import { formatBRL, formatDateTime, formatInt, formatPct } from "@/lib/format";
import { TableSkeleton, useFakeLoading } from "@/components/app/Skeletons";
import { EmptyState } from "@/components/app/EmptyState";

export function PaymentLinksPage() {
  const loading = useFakeLoading();
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return paymentLinks.filter(
      (l) =>
        !q ||
        l.code.toLowerCase().includes(q) ||
        l.product.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q),
    );
  }, [query]);

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
        <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90">
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
            placeholder="Buscar por código ou produto"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/15"
          />
        </div>
      </div>

      <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {loading ? (
          <TableSkeleton rows={6} cols={8} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Link2}
            title="Nenhum link de pagamento encontrado"
            description="Crie um link curto para compartilhar em qualquer canal e começar a vender."
            action={
              <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                Criar link
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Link</th>
                  <th className="px-5 py-3 font-medium">Produto</th>
                  <th className="px-5 py-3 text-right font-medium">Valor</th>
                  <th className="px-5 py-3 text-right font-medium">Cliques</th>
                  <th className="px-5 py-3 text-right font-medium">Vendas</th>
                  <th className="px-5 py-3 text-right font-medium">Conversão</th>
                  <th className="px-5 py-3 text-right font-medium">Receita</th>
                  <th className="px-5 py-3 font-medium">Expira em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((l: PaymentLink) => (
                  <tr key={l.id} className="transition-colors hover:bg-muted/50">
                    <td className="px-5 py-3.5">
                      <p className="font-mono text-xs font-medium text-primary">{l.code}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{l.id}</p>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-foreground">{l.product}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-foreground">
                      {formatBRL(l.amount)}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-muted-foreground">
                      {formatInt(l.clicks)}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-muted-foreground">
                      {formatInt(l.sales)}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-muted-foreground">
                      {formatPct(l.conversion)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold tabular-nums text-foreground">
                      {formatBRL(l.revenue)}
                    </td>
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
