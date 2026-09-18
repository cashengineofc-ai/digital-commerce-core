import { motion, useReducedMotion } from "motion/react";
import { CheckCircle2, CreditCard, Users, Wallet } from "lucide-react";

const bars = [42, 58, 36, 74, 51, 88, 66, 95];

/** Interface ilustrativa da página institucional; não representa dados de operação. */
export function DashboardPreview() {
  const reduced = useReducedMotion();

  return (
    <div className="surface-card relative overflow-hidden rounded-2xl p-4 shadow-2xl sm:p-6">
      <div className="pointer-events-none absolute inset-0 tech-grid opacity-40" />
      <div className="relative">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Visão geral da operação
            </p>
            <p className="truncate font-display text-lg font-semibold">Dashboard</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            prévia da interface
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Metric
            icon={<Wallet className="h-4 w-4" />}
            label="Saldo e extrato"
          />
          <Metric icon={<CreditCard className="h-4 w-4" />} label="Transações" />
          <Metric
            icon={<Users className="h-4 w-4" />}
            label="Afiliados e equipe"
          />
        </div>

        <div className="mt-4 rounded-xl border border-border bg-surface-strong/60 p-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <p className="min-w-0 truncate text-sm text-muted-foreground">
              Visão consolidada da operação
            </p>
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Dados reais após login
            </span>
          </div>

          <svg
            viewBox="0 0 320 96"
            className="mt-4 h-24 w-full"
            role="img"
              aria-label="Ilustração de atividade da operação"
          >
            <defs>
              <linearGradient id="ce-line" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--primary)" />
                <stop offset="100%" stopColor="var(--primary-soft)" />
              </linearGradient>
            </defs>
            <motion.path
              d="M0 78 C 40 70, 56 40, 92 46 S 150 74, 182 44 S 240 18, 276 26 S 310 12, 320 8"
              fill="none"
              stroke="url(#ce-line)"
              strokeWidth="2.5"
              strokeLinecap="round"
              initial={reduced ? false : { pathLength: 0 }}
              animate={reduced ? { pathLength: 1 } : { pathLength: [0.08, 1, 0.92, 1] }}
              {...(reduced
                ? {}
                : { transition: { duration: 4.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 0.8 } })}
            />
          </svg>

          <div className="mt-4 flex h-16 items-end gap-1.5">
            {bars.map((h, i) => (
              <motion.span
                key={i}
                className="flex-1 rounded-sm bg-primary/45"
                initial={reduced ? { height: `${h}%` } : { height: 0 }}
                animate={
                  reduced
                    ? { height: `${h}%` }
                    : { height: [`${Math.max(h - 10, 18)}%`, `${h}%`, `${Math.min(h + 5, 100)}%`, `${h}%`] }
                }
                {...(reduced
                  ? {}
                  : { transition: { duration: 3.2, delay: 0.12 * i, ease: "easeInOut", repeat: Infinity, repeatDelay: 0.6 } })}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface/70 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="text-primary-soft">{icon}</span>
        <span className="truncate text-xs">{label}</span>
      </div>
      <p className="mt-2 font-display text-base font-semibold sm:text-lg">
        Consulte no painel
      </p>
    </div>
  );
}
