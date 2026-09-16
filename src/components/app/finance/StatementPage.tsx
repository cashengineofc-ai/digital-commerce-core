import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import { StatementTable } from "@/components/app/finance/StatementTable";

type ExportRow = {
  id: string;
  date: string;
  description: string;
  type: "credito" | "debito";
  amount: number;
  balance: number | null;
};

export function StatementPage() {
  const [rows, setRows] = useState<ExportRow[]>([]);
  const [loading, setLoading] = useState(true);

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

        const { data, error } = await supabase
          .from("lancamentos_contabeis")
          .select("id,data_lancamento,descricao,tipo_lancamento,valor,saldo_atual")
          .eq("empresa_id", profile.empresa_id)
          .order("data_lancamento", { ascending: false });

        if (error) throw error;
        if (!active) return;

        setRows(
          (data ?? []).map((row) => ({
            id: row.id,
            date: row.data_lancamento,
            description: row.descricao,
            type: row.tipo_lancamento === "C" ? "credito" : "debito",
            amount: Math.abs(Number(row.valor ?? 0)),
            balance: row.saldo_atual == null ? null : Number(row.saldo_atual),
          })),
        );
      } catch (error) {
        console.error("Falha ao calcular totais do extrato", error);
        if (active) setRows([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const credits = rows.filter((r) => r.type === "credito").reduce((a, r) => a + r.amount, 0);
  const debits = rows.filter((r) => r.type === "debito").reduce((a, r) => a + r.amount, 0);

  function exportCsv() {
    if (rows.length === 0) return;
    const csvRows = [
      ["ID", "Data", "Descrição", "Tipo", "Valor", "Saldo"],
      ...rows.map((r) => [
        r.id,
        r.date,
        r.description,
        r.type,
        r.amount.toFixed(2),
        r.balance == null ? "" : r.balance.toFixed(2),
      ]),
    ];
    const csv = csvRows
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `extrato-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Extrato</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading
              ? "Carregando movimentações..."
              : `${formatBRL(credits)} em entradas · ${formatBRL(debits)} em saídas e taxas`}
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={rows.length === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Exportar CSV
        </button>
      </header>

      <div className="mt-6">
        <StatementTable pageSize={14} />
      </div>
    </div>
  );
}
