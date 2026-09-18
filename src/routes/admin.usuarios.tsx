import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Search, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/format";
import { EmptyState } from "@/components/app/EmptyState";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/usuarios")({
  component: AdminUsuariosPage,
});

type Row = {
  id: string;
  nome: string;
  email: string;
  empresa_id: string | null;
  empresa_nome: string;
  cargo: string;
  status: string;
  is_owner: boolean;
  is_admin_global: boolean;
  ultimo_login: string | null;
  created_at: string;
};

function AdminUsuariosPage() {
  const [rows,setRows]=useState<Row[]>([]);
  const [query,setQuery]=useState("");
  const [status,setStatus]=useState("");
  const [adminFilter,setAdminFilter]=useState("");
  const [loading,setLoading]=useState(true);
  const [acting,setActing]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [message,setMessage]=useState<string|null>(null);

  const load=useCallback(async()=>{
    setLoading(true);setError(null);
    try{
      const {data,error:rpcError}=await (supabase as any).rpc("fn_admin_usuarios_list",{
        p_query:query.trim()||null,
        p_status:status||null,
        p_admin_global:adminFilter===""?null:adminFilter==="sim",
        p_limit:200,p_offset:0,
      });
      if(rpcError) throw rpcError;
      setRows(((data??[]) as any[]).map((row)=>({
        id:String(row.id),nome:String(row.nome??"Usuário"),email:String(row.email??""),
        empresa_id:row.empresa_id?String(row.empresa_id):null,empresa_nome:String(row.empresa_nome??"Sem empresa"),
        cargo:String(row.cargo??""),status:String(row.status??""),is_owner:Boolean(row.is_owner),
        is_admin_global:Boolean(row.is_admin_global),ultimo_login:row.ultimo_login?String(row.ultimo_login):null,
        created_at:String(row.created_at),
      })));
    }catch(cause){setRows([]);setError(cause instanceof Error?cause.message:"Falha ao carregar usuários.");}
    finally{setLoading(false);}
  },[query,status,adminFilter]);

  useEffect(()=>{const timer=window.setTimeout(()=>void load(),200);return()=>window.clearTimeout(timer);},[load]);

  async function setUserStatus(row:Row,next:string){
    const reason=window.prompt("Motivo obrigatório:");
    if(!reason?.trim())return;
    setActing(true);setError(null);
    const {data,error:rpcError}=await (supabase as any).rpc("fn_admin_usuario_status_set",{p_profile_id:row.id,p_status:next,p_reason:reason.trim()});
    if(rpcError)setError(rpcError.message);else if(data){setMessage("Status atualizado. Sessões foram revogadas quando necessário.");await load();}
    setActing(false);
  }

  async function setGlobal(row:Row,enabled:boolean){
    const reason=window.prompt(enabled?"Motivo para conceder Admin Global:":"Motivo para revogar Admin Global:");
    if(!reason?.trim())return;
    setActing(true);setError(null);
    const {data,error:rpcError}=await (supabase as any).rpc("fn_admin_global_set",{p_profile_id:row.id,p_enabled:enabled,p_reason:reason.trim()});
    if(rpcError)setError(rpcError.message);else if(data){setMessage(enabled?"Admin Global concedido.":"Admin Global revogado.");await load();}
    setActing(false);
  }

  return <div className="mx-auto w-full max-w-[1450px] px-4 py-6 sm:px-6 sm:py-8">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><span className="rounded-md bg-destructive/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-destructive">Admin Global</span><h1 className="mt-2 text-2xl font-semibold">Usuários</h1><p className="mt-1 text-sm text-muted-foreground">Contas reais, estados de acesso e administração global auditada.</p></div><button onClick={()=>void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-medium disabled:opacity-50"><RefreshCw className={cn("h-4 w-4",loading&&"animate-spin")}/>Atualizar</button></header>
    {error&&<div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}{message&&<div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-700">{message}</div>}
    <div className="mt-5 grid gap-3 rounded-xl border border-border bg-card p-3 md:grid-cols-[1fr_180px_200px]"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Nome, e-mail ou empresa" className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm"/></div><select value={status} onChange={(e)=>setStatus(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option value="">Todos os estados</option><option value="ativo">Ativo</option><option value="inativo">Inativo</option><option value="suspenso">Suspenso</option><option value="bloqueado">Bloqueado</option></select><select value={adminFilter} onChange={(e)=>setAdminFilter(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option value="">Todos</option><option value="sim">Admin Global</option><option value="nao">Não Admin Global</option></select></div>
    <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card">{loading?<div className="p-12 text-center text-sm text-muted-foreground">Carregando usuários...</div>:rows.length===0?<EmptyState icon={Users} title="Nenhum usuário encontrado" description="Nenhuma conta demonstrativa é exibida."/>:<div className="overflow-x-auto"><table className="w-full min-w-[1250px] text-sm"><thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><th className="px-4 py-3">Usuário</th><th className="px-4 py-3">Empresa</th><th className="px-4 py-3">Cargo</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Papéis</th><th className="px-4 py-3">Último login</th><th className="px-4 py-3 text-right">Ações</th></tr></thead><tbody className="divide-y divide-border">{rows.map((row)=><tr key={row.id} className="hover:bg-muted/40"><td className="px-4 py-3.5"><p className="font-medium">{row.nome}</p><p className="text-xs text-muted-foreground">{row.email}</p></td><td className="px-4 py-3.5">{row.empresa_nome}</td><td className="px-4 py-3.5">{row.cargo||"—"}</td><td className="px-4 py-3.5 capitalize">{row.status}</td><td className="px-4 py-3.5"><div className="flex gap-1">{row.is_owner&&<span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">Owner</span>}{row.is_admin_global&&<span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive">Admin Global</span>}</div></td><td className="px-4 py-3.5 text-xs text-muted-foreground">{row.ultimo_login?formatDateTime(row.ultimo_login):"Não registrado"}</td><td className="px-4 py-3.5"><div className="flex justify-end gap-1.5"><select disabled={acting} value={row.status} onChange={(e)=>void setUserStatus(row,e.target.value)} className="h-8 rounded-lg border border-border bg-background px-2 text-xs"><option value="ativo">Ativo</option><option value="inativo">Inativo</option><option value="suspenso">Suspenso</option><option value="bloqueado">Bloqueado</option></select><button disabled={acting} onClick={()=>void setGlobal(row,!row.is_admin_global)} className="rounded-lg border border-border px-2.5 py-1.5 text-xs">{row.is_admin_global?"Revogar global":"Tornar global"}</button></div></td></tr>)}</tbody></table></div>}</section>
  </div>;
}
