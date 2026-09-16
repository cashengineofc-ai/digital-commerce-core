import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Link2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatInt, formatPct } from "@/lib/format";
import { TableSkeleton } from "@/components/app/Skeletons";
import { EmptyState } from "@/components/app/EmptyState";

const PAGE_SIZE = 12;

type AffiliateLinkRow = {
  id: string;
  slug: string;
  affiliateId: string;
  affiliate: string;
  productId: string | null;
  product: string;
  clicks: number;
  sales: number;
  conversion: number;
  commissionValue: number;
};

type FilterOption = { id: string; name: string };

export function AffiliateLinksPage() {
  const [links, setLinks] = useState<AffiliateLinkRow[]>([]);
  const [products, setProducts] = useState<FilterOption[]>([]);
  const [affiliates, setAffiliates] = useState<FilterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [productFilter, setProductFilter] = useState<string>("todos");
  const [affiliateFilter, setAffiliateFilter] = useState<string>("todos");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!auth.user) return;

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("empresa_id")
          .eq("id", auth.user.id)
          .maybeSingle();
        if (profileError) throw profileError;
        if (!profile?.empresa_id) return;

        const { data: linkRows, error: linksError } = await supabase
          .from("links_afiliados")
          .select("id,afiliado_id,produto_id,slug_personalizado,url_curta,codigo_rastreio,total_cliques,total_vendas,taxa_conversao")
          .eq("empresa_id", profile.empresa_id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false });
        if (linksError) throw linksError;

        const affiliateIds = [...new Set((linkRows ?? []).map((row) => row.afiliado_id).filter(Boolean))];
        const productIds = [...new Set((linkRows ?? []).map((row) => row.produto_id).filter((id): id is string => Boolean(id)))];

        const [{ data: affiliateRows, error: affiliateError }, { data: productRows, error: productError }, { data: commissionRows, error: commissionError }] = await Promise.all([
          affiliateIds.length
            ? supabase.from("afiliados").select("id,profile_id").in("id", affiliateIds)
            : Promise.resolve({ data: [], error: null }),
          productIds.length
            ? supabase.from("produtos").select("id,nome").in("id", productIds)
            : Promise.resolve({ data: [], error: null }),
          supabase
            .from("comissoes")
            .select("link_afiliado_id,valor_comissao_liquida,status")
            .eq("empresa_id", profile.empresa_id)
            .is("deleted_at", null),
        ]);
        if (affiliateError) throw affiliateError;
        if (productError) throw productError;
        if (commissionError) throw commissionError;

        const profileIds = (affiliateRows ?? []).map((row) => row.profile_id).filter((id): id is string => Boolean(id));
        const { data: profileRows, error: namesError } = profileIds.length
          ? await supabase.from("profiles").select("id,nome_completo").in("id", profileIds)
          : { data: [], error: null };
        if (namesError) throw namesError;

        const profileNameMap = new Map((profileRows ?? []).map((row) => [row.id, row.nome_completo]));
        const affiliateNameMap = new Map((affiliateRows ?? []).map((row) => [row.id, row.profile_id ? profileNameMap.get(row.profile_id) ?? "Afiliado" : "Afiliado"]));
        const productNameMap = new Map((productRows ?? []).map((row) => [row.id, row.nome]));
        const commissionTotals = new Map<string, { total: number; count: number }>();

        for (const commission of commissionRows ?? []) {
          if (!commission.link_afiliado_id || commission.status === "cancelada" || commission.status === "estornada") continue;
          const current = commissionTotals.get(commission.link_afiliado_id) ?? { total: 0, count: 0 };
          current.total += Number(commission.valor_comissao_liquida ?? 0);
          current.count += 1;
          commissionTotals.set(commission.link_afiliado_id, current);
        }

        const mapped = (linkRows ?? []).map<AffiliateLinkRow>((row) => {
          const commission = commissionTotals.get(row.id);
          const slug = row.slug_personalizado ?? row.codigo_rastreio ?? row.id;
          return {
            id: row.id,
            slug,
            affiliateId: row.afiliado_id,
            affiliate: affiliateNameMap.get(row.afiliado_id) ?? "Afiliado",
            productId: row.produto_id ?? null,
            product: row.produto_id ? productNameMap.get(row.produto_id) ?? "Produto" : "—",
            clicks: Number(row.total_cliques ?? 0),
            sales: Number(row.total_vendas ?? 0),
            conversion: Number(row.taxa_conversao ?? 0),
            commissionValue: commission && commission.count > 0 ? commission.total / commission.count : 0,
          };
        });

        if (active) {
          setLinks(mapped);
          setProducts((productRows ?? []).map((row) => ({ id: row.id, name: row.nome })));
          setAffiliates((affiliateRows ?? []).map((row) => ({ id: row.id, name: affiliateNameMap.get(row.id) ?? "Afiliado" })));
        }
      } catch (error) {
        console.error("Falha ao carregar links de afiliado", error);
        if (active) {
          setLinks([]);
          setProducts([]);
          setAffiliates([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return links.filter((l) => {
      if (productFilter !== "todos" && l.productId !== productFilter) return false;
      if (affiliateFilter !== "todos" && l.affiliateId !== affiliateFilter) return false;
      if (!q) return true;
      return l.slug.toLowerCase().includes(q) || l.affiliate.toLowerCase().includes(q) || l.product.toLowerCase().includes(q) || l.id.toLowerCase().includes(q);
    });
  }, [links, query, productFilter, affiliateFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  function reset<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setPage(1); };
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <header><h1 className="text-2xl font-semibold tracking-tight text-foreground">Links</h1><p className="mt-1 text-sm text-muted-foreground">Links de afiliado rastreáveis por produto e afiliado.</p></header>

      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => reset(setQuery)(e.target.value)} placeholder="Buscar por slug, afiliado ou produto" className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/15" />
        </div>
        <select value={productFilter} onChange={(e) => reset(setProductFilter)(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground outline-none focus:border-primary/60">
          <option value="todos">Todos os produtos</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={affiliateFilter} onChange={(e) => reset(setAffiliateFilter)(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground outline-none focus:border-primary/60">
          <option value="todos">Todos os afiliados</option>
          {affiliates.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {loading ? <TableSkeleton rows={6} cols={7} /> : rows.length === 0 ? <EmptyState icon={Link2} title="Nenhum link de afiliado encontrado" description="Links reais aparecerão aqui quando forem criados para afiliados e produtos." /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground"><th className="px-5 py-3 font-medium">Link</th><th className="px-5 py-3 font-medium">Afiliado</th><th className="px-5 py-3 font-medium">Produto</th><th className="px-5 py-3 text-right font-medium">Cliques</th><th className="px-5 py-3 text-right font-medium">Vendas</th><th className="px-5 py-3 text-right font-medium">Conversão</th><th className="px-5 py-3 text-right font-medium">Comissão por venda</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {rows.map((l) => <tr key={l.id} className="transition-colors hover:bg-muted/50"><td className="px-5 py-3.5"><p className="font-mono text-xs font-medium text-primary">cashenginepro.app/{l.slug}</p><p className="mt-0.5 text-xs text-muted-foreground">{l.id}</p></td><td className="px-5 py-3.5 font-medium text-foreground">{l.affiliate}</td><td className="px-5 py-3.5 text-muted-foreground">{l.product}</td><td className="px-5 py-3.5 text-right tabular-nums text-muted-foreground">{formatInt(l.clicks)}</td><td className="px-5 py-3.5 text-right tabular-nums text-foreground">{formatInt(l.sales)}</td><td className="px-5 py-3.5 text-right tabular-nums text-muted-foreground">{formatPct(l.conversion)}</td><td className="px-5 py-3.5 text-right font-semibold tabular-nums text-foreground">{formatBRL(l.commissionValue)}</td></tr>)}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3"><p className="text-xs text-muted-foreground">Página {current} de {totalPages} · {formatInt(filtered.length)} links</p><div className="flex items-center gap-2"><button onClick={() => setPage(Math.max(1, current - 1))} disabled={current === 1} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium text-foreground transition hover:bg-muted disabled:opacity-40"><ChevronLeft className="h-3.5 w-3.5" />Anterior</button><button onClick={() => setPage(Math.min(totalPages, current + 1))} disabled={current === totalPages} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium text-foreground transition hover:bg-muted disabled:opacity-40">Próxima<ChevronRight className="h-3.5 w-3.5" /></button></div></div>
          </>
        )}
      </section>
    </div>
  );
}
