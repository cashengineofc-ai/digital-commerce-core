import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateTime, formatInt } from "@/lib/format";
import { EmptyState } from "@/components/app/EmptyState";
import { cn } from "@/lib/utils";

type Occurrence = {
  origem_id: string;
  tipo: "estorno" | "pix_ocorrencia" | "chargeback";
  transacao_id: string;
  pedido_numero: string | null;
  valor: number;
  status: string;
  motivo: string;
  data_ocorrencia: string;
  modo_processamento: string;
  referencia: string | null;
  total_registros: number;
};

type Summary = {
  estornos_concluidos: number;
  estornos_pendentes: number;
  chargebacks_reais: number;
  total_estornos: number;
  total_chargebacks: number;
};

type RefundableTransaction = {
  id: string;
  pedido_numero: string | null;
  valor_bruto: number;
  status: string;
};

const PAGE_SIZE = 25;

const statusLabels: Record<string, string> = {
  solicitado: "Solicitado",
  processando: "Processando",
  aprovado_parcial: "Aprovado parcial",
  aprovado_total: "Aprovado total",
  concluido: "Concluído",
  rejeitado: "Rejeitado",
  cancelado: "Cancelado",
  em_disputa: "Em disputa",
  recebido: "Recebido",
};

const typeLabels: Record<string, string> = {
  estorno: "Estorno / reembolso",
  pix_ocorrencia: "Ocorrência Pix",
  chargeback: "Chargeback",
};

