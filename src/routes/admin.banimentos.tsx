import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Ban, RefreshCw, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/format";
import { EmptyState } from "@/components/app/EmptyState";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/banimentos")({
  component: AdminBanimentosPage,
});

type BanRow = {
  id: string;
  tipo: string;
  identificador: string;
  empresa_id: string | null;
  empresa_nome: string | null;
  profile_id: string | null;
  profile_nome: string | null;
  motivo: string;
  detalhamento: string | null;
  gravidade: string;
  data_inicio: string;
  data_fim: string | null;
  permanente: boolean;
  desfeito: boolean;
  aplicado_por_nome: string | null;
};

type Company = { id: string; nome: string };
type User = { id: string; nome: string; email: string };

function AdminBanimentosPage() {
  const [rows,setRows]=useState<BanRow[]>([]);
  const [companies,setCompanies]=useState<Company[]>([]);
  const [users,setUsers]=useState<User[]>([]);
  const [filter,setFilter]=useState("ativos");
  const [open,setOpen]=useState(false);
  const [loading,setLoading]=useState(true);
  const [acting,setActing]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [message,setMessage]=useState<string|null>(null);
  const [form,setForm]=useState({tipo:"usuario",target:"",identificador:"",motivo:"",detalhamento:"",gravidade:"alto"});

  const load=useCallback(async()=>{
    setLoading(true);setError(null);
    try{
      const [b,c,u]=await Promise.all([
        (supabase as any).rpc("fn_admin_banimentos_list",{p_active:filter==="todos"?null:filter==="ativos"}),
        (supabase as any).rpc("fn_admin_empresas_list",{p_query:null,p_status:null,p_plano:null,p_limit:200,p_offset:0}),
        (supabase as any).rpc("fn_admin_usuarios_list",{p_query:null,p_status:null,p_admin_global:null,p_limit:200,p_offset:0}),
      ]);
      if(b.error)throw b.error;if(c.error)throw c.error;if(u.error)throw u.error;
      setRows(((b.data??[]) as any[]).map((row)=>({
        ...row,id:String(row.id),tipo:String(row.tipo),identificador:String(row.identificador),
        empresa_id:row.empresa_id?String(row.empresa_id):null,empresa_nome:row.empresa_nome?String(row.empresa_nome):null,
        profile_id:row.profile_id?String(row.profile_id):null,profile_nome:row.profile_nome?String(row.profile_nome):null,
        motivo:String(row.motivo),detalhamento:row.detalhamento?String(row.detalhamento):null,gravidade:String(row.gravidade),
        data_inicio:String(row.data_inicio),data_fim:row.data_fim?String(row.data_fim):null,permanente:Boolean(row.permanente),
        desfeito:Boolean(row.desfeito),aplicado_por_nome:row.aplicado_por_nome?String(row.aplicado_por_nome):null,
      })));
      setCompanies(((c.data??[]) as any[]).map((row)=>({id:String(row.id),nome:String(row.nome??"Empresa")})));
      setUsers(((u.data??[]) as any[]).map((row)=>({id:String(row.id),nome:String(row.nome??"Usuário"),email:String(row.email??"")})));
    }catch(cause){setError(cause instanceof Error?cause.message:"Falha ao carregar banimentos.");}
    finally{setLoading(false);}
  },[filter]);

  useEffect(()=>{void load();},[load]);

  async function apply(){
    if(!form.motivo.trim()){setError("Informe o motivo.");return;}
    const companyId=form.tipo==="empresa"?form.target:null;
    const profileId=form.tipo==="usuario"?form.target:null;
    const identifier=(form.tipo==="empresa"||form.tipo==="usuario")?form.target:form.identificador.trim();
    if(!identifier){setError("Informe o alvo.");return;}
    setActing(true);setError(null);
    const {data,error:rpcError}=await (supabase as any).rpc("fn_admin_banir",{
      p_tipo:form.tipo,p_empresa_id:companyId,p_profile_id:profileId,p_identificador:identifier,
      p_motivo:form.motivo.trim(),p_detalhamento:form.detalhamento.trim()||null,p_gravidade:form.gravidade,
      p_permanente:true,p_data_fim:null,
    });
    if(rpcError)setError(rpcError.message);else if(data){setOpen(false);setMessage("Banimento aplicado e acesso revogado quando aplicável.");await load();}
    setActing(false);
  }

  async function revoke(row:BanRow){
    const reason=window.prompt("Motivo para revogar o banimento:");
    if(!reason?.trim())return;
    setActing(true);setError(null);
    const {data,error:rpcError}=await (supabase as any).rpc("fn_admin_banimento_revogar",{p_id:row.id,p_motivo:reason.trim()});
    if(rpcError)setError(rpcError.message);else if(data){setMessage("Banimento revogado.");await load();}
    setActing(false);
  }

  return <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><span className="rounded-md bg-destructive/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-destructive">Admin Global</span><h1 className="mt-2 text-2xl font-semibold">Banimentos</h1><p className="mt-1 text-sm text-muted-foreground">Bloqueios reais de empresas, usuários, e-mails, IPs e dispositivos.</p></div><div className="flex gap-2"><button onClick={()=>void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-medium disabled:opacity-50"><RefreshCw className={cn("h-4 w-4",loading&&"animate-spin")}/>Atualizar</button><button onClick={()=>setOpen(true)} className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground">Novo banimento</button></div></header>
    {error&&<div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}{message&&<div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-700">{message}</div>}
    <div className="mt-5"><select value={filter} onChange={(e)=>setFilter(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option value="ativos">Ativos</option><option value="revogados">Revogados</option><option value="todos">Todos</option></select></div>
    <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card">{loading?<div className="p-12 text-center text-sm text-muted-foreground">Carregando...</div>:rows.length===0?<EmptyState icon={Ban} title="Nenhum banimento" description="Não existem registros para o filtro atual."/>:<div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-sm"><thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Alvo</th><th className="px-4 py-3">Motivo</th><th className="px-4 py-3">Gravidade</th><th className="px-4 py-3">Aplicado</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3 text-right">Ação</th></tr></thead><tbody className="divide-y divide-border">{rows.map((row)=><tr key={row.id}><td className="px-4 py-3.5 capitalize">{row.tipo}</td><td className="px-4 py-3.5"><p>{row.empresa_nome||row.profile_nome||row.identificador}</p><p className="text-xs text-muted-foreground">{row.identificador}</p></td><td className="px-4 py-3.5">{row.motivo}</td><td className="px-4 py-3.5 capitalize">{row.gravidade}</td><td className="px-4 py-3.5 text-xs text-muted-foreground">{formatDateTime(row.data_inicio)}</td><td className="px-4 py-3.5">{row.desfeito?"Revogado":"Ativo"}</td><td className="px-4 py-3.5 text-right">{!row.desfeito&&<button disabled={acting} onClick={()=>void revoke(row)} className="rounded-lg border border-border px-3 py-1.5 text-xs">Revogar</button>}</td></tr>)}</tbody></table></div>}</section>
    {open&&<div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"><div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6"><div className="flex items-start justify-between"><div><h2 className="text-xl font-semibold">Novo banimento</h2><p className="mt-1 text-sm text-muted-foreground">Ação administrativa auditada.</p></div><button onClick={()=>setOpen(false)}><X className="h-4 w-4"/></button></div><div className="mt-5 space-y-4"><select value={form.tipo} onChange={(e)=>setForm({...form,tipo:e.target.value,target:"",identificador:""})} className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"><option value="usuario">Usuário</option><option value="empresa">Empresa</option><option value="email">E-mail</option><option value="ip">IP</option><option value="dispositivo">Dispositivo</option></select>{form.tipo==="empresa"?<select value={form.target} onChange={(e)=>setForm({...form,target:e.target.value})} className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"><option value="">Selecione a empresa</option>{companies.map((row)=><option key={row.id} value={row.id}>{row.nome}</option>)}</select>:form.tipo==="usuario"?<select value={form.target} onChange={(e)=>setForm({...form,target:e.target.value})} className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"><option value="">Selecione o usuário</option>{users.map((row)=><option key={row.id} value={row.id}>{row.nome} · {row.email}</option>)}</select>:<input value={form.identificador} onChange={(e)=>setForm({...form,identificador:e.target.value})} placeholder="Identificador" className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"/>}<input value={form.motivo} onChange={(e)=>setForm({...form,motivo:e.target.value})} placeholder="Motivo" className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"/><textarea value={form.detalhamento} onChange={(e)=>setForm({...form,detalhamento:e.target.value})} placeholder="Detalhes" className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"/><select value={form.gravidade} onChange={(e)=>setForm({...form,gravidade:e.target.value})} className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"><option value="media">Média</option><option value="alto">Alta</option><option value="critico">Crítica</option></select><button disabled={acting} onClick={()=>void apply()} className="w-full rounded-lg bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground disabled:opacity-50">Aplicar banimento</button></div></div></div>}
  </div>;
}
