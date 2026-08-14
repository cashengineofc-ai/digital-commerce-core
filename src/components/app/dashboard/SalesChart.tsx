import { useEffect, useState } from "react";
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
import { periods, useAppShell, type PeriodKey } from "@/components/app/app-shell-context";
import { seriesByPeriod } from "@/lib/mock/dashboard";
import { formatBRL, formatInt } from "@/lib/format";
import { cn } from "@/lib/utils";

function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as { volume: number; sales: number };
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
        {formatBRL(point.volume)}
      </p>
      <p className="text-xs text-muted-foreground">{formatInt(point.sales)} vendas</p>
    </div>
  );
}

export function SalesChart() {
  const { period, setPeriod } = useAppShell();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const data = seriesByPeriod[period];
  const total = data.reduce((acc, p) => acc + p.volume, 0);
  const tickInterval = Math.max(0, Math.floor(data.length / 7) - 1);

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Volume de vendas
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatBRL(total)} processados no período
          </p>
        </div>

        <div className="inline-flex rounded-lg border border-border bg-muted/60 p-0.5">
          {periods.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key as PeriodKey)}
              className={cn(
                "rounded-[7px] px-3 py-1.5 text-xs font-medium transition-colors",
                period === p.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 h-[280px] w-full">
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="volumeFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.26} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke="var(--color-border)"
                strokeDasharray="4 6"
              />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                interval={tickInterval}
                tickMargin={12}
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={64}
                tickMargin={8}
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                tickFormatter={(v: number) => formatBRL(v, { compact: true })}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ stroke: "var(--color-primary)", strokeOpacity: 0.35, strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="volume"
                stroke="var(--color-primary)"
                strokeWidth={2.2}
                fill="url(#volumeFill)"
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-card)" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full w-full rounded-lg bg-muted/50" />
        )}
      </div>
    </section>
  );
}
