import { useEffect, useRef, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type SearchResult = {
  grupo: string;
  id: string;
  titulo: string;
  subtitulo: string;
  url: string;
  relevancia: number;
};

const groupLabels: Record<string,string> = {
  produtos: "Produtos",
  vendas: "Vendas e pedidos",
  checkouts: "Checkouts",
  links_pagamento: "Links de pagamento",
  afiliados: "Afiliados",
  financeiro: "Financeiro",
  ajuda: "Ajuda",
};

export function GlobalSearch() {
  const [query,setQuery]=useState("");
  const [results,setResults]=useState<SearchResult[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [open,setOpen]=useState(false);
  const abortRef=useRef<AbortController|null>(null);

  useEffect(()=>{
    const trimmed=query.trim();
    if(trimmed.length<2){
      abortRef.current?.abort();
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const timer=window.setTimeout(async()=>{
      abortRef.current?.abort();
      const controller=new AbortController();
      abortRef.current=controller;
      setLoading(true);
      setError(null);
      try{
        const builder=(supabase as any).rpc("fn_pesquisa_global",{
          p_query:trimmed,
          p_limit:6,
        });
        const {data,error:rpcError}=await builder.abortSignal(controller.signal);
        if(controller.signal.aborted) return;
        if(rpcError) throw rpcError;
        setResults(((data??[]) as any[]).map((row)=>({
          grupo:String(row.grupo),
          id:String(row.id),
          titulo:String(row.titulo??""),
          subtitulo:String(row.subtitulo??""),
          url:String(row.url??"/app"),
          relevancia:Number(row.relevancia??0),
        })));
        setOpen(true);
      }catch(cause:any){
        if(controller.signal.aborted) return;
        setResults([]);
        setError(cause?.message ?? "Não foi possível pesquisar.");
        setOpen(true);
      }finally{
        if(!controller.signal.aborted) setLoading(false);
      }
    },220);

    return ()=>{
      window.clearTimeout(timer);
    };
  },[query]);

  const groups=[...new Set(results.map((result)=>result.grupo))];

  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={query}
        onChange={(e)=>setQuery(e.target.value)}
        onFocus={()=>query.trim().length>=2&&setOpen(true)}
        type="search"
        placeholder="Buscar no sistema..."
        aria-label="Pesquisa global"
        className="h-9 w-full rounded-md border border-border bg-card pl-9 pr-9 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
      {loading&&(
        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}

      {open&&query.trim().length>=2&&(
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 cursor-default"
            aria-label="Fechar pesquisa"
            onClick={()=>setOpen(false)}
          />
          <div className="absolute left-0 top-full z-40 mt-2 w-[min(42rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
            {error?(
              <div className="p-4 text-sm text-destructive">{error}</div>
            ):!loading&&results.length===0?(
              <div className="p-5 text-sm text-muted-foreground">
                Nenhum resultado autorizado para “{query.trim()}”.
              </div>
            ):(
              <div className="max-h-[65vh] overflow-y-auto p-2">
                {groups.map((group)=>(
                  <section key={group} className="mb-2 last:mb-0">
                    <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {groupLabels[group]??group}
                    </p>
                    {results.filter((item)=>item.grupo===group).map((item)=>(
                      <a
                        key={`${item.grupo}:${item.id}`}
                        href={item.url}
                        onClick={()=>setOpen(false)}
                        className="block rounded-lg px-3 py-2 hover:bg-muted"
                      >
                        <p className="truncate text-sm font-medium text-foreground">
                          {item.titulo}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {item.subtitulo}
                        </p>
                      </a>
                    ))}
                  </section>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
