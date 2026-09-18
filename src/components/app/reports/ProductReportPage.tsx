import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Package, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatInt } from "@/lib/format";
import { EmptyState } from "@/components/app/EmptyState";
import { cn } from "@/lib/utils";
import {
  downloadCsv,
  reportDateRange,
  reportPeriods,
  type ReportDefinitions,
  type ReportPeriod,
} from "@/components/app/reports/report-utils";

type ProductRow = {
  produto_id: string | null;
  produto_nome: string;
  status_atual: string;
  pedidos_confirmados: number;
  unidades: number;
  receita_bruta_itens: number;
  devolucoes_rateadas: number;
  receita_liquida_devolucoes: number;
  comissao_snapshot: number;
  ticket_medio_item: number;
};

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function ProductReportPage() {
  const [period, setPeriod] = useState<ReportPeriod>("30d");
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [definitions, setDefinitions] = useState<ReportDefinitions>({});
  const [range, setRange] = useState(() =>
    reportDateRange("30d", "America/Sao_Paulo"),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const definitionResult = await (supabase as any).rpc(
        "fn_relatorio_definicoes",
      );
      if (definitionResult.error) throw definitionResult.error;

      const defs = (definitionResult.data ?? {}) as ReportDefinitions;
      const timezone = defs.timezone || "America/Sao_Paulo";
      const nextRange = reportDateRange(period, timezone);

      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_relatorio_produtos",
        {
          p_inicio: nextRange.start,
          p_fim: nextRange.end,
        },
      );
      if (rpcError) throw rpcError;

      setDefinitions(defs);
      setRange(nextRange);
      setRows(
        ((data ?? []) as any[]).map((item) => ({
          produto_id: item.produto_id ? String(item.produto_id) : null,
          produto_nome: String(item.produto_nome ?? "Produto"),
          status_atual: String(item.status_atual ?? ""),
          pedidos_confirmados: Number(item.pedidos_confirmados ?? 0),
          unidades: Number(item.unidades ?? 0),
          receita_bruta_itens: Number(item.receita_bruta_itens ?? 0),
          devolucoes_rateadas: Number(item.devolucoes_rateadas ?? 0),
          receita_liquida_devolucoes: Number(
            item.receita_liquida_devolucoes ?? 0,
          ),
          comissao_snapshot: Number(item.comissao_snapshot ?? 0),
          ticket_medio_item: Number(item.ticket_medio_item ?? 0),
        })),
      );
    } catch (cause) {
      setRows([]);
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar o relatório de produtos.",
      );
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          acc.units += row.unidades;
          acc.gross += row.receita_bruta_itens;
          acc.refunds += row.devolucoes_rateadas;
          acc.net += row.receita_liquida_devolucoes;
          acc.commission += row.comissao_snapshot;
          return acc;
        },
        {
          units: 0,
          gross: 0,
          refunds: 0,
          net: 0,
          commission: 0,
        },
      ),
    [rows],
  );

  const averageUnitTicket =
    totals.units > 0 ? totals.gross / totals.units : 0;

  function exportReport() {
    downloadCsv(
      `relatorio-produtos-${range.start}-a-${range.end}.csv`,
      [
        "Produto",
        "Status atual",
        "Pedidos confirmados",
        "Unidades",
        "Receita bruta itens",
        "Devoluções rateadas",
        "Receita líquida devoluções",
        "Comissão snapshot",
        "Ticket médio unidade",
      ],
      rows.map((row) => [
        row.produto_nome,
        row.status_atual,
        row.pedidos_confirmados,
        row.unidades,
        row.receita_bruta_itens.toFixed(2),
        row.devolucoes_rateadas.toFixed(2),
        row.receita_liquida_devolucoes.toFixed(2),
        row.comissao_snapshot.toFixed(2),
        row.ticket_medio_item.toFixed(2),
      ]),
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Relatório de Produtos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vendas por snapshot de item, preservando nome e preço da compra.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw
              className={cn("h-4 w-4", loading && "animate-spin")}
            />
            Atualizar
          </button>
          <button
            onClick={exportReport}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </button>
        </div>
      </header>

      {error && (
        <div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-1.5 rounded-xl border border-border bg-card p-3">
        {reportPeriods.map((option) => (
          <button
            key={option.key}
            onClick={() => setPeriod(option.key)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium",
              period === option.key
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {option.label}
          </button>
        ))}
        <span className="ml-auto self-center text-xs text-muted-foreground">
          {range.start} → {range.end} ·{" "}
          {definitions.timezone ?? "America/Sao_Paulo"}
        </span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi
          label="Produtos com venda"
          value={formatInt(rows.length)}
          hint="Produtos presentes em itens confirmados"
        />
        <Kpi
          label="Unidades"
          value={formatInt(totals.units)}
          hint="Quantidade dos itens vendidos"
        />
        <Kpi
          label="Receita bruta itens"
          value={formatBRL(totals.gross)}
          hint="Soma do snapshot dos itens"
        />
        <Kpi
          label="Devoluções rateadas"
          value={formatBRL(totals.refunds)}
          hint="Rateio proporcional da devolução do pedido"
        />
        <Kpi
          label="Líquido devoluções"
          value={formatBRL(totals.net)}
          hint="Bruto dos itens menos devoluções"
        />
        <Kpi
          label="Ticket por unidade"
          value={formatBRL(averageUnitTicket)}
          hint="Receita bruta dos itens ÷ unidades"
        />
      </div>

      <section className="mt-5 overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Produtos vendidos</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            O status é atual do catálogo; os valores financeiros permanecem os
            snapshots históricos da compra.
          </p>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Carregando produtos...
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Nenhum produto vendido no período"
            description="Nenhum dado demonstrativo é inserido no estado vazio."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3">Produto</th>
                  <th className="px-5 py-3">Status atual</th>
                  <th className="px-5 py-3 text-right">Pedidos</th>
                  <th className="px-5 py-3 text-right">Unidades</th>
                  <th className="px-5 py-3 text-right">Bruto</th>
                  <th className="px-5 py-3 text-right">Devoluções</th>
                  <th className="px-5 py-3 text-right">Líquido</th>
                  <th className="px-5 py-3 text-right">
                    Comissão snapshot
                  </th>
                  <th className="px-5 py-3 text-right">Ticket/unidade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr
                    key={row.produto_id ?? row.produto_nome}
                    className="hover:bg-muted/40"
                  >
                    <td className="px-5 py-3.5 font-medium">
                      {row.produto_nome}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] capitalize text-muted-foreground">
                        {row.status_atual || "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums">
                      {formatInt(row.pedidos_confirmados)}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums">
                      {formatInt(row.unidades)}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums">
                      {formatBRL(row.receita_bruta_itens)}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-destructive">
                      {row.devolucoes_rateadas > 0
                        ? formatBRL(row.devolucoes_rateadas)
                        : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold tabular-nums">
                      {formatBRL(row.receita_liquida_devolucoes)}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums">
                      {formatBRL(row.comissao_snapshot)}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-muted-foreground">
                      {formatBRL(row.ticket_medio_item)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
        <strong className="text-foreground">Critério:</strong> cada produto é
        agregado a partir de pedido_itens. O pedido é usado apenas como origem
        do pagamento e da devolução, evitando multiplicar o valor total quando
        existem order bumps.
      </div>
    </div>
  );
}
