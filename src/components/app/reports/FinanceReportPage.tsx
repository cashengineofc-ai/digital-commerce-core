import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, Wallet } from "lucide-react";
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
  faturamento_bruto: number;
  devolucoes: number;
  faturamento_liquido_devolucoes: number;
  taxas_plataforma: number;
  comissoes_originais: number;
  comissoes_estornadas: number;
  comissoes_reconhecidas: number;
  pagamentos_confirmados: number;
};

type CategoryRow = {
  conta: string;
  creditos: number;
  debitos: number;
  liquido: number;
  quantidade: number;
  movimento_economico: boolean;
};

const accountLabels: Record<string, string> = {
  VENDA_BRUTA: "Venda bruta",
  TAXA_PLATAFORMA: "Taxa da plataforma",
  COMISSAO_AFILIADO: "Comissão de afiliado",
  COMISSAO_RECEBIDA: "Comissão recebida",
  ESTORNO_PRODUTOR: "Estorno do produtor",
  ESTORNO_COMISSAO: "Estorno de comissão",
  ESTORNO_SPLIT_AUTORIZADO: "Estorno de parceiro autorizado",
  SPLIT_AUTORIZADO: "Participação de parceiro autorizado",
  SPLIT_RECEBIDO: "Participação recebida",
  SALDO_DEVEDOR: "Saldo devedor",
  LIBERACAO_SALDO: "Liberação de saldo",
  LIBERACAO_COMISSAO: "Liberação de comissão",
  SAQUE_RESERVA: "Reserva de saque",
  SAQUE_RESERVA_LIBERADA: "Liberação de reserva",
  SAQUE_PAGO: "Saque liquidado",
};

