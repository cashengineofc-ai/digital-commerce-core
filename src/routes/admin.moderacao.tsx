import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/format";
import { EmptyState } from "@/components/app/EmptyState";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/moderacao")({
  component: AdminModeracaoPage,
});

type Row = {
  id:string; tipo_item:string; motivo:string; detalhe:string|null; categoria_risco:string; status:string;
  empresa_nome:string|null; profile_nome:string|null; produto_nome:string|null; checkout_nome:string|null;
  sinalizacoes:number; decisao:string|null; detalhe_decisao:string|null; created_at:string;
};

function AdminModeracaoPage(){
  const [rows,setRows]=useState<Row[]>([]);
  const [status,setStatus]=useState("");
  const [loading,setLoading]=useState(true);
  const [acting,setActing]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [message,setMessage]=useState<string|null>(null);

  const load=useCallback(async()=>{
    setLoading(true);setError(null);
    const {data,error:rpcError}=await (supabase as any).rpc("fn_admin_moderacao_list",{p_status:status||null});
    if(rpcError){setError(rpcError.message);setRows([]);}
    else setRows(((data??[]) as any[]).map((row)=>({
      id:String(row.id),tipo_item:String(row.tipo_item),motivo:String(row.motivo),detalhe:row.detalhe?String(row.detalhe):null,
      categoria_risco:String(row.categoria_risco??""),status:String(row.status??""),empresa_nome:row.empresa_nome?String(row.empresa_nome):null,
      profile_nome:row.profile_nome?String(row.profile_nome):null,produto_nome:row.produto_nome?String(row.produto_nome):null,
      checkout_nome:row.checkout_nome?String(row.checkout_nome):null,sinalizacoes:Number(row.sinalizacoes??0),
      decisao:row.decisao?String(row.decisao):null,detalhe_decisao:row.detalhe_decisao?String(row.detalhe_decisao):null,
      created_at:String(row.created_at),
    })));
    setLoading(false);
  },[status]);

  useEffect(()=>{void load();},[load]);

  async function decide(row:Row,next:string){
    const decision=window.prompt(next==="em_analise"?"Observação da análise:":"Decisão obrigatória:");
    if(next!=="em_analise"&&!decision?.trim())return;
    const detail=window.prompt("Detalhe adicional (opcional):")??"";
    setActing(true);setError(null);
    const {data,error:rpcError}=await (supabase as any).rpc("fn_admin_moderacao_decidir",{p_id:row.id,p_status:next,p_decisao:decision?.trim()||null,p_detalhe:detail.trim()||null});
    if(rpcError)setError(rpcError.message);else if(data){setMessage("Caso atualizado e auditado.");await load();}
    setActing(false);
  }

  return <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><span className="rounded-md bg-destructive/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-destructive">Admin Global</span><h1 className="mt-2 text-2xl font-semibold">Moderação</h1><p className="mt-1 text-sm text-muted-foreground">Denúncias e análises reais registradas na plataforma.</p></div><button onClick={()=>void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-medium disabled:opacity-50"><RefreshCw className={cn("h-4 w-4",loading&&"animate-spin")}/>Atualizar</button></header>
    {error&&<div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}{message&&<div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-700">{message}</div>}
    <div className="mt-5"><select value={status} onChange={(e)=>setStatus(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option value="">Todos</option><option value="pendente">Pendente</option><option value="em_analise">Em análise</option><option value="resolvido">Resolvido</option><option value="rejeitado">Rejeitado</option><option value="arquivado">Arquivado</option></select></div>
    <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card">{loading?<div className="p-12 text-center text-sm text-muted-foreground">Carregando...</div>:rows.length===0?<EmptyState icon={ShieldAlert} title="Nenhum caso de moderação" description="Nenhum caso demonstrativo é exibido."/>:<div className="divide-y divide-border">{rows.map((row)=><div key={row.id} className="p-5"><div className="flex flex-wrap justify-between gap-4"><div><div className="flex gap-2"><span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{row.status}</span><span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{row.categoria_risco}</span></div><h3 className="mt-2 font-semibold">{row.motivo}</h3><p className="mt-1 text-sm text-muted-foreground">{row.detalhe||"Sem detalhe adicional"}</p><p className="mt-2 text-xs text-muted-foreground">{row.tipo_item} · {row.empresa_nome||row.profile_nome||row.produto_nome||row.checkout_nome||row.id} · {formatDateTime(row.created_at)}</p></div>{!["resolvido","rejeitado","arquivado"].includes(row.status)&&<div className="flex gap-2"><button disabled={acting} onClick={()=>void decide(row,"em_analise")} className="rounded-lg border border-border px-3 py-1.5 text-xs">Analisar</button><button disabled={acting} onClick={()=>void decide(row,"resolvido")} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">Resolver</button><button disabled={acting} onClick={()=>void decide(row,"rejeitado")} className="rounded-lg border border-border px-3 py-1.5 text-xs">Rejeitar</button></div>}</div>{row.decisao&&<div className="mt-3 rounded-lg bg-muted/40 p-3 text-xs"><strong>Decisão:</strong> {row.decisao}{row.detalhe_decisao?" · "+row.detalhe_decisao:""}</div>}</div>)}</div>}</section>
  </div>;
}
