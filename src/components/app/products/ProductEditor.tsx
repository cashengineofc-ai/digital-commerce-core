import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Archive,
  ImagePlus,
  Loader2,
  Save,
  UploadCloud,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTempAuth } from "@/lib/auth-temp";
import { formatBRL } from "@/lib/format";

type ProductStatus = "rascunho" | "publicado" | "arquivado" | "indisponivel";

type Category = {
  id: string;
  nome: string;
};

type ProductForm = {
  nome: string;
  descricao: string;
  categoria_id: string;
  preco: string;
  status: ProductStatus;
  imagem_url: string;
  galeria_urls: string[];
};

const EMPTY_FORM: ProductForm = {
  nome: "",
  descricao: "",
  categoria_id: "",
  preco: "0,00",
  status: "rascunho",
  imagem_url: "",
  galeria_urls: [],
};

function parseMoney(value: string) {
  const normalized = value
    .trim()
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : NaN;
}

function safeFilename(name: string) {
  const extension = name.includes(".") ? name.split(".").pop()?.toLowerCase() : "jpg";
  return `${crypto.randomUUID()}.${extension || "jpg"}`;
}

export function ProductEditor({
  productId,
  onBack,
  onSaved,
}: {
  productId: string | null;
  onBack: () => void;
  onSaved: (id: string) => void;
}) {
  const { user, isLoading: isAuthLoading } = useTempAuth();
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [categories, setCategories] = useState<Category[]>([]);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(productId));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(productId);
  const idempotencyKey = useRef(crypto.randomUUID());

  useEffect(() => {
    let active = true;

    async function load() {
      setError(null);
      try {
        if (isAuthLoading) return;
        if (!user?.empresaId) {
          throw new Error("Sua conta não possui uma empresa ativa.");
        }
        if (!active) return;
        setEmpresaId(user.empresaId);

        const categoryQuery = await supabase
          .from("categorias_produtos")
          .select("id,nome")
          .eq("empresa_id", user.empresaId)
          .eq("ativa", true)
          .is("deleted_at", null)
          .order("nome");

        if (categoryQuery.error) throw categoryQuery.error;
        if (active) setCategories((categoryQuery.data ?? []) as Category[]);

        if (productId) {
          const { data, error: productError } = await supabase
            .from("produtos")
            .select(
              "id,nome,descricao_curta,categoria_id,preco,status,imagem_principal_url,galeria_urls",
            )
            .eq("id", productId)
            .eq("empresa_id", user.empresaId)
            .is("deleted_at", null)
            .maybeSingle();

          if (productError) throw productError;
          if (!data) throw new Error("Produto não encontrado ou sem permissão de acesso.");
          if (!active) return;

          setForm({
            nome: data.nome ?? "",
            descricao: data.descricao_curta ?? "",
            categoria_id: data.categoria_id ?? "",
            preco: Number(data.preco ?? 0).toFixed(2).replace(".", ","),
            status: data.status as ProductStatus,
            imagem_url: data.imagem_principal_url ?? "",
            galeria_urls: Array.isArray(data.galeria_urls) ? data.galeria_urls : [],
          });
        }
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Não foi possível carregar o produto.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [isAuthLoading, productId, user?.empresaId]);

  async function uploadImage(file: File, gallery = false) {
    if (!empresaId) {
      setError("Empresa não identificada.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      setError("Envie uma imagem JPG, PNG, WEBP ou GIF.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("A imagem deve ter no máximo 5 MB.");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const path = `${empresaId}/products/${safeFilename(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from("product-media")
        .upload(path, file, {
          contentType: file.type,
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("product-media").getPublicUrl(path);
      if (!data.publicUrl) throw new Error("Não foi possível obter a URL da imagem.");

      setForm((current) =>
        gallery
          ? {
              ...current,
              galeria_urls: [...current.galeria_urls, data.publicUrl].slice(0, 12),
            }
          : { ...current, imagem_url: data.publicUrl },
      );
      setSuccess("Imagem enviada e persistida.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao enviar a imagem.");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (saving) return;
    const price = parseMoney(form.preco);
    if (!form.nome.trim()) {
      setError("Informe o nome do produto.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setError("Informe um preço válido.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { data, error: rpcError } = await (supabase as any).rpc("fn_produto_salvar", {
        p_id: currentId,
        p_nome: form.nome.trim(),
        p_descricao: form.descricao.trim() || null,
        p_categoria_id: form.categoria_id || null,
        p_imagem_url: form.imagem_url || null,
        p_galeria_urls: form.galeria_urls,
        p_status: form.status,
        p_preco: price,
        p_idempotency_key: currentId ? null : idempotencyKey.current,
      });

      if (rpcError) throw rpcError;
      const savedId = String(data ?? "");
      if (!savedId) throw new Error("O banco não retornou o identificador do produto.");

      setCurrentId(savedId);
      setSuccess(
        currentId
          ? "Alterações confirmadas pelo banco."
          : "Produto criado e confirmado pelo banco. Nenhum checkout foi publicado automaticamente.",
      );
      onSaved(savedId);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar. Os dados preenchidos foram mantidos.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    if (!currentId || saving) return;
    if (!window.confirm("Arquivar este produto? O histórico de vendas será preservado.")) return;

    setSaving(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc("fn_produto_arquivar", {
        p_produto_id: currentId,
      });
      if (rpcError) throw rpcError;
      if (!data) throw new Error("O produto não pôde ser arquivado.");
      setForm((current) => ({ ...current, status: "arquivado" }));
      setSuccess("Produto arquivado. O histórico de vendas foi mantido.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível arquivar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-[420px] place-items-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando produto...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {currentId ? "Editar produto" : "Novo produto"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              O produto é independente de oferta, checkout e link de pagamento.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {currentId && form.status !== "arquivado" && (
            <button
              onClick={archive}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              <Archive className="h-4 w-4" /> Arquivar
            </button>
          )}
          <button
            onClick={save}
            disabled={saving || uploading}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar produto
          </button>
        </div>
      </header>

      {error && (
        <div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_320px]">
        <section className="space-y-5 rounded-xl border border-border bg-card p-5 shadow-sm">
          <label className="block">
            <span className="text-sm font-medium text-foreground">Nome *</span>
            <input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              maxLength={220}
              className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary/60"
              placeholder="Nome do produto"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-foreground">Descrição</span>
            <textarea
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              rows={5}
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/60"
              placeholder="Explique o que o cliente está comprando."
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label>
              <span className="text-sm font-medium text-foreground">Preço</span>
              <input
                inputMode="decimal"
                value={form.preco}
                onChange={(e) => setForm({ ...form, preco: e.target.value })}
                className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary/60"
              />
              <span className="mt-1 block text-[11px] text-muted-foreground">
                Atual: {formatBRL(Number.isFinite(parseMoney(form.preco)) ? parseMoney(form.preco) : 0)}
              </span>
            </label>

            <label>
              <span className="text-sm font-medium text-foreground">Categoria</span>
              <select
                value={form.categoria_id}
                onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}
                className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary/60"
              >
                <option value="">Sem categoria</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.nome}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="text-sm font-medium text-foreground">Situação</span>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as ProductStatus })}
                className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary/60"
              >
                <option value="rascunho">Rascunho</option>
                <option value="publicado">Publicado</option>
                <option value="indisponivel">Indisponível</option>
                <option value="arquivado">Arquivado</option>
              </select>
            </label>
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground">Imagem principal</h2>
            {form.imagem_url ? (
              <div className="mt-3">
                <img
                  src={form.imagem_url}
                  alt=""
                  className="aspect-square w-full rounded-xl border border-border object-cover"
                />
                <button
                  onClick={() => setForm({ ...form, imagem_url: "" })}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" /> Remover do cadastro
                </button>
              </div>
            ) : (
              <div className="mt-3 grid aspect-square place-items-center rounded-xl border border-dashed border-border bg-muted/30">
                <ImagePlus className="h-7 w-7 text-muted-foreground" />
              </div>
            )}
            <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              Enviar imagem
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadImage(file, false);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          </section>

          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground">Galeria</h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {form.galeria_urls.map((url) => (
                <div key={url} className="group relative">
                  <img src={url} alt="" className="aspect-square w-full rounded-lg object-cover" />
                  <button
                    onClick={() =>
                      setForm({
                        ...form,
                        galeria_urls: form.galeria_urls.filter((item) => item !== url),
                      })
                    }
                    className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-md bg-black/70 text-white opacity-0 group-hover:opacity-100"
                    aria-label="Remover da galeria"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted">
              <ImagePlus className="h-4 w-4" /> Adicionar imagem
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                disabled={uploading || form.galeria_urls.length >= 12}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadImage(file, true);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          </section>
        </aside>
      </div>
    </div>
  );
}
