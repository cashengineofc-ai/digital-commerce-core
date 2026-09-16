import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateTime, formatInt, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";

type RefundStatus = "concluido" | "em_analise" | "rejeitado";
type RefundReason = "garantia" | "desistencia" | "fraude" | "erro_operacional" | "outro";
type RefundRow = {
  id: string;
  transaction: string;
  customer: string;
  product: string;
  amount: number;
  reason: RefundReason;
  rawReason: string;
  status: RefundStatus;
  requestedAt: string;
  completedAt: string | null;
};

const statusOptions: { value: RefundStatus | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "concluido", label: "Concluídos" },
  { value: "em_analise", label: "Em análise" },
  { value: "rejeitado", label: "Rejeitados" },
];

const reasonOptions: (RefundReason | "todos")[] = ["todos", "garantia", "desistencia", "fraude", "erro_operacional", "outro"];
const reasonLabel: Record<RefundReason, string> = { garantia: "Garantia", desistencia: "Desistência", fraude: "Fraude", erro_operacional: "Erro operacional", outro: "Outro" };
const reasonStyles: Record<RefundReason, string> = {
  garantia: "bg-primary/12 text-primary",
  desistencia: "bg-[oklch(0.78_0.15_80_/_18%)] text-[oklch(0.52_0.13_75)]",
  fraude: "bg-destructive/12 text-destructive",
  erro_operacional: "bg-muted text-muted-foreground",
  outro: "bg-muted text-muted-foreground",
};
const statusStyles: Record<RefundStatus, { label: string; className: string; dot: string }> = {
  concluido: { label: "Concluído", className: "bg-success/12 text-success", dot: "bg-success" },
  em_analise: { label: "Em análise", className: "bg-[oklch(0.78_0.15_80_/_18%)] text-[oklch(0.52_0.13_75)]", dot: "bg-[oklch(0.72_0.15_80)]" },
  rejeitado: { label: "Rejeitado", className: "bg-destructive/12 text-destructive", dot: "bg-destructive" },
};

function normalizeReason(value: string | null): RefundReason {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized.includes("garantia")) return "garantia";
  if (normalized.includes("desist")) return "desistencia";
  if (normalized.includes("fraude")) return "fraude";
  if (normalized.includes("erro")) return "erro_operacional";
  return "outro";
}

function normalizeStatus(value: string): RefundStatus {
  if (value === "concluido" || value === "aprovado_total" || value === "aprovado_parcial") return "concluido";
  if (value === "rejeitado" || value === "cancelado") return "rejeitado";
  return "em_analise";
}

function ReasonBadge({ reason, title }: { reason: RefundReason; title?: string }) {
  return <span title={title} className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold", reasonStyles[reason])}>{reasonLabel[reason]}</span>;
}

function StatusBadge({ status }: { status: RefundStatus }) {
  const style = statusStyles[status];
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold", style.className)}><span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />{style.label}</span>;
}

function KpiCard({ label, value, isPct }: { label: string; value: number; isPct?: boolean }) {
  return <div className="rounded-xl border border-border bg-card p-5 shadow-sm"><p className="text-sm font-medium text-muted-foreground">{label}</p><p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-foreground">{isPct ? formatPct(value, 1) : formatBRL(value)}</p></div>;
}

const PAGE_SIZE = 12;

