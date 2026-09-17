import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  CreditCard,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatInt } from "@/lib/format";
import { CardsSkeleton } from "@/components/app/Skeletons";
import { EmptyState } from "@/components/app/EmptyState";
import { CheckoutEditor } from "@/components/app/vendas/CheckoutEditor";
import { cn } from "@/lib/utils";

type CheckoutStatus = "rascunho" | "publicado" | "arquivado";

type Checkout = {
  id: string;
  nome: string;
  descricao: string | null;
  status: CheckoutStatus;
  public_token: string;
  slug: string;
  oferta_id: string;
  oferta_nome: string | null;
  produto_id: string | null;
  produto_nome: string | null;
  preco: number;
  publicado_em: string | null;
  pedidos_confirmados: number;
  faturamento_bruto: number;
};

type Offer = {
  id: string;
  produto_id: string;
  produto_nome: string;
  nome: string;
  preco: number;
  status: string;
};

function StatusPill({ status }: { status: CheckoutStatus }) {
  const styles: Record<CheckoutStatus, string> = {
    publicado: "bg-emerald-500/10 text-emerald-700",
    rascunho: "bg-muted text-muted-foreground",
    arquivado: "bg-zinc-500/10 text-zinc-700",
  };
  const labels: Record<CheckoutStatus, string> = {
    publicado: "Publicado",
    rascunho: "Rascunho",
    arquivado: "Arquivado",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", styles[status])}>
      {labels[status]}
    </span>
  );
}

export function CheckoutsPage() {
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editorId, setEditorId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    nome: "",
    descricao: "",
    oferta_id: "",
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [checkoutResult, offerResult] = await Promise.all([
        (supabase as any).rpc("fn_checkouts_listar", {
          p_busca: null,
          p_status: null,
          p_limit: 200,
          p_offset: 0,
        }),
        (supabase as any).rpc("fn_ofertas_listar", {
          p_busca: null,
          p_status: "ativa",
          p_limit: 200,
          p_offset: 0,
        }),
      ]);

      if (checkoutResult.error) throw checkoutResult.error;
      if (offerResult.error) throw offerResult.error;

      setCheckouts(
        ((checkoutResult.data ?? []) as any[]).map((row) => ({
          ...row,
          preco: Number(row.preco ?? 0),
          pedidos_confirmados: Number(row.pedidos_confirmados ?? 0),
          faturamento_bruto: Number(row.faturamento_bruto ?? 0),
        })),
      );
      setOffers(
        ((offerResult.data ?? []) as any[]).map((row) => ({
          ...row,
          preco: Number(row.preco ?? 0),
        })),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar os checkouts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    return checkouts.filter((checkout) => {
      if (status && checkout.status !== status) return false;
      if (!q) return true;
      return (
        checkout.nome.toLocaleLowerCase("pt-BR").includes(q) ||
        (checkout.produto_nome ?? "").toLocaleLowerCase("pt-BR").includes(q) ||
        (checkout.oferta_nome ?? "").toLocaleLowerCase("pt-BR").includes(q)
      );
    });
  }, [checkouts, query, status]);

  async function createCheckout() {
    if (!createForm.nome.trim() || !createForm.oferta_id) {
      setError("Informe o nome e selecione uma oferta ativa.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc("fn_checkout_criar", {
        p_nome: createForm.nome.trim(),
        p_oferta_id: createForm.oferta_id,
        p_descricao: createForm.descricao.trim() || null,
      });
      if (rpcError) throw rpcError;
      const id = String(data ?? "");
      if (!id) throw new Error("O banco não retornou o identificador do checkout.");
      setCreateOpen(false);
      setCreateForm({ nome: "", descricao: "", oferta_id: "" });
      await load();
      setEditorId(id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar o checkout.");
    } finally {
      setCreating(false);
    }
  }

  async function copyPublic(checkout: Checkout) {
    const url = `${window.location.origin}/checkout/${checkout.public_token}`;
    await navigator.clipboard.writeText(url);
  }

  if (editorId) {
    return (
      <CheckoutEditor
        checkoutId={editorId}
        onBack={() => {
          setEditorId(null);
          void load();
        }}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Checkouts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Rascunho e versão publicada são independentes. A URL pública permanece estável.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Atualizar
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            Novo checkout
          </button>
        </div>
      </header>

      {error && (
        <div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3 rounded-xl border border-border bg-card p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar checkout, oferta ou produto"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        >
          <option value="">Todos os estados</option>
          <option value="publicado">Publicado</option>
          <option value="rascunho">Rascunho</option>
          <option value="arquivado">Arquivado</option>
        </select>
      </div>

      <section className="mt-6">
        {loading ? (
          <CardsSkeleton count={6} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="Nenhum checkout encontrado"
            description={
              offers.length
                ? "Crie um checkout a partir de uma oferta existente."
                : "Antes do checkout, crie e ative uma oferta. Produto e checkout são cadastros separados."
            }
            action={
              offers.length ? (
                <button
                  onClick={() => setCreateOpen(true)}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  Criar checkout
                </button>
              ) : (
                <a
                  href="/app/ofertas"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  Abrir ofertas
                </a>
              )
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((checkout) => (
              <div key={checkout.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{checkout.nome}</h3>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {checkout.produto_nome ?? "Produto não disponível"}
                    </p>
                  </div>
                  <StatusPill status={checkout.status} />
                </div>

                <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Oferta</p>
                  <p className="mt-1 text-sm font-medium">{checkout.oferta_nome ?? "—"}</p>
                  <p className="mt-1 text-sm font-semibold tabular-nums">
                    {formatBRL(checkout.preco)}
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Vendas confirmadas</p>
                    <p className="mt-1 font-semibold tabular-nums">{formatInt(checkout.pedidos_confirmados)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Faturamento bruto</p>
                    <p className="mt-1 font-semibold tabular-nums">{formatBRL(checkout.faturamento_bruto, { compact: true })}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                  <button
                    onClick={() => setEditorId(checkout.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </button>
                  {checkout.status === "publicado" && (
                    <>
                      <button
                        onClick={() => void copyPublic(checkout)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                      >
                        <Copy className="h-3.5 w-3.5" /> Copiar URL
                      </button>
                      <a
                        href={`/checkout/${checkout.public_token}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                      >
                        <Eye className="h-3.5 w-3.5" /> Abrir
                      </a>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {createOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">Novo checkout</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  O checkout usa uma oferta existente e começa como rascunho.
                </p>
              </div>
              <button onClick={() => setCreateOpen(false)} className="rounded-lg p-2 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-medium">Nome</span>
                <input
                  value={createForm.nome}
                  onChange={(e) => setCreateForm({ ...createForm, nome: e.target.value })}
                  className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  placeholder="Checkout principal"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Oferta</span>
                <select
                  value={createForm.oferta_id}
                  onChange={(e) => setCreateForm({ ...createForm, oferta_id: e.target.value })}
                  className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                >
                  <option value="">Selecione uma oferta ativa</option>
                  {offers.map((offer) => (
                    <option key={offer.id} value={offer.id}>
                      {offer.nome} · {offer.produto_nome} · {formatBRL(offer.preco)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium">Descrição interna</span>
                <textarea
                  value={createForm.descricao}
                  onChange={(e) => setCreateForm({ ...createForm, descricao: e.target.value })}
                  rows={3}
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setCreateOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium">
                Cancelar
              </button>
              <button
                disabled={creating || offers.length === 0}
                onClick={() => void createCheckout()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {creating ? "Criando..." : "Criar rascunho"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
