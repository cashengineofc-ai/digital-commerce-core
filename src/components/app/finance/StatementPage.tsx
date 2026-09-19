import { useEffect, useMemo, useState } from "react";
import { Download, FileText, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import { EmptyState } from "@/components/app/EmptyState";
import { StatementTable, type StatementFilters } from "@/components/app/finance/StatementTable";
import { usePermission } from "@/lib/use-permission";

type Summary = {
  saldo_abertura: number;
  creditos: number;
  debitos: number;
  movimento_liquido: number;
  saldo_fechamento: number;
};

function startIso(value: string) {
  return value ? new Date(`${value}T00:00:00`).toISOString() : null;
}
function endIso(value: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return date.toISOString();
}
function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function StatementPage() {
  const permission = usePermission("financeiro", "extrato", "read");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"" | "credito" | "debito">("");
  const [bucket, setBucket] = useState("");
  const [summary, setSummary] = useState<Summary>({
    saldo_abertura: 0,
    creditos: 0,
    debitos: 0,
    movimento_liquido: 0,
    saldo_fechamento: 0,
  });
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filters = useMemo<StatementFilters>(
    () => ({ start: start || null, end: end || null, search, type, bucket }),
    [start, end, search, type, bucket],
  );

  useEffect(() => {
    if (permission.loading) return;
    if (!permission.allowed) {
      setLoadingSummary(false);
      setError(null);
      return;
    }

    let active = true;
    async function load() {
      setLoadingSummary(true);
      setError(null);
      try {
        const { data, error: rpcError } = await (supabase as any).rpc("fn_extrato_resumo", {
          p_entidade: "empresa",
          p_inicio: startIso(start),
          p_fim: endIso(end),
        });
        if (rpcError) throw rpcError;
        if (!active) return;
        const row = Array.isArray(data) ? data[0] : data;
        setSummary({
          saldo_abertura: Number(row?.saldo_abertura ?? 0),
          creditos: Number(row?.creditos ?? 0),
          debitos: Number(row?.debitos ?? 0),
          movimento_liquido: Number(row?.movimento_liquido ?? 0),
          saldo_fechamento: Number(row?.saldo_fechamento ?? 0),
        });
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Não foi possível calcular o extrato.");
      } finally {
        if (active) setLoadingSummary(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [end, permission.allowed, permission.loading, start]);

  async function exportCsv() {
    if (exporting || !permission.allowed) return;
    setExporting(true);
    setError(null);
    try {
      const rows: any[] = [];
      let offset = 0;
      while (true) {
        const { data, error: rpcError } = await (supabase as any).rpc("fn_extrato_financeiro_v2", {
          p_entidade: "empresa",
          p_inicio: startIso(start),
          p_fim: endIso(end),
          p_tipo: type || null,
          p_bucket: bucket || null,
          p_busca: search.trim() || null,
          p_limit: 200,
          p_offset: offset,
        });
        if (rpcError) throw rpcError;
        const page = (data ?? []) as any[];
        rows.push(...page);
        if (page.length < 200) break;
        offset += 200;
      }

      if (!rows.length) return;
      const csv = [
        ["Data","Descrição","Conta","Estado","Tipo","Valor","Referência","Transação","Saque","Estorno"].map(csvCell).join(","),
        ...rows.map((row) => [
          row.data_lancamento,
          row.descricao,
          row.conta,
          row.bucket,
          row.tipo,
          Number(row.valor_assinado ?? 0).toFixed(2),
          row.documento ?? "",
          row.transacao_id ?? "",
          row.saque_id ?? "",
          row.estorno_id ?? "",
        ].map(csvCell).join(",")),
      ].join("\n");

      const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `extrato-${new Date().toISOString().slice(0,10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível exportar o extrato.");
    } finally {
      setExporting(false);
    }
  }

  if (!permission.loading && !permission.allowed) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Extrato</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Você não possui permissão para visualizar o extrato desta empresa.
          </p>
        </header>
        <div className="mt-6">
          <EmptyState
            icon={FileText}
            title="Acesso financeiro restrito"
            description="Solicite a um administrador da empresa a permissão Extrato - Visualizar."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Extrato</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Razão imutável: correções aparecem como novos ajustes ou reversões.
          </p>
        </div>
        <button
          onClick={() => void exportCsv()}
          disabled={exporting || permission.loading}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {exporting ? "Exportando..." : "Exportar CSV"}
        </button>
      </header>

      {error && (
        <div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Saldo de abertura", summary.saldo_abertura],
          ["Entradas", summary.creditos],
          ["Saídas", summary.debitos],
          ["Movimento líquido", summary.movimento_liquido],
          ["Saldo de fechamento", summary.saldo_fechamento],
        ].map(([label,value]) => (
          <div key={String(label)} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 text-lg font-semibold tabular-nums">
              {loadingSummary || permission.loading ? "—" : formatBRL(Number(value))}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-3 rounded-xl border border-border bg-card p-3 md:grid-cols-[1fr_150px_180px_150px_150px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar lançamento" className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm" />
        </div>
        <select value={type} onChange={(e)=>setType(e.target.value as ""|"credito"|"debito")} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
          <option value="">Entradas e saídas</option>
          <option value="credito">Entradas</option>
          <option value="debito">Saídas</option>
        </select>
        <select value={bucket} onChange={(e)=>setBucket(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm">
          <option value="">Todos os estados</option>
          <option value="a_receber">A receber</option>
          <option value="disponivel">Disponível</option>
          <option value="reservado">Reservado</option>
          <option value="bloqueado">Bloqueado</option>
          <option value="liquidado">Liquidado</option>
          <option value="estornado">Estornado</option>
          <option value="devedor">Débito pendente</option>
        </select>
        <input type="date" value={start} onChange={(e)=>setStart(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
        <input type="date" value={end} min={start || undefined} onChange={(e)=>setEnd(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm" />
      </div>

      <div className="mt-4">
        <StatementTable pageSize={25} filters={filters} showFilters={false} />
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Saldo de abertura = posição dos buckets ativos antes do início do período. Fechamento = abertura + movimento líquido. Valores liquidados e estornados permanecem no histórico, mas não compõem o saldo utilizável.
      </p>
    </div>
  );
}
