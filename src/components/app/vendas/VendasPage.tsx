import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  RefreshCw,
  Search,
  ShoppingBag,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateTime, formatInt } from "@/lib/format";
import { CardsSkeleton, TableSkeleton } from "@/components/app/Skeletons";
import { EmptyState } from "@/components/app/EmptyState";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  tipo: "principal" | "order_bump";
  produto_id: string | null;
  nome: string;
  preco: number;
  quantidade: number;
  total: number;
};

type Order = {
  pedido_id: string;
  numero: string;
  comprador_nome: string;
  comprador_email: string;
  valor_total: number;
  metodo_pagamento: string;
  status_pedido: string;
  status_pagamento: string;
  criado_em: string;
  confirmado_em: string | null;
  data_referencia: string;
  itens: Item[];
  taxas: number;
  comissoes: number;
  devolvido: number;
  valor_liquido: number;
  total_registros: number;
};

type Summary = {
  pedidos: number;
  pagamentos_pendentes: number;
  pagamentos_confirmados: number;
  faturamento_bruto: number;
  taxas: number;
  comissoes: number;
  devolucoes: number;
  valor_liquido: number;
  ticket_medio: number;
};

const PAGE_SIZE = 25;

const statusOptions = [
  { value: "", label: "Todos" },
  { value: "pendente", label: "Pagamento pendente" },
  { value: "confirmado", label: "Pagamento confirmado" },
  { value: "reembolsado_parcial", label: "Devolução parcial" },
  { value: "reembolsado_total", label: "Devolvido" },
  { value: "falhou", label: "Falhou" },
  { value: "cancelado", label: "Cancelado" },
];

function paymentLabel(status: string) {
  const labels: Record<string, string> = {
    pendente: "Pendente",
    confirmado: "Confirmado",
    falhou: "Falhou",
    cancelado: "Cancelado",
    reembolsado_parcial: "Devolução parcial",
    reembolsado_total: "Devolvido",
  };
  return labels[status] ?? status;
}

function PaymentPill({ status }: { status: string }) {
  const style =
    status === "confirmado"
      ? "bg-emerald-500/10 text-emerald-700"
      : status === "pendente"
        ? "bg-amber-500/10 text-amber-700"
        : status.startsWith("reembolsado")
          ? "bg-violet-500/10 text-violet-700"
          : "bg-rose-500/10 text-rose-700";

  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", style)}>
      {paymentLabel(status)}
    </span>
  );
}

function safeCsvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function VendasPage() {
  const productId = useMemo(
    () => new URLSearchParams(window.location.search).get("produto"),
    [],
  );

  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(id);
  }, [query]);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const params = {
        p_status: status || null,
        p_metodo: null,
        p_busca: debouncedQuery || null,
        p_produto_id: productId || null,
        p_inicio: null,
        p_fim: null,
      };

      const [listResult, summaryResult] = await Promise.all([
        (supabase as any).rpc("fn_vendas_consultar", {
          ...params,
          p_limit: PAGE_SIZE,
          p_offset: (page - 1) * PAGE_SIZE,
        }),
        (supabase as any).rpc("fn_vendas_resumo", params),
      ]);

      if (listResult.error) throw listResult.error;
      if (summaryResult.error) throw summaryResult.error;

      setOrders(
        ((listResult.data ?? []) as any[]).map((row) => ({
          pedido_id: String(row.pedido_id),
          numero: String(row.numero ?? ""),
          comprador_nome: String(row.comprador_nome ?? ""),
          comprador_email: String(row.comprador_email ?? ""),
          valor_total: Number(row.valor_total ?? 0),
          metodo_pagamento: String(row.metodo_pagamento ?? "pix"),
          status_pedido: String(row.status_pedido ?? "criado"),
          status_pagamento: String(row.status_pagamento ?? "pendente"),
          criado_em: String(row.criado_em),
          confirmado_em: row.confirmado_em ? String(row.confirmado_em) : null,
          data_referencia: String(row.data_referencia),
          itens: Array.isArray(row.itens) ? row.itens : [],
          taxas: Number(row.taxas ?? 0),
          comissoes: Number(row.comissoes ?? 0),
          devolvido: Number(row.devolvido ?? 0),
          valor_liquido: Number(row.valor_liquido ?? 0),
          total_registros: Number(row.total_registros ?? 0),
        })),
      );

      const s = Array.isArray(summaryResult.data)
        ? summaryResult.data[0]
        : summaryResult.data;
      setSummary(
        s
          ? {
              pedidos: Number(s.pedidos ?? 0),
              pagamentos_pendentes: Number(s.pagamentos_pendentes ?? 0),
              pagamentos_confirmados: Number(s.pagamentos_confirmados ?? 0),
              faturamento_bruto: Number(s.faturamento_bruto ?? 0),
              taxas: Number(s.taxas ?? 0),
              comissoes: Number(s.comissoes ?? 0),
              devolucoes: Number(s.devolucoes ?? 0),
              valor_liquido: Number(s.valor_liquido ?? 0),
              ticket_medio: Number(s.ticket_medio ?? 0),
            }
          : null,
      );
    } catch (cause) {
      console.error("Falha ao carregar vendas", cause);
      setOrders([]);
      setSummary(null);
      setLoadError(
        cause instanceof Error ? cause.message : "Não foi possível carregar as vendas.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [status, debouncedQuery, page, productId]);

  const totalRecords = orders[0]?.total_registros ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));

  async function exportCsv() {
    if (exporting) return;
    setExporting(true);
    setLoadError(null);
    try {
      const all: Order[] = [];
      let offset = 0;

      while (true) {
        const { data, error } = await (supabase as any).rpc("fn_vendas_consultar", {
          p_status: status || null,
          p_metodo: null,
          p_busca: debouncedQuery || null,
          p_produto_id: productId || null,
          p_inicio: null,
          p_fim: null,
          p_limit: 200,
          p_offset: offset,
        });
        if (error) throw error;
        const rows = (data ?? []) as any[];
        for (const row of rows) {
          all.push({
            ...row,
            valor_total: Number(row.valor_total ?? 0),
            taxas: Number(row.taxas ?? 0),
            comissoes: Number(row.comissoes ?? 0),
            devolvido: Number(row.devolvido ?? 0),
            valor_liquido: Number(row.valor_liquido ?? 0),
            itens: Array.isArray(row.itens) ? row.itens : [],
          } as Order);
        }
        if (rows.length < 200) break;
        offset += 200;
        if (offset >= 10000) break;
      }

      if (all.length === 0) return;

      const header = [
        "Pedido",
        "Comprador",
        "Email",
        "Itens",
        "Valor bruto",
        "Taxas",
        "Comissões",
        "Devoluções",
        "Valor líquido",
        "Método",
        "Situação do pedido",
        "Situação do pagamento",
        "Data de referência",
      ];

      const lines = [
        header.map(safeCsvCell).join(","),
        ...all.map((order) =>
          [
            order.numero,
            order.comprador_nome,
            order.comprador_email,
            order.itens.map((item) => item.nome).join(" | "),
            order.valor_total.toFixed(2),
            order.taxas.toFixed(2),
            order.comissoes.toFixed(2),
            order.devolvido.toFixed(2),
            order.valor_liquido.toFixed(2),
            order.metodo_pagamento,
            order.status_pedido,
            order.status_pagamento,
            order.data_referencia,
          ]
            .map(safeCsvCell)
            .join(","),
        ),
      ].join("\n");

      const url = URL.createObjectURL(
        new Blob(["\ufeff", lines], { type: "text/csv;charset=utf-8" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `vendas-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setLoadError(
        cause instanceof Error ? cause.message : "Não foi possível exportar as vendas.",
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Vendas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pedidos reais, itens comprados e situação financeira confirmada.
          </p>
          {productId && (
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              Filtro de produto: {productId}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Atualizar
          </button>
          <button
            onClick={() => void exportCsv()}
            disabled={exporting || totalRecords === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {exporting ? "Exportando..." : "Exportar CSV"}
          </button>
        </div>
      </header>

      {loadError && (
        <div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      )}

      <div className="mt-6">
        {loading && !summary ? (
          <CardsSkeleton count={4} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">Pedidos</p>
              <p className="mt-3 text-2xl font-semibold tabular-nums">
                {formatInt(summary?.pedidos ?? 0)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatInt(summary?.pagamentos_pendentes ?? 0)} com pagamento pendente
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">Pagamentos confirmados</p>
              <p className="mt-3 text-2xl font-semibold tabular-nums">
                {formatInt(summary?.pagamentos_confirmados ?? 0)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Pix criado não entra neste total
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">Faturamento bruto</p>
              <p className="mt-3 text-2xl font-semibold tabular-nums">
                {formatBRL(summary?.faturamento_bruto ?? 0)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Soma do pedido uma única vez
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">Valor líquido</p>
              <p className="mt-3 text-2xl font-semibold tabular-nums text-primary">
                {formatBRL(summary?.valor_liquido ?? 0)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Bruto − taxas − comissões − devoluções
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por pedido, comprador ou item"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary/60"
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary/60"
        >
          {statusOptions.map((item) => (
            <option key={item.value || "todos"} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Método operacional: Pix
        </div>
      </div>

      <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {loading ? (
          <TableSkeleton rows={7} cols={7} />
        ) : orders.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="Nenhuma venda encontrada"
            description="Nenhum pedido real corresponde aos filtros atuais."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Pedido</th>
                    <th className="px-5 py-3 font-medium">Comprador</th>
                    <th className="px-5 py-3 font-medium">Itens</th>
                    <th className="px-5 py-3 text-right font-medium">Valor</th>
                    <th className="px-5 py-3 font-medium">Pagamento</th>
                    <th className="px-5 py-3 text-right font-medium">Data</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orders.map((order) => {
                    const main = order.itens.find((item) => item.tipo === "principal");
                    const bumps = order.itens.filter((item) => item.tipo === "order_bump");
                    const open = expanded === order.pedido_id;
                    return (
                      <>
                        <tr key={order.pedido_id} className="hover:bg-muted/40">
                          <td className="px-5 py-3.5">
                            <p className="font-mono text-xs text-foreground">{order.numero}</p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {order.status_pedido.replaceAll("_", " ")}
                            </p>
                          </td>
                          <td className="px-5 py-3.5">
                            <p className="font-medium text-foreground">
                              {order.comprador_nome || "Não identificado"}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {order.comprador_email || "—"}
                            </p>
                          </td>
                          <td className="px-5 py-3.5">
                            <p className="font-medium text-foreground">
                              {main?.nome ?? "Produto"}
                            </p>
                            {bumps.length > 0 && (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                + {bumps.length} adicional{bumps.length === 1 ? "" : "is"}
                              </p>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right font-semibold tabular-nums">
                            {formatBRL(order.valor_total)}
                          </td>
                          <td className="px-5 py-3.5">
                            <PaymentPill status={order.status_pagamento} />
                          </td>
                          <td className="px-5 py-3.5 text-right text-xs tabular-nums text-muted-foreground">
                            {formatDateTime(order.data_referencia)}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              onClick={() =>
                                setExpanded(open ? null : order.pedido_id)
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                            >
                              Detalhes
                              {open ? (
                                <ChevronUp className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </td>
                        </tr>
                        {open && (
                          <tr key={`${order.pedido_id}-details`}>
                            <td colSpan={7} className="bg-muted/20 px-5 py-5">
                              <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
                                <div>
                                  <h3 className="text-sm font-semibold">Itens do pedido</h3>
                                  <div className="mt-3 space-y-2">
                                    {order.itens.map((item) => (
                                      <div
                                        key={item.id}
                                        className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-3 py-2.5"
                                      >
                                        <div>
                                          <p className="text-sm font-medium">{item.nome}</p>
                                          <p className="text-[11px] text-muted-foreground">
                                            {item.tipo === "principal"
                                              ? "Produto principal"
                                              : "Order bump"}{" "}
                                            · quantidade {item.quantidade}
                                          </p>
                                        </div>
                                        <span className="font-medium tabular-nums">
                                          {formatBRL(item.total)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                  <p className="mt-3 text-xs text-muted-foreground">
                                    Nomes e preços acima são snapshots da compra e não mudam quando o produto é editado.
                                  </p>
                                </div>
                                <div className="rounded-xl border border-border bg-card p-4">
                                  <h3 className="text-sm font-semibold">Financeiro</h3>
                                  <div className="mt-3 space-y-2 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Bruto</span>
                                      <span>{formatBRL(order.valor_total)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Taxas</span>
                                      <span>- {formatBRL(order.taxas)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Comissões</span>
                                      <span>- {formatBRL(order.comissoes)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Devoluções</span>
                                      <span>- {formatBRL(order.devolvido)}</span>
                                    </div>
                                    <div className="flex justify-between border-t border-border pt-2 font-semibold">
                                      <span>Líquido</span>
                                      <span>{formatBRL(order.valor_liquido)}</span>
                                    </div>
                                  </div>
                                  <div className="mt-4 flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                                    <Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                    A tela não permite marcar o pedido como pago. Confirmações acontecem apenas no fluxo seguro de pagamento/conciliação.
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
              <p className="text-xs text-muted-foreground">
                {formatInt(totalRecords)} registros · página {page} de {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  disabled={page <= 1}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Anterior
                </button>
                <button
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium hover:bg-muted disabled:opacity-40"
                >
                  Próxima <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      <p className="mt-3 text-xs text-muted-foreground">
        Data de referência: confirmação do pagamento; enquanto pendente, criação do pedido. Valores monetários usam o pedido como unidade, não os itens, evitando duplicação.
      </p>
    </div>
  );
}
