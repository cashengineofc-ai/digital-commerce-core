import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  RotateCcw,
  Wallet,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Withdraw = {
  id: string;
  protocolo: string;
  empresa_id: string | null;
  empresa_nome: string;
  solicitante: string;
  valor_solicitado: number;
  taxa_saque: number;
  valor_liquido: number;
  status: string;
  modo_processamento: string;
  destino: Record<string, unknown>;
  data_solicitacao: string;
  data_pagamento: string | null;
  referencia_conciliacao: string | null;
  total_registros: number;
};

type Refund = {
  id: string;
  protocolo: string;
  empresa_id: string;
  empresa_nome: string;
  transacao_id: string;
  pedido_numero: string | null;
  valor_original: number;
  valor_solicitado: number;
  valor_efetivo: number;
  status: string;
  motivo: string;
  modo_processamento: string;
  data_solicitacao: string;
  data_conclusao: string | null;
  referencia_conciliacao: string | null;
  total_registros: number;
};

type ReconcileDialog =
  | { type: "withdraw"; row: Withdraw }
  | { type: "refund"; row: Refund }
  | null;

const PAGE_SIZE = 30;

const withdrawLabels: Record<string, string> = {
  solicitado: "Solicitado",
  em_analise: "Em análise",
  aprovado: "Aprovado",
  em_processamento: "Em processamento",
  enviado: "Enviado",
  pago: "Pago",
  recusado: "Recusado",
  cancelado: "Cancelado",
  falhou: "Falhou",
};

const refundLabels: Record<string, string> = {
  solicitado: "Solicitado",
  processando: "Processando",
  aprovado_parcial: "Aprovado parcial",
  aprovado_total: "Aprovado total",
  concluido: "Concluído",
  rejeitado: "Rejeitado",
  cancelado: "Cancelado",
  em_disputa: "Em disputa",
};

