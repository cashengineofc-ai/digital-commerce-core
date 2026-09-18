import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateTime, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useTempAuth } from "@/lib/auth-temp";

type ChargebackStatus = "em_disputa" | "perdido" | "ganho";
type ChargebackRow = {
  id: string;
  bankCode: string;
  transaction: string;
  customer: string;
  product: string;
  amount: number;
  reason: string;
  status: ChargebackStatus;
  deadline: string | null;
};

const statusOptions: { value: ChargebackStatus | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "em_disputa", label: "Em disputa" },
  { value: "perdido", label: "Perdidos" },
  { value: "ganho", label: "Ganhos" },
];

const statusStyles: Record<ChargebackStatus, { label: string; className: string; dot: string }> = {
  em_disputa: { label: "Em disputa", className: "bg-[oklch(0.78_0.15_80_/_18%)] text-[oklch(0.52_0.13_75)]", dot: "bg-[oklch(0.72_0.15_80)]" },
  perdido: { label: "Perdido", className: "bg-destructive/12 text-destructive", dot: "bg-destructive" },
  ganho: { label: "Ganho", className: "bg-success/12 text-success", dot: "bg-success" },
};

function normalizeStatus(status: string | null, decision: string | null): ChargebackStatus {
  const combined = `${status ?? ""} ${decision ?? ""}`.toLowerCase();
  if (["ganho", "favoravel", "favorável", "procedente_cliente", "revertido"].some((term) => combined.includes(term))) return "ganho";
  if (["perdido", "desfavoravel", "desfavorável", "mantido", "procedente_banco"].some((term) => combined.includes(term))) return "perdido";
  return "em_disputa";
}

function StatusBadge({ status }: { status: ChargebackStatus }) {
  const style = statusStyles[status];
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold", style.className)}><span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />{style.label}</span>;
}

function KpiCard({ label, value, isPct, accent }: { label: string; value: number; isPct?: boolean; accent?: boolean }) {
  return <div className="rounded-xl border border-border bg-card p-5 shadow-sm"><p className="text-sm font-medium text-muted-foreground">{label}</p><p className={cn("mt-3 text-2xl font-semibold tabular-nums tracking-tight", accent ? "text-primary" : "text-foreground")}>{isPct ? formatPct(value, 0) : formatBRL(value)}</p></div>;
}

export function ChargebacksPage() {
  const { user } = useTempAuth();
  const [rows, setRows] = useState<ChargebackRow[]>([]);
  const [status, setStatus] = useState<ChargebackStatus | "todos">("todos");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      if (!user?.empresaId) { if (active) setLoading(false); return; }

      const { data, error } = await supabase
        .from("chargebacks")
        .select("id,protocolo,codigo_chargeback_banco,motivo_banco,valor_chargeback,valor_total_prejuizo,data_limite_resposta,status,decisao_final,transacao_id,clientes(nome_completo),transacoes(pedido_numero,produtos(nome))")
        .eq("empresa_id", user.empresaId)
        .order("created_at", { ascending: false });

      if (!active) return;
      if (error) {
        console.error("Falha ao carregar chargebacks", error);
        setRows([]);
      } else {
        setRows(((data ?? []) as unknown as Array<any>).map((row) => ({
          id: row.protocolo ?? row.id,
          bankCode: row.codigo_chargeback_banco ?? "—",
          transaction: row.transacoes?.pedido_numero ?? row.transacao_id ?? "—",
          customer: row.clientes?.nome_completo ?? "Cliente não identificado",
          product: row.transacoes?.produtos?.nome ?? "Produto não identificado",
          amount: Number(row.valor_chargeback ?? row.valor_total_prejuizo ?? 0),
          reason: row.motivo_banco ?? "Não informado",
          status: normalizeStatus(row.status, row.decisao_final),
          deadline: row.data_limite_resposta ?? null,
        })));
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [user?.empresaId]);

  const filtered = useMemo(() => status === "todos" ? rows : rows.filter((row) => row.status === status), [rows, status]);
  const byStatus = useMemo(() => rows.reduce((acc, row) => { acc[row.status] += row.amount; return acc; }, { em_disputa: 0, perdido: 0, ganho: 0 } as Record<ChargebackStatus, number>), [rows]);
  const decided = byStatus.ganho + byStatus.perdido;
  const recoveryRate = decided > 0 ? (byStatus.ganho / decided) * 100 : 0;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <header><h1 className="text-2xl font-semibold tracking-tight text-foreground">Chargebacks</h1><p className="mt-1 text-sm text-muted-foreground">Contestações do emissor, defesa e recuperação de receita.</p></header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Em disputa" value={byStatus.em_disputa} />
        <KpiCard label="Perdidos" value={byStatus.perdido} />
        <KpiCard label="Ganhos" value={byStatus.ganho} />
        <KpiCard label="Taxa de recuperação" value={recoveryRate} isPct accent />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card p-3 shadow-sm">
        {statusOptions.map((option) => <button key={option.value} onClick={() => setStatus(option.value)} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition", status === option.value ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted")}>{option.label}</button>)}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-sm">
            <thead><tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground"><th className="px-5 py-3 font-medium">ID</th><th className="px-5 py-3 font-medium">Código banco</th><th className="px-5 py-3 font-medium">Transação</th><th className="px-5 py-3 font-medium">Cliente</th><th className="px-5 py-3 font-medium">Produto</th><th className="px-5 py-3 text-right font-medium">Valor</th><th className="px-5 py-3 font-medium">Razão</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 text-right font-medium">Prazo</th></tr></thead>
            <tbody className="divide-y divide-border">
              {loading ? <tr><td colSpan={9} className="px-5 py-12 text-center text-sm text-muted-foreground">Carregando chargebacks...</td></tr> : filtered.length ? filtered.map((row) => (
                <tr key={row.id} className="transition hover:bg-muted/60"><td className="px-5 py-3 font-mono text-xs text-muted-foreground">{row.id}</td><td className="px-5 py-3 font-mono text-xs text-muted-foreground">{row.bankCode}</td><td className="px-5 py-3 font-mono text-xs text-muted-foreground">{row.transaction}</td><td className="px-5 py-3 font-medium text-foreground">{row.customer}</td><td className="px-5 py-3 text-muted-foreground">{row.product}</td><td className="px-5 py-3 text-right font-medium tabular-nums text-foreground">{formatBRL(row.amount)}</td><td className="max-w-[220px] truncate px-5 py-3 text-muted-foreground" title={row.reason}>{row.reason}</td><td className="px-5 py-3"><StatusBadge status={row.status} /></td><td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{row.deadline ? formatDateTime(row.deadline) : "—"}</td></tr>
              )) : <tr><td colSpan={9} className="px-5 py-12 text-center text-sm text-muted-foreground">Nenhum chargeback encontrado com esses filtros.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
