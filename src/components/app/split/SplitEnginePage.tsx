import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Calculator,
  ChevronLeft,
  ChevronRight,
  History,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTempAuth } from "@/lib/auth-temp";
import { formatBRL, formatDateTime, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";

type Product = {
  id: string;
  nome: string;
  preco: number;
};

type TeamMember = {
  id: string;
  nome_completo: string;
  email: string;
};

type Affiliate = {
  id: string;
  codigo_afiliado: string;
  profile_id: string | null;
  name: string;
};

type RuleBeneficiary = {
  id?: string;
  profile_id: string;
  name?: string;
  percentual: number;
  prioridade?: number;
};

type CurrentRule = {
  rule: null | {
    id: string;
    name: string;
    version: number;
    base: string;
    effective_at: string;
  };
  beneficiaries: RuleBeneficiary[];
};

type SplitComponent = {
  type: "produtor" | "afiliado" | "plataforma" | "autorizado";
  label: string;
  profile_id?: string | null;
  amount: number;
  percent_of_gross: number;
  rule_percent?: number;
  commission_rate?: number;
  commission_fixed?: number | null;
};

type Simulation = {
  gross: number;
  platform_fee: number;
  affiliate_commission: number;
  authorized_total: number;
  producer_residual: number;
  distributed_total: number;
  difference: number;
  method: string;
  provider_cost_included: boolean;
  bank_transfer_performed: boolean;
  split_rule: null | { id: string; name: string; version: number };
  components: SplitComponent[];
};

type SplitRecord = {
  transacao_id: string;
  pedido_id: string | null;
  pedido_numero: string | null;
  valor_bruto: number;
  status_pagamento: string;
  data_referencia: string;
  distribuicoes: Array<{
    id: string;
    type: string;
    profile_id: string | null;
    affiliate_id: string | null;
    amount: number;
    reversed: number;
    net: number;
    rule_id: string | null;
    rule_version: number | null;
    snapshot: Record<string, unknown>;
  }>;
  total_distribuido: number;
  total_revertido: number;
  total_registros: number;
};

const PAGE_SIZE = 20;

const componentLabels: Record<string, string> = {
  produtor: "Produtor",
  afiliado: "Afiliado",
  plataforma: "Cash Engine PRO",
  autorizado: "Parceiro autorizado",
};

function moneyInput(value: string) {
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) ? number : NaN;
}

