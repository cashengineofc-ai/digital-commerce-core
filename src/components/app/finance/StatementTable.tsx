import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Receipt, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateTime, formatInt } from "@/lib/format";
import { EmptyState } from "@/components/app/EmptyState";
import { TableSkeleton } from "@/components/app/Skeletons";
import { cn } from "@/lib/utils";

export type StatementFilters = {
  search?: string;
  type?: "" | "credito" | "debito";
  bucket?: string;
  start?: string | null;
  end?: string | null;
};

type LedgerRow = {
  id: string;
  data_lancamento: string;
  descricao: string;
  conta: string;
  bucket: string;
  tipo: "credito" | "debito";
  valor: number;
  valor_assinado: number;
  documento: string | null;
  transacao_id: string | null;
  saque_id: string | null;
  estorno_id: string | null;
  total_registros: number;
};

const bucketLabels: Record<string, string> = {
  a_receber: "A receber",
  disponivel: "Disponível",
  reservado: "Reservado",
  bloqueado: "Bloqueado",
  liquidado: "Liquidado",
  estornado: "Estornado",
  devedor: "Débito pendente",
};

function isoStart(value?: string | null) {
  return value ? new Date(`${value}T00:00:00`).toISOString() : null;
}

function isoEndExclusive(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return date.toISOString();
}

export function StatementTable({
  pageSize = 12,
  limit,
  entity = "empresa",
  filters,
  showFilters = true,
}: {
  pageSize?: number;
  limit?: number;
  entity?: "empresa" | "afiliado";
  filters?: StatementFilters;
  showFilters?: boolean;
}) {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [internalSearch, setInternalSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [internalType, setInternalType] = useState<"" | "credito" | "debito">("");
  const [internalBucket, setInternalBucket] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(internalSearch.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [internalSearch]);

  const active = useMemo<StatementFilters>(
    () => ({
      search: filters?.search ?? debouncedSearch,
      type: filters?.type ?? internalType,
      bucket: filters?.bucket ?? internalBucket,
      start: filters?.start ?? null,
      end: filters?.end ?? null,
    }),
    [filters, debouncedSearch, internalType, internalBucket],
  );

  useEffect(() => {
    setPage(1);
  }, [active.search, active.type, active.bucket, active.start, active.end, entity]);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const effectivePageSize = Math.max(1, Math.min(pageSize, limit ?? pageSize));
        const maxRows = limit ?? Number.MAX_SAFE_INTEGER;
        const offset = (page - 1) * effectivePageSize;
        if (offset >= maxRows) {
          if (alive) setRows([]);
          return;
        }

        const { data, error: rpcError } = await (supabase as any).rpc(
          "fn_extrato_financeiro_v2",
          {
            p_entidade: entity,
            p_inicio: isoStart(active.start),
            p_fim: isoEndExclusive(active.end),
            p_tipo: active.type || null,
            p_bucket: active.bucket || null,
            p_busca: active.search?.trim() || null,
            p_limit: Math.min(effectivePageSize, maxRows - offset),
            p_offset: offset,
          },
        );
        if (rpcError) throw rpcError;
        if (!alive) return;

        setRows(
          ((data ?? []) as any[]).map((row) => ({
            id: String(row.id),
            data_lancamento: String(row.data_lancamento),
            descricao: String(row.descricao ?? ""),
            conta: String(row.conta ?? ""),
            bucket: String(row.bucket ?? "disponivel"),
            tipo: row.tipo === "debito" ? "debito" : "credito",
            valor: Number(row.valor ?? 0),
            valor_assinado: Number(row.valor_assinado ?? 0),
            documento: row.documento ? String(row.documento) : null,
            transacao_id: row.transacao_id ? String(row.transacao_id) : null,
            saque_id: row.saque_id ? String(row.saque_id) : null,
            estorno_id: row.estorno_id ? String(row.estorno_id) : null,
            total_registros: Number(row.total_registros ?? 0),
          })),
        );
      } catch (cause) {
        if (!alive) return;
        setRows([]);
        setError(cause instanceof Error ? cause.message : "Não foi possível carregar o extrato.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, [active, entity, page, pageSize, limit]);

  const databaseTotal = rows[0]?.total_registros ?? 0;
  const total = Math.min(databaseTotal, limit ?? databaseTotal);
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, Math.min(pageSize, limit ?? pageSize))));

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {showFilters && (
        <header className="flex flex-wrap items-center gap-3 border-b border-border p-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={internalSearch}
              onChange={(e) => setInternalSearch(e.target.value)}
              placeholder="Buscar descrição, documento ou ID"
              className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary/60"
            />
          </div>
          <select
            value={internalType}
            onChange={(e) => setInternalType(e.target.value as "" | "credito" | "debito")}
            className="h-9 rounded-lg border border-border bg-background px-2.5 text-sm"
          >
            <option value="">Entradas e saídas</option>
            <option value="credito">Entradas</option>
            <option value="debito">Saídas</option>
          </select>
          <select
            value={internalBucket}
            onChange={(e) => setInternalBucket(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-2.5 text-sm"
          >
            <option value="">Todos os estados</option>
            {Object.entries(bucketLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </header>
      )}

      {error && (
        <div className="border-b border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={Math.min(pageSize, 8)} cols={5} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Nenhum lançamento encontrado"
          description="O extrato mostra apenas lançamentos contábeis reais registrados pela operação."
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Data</th>
                  <th className="px-5 py-3 font-medium">Descrição</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3 font-medium">Referência</th>
                  <th className="px-5 py-3 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/40">
                    <td className="whitespace-nowrap px-5 py-3.5 text-muted-foreground">
                      {formatDateTime(row.data_lancamento)}
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-foreground">{row.descricao}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{row.conta}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {bucketLabels[row.bucket] ?? row.bucket}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[11px] text-muted-foreground">
                      {row.documento ?? "—"}
                    </td>
                    <td
                      className={cn(
                        "px-5 py-3.5 text-right font-semibold tabular-nums",
                        row.valor_assinado >= 0 ? "text-emerald-600" : "text-foreground",
                      )}
                    >
                      {row.valor_assinado >= 0 ? "+" : "−"}
                      {formatBRL(Math.abs(row.valor_assinado))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 text-xs text-muted-foreground">
            <span>{formatInt(total)} lançamento{total === 1 ? "" : "s"}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={page <= 1}
                className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-muted disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span>{page} / {totalPages}</span>
              <button
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                disabled={page >= totalPages}
                className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-muted disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </footer>
        </>
      )}
    </section>
  );
}
