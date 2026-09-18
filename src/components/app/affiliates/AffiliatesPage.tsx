import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Link2,
  Network,
  Package,
  Percent,
  RefreshCw,
  Search,
  ShieldCheck,
  UserPlus,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTempAuth } from "@/lib/auth-temp";
import { formatBRL, formatDateTime, formatInt, formatPct } from "@/lib/format";
import { CardsSkeleton, TableSkeleton } from "@/components/app/Skeletons";
import { EmptyState } from "@/components/app/EmptyState";
import { cn } from "@/lib/utils";

type AffiliateRow = {
  id: string;
  profile_id: string | null;
  nome: string;
  email: string;
  codigo: string;
  status: "pendente" | "ativo" | "inativo" | "suspenso" | "banido";
  produtos_autorizados: number;
  cliques: number;
  vendas_confirmadas: number;
  faturamento_bruto: number;
  faturamento_liquido_devolucoes: number;
  comissao_reconhecida: number;
  comissao_estornada: number;
  conversao: number;
  created_at: string;
};

type InviteRow = {
  id: string;
  email: string;
  nome: string | null;
  status: string;
  taxa_comissao: number | null;
  expira_em: string;
  created_at: string;
};

type Product = {
  id: string;
  nome: string;
  status: string;
  taxa_comissao_afiliado: number | null;
  comissao_valor_fixo: number | null;
};

type Authorization = {
  id: string;
  produto_id: string;
  ativo: boolean;
  taxa_comissao_personalizada: number | null;
  comissao_valor_fixo: number | null;
  data_inicio: string | null;
  data_fim: string | null;
};

const PAGE_SIZE = 12;
const statusOptions = [
  "todos",
  "pendente",
  "ativo",
  "inativo",
  "suspenso",
  "banido",
] as const;

function statusClass(status: AffiliateRow["status"]) {
  if (status === "ativo") return "bg-emerald-500/10 text-emerald-700";
  if (status === "pendente") return "bg-amber-500/10 text-amber-700";
  if (status === "suspenso") return "bg-orange-500/10 text-orange-700";
  if (status === "banido") return "bg-destructive/10 text-destructive";
  return "bg-muted text-muted-foreground";
}

function inviteStatusClass(status: string) {
  if (status === "pendente") return "bg-amber-500/10 text-amber-700";
  if (status === "aceito") return "bg-emerald-500/10 text-emerald-700";
  if (status === "revogado") return "bg-destructive/10 text-destructive";
  return "bg-muted text-muted-foreground";
}

