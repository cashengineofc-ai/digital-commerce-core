import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  Eye,
  ImagePlus,
  Loader2,
  Monitor,
  Plus,
  RefreshCw,
  Save,
  Smartphone,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTempAuth } from "@/lib/auth-temp";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

type DraftConfig = {
  theme: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
    font: string;
    logo_url?: string | null;
  };
  texts: {
    title: string;
    subtitle: string;
    pay_button: string;
  };
  buyer_fields: {
    cpf: boolean;
    phone: boolean;
    address: boolean;
  };
  payment_ui: {
    pix: boolean;
    card: false;
    boleto: false;
  };
  confirmation: {
    redirect_url: string | null;
  };
  banners: {
    desktop_url?: string | null;
    mobile_url?: string | null;
    alt?: string | null;
    destination_url?: string | null;
  };
  sections: string[];
  support: {
    label?: string | null;
    url?: string | null;
  };
  legal: {
    terms_url?: string | null;
    privacy_url?: string | null;
  };
};

type Bump = {
  id: string;
  produto_id: string;
  titulo: string | null;
  descricao: string | null;
  imagem_url: string | null;
  tipo_preco: "produto" | "preco_fixo" | "desconto_percentual";
  preco_fixo: number | null;
  desconto_percentual: number | null;
  ordem: number;
  ativo: boolean;
  grupo_combinacao: string | null;
  max_selecao_grupo: number | null;
};

type Product = {
  id: string;
  nome: string;
  preco: number;
  status: string;
};

type CheckoutRecord = {
  id: string;
  nome: string;
  descricao: string | null;
  status: "rascunho" | "publicado" | "arquivado";
  public_token: string;
  slug: string;
  oferta_id: string;
  rascunho_versao_id: string | null;
  publicado_versao_id: string | null;
};

const defaultConfig: DraftConfig = {
  theme: {
    primary: "#2563EB",
    secondary: "#0F172A",
    background: "#050505",
    text: "#FFFFFF",
    font: "Inter",
    logo_url: null,
  },
  texts: {
    title: "Finalizar compra",
    subtitle: "",
    pay_button: "Gerar Pix",
  },
  buyer_fields: { cpf: true, phone: true, address: false },
  payment_ui: { pix: true, card: false, boleto: false },
  confirmation: { redirect_url: null },
  banners: {},
  sections: ["produto", "dados", "adicionais", "pagamento", "resumo"],
  support: {},
  legal: {},
};

function safeFilename(file: File) {
  const extension = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : "jpg";
  return `${crypto.randomUUID()}.${extension || "jpg"}`;
}

