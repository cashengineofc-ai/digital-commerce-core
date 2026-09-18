import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ScrollText,
  Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime, formatInt } from "@/lib/format";
import { EmptyState } from "@/components/app/EmptyState";
import { cn } from "@/lib/utils";

type AuditRow = {
  id: string;
  actor: string;
  action: string;
  target: string;
  module: string;
  ip_address: string | null;
  result: "sucesso" | "falha";
  status_resposta: number | null;
  risco_nivel: string | null;
  created_at: string;
  total_registros: number;
};

const PAGE_SIZE = 50;

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "SI";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (
    parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)
  ).toUpperCase();
}

export function LogsPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [result, setResult] = useState<"" | "sucesso" | "falha">("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_dev_audit_logs",
        {
          p_search: debouncedQuery || null,
          p_result: result || null,
          p_limit: PAGE_SIZE,
          p_offset: (page - 1) * PAGE_SIZE,
        },
      );
      if (rpcError) throw rpcError;

      setRows(
        ((data ?? []) as any[]).map((row) => ({
          id: String(row.id),
          actor: String(row.actor ?? "Sistema"),
          action: String(row.action ?? ""),
          target: String(row.target ?? ""),
          module: String(row.module ?? "sistema"),
          ip_address: row.ip_address ? String(row.ip_address) : null,
          result:
            String(row.result) === "falha"
              ? "falha"
              : "sucesso",
          status_resposta:
            row.status_resposta == null
              ? null
              : Number(row.status_resposta),
          risco_nivel: row.risco_nivel
            ? String(row.risco_nivel)
            : null,
          created_at: String(row.created_at),
          total_registros: Number(row.total_registros ?? 0),
        })),
      );
    } catch (cause) {
      setRows([]);
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar os logs de auditoria.",
      );
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, result, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = rows[0]?.total_registros ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Logs de auditoria
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Eventos reais de segurança e operação registrados no backend.
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw
            className={cn("h-4 w-4", loading && "animate-spin")}
          />
          Atualizar
        </button>
      </header>

      {error && (
        <div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar ator, ação, alvo ou módulo"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={result}
          onChange={(e) => {
            setResult(e.target.value as "" | "sucesso" | "falha");
            setPage(1);
          }}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        >
          <option value="">Todos os resultados</option>
          <option value="sucesso">Sucesso</option>
          <option value="falha">Falha</option>
        </select>
      </div>

      <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Carregando auditoria...
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="Nenhum evento encontrado"
            description="O estado vazio não é preenchido com logs demonstrativos."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3">Ator</th>
                  <th className="px-5 py-3">Ação</th>
                  <th className="px-5 py-3">Alvo</th>
                  <th className="px-5 py-3">Módulo</th>
                  <th className="px-5 py-3">Resultado</th>
                  <th className="px-5 py-3">Risco</th>
                  <th className="px-5 py-3 text-right">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/40">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-8 w-8 place-items-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
                          {initials(row.actor)}
                        </span>
                        <div>
                          <p className="font-medium">{row.actor}</p>
                          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                            {row.ip_address ?? "IP não registrado"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs">
                      {row.action}
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="max-w-72 truncate text-xs text-muted-foreground">
                        {row.target || "—"}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground">
                      {row.module}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-medium",
                          row.result === "sucesso"
                            ? "bg-emerald-500/10 text-emerald-700"
                            : "bg-destructive/10 text-destructive",
                        )}
                      >
                        {row.result}
                        {row.status_resposta != null
                          ? ` · HTTP ${row.status_resposta}`
                          : ""}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs capitalize text-muted-foreground">
                      {row.risco_nivel ?? "—"}
                    </td>
                    <td className="px-5 py-3.5 text-right text-xs text-muted-foreground">
                      {formatDateTime(row.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rows.length > 0 && (
          <footer className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
            <span>{formatInt(total)} evento{total === 1 ? "" : "s"}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={page <= 1}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Anterior
              </button>
              <span>
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                disabled={page >= totalPages}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 disabled:opacity-40"
              >
                Próxima
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </footer>
        )}
      </section>
    </div>
  );
}
