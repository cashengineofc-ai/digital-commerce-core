import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Search,
  ShoppingBag,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTempAuth } from "@/lib/auth-temp";
import { formatBRL, formatDateTime, formatInt } from "@/lib/format";
import { TableSkeleton } from "@/components/app/Skeletons";
import { EmptyState } from "@/components/app/EmptyState";
import { cn } from "@/lib/utils";

const segmentOptions = ["todos", "VIP", "Recorrente", "Novo", "Inativo"] as const;
type SegmentFilter = (typeof segmentOptions)[number];
const PAGE_SIZE = 12;

type Customer = {
  id: string;
  name: string;
  email: string;
  document: string | null;
  purchases: number;
  totalSpent: number;
  lastPurchase: string | null;
};

function getSegment(c: Customer): (typeof segmentOptions)[number] {
  if (c.totalSpent >= 2000) return "VIP";
  if (c.purchases >= 4) return "Recorrente";
  if (!c.lastPurchase) return "Inativo";
  const days = Math.floor(
    (Date.now() - new Date(c.lastPurchase).getTime()) / (1000 * 60 * 60 * 24),
  );
  return days <= 30 ? "Novo" : "Inativo";
}

function maskDocument(value: string | null) {
  if (!value) return "—";
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
  if (digits.length === 14) return `**.${digits.slice(2, 5)}.${digits.slice(5, 8)}/****-${digits.slice(-2)}`;
  return "••••••••";
}

export function ClientesPage() {
  const { user, isLoading: isAuthLoading } = useTempAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState<SegmentFilter>("todos");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        if (isAuthLoading) return;
        if (!user?.empresaId) {
          if (active) setCustomers([]);
          return;
        }

        const { data, error } = await supabase
          .from("clientes")
          .select("id,nome_completo,email,cpf,cnpj,total_pedidos,total_gasto,data_ultima_compra")
          .eq("empresa_id", user.empresaId)
          .is("deleted_at", null)
          .order("updated_at", { ascending: false });

        if (error) throw error;
        if (!active) return;

        setCustomers(
          (data ?? []).map((row) => ({
            id: row.id,
            name: row.nome_completo,
            email: row.email,
            document: row.cpf ?? row.cnpj ?? null,
            purchases: Number(row.total_pedidos ?? 0),
            totalSpent: Number(row.total_gasto ?? 0),
            lastPurchase: row.data_ultima_compra ?? null,
          })),
        );
      } catch (error) {
        console.error("Falha ao carregar clientes", error);
        if (active) {
          setCustomers([]);
          setLoadError(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar os clientes reais.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [isAuthLoading, user?.empresaId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter((c) => {
      if (segment !== "todos" && getSegment(c) !== segment) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
      );
    });
  }, [customers, query, segment]);

  const overview = useMemo(
    () =>
      customers.reduce(
        (acc, customer) => {
          acc.purchases += customer.purchases;
          acc.spent += customer.totalSpent;
          acc.active += customer.lastPurchase ? 1 : 0;
          return acc;
        },
        { purchases: 0, spent: 0, active: 0 },
      ),
    [customers],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  function reset<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Base de clientes, compras, histórico e ticket médio.
          </p>
        </div>
      </header>

      {loadError && (
        <div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Clientes</span>
            <Users className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums text-foreground">
            {loading ? "—" : formatInt(customers.length)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">registros da empresa atual</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Com histórico</span>
            <UserRoundCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums text-foreground">
            {loading ? "—" : formatInt(overview.active)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">clientes com última compra registrada</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Compras</span>
            <ShoppingBag className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums text-foreground">
            {loading ? "—" : formatInt(overview.purchases)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">total registrado na base</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Valor acumulado</span>
            <CircleDollarSign className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums text-foreground">
            {loading ? "—" : formatBRL(overview.spent, { compact: true })}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">soma do total gasto por clientes</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => reset(setQuery)(e.target.value)}
            placeholder="Buscar por nome ou e-mail"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/15"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {segmentOptions.map((s) => (
            <button
              key={s}
              onClick={() => reset(setSegment)(s)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition",
                segment === s
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhum cliente encontrado"
            description="Clientes reais aparecerão aqui conforme forem cadastrados ou comprarem pela operação."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-3 font-medium">ID</th>
                    <th className="px-5 py-3 font-medium">Cliente</th>
                    <th className="px-5 py-3 font-medium">Documento</th>
                    <th className="px-5 py-3 text-right font-medium">Compras</th>
                    <th className="px-5 py-3 text-right font-medium">Total Gasto</th>
                    <th className="px-5 py-3 text-right font-medium">Última Compra</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((c) => (
                    <tr key={c.id} className="transition-colors hover:bg-muted/50">
                      <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{c.id}</td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-foreground">{c.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{c.email}</p>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{maskDocument(c.document)}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
                        {formatInt(c.purchases)}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold tabular-nums text-foreground">
                        {formatBRL(c.totalSpent)}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
                        {c.lastPurchase ? formatDateTime(c.lastPurchase) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
              <p className="text-xs text-muted-foreground">
                Página {current} de {totalPages} · {formatInt(filtered.length)} clientes
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, current - 1))}
                  disabled={current === 1}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium text-foreground transition hover:bg-muted disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Anterior
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, current + 1))}
                  disabled={current === totalPages}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium text-foreground transition hover:bg-muted disabled:opacity-40"
                >
                  Próxima
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
