import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";

type FeeCategory = "pix" | "cartao" | "boleto" | "outro" | "saque";
type FeeEntry = { id: string; category: FeeCategory; name: string; volume: number; fee: number; rate: number };

const categoryLabel: Record<FeeCategory, string> = { pix: "Pix", cartao: "Cartão", boleto: "Boleto", outro: "Outro", saque: "Saque" };
const categoryStyles: Record<FeeCategory, { pill: string; bar: string }> = {
  pix: { pill: "bg-success/12 text-success", bar: "bg-success" },
  cartao: { pill: "bg-primary/12 text-primary", bar: "bg-primary" },
  boleto: { pill: "bg-muted text-muted-foreground", bar: "bg-muted-foreground/60" },
  outro: { pill: "bg-[oklch(0.70_0.18_280_/_18%)] text-[oklch(0.50_0.16_280)]", bar: "bg-[oklch(0.60_0.18_280)]" },
  saque: { pill: "bg-[oklch(0.78_0.15_80_/_18%)] text-[oklch(0.52_0.13_75)]", bar: "bg-[oklch(0.72_0.15_80)]" },
};

function categoryForMethod(method: string | null): FeeCategory {
  if (method === "pix") return "pix";
  if (method === "boleto") return "boleto";
  if (["cartao_credito", "cartao_debito"].includes(method ?? "")) return "cartao";
  return "outro";
}

function CategoryBadge({ category }: { category: FeeCategory }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold", categoryStyles[category].pill)}>{categoryLabel[category]}</span>;
}

export function FeesPage() {
  const [fees, setFees] = useState<FeeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { if (active) setLoading(false); return; }
      const { data: profile } = await supabase.from("profiles").select("empresa_id").eq("id", auth.user.id).maybeSingle();
      if (!profile?.empresa_id) { if (active) setLoading(false); return; }

      const [transactionsResult, withdrawalsResult] = await Promise.all([
        supabase
          .from("transacoes")
          .select("metodo_pagamento,valor_bruto,valor_taxa_processamento")
          .eq("empresa_id", profile.empresa_id)
          .in("status", ["aprovada", "autorizada", "capturada", "paga", "disponivel"]),
        supabase
          .from("saques")
          .select("valor_solicitado,taxa_saque,status")
          .eq("empresa_id", profile.empresa_id),
      ]);

      if (!active) return;
      if (transactionsResult.error) console.error("Falha ao carregar taxas de transações", transactionsResult.error);
      if (withdrawalsResult.error) console.error("Falha ao carregar taxas de saque", withdrawalsResult.error);

      const grouped = new Map<FeeCategory, { volume: number; fee: number }>();
      for (const transaction of transactionsResult.data ?? []) {
        const category = categoryForMethod(transaction.metodo_pagamento);
        const current = grouped.get(category) ?? { volume: 0, fee: 0 };
        current.volume += Number(transaction.valor_bruto ?? 0);
        current.fee += Number(transaction.valor_taxa_processamento ?? 0);
        grouped.set(category, current);
      }

      const withdrawals = (withdrawalsResult.data ?? []).filter((withdrawal) => withdrawal.status !== "cancelado");
      if (withdrawals.length) {
        grouped.set("saque", {
          volume: withdrawals.reduce((sum, withdrawal) => sum + Number(withdrawal.valor_solicitado ?? 0), 0),
          fee: withdrawals.reduce((sum, withdrawal) => sum + Number(withdrawal.taxa_saque ?? 0), 0),
        });
      }

      const rows: FeeEntry[] = Array.from(grouped.entries()).map(([category, values]) => ({
        id: category,
        category,
        name: category === "saque" ? "Taxas de saque" : `Processamento via ${categoryLabel[category]}`,
        volume: values.volume,
        fee: values.fee,
        rate: values.volume > 0 ? (values.fee / values.volume) * 100 : 0,
      })).sort((a, b) => b.fee - a.fee);

      setFees(rows);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const totalFees = useMemo(() => fees.reduce((sum, entry) => sum + entry.fee, 0), [fees]);
  const totalVolume = useMemo(() => fees.reduce((sum, entry) => sum + entry.volume, 0), [fees]);
  const avgRate = totalVolume > 0 ? (totalFees / totalVolume) * 100 : 0;
  const stacked = useMemo(() => fees.filter((entry) => entry.fee > 0).map((entry) => ({ ...entry, pct: totalFees > 0 ? (entry.fee / totalFees) * 100 : 0 })), [fees, totalFees]);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <header><h1 className="text-2xl font-semibold tracking-tight text-foreground">Taxas</h1><p className="mt-1 text-sm text-muted-foreground">Taxas efetivamente registradas em pagamentos e saques.</p></header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm"><p className="text-sm font-medium text-muted-foreground">Total de taxas</p><p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-foreground">{formatBRL(totalFees)}</p></div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm"><p className="text-sm font-medium text-muted-foreground">Taxa média efetiva</p><p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-primary">{formatPct(avgRate, 2)}</p></div>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <p className="text-sm font-semibold tracking-tight text-foreground">Composição por categoria</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Percentual de cada grupo sobre o total de taxas realmente cobradas</p>
        {stacked.length ? (
          <div className="mt-5">
            <div className="flex h-8 w-full overflow-hidden rounded-lg bg-muted/60">{stacked.map((entry) => <div key={entry.id} className={cn("h-full", categoryStyles[entry.category].bar)} style={{ width: `${entry.pct}%` }} title={`${categoryLabel[entry.category]}: ${formatPct(entry.pct, 1)} · ${formatBRL(entry.fee)}`} />)}</div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">{stacked.map((entry) => <div key={entry.id} className="flex items-center gap-2 text-xs"><span className={cn("h-2.5 w-2.5 rounded-sm", categoryStyles[entry.category].bar)} /><span className="font-medium text-foreground">{categoryLabel[entry.category]}</span><span className="tabular-nums text-muted-foreground">{formatPct(entry.pct, 0)}</span></div>)}</div>
          </div>
        ) : <p className="mt-5 text-sm text-muted-foreground">Nenhuma taxa registrada ainda.</p>}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-sm"><thead><tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground"><th className="px-5 py-3 font-medium">Categoria</th><th className="px-5 py-3 font-medium">Descrição</th><th className="px-5 py-3 text-right font-medium">Volume processado</th><th className="px-5 py-3 text-right font-medium">Valor cobrado</th><th className="px-5 py-3 text-right font-medium">Taxa efetiva</th></tr></thead>
          <tbody className="divide-y divide-border">{loading ? <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-muted-foreground">Carregando taxas...</td></tr> : fees.length ? fees.map((entry) => <tr key={entry.id} className="transition hover:bg-muted/60"><td className="px-5 py-3"><CategoryBadge category={entry.category} /></td><td className="px-5 py-3 text-foreground">{entry.name}</td><td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{formatBRL(entry.volume, { compact: true })}</td><td className="px-5 py-3 text-right font-medium tabular-nums text-foreground">{formatBRL(entry.fee)}</td><td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{formatPct(entry.rate, 2)}</td></tr>) : <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-muted-foreground">Nenhuma taxa registrada.</td></tr>}</tbody></table></div>
      </div>
    </div>
  );
}
