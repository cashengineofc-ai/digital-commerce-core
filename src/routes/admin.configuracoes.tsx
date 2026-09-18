import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/app/EmptyState";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/configuracoes")({
  component: AdminConfiguracoesPage,
});

type Row = {
  id:string;chave:string;valor:unknown;tipo_valor:string;descricao:string|null;
  categoria:string|null;modulo:string|null;somente_leitura:boolean;sensivel:boolean;
  publico:boolean;updated_at:string;
};

function AdminConfiguracoesPage(){
  const [rows,setRows]=useState<Row[]>([]);
  const [query,setQuery]=useState("");
  const [loading,setLoading]=useState(true);
  const [acting,setActing]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [message,setMessage]=useState<string|null>(null);

  const load=useCallback(async()=>{
    setLoading(true);setError(null);
    const {data,error:rpcError}=await (supabase as any).rpc("fn_admin_config_list");
    if(rpcError){setError(rpcError.message);setRows([]);}
    else setRows(((data??[]) as any[]).map((row)=>({
      id:String(row.id),chave:String(row.chave),valor:row.valor,tipo_valor:String(row.tipo_valor??""),
      descricao:row.descricao?String(row.descricao):null,categoria:row.categoria?String(row.categoria):null,
      modulo:row.modulo?String(row.modulo):null,somente_leitura:Boolean(row.somente_leitura),
      sensivel:Boolean(row.sensivel),publico:Boolean(row.publico),updated_at:String(row.updated_at),
    })));
    setLoading(false);
  },[]);

  useEffect(()=>{void load();},[load]);

  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    if(!q)return rows;
    return rows.filter((row)=>[row.chave,row.descricao,row.categoria,row.modulo].some((value)=>String(value??"").toLowerCase().includes(q)));
  },[rows,query]);

  async function edit(row:Row){
    if(row.sensivel){setError("Configurações sensíveis só podem ser alteradas no armazenamento seguro do servidor.");return;}
    if(row.somente_leitura)return;
    const raw=window.prompt("Novo valor JSON para "+row.chave+":",JSON.stringify(row.valor));
    if(raw==null)return;
    let parsed:unknown;
    try{parsed=JSON.parse(raw);}catch{setError("JSON inválido.");return;}
    setActing(true);setError(null);
    const {data,error:rpcError}=await (supabase as any).rpc("fn_admin_config_set",{p_key:row.chave,p_value:parsed});
    if(rpcError)setError(rpcError.message);else if(data){setMessage("Configuração atualizada e auditada.");await load();}
    setActing(false);
  }

  return <div className="mx-auto w-full max-w-[1300px] px-4 py-6 sm:px-6 sm:py-8">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><span className="rounded-md bg-destructive/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-destructive">Admin Global</span><h1 className="mt-2 text-2xl font-semibold">Configurações globais</h1><p className="mt-1 text-sm text-muted-foreground">Valores persistidos do backend. Segredos não são expostos nesta tela.</p></div><button onClick={()=>void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-medium disabled:opacity-50"><RefreshCw className={cn("h-4 w-4",loading&&"animate-spin")}/>Atualizar</button></header>
    {error&&<div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}{message&&<div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-700">{message}</div>}
    <div className="relative mt-5"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Buscar chave, descrição, categoria ou módulo" className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm"/></div>
    <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card">{loading?<div className="p-12 text-center text-sm text-muted-foreground">Carregando configurações...</div>:filtered.length===0?<EmptyState icon={SlidersHorizontal} title="Nenhuma configuração encontrada" description="Nenhum valor demonstrativo é exibido."/>:<div className="divide-y divide-border">{filtered.map((row)=><div key={row.id} className="grid gap-4 p-5 md:grid-cols-[1fr_1fr_auto]"><div><p className="font-mono text-sm font-medium">{row.chave}</p><p className="mt-1 text-xs text-muted-foreground">{row.descricao||"Sem descrição"} · {row.categoria||"sem categoria"}</p></div><pre className="overflow-x-auto rounded-lg bg-muted/40 p-3 text-xs">{JSON.stringify(row.valor)}</pre><button disabled={acting||row.somente_leitura||row.sensivel} onClick={()=>void edit(row)} className="h-9 rounded-lg border border-border px-3 text-xs disabled:opacity-40">{row.sensivel?"Protegido":row.somente_leitura?"Somente leitura":"Editar"}</button></div>)}</div>}</section>
  </div>;
}
