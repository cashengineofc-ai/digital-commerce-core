import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, RefreshCw, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateTime, formatInt } from "@/lib/format";
import { EmptyState } from "@/components/app/EmptyState";
import { WithdrawDialog } from "@/components/app/finance/WithdrawDialog";
import { cn } from "@/lib/utils";

type Withdraw = {
  id: string;
  protocolo: string;
  valor_solicitado: number;
  taxa_saque: number;
  valor_liquido: number;
  status: string;
  data_solicitacao: string;
  data_pagamento: string | null;
  destino: Record<string, any>;
  referencia_conciliacao: string | null;
  modo_processamento: string;
  total_registros: number;
};

const PAGE_SIZE=20;

const statusLabels: Record<string,string> = {
  solicitado:"Solicitado",
  em_analise:"Em análise",
  aprovado:"Aprovado",
  em_processamento:"Em processamento",
  enviado:"Enviado",
  pago:"Pago",
  recusado:"Recusado",
  cancelado:"Cancelado",
  falhou:"Falhou",
};

function csvCell(value: unknown) {
  let text=String(value??"");
  if(/^[=+\-@]/.test(text)) text=`'${text}`;
  return `"${text.replaceAll('"','""')}"`;
}

export function WithdrawsPage() {
  const [rows,setRows]=useState<Withdraw[]>([]);
  const [status,setStatus]=useState("");
  const [page,setPage]=useState(1);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);

  const load=useCallback(async()=>{
    setLoading(true);
    setError(null);
    try {
      const {data,error:rpcError}=await (supabase as any).rpc("fn_saques_listar",{
        p_entidade:"empresa",
        p_status:status||null,
        p_limit:PAGE_SIZE,
        p_offset:(page-1)*PAGE_SIZE,
      });
      if(rpcError) throw rpcError;
      setRows(((data??[]) as any[]).map((row)=>({
        ...row,
        valor_solicitado:Number(row.valor_solicitado??0),
        taxa_saque:Number(row.taxa_saque??0),
        valor_liquido:Number(row.valor_liquido??0),
        total_registros:Number(row.total_registros??0),
      })));
    } catch(cause) {
      setRows([]);
      setError(cause instanceof Error?cause.message:"Não foi possível carregar os saques.");
    } finally {
      setLoading(false);
    }
  },[status,page]);

  useEffect(()=>{ void load(); },[load]);

  const total=rows[0]?.total_registros??0;
  const totalPages=Math.max(1,Math.ceil(total/PAGE_SIZE));

  const totals=useMemo(()=>rows.reduce((acc,row)=>{
    acc.requested+=row.valor_solicitado;
    if(row.status==="pago") acc.paid+=row.valor_liquido;
    if(["solicitado","em_analise","aprovado","em_processamento","enviado"].includes(row.status)) acc.reserved+=row.valor_solicitado;
    return acc;
  },{requested:0,reserved:0,paid:0}),[rows]);

  async function cancel(id:string) {
    try {
      const {data,error:rpcError}=await (supabase as any).rpc("fn_cancelar_saque",{p_saque_id:id});
      if(rpcError) throw rpcError;
      if(!data) throw new Error("O saque não pôde ser cancelado.");
      toast.success("Saque cancelado e reserva liberada.");
      await load();
    } catch(cause) {
      toast.error("Não foi possível cancelar",{description:cause instanceof Error?cause.message:undefined});
    }
  }

  async function exportCsv() {
    const all:any[]=[];
    let offset=0;
    while(true) {
      const {data,error:rpcError}=await (supabase as any).rpc("fn_saques_listar",{
        p_entidade:"empresa",p_status:status||null,p_limit:200,p_offset:offset,
      });
      if(rpcError){setError(rpcError.message);return;}
      const part=(data??[]) as any[];
      all.push(...part);
      if(part.length<200) break;
      offset+=200;
    }
    if(!all.length) return;
    const csv=[
      ["Protocolo","Valor solicitado","Taxa","Líquido","Status","Solicitado em","Pago em","Modo","Referência"].map(csvCell).join(","),
      ...all.map((row)=>[
        row.protocolo,Number(row.valor_solicitado??0).toFixed(2),Number(row.taxa_saque??0).toFixed(2),
        Number(row.valor_liquido??0).toFixed(2),row.status,row.data_solicitacao,row.data_pagamento??"",
        row.modo_processamento,row.referencia_conciliacao??""
      ].map(csvCell).join(","))
    ].join("\n");
    const url=URL.createObjectURL(new Blob(["\ufeff",csv],{type:"text/csv;charset=utf-8"}));
    const a=document.createElement("a");a.href=url;a.download=`saques-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Saques</h1>
          <p className="mt-1 text-sm text-muted-foreground">Aprovação e pagamento são etapas diferentes. Pago exige conciliação.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>void load()} className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-medium hover:bg-muted"><RefreshCw className={cn("h-4 w-4",loading&&"animate-spin")}/>Atualizar</button>
          <button onClick={()=>void exportCsv()} disabled={total===0} className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"><Download className="h-4 w-4"/>Exportar</button>
          <WithdrawDialog onSuccess={load}/>
        </div>
      </header>

      {error&&<div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          ["Página · solicitado",totals.requested],
          ["Página · reservado",totals.reserved],
          ["Página · pago",totals.paid],
        ].map(([label,value])=><div key={String(label)} className="rounded-xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-3 text-2xl font-semibold tabular-nums">{formatBRL(Number(value))}</p></div>)}
      </div>

      <div className="mt-6 flex flex-wrap gap-2 rounded-xl border border-border bg-card p-3">
        <select value={status} onChange={(e)=>{setStatus(e.target.value);setPage(1);}} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
          <option value="">Todos os estados</option>
          {Object.entries(statusLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}
        </select>
        <span className="ml-auto self-center text-xs text-muted-foreground">{formatInt(total)} registro{total===1?"":"s"}</span>
      </div>

      <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        {loading ? <div className="p-10 text-center text-sm text-muted-foreground">Carregando saques...</div> : rows.length===0 ? (
          <EmptyState icon={Wallet} title="Nenhum saque encontrado" description="Os pedidos reais de saque aparecerão aqui."/>
        ) : <div className="overflow-x-auto"><table className="w-full min-w-[1120px] text-sm">
          <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-5 py-3">Protocolo</th><th className="px-5 py-3">Destino congelado</th><th className="px-5 py-3 text-right">Solicitado</th><th className="px-5 py-3 text-right">Taxa</th><th className="px-5 py-3 text-right">Líquido</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Data</th><th className="px-5 py-3 text-right">Ação</th>
          </tr></thead>
          <tbody className="divide-y divide-border">{rows.map(row=>{
            const destination=row.destino?.["chave_pix"]
              ? `${row.destino["banco_nome"]??""} · Pix ${row.destino["chave_pix"]}`
              : `${row.destino?.["banco_nome"]??"Banco"} · Ag. ${row.destino?.["agencia"]??"—"} · Conta ${row.destino?.["conta"]??"—"}`;
            const cancellable=["solicitado","em_analise"].includes(row.status);
            return <tr key={row.id} className="hover:bg-muted/40">
              <td className="px-5 py-3.5 font-mono text-xs">{row.protocolo}</td>
              <td className="px-5 py-3.5"><p>{destination}</p><p className="text-[11px] text-muted-foreground">{row.modo_processamento==="manual"?"Conciliação manual":"Provedor integrado"}</p></td>
              <td className="px-5 py-3.5 text-right tabular-nums">{formatBRL(row.valor_solicitado)}</td>
              <td className="px-5 py-3.5 text-right tabular-nums">{formatBRL(row.taxa_saque)}</td>
              <td className="px-5 py-3.5 text-right font-semibold tabular-nums">{formatBRL(row.valor_liquido)}</td>
              <td className="px-5 py-3.5"><span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">{statusLabels[row.status]??row.status}</span>{row.referencia_conciliacao&&<p className="mt-1 text-[10px] text-muted-foreground">Ref. {row.referencia_conciliacao}</p>}</td>
              <td className="px-5 py-3.5 text-xs text-muted-foreground">{formatDateTime(row.data_pagamento??row.data_solicitacao)}</td>
              <td className="px-5 py-3.5 text-right">{cancellable&&<button onClick={()=>void cancel(row.id)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">Cancelar</button>}</td>
            </tr>;
          })}</tbody>
        </table></div>}

        {rows.length>0&&<footer className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
          <span>Página {page} de {totalPages}</span>
          <div className="flex gap-2">
            <button onClick={()=>setPage(v=>Math.max(1,v-1))} disabled={page<=1} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 disabled:opacity-40"><ChevronLeft className="h-3.5 w-3.5"/>Anterior</button>
            <button onClick={()=>setPage(v=>Math.min(totalPages,v+1))} disabled={page>=totalPages} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 disabled:opacity-40">Próxima<ChevronRight className="h-3.5 w-3.5"/></button>
          </div>
        </footer>}
      </section>
    </div>
  );
}
