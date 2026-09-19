import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  CircleDollarSign,
  Package,
  PackagePlus,
  Pencil,
  RefreshCw,
  Search,
  ShoppingBag,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatInt } from "@/lib/format";
import { EmptyState } from "@/components/app/EmptyState";
import { TableSkeleton } from "@/components/app/Skeletons";
import { ProductEditor } from "@/components/app/products/ProductEditor";
import { cn } from "@/lib/utils";

type ProductStatus = "rascunho" | "publicado" | "arquivado" | "indisponivel";

type Product = {
  id: string;
  nome: string;
  preco: number;
  status: ProductStatus;
  comissao_percentual: number;
  ofertas_ativas: number;
  checkouts_publicados: number;
  vendas_confirmadas: number;
  faturamento_bruto: number;
};

const statusOptions: Array<{ value: ProductStatus | "todos"; label: string }> = [
  { value: "todos", label: "Todos" },
  { value: "publicado", label: "Publicados" },
  { value: "rascunho", label: "Rascunhos" },
  { value: "indisponivel", label: "Indisponíveis" },
  { value: "arquivado", label: "Arquivados" },
];

function StatusPill({ status }: { status: ProductStatus }) {
  const styles: Record<ProductStatus, string> = {
    publicado: "bg-emerald-500/10 text-emerald-700",
    rascunho: "bg-muted text-muted-foreground",
    indisponivel: "bg-amber-500/10 text-amber-700",
    arquivado: "bg-zinc-500/10 text-zinc-700",
  };
  const labels: Record<ProductStatus, string> = {
    publicado: "Publicado",
    rascunho: "Rascunho",
    indisponivel: "Indisponível",
    arquivado: "Arquivado",
  };

  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", styles[status])}>
      {labels[status]}
    </span>
  );
}

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ProductStatus | "todos">("todos");
  const [editor, setEditor] = useState<{ open: boolean; productId: string | null }>({
    open: false,
    productId: null,
  });

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await (supabase as any).rpc("fn_produtos_operacionais", {
        p_busca: null,
        p_limit: 200,
        p_offset: 0,
      });
      if (error) throw error;
      setProducts(
        ((data ?? []) as any[]).map((row) => ({
          id: String(row.id),
          nome: String(row.nome ?? ""),
          preco: Number(row.preco ?? 0),
          status: row.status as ProductStatus,
          comissao_percentual: Number(row.comissao_percentual ?? 0),
          ofertas_ativas: Number(row.ofertas_ativas ?? 0),
          checkouts_publicados: Number(row.checkouts_publicados ?? 0),
          vendas_confirmadas: Number(row.vendas_confirmadas ?? 0),
          faturamento_bruto: Number(row.faturamento_bruto ?? 0),
        })),
      );
    } catch (cause) {
      console.error("Falha ao carregar produtos", cause);
      setProducts([]);
      setLoadError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar os produtos reais.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    return products.filter((product) => {
      if (status !== "todos" && product.status !== status) return false;
      if (!q) return true;
      return (
        product.nome.toLocaleLowerCase("pt-BR").includes(q) ||
        product.id.toLowerCase().includes(q)
      );
    });
  }, [products, query, status]);

  const overview = useMemo(
    () =>
      products.reduce(
        (acc, product) => {
          acc.published += product.status === "publicado" ? 1 : 0;
          acc.sales += product.vendas_confirmadas;
          acc.revenue += product.faturamento_bruto;
          return acc;
        },
        { published: 0, sales: 0, revenue: 0 },
      ),
    [products],
  );

  if (editor.open) {
    return (
      <ProductEditor
        productId={editor.productId}
        onBack={() => {
          setEditor({ open: false, productId: null });
          void load();
        }}
        onSaved={(id) => setEditor({ open: true, productId: id })}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Produtos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Produtos reais, ofertas e checkouts vinculados sem duplicar vendas.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Atualizar
          </button>
          <button
            onClick={() => setEditor({ open: true, productId: null })}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            <PackagePlus className="h-4 w-4" />
            Novo produto
          </button>
        </div>
      </header>

      {loadError && (
        <div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Produtos</span>
            <Package className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums text-foreground">
            {loading ? "—" : formatInt(products.length)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">registros operacionais</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Publicados</span>
            <BadgeCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums text-foreground">
            {loading ? "—" : formatInt(overview.published)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">disponíveis na operação</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Vendas confirmadas</span>
            <ShoppingBag className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums text-foreground">
            {loading ? "—" : formatInt(overview.sales)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">pedidos pagos vinculados</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Faturamento</span>
            <CircleDollarSign className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums text-foreground">
            {loading ? "—" : formatBRL(overview.revenue, { compact: true })}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">somente pagamentos confirmados</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou código"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/15"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {statusOptions.map((item) => (
            <button
              key={item.value}
              onClick={() => setStatus(item.value)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                status === item.value
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {loading ? (
          <TableSkeleton rows={6} cols={8} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Nenhum produto encontrado"
            description="Não há registros reais para os filtros atuais."
            action={
              <button
                onClick={() => setEditor({ open: true, productId: null })}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                Criar produto
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Produto</th>
                  <th className="px-5 py-3 font-medium">Preço</th>
                  <th className="px-5 py-3 font-medium">Situação</th>
                  <th className="px-5 py-3 text-right font-medium">Ofertas</th>
                  <th className="px-5 py-3 text-right font-medium">Checkouts</th>
                  <th className="px-5 py-3 text-right font-medium">Vendas</th>
                  <th className="px-5 py-3 text-right font-medium">Faturamento</th>
                  <th className="px-5 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((product) => (
                  <tr key={product.id} className="transition-colors hover:bg-muted/50">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-foreground">{product.nome}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {product.id}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 tabular-nums text-foreground">
                      {formatBRL(product.preco)}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill status={product.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-muted-foreground">
                      {formatInt(product.ofertas_ativas)}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-muted-foreground">
                      {formatInt(product.checkouts_publicados)}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-muted-foreground">
                      {formatInt(product.vendas_confirmadas)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold tabular-nums text-foreground">
                      {formatBRL(product.faturamento_bruto, { compact: true })}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-2">
                        <Link
                          to={`/app/vendas?produto=${encodeURIComponent(product.id)}` as never}
                          preload="intent"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                        >
                          <ShoppingBag className="h-3.5 w-3.5" />
                          Vendas
                        </Link>
                        <button
                          onClick={() =>
                            setEditor({ open: true, productId: product.id })
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="mt-3 text-xs text-muted-foreground">
        Vendas e faturamento consideram pedidos com pagamento confirmado. Cada pedido é contado uma única vez.
      </p>
    </div>
  );
}
