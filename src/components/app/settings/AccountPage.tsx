import { useEffect, useState } from "react";
import { Camera, KeyRound, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type AccountForm = {
  name: string;
  email: string;
  phone: string;
  avatar_url: string;
  language: string;
  timezone: string;
  currency: string;
};

export function AccountPage() {
  const [form, setForm] = useState<AccountForm>({
    name: "",
    email: "",
    phone: "",
    avatar_url: "",
    language: "pt-BR",
    timezone: "America/Sao_Paulo",
    currency: "BRL",
  });
  const [originalEmail, setOriginalEmail] = useState("");
  const [password, setPassword] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: rpcError } = await (supabase as any).rpc(
          "fn_conta_obter",
        );
        if (rpcError) throw rpcError;
        if (!active) return;

        const next = {
          name: String(data?.name ?? ""),
          email: String(data?.email ?? ""),
          phone: String(data?.phone ?? ""),
          avatar_url: String(data?.avatar_url ?? ""),
          language: String(data?.language ?? "pt-BR"),
          timezone: String(data?.timezone ?? "America/Sao_Paulo"),
          currency: String(data?.currency ?? "BRL"),
        };
        setForm(next);
        setOriginalEmail(next.email);
      } catch (cause) {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Não foi possível carregar a conta.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  function update<K extends keyof AccountForm>(
    key: K,
    value: AccountForm[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function uploadAvatar(file: File) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Use uma imagem JPG, PNG ou WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("A imagem deve ter no máximo 5 MB.");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Sessão não encontrada.");

      const extension =
        file.type === "image/png"
          ? "png"
          : file.type === "image/webp"
            ? "webp"
            : "jpg";
      const objectPath = `${auth.user.id}/avatar-${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(objectPath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(objectPath);
      update("avatar_url", data.publicUrl);
      setMessage("Avatar enviado. Salve as alterações para vinculá-lo à conta.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível enviar o avatar.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!form.name.trim()) {
      setError("Informe seu nome.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_conta_atualizar",
        {
          p_nome: form.name.trim(),
          p_telefone: form.phone.trim() || null,
          p_avatar_url: form.avatar_url || null,
          p_idioma: form.language,
          p_timezone: form.timezone,
          p_currency: form.currency,
        },
      );
      if (rpcError) throw rpcError;
      if (!data) throw new Error("O banco não confirmou a atualização.");

      if (
        form.email.trim().toLowerCase() !==
        originalEmail.trim().toLowerCase()
      ) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: form.email.trim().toLowerCase(),
        });
        if (emailError) throw emailError;
        setMessage(
          "Dados salvos. A alteração de e-mail seguirá o fluxo de confirmação do provedor de autenticação.",
        );
      } else {
        setMessage("Dados da conta salvos no banco.");
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível salvar a conta.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    if (
      !password.current ||
      password.next.length < 8 ||
      password.next !== password.confirm
    ) {
      setError(
        "Informe a senha atual e use uma nova senha de pelo menos 8 caracteres, com confirmação igual.",
      );
      return;
    }

    setChangingPassword(true);
    setError(null);
    setMessage(null);
    try {
      const { data: auth, error: userError } = await supabase.auth.getUser();
      if (userError || !auth.user?.email) {
        throw new Error("Não foi possível confirmar a conta atual.");
      }

      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: auth.user.email,
        password: password.current,
      });
      if (verifyError) throw new Error("Senha atual inválida.");

      const { error: updateError } = await supabase.auth.updateUser({
        password: password.next,
      });
      if (updateError) throw updateError;

      setPassword({ current: "", next: "", confirm: "" });
      setMessage("Senha alterada pelo provedor de autenticação.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível alterar a senha.",
      );
    } finally {
      setChangingPassword(false);
    }
  }

  const initial = form.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Conta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dados pessoais e credenciais da conta autenticada.
        </p>
      </header>

      {error && (
        <div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {message && (
        <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      )}

      {loading ? (
        <div className="mt-6 rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          Carregando conta...
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-4">
              {form.avatar_url ? (
                <img
                  src={form.avatar_url}
                  alt=""
                  className="h-16 w-16 rounded-2xl object-cover"
                />
              ) : (
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary text-2xl font-semibold text-primary-foreground">
                  {initial}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{form.name || "Sua conta"}</p>
                <p className="text-xs text-muted-foreground">{form.email}</p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted">
                <Camera className="h-4 w-4" />
                {uploading ? "Enviando..." : "Alterar avatar"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={uploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadAvatar(file);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Nome completo">
                <input
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </Field>
              <Field label="E-mail">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </Field>
              <Field label="Telefone">
                <input
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </Field>
              <Field label="Idioma">
                <select
                  value={form.language}
                  onChange={(e) => update("language", e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                >
                  <option value="pt-BR">Português (Brasil)</option>
                  <option value="en-US">English (US)</option>
                  <option value="es-ES">Español</option>
                </select>
              </Field>
              <Field label="Fuso horário">
                <select
                  value={form.timezone}
                  onChange={(e) => update("timezone", e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                >
                  <option value="America/Sao_Paulo">America/Sao_Paulo</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="Europe/Lisbon">Europe/Lisbon</option>
                </select>
              </Field>
              <Field label="Moeda de exibição">
                <select
                  value={form.currency}
                  onChange={(e) => update("currency", e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                >
                  <option value="BRL">BRL · Real brasileiro</option>
                  <option value="USD">USD · Dólar</option>
                  <option value="EUR">EUR · Euro</option>
                </select>
              </Field>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => void save()}
                disabled={saving || uploading}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? "Salvando..." : "Salvar dados"}
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Alterar senha</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              A senha atual é validada pelo provedor antes da troca.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <PasswordInput
                label="Senha atual"
                value={password.current}
                onChange={(value) =>
                  setPassword((current) => ({ ...current, current: value }))
                }
              />
              <PasswordInput
                label="Nova senha"
                value={password.next}
                onChange={(value) =>
                  setPassword((current) => ({ ...current, next: value }))
                }
              />
              <PasswordInput
                label="Confirmar nova senha"
                value={password.confirm}
                onChange={(value) =>
                  setPassword((current) => ({ ...current, confirm: value }))
                }
              />
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => void changePassword()}
                disabled={changingPassword}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                {changingPassword ? "Alterando..." : "Alterar senha"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}

function PasswordInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-medium">{label}</span>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="••••••••"
        className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
      />
    </label>
  );
}