export function RefundsPage() {
  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [approvedSalesVolume, setApprovedSalesVolume] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<RefundStatus | "todos">("todos");
  const [reason, setReason] = useState<RefundReason | "todos">("todos");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { if (active) setLoading(false); return; }
      const { data: profile } = await supabase.from("profiles").select("empresa_id").eq("id", auth.user.id).maybeSingle();
      if (!profile?.empresa_id) { if (active) setLoading(false); return; }

      const [refundResult, salesResult] = await Promise.all([
        supabase
          .from("estornos")
          .select("id,protocolo,transacao_id,valor_solicitado_estorno,valor_aprovado_estorno,valor_efetivamente_estornado,motivo,status,data_solicitacao,data_conclusao,clientes(nome_completo),transacoes(pedido_numero,produto_id,produtos(nome))")
          .eq("empresa_id", profile.empresa_id)
          .order("data_solicitacao", { ascending: false }),
        supabase
          .from("transacoes")
          .select("valor_bruto")
          .eq("empresa_id", profile.empresa_id)
          .in("status", ["aprovada", "autorizada", "capturada", "paga", "disponivel"])
          .in("tipo", ["venda", "assinatura", "link_pagamento"]),
      ]);

      if (!active) return;
      if (refundResult.error) console.error("Falha ao carregar estornos", refundResult.error);
      if (salesResult.error) console.error("Falha ao calcular volume aprovado", salesResult.error);

      const rows = ((refundResult.data ?? []) as unknown as Array<any>).map((row) => {
        const normalized = normalizeStatus(String(row.status ?? "solicitado"));
        const amount = normalized === "concluido"
          ? Number(row.valor_efetivamente_estornado ?? row.valor_aprovado_estorno ?? row.valor_solicitado_estorno ?? 0)
          : Number(row.valor_solicitado_estorno ?? 0);
        return {
          id: row.protocolo ?? row.id,
          transaction: row.transacoes?.pedido_numero ?? row.transacao_id ?? "—",
          customer: row.clientes?.nome_completo ?? "Cliente não identificado",
          product: row.transacoes?.produtos?.nome ?? "Produto não identificado",
          amount,
          reason: normalizeReason(row.motivo),
          rawReason: row.motivo ?? "Não informado",
          status: normalized,
          requestedAt: row.data_solicitacao ?? row.created_at,
          completedAt: row.data_conclusao ?? null,
        } satisfies RefundRow;
      });

      setRefunds(rows);
      setApprovedSalesVolume((salesResult.data ?? []).reduce((sum, row) => sum + Number(row.valor_bruto ?? 0), 0));
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return refunds.filter((refund) => {
      if (status !== "todos" && refund.status !== status) return false;
      if (reason !== "todos" && refund.reason !== reason) return false;
      if (!search) return true;
      return [refund.id, refund.customer, refund.transaction, refund.product, refund.rawReason].some((value) => value.toLowerCase().includes(search));
    });
  }, [refunds, query, status, reason]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const concluded = refunds.filter((item) => item.status === "concluido").reduce((sum, item) => sum + item.amount, 0);
  const inReview = refunds.filter((item) => item.status === "em_analise").reduce((sum, item) => sum + item.amount, 0);
  const refundRate = approvedSalesVolume > 0 ? (concluded / approvedSalesVolume) * 100 : 0;

  function reset<T>(setter: (value: T) => void) { return (value: T) => { setter(value); setPage(1); }; }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <header><h1 className="text-2xl font-semibold tracking-tight text-foreground">Estornos</h1><p className="mt-1 text-sm text-muted-foreground">Garantia, desistência e reembolso do cliente.</p></header>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><KpiCard label="Concluídos" value={concluded} /><KpiCard label="Em análise" value={inReview} /><KpiCard label="Taxa de estorno" value={refundRate} isPct /></div>

      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="relative min-w-[220px] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => reset(setQuery)(event.target.value)} placeholder="Buscar por ID, cliente, transação ou produto" className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/15" /></div>
        <div className="flex flex-wrap items-center gap-1.5">{statusOptions.map((option) => <button key={option.value} onClick={() => reset(setStatus)(option.value)} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition", status === option.value ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted")}>{option.label}</button>)}</div>
        <select value={reason} onChange={(event) => reset(setReason)(event.target.value as RefundReason | "todos")} className="h-9 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground outline-none focus:border-primary/60">{reasonOptions.map((item) => <option key={item} value={item}>{item === "todos" ? "Todos os motivos" : reasonLabel[item]}</option>)}</select>
        <div className="text-xs text-muted-foreground">{formatInt(filtered.length)} estornos</div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto"><table className="w-full min-w-[1060px] text-sm"><thead><tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground"><th className="px-5 py-3 font-medium">ID</th><th className="px-5 py-3 font-medium">Transação</th><th className="px-5 py-3 font-medium">Cliente</th><th className="px-5 py-3 font-medium">Produto</th><th className="px-5 py-3 text-right font-medium">Valor</th><th className="px-5 py-3 font-medium">Motivo</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 text-right font-medium">Solicitado em</th><th className="px-5 py-3 text-right font-medium">Concluído em</th></tr></thead>
          <tbody className="divide-y divide-border">{loading ? <tr><td colSpan={9} className="px-5 py-12 text-center text-sm text-muted-foreground">Carregando estornos...</td></tr> : rows.length ? rows.map((refund) => <tr key={refund.id} className="transition hover:bg-muted/60"><td className="px-5 py-3 font-mono text-xs text-muted-foreground">{refund.id}</td><td className="px-5 py-3 font-mono text-xs text-muted-foreground">{refund.transaction}</td><td className="px-5 py-3 font-medium text-foreground">{refund.customer}</td><td className="px-5 py-3 text-muted-foreground">{refund.product}</td><td className="px-5 py-3 text-right font-medium tabular-nums text-foreground">{formatBRL(refund.amount)}</td><td className="px-5 py-3"><ReasonBadge reason={refund.reason} title={refund.rawReason} /></td><td className="px-5 py-3"><StatusBadge status={refund.status} /></td><td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{formatDateTime(refund.requestedAt)}</td><td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{refund.completedAt ? formatDateTime(refund.completedAt) : "—"}</td></tr>) : <tr><td colSpan={9} className="px-5 py-12 text-center text-sm text-muted-foreground">Nenhum estorno encontrado.</td></tr>}</tbody></table></div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3"><p className="text-xs text-muted-foreground">Página {current} de {totalPages}</p><div className="flex items-center gap-2"><button onClick={() => setPage(Math.max(1, current - 1))} disabled={current === 1} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium text-foreground transition hover:bg-muted disabled:opacity-40"><ChevronLeft className="h-3.5 w-3.5" />Anterior</button><button onClick={() => setPage(Math.min(totalPages, current + 1))} disabled={current === totalPages} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium text-foreground transition hover:bg-muted disabled:opacity-40">Próxima<ChevronRight className="h-3.5 w-3.5" /></button></div></div>
      </div>
    </div>
  );
}
