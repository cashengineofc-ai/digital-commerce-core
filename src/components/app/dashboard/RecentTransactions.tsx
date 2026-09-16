import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  order: string;
  customer: string;
  method: string;
  status: string;
  amount: number;
  date: string;
};

function statusPresentation(status: string) {
  if (["aprovada", "autorizada", "capturada", "paga", "disponivel"].includes(status)) {
    return { label: "Aprovada", className: "bg-success/12 text-success", dot: "bg-success" };
  }
  if (["pendente", "processando", "em_analise"].includes(status)) {
    return {
      label: status === "processando" ? "Processando" : "Pendente",
      className: "bg-[oklch(0.78_0.15_80_/_18%)] text-[oklch(0.52_0.13_75)]",
      dot: "bg-[oklch(0.72_0.15_80)]",
    };
  }
  if (["rejeitada", "recusada", "falhou", "cancelada", "expirada"].includes(status)) {
    return { label: "Não aprovada", className: "bg-destructive/12 text-destructive", dot: "bg-destructive" };
  }
  if (["reembolsada", "estornada", "chargeback", "em_disputa"].includes(status)) {
    return { label: status === "chargeback" ? "Chargeback" : "Estornada", className: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" };
  }
  return { label: status || "—", className: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" };
}

export function StatusBadge({ status }: { status: string }) {
  const presentation = statusPresentation(status);
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold", presentation.className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", presentation.dot)} />
      {presentation.label}
    </span>
  );
}

export function RecentTransactions() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
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

      const { data: transactions, error } = await supabase
        .from("transacoes")
        .select("id,pedido_numero,cliente_id,metodo_pagamento,status,valor_bruto,created_at")
        .eq("empresa_id", profile.empresa_id)
        .order("created_at", { ascending: false })
        .limit(7);

      if (error || !transactions) {
        console.error("Falha ao carregar últimas transações", error);
        if (active) {
          setRows([]);
          setLoading(false);
        }
        return;
      }

      const customerIds = Array.from(new Set(transactions.map((item) => item.cliente_id).filter(Boolean))) as string[];
      const names = new Map<string, string>();
      if (customerIds.length) {
        const { data: customers } = await supabase.from("clientes").select("id,nome_completo,email").in("id", customerIds);
        for (const customer of customers ?? []) names.set(customer.id, customer.nome_completo || customer.email || "Cliente");
      }

      if (active) {
        setRows(
          transactions.map((item) => ({
            id: item.id,
            order: item.pedido_numero || item.id.slice(0, 8).toUpperCase(),
            customer: item.cliente_id ? names.get(item.cliente_id) ?? "Cliente" : "Cliente",
            method: String(item.metodo_pagamento ?? "—").replaceAll("_", " "),
            status: String(item.status ?? "pendente"),
            amount: Number(item.valor_bruto ?? 0),
            date: item.created_at,
          })),
        );
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="flex flex-col rounded-xl border border-border bg-card shadow-sm">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Últimas transações</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Dados reais da operação</p>
        </div>
        <Link to="/app/transacoes" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          Ver todas <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      {loading ? (
        <div className="space-y-3 p-5">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-11 animate-pulse rounded-lg bg-muted/60" />)}</div>
      ) : rows.length ? (
        <ul className="divide-y divide-border">
          {rows.map((transaction) => (
            <li key={transaction.id} className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-muted/50">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{transaction.customer}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  <span className="font-mono">{transaction.order}</span> · {transaction.method} · {formatDateTime(transaction.date)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-sm font-semibold tabular-nums text-foreground">{formatBRL(transaction.amount)}</span>
                <StatusBadge status={transaction.status} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid min-h-48 place-items-center p-6 text-center">
          <div><p className="text-sm font-medium text-foreground">Nenhuma transação ainda</p><p className="mt-1 text-xs text-muted-foreground">As vendas aparecerão aqui assim que forem criadas.</p></div>
        </div>
      )}
    </section>
  );
}
