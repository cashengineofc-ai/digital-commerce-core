import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import { Calculator, CreditCard, ShoppingBag, TrendingUp } from "lucide-react";
import { periods, useAppShell, type PeriodKey } from "@/components/app/app-shell-context";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatInt } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { useReducedMotion } from "motion/react";

type Point = {
  bucket_start: string;
  label: string;
  volume: number;
  sales: number;
  ticket: number;
};

function periodWindow(period: PeriodKey) {
  const end = new Date();
  if (period === "hoje") {
    const start = new Date(end);
    start.setHours(0, 0, 0, 0);
    return { start, end, granularity: "hour" as const };
  }
  const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 365;
  return {
    start: new Date(end.getTime() - days * 86400000),
    end,
    granularity: period === "12m" ? ("month" as const) : ("day" as const),
  };
}

function labelForBucket(value: string, granularity: "hour" | "day" | "month") {
  const date = new Date(value);
  if (granularity === "hour") return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (granularity === "month") return date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function ChartTooltip({ active, payload, label, metric }: TooltipProps<number, string> & { metric: "volume" | "sales" | "ticket" }) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as Point;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">{metric === "sales" ? formatInt(point.sales) + " vendas" : formatBRL(point[metric])}</p>
      <p className="text-xs text-muted-foreground">{formatInt(point.sales)} vendas</p>
    </div>
  );
}

function MiniKpi({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: string; hint: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-background/60 p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-foreground">{value}</p>
        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

export function SalesChart() {
  const [metric, setMetric] = useState<"volume" | "sales" | "ticket">("volume");
  const [loadError, setLoadError] = useState(false);
  const reducedMotion = useReducedMotion();
  const { period, setPeriod } = useAppShell();
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let active = true;
    const { start, end, granularity } = periodWindow(period);
    setLoading(true);
    setLoadError(false);
    setData([]);

    (async () => {
      try {
      const { data: rows, error } = await (supabase as any).rpc("fn_dashboard_series", {
        p_inicio: start.toISOString(),
        p_fim: end.toISOString(),
        p_granularidade: granularity,
      });

      if (!active) return;
      if (error) {
        setLoadError(true);
        console.error("Falha ao carregar série do dashboard", error);
        setData([]);
      } else {
        setData(
          (rows ?? []).map((row: any) => ({
            bucket_start: row.bucket_start,
            label: labelForBucket(row.bucket_start, granularity),
            volume: Number(row.volume ?? 0),
            sales: Number(row.sales ?? 0),
            ticket: Number(row.sales ?? 0) > 0 ? Number(row.volume ?? 0) / Number(row.sales) : 0,
          })),
        );
      }
      } catch {
        if (active) { setLoadError(true); setData([]); }
      } finally { if (active) setLoading(false); }
    })();

    return () => {
      active = false;
    };
  }, [period]);

  const totalRevenue = useMemo(() => data.reduce((acc, point) => acc + point.volume, 0), [data]);
  const totalSales = useMemo(() => data.reduce((acc, point) => acc + point.sales, 0), [data]);
  const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;
  const activeDays = data.filter((point) => point.sales > 0).length;
  const tickInterval = Math.max(0, Math.floor(data.length / 7) - 1);

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">Evolução de faturamento</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading ? "Carregando o período selecionado…" : loadError ? "Dados indisponíveis no momento" : `${formatBRL(totalRevenue)} processados no período`}
          </p>
        </div>

        <div className="flex max-w-full flex-wrap rounded-lg border border-border bg-muted/60 p-0.5">
          {periods.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={period === item.key}
              onClick={() => setPeriod(item.key as PeriodKey)}
              className={cn(
                "rounded-[7px] px-3 py-1.5 text-xs font-medium transition-colors",
                period === item.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {!loading && !loadError && <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MiniKpi icon={CreditCard} label="Faturamento bruto" value={formatBRL(totalRevenue)} hint="Pagamentos aprovados" />
        <MiniKpi icon={ShoppingBag} label="Número de vendas" value={formatInt(totalSales)} hint="Transações aprovadas" />
        <MiniKpi icon={Calculator} label="Ticket médio" value={formatBRL(avgTicket)} hint="Valor médio por venda" />
        <MiniKpi icon={TrendingUp} label="Períodos ativos" value={formatInt(activeDays)} hint="Faixas com pelo menos 1 venda" />
      </div>}

      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Métrica do gráfico">
        {([{ key: "volume", label: "Faturamento bruto" }, { key: "sales", label: "Vendas" }, { key: "ticket", label: "Ticket médio" }] as const).map(item => <button key={item.key} type="button" aria-pressed={metric === item.key} onClick={() => setMetric(item.key)} className={cn("rounded-lg border px-3 py-2 text-xs transition-colors", metric === item.key ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted")}>{item.label}</button>)}

      </div>
      <div className="mt-6 h-[320px] w-full">
        {loading ? (
          <div className="h-full w-full animate-pulse rounded-lg bg-muted/50" />
        ) : loadError ? <div role="alert" className="grid h-full place-items-center rounded-xl border border-destructive/20 p-6 text-center text-sm text-destructive">Não foi possível consultar o gráfico. Tente selecionar o período novamente.</div> : mounted && data.length > 0 && totalSales > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="volumeFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="4 6" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} interval={tickInterval} tickMargin={12} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
              <YAxis allowDecimals={metric !== "sales"} axisLine={false} tickLine={false} width={78} tickMargin={8} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} tickFormatter={(value: number) => metric === "sales" ? formatInt(value) : formatBRL(value, { compact: true }).replace(/ /g, "\u00a0")} />
              <Tooltip content={<ChartTooltip metric={metric} />} cursor={{ stroke: "var(--color-primary)", strokeOpacity: 0.35, strokeWidth: 1 }} />
              <Area isAnimationActive={!reducedMotion} type="monotone" dataKey={metric} stroke="var(--color-primary)" strokeWidth={2.2} fill="url(#volumeFill)" activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-card)" }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="grid h-full place-items-center rounded-lg border border-dashed border-border bg-muted/20 text-center">
            <div><p className="text-sm font-medium text-foreground">Nenhuma venda no período</p><p className="mt-1 text-xs text-muted-foreground">O gráfico será preenchido quando pagamentos forem aprovados.</p></div>
          </div>
        )}
      </div>
    </section>
  );
}
