import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Megaphone, RefreshCw, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime, formatInt } from "@/lib/format";
import { EmptyState } from "@/components/app/EmptyState";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/comunicados")({
  component: AdminComunicadosPage,
});

type Row = {
  id:string;titulo:string;mensagem:string;tipo:string;nivel_importancia:number;
  publico_alvo:string;data_inicio:string;data_fim:string|null;publicado:boolean;
  data_publicacao:string|null;total_visualizacoes:number;total_confirmacoes:number;
  requer_confirmacao:boolean;created_at:string;
};

function AdminComunicadosPage(){
  const [rows,setRows]=useState<Row[]>([]);
  const [loading,setLoading]=useState(true);
  const [acting,setActing]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [message,setMessage]=useState<string|null>(null);
  const [open,setOpen]=useState(false);
  const [form,setForm]=useState({titulo:"",mensagem:"",tipo:"informacao",publico:"todos",importancia:"0"});

  const load=useCallback(async()=>{
    setLoading(true);setError(null);
    const {data,error:rpcError}=await (supabase as any).rpc("fn_admin_comunicados_list");
    if(rpcError){setError(rpcError.message);setRows([]);}
    else setRows(((data??[]) as any[]).map((row)=>({
      id:String(row.id),titulo:String(row.titulo),mensagem:String(row.mensagem),tipo:String(row.tipo),
      nivel_importancia:Number(row.nivel_importancia??0),publico_alvo:String(row.publico_alvo??"todos"),
      data_inicio:String(row.data_inicio),data_fim:row.data_fim?String(row.data_fim):null,
      publicado:Boolean(row.publicado),data_publicacao:row.data_publicacao?String(row.data_publicacao):null,
      total_visualizacoes:Number(row.total_visualizacoes??0),total_confirmacoes:Number(row.total_confirmacoes??0),
      requer_confirmacao:Boolean(row.requer_confirmacao),created_at:String(row.created_at),
    })));
    setLoading(false);
  },[]);

  useEffect(()=>{void load();},[load]);

  async function create(){
    if(!form.titulo.trim()||!form.mensagem.trim()){setError("Título e mensagem são obrigatórios.");return;}
    setActing(true);setError(null);
    const {data,error:rpcError}=await (supabase as any).rpc("fn_admin_comunicado_criar",{
      p_titulo:form.titulo.trim(),p_mensagem:form.mensagem.trim(),p_tipo:form.tipo,p_publico:form.publico,
      p_importancia:Number(form.importancia)||0,p_inicio:new Date().toISOString(),p_fim:null,p_requer_confirmacao:false,
    });
    if(rpcError)setError(rpcError.message);else if(data){setOpen(false);setForm({titulo:"",mensagem:"",tipo:"informacao",publico:"todos",importancia:"0"});setMessage("Comunicado criado como rascunho.");await load();}
    setActing(false);
  }

  async function publish(row:Row){
    if(!window.confirm("Publicar este comunicado e gerar notificações para o público-alvo?"))return;
    setActing(true);setError(null);
    const {data,error:rpcError}=await (supabase as any).rpc("fn_admin_comunicado_publicar",{p_id:row.id});
    if(rpcError)setError(rpcError.message);else{setMessage("Comunicado publicado. "+formatInt(Number(data??0))+" notificações in-app criadas.");await load();}
    setActing(false);
  }

  async function archive(row:Row){
    if(!window.confirm("Arquivar este comunicado?"))return;
    setActing(true);setError(null);
    const {data,error:rpcError}=await (supabase as any).rpc("fn_admin_comunicado_arquivar",{p_id:row.id});
    if(rpcError)setError(rpcError.message);else if(data){setMessage("Comunicado arquivado.");await load();}
    setActing(false);
  }

  return <div className="mx-auto w-full max-w-[1300px] px-4 py-6 sm:px-6 sm:py-8">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><span className="rounded-md bg-destructive/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-destructive">Admin Global</span><h1 className="mt-2 text-2xl font-semibold">Comunicados</h1><p className="mt-1 text-sm text-muted-foreground">Avisos reais da plataforma, publicados via notificações persistentes.</p></div><div className="flex gap-2"><button onClick={()=>void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-medium disabled:opacity-50"><RefreshCw className={cn("h-4 w-4",loading&&"animate-spin")}/>Atualizar</button><button onClick={()=>setOpen(true)} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Novo comunicado</button></div></header>
    {error&&<div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}{message&&<div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-700">{message}</div>}
    <section className="mt-6">{loading?<div className="p-12 text-center text-sm text-muted-foreground">Carregando...</div>:rows.length===0?<EmptyState icon={Megaphone} title="Nenhum comunicado" description="Nenhum aviso fictício é criado automaticamente."/>:<div className="grid gap-4">{rows.map((row)=><article key={row.id} className="rounded-xl border border-border bg-card p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2"><span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{row.tipo}</span><span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{row.publico_alvo}</span><span className={cn("rounded-full px-2 py-0.5 text-[11px]",row.publicado?"bg-emerald-500/10 text-emerald-700":"bg-muted text-muted-foreground")}>{row.publicado?"Publicado":"Rascunho"}</span></div><h2 className="mt-3 font-semibold">{row.titulo}</h2><p className="mt-1 text-sm text-muted-foreground">{row.mensagem}</p><p className="mt-3 text-xs text-muted-foreground">Criado {formatDateTime(row.created_at)}{row.data_publicacao?" · publicado "+formatDateTime(row.data_publicacao):""} · {formatInt(row.total_visualizacoes)} visualizações</p></div><div className="flex gap-2">{!row.publicado&&<button disabled={acting} onClick={()=>void publish(row)} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">Publicar</button>}<button disabled={acting} onClick={()=>void archive(row)} className="rounded-lg border border-border px-3 py-1.5 text-xs">Arquivar</button></div></div></article>)}</div>}</section>
    {open&&<div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"><div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6"><div className="flex items-start justify-between"><div><h2 className="text-xl font-semibold">Novo comunicado</h2><p className="mt-1 text-sm text-muted-foreground">Será criado como rascunho.</p></div><button onClick={()=>setOpen(false)}><X className="h-4 w-4"/></button></div><div className="mt-5 space-y-4"><input value={form.titulo} onChange={(e)=>setForm({...form,titulo:e.target.value})} placeholder="Título" className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"/><textarea value={form.mensagem} onChange={(e)=>setForm({...form,mensagem:e.target.value})} placeholder="Mensagem" className="min-h-28 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"/><div className="grid gap-3 sm:grid-cols-2"><select value={form.tipo} onChange={(e)=>setForm({...form,tipo:e.target.value})} className="h-11 rounded-lg border border-border bg-background px-3 text-sm"><option value="informacao">Informação</option><option value="aviso">Aviso</option><option value="manutencao">Manutenção</option><option value="urgente">Urgente</option></select><select value={form.publico} onChange={(e)=>setForm({...form,publico:e.target.value})} className="h-11 rounded-lg border border-border bg-background px-3 text-sm"><option value="todos">Todos</option><option value="empresas_pro">Empresas Pro</option><option value="empresas_enterprise">Enterprise</option><option value="usuarios_admin">Admins globais</option><option value="afiliados">Afiliados</option></select></div><button disabled={acting} onClick={()=>void create()} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">Criar rascunho</button></div></div></div>}
  </div>;
}