export function RefundsPage() {
  const [rows, setRows] = useState<Occurrence[]>([]);
  const [summary, setSummary] = useState<Summary>({
    estornos_concluidos: 0,
    estornos_pendentes: 0,
    chargebacks_reais: 0,
    total_estornos: 0,
    total_chargebacks: 0,
  });
  const [transactions, setTransactions] = useState<RefundableTransaction[]>([]);
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const requestKey = useRef(crypto.randomUUID());
  const [form, setForm] = useState({
    transacao_id: "",
    valor: "",
    motivo: "",
    detalhes: "",
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [listResult, summaryResult, transactionResult] = await Promise.all([
        (supabase as any).rpc("fn_ocorrencias_financeiras_listar", {
          p_tipo: type || null,
          p_status: status || null,
          p_limit: PAGE_SIZE,
          p_offset: (page - 1) * PAGE_SIZE,
        }),
        (supabase as any).rpc("fn_ocorrencias_financeiras_resumo"),
        supabase
          .from("transacoes")
          .select("id,pedido_numero,valor_bruto,status")
          .in("status", ["aprovada", "capturada", "paga", "disponivel", "estornada_parcial"])
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      if (listResult.error) throw listResult.error;
      if (summaryResult.error) throw summaryResult.error;
      if (transactionResult.error) throw transactionResult.error;

      setRows(
        ((listResult.data ?? []) as any[]).map((row) => ({
          ...row,
          valor: Number(row.valor ?? 0),
          total_registros: Number(row.total_registros ?? 0),
        })),
      );

      const summaryRow = Array.isArray(summaryResult.data)
        ? summaryResult.data[0]
        : summaryResult.data;
      setSummary({
        estornos_concluidos: Number(summaryRow?.estornos_concluidos ?? 0),
        estornos_pendentes: Number(summaryRow?.estornos_pendentes ?? 0),
        chargebacks_reais: Number(summaryRow?.chargebacks_reais ?? 0),
        total_estornos: Number(summaryRow?.total_estornos ?? 0),
        total_chargebacks: Number(summaryRow?.total_chargebacks ?? 0),
      });

      setTransactions(
        ((transactionResult.data ?? []) as any[]).map((row) => ({
          id: String(row.id),
          pedido_numero: row.pedido_numero ? String(row.pedido_numero) : null,
          valor_bruto: Number(row.valor_bruto ?? 0),
          status: String(row.status),
        })),
      );
    } catch (cause) {
      setRows([]);
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar estornos e contestações.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [type, status, page]);

  const total = rows[0]?.total_registros ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const visibleRows = query.trim()
    ? rows.filter((row) =>
        [
          row.pedido_numero,
          row.transacao_id,
          row.motivo,
          row.referencia,
          row.origem_id,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value).toLocaleLowerCase("pt-BR").includes(
              query.trim().toLocaleLowerCase("pt-BR"),
            ),
          ),
      )
    : rows;

  function openRequest() {
    requestKey.current = crypto.randomUUID();
    setForm({ transacao_id: "", valor: "", motivo: "", detalhes: "" });
    setDialogOpen(true);
    setError(null);
  }

  async function submitRefund() {
    const amount = Number(form.valor.replace(",", "."));
    if (!form.transacao_id || !Number.isFinite(amount) || amount <= 0 || !form.motivo.trim()) {
      setError("Selecione a transação, informe um valor e o motivo.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc("fn_estorno_solicitar", {
        p_transacao_id: form.transacao_id,
        p_valor: amount,
        p_motivo: form.motivo.trim(),
        p_detalhes: form.detalhes.trim() || null,
        p_idempotency_key: requestKey.current,
      });
      if (rpcError) throw rpcError;
      if (!data) throw new Error("O banco não confirmou a solicitação.");

      setDialogOpen(false);
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível solicitar o estorno.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Estornos e contestações
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reembolsos e chargebacks permanecem tipos distintos. Solicitar não significa concluir.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-medium hover:bg-muted"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Atualizar
          </button>
          <button
            onClick={openRequest}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            Solicitar estorno
          </button>
        </div>
      </header>

      {error && (
        <div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Estornos concluídos</p>
          <p className="mt-3 text-2xl font-semibold tabular-nums">
            {formatBRL(summary.estornos_concluidos)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatInt(summary.total_estornos)} ocorrência{summary.total_estornos === 1 ? "" : "s"} de estorno
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Aguardando conclusão</p>
          <p className="mt-3 text-2xl font-semibold tabular-nums">
            {formatBRL(summary.estornos_pendentes)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Solicitado/processando não reduz faturamento concluído</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Chargebacks reais</p>
          <p className="mt-3 text-2xl font-semibold tabular-nums">
            {formatBRL(summary.chargebacks_reais)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatInt(summary.total_chargebacks)} registro{summary.total_chargebacks === 1 ? "" : "s"}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Cartão</p>
          <p className="mt-3 text-lg font-semibold">Em breve</p>
          <p className="mt-1 text-xs text-muted-foreground">Nenhum chargeback é simulado enquanto cartão não está operacional.</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3 rounded-xl border border-border bg-card p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar a página por pedido, transação, motivo ou referência"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={type}
          onChange={(e) => { setType(e.target.value); setPage(1); }}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        >
          <option value="">Todos os tipos</option>
          <option value="estorno">Estorno / reembolso</option>
          <option value="pix_ocorrencia">Ocorrência Pix</option>
          <option value="chargeback">Chargeback</option>
        </select>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        >
          <option value="">Todos os estados</option>
          {Object.entries(statusLabels).map(([key,label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Carregando ocorrências...
          </div>
        ) : visibleRows.length === 0 ? (
          <EmptyState
            icon={RotateCcw}
            title="Nenhuma ocorrência encontrada"
            description="Não há estorno, ocorrência Pix ou chargeback real para os filtros atuais."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3">Tipo</th>
                  <th className="px-5 py-3">Pedido / transação</th>
                  <th className="px-5 py-3">Motivo</th>
                  <th className="px-5 py-3 text-right">Valor</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Processamento</th>
                  <th className="px-5 py-3">Referência</th>
                  <th className="px-5 py-3 text-right">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleRows.map((row) => (
                  <tr key={row.origem_id} className="hover:bg-muted/40">
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
                        {row.tipo === "chargeback" && <ShieldAlert className="h-3 w-3" />}
                        {typeLabels[row.tipo] ?? row.tipo}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-mono text-xs">{row.pedido_numero ?? "Sem número"}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{row.transacao_id}</p>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">{row.motivo}</td>
                    <td className="px-5 py-3.5 text-right font-semibold tabular-nums">{formatBRL(row.valor)}</td>
                    <td className="px-5 py-3.5">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
                        {statusLabels[row.status] ?? row.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground">
                      {row.modo_processamento === "manual" ? "Conciliação manual" : "Provedor"}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[11px] text-muted-foreground">{row.referencia ?? "—"}</td>
                    <td className="px-5 py-3.5 text-right text-xs text-muted-foreground">{formatDateTime(row.data_ocorrencia)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rows.length > 0 && (
          <footer className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
            <span>{formatInt(total)} ocorrência{total === 1 ? "" : "s"}</span>
            <div className="flex gap-2">
              <button onClick={()=>setPage(v=>Math.max(1,v-1))} disabled={page<=1} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 disabled:opacity-40"><ChevronLeft className="h-3.5 w-3.5"/>Anterior</button>
              <span className="self-center">{page} / {totalPages}</span>
              <button onClick={()=>setPage(v=>Math.min(totalPages,v+1))} disabled={page>=totalPages} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 disabled:opacity-40">Próxima<ChevronRight className="h-3.5 w-3.5"/></button>
            </div>
          </footer>
        )}
      </section>

      {dialogOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">Solicitar estorno</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  A solicitação ficará pendente até a devolução ser conciliada.
                </p>
              </div>
              <button onClick={()=>setDialogOpen(false)} className="rounded-lg p-2 hover:bg-muted"><X className="h-4 w-4"/></button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-medium">Transação confirmada</span>
                <select
                  value={form.transacao_id}
                  onChange={(e)=>{
                    const tx=transactions.find((item)=>item.id===e.target.value);
                    setForm({...form,transacao_id:e.target.value,valor:tx?String(tx.valor_bruto).replace(".",","):""});
                  }}
                  className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                >
                  <option value="">Selecione</option>
                  {transactions.map((tx)=>(
                    <option key={tx.id} value={tx.id}>
                      {tx.pedido_numero ?? tx.id} · {formatBRL(tx.valor_bruto)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium">Valor solicitado</span>
                <input inputMode="decimal" value={form.valor} onChange={(e)=>setForm({...form,valor:e.target.value})} className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"/>
              </label>
              <label className="block">
                <span className="text-sm font-medium">Motivo</span>
                <input value={form.motivo} onChange={(e)=>setForm({...form,motivo:e.target.value})} className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm" placeholder="Ex.: solicitação do cliente"/>
              </label>
              <label className="block">
                <span className="text-sm font-medium">Detalhes</span>
                <textarea value={form.detalhes} onChange={(e)=>setForm({...form,detalhes:e.target.value})} rows={3} className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"/>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={()=>setDialogOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium">Cancelar</button>
              <button disabled={submitting} onClick={()=>void submitRefund()} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {submitting ? "Solicitando..." : "Criar solicitação"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
