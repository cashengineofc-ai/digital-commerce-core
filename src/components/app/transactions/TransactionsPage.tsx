import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Search, SlidersHorizontal } from "lucide-react";
import { StatusBadge } from "@/components/app/dashboard/RecentTransactions";
import { TransactionDrawer } from "@/components/app/transactions/TransactionDrawer";
import type { TransactionView } from "@/components/app/transactions/types";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateTime, formatInt } from "@/lib/format";
import { cn } from "@/lib/utils";

type StatusFilter = "todos" | "aprovada" | "pendente" | "recusada" | "estornada";
type MethodFilter = "todos" | "Pix" | "Cartão" | "Boleto" | "Outro";

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "aprovada", label: "Aprovadas" },
  { value: "pendente", label: "Pendentes" },
  { value: "recusada", label: "Recusadas" },
  { value: "estornada", label: "Estornadas" },
];

const methodOptions: MethodFilter[] = ["todos", "Pix", "Cartão", "Boleto", "Outro"];
const PAGE_SIZE = 12;

function normalizedStatus(status: string): Exclude<StatusFilter, "todos"> {
  if (["aprovada", "autorizada", "capturada", "paga", "disponivel"].includes(status)) return "aprovada";
  if (["rejeitada", "recusada", "falhou", "cancelada", "expirada"].includes(status)) return "recusada";
  if (["reembolsada", "estornada", "estornada_parcial", "estornada_total", "chargeback", "em_disputa"].includes(status)) return "estornada";
  return "pendente";
}

