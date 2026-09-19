import { useEffect, useMemo, useState } from "react";
import { Megaphone, Search, Store } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTempAuth } from "@/lib/auth-temp";
import { formatBRL, formatInt, formatPct } from "@/lib/format";
import { CardsSkeleton } from "@/components/app/Skeletons";
import { EmptyState } from "@/components/app/EmptyState";
import { cn } from "@/lib/utils";

type MarketplaceTag = "destaque" | "novo" | "manual";

type MarketplaceProduct = {
  id: string;
  productId: string;
  sellerCompanyId: string;
  name: string;
  producer: string;
  category: string;
  price: number;
  commission: number;
  commissionValue: number;
  sales: number;
  quality: number;
  image: string | null;
  tag: MarketplaceTag | null;
};

function TagPill({ tag }: { tag: MarketplaceTag }) {
  const map: Record<MarketplaceTag, string> = {
    destaque: "bg-amber-500/10 text-amber-700 border-amber-500/20",
    novo: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
    manual: "bg-indigo-500/10 text-indigo-700 border-indigo-500/20",
  };
  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize", map[tag])}>{tag}</span>;
}

function ProductCard({ product, promoting, onPromote }: {
  product: MarketplaceProduct;
  promoting: boolean;
  onPromote: (product: MarketplaceProduct) => void;
}) {
  return (
    <div className="group overflow-hidden rounded-xl border border-border bg-card shadow-sm transition hover:border-border/80 hover:shadow-md">
      <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-[#0b1e3f] via-[#111827] to-black">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.15),transparent_50%)]" />
        {product.image ? <img src={product.image} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 flex items-center justify-center"><Store className="h-10 w-10 text-white/30" /></div>}
        {product.tag && <div className="absolute left-3 top-3"><TagPill tag={product.tag} /></div>}
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{product.category}</p>
          <p className="text-[11px] text-muted-foreground"><span className="font-medium text-foreground">Qualidade</span> {product.quality}/5</p>
        </div>
        <h3 className="mt-2 font-semibold text-foreground">{product.name}</h3>
        <p className="mt-1 text-xs text-muted-foreground">por {product.producer}</p>
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4">
          <div><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Preço</p><p className="mt-1 text-sm font-semibold tabular-nums text-foreground">{formatBRL(product.price)}</p></div>
          <div><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Comissão</p><p className="mt-1 text-sm font-semibold tabular-nums text-emerald-600">{formatPct(product.commission)}</p></div>
          <div><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Vendas</p><p className="mt-1 text-sm font-semibold tabular-nums text-foreground">{formatInt(product.sales)}</p></div>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">Comissão estimada <span className="font-semibold text-foreground">{formatBRL(product.commissionValue)}</span> por venda</p>
          <button disabled={promoting} onClick={() => onPromote(product)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"><Megaphone className="h-3.5 w-3.5" />{promoting ? "Enviando..." : "Promover"}</button>
        </div>
      </div>
    </div>
  );
}

export function MarketplacePage() {
  const { user } = useTempAuth();
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("marketplace_produtos")
          .select("id,empresa_vendedora_id,produto_id,titulo_marketplace,categoria_marketplace,preco_marketplace,taxa_comissao_oferecida,comissao_valor_fixo_oferecida,total_vendas_total,nivel_qualidade,imagem_destaque,destaque_marketplace,material_apoio_disponivel,created_at")
          .eq("status", "publicado")
          .is("deleted_at", null)
          .order("destaque_marketplace", { ascending: false })
          .order("created_at", { ascending: false });
        if (error) throw error;

        const companyIds = [...new Set((data ?? []).map((row) => row.empresa_vendedora_id))];
        const { data: companies, error: companiesError } = companyIds.length
          ? await supabase.from("empresas").select("id,nome_fantasia").in("id", companyIds)
          : { data: [], error: null };
        if (companiesError) throw companiesError;
        const companyMap = new Map((companies ?? []).map((company) => [company.id, company.nome_fantasia]));
        const now = Date.now();

        const mapped = (data ?? []).map<MarketplaceProduct>((row) => {
          const createdAt = new Date(row.created_at).getTime();
          const isNew = now - createdAt <= 14 * 86400 * 1000;
          const tag: MarketplaceTag | null = row.destaque_marketplace ? "destaque" : isNew ? "novo" : (row.material_apoio_disponivel?.length ?? 0) > 0 ? "manual" : null;
          const price = Number(row.preco_marketplace ?? 0);
          const rate = Number(row.taxa_comissao_oferecida ?? 0);
          const fixed = Number(row.comissao_valor_fixo_oferecida ?? 0);
          return {
            id: row.id,
            productId: row.produto_id,
            sellerCompanyId: row.empresa_vendedora_id,
            name: row.titulo_marketplace,
            producer: companyMap.get(row.empresa_vendedora_id) ?? "Produtor",
            category: row.categoria_marketplace ?? "Outros",
            price,
            commission: rate,
            commissionValue: fixed > 0 ? fixed : price * (rate / 100),
            sales: Number(row.total_vendas_total ?? 0),
            quality: Number(row.nivel_qualidade ?? 0),
            image: row.imagem_destaque ?? null,
            tag,
          };
        });
        if (active) setProducts(mapped);
      } catch (error) {
        console.error("Falha ao carregar marketplace", error);
        if (active) setProducts([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  const categories = useMemo(() => ["Todas", ...Array.from(new Set(products.map((p) => p.category))).sort()], [products]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (category !== "Todas" && p.category !== category) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.producer.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
    });
  }, [products, query, category]);

  async function promote(product: MarketplaceProduct) {
    setPromotingId(product.id);
    try {
      if (!user?.empresaId) throw new Error("Sua conta ainda não possui uma empresa vinculada.");

      const { data: affiliate, error: affiliateError } = await supabase
        .from("afiliados")
        .select("id")
        .eq("profile_id", user.id)
        .eq("status", "ativo")
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle();
      if (affiliateError) throw affiliateError;
      if (!affiliate) throw new Error("Seu perfil ainda não está ativo como afiliado.");

      const { error } = await supabase.from("marketplace_inscricoes").upsert({
        marketplace_produto_id: product.id,
        afiliado_id: affiliate.id,
        empresa_id: user.empresaId,
        produto_id: product.productId,
        status: "pendente",
        ativa: true,
      }, { onConflict: "marketplace_produto_id,afiliado_id", ignoreDuplicates: true });
      if (error) throw error;
      toast.success("Solicitação para promover enviada.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível solicitar a promoção.";
      toast.error(message);
    } finally {
      setPromotingId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <header><h1 className="text-2xl font-semibold tracking-tight text-foreground">Marketplace</h1><p className="mt-1 text-sm text-muted-foreground">Catálogo de produtos publicados para afiliados promoverem.</p></header>
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="relative min-w-[220px] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por produto, produtor ou categoria" className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/15" /></div>
        <div className="flex flex-wrap gap-1.5">{categories.map((c) => <button key={c} onClick={() => setCategory(c)} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition", category === c ? "bg-primary text-primary-foreground" : "border border-border bg-background text-muted-foreground hover:bg-muted")}>{c}</button>)}</div>
      </div>
      <section className="mt-6">
        {loading ? <CardsSkeleton count={6} /> : rows.length === 0 ? <EmptyState icon={Store} title="Nenhum produto encontrado" description="Produtos reais publicados no marketplace aparecerão aqui." /> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{rows.map((p) => <ProductCard key={p.id} product={p} promoting={promotingId === p.id} onPromote={promote} />)}</div>}
      </section>
    </div>
  );
}
