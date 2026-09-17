import { useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Plus, RefreshCw, Search, Tags, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatInt } from "@/lib/format";
import { EmptyState } from "@/components/app/EmptyState";
import { TableSkeleton } from "@/components/app/Skeletons";
import { cn } from "@/lib/utils";

type Offer = {
  id: string;
  produto_id: string;
  produto_nome: string;
  nome: string;
  descricao: string | null;
  preco: number;
  preco_comparacao: number | null;
  status: "rascunho" | "ativa" | "pausada" | "arquivada";
  checkouts: number;
  pedidos_confirmados: number;
  faturamento_bruto: number;
};

type Product = { id: string; nome: string; preco: number; status: string };

const EMPTY = {
  id: null as string | null,
  produto_id: "",
  nome: "",
  descricao: "",
  preco: "",
  preco_comparacao: "",
  status: "rascunho" as Offer["status"],
};

export function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [editorOpen, setEditorOpen] = useState(false);
  const createKey = useRef(crypto.randomUUID());

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [{ data, error: listError }, { data: productData, error: productError }] =
        await Promise.all([
          (supabase as any).rpc("fn_ofertas_listar", {
            p_busca: null,
            p_status: null,
            p_limit: 200,
            p_offset: 0,
          }),
          supabase
            .from("produtos")
            .select("id,nome,preco,status")
            .is("deleted_at", null)
            .neq("status", "arquivado")
            .order("nome"),
        ]);

      if (listError) throw listError;
      if (productError) throw productError;

      setOffers(
        ((data ?? []) as any[]).map((row) => ({
          ...row,
          preco: Number(row.preco ?? 0),
          preco_comparacao:
            row.preco_comparacao == null ? null : Number(row.preco_comparacao),
          checkouts: Number(row.checkouts ?? 0),
          pedidos_confirmados: Number(row.pedidos_confirmados ?? 0),
          faturamento_bruto: Number(row.faturamento_bruto ?? 0),
        })),
      );
      setProducts((productData ?? []) as Product[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar as ofertas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    return offers.filter((offer) => {
      if (status && offer.status !== status) return false;
      if (!q) return true;
      return (
        offer.nome.toLocaleLowerCase("pt-BR").includes(q) ||
        offer.produto_nome.toLocaleLowerCase("pt-BR").includes(q) ||
        offer.id.toLowerCase().includes(q)
      );
    });
  }, [offers, query, status]);

  function openNew() {
    createKey.current = crypto.randomUUID();
    setForm(EMPTY);
    setEditorOpen(true);
    setError(null);
  }

  function openEdit(offer: Offer) {
    setForm({
      id: offer.id,
      produto_id: offer.produto_id,
      nome: offer.nome,
      descricao: offer.descricao ?? "",
      preco: String(offer.preco).replace(".", ","),
      preco_comparacao:
        offer.preco_comparacao == null
          ? ""
          : String(offer.preco_comparacao).replace(".", ","),
      status: offer.status,
    });
    setEditorOpen(true);
    setError(null);
  }

  async function save() {
    const price = Number(form.preco.replace(",", "."));
    const compare = form.preco_comparacao
      ? Number(form.preco_comparacao.replace(",", "."))
      : null;

    if (!form.produto_id || !form.nome.trim() || !Number.isFinite(price) || price < 0) {
      setError("Informe produto, nome e preço válido.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc("fn_oferta_salvar", {
        p_id: form.id,
        p_produto_id: form.produto_id,
        p_nome: form.nome.trim(),
        p_descricao: form.descricao.trim() || null,
        p_preco: price,
        p_preco_comparacao: compare,
        p_status: form.status,
        p_vigencia_inicio: null,
        p_vigencia_fim: null,
        p_permitir_valor_personalizado: false,
        p_valor_minimo: null,
        p_valor_maximo: null,
        p_idempotency_key: form.id ? null : createKey.current,
      });
      if (rpcError) throw rpcError;
      if (!data) throw new Error("O banco não retornou o identificador da oferta.");
      setEditorOpen(false);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar a oferta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ofertas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Condições comerciais separadas do cadastro do produto e do layout do checkout.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-medium hover:bg-muted"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Atualizar
          </button>
          <button
            onClick={openNew}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Nova oferta
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
            placeholder="Buscar oferta ou produto"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        >
          <option value="">Todas as situações</option>
          <option value="ativa">Ativa</option>
          <option value="rascunho">Rascunho</option>
          <option value="pausada">Pausada</option>
          <option value="arquivada">Arquivada</option>
        </select>
      </div>

      <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Tags}
            title="Nenhuma oferta encontrada"
            description="Produtos podem existir sem oferta. Crie uma oferta quando quiser definir uma condição comercial."
            action={
              <button onClick={openNew} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                Criar oferta
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3">Oferta</th>
                  <th className="px-5 py-3">Produto</th>
                  <th className="px-5 py-3">Situação</th>
                  <th className="px-5 py-3 text-right">Preço</th>
                  <th className="px-5 py-3 text-right">Checkouts</th>
                  <th className="px-5 py-3 text-right">Vendas</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((offer) => (
                  <tr key={offer.id} className="hover:bg-muted/40">
                    <td className="px-5 py-3.5">
                      <p className="font-medium">{offer.nome}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{offer.id}</p>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">{offer.produto_nome}</td>
                    <td className="px-5 py-3.5 capitalize">{offer.status}</td>
                    <td className="px-5 py-3.5 text-right font-semibold tabular-nums">{formatBRL(offer.preco)}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums">{formatInt(offer.checkouts)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <p className="tabular-nums">{formatInt(offer.pedidos_confirmados)}</p>
                      <p className="text-[11px] text-muted-foreground">{formatBRL(offer.faturamento_bruto, { compact: true })}</p>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => openEdit(offer)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editorOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">{form.id ? "Editar oferta" : "Nova oferta"}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Alterar a oferta não reescreve pedidos já criados.
                </p>
              </div>
              <button onClick={() => setEditorOpen(false)} className="rounded-lg p-2 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-medium">Produto</span>
                <select
                  value={form.produto_id}
                  onChange={(e) => {
                    const p = products.find((item) => item.id === e.target.value);
                    setForm({
                      ...form,
                      produto_id: e.target.value,
                      preco: form.preco || (p ? String(p.preco).replace(".", ",") : ""),
                    });
                  }}
                  className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                >
                  <option value="">Selecione</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium">Nome da oferta</span>
                <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm" />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Descrição</span>
                <textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={3} className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label>
                  <span className="text-sm font-medium">Preço</span>
                  <input inputMode="decimal" value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value })} className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm" />
                </label>
                <label>
                  <span className="text-sm font-medium">Preço de comparação</span>
                  <input inputMode="decimal" value={form.preco_comparacao} onChange={(e) => setForm({ ...form, preco_comparacao: e.target.value })} className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm" />
                </label>
              </div>
              <label className="block">
                <span className="text-sm font-medium">Situação</span>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Offer["status"] })} className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm">
                  <option value="rascunho">Rascunho</option>
                  <option value="ativa">Ativa</option>
                  <option value="pausada">Pausada</option>
                  <option value="arquivada">Arquivada</option>
                </select>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setEditorOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium">Cancelar</button>
              <button disabled={saving} onClick={() => void save()} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {saving ? "Salvando..." : "Salvar oferta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
