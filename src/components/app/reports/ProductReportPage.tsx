import { useMemo, useState } from "react";
import { products, type Product } from "@/lib/mock/data";
import { formatBRL, formatInt, formatPct } from "@/lib/format";
import { EmptyState } from "@/components/app/EmptyState";
import { cn } from "@/lib/utils";
import { Package } from "lucide-react";

const statusOptions = ["todos", "ativo", "pausado", "rascunho"] as const;
type StatusFilter = (typeof statusOptions)[number];

function StatusPill({ status }: { status: Product["status"] }) {
  const map: Record<Product["status"], string> = {
    ativo: "bg-emerald-500/10 text-emerald-700",
    pausado: "bg-amber-500/10 text-amber-700",
    rascunho: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", map[status])}
    >
      {status}
    </span>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </p>
      {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

export function ProductReportPage() {
  const [status, setStatus] = useState<StatusFilter>("todos");
  const [category, setCategory] = useState<string>("todas");

  const rows = useMemo(() => {
    return products.filter((p) => {
      if (status !== "todos" && p.status !== status) return false;
      return true;
    });
  }, [status]);

  const ativos = products.filter((p) => p.status === "ativo").length;
  const receitaTotal = products.reduce((acc, p) => acc + p.revenue, 0);
  const vendasTotal = products.reduce((acc, p) => acc + p.sales, 0);
  const ticketMedio = vendasTotal > 0 ? receitaTotal / vendasTotal : 0;
  const comissaoMedia = products.reduce((acc, p) => acc + p.commission, 0) / (products.length || 1);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Relatório de Produtos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Top produtos, ticket médio, comissão e participação na receita.
          </p>
        </div>
      </header>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Produtos ativos" value={formatInt(ativos)} sub="No catálogo publicado" />
        <KpiCard label="Receita total" value={formatBRL(1115296.6)} sub="Período selecionado" />
        <KpiCard label="Ticket médio" value={formatBRL(ticketMedio)} sub="Por venda aprovada" />
        <KpiCard
          label="Comissão média"
          value={formatPct(comissaoMedia, 0)}
          sub="Base de afiliados"
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="flex flex-wrap gap-1.5">
          {statusOptions.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition",
                status === s
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground outline-none focus:border-primary/60"
          >
            <option value="todas">Todas as categorias</option>
            <option value="curso">Cursos</option>
            <option value="mentoria">Mentorias</option>
            <option value="comunidade">Comunidades</option>
            <option value="pack">Packs e templates</option>
          </select>
        </div>
      </div>

      <section className="mt-5 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {rows.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Nenhum produto encontrado"
            description="Ajuste os filtros de status ou categoria para visualizar mais resultados."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Produto</th>
                  <th className="px-5 py-3 text-right font-medium">Preço</th>
                  <th className="px-5 py-3 text-right font-medium">Comissão</th>
                  <th className="px-5 py-3 text-right font-medium">Vendas</th>
                  <th className="px-5 py-3 text-right font-medium">Receita</th>
                  <th className="px-5 py-3 text-right font-medium">% particip.</th>
                  <th className="px-5 py-3 text-right font-medium">Ticket médio</th>
                  <th className="px-5 py-3 text-right font-medium">Conversão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((p) => {
                  const pct = receitaTotal > 0 ? (p.revenue / receitaTotal) * 100 : 0;
                  const ticket = p.sales > 0 ? p.revenue / p.sales : 0;
                  const conversion = 4 + (p.id.charCodeAt(4) % 12);
                  return (
                    <tr key={p.id} className="transition-colors hover:bg-muted/40">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-foreground">{p.name}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {p.id}
                          </span>
                          <StatusPill status={p.status} />
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-foreground">
                        {formatBRL(p.price)}
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-muted-foreground">
                        {formatPct(p.commission, 0)}
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-muted-foreground">
                        {formatInt(p.sales)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold tabular-nums text-foreground">
                        {formatBRL(p.revenue)}
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-foreground">
                        {formatPct(pct)}
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-muted-foreground">
                        {formatBRL(ticket)}
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-foreground">
                        {formatPct(conversion)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
