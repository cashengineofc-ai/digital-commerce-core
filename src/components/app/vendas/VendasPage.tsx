import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateTime, formatInt } from "@/lib/format";
import { CardsSkeleton, TableSkeleton } from "@/components/app/Skeletons";
import { EmptyState } from "@/components/app/EmptyState";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type OrderStatus = "aprovado" | "processando" | "pendente" | "cancelado";
type PaymentMethod = "Pix" | "Cartão" | "Boleto" | "Outro";

type Order = {
  id: string;
  customer: string;
  email: string;
  product: string;
  amount: number;
  method: PaymentMethod;
  status: OrderStatus;
  date: string;
  rawStatus: string;
};

const statusOptions: { value: OrderStatus | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "aprovado", label: "Aprovados" },
  { value: "processando", label: "Processando" },
  { value: "pendente", label: "Pendentes" },
  { value: "cancelado", label: "Cancelados" },
];

const methodOptions: (PaymentMethod | "todos")[] = ["todos", "Pix", "Cartão", "Boleto", "Outro"];
const PAGE_SIZE = 12;
const APPROVED_STATUSES = new Set(["aprovada", "autorizada", "capturada", "paga", "disponivel"]);

function mapStatus(status: string): OrderStatus {
  if (APPROVED_STATUSES.has(status)) return "aprovado";
  if (status === "processando") return "processando";
  if (status === "pendente" || status === "atrasada") return "pendente";
  return "cancelado";
}

function mapMethod(method: string | null): PaymentMethod {
  if (method === "pix") return "Pix";
  if (method === "cartao_credito" || method === "cartao_debito") return "Cartão";
  if (method === "boleto") return "Boleto";
  return "Outro";
}

function OrderStatusPill({ status }: { status: OrderStatus }) {
  const map: Record<OrderStatus, string> = {
    aprovado: "bg-emerald-500/10 text-emerald-700",
    processando: "bg-blue-500/10 text-blue-700",
    pendente: "bg-amber-500/10 text-amber-700",
    cancelado: "bg-rose-500/10 text-rose-700",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", map[status])}>
      {status}
    </span>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
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
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function VendasPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<OrderStatus | "todos">("todos");
  const [method, setMethod] = useState<PaymentMethod | "todos">("todos");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;

    async function load() {
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

        const { data, error } = await supabase
          .from("transacoes")
          .select(
            "id,pedido_numero,valor_bruto,status,metodo_pagamento,created_at,tipo,clientes(nome_completo,email),produtos(nome)",
          )
          .eq("empresa_id", profile.empresa_id)
          .in("tipo", ["venda", "assinatura", "link_pagamento"])
          .order("created_at", { ascending: false });

        if (error) throw error;
        if (!active) return;

        setOrders(
          ((data ?? []) as unknown as Array<any>).map((row) => ({
            id: row.pedido_numero ?? row.id,
            customer: row.clientes?.nome_completo ?? "Cliente não identificado",
            email: row.clientes?.email ?? "—",
            product: row.produtos?.nome ?? "Produto não identificado",
            amount: Number(row.valor_bruto ?? 0),
            method: mapMethod(row.metodo_pagamento),
            status: mapStatus(String(row.status ?? "pendente")),
            rawStatus: String(row.status ?? "pendente"),
            date: row.created_at,
          })),
        );
      } catch (error) {
        console.error("Falha ao carregar vendas", error);
        if (active) setOrders([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (status !== "todos" && o.status !== status) return false;
      if (method !== "todos" && o.method !== method) return false;
      if (!q) return true;
      return (
        o.id.toLowerCase().includes(q) ||
        o.customer.toLowerCase().includes(q) ||
        o.product.toLowerCase().includes(q)
      );
    });
  }, [orders, query, status, method]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const approvedOrders = orders.filter((o) => APPROVED_STATUSES.has(o.rawStatus));
  const totalRevenue = approvedOrders.reduce((acc, o) => acc + o.amount, 0);
  const avgTicket = approvedOrders.length > 0 ? totalRevenue / approvedOrders.length : 0;

  function reset<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  function exportCsv() {
    if (filtered.length === 0) return;
    const header = ["Pedido", "Cliente", "Email", "Produto", "Valor", "Método", "Status", "Data"];
    const body = filtered.map((o) => [
      o.id,
      o.customer,
      o.email,
      o.product,
      o.amount.toFixed(2),
      o.method,
      o.rawStatus,
      o.date,
    ]);
    const csv = [header, ...body]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `vendas-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Vendas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acompanhe pedidos, receita e status de cada venda.
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Exportar CSV
        </button>
      </header>

      <div className="mt-6">
        {loading ? (
          <CardsSkeleton count={3} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard
              icon={ShoppingBag}
              label="Pedidos"
              value={formatInt(orders.length)}
              hint={`${formatInt(filtered.length)} no filtro atual`}
              accent
            />
            <KpiCard
              icon={Wallet}
              label="Receita aprovada"
              value={formatBRL(totalRevenue)}
              hint={`${formatInt(approvedOrders.length)} pagamentos aprovados`}
            />
            <KpiCard
              icon={TrendingUp}
              label="Ticket médio"
              value={formatBRL(avgTicket)}
              hint="Calculado sobre vendas aprovadas"
            />
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => reset(setQuery)(e.target.value)}
            placeholder="Buscar por pedido, cliente ou produto"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/15"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {statusOptions.map((o) => (
            <button
              key={o.value}
              onClick={() => reset(setStatus)(o.value)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                status === o.value
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <select
            value={method}
            onChange={(e) => reset(setMethod)(e.target.value as PaymentMethod | "todos")}
            className="h-9 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground outline-none focus:border-primary/60"
          >
            {methodOptions.map((m) => (
              <option key={m} value={m}>
                {m === "todos" ? "Todos os métodos" : m}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {loading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="Nenhuma venda encontrada"
            description="Quando vendas reais forem registradas, elas aparecerão aqui automaticamente."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Pedido</th>
                    <th className="px-5 py-3 font-medium">Cliente</th>
                    <th className="px-5 py-3 font-medium">Produto</th>
                    <th className="px-5 py-3 text-right font-medium">Valor</th>
                    <th className="px-5 py-3 font-medium">Método</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 text-right font-medium">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((o) => (
                    <tr key={o.id} className="transition-colors hover:bg-muted/50">
                      <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{o.id}</td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-foreground">{o.customer}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{o.email}</p>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{o.product}</td>
                      <td className="px-5 py-3 text-right font-medium tabular-nums text-foreground">
                        {formatBRL(o.amount)}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{o.method}</td>
                      <td className="px-5 py-3">
                        <OrderStatusPill status={o.status} />
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
                        {formatDateTime(o.date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
              <p className="text-xs text-muted-foreground">
                Página {current} de {totalPages}
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
