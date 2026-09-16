import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Receipt, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDateTime, formatInt } from "@/lib/format";
import { EmptyState } from "@/components/app/EmptyState";
import { TableSkeleton } from "@/components/app/Skeletons";
import { cn } from "@/lib/utils";

const typeOptions = ["todos", "credito", "debito"] as const;
type LedgerType = Exclude<(typeof typeOptions)[number], "todos">;
type LedgerCategory = "venda" | "taxa" | "comissao" | "saque" | "estorno" | "outro";
const categoryOptions: (LedgerCategory | "todas")[] = [
  "todas",
  "venda",
  "taxa",
  "comissao",
  "saque",
  "estorno",
  "outro",
];

const categoryLabel: Record<LedgerCategory, string> = {
  venda: "Venda",
  taxa: "Taxa",
  comissao: "Comissão",
  saque: "Saque",
  estorno: "Estorno",
  outro: "Outro",
};

type LedgerRow = {
  id: string;
  date: string;
  description: string;
  category: LedgerCategory;
  type: LedgerType;
  amount: number;
  balance: number | null;
};

function resolveCategory(row: any): LedgerCategory {
  const account = String(row.conta_contabil ?? "").toLowerCase();
  if (row.saque_id) return "saque";
  if (row.estorno_id) return "estorno";
  if (row.comissao_id) return "comissao";
  if (account.includes("taxa") || account.includes("fee")) return "taxa";
  if (row.transacao_id) return "venda";
  return "outro";
}

export function StatementTable({
  pageSize = 12,
  limit,
}: {
  pageSize?: number;
  limit?: number;
}) {
  const [statement, setStatement] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<(typeof typeOptions)[number]>("todos");
  const [category, setCategory] = useState<(typeof categoryOptions)[number]>("todas");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("empresa_id")
          .eq("id", auth.user.id)
          .maybeSingle();
        if (!profile?.empresa_id) return;

        let queryBuilder = supabase
          .from("lancamentos_contabeis")
          .select(
            "id,descricao,tipo_lancamento,valor,data_lancamento,saldo_atual,conta_contabil,saque_id,estorno_id,comissao_id,transacao_id",
          )
          .eq("empresa_id", profile.empresa_id)
          .order("data_lancamento", { ascending: false });

        if (limit) queryBuilder = queryBuilder.limit(limit);

        const { data, error } = await queryBuilder;
        if (error) throw error;
        if (!active) return;

        setStatement(
          ((data ?? []) as unknown as Array<any>).map((row) => ({
            id: row.id,
            date: row.data_lancamento,
            description: row.descricao,
            category: resolveCategory(row),
            type: row.tipo_lancamento === "C" ? "credito" : "debito",
            amount: Math.abs(Number(row.valor ?? 0)),
            balance: row.saldo_atual == null ? null : Number(row.saldo_atual),
          })),
        );
      } catch (error) {
        console.error("Falha ao carregar extrato", error);
        if (active) setStatement([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [limit]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return statement.filter((r) => {
      if (type !== "todos" && r.type !== type) return false;
      if (category !== "todas" && r.category !== category) return false;
      return !q || r.description.toLowerCase().includes(q) || r.id.toLowerCase().includes(q);
    });
  }, [statement, query, type, category]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, totalPages);
  const rows = filtered.slice((current - 1) * pageSize, current * pageSize);

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <header className="flex flex-wrap items-center gap-3 border-b border-border p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar no extrato"
            className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/15"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {typeOptions.map((t) => (
            <button
              key={t}
              onClick={() => {
                setType(t);
                setPage(1);
              }}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition",
                type === t
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {t === "credito" ? "Entradas" : t === "debito" ? "Saídas" : "Todos"}
            </button>
          ))}
        </div>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value as LedgerCategory | "todas");
            setPage(1);
          }}
          className="h-9 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground outline-none focus:border-primary/60"
        >
          {categoryOptions.map((c) => (
            <option key={c} value={c}>
              {c === "todas" ? "Todas as categorias" : categoryLabel[c]}
            </option>
          ))}
        </select>
      </header>

      {loading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Nenhum lançamento encontrado"
          description="Os lançamentos reais da operação aparecerão aqui conforme forem registrados no livro contábil."
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Data</th>
                  <th className="px-5 py-3 font-medium">Descrição</th>
                  <th className="px-5 py-3 font-medium">Categoria</th>
                  <th className="px-5 py-3 text-right font-medium">Valor</th>
                  <th className="px-5 py-3 text-right font-medium">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-muted/50">
                    <td className="whitespace-nowrap px-5 py-3.5 text-muted-foreground">
                      {formatDateTime(r.date)}
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-foreground">{r.description}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{r.id}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {categoryLabel[r.category]}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "px-5 py-3.5 text-right font-semibold tabular-nums",
                        r.type === "credito" ? "text-emerald-600" : "text-foreground",
                      )}
                    >
                      {r.type === "credito" ? "+" : "−"}
                      {formatBRL(r.amount)}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-muted-foreground">
                      {r.balance == null ? "—" : formatBRL(r.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 text-xs text-muted-foreground">
            <span>{formatInt(filtered.length)} lançamentos</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={current === 1}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background transition hover:bg-muted disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span>
                {current} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={current === totalPages}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background transition hover:bg-muted disabled:opacity-40"
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
