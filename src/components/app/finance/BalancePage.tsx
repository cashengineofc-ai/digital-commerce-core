import { useCallback, useEffect, useState } from "react";
import { Clock, Lock, Wallet } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import { CardsSkeleton } from "@/components/app/Skeletons";
import { StatementTable } from "@/components/app/finance/StatementTable";
import { WithdrawDialog } from "@/components/app/finance/WithdrawDialog";
import type { LucideIcon } from "lucide-react";

type WalletBalance = {
  available: number;
  pending: number;
  reserved: number;
};

function BalanceCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </span>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      </div>
      <p
        className={
          accent
            ? "mt-4 text-2xl font-semibold tabular-nums tracking-tight text-primary"
            : "mt-4 text-2xl font-semibold tabular-nums tracking-tight text-foreground"
        }
      >
        {formatBRL(value)}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function BalancePage() {
  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState<WalletBalance>({
    available: 0,
    pending: 0,
    reserved: 0,
  });

  const loadBalance = useCallback(async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (!profile?.empresa_id) return;

      const { error: syncError } = await (supabase as any).rpc("fn_sincronizar_saldo_empresa");
      if (syncError) {
        console.error("Falha ao sincronizar liberações do saldo", syncError);
      }

      const { data, error } = await supabase
        .from("saldos")
        .select("saldo_disponivel,saldo_em_analise,saldo_previsao_liberar,saldo_bloqueado")
        .eq("empresa_id", profile.empresa_id)
        .maybeSingle();

      if (error) throw error;

      setBalances({
        available: Number(data?.saldo_disponivel ?? 0),
        pending: Number(data?.saldo_em_analise ?? 0) + Number(data?.saldo_previsao_liberar ?? 0),
        reserved: Number(data?.saldo_bloqueado ?? 0),
      });
    } catch (error) {
      console.error("Falha ao carregar saldo", error);
      setBalances({ available: 0, pending: 0, reserved: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBalance();
  }, [loadBalance]);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Saldo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Carteira da operação, liberações futuras e saques.
          </p>
        </div>
        <WithdrawDialog onSuccess={loadBalance} />
      </header>

      <div className="mt-6">
        {loading ? (
          <CardsSkeleton count={3} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <BalanceCard
              icon={Wallet}
              label="Saldo disponível"
              value={balances.available}
              hint="Valor efetivamente disponível na carteira"
              accent
            />
            <BalanceCard
              icon={Clock}
              label="Pendente"
              value={balances.pending}
              hint="Valores em análise ou aguardando liberação"
            />
            <BalanceCard
              icon={Lock}
              label="Reservado"
              value={balances.reserved}
              hint="Valores bloqueados ou reservados para operações"
            />
          </div>
        )}
      </div>

      <div className="mt-8 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Últimos lançamentos
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Entradas, taxas, comissões e saques
          </p>
        </div>
        <Link to="/app/extrato" className="text-xs font-medium text-primary hover:underline">
          Ver extrato completo
        </Link>
      </div>

      <div className="mt-3">
        <StatementTable pageSize={8} limit={30} />
      </div>
    </div>
  );
}
