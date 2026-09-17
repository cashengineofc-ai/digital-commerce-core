import { useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  Eye,
  Link2,
  Plus,
  Power,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateTime, formatInt } from "@/lib/format";
import { TableSkeleton } from "@/components/app/Skeletons";
import { EmptyState } from "@/components/app/EmptyState";
import { cn } from "@/lib/utils";

type PaymentLink = {
  id: string;
  public_token: string;
  codigo: string;
  titulo: string;
  checkout_nome: string;
  oferta_nome: string;
  produto_nome: string;
  valor: number;
  status: string;
  uso_unico: boolean;
  max_usos: number | null;
  contador_usos: number;
  data_expiracao: string | null;
  pedidos_confirmados: number;
  faturamento_bruto: number;
  created_at: string;
};

type Checkout = {
  id: string;
  nome: string;
  oferta_nome: string;
  produto_nome: string;
  preco: number;
};

export function PaymentLinksPage() {
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const createKey = useRef(crypto.randomUUID());
  const [form, setForm] = useState({
    checkout_id: "",
    titulo: "",
    descricao: "",
    valor: "",
    uso_unico: false,
    max_usos: "",
    expira_em: "",
    permitir_editar_valor: false,
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [linkResult, checkoutResult] = await Promise.all([
        (supabase as any).rpc("fn_links_pagamento_listar", {
          p_busca: null,
          p_limit: 200,
          p_offset: 0,
        }),
        (supabase as any).rpc("fn_checkouts_listar", {
          p_busca: null,
          p_status: "publicado",
          p_limit: 200,
          p_offset: 0,
        }),
      ]);

      if (linkResult.error) throw linkResult.error;
      if (checkoutResult.error) throw checkoutResult.error;

      setLinks(
        ((linkResult.data ?? []) as any[]).map((row) => ({
          ...row,
          valor: Number(row.valor ?? 0),
          contador_usos: Number(row.contador_usos ?? 0),
          max_usos: row.max_usos == null ? null : Number(row.max_usos),
          pedidos_confirmados: Number(row.pedidos_confirmados ?? 0),
          faturamento_bruto: Number(row.faturamento_bruto ?? 0),
        })),
      );

      setCheckouts(
        ((checkoutResult.data ?? []) as any[]).map((row) => ({
          id: String(row.id),
          nome: String(row.nome ?? ""),
          oferta_nome: String(row.oferta_nome ?? ""),
          produto_nome: String(row.produto_nome ?? ""),
          preco: Number(row.preco ?? 0),
        })),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar os links.");
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    return links.filter((link) => {
      if (!q) return true;
      return (
        link.codigo.toLocaleLowerCase("pt-BR").includes(q) ||
        link.titulo.toLocaleLowerCase("pt-BR").includes(q) ||
        link.produto_nome.toLocaleLowerCase("pt-BR").includes(q)
      );
    });
  }, [links, query]);

  function openCreate() {
    createKey.current = crypto.randomUUID();
    setForm({
      checkout_id: "",
      titulo: "",
      descricao: "",
      valor: "",
      uso_unico: false,
      max_usos: "",
      expira_em: "",
      permitir_editar_valor: false,
    });
    setCreateOpen(true);
    setError(null);
  }

  async function createLink() {
    const checkout = checkouts.find((item) => item.id === form.checkout_id);
    if (!checkout || !form.titulo.trim()) {
      setError("Selecione um checkout publicado e informe o título.");
      return;
    }

    const amount = form.valor.trim()
      ? Number(form.valor.replace(",", "."))
      : checkout.preco;

    if (!Number.isFinite(amount) || amount < 0) {
      setError("Informe um valor válido.");
      return;
    }

    const maxUses = form.uso_unico
      ? 1
      : form.max_usos
        ? Number(form.max_usos)
        : null;

    if (maxUses != null && (!Number.isInteger(maxUses) || maxUses <= 0)) {
      setError("O limite de usos deve ser um número inteiro positivo.");
      return;
    }

    const expiresAt = form.expira_em
      ? new Date(form.expira_em).toISOString()
      : null;

    setCreating(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_link_pagamento_criar",
        {
          p_checkout_id: checkout.id,
          p_titulo: form.titulo.trim(),
          p_descricao: form.descricao.trim() || null,
          p_uso_unico: form.uso_unico,
          p_max_usos: maxUses,
          p_expira_em: expiresAt,
          p_permitir_editar_valor: form.permitir_editar_valor,
          p_valor: amount,
          p_idempotency_key: createKey.current,
        },
      );
      if (rpcError) throw rpcError;
      if (!data) throw new Error("O banco não confirmou a criação do link.");
      setCreateOpen(false);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar o link.");
    } finally {
      setCreating(false);
    }
  }

  async function disableLink(id: string) {
    if (!window.confirm("Desativar este link? Novos pedidos serão bloqueados.")) return;
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_link_pagamento_desativar",
        { p_link_id: id },
      );
      if (rpcError) throw rpcError;
      if (!data) throw new Error("O link já estava inativo.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível desativar.");
    }
  }

  async function copyUrl(link: PaymentLink) {
    await navigator.clipboard.writeText(
      `${window.location.origin}/pay/${link.public_token}`,
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Links de pagamento</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            URLs públicas ligadas a checkout e oferta reais. Abrir ou gerar Pix não contabiliza venda.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Atualizar
          </button>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Criar link
          </button>
        </div>
      </header>

      {error && (
        <div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mt-6 rounded-xl border border-border bg-card p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por código, título ou produto"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none"
          />
        </div>
      </div>

      <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <TableSkeleton rows={6} cols={8} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Link2}
            title="Nenhum link de pagamento encontrado"
            description="Crie um link a partir de um checkout já publicado."
            action={
              <button
                onClick={openCreate}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                Criar link
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1150px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3">Link</th>
                  <th className="px-5 py-3">Checkout / produto</th>
                  <th className="px-5 py-3 text-right">Valor</th>
                  <th className="px-5 py-3">Uso</th>
                  <th className="px-5 py-3 text-right">Vendas</th>
                  <th className="px-5 py-3 text-right">Faturamento</th>
                  <th className="px-5 py-3">Validade</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((link) => (
                  <tr key={link.id} className="hover:bg-muted/40">
                    <td className="px-5 py-3.5">
                      <p className="font-medium">{link.titulo}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{link.codigo}</p>
                      <p className="mt-0.5 text-[11px] capitalize text-muted-foreground">{link.status}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium">{link.checkout_nome}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{link.produto_nome}</p>
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold tabular-nums">{formatBRL(link.valor)}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                      {link.uso_unico ? "Uso único" : link.max_usos ? `Máx. ${link.max_usos}` : "Múltiplos usos"}
                      <p className="mt-0.5 text-[11px]">{formatInt(link.contador_usos)} confirmados</p>
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums">{formatInt(link.pedidos_confirmados)}</td>
                    <td className="px-5 py-3.5 text-right font-semibold tabular-nums">{formatBRL(link.faturamento_bruto, { compact: true })}</td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground">
                      {link.data_expiracao ? formatDateTime(link.data_expiracao) : "Sem expiração"}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-2">
                        {link.status === "ativo" && (
                          <>
                            <button onClick={() => void copyUrl(link)} className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-muted" title="Copiar URL">
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <a href={`/pay/${link.public_token}`} target="_blank" rel="noreferrer" className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-muted" title="Abrir">
                              <Eye className="h-3.5 w-3.5" />
                            </a>
                            <button onClick={() => void disableLink(link.id)} className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-muted" title="Desativar">
                              <Power className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {createOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">Novo link de pagamento</h2>
                <p className="mt-1 text-sm text-muted-foreground">A URL só funciona enquanto checkout, oferta e link estiverem disponíveis.</p>
              </div>
              <button onClick={() => setCreateOpen(false)} className="rounded-lg p-2 hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-medium">Checkout publicado</span>
                <select value={form.checkout_id} onChange={(e) => {
                  const checkout=checkouts.find((item)=>item.id===e.target.value);
                  setForm({ ...form,checkout_id:e.target.value,valor:checkout ? String(checkout.preco).replace(".",",") : form.valor });
                }} className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm">
                  <option value="">Selecione</option>
                  {checkouts.map((checkout)=><option key={checkout.id} value={checkout.id}>{checkout.nome} · {checkout.produto_nome} · {formatBRL(checkout.preco)}</option>)}
                </select>
              </label>
              <label className="block"><span className="text-sm font-medium">Título</span><input value={form.titulo} onChange={(e)=>setForm({ ...form,titulo:e.target.value })} className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm" /></label>
              <label className="block"><span className="text-sm font-medium">Descrição</span><textarea value={form.descricao} onChange={(e)=>setForm({ ...form,descricao:e.target.value })} rows={2} className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></label>
              <label className="block"><span className="text-sm font-medium">Valor</span><input inputMode="decimal" value={form.valor} onChange={(e)=>setForm({ ...form,valor:e.target.value })} className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm" /></label>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  Uso único
                  <input type="checkbox" checked={form.uso_unico} onChange={(e)=>setForm({ ...form,uso_unico:e.target.checked,max_usos:e.target.checked?"1":form.max_usos })} />
                </label>
                <label><span className="text-xs text-muted-foreground">Máx. usos</span><input type="number" min="1" disabled={form.uso_unico} value={form.max_usos} onChange={(e)=>setForm({ ...form,max_usos:e.target.value })} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-50" /></label>
              </div>
              <label className="block"><span className="text-sm font-medium">Expira em</span><input type="datetime-local" value={form.expira_em} onChange={(e)=>setForm({ ...form,expira_em:e.target.value })} className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm" /></label>
              <label className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                Permitir valor personalizado
                <input type="checkbox" checked={form.permitir_editar_valor} onChange={(e)=>setForm({ ...form,permitir_editar_valor:e.target.checked })} />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setCreateOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium">Cancelar</button>
              <button disabled={creating || checkouts.length===0} onClick={() => void createLink()} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{creating?"Criando...":"Criar link"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
