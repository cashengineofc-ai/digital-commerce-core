import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, ShoppingBag } from "lucide-react";
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

type Summary = {
  timezone: string;
  pedidos_criados: number;
  pedidos_pendentes: number;
  pagamentos_confirmados: number;
  faturamento_bruto: number;
  devolucoes: number;
  faturamento_liquido_devolucoes: number;
  taxas_plataforma: number;
  comissoes_originais: number;
  comissoes_estornadas: number;
  comissoes_reconhecidas: number;
  ticket_medio: number;
};

type DailyRow = {
  dia: string;
  pedidos: number;
  faturamento_bruto: number;
  devolucoes: number;
  faturamento_liquido_devolucoes: number;
};

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
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function SalesReportPage() {
  const [period, setPeriod] = useState<ReportPeriod>("30d");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
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

      const [summaryResult, dailyResult, productsResult] = await Promise.all([
        (supabase as any).rpc("fn_relatorio_resumo", {
          p_inicio: nextRange.start,
          p_fim: nextRange.end,
          p_metodo: "pix",
        }),
        (supabase as any).rpc("fn_relatorio_vendas_diario", {
          p_inicio: nextRange.start,
          p_fim: nextRange.end,
          p_metodo: "pix",
        }),
        (supabase as any).rpc("fn_relatorio_produtos", {
          p_inicio: nextRange.start,
          p_fim: nextRange.end,
        }),
      ]);

      if (summaryResult.error) throw summaryResult.error;
      if (dailyResult.error) throw dailyResult.error;
      if (productsResult.error) throw productsResult.error;

      const row = Array.isArray(summaryResult.data)
        ? summaryResult.data[0]
        : summaryResult.data;

      setDefinitions(defs);
      setRange(nextRange);
      setSummary({
        timezone: String(row?.timezone ?? timezone),
        pedidos_criados: Number(row?.pedidos_criados ?? 0),
        pedidos_pendentes: Number(row?.pedidos_pendentes ?? 0),
        pagamentos_confirmados: Number(row?.pagamentos_confirmados ?? 0),
        faturamento_bruto: Number(row?.faturamento_bruto ?? 0),
        devolucoes: Number(row?.devolucoes ?? 0),
        faturamento_liquido_devolucoes: Number(
          row?.faturamento_liquido_devolucoes ?? 0,
        ),
        taxas_plataforma: Number(row?.taxas_plataforma ?? 0),
        comissoes_originais: Number(row?.comissoes_originais ?? 0),
        comissoes_estornadas: Number(row?.comissoes_estornadas ?? 0),
        comissoes_reconhecidas: Number(row?.comissoes_reconhecidas ?? 0),
        ticket_medio: Number(row?.ticket_medio ?? 0),
      });

      setDaily(
        ((dailyResult.data ?? []) as any[]).map((item) => ({
          dia: String(item.dia),
          pedidos: Number(item.pedidos ?? 0),
          faturamento_bruto: Number(item.faturamento_bruto ?? 0),
          devolucoes: Number(item.devolucoes ?? 0),
          faturamento_liquido_devolucoes: Number(
            item.faturamento_liquido_devolucoes ?? 0,
          ),
        })),
      );

      setProducts(
        ((productsResult.data ?? []) as any[]).map((item) => ({
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
      setSummary(null);
      setDaily([]);
      setProducts([]);
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar o relatório de vendas.",
      );
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  const maxDaily = useMemo(
    () =>
      Math.max(
        0,
        ...daily.map((item) => item.faturamento_liquido_devolucoes),
      ),
    [daily],
  );

  function exportReport() {
    downloadCsv(
      `relatorio-vendas-${range.start}-a-${range.end}.csv`,
      [
        "Produto",
        "Status atual",
        "Pedidos confirmados",
        "Unidades",
        "Receita bruta dos itens",
        "Devoluções rateadas",
        "Receita líquida de devoluções",
        "Comissão snapshot",
        "Ticket médio por unidade",
      ],
      products.map((product) => [
        product.produto_nome,
        product.status_atual,
        product.pedidos_confirmados,
        product.unidades,
        product.receita_bruta_itens.toFixed(2),
        product.devolucoes_rateadas.toFixed(2),
        product.receita_liquida_devolucoes.toFixed(2),
        product.comissao_snapshot.toFixed(2),
        product.ticket_medio_item.toFixed(2),
      ]),
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Relatório de Vendas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pedidos e pagamentos reais. Método operacional atual: Pix.
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
            disabled={products.length === 0}
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
          {summary?.timezone ?? definitions.timezone ?? "America/Sao_Paulo"}
        </span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi
          label="Pedidos criados"
          value={formatInt(summary?.pedidos_criados ?? 0)}
          hint="Criados dentro do período"
        />
        <Kpi
          label="Pendentes"
          value={formatInt(summary?.pedidos_pendentes ?? 0)}
          hint="Ainda sem pagamento confirmado"
        />
        <Kpi
          label="Pagamentos confirmados"
          value={formatInt(summary?.pagamentos_confirmados ?? 0)}
          hint="Inclui pedidos depois reembolsados"
        />
        <Kpi
          label="Faturamento bruto"
          value={formatBRL(summary?.faturamento_bruto ?? 0)}
          hint="Valor confirmado antes das devoluções"
        />
        <Kpi
          label="Devoluções"
          value={formatBRL(summary?.devolucoes ?? 0)}
          hint="Somente devoluções conciliadas"
        />
        <Kpi
          label="Líquido de devoluções"
          value={formatBRL(
            summary?.faturamento_liquido_devolucoes ?? 0,
          )}
          hint="Bruto menos devoluções efetivas"
        />
      </div>

      <section className="mt-5 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Faturamento diário</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Pela data de confirmação do pedido no fuso da empresa.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Ticket médio confirmado:{" "}
            <strong className="text-foreground">
              {formatBRL(summary?.ticket_medio ?? 0)}
            </strong>
          </p>
        </div>

        {loading ? (
          <div className="mt-5 h-36 animate-pulse rounded-lg bg-muted" />
        ) : daily.length === 0 ? (
          <div className="mt-5 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nenhum pagamento confirmado no período.
          </div>
        ) : (
          <div className="mt-5 flex h-40 items-end gap-2 overflow-x-auto">
            {daily.map((item) => {
              const height =
                maxDaily > 0
                  ? Math.max(
                      4,
                      (item.faturamento_liquido_devolucoes / maxDaily) * 120,
                    )
                  : 4;
              return (
                <div
                  key={item.dia}
                  className="flex min-w-[42px] flex-1 flex-col items-center justify-end"
                  title={`${item.dia}: ${formatBRL(
                    item.faturamento_liquido_devolucoes,
                  )}`}
                >
                  <span className="mb-1 text-[9px] text-muted-foreground">
                    {item.pedidos}
                  </span>
                  <span
                    className="w-full max-w-12 rounded-t bg-primary"
                    style={{ height }}
                  />
                  <span className="mt-2 text-[9px] text-muted-foreground">
                    {item.dia.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-5 overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Produtos no período</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Agregado no grão de item. Um pedido com vários itens é contado uma
            vez por produto e não multiplica o valor total do pedido.
          </p>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Carregando produtos...
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="Nenhuma venda de produto no período"
            description="O relatório não cria números demonstrativos para preencher o estado vazio."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3">Produto</th>
                  <th className="px-5 py-3 text-right">Pedidos</th>
                  <th className="px-5 py-3 text-right">Unidades</th>
                  <th className="px-5 py-3 text-right">Bruto dos itens</th>
                  <th className="px-5 py-3 text-right">Devoluções rateadas</th>
                  <th className="px-5 py-3 text-right">Líquido</th>
                  <th className="px-5 py-3 text-right">Comissão snapshot</th>
                  <th className="px-5 py-3 text-right">Ticket/unidade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((product) => (
                  <tr
                    key={product.produto_id ?? product.produto_nome}
                    className="hover:bg-muted/40"
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-medium">{product.produto_nome}</p>
                      <p className="mt-0.5 text-[11px] capitalize text-muted-foreground">
                        {product.status_atual}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums">
                      {formatInt(product.pedidos_confirmados)}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums">
                      {formatInt(product.unidades)}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums">
                      {formatBRL(product.receita_bruta_itens)}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-destructive">
                      {product.devolucoes_rateadas > 0
                        ? formatBRL(product.devolucoes_rateadas)
                        : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold tabular-nums">
                      {formatBRL(product.receita_liquida_devolucoes)}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums">
                      {formatBRL(product.comissao_snapshot)}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-muted-foreground">
                      {formatBRL(product.ticket_medio_item)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
        <strong className="text-foreground">Definição:</strong>{" "}
        {definitions.faturamento_bruto ??
          "Faturamento bruto é calculado somente sobre pagamentos confirmados."}{" "}
        {definitions.devolucoes ?? ""}
      </div>
    </div>
  );
}
