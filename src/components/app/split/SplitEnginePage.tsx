import { useMemo, useState } from "react";
import { ArrowRight, Building2, Handshake, Percent, ShieldCheck, UserRound } from "lucide-react";
import { splitOf, type SplitShare } from "@/lib/mock/transactions";
import { formatBRL, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";

const presets = [197, 397, 1497];

const meta: Record<
  SplitShare["key"],
  { icon: React.ElementType; bar: string; chip: string; note: string }
> = {
  produtor: {
    icon: UserRound,
    bar: "bg-primary",
    chip: "bg-primary/10 text-primary",
    note: "Recebe o líquido em D+2 (Pix) ou D+30 (cartão).",
  },
  afiliado: {
    icon: Handshake,
    bar: "bg-[oklch(0.72_0.15_80)]",
    chip: "bg-[oklch(0.78_0.15_80_/_18%)] text-[oklch(0.5_0.13_75)]",
    note: "Comissão liberada junto com a liquidação da venda.",
  },
  plataforma: {
    icon: Building2,
    bar: "bg-foreground",
    chip: "bg-foreground/10 text-foreground",
    note: "Taxa da plataforma sobre o valor bruto.",
  },
  taxa: {
    icon: Percent,
    bar: "bg-muted-foreground/60",
    chip: "bg-muted text-muted-foreground",
    note: "Custo do adquirente/gateway por transação.",
  },
};

export function SplitEnginePage() {
  const [amount, setAmount] = useState(197);
  const [withAffiliate, setWithAffiliate] = useState(true);
  const shares = useMemo(() => splitOf(amount, withAffiliate), [amount, withAffiliate]);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Split Engine</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Veja exatamente como cada venda é distribuída entre produtor, afiliado e plataforma.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-success" />
          Split automático em tempo real
        </span>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
        <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Venda simulada
        </span>
        <div className="flex items-center gap-1.5">
          {presets.map((p) => (
            <button
              key={p}
              onClick={() => setAmount(p)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium tabular-nums transition",
                amount === p ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {formatBRL(p)}
            </button>
          ))}
        </div>
        <input
          type="range"
          min={49}
          max={2500}
          step={1}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="h-1.5 min-w-[160px] flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
          aria-label="Valor da venda"
        />
        <button
          onClick={() => setWithAffiliate((v) => !v)}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-xs font-medium transition",
            withAffiliate
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:bg-muted",
          )}
        >
          {withAffiliate ? "Com afiliado (30%)" : "Venda direta"}
        </button>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Venda bruta
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-foreground">
            {formatBRL(amount)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Método Escala 7 · Pix aprovado</p>

          <div className="mt-6 flex h-3 w-full overflow-hidden rounded-full">
            {shares.map((s) => (
              <span
                key={s.key}
                className={cn("h-full transition-all duration-500", meta[s.key].bar)}
                style={{ width: `${s.percent}%` }}
              />
            ))}
          </div>

          <ul className="mt-4 space-y-2 text-xs">
            {shares.map((s) => (
              <li key={s.key} className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <span className={cn("h-2 w-2 rounded-full", meta[s.key].bar)} />
                  {s.label}
                </span>
                <span className="tabular-nums text-foreground">{formatPct(s.percent)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Fluxo de caixa</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Uma entrada, várias saídas — liquidadas na mesma chamada.
          </p>

          <div className="mt-6 grid gap-5 md:grid-cols-[180px_1fr] md:items-center">
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                Entrada
              </p>
              <p className="mt-1.5 text-xl font-semibold tabular-nums text-foreground">
                {formatBRL(amount)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">Pagamento aprovado</p>
            </div>

            <ul className="space-y-3">
              {shares.map((s) => {
                const Icon = meta[s.key].icon;
                return (
                  <li
                    key={s.key}
                    className="flex items-center gap-3 rounded-xl border border-border bg-background p-3"
                  >
                    <ArrowRight className="hidden h-4 w-4 shrink-0 text-muted-foreground md:block" />
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        meta[s.key].chip,
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <p className="text-sm font-medium text-foreground">{s.label}</p>
                        <p className="text-sm font-semibold tabular-nums text-foreground">
                          {formatBRL(s.amount)}
                        </p>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <span
                          className={cn("block h-full rounded-full transition-all duration-500", meta[s.key].bar)}
                          style={{ width: `${s.percent}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-[11px] text-muted-foreground">{meta[s.key].note}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
