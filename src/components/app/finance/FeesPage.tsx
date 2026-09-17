import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, Settings2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTempAuth } from "@/lib/auth-temp";
import { formatBRL, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";

type OperationalFee = {
  operacao: string;
  metodo: string;
  volume_base: number;
  taxa_plataforma: number;
  custo_provedor_registrado: number;
  quantidade: number;
};

type FeeRule = {
  id: string;
  empresa_id: string | null;
  plano: string;
  metodo_pagamento: string;
  operacao: string;
  taxa_percentual: number;
  taxa_fixa: number;
  taxa_minima: number | null;
  taxa_maxima: number | null;
  dias_liquidacao: number;
  base_calculo: string;
  prioridade: number;
  versao: number;
  vigencia_inicio_em: string | null;
  vigencia_fim_em: string | null;
  reembolsar_em_estorno: boolean;
  ativo: boolean;
};

type Company = {
  id: string;
  nome_fantasia: string | null;
  razao_social: string | null;
  plano: string;
};

const operationLabels: Record<string, string> = {
  venda: "Venda",
  saque: "Saque",
  repasse: "Repasse",
  reembolso: "Reembolso",
};

function numeric(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function FeesPage() {
  const { isAdminGlobal } = useTempAuth();
  const [fees, setFees] = useState<OperationalFee[]>([]);
  const [rules, setRules] = useState<FeeRule[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    empresa_id: "",
    operacao: "venda",
    percentual: "0",
    fixo: "0",
    minimo: "",
    maximo: "",
    dias_liquidacao: "0",
    vigencia_inicio: "",
    base_calculo: "valor_bruto",
    prioridade: "100",
    plano: "free",
    reembolsar_em_estorno: true,
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data, error: feeError } = await (supabase as any).rpc(
        "fn_taxas_operacionais",
        { p_inicio: null, p_fim: null },
      );
      if (feeError) throw feeError;

      setFees(
        ((data ?? []) as any[]).map((row) => ({
          operacao: String(row.operacao ?? ""),
          metodo: String(row.metodo ?? ""),
          volume_base: Number(row.volume_base ?? 0),
          taxa_plataforma: Number(row.taxa_plataforma ?? 0),
          custo_provedor_registrado: Number(row.custo_provedor_registrado ?? 0),
          quantidade: Number(row.quantidade ?? 0),
        })),
      );

      if (isAdminGlobal) {
        const [ruleResult, companyResult] = await Promise.all([
          (supabase as any)
            .from("taxas_plataforma")
            .select(
              "id,empresa_id,plano,metodo_pagamento,operacao,taxa_percentual,taxa_fixa,taxa_minima,taxa_maxima,dias_liquidacao,base_calculo,prioridade,versao,vigencia_inicio_em,vigencia_fim_em,reembolsar_em_estorno,ativo",
            )
            .order("vigencia_inicio_em", { ascending: false })
            .limit(200),
          supabase
            .from("empresas")
            .select("id,nome_fantasia,razao_social,plano")
            .is("deleted_at", null)
            .order("nome_fantasia"),
        ]);

        if (ruleResult.error) throw ruleResult.error;
        if (companyResult.error) throw companyResult.error;

        setRules(
          ((ruleResult.data ?? []) as any[]).map((row) => ({
            ...row,
            taxa_percentual: Number(row.taxa_percentual ?? 0),
            taxa_fixa: Number(row.taxa_fixa ?? 0),
            taxa_minima: row.taxa_minima == null ? null : Number(row.taxa_minima),
            taxa_maxima: row.taxa_maxima == null ? null : Number(row.taxa_maxima),
            dias_liquidacao: Number(row.dias_liquidacao ?? 0),
            prioridade: Number(row.prioridade ?? 100),
            versao: Number(row.versao ?? 1),
            reembolsar_em_estorno: row.reembolsar_em_estorno !== false,
            ativo: Boolean(row.ativo),
          })),
        );
        setCompanies((companyResult.data ?? []) as Company[]);
      } else {
        setRules([]);
        setCompanies([]);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar as taxas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [isAdminGlobal]);

  const totals = useMemo(
    () =>
      fees.reduce(
        (acc, row) => {
          acc.volume += row.volume_base;
          acc.platform += row.taxa_plataforma;
          acc.provider += row.custo_provedor_registrado;
          return acc;
        },
        { volume: 0, platform: 0, provider: 0 },
      ),
    [fees],
  );

  const platformRate =
    totals.volume > 0 ? (totals.platform / totals.volume) * 100 : 0;

  function openNewRule() {
    setForm({
      empresa_id: "",
      operacao: "venda",
      percentual: "0",
      fixo: "0",
      minimo: "",
      maximo: "",
      dias_liquidacao: "0",
      vigencia_inicio: "",
      base_calculo: "valor_bruto",
      prioridade: "100",
      plano: "free",
      reembolsar_em_estorno: true,
    });
    setEditorOpen(true);
    setError(null);
  }

  async function saveRule() {
    const percent = numeric(form.percentual);
    const fixed = numeric(form.fixo);
    const minimum = numeric(form.minimo);
    const maximum = numeric(form.maximo);
    const settlement = Number(form.dias_liquidacao);
    const priority = Number(form.prioridade);

    if (
      percent == null ||
      fixed == null ||
      Number.isNaN(percent) ||
      Number.isNaN(fixed) ||
      percent < 0 ||
      percent > 100 ||
      fixed < 0 ||
      (minimum != null && (Number.isNaN(minimum) || minimum < 0)) ||
      (maximum != null && (Number.isNaN(maximum) || maximum < 0)) ||
      (minimum != null && maximum != null && maximum < minimum) ||
      !Number.isInteger(settlement) ||
      settlement < 0 ||
      !Number.isInteger(priority)
    ) {
      setError("Revise percentual, valores mínimo/máximo, liquidação e prioridade.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_admin_taxa_criar_versao",
        {
          p_empresa_id: form.empresa_id || null,
          p_operacao: form.operacao,
          p_metodo: "pix",
          p_percentual: percent,
          p_fixo: fixed,
          p_minimo: minimum,
          p_maximo: maximum,
          p_dias_liquidacao: settlement,
          p_vigencia_inicio: form.vigencia_inicio
            ? new Date(form.vigencia_inicio).toISOString()
            : new Date().toISOString(),
          p_base_calculo: form.base_calculo,
          p_prioridade: priority,
          p_plano: form.plano.trim() || "free",
          p_reembolsar_em_estorno: form.reembolsar_em_estorno,
        },
      );
      if (rpcError) throw rpcError;
      if (!data) throw new Error("O banco não confirmou a nova versão da regra.");

      setEditorOpen(false);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar a regra.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Taxas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Taxa da plataforma e custo real registrado do provedor são indicadores separados.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Atualizar
          </button>
          {isAdminGlobal && (
            <button
              onClick={openNewRule}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              <Plus className="h-4 w-4" />
              Nova versão de taxa
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Volume base</p>
          <p className="mt-3 text-2xl font-semibold tabular-nums">
            {formatBRL(totals.volume)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Taxa da plataforma</p>
          <p className="mt-3 text-2xl font-semibold tabular-nums">
            {formatBRL(totals.platform)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Taxa efetiva da plataforma</p>
          <p className="mt-3 text-2xl font-semibold tabular-nums text-primary">
            {formatPct(platformRate, 2)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Custo do provedor registrado</p>
          <p className="mt-3 text-2xl font-semibold tabular-nums">
            {formatBRL(totals.provider)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Só aparece quando o provedor realmente informou um custo.
          </p>
        </div>
      </div>

      <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-semibold">Taxas efetivamente aplicadas</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Baseadas em snapshots das operações. Mudanças de regra não recalculam o histórico.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3">Operação</th>
                <th className="px-5 py-3">Método</th>
                <th className="px-5 py-3 text-right">Operações</th>
                <th className="px-5 py-3 text-right">Volume base</th>
                <th className="px-5 py-3 text-right">Plataforma</th>
                <th className="px-5 py-3 text-right">Provedor registrado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    Carregando taxas...
                  </td>
                </tr>
              ) : fees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    Nenhuma taxa real registrada ainda.
                  </td>
                </tr>
              ) : (
                fees.map((row) => (
                  <tr key={`${row.operacao}:${row.metodo}`} className="hover:bg-muted/40">
                    <td className="px-5 py-3.5 font-medium">
                      {operationLabels[row.operacao] ?? row.operacao}
                    </td>
                    <td className="px-5 py-3.5 capitalize text-muted-foreground">
                      {row.metodo}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums">
                      {row.quantidade}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums">
                      {formatBRL(row.volume_base)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold tabular-nums">
                      {formatBRL(row.taxa_plataforma)}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-muted-foreground">
                      {formatBRL(row.custo_provedor_registrado)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {isAdminGlobal && (
        <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-start gap-3 border-b border-border px-5 py-4">
            <Settings2 className="mt-0.5 h-4 w-4 text-primary" />
            <div>
              <h2 className="font-semibold">Histórico de regras</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Somente administrador da plataforma. Uma nova regra cria uma nova versão em vez de alterar vendas antigas.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3">Escopo</th>
                  <th className="px-5 py-3">Operação</th>
                  <th className="px-5 py-3">Método</th>
                  <th className="px-5 py-3 text-right">%</th>
                  <th className="px-5 py-3 text-right">Fixo</th>
                  <th className="px-5 py-3">Liquidação</th>
                  <th className="px-5 py-3">Reembolso da taxa</th>
                  <th className="px-5 py-3">Versão</th>
                  <th className="px-5 py-3">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rules.map((rule) => {
                  const company = companies.find((item) => item.id === rule.empresa_id);
                  return (
                    <tr key={rule.id} className="hover:bg-muted/40">
                      <td className="px-5 py-3.5">
                        {company
                          ? company.nome_fantasia || company.razao_social || company.id
                          : `Padrão · plano ${rule.plano}`}
                      </td>
                      <td className="px-5 py-3.5">
                        {operationLabels[rule.operacao] ?? rule.operacao}
                      </td>
                      <td className="px-5 py-3.5 capitalize">{rule.metodo_pagamento}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums">
                        {formatPct(rule.taxa_percentual, 4)}
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums">
                        {formatBRL(rule.taxa_fixa)}
                      </td>
                      <td className="px-5 py-3.5">
                        {rule.dias_liquidacao} dia{rule.dias_liquidacao === 1 ? "" : "s"}
                      </td>
                      <td className="px-5 py-3.5">
                        {rule.reembolsar_em_estorno ? "Sim" : "Não"}
                      </td>
                      <td className="px-5 py-3.5">v{rule.versao}</td>
                      <td className="px-5 py-3.5">
                        <span className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-medium",
                          rule.ativo ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground",
                        )}>
                          {rule.ativo ? "Vigente" : "Histórica"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {editorOpen && isAdminGlobal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">Nova versão de taxa</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  PIX é o único método operacional neste momento.
                </p>
              </div>
              <button onClick={() => setEditorOpen(false)} className="rounded-lg p-2 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label>
                <span className="text-sm font-medium">Empresa</span>
                <select
                  value={form.empresa_id}
                  onChange={(e) => {
                    const company = companies.find((item) => item.id === e.target.value);
                    setForm({
                      ...form,
                      empresa_id: e.target.value,
                      plano: company?.plano ?? form.plano,
                    });
                  }}
                  className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                >
                  <option value="">Regra padrão por plano</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.nome_fantasia || company.razao_social || company.id}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="text-sm font-medium">Operação</span>
                <select
                  value={form.operacao}
                  onChange={(e) => setForm({ ...form, operacao: e.target.value })}
                  className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                >
                  <option value="venda">Venda</option>
                  <option value="saque">Saque</option>
                  <option value="repasse">Repasse</option>
                  <option value="reembolso">Reembolso</option>
                </select>
              </label>

              <label>
                <span className="text-sm font-medium">Percentual</span>
                <input
                  inputMode="decimal"
                  value={form.percentual}
                  onChange={(e) => setForm({ ...form, percentual: e.target.value })}
                  className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </label>

              <label>
                <span className="text-sm font-medium">Valor fixo</span>
                <input
                  inputMode="decimal"
                  value={form.fixo}
                  onChange={(e) => setForm({ ...form, fixo: e.target.value })}
                  className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </label>

              <label>
                <span className="text-sm font-medium">Mínimo</span>
                <input
                  inputMode="decimal"
                  value={form.minimo}
                  onChange={(e) => setForm({ ...form, minimo: e.target.value })}
                  className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  placeholder="Opcional"
                />
              </label>

              <label>
                <span className="text-sm font-medium">Máximo</span>
                <input
                  inputMode="decimal"
                  value={form.maximo}
                  onChange={(e) => setForm({ ...form, maximo: e.target.value })}
                  className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  placeholder="Opcional"
                />
              </label>

              <label>
                <span className="text-sm font-medium">Dias para liberação</span>
                <input
                  type="number"
                  min={0}
                  value={form.dias_liquidacao}
                  onChange={(e) => setForm({ ...form, dias_liquidacao: e.target.value })}
                  className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </label>

              <label>
                <span className="text-sm font-medium">Prioridade</span>
                <input
                  type="number"
                  value={form.prioridade}
                  onChange={(e) => setForm({ ...form, prioridade: e.target.value })}
                  className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </label>

              <label>
                <span className="text-sm font-medium">Plano</span>
                <input
                  value={form.plano}
                  disabled={Boolean(form.empresa_id)}
                  onChange={(e) => setForm({ ...form, plano: e.target.value })}
                  className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-50"
                />
              </label>

              <label>
                <span className="text-sm font-medium">Vigência começa em</span>
                <input
                  type="datetime-local"
                  value={form.vigencia_inicio}
                  onChange={(e) => setForm({ ...form, vigencia_inicio: e.target.value })}
                  className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </label>

              <label>
                <span className="text-sm font-medium">Base de cálculo</span>
                <select
                  value={form.base_calculo}
                  onChange={(e) => setForm({ ...form, base_calculo: e.target.value })}
                  className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                >
                  <option value="valor_bruto">Valor bruto</option>
                  <option value="valor_distribuivel">Valor distribuível</option>
                </select>
              </label>

              <label className="flex items-center justify-between rounded-lg border border-border px-3 py-3 text-sm">
                Reverter taxa da plataforma em estorno
                <input
                  type="checkbox"
                  checked={form.reembolsar_em_estorno}
                  onChange={(e) =>
                    setForm({ ...form, reembolsar_em_estorno: e.target.checked })
                  }
                />
              </label>
            </div>

            <div className="mt-5 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              Taxa da plataforma não representa automaticamente custo bancário ou custo do provedor. Custos externos só entram quando o provedor realmente os informa.
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setEditorOpen(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={() => void saveRule()}
                disabled={saving}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Criar nova versão"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
