import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Link2,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateTime, formatInt, formatPct } from "@/lib/format";
import { EmptyState } from "@/components/app/EmptyState";
import { cn } from "@/lib/utils";

type AffiliateOption = {
  id: string;
  name: string;
  code: string;
};

type Destination = {
  produto_id: string;
  produto_nome: string;
  destino_tipo: "checkout" | "link_pagamento";
  destino_id: string;
  destino_nome: string;
};

type LinkRow = {
  id: string;
  afiliado_id: string;
  afiliado_nome: string;
  produto_id: string | null;
  produto_nome: string;
  codigo: string;
  destino: string;
  status: string;
  cliques: number;
  vendas_confirmadas: number;
  conversao: number;
  comissao_reconhecida: number;
  created_at: string;
  total_registros: number;
};

const PAGE_SIZE = 20;

export function AffiliateLinksPage() {
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [affiliates, setAffiliates] = useState<AffiliateOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [destinationLoading, setDestinationLoading] = useState(false);
  const [form, setForm] = useState({
    afiliado_id: "",
    destino_key: "",
    campanha: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [linkResult, contextResult] = await Promise.all([
        (supabase as any).rpc("fn_links_afiliados_listar", {
          p_afiliado_id: null,
          p_busca: query.trim() || null,
          p_limit: PAGE_SIZE,
          p_offset: (page - 1) * PAGE_SIZE,
        }),
        (supabase as any).rpc("fn_afiliado_contextos"),
      ]);

      if (linkResult.error) throw linkResult.error;
      if (contextResult.error) throw contextResult.error;

      setLinks(
        ((linkResult.data ?? []) as any[]).map((row) => ({
          id: String(row.id),
          afiliado_id: String(row.afiliado_id),
          afiliado_nome: String(row.afiliado_nome ?? "Afiliado"),
          produto_id: row.produto_id ? String(row.produto_id) : null,
          produto_nome: String(row.produto_nome ?? "Produto"),
          codigo: String(row.codigo),
          destino: String(row.destino ?? ""),
          status: String(row.status ?? "ativo"),
          cliques: Number(row.cliques ?? 0),
          vendas_confirmadas: Number(row.vendas_confirmadas ?? 0),
          conversao: Number(row.conversao ?? 0),
          comissao_reconhecida: Number(row.comissao_reconhecida ?? 0),
          created_at: String(row.created_at),
          total_registros: Number(row.total_registros ?? 0),
        })),
      );

      let options: AffiliateOption[] = [];
      const management = await (supabase as any).rpc("fn_afiliados_listar");
      if (!management.error) {
        options = ((management.data ?? []) as any[])
          .filter((row) => String(row.status) === "ativo")
          .map((row) => ({
            id: String(row.id),
            name: String(row.nome ?? "Afiliado"),
            code: String(row.codigo ?? ""),
          }));
      } else {
        options = ((contextResult.data ?? []) as any[])
          .filter((row) => String(row.status) === "ativo")
          .map((row) => ({
            id: String(row.afiliado_id),
            name: String(row.empresa_nome ?? "Operação afiliada"),
            code: String(row.codigo ?? ""),
          }));
      }
      setAffiliates(options);
    } catch (cause) {
      setLinks([]);
      setAffiliates([]);
      setError(
        cause instanceof Error ? cause.message : "Não foi possível carregar os links.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 200);
    return () => window.clearTimeout(timer);
  }, [load]);

  const total = links[0]?.total_registros ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const totals = useMemo(
    () =>
      links.reduce(
        (acc, link) => {
          acc.clicks += link.cliques;
          acc.sales += link.vendas_confirmadas;
          acc.commission += link.comissao_reconhecida;
          return acc;
        },
        { clicks: 0, sales: 0, commission: 0 },
      ),
    [links],
  );

  async function loadDestinations(affiliateId: string) {
    setDestinationLoading(true);
    setDestinations([]);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_afiliado_destinos_listar",
        { p_afiliado_id: affiliateId },
      );
      if (rpcError) throw rpcError;
      setDestinations(
        ((data ?? []) as any[]).map((row) => ({
          produto_id: String(row.produto_id),
          produto_nome: String(row.produto_nome),
          destino_tipo: String(row.destino_tipo) as Destination["destino_tipo"],
          destino_id: String(row.destino_id),
          destino_nome: String(row.destino_nome),
        })),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar os destinos autorizados.",
      );
    } finally {
      setDestinationLoading(false);
    }
  }

  async function openCreate() {
    const first = affiliates.at(0);
    setForm({
      afiliado_id: first?.id ?? "",
      destino_key: "",
      campanha: "",
    });
    setCreateOpen(true);
    setError(null);
    setMessage(null);
    if (first) await loadDestinations(first.id);
  }

  async function createLink() {
    const destination = destinations.find(
      (item) =>
        `${item.destino_tipo}:${item.destino_id}` === form.destino_key,
    );
    if (!form.afiliado_id || !destination) {
      setError("Selecione um afiliado e um destino autorizado.");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_afiliado_link_criar",
        {
          p_afiliado_id: form.afiliado_id,
          p_produto_id: destination.produto_id,
          p_checkout_id:
            destination.destino_tipo === "checkout"
              ? destination.destino_id
              : null,
          p_link_pagamento_id:
            destination.destino_tipo === "link_pagamento"
              ? destination.destino_id
              : null,
          p_nome_campanha: form.campanha.trim() || null,
        },
      );
      if (rpcError) throw rpcError;
      if (!data) throw new Error("O link não foi criado.");

      setCreateOpen(false);
      setMessage("Link rastreável criado com sucesso.");
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível criar o link.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function copyLink(code: string) {
    await navigator.clipboard.writeText(
      `${window.location.origin}/r/${encodeURIComponent(code)}`,
    );
    setMessage("Link rastreável copiado.");
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Links de afiliado</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Links autorizados, cliques válidos, vendas confirmadas e comissão reconhecida.
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
            onClick={() => void openCreate()}
            disabled={affiliates.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Criar link
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

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Cliques válidos nesta página</p>
          <p className="mt-3 text-2xl font-semibold">{formatInt(totals.clicks)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Vendas confirmadas</p>
          <p className="mt-3 text-2xl font-semibold">{formatInt(totals.sales)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Comissão reconhecida</p>
          <p className="mt-3 text-2xl font-semibold text-primary">
            {formatBRL(totals.commission)}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar código, campanha, afiliado ou produto"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm"
          />
        </div>
      </div>

      <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Carregando links...
          </div>
        ) : links.length === 0 ? (
          <EmptyState
            icon={Link2}
            title="Nenhum link encontrado"
            description="Crie um link para um produto e destino autorizados."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3">Link</th>
                  <th className="px-5 py-3">Afiliado</th>
                  <th className="px-5 py-3">Produto</th>
                  <th className="px-5 py-3 text-right">Cliques</th>
                  <th className="px-5 py-3 text-right">Vendas</th>
                  <th className="px-5 py-3 text-right">Conversão</th>
                  <th className="px-5 py-3 text-right">Comissão</th>
                  <th className="px-5 py-3">Criado</th>
                  <th className="px-5 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {links.map((link) => (
                  <tr key={link.id} className="hover:bg-muted/40">
                    <td className="px-5 py-3.5">
                      <p className="font-mono text-xs font-medium text-primary">
                        /r/{link.codigo}
                      </p>
                      <p className="mt-0.5 text-[11px] capitalize text-muted-foreground">
                        {link.status}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 font-medium">{link.afiliado_nome}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{link.produto_nome}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums">{formatInt(link.cliques)}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums">{formatInt(link.vendas_confirmadas)}</td>
                    <td className="px-5 py-3.5 text-right tabular-nums">{formatPct(link.conversao, 2)}</td>
                    <td className="px-5 py-3.5 text-right font-semibold tabular-nums">
                      {formatBRL(link.comissao_reconhecida)}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground">
                      {formatDateTime(link.created_at)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => void copyLink(link.codigo)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copiar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {links.length > 0 && (
          <footer className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
            <span>{formatInt(total)} link{total === 1 ? "" : "s"}</span>
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
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
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

      {createOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">Criar link de afiliado</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Só aparecem destinos ligados a produtos autorizados.
                </p>
              </div>
              <button
                onClick={() => setCreateOpen(false)}
                className="rounded-lg p-2 hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-medium">Afiliado / operação</span>
                <select
                  value={form.afiliado_id}
                  onChange={(e) => {
                    const afiliadoId = e.target.value;
                    setForm({
                      ...form,
                      afiliado_id: afiliadoId,
                      destino_key: "",
                    });
                    void loadDestinations(afiliadoId);
                  }}
                  className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                >
                  {affiliates.map((affiliate) => (
                    <option key={affiliate.id} value={affiliate.id}>
                      {affiliate.name} · {affiliate.code}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium">Destino autorizado</span>
                <select
                  value={form.destino_key}
                  onChange={(e) =>
                    setForm({ ...form, destino_key: e.target.value })
                  }
                  disabled={destinationLoading}
                  className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-50"
                >
                  <option value="">
                    {destinationLoading
                      ? "Carregando..."
                      : "Selecione um checkout ou link de pagamento"}
                  </option>
                  {destinations.map((destination) => (
                    <option
                      key={`${destination.destino_tipo}:${destination.destino_id}`}
                      value={`${destination.destino_tipo}:${destination.destino_id}`}
                    >
                      {destination.produto_nome} ·{" "}
                      {destination.destino_tipo === "checkout"
                        ? "Checkout"
                        : "Link de pagamento"}{" "}
                      · {destination.destino_nome}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium">Nome da campanha</span>
                <input
                  value={form.campanha}
                  onChange={(e) =>
                    setForm({ ...form, campanha: e.target.value })
                  }
                  placeholder="Opcional"
                  className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </label>

              <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                O código do link identifica a origem, mas a comissão só é reconhecida depois que o pagamento real é confirmado.
              </div>

              <button
                onClick={() => void createLink()}
                disabled={creating || !form.destino_key}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {creating ? "Criando..." : "Criar link rastreável"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
