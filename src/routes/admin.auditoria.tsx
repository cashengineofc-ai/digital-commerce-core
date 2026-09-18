import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw, ScrollText, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/format";
import { EmptyState } from "@/components/app/EmptyState";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/auditoria")({
  component: AdminAuditoriaPage,
});

type Row = {
  id:string;actor:string;action:string;target:string;module:string;ip_address:string|null;
  result:string;status_resposta:number|null;risco_nivel:string|null;created_at:string;
};

function AdminAuditoriaPage(){
  const [rows,setRows]=useState<Row[]>([]);
  const [query,setQuery]=useState("");
  const [result,setResult]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);

  const load=useCallback(async()=>{
    setLoading(true);setError(null);
    const {data,error:rpcError}=await (supabase as any).rpc("fn_dev_audit_logs",{
      p_search:query.trim()||null,p_result:result||null,p_limit:200,p_offset:0,
    });
    if(rpcError){setError(rpcError.message);setRows([]);}
    else setRows(((data??[]) as any[]).map((row)=>({
      id:String(row.id),actor:String(row.actor??"Sistema"),action:String(row.action??""),
      target:String(row.target??""),module:String(row.module??""),ip_address:row.ip_address?String(row.ip_address):null,
      result:String(row.result??""),status_resposta:row.status_resposta==null?null:Number(row.status_resposta),
      risco_nivel:row.risco_nivel?String(row.risco_nivel):null,created_at:String(row.created_at),
    })));
    setLoading(false);
  },[query,result]);

  useEffect(()=>{const timer=window.setTimeout(()=>void load(),200);return()=>window.clearTimeout(timer);},[load]);

  return <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><span className="rounded-md bg-destructive/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-destructive">Admin Global</span><h1 className="mt-2 text-2xl font-semibold">Auditoria</h1><p className="mt-1 text-sm text-muted-foreground">Ações reais registradas no backend.</p></div><button onClick={()=>void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-medium disabled:opacity-50"><RefreshCw className={cn("h-4 w-4",loading&&"animate-spin")}/>Atualizar</button></header>
    {error&&<div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
    <div className="mt-5 grid gap-3 rounded-xl border border-border bg-card p-3 md:grid-cols-[1fr_180px]"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Ator, ação, módulo ou alvo" className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm"/></div><select value={result} onChange={(e)=>setResult(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option value="">Todos</option><option value="sucesso">Sucesso</option><option value="falha">Falha</option></select></div>
    <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card">{loading?<div className="p-12 text-center text-sm text-muted-foreground">Carregando...</div>:rows.length===0?<EmptyState icon={ScrollText} title="Nenhum evento encontrado" description="A auditoria permanece vazia quando não há registros para o filtro."/>:<div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-sm"><thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><th className="px-4 py-3">Ator</th><th className="px-4 py-3">Ação</th><th className="px-4 py-3">Módulo</th><th className="px-4 py-3">Alvo</th><th className="px-4 py-3">Resultado</th><th className="px-4 py-3">Risco</th><th className="px-4 py-3 text-right">Data</th></tr></thead><tbody className="divide-y divide-border">{rows.map((row)=><tr key={row.id}><td className="px-4 py-3.5"><p>{row.actor}</p><p className="text-[10px] text-muted-foreground">{row.ip_address||"IP não registrado"}</p></td><td className="px-4 py-3.5 font-mono text-xs">{row.action}</td><td className="px-4 py-3.5">{row.module}</td><td className="px-4 py-3.5 text-xs text-muted-foreground">{row.target||"—"}</td><td className="px-4 py-3.5">{row.result}{row.status_resposta==null?"":" · HTTP "+row.status_resposta}</td><td className="px-4 py-3.5">{row.risco_nivel||"—"}</td><td className="px-4 py-3.5 text-right text-xs text-muted-foreground">{formatDateTime(row.created_at)}</td></tr>)}</tbody></table></div>}</section>
  </div>;
}