export function AffiliatesPage() {
  const { user, isLoading: isAuthLoading } = useTempAuth();
  const [affiliates, setAffiliates] = useState<AffiliateRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof statusOptions)[number]>("todos");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState("");
  const [inviteForm, setInviteForm] = useState({
    email: "",
    nome: "",
    comissao: "",
    expira_dias: "7",
  });

  const [productAffiliate, setProductAffiliate] = useState<AffiliateRow | null>(null);
  const [authorizations, setAuthorizations] = useState<Authorization[]>([]);
  const [authLoading, setAuthLoading] = useState(false);
  const [savingProductId, setSavingProductId] = useState<string | null>(null);
  const [customRates, setCustomRates] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isAuthLoading) return;
      if (!user?.empresaId) {
        throw new Error("Empresa não identificada.");
      }

      const [affiliateResult, inviteResult, productResult] = await Promise.all([
        (supabase as any).rpc("fn_afiliados_listar"),
        (supabase as any).rpc("fn_afiliado_convites_listar"),
        supabase
          .from("produtos")
          .select(
            "id,nome,status,taxa_comissao_afiliado,comissao_valor_fixo",
          )
          .eq("empresa_id", user.empresaId)
          .is("deleted_at", null)
          .order("nome"),
      ]);

      if (affiliateResult.error) throw affiliateResult.error;
      if (inviteResult.error) throw inviteResult.error;
      if (productResult.error) throw productResult.error;

      setAffiliates(
        ((affiliateResult.data ?? []) as any[]).map((row) => ({
          id: String(row.id),
          profile_id: row.profile_id ? String(row.profile_id) : null,
          nome: String(row.nome ?? "Afiliado"),
          email: String(row.email ?? ""),
          codigo: String(row.codigo ?? ""),
          status: String(row.status ?? "pendente") as AffiliateRow["status"],
          produtos_autorizados: Number(row.produtos_autorizados ?? 0),
          cliques: Number(row.cliques ?? 0),
          vendas_confirmadas: Number(row.vendas_confirmadas ?? 0),
          faturamento_bruto: Number(row.faturamento_bruto ?? 0),
          faturamento_liquido_devolucoes: Number(
            row.faturamento_liquido_devolucoes ?? 0,
          ),
          comissao_reconhecida: Number(row.comissao_reconhecida ?? 0),
          comissao_estornada: Number(row.comissao_estornada ?? 0),
          conversao: Number(row.conversao ?? 0),
          created_at: String(row.created_at),
        })),
      );

      setInvites(
        ((inviteResult.data ?? []) as any[]).map((row) => ({
          id: String(row.id),
          email: String(row.email ?? ""),
          nome: row.nome ? String(row.nome) : null,
          status: String(row.status ?? "pendente"),
          taxa_comissao:
            row.taxa_comissao == null ? null : Number(row.taxa_comissao),
          expira_em: String(row.expira_em),
          created_at: String(row.created_at),
        })),
      );

      setProducts(
        ((productResult.data ?? []) as any[]).map((row) => ({
          id: String(row.id),
          nome: String(row.nome),
          status: String(row.status),
          taxa_comissao_afiliado:
            row.taxa_comissao_afiliado == null
              ? null
              : Number(row.taxa_comissao_afiliado),
          comissao_valor_fixo:
            row.comissao_valor_fixo == null
              ? null
              : Number(row.comissao_valor_fixo),
        })),
      );
    } catch (cause) {
      setAffiliates([]);
      setInvites([]);
      setProducts([]);
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar os afiliados.",
      );
    } finally {
      setLoading(false);
    }
  }, [isAuthLoading, user?.empresaId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    return affiliates.filter((affiliate) => {
      if (status !== "todos" && affiliate.status !== status) return false;
      if (!q) return true;
      return [
        affiliate.nome,
        affiliate.email,
        affiliate.codigo,
        affiliate.id,
      ].some((value) =>
        value.toLocaleLowerCase("pt-BR").includes(q),
      );
    });
  }, [affiliates, query, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const metrics = useMemo(
    () =>
      filtered.reduce(
        (acc, affiliate) => {
          if (affiliate.status === "ativo") acc.active += 1;
          acc.sales += affiliate.vendas_confirmadas;
          acc.net += affiliate.faturamento_liquido_devolucoes;
          acc.commission += affiliate.comissao_reconhecida;
          acc.clicks += affiliate.cliques;
          return acc;
        },
        { active: 0, sales: 0, net: 0, commission: 0, clicks: 0 },
      ),
    [filtered],
  );

  function openInvite() {
    setInviteForm({
      email: "",
      nome: "",
      comissao: "",
      expira_dias: "7",
    });
    setGeneratedInviteUrl("");
    setError(null);
    setMessage(null);
    setInviteOpen(true);
  }

  async function createInvite() {
    const commission = inviteForm.comissao.trim()
      ? Number(inviteForm.comissao.replace(",", "."))
      : null;
    const expires = Number(inviteForm.expira_dias);

    if (
      !inviteForm.email.trim() ||
      (commission != null &&
        (!Number.isFinite(commission) || commission < 0 || commission > 100)) ||
      !Number.isInteger(expires) ||
      expires < 1 ||
      expires > 30
    ) {
      setError("Revise e-mail, comissão e validade do convite.");
      return;
    }

    setInviteSubmitting(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_afiliado_convite_criar",
        {
          p_email: inviteForm.email.trim(),
          p_nome: inviteForm.nome.trim() || null,
          p_taxa_comissao: commission,
          p_expira_dias: expires,
        },
      );
      if (rpcError) throw rpcError;

      const code = String(data?.code ?? "");
      const token = String(data?.token ?? "");
      if (!code || !token) {
        throw new Error("O banco não retornou o link do convite.");
      }

      const url = `${window.location.origin}/convite/${encodeURIComponent(
        code,
      )}?token=${encodeURIComponent(token)}`;
      setGeneratedInviteUrl(url);
      setMessage(
        "Convite criado. Nenhum e-mail foi enviado porque não há provedor de e-mail configurado neste fluxo.",
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível criar o convite.",
      );
    } finally {
      setInviteSubmitting(false);
    }
  }

  async function copyGeneratedInvite() {
    if (!generatedInviteUrl) return;
    await navigator.clipboard.writeText(generatedInviteUrl);
    setMessage("Link do convite copiado.");
  }

  async function revokeInvite(id: string) {
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_afiliado_convite_revogar",
        { p_invite_id: id },
      );
      if (rpcError) throw rpcError;
      if (!data) throw new Error("O convite não estava mais pendente.");
      setMessage("Convite revogado.");
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível revogar.",
      );
    }
  }

  async function setAffiliateStatus(
    affiliate: AffiliateRow,
    nextStatus: "ativo" | "inativo" | "suspenso" | "banido",
  ) {
    let reason: string | null = null;
    if (nextStatus !== "ativo") {
      reason = window.prompt(
        nextStatus === "suspenso"
          ? "Motivo da suspensão:"
          : "Motivo obrigatório da alteração:",
      );
      if (!reason?.trim()) return;
    }

    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_afiliado_status_definir",
        {
          p_afiliado_id: affiliate.id,
          p_status: nextStatus,
          p_motivo: reason?.trim() || null,
        },
      );
      if (rpcError) throw rpcError;
      if (!data) throw new Error("A alteração não foi confirmada.");
      setMessage(
        nextStatus === "ativo"
          ? "Afiliado aprovado/reativado."
          : "Status do afiliado atualizado.",
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível alterar o status.",
      );
    }
  }

  async function openProducts(affiliate: AffiliateRow) {
    setProductAffiliate(affiliate);
    setAuthLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase
        .from("afiliados_produtos")
        .select(
          "id,produto_id,ativo,taxa_comissao_personalizada,comissao_valor_fixo,data_inicio,data_fim",
        )
        .eq("afiliado_id", affiliate.id);
      if (queryError) throw queryError;

      const rows = ((data ?? []) as any[]).map((row) => ({
        id: String(row.id),
        produto_id: String(row.produto_id),
        ativo: Boolean(row.ativo),
        taxa_comissao_personalizada:
          row.taxa_comissao_personalizada == null
            ? null
            : Number(row.taxa_comissao_personalizada),
        comissao_valor_fixo:
          row.comissao_valor_fixo == null
            ? null
            : Number(row.comissao_valor_fixo),
        data_inicio: row.data_inicio ? String(row.data_inicio) : null,
        data_fim: row.data_fim ? String(row.data_fim) : null,
      })) as Authorization[];

      setAuthorizations(rows);
      setCustomRates(
        Object.fromEntries(
          rows.map((authorization) => [
            authorization.produto_id,
            authorization.taxa_comissao_personalizada == null
              ? ""
              : String(authorization.taxa_comissao_personalizada).replace(
                  ".",
                  ",",
                ),
          ]),
        ),
      );
    } catch (cause) {
      setAuthorizations([]);
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar as autorizações.",
      );
    } finally {
      setAuthLoading(false);
    }
  }

  async function toggleProduct(product: Product, active: boolean) {
    if (!productAffiliate) return;

    const rateText = customRates[product.id]?.trim() ?? "";
    const rate = rateText ? Number(rateText.replace(",", ".")) : null;
    if (
      rate != null &&
      (!Number.isFinite(rate) || rate < 0 || rate > 100)
    ) {
      setError("A comissão personalizada deve ficar entre 0% e 100%.");
      return;
    }

    setSavingProductId(product.id);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_afiliado_produto_definir",
        {
          p_afiliado_id: productAffiliate.id,
          p_produto_id: product.id,
          p_ativo: active,
          p_percentual: rate,
          p_valor_fixo: null,
          p_data_inicio: null,
          p_data_fim: null,
        },
      );
      if (rpcError) throw rpcError;
      if (!data) throw new Error("A autorização não foi confirmada.");

      await openProducts(productAffiliate);
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível alterar a autorização.",
      );
    } finally {
      setSavingProductId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1450px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Afiliados</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Convites, aprovação, produtos autorizados, vendas atribuídas e comissões reais.
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
          <button
            onClick={openInvite}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            <UserPlus className="h-4 w-4" />
            Convidar afiliado
          </button>
        </div>
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

      <div className="mt-6">
        {loading ? (
          <CardsSkeleton count={4} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Network className="h-4 w-4" />
                <span className="text-sm">Ativos</span>
              </div>
              <p className="mt-3 text-2xl font-semibold">
                {formatInt(metrics.active)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatInt(metrics.clicks)} cliques válidos
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <ShieldCheck className="h-4 w-4" />
                <span className="text-sm">Vendas confirmadas</span>
              </div>
              <p className="mt-3 text-2xl font-semibold">
                {formatInt(metrics.sales)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Pedidos pagos atribuídos
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Package className="h-4 w-4" />
                <span className="text-sm">Receita líquida de devoluções</span>
              </div>
              <p className="mt-3 text-2xl font-semibold">
                {formatBRL(metrics.net, { compact: true })}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Percent className="h-4 w-4" />
                <span className="text-sm">Comissão reconhecida</span>
              </div>
              <p className="mt-3 text-2xl font-semibold text-primary">
                {formatBRL(metrics.commission, { compact: true })}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por nome, e-mail, código ou ID"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as (typeof statusOptions)[number]);
            setPage(1);
          }}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        >
          {statusOptions.map((option) => (
            <option key={option} value={option}>
              {option === "todos" ? "Todos os estados" : option}
            </option>
          ))}
        </select>
      </div>

      <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <TableSkeleton rows={6} cols={9} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Network}
            title="Nenhum afiliado encontrado"
            description="Afiliados reais aparecerão após convite e aceite."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1260px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Afiliado</th>
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3 text-right">Produtos</th>
                    <th className="px-4 py-3 text-right">Cliques</th>
                    <th className="px-4 py-3 text-right">Vendas</th>
                    <th className="px-4 py-3 text-right">Líquido devoluções</th>
                    <th className="px-4 py-3 text-right">Comissão</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((affiliate) => (
                    <tr key={affiliate.id} className="hover:bg-muted/40">
                      <td className="px-4 py-3.5">
                        <p className="font-medium">{affiliate.nome}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {affiliate.email || "Sem e-mail vinculado"}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs">
                        {affiliate.codigo}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums">
                        {formatInt(affiliate.produtos_autorizados)}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums">
                        {formatInt(affiliate.cliques)}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums">
                        {formatInt(affiliate.vendas_confirmadas)}
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {formatPct(affiliate.conversao, 2)}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums">
                        {formatBRL(
                          affiliate.faturamento_liquido_devolucoes,
                          { compact: true },
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold tabular-nums">
                        {formatBRL(affiliate.comissao_reconhecida, {
                          compact: true,
                        })}
                        {affiliate.comissao_estornada > 0 && (
                          <p className="mt-0.5 text-[10px] text-destructive">
                            {formatBRL(affiliate.comissao_estornada, {
                              compact: true,
                            })}{" "}
                            revertidos
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                            statusClass(affiliate.status),
                          )}
                        >
                          {affiliate.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => void openProducts(affiliate)}
                            className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                          >
                            Produtos
                          </button>
                          {affiliate.status === "pendente" && (
                            <>
                              <button
                                onClick={() =>
                                  void setAffiliateStatus(affiliate, "ativo")
                                }
                                className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-1.5 text-xs font-medium text-emerald-700"
                              >
                                Aprovar
                              </button>
                              <button
                                onClick={() =>
                                  void setAffiliateStatus(affiliate, "inativo")
                                }
                                className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                              >
                                Recusar
                              </button>
                            </>
                          )}
                          {affiliate.status === "ativo" && (
                            <>
                              <button
                                onClick={() =>
                                  void setAffiliateStatus(affiliate, "suspenso")
                                }
                                className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                              >
                                Suspender
                              </button>
                              <button
                                onClick={() =>
                                  void setAffiliateStatus(affiliate, "inativo")
                                }
                                className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                              >
                                Encerrar
                              </button>
                            </>
                          )}
                          {["inativo", "suspenso"].includes(
                            affiliate.status,
                          ) && (
                            <button
                              onClick={() =>
                                void setAffiliateStatus(affiliate, "ativo")
                              }
                              className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                            >
                              Reativar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
              <span>
                {formatInt(filtered.length)} afiliado
                {filtered.length === 1 ? "" : "s"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setPage((value) => Math.max(1, value - 1))
                  }
                  disabled={currentPage <= 1}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Anterior
                </button>
                <span>
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() =>
                    setPage((value) =>
                      Math.min(totalPages, value + 1),
                    )
                  }
                  disabled={currentPage >= totalPages}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 disabled:opacity-40"
                >
                  Próxima
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </footer>
          </>
        )}
      </section>

      <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-semibold">Convites</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Sem provedor de e-mail configurado, o sistema gera um link seguro para copiar.
          </p>
        </div>
        {invites.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhum convite criado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3">Convidado</th>
                  <th className="px-5 py-3">Comissão</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Expira</th>
                  <th className="px-5 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invites.map((invite) => (
                  <tr key={invite.id}>
                    <td className="px-5 py-3.5">
                      <p className="font-medium">
                        {invite.nome || invite.email}
                      </p>
                      {invite.nome && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {invite.email}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {invite.taxa_comissao == null
                        ? "Padrão da empresa"
                        : formatPct(invite.taxa_comissao, 2)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                          inviteStatusClass(invite.status),
                        )}
                      >
                        {invite.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                      {formatDateTime(invite.expira_em)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {invite.status === "pendente" && (
                        <button
                          onClick={() => void revokeInvite(invite.id)}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                        >
                          Revogar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {inviteOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">Convidar afiliado</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  O token bruto aparece somente neste link.
                </p>
              </div>
              <button
                onClick={() => setInviteOpen(false)}
                className="rounded-lg p-2 hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!generatedInviteUrl ? (
              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="text-sm font-medium">E-mail</span>
                  <input
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) =>
                      setInviteForm({
                        ...inviteForm,
                        email: e.target.value,
                      })
                    }
                    className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Nome</span>
                  <input
                    value={inviteForm.nome}
                    onChange={(e) =>
                      setInviteForm({
                        ...inviteForm,
                        nome: e.target.value,
                      })
                    }
                    className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="text-sm font-medium">
                      Comissão padrão %
                    </span>
                    <input
                      inputMode="decimal"
                      value={inviteForm.comissao}
                      onChange={(e) =>
                        setInviteForm({
                          ...inviteForm,
                          comissao: e.target.value,
                        })
                      }
                      placeholder="Opcional"
                      className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    />
                  </label>
                  <label>
                    <span className="text-sm font-medium">
                      Validade em dias
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={inviteForm.expira_dias}
                      onChange={(e) =>
                        setInviteForm({
                          ...inviteForm,
                          expira_dias: e.target.value,
                        })
                      }
                      className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    />
                  </label>
                </div>
                <button
                  onClick={() => void createInvite()}
                  disabled={inviteSubmitting}
                  className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {inviteSubmitting
                    ? "Criando..."
                    : "Gerar link seguro"}
                </button>
              </div>
            ) : (
              <div className="mt-5">
                <div className="rounded-xl border border-border bg-background p-4">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-primary" />
                    <p className="font-medium">Link do convite</p>
                  </div>
                  <p className="mt-3 break-all font-mono text-xs text-muted-foreground">
                    {generatedInviteUrl}
                  </p>
                </div>
                <button
                  onClick={() => void copyGeneratedInvite()}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                >
                  <Copy className="h-4 w-4" />
                  Copiar link
                </button>
                <p className="mt-3 text-xs text-muted-foreground">
                  Nenhum e-mail foi marcado como enviado. Conecte um provedor de e-mail no futuro para automatizar a entrega.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {productAffiliate && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">
                  Produtos de {productAffiliate.nome}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Comissão personalizada é opcional. Sem override, vale a regra do produto/afiliado.
                </p>
              </div>
              <button
                onClick={() => setProductAffiliate(null)}
                className="rounded-lg p-2 hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {authLoading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Carregando autorizações...
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {products.map((product) => {
                  const authorization = authorizations.find(
                    (item) => item.produto_id === product.id,
                  );
                  const active = Boolean(authorization?.ativo);
                  return (
                    <div
                      key={product.id}
                      className="grid gap-3 rounded-xl border border-border p-4 md:grid-cols-[1fr_170px_110px]"
                    >
                      <div>
                        <p className="font-medium">{product.nome}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {product.comissao_valor_fixo != null
                            ? `Padrão: ${formatBRL(
                                product.comissao_valor_fixo,
                              )} fixa`
                            : product.taxa_comissao_afiliado != null
                              ? `Padrão: ${formatPct(
                                  product.taxa_comissao_afiliado,
                                  2,
                                )}`
                              : "Sem comissão padrão específica"}
                        </p>
                      </div>
                      <label>
                        <span className="text-xs text-muted-foreground">
                          Override %
                        </span>
                        <input
                          inputMode="decimal"
                          value={customRates[product.id] ?? ""}
                          onChange={(e) =>
                            setCustomRates((current) => ({
                              ...current,
                              [product.id]: e.target.value,
                            }))
                          }
                          placeholder="Opcional"
                          className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                        />
                      </label>
                      <button
                        onClick={() =>
                          void toggleProduct(product, !active)
                        }
                        disabled={savingProductId === product.id}
                        className={cn(
                          "mt-auto inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium disabled:opacity-50",
                          active
                            ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700"
                            : "border-border hover:bg-muted",
                        )}
                      >
                        {active ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            Autorizado
                          </>
                        ) : (
                          "Autorizar"
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