function Kpi({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold tabular-nums",
          accent && "text-primary",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function FinanceReportPage() {
  const [period, setPeriod] = useState<ReportPeriod>("30d");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
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

      const [summaryResult, categoryResult] = await Promise.all([
        (supabase as any).rpc("fn_relatorio_resumo", {
          p_inicio: nextRange.start,
          p_fim: nextRange.end,
          p_metodo: "pix",
        }),
        (supabase as any).rpc("fn_relatorio_financeiro_categorias", {
          p_inicio: nextRange.start,
          p_fim: nextRange.end,
        }),
      ]);

      if (summaryResult.error) throw summaryResult.error;
      if (categoryResult.error) throw categoryResult.error;

      const row = Array.isArray(summaryResult.data)
        ? summaryResult.data[0]
        : summaryResult.data;

      setDefinitions(defs);
      setRange(nextRange);
      setSummary({
        timezone: String(row?.timezone ?? timezone),
        faturamento_bruto: Number(row?.faturamento_bruto ?? 0),
        devolucoes: Number(row?.devolucoes ?? 0),
        faturamento_liquido_devolucoes: Number(
          row?.faturamento_liquido_devolucoes ?? 0,
        ),
        taxas_plataforma: Number(row?.taxas_plataforma ?? 0),
        comissoes_originais: Number(row?.comissoes_originais ?? 0),
        comissoes_estornadas: Number(row?.comissoes_estornadas ?? 0),
        comissoes_reconhecidas: Number(row?.comissoes_reconhecidas ?? 0),
        pagamentos_confirmados: Number(row?.pagamentos_confirmados ?? 0),
      });

      setCategories(
        ((categoryResult.data ?? []) as any[]).map((item) => ({
          conta: String(item.conta ?? ""),
          creditos: Number(item.creditos ?? 0),
          debitos: Number(item.debitos ?? 0),
          liquido: Number(item.liquido ?? 0),
          quantidade: Number(item.quantidade ?? 0),
          movimento_economico: Boolean(item.movimento_economico),
        })),
      );
    } catch (cause) {
      setSummary(null);
      setCategories([]);
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar o relatório financeiro.",
      );
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  const economic = useMemo(
    () =>
      categories
        .filter((row) => row.movimento_economico)
        .reduce(
          (acc, row) => {
            acc.credits += row.creditos;
            acc.debits += row.debitos;
            acc.net += row.liquido;
            return acc;
          },
          { credits: 0, debits: 0, net: 0 },
        ),
    [categories],
  );

  function exportReport() {
    downloadCsv(
      `relatorio-financeiro-${range.start}-a-${range.end}.csv`,
      [
        "Conta",
        "Créditos",
        "Débitos",
        "Líquido",
        "Lançamentos",
        "Movimento econômico",
      ],
      categories.map((row) => [
        accountLabels[row.conta] ?? row.conta,
        row.creditos.toFixed(2),
        row.debitos.toFixed(2),
        row.liquido.toFixed(2),
        row.quantidade,
        row.movimento_economico ? "sim" : "não",
      ]),
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Relatório Financeiro
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Resultado pelo razão e comparação com os snapshots comerciais.
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
            disabled={categories.length === 0}
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
          label="Créditos econômicos"
          value={formatBRL(economic.credits)}
          hint="Razão; movimentos internos excluídos"
        />
        <Kpi
          label="Débitos econômicos"
          value={formatBRL(economic.debits)}
          hint="Razão; movimentos internos excluídos"
        />
        <Kpi
          label="Resultado econômico"
          value={formatBRL(economic.net)}
          hint="Créditos menos débitos do razão"
          accent
        />
        <Kpi
          label="Bruto confirmado"
          value={formatBRL(summary?.faturamento_bruto ?? 0)}
          hint="Pedidos pela data de confirmação"
        />
        <Kpi
          label="Taxas snapshot"
          value={formatBRL(summary?.taxas_plataforma ?? 0)}
          hint="Taxa congelada em cada venda"
        />
        <Kpi
          label="Comissão reconhecida"
          value={formatBRL(summary?.comissoes_reconhecidas ?? 0)}
          hint="Original menos reversões conciliadas"
        />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Devoluções conciliadas</p>
          <p className="mt-2 text-xl font-semibold tabular-nums text-destructive">
            {formatBRL(summary?.devolucoes ?? 0)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Solicitação pendente não entra.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">
            Bruto líquido de devoluções
          </p>
          <p className="mt-2 text-xl font-semibold tabular-nums">
            {formatBRL(
              summary?.faturamento_liquido_devolucoes ?? 0,
            )}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">
            Comissão revertida
          </p>
          <p className="mt-2 text-xl font-semibold tabular-nums">
            {formatBRL(summary?.comissoes_estornadas ?? 0)}
          </p>
        </div>
      </div>

      <section className="mt-5 overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Razão por conta</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            O marcador “interno” identifica movimentações entre estados de
            saldo, reserva ou liquidação que não são receita/custo novo.
          </p>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Carregando razão...
          </div>
        ) : categories.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Nenhum lançamento no período"
            description="O financeiro permanece vazio quando não existem movimentos contábeis reais."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3">Conta</th>
                  <th className="px-5 py-3">Natureza</th>
                  <th className="px-5 py-3 text-right">Lançamentos</th>
                  <th className="px-5 py-3 text-right">Créditos</th>
                  <th className="px-5 py-3 text-right">Débitos</th>
                  <th className="px-5 py-3 text-right">Líquido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {categories.map((row) => (
                  <tr key={row.conta} className="hover:bg-muted/40">
                    <td className="px-5 py-3.5 font-medium">
                      {accountLabels[row.conta] ?? row.conta}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-medium",
                          row.movimento_economico
                            ? "bg-emerald-500/10 text-emerald-700"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {row.movimento_economico ? "econômico" : "interno"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums">
                      {formatInt(row.quantidade)}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-emerald-700">
                      {formatBRL(row.creditos)}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums">
                      {formatBRL(row.debitos)}
                    </td>
                    <td
                      className={cn(
                        "px-5 py-3.5 text-right font-semibold tabular-nums",
                        row.liquido < 0 && "text-destructive",
                      )}
                    >
                      {formatBRL(row.liquido)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
        <p>
          <strong className="text-foreground">Base comercial:</strong>{" "}
          {definitions.data_vendas ??
            "data de confirmação do pedido."}
        </p>
        <p className="mt-1">
          <strong className="text-foreground">Base financeira:</strong>{" "}
          {definitions.data_financeiro ??
            "data do lançamento no razão."}{" "}
          {definitions.resultado_financeiro ?? ""}
        </p>
      </div>
    </div>
  );
}