export function CheckoutEditor({
  checkoutId,
  onBack,
}: {
  checkoutId: string;
  onBack: () => void;
}) {
  const { user, isLoading: isAuthLoading } = useTempAuth();
  const [checkout, setCheckout] = useState<CheckoutRecord | null>(null);
  const [config, setConfig] = useState<DraftConfig>(defaultConfig);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [bumps, setBumps] = useState<Bump[]>([]);
  const [offerPrice, setOfferPrice] = useState(0);
  const [offerName, setOfferName] = useState("");
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const publicPath = checkout ? `/checkout/${checkout.public_token}` : "";
  const publicOrigin = typeof window !== "undefined" ? window.location.origin : "";

  async function load() {
    setLoading(true);
    setError(null);
    try {
      if (isAuthLoading) return;
      if (!user?.empresaId) throw new Error("Empresa não identificada.");
      setEmpresaId(user.empresaId);

      const { data: checkoutData, error: checkoutError } = await (supabase as any)
        .from("checkouts")
        .select("id,nome,descricao,status,public_token,slug,oferta_id,rascunho_versao_id,publicado_versao_id")
        .eq("id", checkoutId)
        .eq("empresa_id", user.empresaId)
        .is("deleted_at", null)
        .maybeSingle();

      if (checkoutError) throw checkoutError;
      if (!checkoutData) throw new Error("Checkout não encontrado.");

      setCheckout(checkoutData as CheckoutRecord);
      setName(checkoutData.nome ?? "");
      setDescription(checkoutData.descricao ?? "");

      if (checkoutData.rascunho_versao_id) {
        const { data: version, error: versionError } = await (supabase as any)
          .from("checkout_versions")
          .select("config")
          .eq("id", checkoutData.rascunho_versao_id)
          .eq("estado", "rascunho")
          .maybeSingle();

        if (versionError) throw versionError;
        if (version?.config) {
          setConfig({
            ...defaultConfig,
            ...version.config,
            theme: { ...defaultConfig.theme, ...(version.config.theme ?? {}) },
            texts: { ...defaultConfig.texts, ...(version.config.texts ?? {}) },
            buyer_fields: {
              ...defaultConfig.buyer_fields,
              ...(version.config.buyer_fields ?? {}),
            },
            payment_ui: {
              pix: version.config.payment_ui?.pix !== false,
              card: false,
              boleto: false,
            },
            confirmation: {
              ...defaultConfig.confirmation,
              ...(version.config.confirmation ?? {}),
            },
            banners: { ...(version.config.banners ?? {}) },
            support: { ...(version.config.support ?? {}) },
            legal: { ...(version.config.legal ?? {}) },
            sections: Array.isArray(version.config.sections)
              ? version.config.sections
              : defaultConfig.sections,
          });
        }
      }

      const [offerResult, productResult, bumpResult] = await Promise.all([
        (supabase as any)
          .from("ofertas")
          .select("nome,preco")
          .eq("id", checkoutData.oferta_id)
          .eq("empresa_id", user.empresaId)
          .maybeSingle(),
        supabase
          .from("produtos")
          .select("id,nome,preco,status")
          .eq("empresa_id", user.empresaId)
          .eq("status", "publicado")
          .is("deleted_at", null)
          .order("nome"),
        (supabase as any)
          .from("checkout_order_bumps")
          .select("id,produto_id,titulo,descricao,imagem_url,tipo_preco,preco_fixo,desconto_percentual,ordem,ativo,grupo_combinacao,max_selecao_grupo")
          .eq("checkout_id", checkoutId)
          .eq("empresa_id", user.empresaId)
          .is("deleted_at", null)
          .order("ordem"),
      ]);

      if (offerResult.error) throw offerResult.error;
      if (productResult.error) throw productResult.error;
      if (bumpResult.error) throw bumpResult.error;

      setOfferName(offerResult.data?.nome ?? "");
      setOfferPrice(Number(offerResult.data?.preco ?? 0));
      setProducts((productResult.data ?? []) as Product[]);
      setBumps(
        ((bumpResult.data ?? []) as any[]).map((row) => ({
          ...row,
          preco_fixo: row.preco_fixo == null ? null : Number(row.preco_fixo),
          desconto_percentual:
            row.desconto_percentual == null ? null : Number(row.desconto_percentual),
          ordem: Number(row.ordem ?? 0),
          ativo: Boolean(row.ativo),
        })),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar o checkout.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [checkoutId, isAuthLoading, user?.empresaId]);

  async function saveDraft() {
    if (busy || !checkout) return false;
    if (!name.trim()) {
      setError("Informe o nome do checkout.");
      return false;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const safeConfig: DraftConfig = {
        ...config,
        payment_ui: { pix: config.payment_ui.pix, card: false, boleto: false },
      };
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_checkout_salvar_rascunho",
        {
          p_checkout_id: checkout.id,
          p_nome: name.trim(),
          p_descricao: description.trim() || null,
          p_config: safeConfig,
        },
      );
      if (rpcError) throw rpcError;
      if (!data) throw new Error("O banco não confirmou o salvamento.");
      setMessage("Rascunho salvo no banco.");
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar o rascunho.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!checkout) return;
    const saved = await saveDraft();
    if (!saved) return;

    setBusy(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc("fn_checkout_publicar", {
        p_checkout_id: checkout.id,
      });
      if (rpcError) throw rpcError;
      if (!data) throw new Error("A publicação não foi confirmada.");
      setMessage("Checkout publicado com uma nova versão imutável.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível publicar.");
    } finally {
      setBusy(false);
    }
  }

  async function unpublish() {
    if (!checkout) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_checkout_despublicar",
        { p_checkout_id: checkout.id },
      );
      if (rpcError) throw rpcError;
      if (!data) throw new Error("O checkout já estava indisponível.");
      setMessage("Checkout despublicado. A URL pública deixou de aceitar compras.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível despublicar.");
    } finally {
      setBusy(false);
    }
  }

  async function restorePublished() {
    if (!checkout?.publicado_versao_id) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_checkout_restaurar_publicado",
        { p_checkout_id: checkout.id },
      );
      if (rpcError) throw rpcError;
      if (!data) throw new Error("Não foi possível restaurar a versão publicada.");
      setMessage("O rascunho foi restaurado a partir da última versão publicada.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível restaurar.");
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File, target: "logo_url" | "desktop_url" | "mobile_url") {
    if (!empresaId) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      setError("Use JPG, PNG, WEBP ou GIF.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("A imagem deve ter no máximo 8 MB.");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const objectPath = `${empresaId}/checkouts/${checkoutId}/${safeFilename(file)}`;
      const { error: uploadError } = await supabase.storage
        .from("checkout-media")
        .upload(objectPath, file, {
          contentType: file.type,
          cacheControl: "3600",
          upsert: false,
        });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("checkout-media").getPublicUrl(objectPath);
      if (!data.publicUrl) throw new Error("URL da imagem não disponível.");

      if (target === "logo_url") {
        setConfig((current) => ({
          ...current,
          theme: { ...current.theme, logo_url: data.publicUrl },
        }));
      } else {
        setConfig((current) => ({
          ...current,
          banners: { ...current.banners, [target]: data.publicUrl },
        }));
      }
      setMessage("Imagem enviada. Salve o rascunho para persistir o vínculo.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha no upload.");
    } finally {
      setUploading(false);
    }
  }

  async function addBump() {
    if (!products.length || !checkout) {
      setError("Publique pelo menos um produto antes de adicionar order bumps.");
      return;
    }
    const product = products.at(0);
    if (!product) {
      setError("Nenhum produto publicado está disponível.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_checkout_bump_salvar",
        {
          p_checkout_id: checkout.id,
          p_id: null,
          p_produto_id: product.id,
          p_titulo: product.nome,
          p_descricao: null,
          p_imagem_url: null,
          p_texto_oferta: null,
          p_tipo_preco: "produto",
          p_preco_fixo: null,
          p_desconto_percentual: null,
          p_ordem: bumps.length,
          p_ativo: true,
          p_grupo_combinacao: null,
          p_max_selecao_grupo: null,
        },
      );
      if (rpcError) throw rpcError;
      if (!data) throw new Error("O banco não confirmou o order bump.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível adicionar o order bump.");
    } finally {
      setBusy(false);
    }
  }

  async function saveBump(bump: Bump) {
    if (!checkout) return;
    setBusy(true);
    setError(null);
    try {
      const { error: rpcError } = await (supabase as any).rpc("fn_checkout_bump_salvar", {
        p_checkout_id: checkout.id,
        p_id: bump.id,
        p_produto_id: bump.produto_id,
        p_titulo: bump.titulo,
        p_descricao: bump.descricao,
        p_imagem_url: bump.imagem_url,
        p_texto_oferta: null,
        p_tipo_preco: bump.tipo_preco,
        p_preco_fixo: bump.preco_fixo,
        p_desconto_percentual: bump.desconto_percentual,
        p_ordem: bump.ordem,
        p_ativo: bump.ativo,
        p_grupo_combinacao: bump.grupo_combinacao,
        p_max_selecao_grupo: bump.max_selecao_grupo,
      });
      if (rpcError) throw rpcError;
      setMessage("Order bump salvo no rascunho.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar o order bump.");
    } finally {
      setBusy(false);
    }
  }

  async function removeBump(bump: Bump) {
    await saveBump({ ...bump, ativo: false });
  }

  async function copyLink() {
    if (!checkout) return;
    const url = `${publicOrigin}${publicPath}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  const selectedBumpTotal = useMemo(
    () =>
      bumps
        .filter((bump) => bump.ativo)
        .reduce((sum, bump) => {
          const product = products.find((p) => p.id === bump.produto_id);
          if (bump.tipo_preco === "preco_fixo") return sum + Number(bump.preco_fixo ?? 0);
          if (bump.tipo_preco === "desconto_percentual") {
            const base = Number(product?.preco ?? 0);
            return sum + base * (1 - Number(bump.desconto_percentual ?? 0) / 100);
          }
          return sum + Number(product?.preco ?? 0);
        }, 0),
    [bumps, products],
  );

  if (loading) {
    return (
      <div className="grid min-h-[460px] place-items-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando rascunho...
        </div>
      </div>
    );
  }

  if (!checkout) {
    return (
      <div className="p-8">
        <button onClick={onBack} className="text-sm font-medium">Voltar</button>
        <p className="mt-6 text-sm text-destructive">{error ?? "Checkout não encontrado."}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <button onClick={onBack} className="mt-1 grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-muted">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold">Editar checkout</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Oferta: {offerName} · {formatBRL(offerPrice)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {checkout.publicado_versao_id && (
            <button onClick={restorePublished} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50">
              <RefreshCw className="h-4 w-4" /> Restaurar publicado
            </button>
          )}
          <button onClick={() => void saveDraft()} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50">
            <Save className="h-4 w-4" /> Salvar rascunho
          </button>
          {checkout.status === "publicado" ? (
            <button onClick={unpublish} disabled={busy} className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-50">
              Despublicar
            </button>
          ) : (
            <button onClick={publish} disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              Publicar
            </button>
          )}
        </div>
      </div>

      {error && <div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}
      {message && <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700">{message}</div>}

      {checkout.status === "publicado" && (
        <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
          <Eye className="h-4 w-4 text-primary" />
          <code className="min-w-0 flex-1 truncate text-xs">{publicOrigin}{publicPath}</code>
          <button onClick={() => void copyLink()} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copiado" : "Copiar"}
          </button>
          <a href={publicPath} target="_blank" rel="noreferrer" className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">
            Abrir
          </a>
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[440px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <section className="space-y-4 rounded-xl border border-border bg-card p-5">
            <h2 className="font-semibold">Conteúdo</h2>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Nome interno</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Descrição interna</span>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Título público</span>
              <input value={config.texts.title} onChange={(e) => setConfig({ ...config, texts: { ...config.texts, title: e.target.value } })} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Subtítulo</span>
              <textarea value={config.texts.subtitle} onChange={(e) => setConfig({ ...config, texts: { ...config.texts, subtitle: e.target.value } })} rows={2} className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Texto do botão</span>
              <input value={config.texts.pay_button} onChange={(e) => setConfig({ ...config, texts: { ...config.texts, pay_button: e.target.value } })} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" />
            </label>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-semibold">Identidade visual</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {([
                ["primary", "Cor principal"],
                ["background", "Fundo"],
                ["text", "Texto"],
                ["secondary", "Secundária"],
              ] as const).map(([key, label]) => (
                <label key={key}>
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <div className="mt-1.5 flex gap-2">
                    <input type="color" value={(config.theme as any)[key]} onChange={(e) => setConfig({ ...config, theme: { ...config.theme, [key]: e.target.value } })} className="h-9 w-10 rounded border border-border bg-background p-1" />
                    <input value={(config.theme as any)[key]} onChange={(e) => setConfig({ ...config, theme: { ...config.theme, [key]: e.target.value } })} className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 text-xs" />
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {([
                ["logo_url", "Logo"],
                ["desktop_url", "Banner desktop"],
                ["mobile_url", "Banner mobile"],
              ] as const).map(([target, label]) => (
                <label key={target} className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border px-2 py-2 text-[11px] font-medium hover:bg-muted">
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
                  {label}
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" disabled={uploading} onChange={(e) => {
                    const file=e.target.files?.[0];
                    if(file) void upload(file,target as "logo_url"|"desktop_url"|"mobile_url");
                    e.currentTarget.value="";
                  }} />
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-semibold">Dados do comprador</h2>
            <div className="mt-3 space-y-2">
              {([
                ["cpf", "CPF"],
                ["phone", "Telefone"],
                ["address", "Endereço"],
              ] as const).map(([key,label]) => (
                <label key={key} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  {label}
                  <input type="checkbox" checked={Boolean((config.buyer_fields as any)[key])} onChange={(e) => setConfig({ ...config, buyer_fields: { ...config.buyer_fields, [key]: e.target.checked } })} />
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Order bumps</h2>
                <p className="text-xs text-muted-foreground">Sem limite comercial fixo.</p>
              </div>
              <button onClick={() => void addBump()} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted">
                <Plus className="h-3.5 w-3.5" /> Adicionar
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {bumps.map((bump,index) => (
                <div key={bump.id} className={cn("rounded-xl border p-3", bump.ativo ? "border-border" : "border-border/60 opacity-60")}>
                  <div className="flex items-start gap-2">
                    <select value={bump.produto_id} onChange={(e) => setBumps((items) => items.map((item) => item.id===bump.id ? { ...item, produto_id:e.target.value } : item))} className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 text-xs">
                      {products.map((product) => <option key={product.id} value={product.id}>{product.nome}</option>)}
                    </select>
                    <button onClick={() => void removeBump(bump)} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <input value={bump.titulo ?? ""} onChange={(e) => setBumps((items) => items.map((item) => item.id===bump.id ? { ...item,titulo:e.target.value } : item))} placeholder="Título" className="mt-2 h-9 w-full rounded-lg border border-border bg-background px-2 text-xs" />
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <select value={bump.tipo_preco} onChange={(e) => setBumps((items) => items.map((item) => item.id===bump.id ? { ...item,tipo_preco:e.target.value as Bump["tipo_preco"] } : item))} className="h-9 rounded-lg border border-border bg-background px-2 text-xs">
                      <option value="produto">Preço do produto</option>
                      <option value="preco_fixo">Preço fixo</option>
                      <option value="desconto_percentual">Desconto %</option>
                    </select>
                    {bump.tipo_preco==="preco_fixo" ? (
                      <input type="number" min="0" step="0.01" value={bump.preco_fixo ?? 0} onChange={(e) => setBumps((items) => items.map((item) => item.id===bump.id ? { ...item,preco_fixo:Number(e.target.value) } : item))} className="h-9 rounded-lg border border-border bg-background px-2 text-xs" />
                    ) : bump.tipo_preco==="desconto_percentual" ? (
                      <input type="number" min="0" max="100" value={bump.desconto_percentual ?? 0} onChange={(e) => setBumps((items) => items.map((item) => item.id===bump.id ? { ...item,desconto_percentual:Number(e.target.value) } : item))} className="h-9 rounded-lg border border-border bg-background px-2 text-xs" />
                    ) : (
                      <div className="grid h-9 place-items-center rounded-lg border border-border bg-muted/30 text-xs text-muted-foreground">
                        {formatBRL(products.find((p)=>p.id===bump.produto_id)?.preco ?? 0)}
                      </div>
                    )}
                  </div>
                  <button onClick={() => void saveBump({ ...bump,ordem:index })} className="mt-2 w-full rounded-lg border border-border py-1.5 text-xs font-medium hover:bg-muted">
                    Salvar adicional
                  </button>
                </div>
              ))}
              {bumps.length===0 && <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">Nenhum adicional no rascunho.</div>}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-semibold">Pós-compra e legal</h2>
            <div className="mt-3 space-y-3">
              <input value={config.confirmation.redirect_url ?? ""} onChange={(e) => setConfig({ ...config,confirmation:{ redirect_url:e.target.value || null }})} placeholder="URL segura após confirmação (https://...)" className="h-10 w-full rounded-lg border border-border bg-background px-3 text-xs" />
              <input value={config.legal.terms_url ?? ""} onChange={(e) => setConfig({ ...config,legal:{ ...config.legal,terms_url:e.target.value || null }})} placeholder="URL dos termos" className="h-10 w-full rounded-lg border border-border bg-background px-3 text-xs" />
              <input value={config.legal.privacy_url ?? ""} onChange={(e) => setConfig({ ...config,legal:{ ...config.legal,privacy_url:e.target.value || null }})} placeholder="URL da privacidade" className="h-10 w-full rounded-lg border border-border bg-background px-3 text-xs" />
            </div>
          </section>
        </aside>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Prévia do rascunho</h2>
              <p className="text-xs text-muted-foreground">A prévia não altera a versão publicada.</p>
            </div>
            <div className="flex rounded-lg border border-border p-1">
              <button onClick={() => setPreviewMode("desktop")} className={cn("rounded-md p-2",previewMode==="desktop"&&"bg-muted")}><Monitor className="h-4 w-4" /></button>
              <button onClick={() => setPreviewMode("mobile")} className={cn("rounded-md p-2",previewMode==="mobile"&&"bg-muted")}><Smartphone className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="min-h-[760px] rounded-2xl border border-border bg-muted/30 p-4 sm:p-8">
            <div className={cn("mx-auto overflow-hidden rounded-2xl border shadow-xl transition-all",previewMode==="mobile"?"max-w-[390px]":"max-w-[920px]")}>
              <div style={{ background:config.theme.background,color:config.theme.text,fontFamily:config.theme.font }} className="min-h-[680px]">
                {config.banners.desktop_url && previewMode==="desktop" && <img src={config.banners.desktop_url} alt={config.banners.alt ?? ""} className="h-40 w-full object-cover" />}
                {config.banners.mobile_url && previewMode==="mobile" && <img src={config.banners.mobile_url} alt={config.banners.alt ?? ""} className="h-40 w-full object-cover" />}
                <div className="p-6">
                  {config.theme.logo_url && <img src={config.theme.logo_url} alt="Logo" className="mb-5 max-h-10 max-w-[180px] object-contain" />}
                  <h3 className="text-2xl font-semibold">{config.texts.title}</h3>
                  <p className="mt-2 text-sm opacity-65">{config.texts.subtitle || description}</p>
                  <div className="mt-6 rounded-xl border border-white/10 bg-black/10 p-4">
                    <div className="flex justify-between gap-3"><span>{offerName}</span><strong>{formatBRL(offerPrice)}</strong></div>
                  </div>
                  {bumps.filter((b)=>b.ativo).map((bump) => (
                    <div key={bump.id} className="mt-3 rounded-xl border border-white/15 p-3 text-sm">
                      <div className="flex justify-between gap-3"><span>{bump.titulo || "Adicional"}</span><span>+</span></div>
                    </div>
                  ))}
                  <div className="mt-5 space-y-2">
                    <div className="h-10 rounded-lg border border-white/15 bg-black/10 px-3 text-sm leading-10 opacity-60">Nome completo</div>
                    <div className="h-10 rounded-lg border border-white/15 bg-black/10 px-3 text-sm leading-10 opacity-60">E-mail</div>
                    {config.buyer_fields.cpf && <div className="h-10 rounded-lg border border-white/15 bg-black/10 px-3 text-sm leading-10 opacity-60">CPF</div>}
                    {config.buyer_fields.phone && <div className="h-10 rounded-lg border border-white/15 bg-black/10 px-3 text-sm leading-10 opacity-60">Telefone</div>}
                  </div>
                  <div className="mt-5 rounded-xl border border-white/15 p-4">
                    <p className="text-sm font-medium">Pix</p>
                    <p className="mt-1 text-xs opacity-55">Cartão e boleto: em breve</p>
                  </div>
                  <button style={{ background:config.theme.primary }} className="mt-5 h-12 w-full rounded-xl font-semibold text-white">{config.texts.pay_button} · {formatBRL(offerPrice)}</button>
                  <p className="mt-3 text-center text-[11px] opacity-45">
                    Valor final real é recalculado no servidor. Adicionais estimados no rascunho: {formatBRL(selectedBumpTotal)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