function displayMethod(method: string | null) {
  if (method === "pix") return "Pix";
  if (["cartao_credito", "cartao_debito"].includes(method ?? "")) return "Cartão";
  if (method === "boleto") return "Boleto";
  return "Outro";
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export function TransactionsPage() {
  const [allTransactions, setAllTransactions] = useState<TransactionView[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("todos");
  const [method, setMethod] = useState<MethodFilter>("todos");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<TransactionView | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        if (active) setLoading(false);
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("empresa_id").eq("id", auth.user.id).maybeSingle();
      if (!profile?.empresa_id) {
        if (active) setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("transacoes")
        .select("id,pedido_numero,valor_bruto,valor_liquido,valor_taxa_processamento,status,metodo_pagamento,created_at,data_pagamento,id_transacao_gateway,provedor_pagamento,status_detalhe_provedor,clientes(nome_completo,email),produtos(nome),afiliados(codigo_afiliado)")
        .eq("empresa_id", profile.empresa_id)
        .order("created_at", { ascending: false });

      if (!active) return;
      if (error) {
        console.error("Falha ao carregar transações", error);
        setAllTransactions([]);
        setLoading(false);
        return;
      }

      setAllTransactions(
        ((data ?? []) as unknown as Array<any>).map((row) => ({
          id: row.pedido_numero ?? row.id,
          dbId: row.id,
          customer: row.clientes?.nome_completo ?? "Cliente não identificado",
          customerEmail: row.clientes?.email ?? null,
          product: row.produtos?.nome ?? "Produto removido",
          amount: Number(row.valor_bruto ?? 0),
          netAmount: Number(row.valor_liquido ?? 0),
          processingFee: Number(row.valor_taxa_processamento ?? 0),
          method: displayMethod(row.metodo_pagamento),
          status: String(row.status ?? "pendente"),
          affiliate: row.afiliados?.codigo_afiliado ?? null,
          date: row.created_at,
          paidAt: row.data_pagamento ?? null,
          gatewayId: row.id_transacao_gateway ?? null,
          provider: row.provedor_pagamento ?? null,
          statusDetail: row.status_detalhe_provedor ?? null,
        })),
      );
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allTransactions.filter((transaction) => {
      if (status !== "todos" && normalizedStatus(transaction.status) !== status) return false;
      if (method !== "todos" && transaction.method !== method) return false;
      if (!q) return true;
      return (
        transaction.id.toLowerCase().includes(q) ||
        transaction.customer.toLowerCase().includes(q) ||
        transaction.product.toLowerCase().includes(q) ||
        transaction.customerEmail?.toLowerCase().includes(q) ||
        transaction.gatewayId?.toLowerCase().includes(q)
      );
    });
  }, [allTransactions, query, status, method]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const approvedVolume = filtered
    .filter((transaction) => normalizedStatus(transaction.status) === "aprovada")
    .reduce((acc, transaction) => acc + transaction.amount, 0);

  function reset<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  function exportCsv() {
    const header = ["pedido", "cliente", "email", "produto", "valor_bruto", "valor_liquido", "taxa", "metodo", "status", "provedor", "gateway_id", "data"];
    const body = filtered.map((transaction) => [
      transaction.id,
      transaction.customer,
      transaction.customerEmail,
      transaction.product,
      transaction.amount.toFixed(2),
      transaction.netAmount.toFixed(2),
      transaction.processingFee.toFixed(2),
      transaction.method,
      transaction.status,
      transaction.provider,
      transaction.gatewayId,
      transaction.date,
    ]);
    const csv = [header, ...body].map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `transacoes-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Transações</h1>
          <p className="mt-1 text-sm text-muted-foreground">{formatInt(filtered.length)} transações · {formatBRL(approvedVolume)} aprovados</p>
        </div>
        <button onClick={exportCsv} disabled={!filtered.length} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted disabled:opacity-40">
          <Download className="h-4 w-4" /> Exportar CSV
        </button>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(event) => reset(setQuery)(event.target.value)} placeholder="Buscar por ID, cliente, e-mail, produto ou gateway" className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/15" />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {statusOptions.map((option) => (
            <button key={option.value} onClick={() => reset(setStatus)(option.value)} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition", status === option.value ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted")}>{option.label}</button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <select value={method} onChange={(event) => reset(setMethod)(event.target.value as MethodFilter)} className="h-9 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground outline-none focus:border-primary/60">
            {methodOptions.map((item) => <option key={item} value={item}>{item === "todos" ? "Todos os métodos" : item}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead><tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground"><th className="px-5 py-3 font-medium">ID</th><th className="px-5 py-3 font-medium">Cliente</th><th className="px-5 py-3 font-medium">Produto</th><th className="px-5 py-3 text-right font-medium">Valor</th><th className="px-5 py-3 font-medium">Método</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 text-right font-medium">Data</th></tr></thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-muted-foreground">Carregando transações...</td></tr>
              ) : rows.length ? rows.map((transaction) => (
                <tr key={transaction.dbId} onClick={() => setSelected(transaction)} className="cursor-pointer transition hover:bg-muted/60">
                  <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{transaction.id}</td>
                  <td className="px-5 py-3 font-medium text-foreground">{transaction.customer}</td>
                  <td className="px-5 py-3 text-muted-foreground">{transaction.product}</td>
                  <td className="px-5 py-3 text-right font-medium tabular-nums text-foreground">{formatBRL(transaction.amount)}</td>
                  <td className="px-5 py-3 text-muted-foreground">{transaction.method}</td>
                  <td className="px-5 py-3"><StatusBadge status={transaction.status} /></td>
                  <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{formatDateTime(transaction.date)}</td>
                </tr>
              )) : (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-muted-foreground">Nenhuma transação encontrada com esses filtros.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
          <p className="text-xs text-muted-foreground">Página {current} de {totalPages}</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(Math.max(1, current - 1))} disabled={current === 1} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium text-foreground transition hover:bg-muted disabled:opacity-40"><ChevronLeft className="h-3.5 w-3.5" /> Anterior</button>
            <button onClick={() => setPage(Math.min(totalPages, current + 1))} disabled={current === totalPages} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium text-foreground transition hover:bg-muted disabled:opacity-40">Próxima <ChevronRight className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      </div>

      <TransactionDrawer transaction={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  );
}
