import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateTime, formatInt } from "@/lib/format";
import { cn } from "@/lib/utils";
import { WithdrawDialog } from "@/components/app/finance/WithdrawDialog";

type WithdrawStatus = "solicitado" | "processando" | "concluido" | "rejeitado";
type Withdraw = {
  id: string;
  protocol: string;
  account: string;
  amount: number;
  fee: number;
  net: number;
  status: WithdrawStatus;
  rawStatus: string;
  requestedAt: string;
  completedAt: string | null;
};

const statusOptions: { value: WithdrawStatus | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "solicitado", label: "Solicitado" },
  { value: "processando", label: "Processando" },
  { value: "concluido", label: "Concluído" },
  { value: "rejeitado", label: "Rejeitado / cancelado" },
];

const statusStyles: Record<WithdrawStatus, { label: string; className: string; dot: string }> = {
  solicitado: {
    label: "Solicitado",
    className: "bg-[oklch(0.78_0.15_80_/_18%)] text-[oklch(0.52_0.13_75)]",
    dot: "bg-[oklch(0.72_0.15_80)]",
  },
  processando: {
    label: "Processando",
    className: "bg-primary/12 text-primary",
    dot: "bg-primary",
  },
  concluido: {
    label: "Concluído",
    className: "bg-success/12 text-success",
    dot: "bg-success",
  },
  rejeitado: {
    label: "Rejeitado / cancelado",
    className: "bg-destructive/12 text-destructive",
    dot: "bg-destructive",
  },
};

function normalizeStatus(status: string): WithdrawStatus {
  if (status === "solicitado") return "solicitado";
  if (["em_analise", "aprovado", "processando", "enviado"].includes(status)) return "processando";
  if (status === "pago") return "concluido";
  return "rejeitado";
}

function StatusBadge({ status }: { status: WithdrawStatus }) {
  const s = statusStyles[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        s.className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
        {formatBRL(value)}
      </p>
    </div>
  );
}

const PAGE_SIZE = 12;

export function WithdrawsPage() {
  const [withdraws, setWithdraws] = useState<Withdraw[]>([]);
  const [status, setStatus] = useState<WithdrawStatus | "todos">("todos");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
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
        .from("saques")
        .select(
          "id,protocolo,valor_solicitado,taxa_saque,valor_liquido,status,data_solicitacao,data_pagamento,data_cancelamento,data_rejeicao,contas_bancarias(banco_nome,agencia,conta,conta_dv)",
        )
        .eq("empresa_id", profile.empresa_id)
        .order("data_solicitacao", { ascending: false });
      if (error) throw error;

      setWithdraws(
        ((data ?? []) as unknown as Array<any>).map((row) => {
          const bank = row.contas_bancarias;
          return {
            id: row.id,
            protocol: row.protocolo,
            account: bank
              ? `${bank.banco_nome} · Ag. ${bank.agencia} · Conta ${bank.conta}${bank.conta_dv ? `-${bank.conta_dv}` : ""}`
              : "Conta removida",
            amount: Number(row.valor_solicitado ?? 0),
            fee: Number(row.taxa_saque ?? 0),
            net: Number(row.valor_liquido ?? 0),
            status: normalizeStatus(String(row.status)),
            rawStatus: String(row.status),
            requestedAt: row.data_solicitacao,
            completedAt: row.data_pagamento ?? row.data_cancelamento ?? row.data_rejeicao ?? null,
          };
        }),
      );
    } catch (error) {
      console.error("Falha ao carregar saques", error);
      setWithdraws([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return withdraws.filter((w) => status === "todos" || w.status === status);
  }, [withdraws, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const kpis = useMemo(() => {
    const byStatus = withdraws.reduce(
      (acc, w) => {
        acc[w.status] = (acc[w.status] ?? 0) + w.amount;
        return acc;
      },
      {} as Record<WithdrawStatus, number>,
    );
    return {
      solicitado: byStatus.solicitado ?? 0,
      processando: byStatus.processando ?? 0,
      concluido: byStatus.concluido ?? 0,
      rejeitado: byStatus.rejeitado ?? 0,
    };
  }, [withdraws]);

  async function cancelWithdrawal(id: string) {
    try {
      const { error } = await (supabase.rpc as any)("fn_cancelar_saque", { p_saque_id: id });
      if (error) throw error;
      toast.success("Saque cancelado e saldo liberado.");
      await load();
    } catch (error: any) {
      toast.error("Não foi possível cancelar o saque", { description: error?.message });
    }
  }

  function exportCsv() {
    if (filtered.length === 0) return;
    const csvRows = [
      ["Protocolo", "Conta", "Valor bruto", "Taxa", "Líquido", "Status", "Solicitado em", "Finalizado em"],
      ...filtered.map((w) => [w.protocol, w.account, w.amount.toFixed(2), w.fee.toFixed(2), w.net.toFixed(2), w.rawStatus, w.requestedAt, w.completedAt ?? ""]),
    ];
    const csv = csvRows.map((row) => row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `saques-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Saques</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Solicitações de saque e status de liquidação.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </button>
          <WithdrawDialog onSuccess={load} />
        </div>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Solicitados" value={kpis.solicitado} />
        <KpiCard label="Processando" value={kpis.processando} />
        <KpiCard label="Concluídos" value={kpis.concluido} />
        <KpiCard label="Rejeitados / cancelados" value={kpis.rejeitado} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card p-3 shadow-sm">
        {statusOptions.map((o) => (
          <button
            key={o.value}
            onClick={() => {
              setStatus(o.value);
              setPage(1);
            }}
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
        <div className="ml-auto text-xs text-muted-foreground">{formatInt(filtered.length)} saques</div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1060px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-5 py-3 font-medium">Protocolo</th>
                <th className="px-5 py-3 font-medium">Conta destino</th>
                <th className="px-5 py-3 text-right font-medium">Valor bruto</th>
                <th className="px-5 py-3 text-right font-medium">Taxa</th>
                <th className="px-5 py-3 text-right font-medium">Líquido</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Solicitado em</th>
                <th className="px-5 py-3 text-right font-medium">Finalizado em</th>
                <th className="px-5 py-3 text-right font-medium">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((w) => (
                <tr key={w.id} className="transition hover:bg-muted/60">
                  <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{w.protocol}</td>
                  <td className="px-5 py-3 font-medium text-foreground">{w.account}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-foreground">{formatBRL(w.amount)}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{formatBRL(w.fee)}</td>
                  <td className="px-5 py-3 text-right font-semibold tabular-nums text-foreground">{formatBRL(w.net)}</td>
                  <td className="px-5 py-3"><StatusBadge status={w.status} /></td>
                  <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{formatDateTime(w.requestedAt)}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{w.completedAt ? formatDateTime(w.completedAt) : "—"}</td>
                  <td className="px-5 py-3 text-right">
                    {["solicitado", "em_analise"].includes(w.rawStatus) ? (
                      <button onClick={() => cancelWithdrawal(w.id)} className="text-xs font-medium text-destructive hover:underline">Cancelar</button>
                    ) : "—"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={9} className="px-5 py-12 text-center text-sm text-muted-foreground">Nenhum saque encontrado com esses filtros.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
          <p className="text-xs text-muted-foreground">Página {current} de {totalPages}</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(Math.max(1, current - 1))} disabled={current === 1} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium text-foreground transition hover:bg-muted disabled:opacity-40"><ChevronLeft className="h-3.5 w-3.5" />Anterior</button>
            <button onClick={() => setPage(Math.min(totalPages, current + 1))} disabled={current === totalPages} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium text-foreground transition hover:bg-muted disabled:opacity-40">Próxima<ChevronRight className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
