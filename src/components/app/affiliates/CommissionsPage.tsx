import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  RefreshCw,
  Search,
  Wallet,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateTime, formatInt, formatPct } from "@/lib/format";
import { EmptyState } from "@/components/app/EmptyState";
import { cn } from "@/lib/utils";

type AffiliateOption = {
  id: string;
  name: string;
};

type CommissionRow = {
  id: string;
  afiliado_id: string;
  afiliado_nome: string;
  transacao_id: string | null;
  pedido_numero: string | null;
  produto_nome: string;
  valor_venda: number;
  percentual: number;
  valor_original: number;
  valor_estornado: number;
  valor_reconhecido: number;
  status: string;
  venda_em: string;
  liberacao_em: string | null;
  pagamento_em: string | null;
  total_registros: number;
};

const PAGE_SIZE = 25;

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  aprovada: "Aprovada",
  liberada: "Liberada",
  paga: "Paga",
  cancelada: "Cancelada",
  estornada: "Estornada",
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

export function CommissionsPage() {
  const [rows, setRows] = useState<CommissionRow[]>([]);
  const [affiliates, setAffiliates] = useState<AffiliateOption[]>([]);
  const [affiliateId, setAffiliateId] = useState("");
  const [status, setStatus] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_comissoes_listar",
        {
          p_afiliado_id: affiliateId || null,
          p_status: status || null,
          p_inicio: startIso(start),
          p_fim: endIso(end),
          p_limit: PAGE_SIZE,
          p_offset: (page - 1) * PAGE_SIZE,
        },
      );
      if (rpcError) throw rpcError;

      setRows(
        ((data ?? []) as any[]).map((row) => ({
          id: String(row.id),
          afiliado_id: String(row.afiliado_id),
          afiliado_nome: String(row.afiliado_nome ?? "Afiliado"),
          transacao_id: row.transacao_id ? String(row.transacao_id) : null,
          pedido_numero: row.pedido_numero ? String(row.pedido_numero) : null,
          produto_nome: String(row.produto_nome ?? "Produto"),
          valor_venda: Number(row.valor_venda ?? 0),
          percentual: Number(row.percentual ?? 0),
          valor_original: Number(row.valor_original ?? 0),
          valor_estornado: Number(row.valor_estornado ?? 0),
          valor_reconhecido: Number(row.valor_reconhecido ?? 0),
          status: String(row.status ?? "pendente"),
          venda_em: String(row.venda_em),
          liberacao_em: row.liberacao_em ? String(row.liberacao_em) : null,
          pagamento_em: row.pagamento_em ? String(row.pagamento_em) : null,
          total_registros: Number(row.total_registros ?? 0),
        })),
      );

      if (affiliates.length === 0) {
        const management = await (supabase as any).rpc("fn_afiliados_listar");
        if (!management.error) {
          setAffiliates(
            ((management.data ?? []) as any[]).map((item) => ({
              id: String(item.id),
              name: String(item.nome ?? "Afiliado"),
            })),
          );
        } else {
          const contexts = await (supabase as any).rpc("fn_afiliado_contextos");
          if (!contexts.error) {
            setAffiliates(
              ((contexts.data ?? []) as any[]).map((item) => ({
                id: String(item.afiliado_id),
                name: String(item.empresa_nome ?? "Operação afiliada"),
              })),
            );
          }
        }
      }
    } catch (cause) {
      setRows([]);
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar as comissões.",
      );
    } finally {
      setLoading(false);
    }
  }, [affiliateId, status, start, end, page, affiliates.length]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = rows[0]?.total_registros ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const visibleRows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    if (!q) return rows;
    return rows.filter((row) =>
      [
        row.afiliado_nome,
        row.pedido_numero,
        row.transacao_id,
        row.produto_nome,
        row.id,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLocaleLowerCase("pt-BR").includes(q),
        ),
    );
  }, [rows, query]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          acc.original += row.valor_original;
          acc.reversed += row.valor_estornado;
          acc.recognized += row.valor_reconhecido;
          if (row.status === "liberada" || row.status === "paga") {
            acc.available += row.valor_reconhecido;
          }
          return acc;
        },
        { original: 0, reversed: 0, recognized: 0, available: 0 },
      ),
    [rows],
  );

  return (
    <div className="mx-auto w-full max-w-[1450px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Comissões</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Comissão reconhecida vem do snapshot da venda confirmada e preserva reversões de estorno.
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Atualizar
        </button>
      </header>

      {error && (
        <div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Wallet className="h-4 w-4" />
            <span className="text-sm">Original</span>
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums">
            {formatBRL(totals.original)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Soma dos snapshots desta página
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <XCircle className="h-4 w-4" />
            <span className="text-sm">Estornada</span>
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums text-destructive">
            {formatBRL(totals.reversed)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Reconhecida</span>
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums">
            {formatBRL(totals.recognized)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            <span className="text-sm">Liberada/paga</span>
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums text-primary">
            {formatBRL(totals.available)}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 rounded-xl border border-border bg-card p-3 lg:grid-cols-[1fr_220px_180px_150px_150px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar a página por afiliado, pedido, transação ou produto"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={affiliateId}
          onChange={(e) => {
            setAffiliateId(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        >
          <option value="">Todos os vínculos permitidos</option>
          {affiliates.map((affiliate) => (
            <option key={affiliate.id} value={affiliate.id}>
              {affiliate.name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        >
          <option value="">Todos os estados</option>
          {Object.entries(statusLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={start}
          onChange={(e) => {
            setStart(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        />
        <input
          type="date"
          value={end}
          min={start || undefined}
          onChange={(e) => {
            setEnd(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
        />
      </div>

      <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Carregando comissões...
          </div>
        ) : visibleRows.length === 0 ? (
          <EmptyState
            icon={XCircle}
            title="Nenhuma comissão encontrada"
            description="Comissões só aparecem depois de vendas reais atribuídas e processadas."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1280px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Afiliado</th>
                  <th className="px-4 py-3">Pedido / transação</th>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3 text-right">Venda</th>
                  <th className="px-4 py-3 text-right">Regra</th>
                  <th className="px-4 py-3 text-right">Original</th>
                  <th className="px-4 py-3 text-right">Estornado</th>
                  <th className="px-4 py-3 text-right">Reconhecido</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Venda em</th>
                  <th className="px-4 py-3">Liberação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleRows.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3.5 font-medium">{row.afiliado_nome}</td>
                    <td className="px-4 py-3.5">
                      <p className="font-mono text-xs">
                        {row.pedido_numero ?? "Sem número"}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                        {row.transacao_id ?? "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground">
                      {row.produto_nome}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums">
                      {formatBRL(row.valor_venda)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-muted-foreground">
                      {formatPct(row.percentual, 4)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums">
                      {formatBRL(row.valor_original)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-destructive">
                      {row.valor_estornado > 0
                        ? formatBRL(row.valor_estornado)
                        : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold tabular-nums">
                      {formatBRL(row.valor_reconhecido)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
                        {statusLabels[row.status] ?? row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground">
                      {formatDateTime(row.venda_em)}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground">
                      {row.pagamento_em
                        ? `Pago: ${formatDateTime(row.pagamento_em)}`
                        : row.liberacao_em
                          ? formatDateTime(row.liberacao_em)
                          : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rows.length > 0 && (
          <footer className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
            <span>{formatInt(total)} comissão{total === 1 ? "" : "ões"}</span>
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
