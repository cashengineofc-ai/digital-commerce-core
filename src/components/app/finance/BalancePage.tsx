import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Clock, Landmark, Lock, Wallet } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import { CardsSkeleton } from "@/components/app/Skeletons";
import { EmptyState } from "@/components/app/EmptyState";
import { StatementTable } from "@/components/app/finance/StatementTable";
import { WithdrawDialog } from "@/components/app/finance/WithdrawDialog";
import { usePermission } from "@/lib/use-permission";
import type { LucideIcon } from "lucide-react";

type WalletBalance = {
  receivable: number;
  available: number;
  reserved: number;
  blocked: number;
  debtor: number;
  settled: number;
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
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </span>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      </div>
      <p className={accent ? "mt-4 text-2xl font-semibold tabular-nums text-primary" : "mt-4 text-2xl font-semibold tabular-nums text-foreground"}>
        {formatBRL(value)}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function BalancePage() {
  const balancePermission = usePermission("financeiro", "saldo", "read");
  const statementPermission = usePermission("financeiro", "extrato", "read");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<WalletBalance>({
    receivable: 0,
    available: 0,
    reserved: 0,
    blocked: 0,
    debtor: 0,
    settled: 0,
  });

  const loadBalance = useCallback(async () => {
    if (balancePermission.loading) return;
    if (!balancePermission.allowed) {
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { error: syncError } = await (supabase as any).rpc("fn_sincronizar_saldo_empresa");
      if (syncError) console.warn("Sincronização financeira não concluída", syncError);

      const { data, error: rpcError } = await (supabase as any).rpc("fn_financeiro_saldo", {
        p_entidade: "empresa",
      });
      if (rpcError) throw rpcError;
      const row = Array.isArray(data) ? data[0] : data;

      setBalance({
        receivable: Number(row?.a_receber ?? 0),
        available: Number(row?.disponivel ?? 0),
        reserved: Number(row?.reservado_saque ?? 0),
        blocked: Number(row?.bloqueado ?? 0),
        debtor: Number(row?.devedor ?? 0),
        settled: Number(row?.liquidado_historico ?? 0),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar o saldo.");
      setBalance({ receivable: 0, available: 0, reserved: 0, blocked: 0, debtor: 0, settled: 0 });
    } finally {
      setLoading(false);
    }
  }, [balancePermission.allowed, balancePermission.loading]);

  useEffect(() => {
    void loadBalance();
  }, [loadBalance]);

  if (!balancePermission.loading && !balancePermission.allowed) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Saldo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Você não possui permissão para visualizar o saldo desta empresa.
          </p>
        </header>
        <div className="mt-6">
          <EmptyState
            icon={Wallet}
            title="Acesso financeiro restrito"
            description="Solicite a um administrador da empresa a permissão Saldo - Visualizar."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Saldo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Carteira contábil derivada dos lançamentos confirmados.
          </p>
        </div>
        <WithdrawDialog onSuccess={loadBalance} />
      </header>

      {error && (
        <div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mt-6">
        {loading || balancePermission.loading ? (
          <CardsSkeleton count={6} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <BalanceCard icon={Wallet} label="Disponível" value={balance.available} hint="Valor líquido disponível para novas operações ou saque" accent />
            <BalanceCard icon={Clock} label="A receber" value={balance.receivable} hint="Confirmado, mas aguardando data de liberação" />
            <BalanceCard icon={Lock} label="Reservado para saque" value={balance.reserved} hint="Indisponível enquanto o saque está em andamento" />
            <BalanceCard icon={Landmark} label="Liquidado" value={balance.settled} hint="Histórico já conciliado como pago" />
            <BalanceCard icon={Lock} label="Bloqueado" value={balance.blocked} hint="Valores bloqueados por regra operacional" />
            <BalanceCard icon={AlertTriangle} label="Débito pendente" value={balance.debtor} hint="Obrigações não cobertas por saldo disponível" />
          </div>
        )}
      </div>

      <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-muted-foreground">
        O saldo acima é o saldo contábil do Cash Engine PRO. Ele não deve ser interpretado como saldo bancário conciliado sem conferência da conta recebedora.
      </div>

      {!statementPermission.loading && statementPermission.allowed ? (
        <>
          <div className="mt-8 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Últimos lançamentos</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Venda, taxa, comissão, reserva, saque e estorno usam o mesmo razão.</p>
            </div>
            <Link to="/app/extrato" className="text-xs font-medium text-primary hover:underline">Ver extrato completo</Link>
          </div>

          <div className="mt-3">
            <StatementTable pageSize={8} limit={8} showFilters={false} />
          </div>
        </>
      ) : null}
    </div>
  );
}
