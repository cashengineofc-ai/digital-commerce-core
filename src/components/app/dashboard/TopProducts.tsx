import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { useAppShell, type PeriodKey } from "@/components/app/app-shell-context";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatInt } from "@/lib/format";

type ProductRow = {
  product_id: string;
  product_name: string;
  sales: number;
  revenue: number;
  commission_rate: number;
};

function periodWindow(period: PeriodKey) {
  const end = new Date();
  if (period === "hoje") {
    const start = new Date(end);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }
  const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 365;
  return { start: new Date(end.getTime() - days * 86400000), end };
}

export function TopProducts() {
  const { period } = useAppShell();
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const { start, end } = periodWindow(period);
    setLoading(true);

    (async () => {
      const { data, error } = await (supabase as any).rpc("fn_dashboard_top_products", {
        p_inicio: start.toISOString(),
        p_fim: end.toISOString(),
        p_limit: 5,
      });

      if (!active) return;
      if (error) {
        console.error("Falha ao carregar top produtos", error);
        setRows([]);
      } else {
        setRows(
          (data ?? []).map((item: any) => ({
            product_id: item.product_id,
            product_name: item.product_name,
            sales: Number(item.sales ?? 0),
            revenue: Number(item.revenue ?? 0),
            commission_rate: Number(item.commission_rate ?? 0),
          })),
        );
      }
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [period]);

  const max = Math.max(rows[0]?.revenue ?? 0, 1);

  return (
    <section className="flex flex-col rounded-xl border border-border bg-card shadow-sm">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Top produtos</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Por receita real no período</p>
        </div>
        <Link to="/app/produtos" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          Ver todos <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      {loading ? (
        <div className="space-y-3 p-5">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-14 animate-pulse rounded-lg bg-muted/60" />)}</div>
      ) : rows.length ? (
        <ul className="divide-y divide-border">
          {rows.map((product, index) => (
            <li key={product.product_id} className="px-5 py-3.5 transition-colors hover:bg-muted/50">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-semibold text-muted-foreground">{index + 1}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{product.product_name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatInt(product.sales)} vendas · {product.commission_rate.toFixed(1)}% de comissão</p>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{formatBRL(product.revenue, { compact: true })}</span>
              </div>
              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(8, (product.revenue / max) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid min-h-48 place-items-center p-6 text-center">
          <div><p className="text-sm font-medium text-foreground">Sem produtos vendidos no período</p><p className="mt-1 text-xs text-muted-foreground">O ranking será preenchido com vendas aprovadas.</p></div>
        </div>
      )}
    </section>
  );
}