export function AdminFinancePage() {
  const [tab, setTab] = useState<"withdrawals" | "refunds">("withdrawals");
  const [withdrawals, setWithdrawals] = useState<Withdraw[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [withdrawStatus, setWithdrawStatus] = useState("");
  const [refundStatus, setRefundStatus] = useState("");
  const [withdrawPage, setWithdrawPage] = useState(1);
  const [refundPage, setRefundPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dialog, setDialog] = useState<ReconcileDialog>(null);
  const [reference, setReference] = useState("");
  const [evidence, setEvidence] = useState("");
  const [effectiveAmount, setEffectiveAmount] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [withdrawResult, refundResult] = await Promise.all([
        (supabase as any).rpc("fn_admin_saques_operacionais", {
          p_status: withdrawStatus || null,
          p_limit: PAGE_SIZE,
          p_offset: (withdrawPage - 1) * PAGE_SIZE,
        }),
        (supabase as any).rpc("fn_admin_estornos_operacionais", {
          p_status: refundStatus || null,
          p_limit: PAGE_SIZE,
          p_offset: (refundPage - 1) * PAGE_SIZE,
        }),
      ]);

      if (withdrawResult.error) throw withdrawResult.error;
      if (refundResult.error) throw refundResult.error;

      setWithdrawals(
        ((withdrawResult.data ?? []) as any[]).map((row) => ({
          ...row,
          valor_solicitado: Number(row.valor_solicitado ?? 0),
          taxa_saque: Number(row.taxa_saque ?? 0),
          valor_liquido: Number(row.valor_liquido ?? 0),
          total_registros: Number(row.total_registros ?? 0),
        })),
      );

      setRefunds(
        ((refundResult.data ?? []) as any[]).map((row) => ({
          ...row,
          valor_original: Number(row.valor_original ?? 0),
          valor_solicitado: Number(row.valor_solicitado ?? 0),
          valor_efetivo: Number(row.valor_efetivo ?? 0),
          total_registros: Number(row.total_registros ?? 0),
        })),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar as operações financeiras.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [withdrawStatus, refundStatus, withdrawPage, refundPage]);

  async function transitionWithdraw(
    id: string,
    nextStatus: "em_analise" | "aprovado" | "processando" | "rejeitado" | "falhou",
    reason?: string,
  ) {
    setActing(true);
    setError(null);
    setMessage(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_admin_saque_transicionar",
        {
          p_saque_id: id,
          p_novo_status: nextStatus,
          p_motivo: reason?.trim() || null,
        },
      );
      if (rpcError) throw rpcError;
      if (!data) throw new Error("A transição não foi confirmada.");
      setMessage("Status do saque atualizado e auditado.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível atualizar o saque.");
    } finally {
      setActing(false);
    }
  }

  async function rejectWithdraw(row: Withdraw) {
    const reason = window.prompt("Motivo obrigatório da recusa:");
    if (!reason?.trim()) return;
    await transitionWithdraw(row.id, "rejeitado", reason);
  }

  async function failWithdraw(row: Withdraw) {
    const reason = window.prompt("Descreva a falha definitiva:");
    if (!reason?.trim()) return;
    await transitionWithdraw(row.id, "falhou", reason);
  }

  async function rejectRefund(row: Refund) {
    const reason = window.prompt("Motivo obrigatório da rejeição:");
    if (!reason?.trim()) return;

    setActing(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_admin_estorno_rejeitar",
        { p_estorno_id: row.id, p_motivo: reason.trim() },
      );
      if (rpcError) throw rpcError;
      if (!data) throw new Error("A rejeição não foi confirmada.");
      setMessage("Solicitação de estorno rejeitada e auditada.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível rejeitar.");
    } finally {
      setActing(false);
    }
  }

  function openWithdrawReconciliation(row: Withdraw) {
    setDialog({ type: "withdraw", row });
    setReference("");
    setEvidence("");
    setEffectiveAmount(String(row.valor_liquido).replace(".", ","));
  }

  function openRefundReconciliation(row: Refund) {
    setDialog({ type: "refund", row });
    setReference("");
    setEvidence("");
    setEffectiveAmount(String(row.valor_solicitado).replace(".", ","));
  }

  async function reconcile() {
    if (!dialog || !reference.trim() || !evidence.trim()) {
      setError("Referência e evidência são obrigatórias para conciliar.");
      return;
    }

    setActing(true);
    setError(null);
    setMessage(null);
    try {
      if (dialog.type === "withdraw") {
        const { data, error: rpcError } = await (supabase as any).rpc(
          "fn_admin_saque_registrar_pagamento_manual",
          {
            p_saque_id: dialog.row.id,
            p_referencia_bancaria: reference.trim(),
            p_evidencia: evidence.trim(),
            p_data_pagamento: new Date().toISOString(),
          },
        );
        if (rpcError) throw rpcError;
        if (!data) throw new Error("O pagamento não foi conciliado.");
        setMessage(
          "Saque marcado como pago somente após a referência/evidência informada.",
        );
      } else {
        const amount = Number(effectiveAmount.replace(",", "."));
        if (
          !Number.isFinite(amount) ||
          amount <= 0 ||
          amount > dialog.row.valor_solicitado
        ) {
          throw new Error("Valor efetivo inválido.");
        }

        const { data, error: rpcError } = await (supabase as any).rpc(
          "fn_admin_estorno_conciliar_manual",
          {
            p_estorno_id: dialog.row.id,
            p_valor_efetivo: amount,
            p_referencia: reference.trim(),
            p_evidencia: evidence.trim(),
            p_data_conclusao: new Date().toISOString(),
          },
        );
        if (rpcError) throw rpcError;
        if (!data) throw new Error("O estorno não foi conciliado.");
        setMessage(
          "Estorno concluído com reversão proporcional de saldos, comissões e split.",
        );
      }

      setDialog(null);
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível conciliar a operação.",
      );
    } finally {
      setActing(false);
    }
  }

  const withdrawTotal = withdrawals[0]?.total_registros ?? 0;
  const withdrawPages = Math.max(1, Math.ceil(withdrawTotal / PAGE_SIZE));
  const refundTotal = refunds[0]?.total_registros ?? 0;
  const refundPages = Math.max(1, Math.ceil(refundTotal / PAGE_SIZE));

  return (
    <div className="mx-auto w-full max-w-[1500px]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Operações financeiras
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Análise, aprovação e conciliação. Nenhuma transferência bancária é executada por esta tela.
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading || acting}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
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
      {message && (
        <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      )}

      <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-muted-foreground">
        Aprovar um saque não significa pagar. O status “Pago” só é gravado após conciliação manual com referência/evidência, ou futuramente após confirmação autenticada de um provedor de payout.
      </div>

      <div className="mt-6 flex gap-1 rounded-xl border border-border bg-card p-1">
        <button
          onClick={() => setTab("withdrawals")}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
            tab === "withdrawals"
              ? "bg-destructive text-destructive-foreground"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          <Wallet className="h-4 w-4" />
          Saques
        </button>
        <button
          onClick={() => setTab("refunds")}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
            tab === "refunds"
              ? "bg-destructive text-destructive-foreground"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          <RotateCcw className="h-4 w-4" />
          Estornos
        </button>
      </div>

      {tab === "withdrawals" && (
        <section className="mt-5 overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
            <div>
              <h2 className="font-semibold">Fila de saques</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Destino congelado no momento da solicitação.
              </p>
            </div>
            <select
              value={withdrawStatus}
              onChange={(e) => {
                setWithdrawStatus(e.target.value);
                setWithdrawPage(1);
              }}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="">Todos os estados</option>
              {Object.entries(withdrawLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1320px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Protocolo</th>
                  <th className="px-4 py-3">Empresa / solicitante</th>
                  <th className="px-4 py-3">Destino</th>
                  <th className="px-4 py-3 text-right">Solicitado</th>
                  <th className="px-4 py-3 text-right">Taxa</th>
                  <th className="px-4 py-3 text-right">Líquido</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                      Carregando saques...
                    </td>
                  </tr>
                ) : withdrawals.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                      Nenhum saque para os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  withdrawals.map((row) => {
                    const pix = row.destino?.["chave_pix"];
                    const destination = pix
                      ? `${String(row.destino?.["banco_nome"] ?? "Banco")} · Pix ${String(pix)}`
                      : `${String(row.destino?.["banco_nome"] ?? "Banco")} · Ag. ${String(row.destino?.["agencia"] ?? "—")} · Conta ${String(row.destino?.["conta"] ?? "—")}`;

                    return (
                      <tr key={row.id} className="hover:bg-muted/40">
                        <td className="px-4 py-3 font-mono text-xs">{row.protocolo}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{row.empresa_nome}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {row.solicitante}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {destination}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatBRL(row.valor_solicitado)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatBRL(row.taxa_saque)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">
                          {formatBRL(row.valor_liquido)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
                            {withdrawLabels[row.status] ?? row.status}
                          </span>
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {row.modo_processamento === "manual"
                              ? "Manual"
                              : "Provedor"}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {formatDateTime(row.data_pagamento ?? row.data_solicitacao)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1.5">
                            {row.status === "solicitado" && (
                              <button
                                onClick={() =>
                                  void transitionWithdraw(row.id, "em_analise")
                                }
                                disabled={acting}
                                className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                              >
                                Analisar
                              </button>
                            )}
                            {row.status === "em_analise" && (
                              <>
                                <button
                                  onClick={() =>
                                    void transitionWithdraw(row.id, "aprovado")
                                  }
                                  disabled={acting}
                                  className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-1.5 text-xs font-medium text-emerald-700"
                                >
                                  Aprovar
                                </button>
                                <button
                                  onClick={() => void rejectWithdraw(row)}
                                  disabled={acting}
                                  className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                                >
                                  Recusar
                                </button>
                              </>
                            )}
                            {row.status === "aprovado" && (
                              <button
                                onClick={() =>
                                  void transitionWithdraw(row.id, "processando")
                                }
                                disabled={acting}
                                className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                              >
                                Em processamento
                              </button>
                            )}
                            {["aprovado", "em_processamento", "enviado"].includes(
                              row.status,
                            ) && (
                              <button
                                onClick={() => openWithdrawReconciliation(row)}
                                disabled={acting}
                                className="rounded-lg bg-destructive px-2.5 py-1.5 text-xs font-semibold text-destructive-foreground"
                              >
                                Conciliar pagamento
                              </button>
                            )}
                            {["aprovado", "em_processamento", "enviado"].includes(
                              row.status,
                            ) && (
                              <button
                                onClick={() => void failWithdraw(row)}
                                disabled={acting}
                                className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                              >
                                Falha definitiva
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <footer className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <span>{withdrawTotal} saque{withdrawTotal === 1 ? "" : "s"}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setWithdrawPage((value) => Math.max(1, value - 1))}
                disabled={withdrawPage <= 1}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Anterior
              </button>
              <span className="self-center">
                {withdrawPage} / {withdrawPages}
              </span>
              <button
                onClick={() =>
                  setWithdrawPage((value) => Math.min(withdrawPages, value + 1))
                }
                disabled={withdrawPage >= withdrawPages}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 disabled:opacity-40"
              >
                Próxima
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </footer>
        </section>
      )}

      {tab === "refunds" && (
        <section className="mt-5 overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
            <div>
              <h2 className="font-semibold">Fila de estornos</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                A conciliação efetiva é o momento que atualiza venda, split e saldos.
              </p>
            </div>
            <select
              value={refundStatus}
              onChange={(e) => {
                setRefundStatus(e.target.value);
                setRefundPage(1);
              }}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="">Todos os estados</option>
              {Object.entries(refundLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1250px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Protocolo</th>
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">Pedido</th>
                  <th className="px-4 py-3">Motivo</th>
                  <th className="px-4 py-3 text-right">Original</th>
                  <th className="px-4 py-3 text-right">Solicitado</th>
                  <th className="px-4 py-3 text-right">Efetivo</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                      Carregando estornos...
                    </td>
                  </tr>
                ) : refunds.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                      Nenhum estorno para os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  refunds.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/40">
                      <td className="px-4 py-3 font-mono text-xs">{row.protocolo}</td>
                      <td className="px-4 py-3 font-medium">{row.empresa_nome}</td>
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs">
                          {row.pedido_numero ?? "Sem número"}
                        </p>
                        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                          {row.transacao_id}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{row.motivo}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatBRL(row.valor_original)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatBRL(row.valor_solicitado)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {formatBRL(row.valor_efetivo)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
                          {refundLabels[row.status] ?? row.status}
                        </span>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {row.modo_processamento === "manual" ? "Manual" : "Provedor"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          {!["concluido", "rejeitado", "cancelado"].includes(
                            row.status,
                          ) && (
                            <>
                              <button
                                onClick={() => openRefundReconciliation(row)}
                                disabled={acting}
                                className="rounded-lg bg-destructive px-2.5 py-1.5 text-xs font-semibold text-destructive-foreground"
                              >
                                Conciliar devolução
                              </button>
                              <button
                                onClick={() => void rejectRefund(row)}
                                disabled={acting}
                                className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                              >
                                Rejeitar
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <footer className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <span>{refundTotal} estorno{refundTotal === 1 ? "" : "s"}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setRefundPage((value) => Math.max(1, value - 1))}
                disabled={refundPage <= 1}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Anterior
              </button>
              <span className="self-center">
                {refundPage} / {refundPages}
              </span>
              <button
                onClick={() =>
                  setRefundPage((value) => Math.min(refundPages, value + 1))
                }
                disabled={refundPage >= refundPages}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 disabled:opacity-40"
              >
                Próxima
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </footer>
        </section>
      )}

      {dialog && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  {dialog.type === "withdraw"
                    ? "Conciliar pagamento do saque"
                    : "Conciliar estorno"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Esta ação confirma um evento financeiro que ocorreu fora desta tela.
                </p>
              </div>
              <button
                onClick={() => setDialog(null)}
                className="rounded-lg p-2 hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {dialog.type === "refund" && (
              <label className="mt-5 block">
                <span className="text-sm font-medium">Valor efetivamente devolvido</span>
                <input
                  inputMode="decimal"
                  value={effectiveAmount}
                  onChange={(e) => setEffectiveAmount(e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
                <span className="mt-1 block text-xs text-muted-foreground">
                  Solicitado: {formatBRL(dialog.row.valor_solicitado)}
                </span>
              </label>
            )}

            <label className="mt-4 block">
              <span className="text-sm font-medium">
                Referência bancária / comprovante
              </span>
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                placeholder="Identificador da operação"
              />
            </label>

            <label className="mt-4 block">
              <span className="text-sm font-medium">Evidência</span>
              <textarea
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                rows={3}
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                placeholder="URL segura do comprovante ou referência documental"
              />
            </label>

            <div className="mt-5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-muted-foreground">
              Não use esta tela para simular testes com dinheiro real. Registre somente operações que
              efetivamente ocorreram e foram conferidas.
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setDialog(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={() => void reconcile()}
                disabled={acting}
                className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {acting ? "Registrando..." : "Confirmar conciliação"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
