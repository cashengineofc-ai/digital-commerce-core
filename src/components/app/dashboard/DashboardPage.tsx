import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { CheckCircle2, CreditCard, Download, Plus, ShoppingBag, Wallet } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { periodLabel, useAppShell } from "@/components/app/app-shell-context";
import { KpiCard } from "@/components/app/dashboard/KpiCard";
import { SalesChart } from "@/components/app/dashboard/SalesChart";
import { RecentTransactions } from "@/components/app/dashboard/RecentTransactions";
import { TopProducts } from "@/components/app/dashboard/TopProducts";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatInt, formatPct } from "@/lib/format";
import { useTempAuth } from "@/lib/auth-temp";

const fade = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};

export function DashboardPage() {
  const { period } = useAppShell();
  const { user } = useTempAuth();
  const [kpis, setKpis] = useState({ volume: 0, sales: 0, revenue: 0, approvalRate: 0 });
  const volumePoints: number[] = [];
  const salesPoints: number[] = [];
  useEffect(() => {
    let active = true;
    const days = ({ hoje: 1, "7d": 7, "30d": 30, "90d": 90, "12m": 365 } as const)[period];
    (async () => {
      if (!user?.empresaId) return;
      const end = new Date(); const start = new Date(end.getTime() - days * 86400000);
      const { data } = await (supabase as any).rpc("fn_dashboard_operacional", { p_empresa_id: user.empresaId, p_inicio: start.toISOString(), p_fim: end.toISOString() });
      const row = data?.[0];
      if (active && row) {
        const attempts = Number(row.tentativas_validas ?? 0);
        const approved = Number(row.pagamentos_aprovados ?? 0);
        setKpis({
          volume: Number(row.volume_processado ?? 0),
          sales: Number(row.vendas_pagas ?? 0),
          revenue: Number(row.receita_liquida ?? 0),
          approvalRate: attempts > 0 ? (approved / attempts) * 100 : 0,
        });
      }
    })();
    return () => { active = false; };
  }, [period, user?.empresaId]);

  const cards = [
    {
      label: "Volume processado",
      value: formatBRL(kpis.volume, { compact: true }),
      hint: formatBRL(kpis.volume),
      delta: null,
      icon: CreditCard,
      points: volumePoints,
    },
    {
      label: "Vendas",
      value: formatInt(kpis.sales),
      hint: "Pedidos pagos no período",
      delta: null,
      icon: ShoppingBag,
      points: salesPoints,
    },
    {
      label: "Receita",
      value: formatBRL(kpis.revenue, { compact: true }),
      hint: "Líquida após taxas e comissões",
      delta: null,
      icon: Wallet,
      points: volumePoints,
    },
    {
      label: "Taxa de aprovação",
      value: formatPct(kpis.approvalRate),
      hint: "Média ponderada por método",
      delta: null,
      icon: CheckCircle2,
      points: salesPoints,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Visão geral
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sua operação nos últimos {periodLabel(period).toLowerCase()} · atualizado agora
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
          >
            <Download className="h-4 w-4" />
            Exportar
          </button>
          <Link
            to="/app/produtos"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Novo produto
          </Link>
        </div>
      </header>

      <motion.div
        initial="hidden"
        animate="show"
        transition={{ staggerChildren: 0.06 }}
        className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {cards.map((c) => (
          <motion.div
            key={c.label}
            variants={fade}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <KpiCard {...c} />
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}
        className="mt-5"
      >
        <SalesChart />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.22, ease: "easeOut" }}
        className="mt-5 grid gap-5 lg:grid-cols-2"
      >
        <RecentTransactions />
        <TopProducts />
      </motion.div>
    </div>
  );
}