export function SplitEnginePage() {
  const { user, isLoading: isAuthLoading } = useTempAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [currentRule, setCurrentRule] = useState<CurrentRule>({
    rule: null,
    beneficiaries: [],
  });
  const [records, setRecords] = useState<SplitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [savingRule, setSavingRule] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<"simulador" | "registros" | "regra">("simulador");
  const [page, setPage] = useState(1);

  const [productId, setProductId] = useState("");
  const [affiliateId, setAffiliateId] = useState("");
  const [amount, setAmount] = useState("");
  const [simulation, setSimulation] = useState<Simulation | null>(null);

  const [ruleName, setRuleName] = useState("Regra principal");
  const [draftBeneficiaries, setDraftBeneficiaries] = useState<RuleBeneficiary[]>([]);

  async function load(pageNumber = page) {
    setLoading(true);
    setError(null);
    try {
      if (isAuthLoading) return;
      if (!user?.empresaId) {
        throw new Error("Empresa não identificada.");
      }

      const [
        productResult,
        affiliateResult,
        teamResult,
        ruleResult,
        recordResult,
      ] = await Promise.all([
        supabase
          .from("produtos")
          .select("id,nome,preco")
          .eq("empresa_id", user.empresaId)
          .eq("status", "publicado")
          .is("deleted_at", null)
          .order("nome"),
        supabase
          .from("afiliados")
          .select("id,codigo_afiliado,profile_id")
          .eq("empresa_id", user.empresaId)
          .eq("status", "ativo")
          .is("deleted_at", null)
          .order("created_at"),
        supabase
          .from("profiles")
          .select("id,nome_completo,email")
          .eq("empresa_id", user.empresaId)
          .eq("status", "ativo")
          .is("deleted_at", null)
          .order("nome_completo"),
        (supabase as any).rpc("fn_split_regra_atual"),
        (supabase as any).rpc("fn_split_registros", {
          p_limit: PAGE_SIZE,
          p_offset: (pageNumber - 1) * PAGE_SIZE,
        }),
      ]);

      if (productResult.error) throw productResult.error;
      if (affiliateResult.error) throw affiliateResult.error;
      if (teamResult.error) throw teamResult.error;
      if (ruleResult.error) throw ruleResult.error;
      if (recordResult.error) throw recordResult.error;

      const teamRows = (teamResult.data ?? []) as TeamMember[];
      const teamById = new Map(teamRows.map((member) => [member.id, member]));

      const productRows = ((productResult.data ?? []) as any[]).map((row) => ({
        id: String(row.id),
        nome: String(row.nome),
        preco: Number(row.preco ?? 0),
      }));

      setProducts(productRows);
      setTeam(teamRows);
      setAffiliates(
        ((affiliateResult.data ?? []) as any[]).map((row) => ({
          id: String(row.id),
          codigo_afiliado: String(row.codigo_afiliado),
          profile_id: row.profile_id ? String(row.profile_id) : null,
          name:
            (row.profile_id && teamById.get(String(row.profile_id))?.nome_completo) ||
            String(row.codigo_afiliado),
        })),
      );

      const rule = (ruleResult.data ?? {
        rule: null,
        beneficiaries: [],
      }) as CurrentRule;
      setCurrentRule(rule);
      setRuleName(rule.rule?.name ?? "Regra principal");
      setDraftBeneficiaries(
        (rule.beneficiaries ?? []).map((beneficiary) => ({
          profile_id: beneficiary.profile_id,
          ...(beneficiary.name ? { name: beneficiary.name } : {}),
          percentual: Number(beneficiary.percentual ?? 0),
          prioridade: Number(beneficiary.prioridade ?? 100),
        })),
      );

      setRecords(
        ((recordResult.data ?? []) as any[]).map((row) => ({
          transacao_id: String(row.transacao_id),
          pedido_id: row.pedido_id ? String(row.pedido_id) : null,
          pedido_numero: row.pedido_numero ? String(row.pedido_numero) : null,
          valor_bruto: Number(row.valor_bruto ?? 0),
          status_pagamento: String(row.status_pagamento ?? "confirmado"),
          data_referencia: String(row.data_referencia),
          distribuicoes: Array.isArray(row.distribuicoes)
            ? row.distribuicoes.map((item: any) => ({
                ...item,
                amount: Number(item.amount ?? 0),
                reversed: Number(item.reversed ?? 0),
                net: Number(item.net ?? 0),
                rule_version:
                  item.rule_version == null ? null : Number(item.rule_version),
              }))
            : [],
          total_distribuido: Number(row.total_distribuido ?? 0),
          total_revertido: Number(row.total_revertido ?? 0),
          total_registros: Number(row.total_registros ?? 0),
        })),
      );

      const firstProduct = productRows.at(0);
      if (!productId && firstProduct) {
        setProductId(firstProduct.id);
        setAmount(String(firstProduct.preco).replace(".", ","));
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar o Split Engine.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(page);
  }, [isAuthLoading, page, user?.empresaId]);

  const totalRecords = records[0]?.total_registros ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));

  const beneficiaryTotal = useMemo(
    () =>
      draftBeneficiaries.reduce(
        (sum, beneficiary) => sum + Number(beneficiary.percentual || 0),
        0,
      ),
    [draftBeneficiaries],
  );

  async function simulate() {
    const gross = moneyInput(amount);
    if (!productId || !Number.isFinite(gross) || gross <= 0) {
      setError("Selecione um produto e informe um valor maior que zero.");
      return;
    }

    setSimulating(true);
    setError(null);
    setMessage(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_split_simular",
        {
          p_valor: gross,
          p_produto_id: productId,
          p_afiliado_id: affiliateId || null,
        },
      );
      if (rpcError) throw rpcError;
      if (!data) throw new Error("O banco não retornou a simulação.");

      setSimulation({
        ...data,
        gross: Number(data.gross ?? 0),
        platform_fee: Number(data.platform_fee ?? 0),
        affiliate_commission: Number(data.affiliate_commission ?? 0),
        authorized_total: Number(data.authorized_total ?? 0),
        producer_residual: Number(data.producer_residual ?? 0),
        distributed_total: Number(data.distributed_total ?? 0),
        difference: Number(data.difference ?? 0),
        components: Array.isArray(data.components)
          ? data.components.map((component: any) => ({
              ...component,
              amount: Number(component.amount ?? 0),
              percent_of_gross: Number(component.percent_of_gross ?? 0),
            }))
          : [],
      });
    } catch (cause) {
      setSimulation(null);
      setError(cause instanceof Error ? cause.message : "Não foi possível simular.");
    } finally {
      setSimulating(false);
    }
  }

  function addBeneficiary() {
    const already = new Set(draftBeneficiaries.map((item) => item.profile_id));
    const member = team.find((item) => !already.has(item.id));
    if (!member) {
      setError("Não há outro membro elegível nesta empresa.");
      return;
    }
    setDraftBeneficiaries((current) => [
      ...current,
      {
        profile_id: member.id,
        name: member.nome_completo,
        percentual: 0,
        prioridade: (current.length + 1) * 10,
      },
    ]);
  }

  async function saveRule() {
    if (!ruleName.trim()) {
      setError("Informe o nome da regra.");
      return;
    }

    if (
      draftBeneficiaries.some(
        (beneficiary) =>
          !beneficiary.profile_id ||
          !Number.isFinite(beneficiary.percentual) ||
          beneficiary.percentual <= 0 ||
          beneficiary.percentual > 100,
      ) ||
      beneficiaryTotal > 100
    ) {
      setError(
        "Cada parceiro deve ter percentual entre 0 e 100, e a soma não pode passar de 100%.",
      );
      return;
    }

    setSavingRule(true);
    setError(null);
    setMessage(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_split_regra_criar_versao",
        {
          p_nome: ruleName.trim(),
          p_beneficiarios: draftBeneficiaries.map((beneficiary, index) => ({
            profile_id: beneficiary.profile_id,
            percentual: Number(beneficiary.percentual),
            prioridade: beneficiary.prioridade ?? (index + 1) * 10,
          })),
          p_vigencia_inicio: new Date().toISOString(),
        },
      );
      if (rpcError) throw rpcError;
      if (!data) throw new Error("O banco não confirmou a nova versão.");

      setMessage(
        "Nova versão da regra criada. Vendas antigas preservam a regra que já foi aplicada.",
      );
      await load(page);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível criar a nova versão da regra.",
      );
    } finally {
      setSavingRule(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Split Engine</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Distribuição contábil real de vendas confirmadas, com regra versionada.
          </p>
        </div>
        <button
          onClick={() => void load(page)}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
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

      <div className="mt-5 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-muted-foreground">
        O Split Engine registra obrigações e participações no razão interno. Ele não afirma que o
        banco dividiu automaticamente o Pix entre beneficiários. Transferência bancária só existe
        quando houver um provedor de payout realmente integrado e conciliado.
      </div>

      <div className="mt-6 flex gap-1 rounded-xl border border-border bg-card p-1">
        {([
          ["simulador", "Simulador", Calculator],
          ["registros", "Vendas registradas", History],
          ["regra", "Regra de parceiros", Settings2],
        ] satisfies Array<[typeof tab, string, LucideIcon]>).map(([key, label, Icon]) => (
          <button
            key={String(key)}
            onClick={() => setTab(key as typeof tab)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
              tab === key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            <Icon className="h-4 w-4" />
            {String(label)}
          </button>
        ))}
      </div>

      {tab === "simulador" && (
        <div className="mt-5 grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-semibold">Regras atuais</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              O cálculo acontece no servidor; o navegador não define taxa ou comissão.
            </p>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Produto</span>
                <select
                  value={productId}
                  onChange={(e) => {
                    setProductId(e.target.value);
                    const product = products.find(
                      (item) => item.id === e.target.value,
                    );
                    if (product) {
                      setAmount(String(product.preco).replace(".", ","));
                    }
                    setSimulation(null);
                  }}
                  className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                >
                  {products.length === 0 && (
                    <option value="">Nenhum produto publicado</option>
                  )}
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.nome}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">
                  Valor da venda
                </span>
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setSimulation(null);
                  }}
                  className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">
                  Afiliado
                </span>
                <select
                  value={affiliateId}
                  onChange={(e) => {
                    setAffiliateId(e.target.value);
                    setSimulation(null);
                  }}
                  className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                >
                  <option value="">Venda direta</option>
                  {affiliates.map((affiliate) => (
                    <option key={affiliate.id} value={affiliate.id}>
                      {affiliate.name} · {affiliate.codigo_afiliado}
                    </option>
                  ))}
                </select>
              </label>

              <button
                onClick={() => void simulate()}
                disabled={simulating || !productId}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {simulating ? "Calculando..." : "Calcular com regras atuais"}
              </button>
            </div>

            <div className="mt-5 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              Método operacional: Pix. Custo de provedor não é inventado nem incluído no split se o
              provedor não o informou.
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            {!simulation ? (
              <div className="grid min-h-[420px] place-items-center text-center">
                <div>
                  <Calculator className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-3 font-medium">Nenhuma simulação calculada</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Escolha os dados e peça o cálculo ao servidor.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Valor bruto</p>
                    <p className="mt-1 text-3xl font-semibold tabular-nums">
                      {formatBRL(simulation.gross)}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
                      Math.abs(simulation.difference) < 0.01
                        ? "bg-emerald-500/10 text-emerald-700"
                        : "bg-destructive/10 text-destructive",
                    )}
                  >
                    <BadgeCheck className="h-4 w-4" />
                    Fechamento {formatBRL(simulation.distributed_total)}
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  {simulation.components.map((component, index) => (
                    <div
                      key={`${component.type}:${component.profile_id ?? index}`}
                      className="rounded-xl border border-border bg-background p-4"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium">
                            {component.label ||
                              componentLabels[component.type] ||
                              component.type}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {component.type === "autorizado" &&
                            component.rule_percent != null
                              ? `Regra: ${formatPct(component.rule_percent, 4)} do residual`
                              : `${formatPct(component.percent_of_gross, 4)} do bruto`}
                          </p>
                        </div>
                        <p className="font-semibold tabular-nums">
                          {formatBRL(component.amount)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Taxa plataforma</p>
                    <p className="mt-1 font-semibold tabular-nums">
                      {formatBRL(simulation.platform_fee)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Comissão</p>
                    <p className="mt-1 font-semibold tabular-nums">
                      {formatBRL(simulation.affiliate_commission)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Parceiros</p>
                    <p className="mt-1 font-semibold tabular-nums">
                      {formatBRL(simulation.authorized_total)}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  {simulation.split_rule
                    ? `Regra ${simulation.split_rule.name} · versão ${simulation.split_rule.version}. A versão será preservada na venda.`
                    : "Nenhuma regra adicional de parceiros está ativa. O residual fica com o produtor."}
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {tab === "registros" && (
        <section className="mt-5 overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-semibold">Distribuições registradas</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Cada linha corresponde a uma transação que já recebeu um split persistido.
            </p>
          </div>

          {loading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Carregando registros...
            </div>
          ) : records.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Nenhuma distribuição real registrada ainda.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {records.map((record) => (
                <div key={record.transacao_id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs font-medium">
                        {record.pedido_numero ?? record.transacao_id}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDateTime(record.data_referencia)} ·{" "}
                        {record.status_pagamento.replaceAll("_", " ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Bruto</p>
                      <p className="font-semibold tabular-nums">
                        {formatBRL(record.valor_bruto)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                    {record.distribuicoes.map((distribution) => (
                      <div
                        key={distribution.id}
                        className="rounded-lg border border-border bg-background p-3"
                      >
                        <p className="text-xs text-muted-foreground">
                          {componentLabels[distribution.type] ?? distribution.type}
                        </p>
                        <p className="mt-1 font-semibold tabular-nums">
                          {formatBRL(distribution.net)}
                        </p>
                        {distribution.reversed > 0 && (
                          <p className="mt-1 text-[11px] text-destructive">
                            {formatBRL(distribution.reversed)} revertidos
                          </p>
                        )}
                        {distribution.rule_version != null && (
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            regra v{distribution.rule_version}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap justify-end gap-4 text-xs text-muted-foreground">
                    <span>
                      Distribuído:{" "}
                      <strong className="text-foreground">
                        {formatBRL(record.total_distribuido)}
                      </strong>
                    </span>
                    <span>
                      Revertido:{" "}
                      <strong className="text-foreground">
                        {formatBRL(record.total_revertido)}
                      </strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {records.length > 0 && (
            <footer className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
              <span>
                {totalRecords} registro{totalRecords === 1 ? "" : "s"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  disabled={page <= 1}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Anterior
                </button>
                <span>
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() =>
                    setPage((value) => Math.min(totalPages, value + 1))
                  }
                  disabled={page >= totalPages}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 disabled:opacity-40"
                >
                  Próxima
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </footer>
          )}
        </section>
      )}

      {tab === "regra" && (
        <div className="mt-5 grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-semibold">Regra vigente</h2>
            {currentRule.rule ? (
              <div className="mt-4 space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Nome:</span>{" "}
                  {currentRule.rule.name}
                </p>
                <p>
                  <span className="text-muted-foreground">Versão:</span>{" "}
                  v{currentRule.rule.version}
                </p>
                <p>
                  <span className="text-muted-foreground">Base:</span>{" "}
                  após taxa e comissão
                </p>
                <p>
                  <span className="text-muted-foreground">Vigência:</span>{" "}
                  {formatDateTime(currentRule.rule.effective_at)}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Nenhuma regra adicional ativa. Plataforma e afiliado seguem suas próprias regras;
                todo o residual pertence ao produtor.
              </p>
            )}

            <div className="mt-5 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              Uma nova versão não altera splits históricos. O banco grava a versão aplicada em cada
              distribuição.
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">Criar nova versão</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Parceiros autorizados recebem uma porcentagem do residual após taxa da plataforma
                  e comissão do afiliado.
                </p>
              </div>
              <button
                onClick={addBeneficiary}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar parceiro
              </button>
            </div>

            <label className="mt-5 block">
              <span className="text-xs font-medium text-muted-foreground">
                Nome da regra
              </span>
              <input
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
              />
            </label>

            <div className="mt-4 space-y-3">
              {draftBeneficiaries.map((beneficiary, index) => (
                <div
                  key={`${beneficiary.profile_id}:${index}`}
                  className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-[1fr_150px_40px]"
                >
                  <select
                    value={beneficiary.profile_id}
                    onChange={(e) =>
                      setDraftBeneficiaries((current) =>
                        current.map((item, currentIndex) =>
                          currentIndex === index
                            ? {
                                ...item,
                                profile_id: e.target.value,
                                name:
                                  team.find(
                                    (member) => member.id === e.target.value,
                                  )?.nome_completo ?? "",
                              }
                            : item,
                        ),
                      )
                    }
                    className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                  >
                    {team.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.nome_completo} · {member.email}
                      </option>
                    ))}
                  </select>

                  <label>
                    <span className="sr-only">Percentual</span>
                    <div className="relative">
                      <input
                        type="number"
                        min={0.0001}
                        max={100}
                        step={0.0001}
                        value={beneficiary.percentual}
                        onChange={(e) =>
                          setDraftBeneficiaries((current) =>
                            current.map((item, currentIndex) =>
                              currentIndex === index
                                ? {
                                    ...item,
                                    percentual: Number(e.target.value),
                                  }
                                : item,
                            ),
                          )
                        }
                        className="h-10 w-full rounded-lg border border-border bg-background px-3 pr-8 text-sm"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        %
                      </span>
                    </div>
                  </label>

                  <button
                    onClick={() =>
                      setDraftBeneficiaries((current) =>
                        current.filter((_, currentIndex) => currentIndex !== index),
                      )
                    }
                    className="grid h-10 w-10 place-items-center rounded-lg border border-border text-muted-foreground hover:text-destructive"
                    aria-label="Remover parceiro"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}

              {draftBeneficiaries.length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                  Nenhum parceiro adicional. O produtor fica com todo o residual.
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                Percentual destinado a parceiros
              </span>
              <strong
                className={cn(
                  "tabular-nums",
                  beneficiaryTotal > 100 && "text-destructive",
                )}
              >
                {formatPct(beneficiaryTotal, 4)}
              </strong>
            </div>

            <button
              onClick={() => void saveRule()}
              disabled={savingRule || beneficiaryTotal > 100}
              className="mt-5 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {savingRule ? "Salvando..." : "Criar nova versão da regra"}
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
