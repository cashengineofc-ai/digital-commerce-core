import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Network, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatInt, formatPct } from "@/lib/format";
import { EmptyState } from "@/components/app/EmptyState";
import { cn } from "@/lib/utils";
import {
  downloadCsv,
  reportDateRange,
  reportPeriods,
  type ReportDefinitions,
  type ReportPeriod,
} from "@/components/app/reports/report-utils";

type AffiliateRow = {
  afiliado_id: string;
  afiliado_nome: string;
  cliques: number;
  vendas_confirmadas: number;
  faturamento_bruto: number;
  devolucoes: number;
  faturamento_liquido_devolucoes: number;
  comissao_original: number;
  comissao_estornada: number;
  comissao_reconhecida: number;
  conversao: number;
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

export function AffiliateReportPage() {
  const [period, setPeriod] = useState<ReportPeriod>("30d");
  const [rows, setRows] = useState<AffiliateRow[]>([]);
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
        "fn_relatorio_afiliados",
        {
          p_inicio: nextRange.start,
          p_fim: nextRange.end,
        },
      );
      if (rpcError) throw rpcError;

      setDefinitions(defs);
      setRange(nextRange);
      setRows(
        ((data ?? []) as any[]).map((row) => ({
          afiliado_id: String(row.afiliado_id),
          afiliado_nome: String(row.afiliado_nome ?? "Afiliado"),
          cliques: Number(row.cliques ?? 0),
          vendas_confirmadas: Number(row.vendas_confirmadas ?? 0),
          faturamento_bruto: Number(row.faturamento_bruto ?? 0),
          devolucoes: Number(row.devolucoes ?? 0),
          faturamento_liquido_devolucoes: Number(
            row.faturamento_liquido_devolucoes ?? 0,
          ),
          comissao_original: Number(row.comissao_original ?? 0),
          comissao_estornada: Number(row.comissao_estornada ?? 0),
          comissao_reconhecida: Number(row.comissao_reconhecida ?? 0),
          conversao: Number(row.conversao ?? 0),
        })),
      );
    } catch (cause) {
      setRows([]);
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar o relatório de afiliados.",
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
          acc.clicks += row.cliques;
          acc.sales += row.vendas_confirmadas;
          acc.gross += row.faturamento_bruto;
          acc.refunds += row.devolucoes;
          acc.net += row.faturamento_liquido_devolucoes;
          acc.commission += row.comissao_reconhecida;
          return acc;
        },
        {
          clicks: 0,
          sales: 0,
          gross: 0,
          refunds: 0,
          net: 0,
          commission: 0,
        },
      ),
    [rows],
  );

  const networkConversion =
    totals.clicks > 0 ? (totals.sales / totals.clicks) * 100 : 0;
  const affiliatesWithSales = rows.filter(
    (row) => row.vendas_confirmadas > 0,
  ).length;

  function exportReport() {
    downloadCsv(
      `relatorio-afiliados-${range.start}-a-${range.end}.csv`,
      [
        "Afiliado",
        "Cliques válidos",
        "Vendas confirmadas",
        "Faturamento bruto",
        "Devoluções",
        "Líquido de devoluções",
        "Comissão original",
        "Comissão estornada",
        "Comissão reconhecida",
        "Conversão",
      ],
      rows.map((row) => [
        row.afiliado_nome,
        row.cliques,
        row.vendas_confirmadas,
        row.faturamento_bruto.toFixed(2),
        row.devolucoes.toFixed(2),
        row.faturamento_liquido_devolucoes.toFixed(2),
        row.comissao_original.toFixed(2),
        row.comissao_estornada.toFixed(2),
        row.comissao_reconhecida.toFixed(2),
        row.conversao.toFixed(2),
      ]),
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Relatório de Afiliados
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cliques válidos, pagamentos atribuídos e comissões congeladas na venda.
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
          label="Afiliados com venda"
          value={formatInt(affiliatesWithSales)}
          hint="Vínculos com ao menos uma venda confirmada"
        />
        <Kpi
          label="Cliques válidos"
          value={formatInt(totals.clicks)}
          hint="Com deduplicação básica de rastreio"
        />
        <Kpi
          label="Vendas confirmadas"
          value={formatInt(totals.sales)}
          hint="Atribuição preservada no pedido"
        />
        <Kpi
          label="Conversão da rede"
          value={formatPct(networkConversion, 2)}
          hint="Vendas confirmadas ÷ cliques válidos"
        />
        <Kpi
          label="Líquido de devoluções"
          value={formatBRL(totals.net)}
          hint="Bruto menos devoluções conciliadas"
        />
        <Kpi
          label="Comissão reconhecida"
          value={formatBRL(totals.commission)}
          hint="Original menos reversões conciliadas"
        />
      </div>

      <section className="mt-5 overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Performance por afiliado</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Ordenado pelo faturamento bruto confirmado no período.
          </p>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Carregando afiliados...
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Network}
            title="Nenhuma operação afiliada no período"
            description="O relatório permanece vazio quando não há cliques ou vendas reais no intervalo."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3">Afiliado</th>
                  <th className="px-5 py-3 text-right">Cliques</th>
                  <th className="px-5 py-3 text-right">Vendas</th>
                  <th className="px-5 py-3 text-right">Conversão</th>
                  <th className="px-5 py-3 text-right">Bruto</th>
                  <th className="px-5 py-3 text-right">Devoluções</th>
                  <th className="px-5 py-3 text-right">Líquido</th>
                  <th className="px-5 py-3 text-right">Comissão original</th>
                  <th className="px-5 py-3 text-right">Revertida</th>
                  <th className="px-5 py-3 text-right">Reconhecida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.afiliado_id} className="hover:bg-muted/40">
                    <td className="px-5 py-3.5 font-medium">
                      {row.afiliado_nome}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums">
                      {formatInt(row.cliques)}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums">
                      {formatInt(row.vendas_confirmadas)}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums">
                      {formatPct(row.conversao, 2)}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums">
                      {formatBRL(row.faturamento_bruto)}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-destructive">
                      {row.devolucoes > 0
                        ? formatBRL(row.devolucoes)
                        : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold tabular-nums">
                      {formatBRL(row.faturamento_liquido_devolucoes)}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums">
                      {formatBRL(row.comissao_original)}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-destructive">
                      {row.comissao_estornada > 0
                        ? formatBRL(row.comissao_estornada)
                        : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold tabular-nums text-primary">
                      {formatBRL(row.comissao_reconhecida)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
        <strong className="text-foreground">Comissões:</strong>{" "}
        {definitions.comissoes ??
          "A comissão é congelada na venda confirmada e reversões aparecem separadamente."}
      </div>
    </div>
  );
}
