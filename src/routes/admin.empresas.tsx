import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Building2, RefreshCw, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatInt } from "@/lib/format";
import { EmptyState } from "@/components/app/EmptyState";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/empresas")({
  component: AdminEmpresasPage,
});

type Row = {
  id: string;
  nome: string;
  razao_social: string | null;
  cnpj: string | null;
  email: string | null;
  plano: string;
  status: string;
  owner_nome: string | null;
  owner_email: string | null;
  usuarios: number;
  pedidos_confirmados: number;
  volume_confirmado: number;
  devolucoes: number;
  risco_score: number;
  risco_nivel: string;
  vip: boolean;
  total_registros: number;
};

function AdminEmpresasPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [plan, setPlan] = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_admin_empresas_list",
        {
          p_query: query.trim() || null,
          p_status: status || null,
          p_plano: plan || null,
          p_limit: 200,
          p_offset: 0,
        },
      );
      if (rpcError) throw rpcError;
      setRows(
        ((data ?? []) as any[]).map((row) => ({
          id: String(row.id),
          nome: String(row.nome ?? "Empresa"),
          razao_social: row.razao_social ? String(row.razao_social) : null,
          cnpj: row.cnpj ? String(row.cnpj) : null,
          email: row.email ? String(row.email) : null,
          plano: String(row.plano ?? ""),
          status: String(row.status ?? ""),
          owner_nome: row.owner_nome ? String(row.owner_nome) : null,
          owner_email: row.owner_email ? String(row.owner_email) : null,
          usuarios: Number(row.usuarios ?? 0),
          pedidos_confirmados: Number(row.pedidos_confirmados ?? 0),
          volume_confirmado: Number(row.volume_confirmado ?? 0),
          devolucoes: Number(row.devolucoes ?? 0),
          risco_score: Number(row.risco_score ?? 0),
          risco_nivel: String(row.risco_nivel ?? "nao_avaliado"),
          vip: Boolean(row.vip),
          total_registros: Number(row.total_registros ?? 0),
        })),
      );
    } catch (cause) {
      setRows([]);
      setError(cause instanceof Error ? cause.message : "Falha ao carregar empresas.");
    } finally {
      setLoading(false);
    }
  }, [query, status, plan]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 200);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function update(row: Row, nextStatus?: string, nextVip?: boolean) {
    const reason = window.prompt("Motivo/observação da alteração:");
    if (!reason?.trim()) return;
    setActing(true);
    setError(null);
    const { data, error: rpcError } = await (supabase as any).rpc(
      "fn_admin_empresa_set",
      {
        p_empresa_id: row.id,
        p_status: nextStatus ?? null,
        p_plano: null,
        p_vip: nextVip ?? null,
        p_risco_score: null,
        p_risco_nivel: null,
        p_observacao: reason.trim(),
      },
    );
    if (rpcError) setError(rpcError.message);
    else if (data) {
      setMessage("Empresa atualizada e ação auditada.");
      await load();
    }
    setActing(false);
  }

  const total = rows.at(0)?.total_registros ?? 0;

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="rounded-md bg-destructive/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-destructive">Admin Global</span>
          <h1 className="mt-2 text-2xl font-semibold">Empresas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Empresas reais, volume confirmado e controles administrativos.</p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-medium disabled:opacity-50">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />Atualizar
        </button>
      </header>

      {error && <div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
      {message && <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-700">{message}</div>}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Empresas</p><p className="mt-2 text-2xl font-semibold">{formatInt(total)}</p></div>
        <div className="rounded-xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Pedidos confirmados carregados</p><p className="mt-2 text-2xl font-semibold">{formatInt(rows.reduce((a,b) => a+b.pedidos_confirmados,0))}</p></div>
        <div className="rounded-xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Volume confirmado carregado</p><p className="mt-2 text-2xl font-semibold">{formatBRL(rows.reduce((a,b) => a+b.volume_confirmado,0), { compact: true })}</p></div>
      </div>

      <div className="mt-5 grid gap-3 rounded-xl border border-border bg-card p-3 md:grid-cols-[1fr_180px_180px]">
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nome, CNPJ ou e-mail" className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm"/></div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option value="">Todos os estados</option><option value="ativo">Ativo</option><option value="inativo">Inativo</option><option value="suspenso">Suspenso</option><option value="bloqueado">Bloqueado</option></select>
        <select value={plan} onChange={(e) => setPlan(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option value="">Todos os planos</option><option value="free">Free</option><option value="pro">Pro</option><option value="enterprise">Enterprise</option></select>
      </div>

      <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        {loading ? <div className="p-12 text-center text-sm text-muted-foreground">Carregando empresas...</div> :
        rows.length === 0 ? <EmptyState icon={Building2} title="Nenhuma empresa encontrada" description="Nenhuma empresa demonstrativa é exibida."/> :
        <div className="overflow-x-auto"><table className="w-full min-w-[1300px] text-sm">
          <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><th className="px-4 py-3">Empresa</th><th className="px-4 py-3">Owner</th><th className="px-4 py-3">Plano</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Usuários</th><th className="px-4 py-3 text-right">Pedidos</th><th className="px-4 py-3 text-right">Volume</th><th className="px-4 py-3">Risco</th><th className="px-4 py-3 text-right">Ações</th></tr></thead>
          <tbody className="divide-y divide-border">{rows.map((row) => <tr key={row.id} className="hover:bg-muted/40">
            <td className="px-4 py-3.5"><p className="font-medium">{row.nome}</p><p className="text-xs text-muted-foreground">{row.cnpj || row.email || "Sem documento"}</p></td>
            <td className="px-4 py-3.5"><p>{row.owner_nome || "Não identificado"}</p><p className="text-xs text-muted-foreground">{row.owner_email || "—"}</p></td>
            <td className="px-4 py-3.5 uppercase">{row.plano}</td><td className="px-4 py-3.5 capitalize">{row.status}</td>
            <td className="px-4 py-3.5 text-right">{formatInt(row.usuarios)}</td><td className="px-4 py-3.5 text-right">{formatInt(row.pedidos_confirmados)}</td><td className="px-4 py-3.5 text-right font-semibold">{formatBRL(row.volume_confirmado,{compact:true})}</td>
            <td className="px-4 py-3.5"><span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{row.risco_nivel} · {row.risco_score}{row.vip ? " · VIP" : ""}</span></td>
            <td className="px-4 py-3.5"><div className="flex justify-end gap-1.5"><button disabled={acting} onClick={() => void update(row, undefined, !row.vip)} className="rounded-lg border border-border px-2.5 py-1.5 text-xs">{row.vip ? "Remover VIP" : "VIP"}</button><select disabled={acting} value={row.status} onChange={(e) => void update(row,e.target.value,undefined)} className="h-8 rounded-lg border border-border bg-background px-2 text-xs"><option value="ativo">Ativo</option><option value="inativo">Inativo</option><option value="suspenso">Suspenso</option><option value="bloqueado">Bloqueado</option></select></div></td>
          </tr>)}</tbody>
        </table></div>}
      </section>
    </div>
  );
}
