import { useEffect, useMemo, useState } from "react";
import { CreditCard, Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatInt } from "@/lib/format";
import { CardsSkeleton } from "@/components/app/Skeletons";
import { EmptyState } from "@/components/app/EmptyState";
import { cn } from "@/lib/utils";

const statusOptions = ["todos", "ativo", "rascunho", "arquivado"] as const;
type StatusFilter = (typeof statusOptions)[number];
type CheckoutStatus = Exclude<StatusFilter, "todos">;

type Checkout = {
  id: string;
  name: string;
  product: string;
  status: CheckoutStatus;
  methods: string[];
  sales: number;
  revenue: number;
  price: number;
};

function StatusPill({ status }: { status: CheckoutStatus }) {
  const map: Record<CheckoutStatus, string> = {
    ativo: "bg-emerald-500/10 text-emerald-700",
    rascunho: "bg-muted text-muted-foreground",
    arquivado: "bg-zinc-500/10 text-zinc-700",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", map[status])}>
      {status}
    </span>
  );
}

function MethodChip({ method }: { method: string }) {
  return (
    <span className="inline-flex items-center rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      {method}
    </span>
  );
}

function CheckoutCard({ checkout, onEdit }: { checkout: Checkout; onEdit: (checkout: Checkout) => void }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-border/80 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-foreground">{checkout.name}</h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{checkout.product}</p>
        </div>
        <StatusPill status={checkout.status} />
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {checkout.methods.length > 0 ? (
          checkout.methods.map((m) => <MethodChip key={m} method={m} />)
        ) : (
          <span className="text-xs text-muted-foreground">Métodos seguem a configuração padrão</span>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Vendas</p>
          <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
            {formatInt(checkout.sales)}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Receita</p>
          <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
            {formatBRL(checkout.revenue, { compact: true })}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
        <p className="text-xs font-medium text-foreground">{formatBRL(checkout.price)}</p>
        <button
          onClick={() => onEdit(checkout)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
        >
          Editar nome
        </button>
      </div>
    </div>
  );
}

function normalizeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function CheckoutsPage() {
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("todos");
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      setUserId(auth.user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (!profile?.empresa_id) return;
      setEmpresaId(profile.empresa_id);

      const { data, error } = await supabase
        .from("checkouts")
        .select(
          "id,nome,status,total_vendido,total_arrecadado,produtos(nome,preco),templates_checkout(mostrar_pagamento_pix,mostrar_pagamento_boleto,mostrar_pagamento_cartao)",
        )
        .eq("empresa_id", profile.empresa_id)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      setCheckouts(
        ((data ?? []) as unknown as Array<any>).map((row) => {
          const template = row.templates_checkout;
          const methods: string[] = [];
          if (template?.mostrar_pagamento_pix) methods.push("Pix");
          if (template?.mostrar_pagamento_cartao) methods.push("Cartão");
          if (template?.mostrar_pagamento_boleto) methods.push("Boleto");
          return {
            id: row.id,
            name: row.nome,
            product: row.produtos?.nome ?? "Sem produto vinculado",
            status: row.status === "publicado" ? "ativo" : row.status,
            methods,
            sales: Number(row.total_vendido ?? 0),
            revenue: Number(row.total_arrecadado ?? 0),
            price: Number(row.produtos?.preco ?? 0),
          } as Checkout;
        }),
      );
    } catch (error) {
      console.error("Falha ao carregar checkouts", error);
      setCheckouts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return checkouts.filter((c) => {
      if (status !== "todos" && c.status !== status) return false;
      return !q || c.name.toLowerCase().includes(q) || c.product.toLowerCase().includes(q);
    });
  }, [checkouts, query, status]);

  async function createCheckout() {
    if (!empresaId || !userId) return;
    const name = window.prompt("Nome do novo checkout");
    if (!name?.trim()) return;
    const base = normalizeSlug(name) || "checkout";
    const slug = `${base}-${crypto.randomUUID().slice(0, 8)}`;
    const { error } = await supabase.from("checkouts").insert({
      empresa_id: empresaId,
      criado_por: userId,
      nome: name.trim(),
      slug,
      status: "rascunho",
    });
    if (error) {
      console.error("Falha ao criar checkout", error);
      window.alert("Não foi possível criar o checkout.");
      return;
    }
    await load();
  }

  async function editCheckout(checkout: Checkout) {
    const name = window.prompt("Novo nome do checkout", checkout.name);
    if (!name?.trim() || name.trim() === checkout.name) return;
    const { error } = await supabase
      .from("checkouts")
      .update({ nome: name.trim() })
      .eq("id", checkout.id);
    if (error) {
      console.error("Falha ao editar checkout", error);
      window.alert("Não foi possível atualizar o checkout.");
      return;
    }
    await load();
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Checkouts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Páginas de pagamento rápidas, responsivas e configuráveis por produto.
          </p>
        </div>
        <button
          onClick={createCheckout}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Novo checkout
        </button>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou produto"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/15"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {statusOptions.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition",
                status === s
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <section className="mt-6">
        {loading ? (
          <CardsSkeleton count={6} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="Nenhum checkout encontrado"
            description="Crie um novo checkout para começar a vender seus produtos com páginas otimizadas para conversão."
            action={
              <button
                onClick={createCheckout}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                Criar checkout
              </button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((c) => (
              <CheckoutCard key={c.id} checkout={c} onEdit={editCheckout} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
