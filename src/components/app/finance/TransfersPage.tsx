import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type TransferStatus = "agendado" | "em_andamento" | "concluido" | "falhou" | "cancelado";
type TransferRow = {
  id: string;
  recipient: string;
  document: string | null;
  gross: number;
  fee: number;
  net: number;
  status: TransferStatus;
  scheduledAt: string | null;
  completedAt: string | null;
  externalId: string | null;
};

const statusStyles: Record<TransferStatus, { label: string; className: string; dot: string }> = {
  agendado: { label: "Agendado", className: "bg-[oklch(0.78_0.15_80_/_18%)] text-[oklch(0.52_0.13_75)]", dot: "bg-[oklch(0.72_0.15_80)]" },
  em_andamento: { label: "Em andamento", className: "bg-primary/12 text-primary", dot: "bg-primary" },
  concluido: { label: "Concluído", className: "bg-success/12 text-success", dot: "bg-success" },
  falhou: { label: "Falhou", className: "bg-destructive/12 text-destructive", dot: "bg-destructive" },
  cancelado: { label: "Cancelado", className: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
};

function normalizeStatus(value: string): TransferStatus {
  if (value === "agendado") return "agendado";
  if (["processando", "enviado"].includes(value)) return "em_andamento";
  if (["recebido", "confirmado"].includes(value)) return "concluido";
  if (value === "falhou") return "falhou";
  return "cancelado";
}

function StatusBadge({ status }: { status: TransferStatus }) {
  const style = statusStyles[status];
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold", style.className)}><span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />{style.label}</span>;
}

function KpiCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return <div className="rounded-xl border border-border bg-card p-5 shadow-sm"><p className="text-sm font-medium text-muted-foreground">{label}</p><p className={cn("mt-3 text-2xl font-semibold tabular-nums tracking-tight", accent ? "text-primary" : "text-foreground")}>{formatBRL(value, { compact: true })}</p></div>;
}

export function TransfersPage() {
  const [transfers, setTransfers] = useState<TransferRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { if (active) setLoading(false); return; }
      const { data: profile } = await supabase.from("profiles").select("empresa_id").eq("id", auth.user.id).maybeSingle();
      if (!profile?.empresa_id) { if (active) setLoading(false); return; }

      const { data, error } = await supabase
        .from("repasses")
        .select("id,destinatario_nome,destinatario_documento,valor_bruto,taxa_administrativa,valor_liquido,status,data_agendada,data_envio,data_recebimento,data_confirmacao,id_repasse_externo")
        .eq("empresa_id", profile.empresa_id)
        .order("created_at", { ascending: false });

      if (!active) return;
      if (error) {
        console.error("Falha ao carregar repasses", error);
        setTransfers([]);
      } else {
        setTransfers((data ?? []).map((row) => ({
          id: row.id,
          recipient: row.destinatario_nome || "Beneficiário não identificado",
          document: row.destinatario_documento ?? null,
          gross: Number(row.valor_bruto ?? 0),
          fee: Number(row.taxa_administrativa ?? 0),
          net: Number(row.valor_liquido ?? 0),
          status: normalizeStatus(String(row.status ?? "agendado")),
          scheduledAt: row.data_agendada ?? row.data_envio ?? null,
          completedAt: row.data_confirmacao ?? row.data_recebimento ?? null,
          externalId: row.id_repasse_externo ?? null,
        })));
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const kpis = useMemo(() => transfers.reduce((acc, transfer) => { acc[transfer.status] += transfer.net; return acc; }, { agendado: 0, em_andamento: 0, concluido: 0, falhou: 0, cancelado: 0 } as Record<TransferStatus, number>), [transfers]);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <header><h1 className="text-2xl font-semibold tracking-tight text-foreground">Repasses</h1><p className="mt-1 text-sm text-muted-foreground">Distribuição registrada para parceiros e beneficiários.</p></header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><KpiCard label="Agendados" value={kpis.agendado} /><KpiCard label="Em andamento" value={kpis.em_andamento} accent /><KpiCard label="Concluídos" value={kpis.concluido} /></div>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-sm"><thead><tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground"><th className="px-5 py-3 font-medium">ID</th><th className="px-5 py-3 font-medium">Beneficiário</th><th className="px-5 py-3 text-right font-medium">Bruto</th><th className="px-5 py-3 text-right font-medium">Taxa</th><th className="px-5 py-3 text-right font-medium">Líquido</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 text-right font-medium">Agendado/envio</th><th className="px-5 py-3 text-right font-medium">Concluído</th></tr></thead>
          <tbody className="divide-y divide-border">{loading ? <tr><td colSpan={8} className="px-5 py-12 text-center text-sm text-muted-foreground">Carregando repasses...</td></tr> : transfers.length ? transfers.map((transfer) => <tr key={transfer.id} className="transition hover:bg-muted/60"><td className="px-5 py-3 font-mono text-xs text-muted-foreground" title={transfer.externalId ?? transfer.id}>{transfer.id.slice(0, 8)}</td><td className="px-5 py-3"><p className="font-medium text-foreground">{transfer.recipient}</p>{transfer.document && <p className="mt-0.5 text-xs text-muted-foreground">{transfer.document}</p>}</td><td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{formatBRL(transfer.gross)}</td><td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{formatBRL(transfer.fee)}</td><td className="px-5 py-3 text-right font-medium tabular-nums text-foreground">{formatBRL(transfer.net)}</td><td className="px-5 py-3"><StatusBadge status={transfer.status} /></td><td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{transfer.scheduledAt ? formatDateTime(transfer.scheduledAt) : "—"}</td><td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{transfer.completedAt ? formatDateTime(transfer.completedAt) : "—"}</td></tr>) : <tr><td colSpan={8} className="px-5 py-12 text-center text-sm text-muted-foreground">Nenhum repasse encontrado.</td></tr>}</tbody></table></div>
      </div>
    </div>
  );
}
