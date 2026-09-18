import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Banknote,
  Building2,
  CircleDollarSign,
  RefreshCw,
  ScrollText,
  ShoppingCart,
  Ticket,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateTime, formatInt } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  periodLabel,
  useAppShell,
  type PeriodKey,
} from "@/components/app/app-shell-context";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboardPage,
});

type CompanyRow = {
  id: string;
  nome_fantasia: string | null;
  razao_social: string | null;
  plano: string;
  status: string;
  created_at: string;
  owner_name: string | null;
  confirmed_volume: number;
};

type AuditRow = {
  id: string;
  action: string;
  description: string;
  module: string;
  risk: string | null;
  created_at: string;
  actor: string;
};

type Dashboard = {
  companies_total: number;
  companies_active: number;
  companies_created_period: number;
  users_total: number;
  users_active: number;
  orders_confirmed_period: number;
  gross_volume_period: number;
  refunds_period: number;
  withdrawals_pending: number;
  withdrawals_pending_value: number;
  tickets_open: number;
  commissions_recognized_period: number;
  recent_companies: CompanyRow[];
  recent_audit: AuditRow[];
};

const daysByPeriod: Record<PeriodKey, number> = {
  hoje: 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "12m": 365,
};

function Metric({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-[0.12em]">
          {label}
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function AdminDashboardPage() {
  const { period } = useAppShell();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: rpcError } = await (supabase as any).rpc(
        "fn_admin_dashboard_global",
        { p_days: daysByPeriod[period] },
      );
      if (rpcError) throw rpcError;
      setData({
        companies_total: Number(result?.companies_total ?? 0),
        companies_active: Number(result?.companies_active ?? 0),
        companies_created_period: Number(result?.companies_created_period ?? 0),
        users_total: Number(result?.users_total ?? 0),
        users_active: Number(result?.users_active ?? 0),
        orders_confirmed_period: Number(result?.orders_confirmed_period ?? 0),
        gross_volume_period: Number(result?.gross_volume_period ?? 0),
        refunds_period: Number(result?.refunds_period ?? 0),
        withdrawals_pending: Number(result?.withdrawals_pending ?? 0),
        withdrawals_pending_value: Number(
          result?.withdrawals_pending_value ?? 0,
        ),
        tickets_open: Number(result?.tickets_open ?? 0),
        commissions_recognized_period: Number(
          result?.commissions_recognized_period ?? 0,
        ),
        recent_companies: Array.isArray(result?.recent_companies)
          ? result.recent_companies.map((row: any) => ({
              ...row,
              confirmed_volume: Number(row.confirmed_volume ?? 0),
            }))
          : [],
        recent_audit: Array.isArray(result?.recent_audit)
          ? result.recent_audit
          : [],
      });
    } catch (cause) {
      setData(null);
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar o dashboard global.",
      );
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto w-full max-w-[1450px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="rounded-md bg-destructive/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-destructive">
            Ambiente Global
          </span>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Dashboard Admin Global
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Dados reais da plataforma · período: {periodLabel(period)}
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Atualizar
        </button>
      </header>

      {error && (
        <div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Empresas ativas"
          value={formatInt(data?.companies_active ?? 0)}
          hint={`${formatInt(data?.companies_total ?? 0)} empresas no total · ${formatInt(
            data?.companies_created_period ?? 0,
          )} criadas no período`}
          icon={Building2}
        />
        <Metric
          label="Usuários"
          value={formatInt(data?.users_active ?? 0)}
          hint={`${formatInt(data?.users_total ?? 0)} contas cadastradas`}
          icon={Users}
        />
        <Metric
          label="Volume confirmado"
          value={formatBRL(data?.gross_volume_period ?? 0, { compact: true })}
          hint={`${formatInt(
            data?.orders_confirmed_period ?? 0,
          )} pagamentos confirmados · devoluções ${formatBRL(
            data?.refunds_period ?? 0,
          )}`}
          icon={ShoppingCart}
        />
        <Metric
          label="Saques pendentes"
          value={formatInt(data?.withdrawals_pending ?? 0)}
          hint={formatBRL(data?.withdrawals_pending_value ?? 0)}
          icon={Banknote}
        />
        <Metric
          label="Tickets abertos"
          value={formatInt(data?.tickets_open ?? 0)}
          hint="Somente chamados ainda não encerrados"
          icon={Ticket}
        />
        <Metric
          label="Comissões reconhecidas"
          value={formatBRL(data?.commissions_recognized_period ?? 0, {
            compact: true,
          })}
          hint="Comissão líquida das reversões no período"
          icon={CircleDollarSign}
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="font-semibold">Empresas recentes</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Cadastros reais, sem empresas demonstrativas.
              </p>
            </div>
            <Link
              to="/admin/empresas"
              className="text-xs font-medium text-primary hover:underline"
            >
              Ver todas
            </Link>
          </div>
          {loading ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Carregando...
            </div>
          ) : (data?.recent_companies.length ?? 0) === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Nenhuma empresa cadastrada.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {data?.recent_companies.map((company) => (
                <div
                  key={company.id}
                  className="flex items-start justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {company.nome_fantasia ||
                        company.razao_social ||
                        "Empresa"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {company.owner_name || "Owner não identificado"} · plano{" "}
                      {company.plano} · {company.status}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatDateTime(company.created_at)}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatBRL(company.confirmed_volume, { compact: true })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="font-semibold">Auditoria recente</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Ações registradas pelo backend.
              </p>
            </div>
            <Link
              to="/admin/auditoria"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              <ScrollText className="h-3.5 w-3.5" />
              Abrir auditoria
            </Link>
          </div>
          {loading ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Carregando...
            </div>
          ) : (data?.recent_audit.length ?? 0) === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Nenhum evento de auditoria registrado.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {data?.recent_audit.map((event) => (
                <div key={event.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{event.action}</p>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] capitalize text-muted-foreground">
                      {event.module}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {event.description}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {event.actor} · {formatDateTime(event.created_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
