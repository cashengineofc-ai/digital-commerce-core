import { useEffect, useState } from "react";
import { Building2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type CompanyForm = {
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  ie: string;
  email: string;
  telefone: string;
  segmento: string;
  site: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  timezone: string;
};

const emptyForm: CompanyForm = {
  razao_social: "",
  nome_fantasia: "",
  cnpj: "",
  ie: "",
  email: "",
  telefone: "",
  segmento: "",
  site: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
  cep: "",
  timezone: "America/Sao_Paulo",
};

export function CompanyPage() {
  const [form, setForm] = useState<CompanyForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: rpcError } = await (supabase as any).rpc(
          "fn_empresa_config_obter",
        );
        if (rpcError) throw rpcError;
        if (!active) return;

        setForm({
          razao_social: String(data?.razao_social ?? ""),
          nome_fantasia: String(data?.nome_fantasia ?? ""),
          cnpj: String(data?.cnpj ?? ""),
          ie: String(data?.ie ?? ""),
          email: String(data?.email ?? ""),
          telefone: String(data?.telefone ?? ""),
          segmento: String(data?.segmento ?? ""),
          site: String(data?.site ?? ""),
          logradouro: String(data?.logradouro ?? ""),
          numero: String(data?.numero ?? ""),
          complemento: String(data?.complemento ?? ""),
          bairro: String(data?.bairro ?? ""),
          cidade: String(data?.cidade ?? ""),
          estado: String(data?.estado ?? ""),
          cep: String(data?.cep ?? ""),
          timezone: String(data?.timezone ?? "America/Sao_Paulo"),
        });
      } catch (cause) {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Não foi possível carregar a empresa.",
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

  function update<K extends keyof CompanyForm>(
    key: K,
    value: CompanyForm[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    if (!form.nome_fantasia.trim()) {
      setError("Informe o nome fantasia.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_empresa_config_atualizar",
        {
          p_razao_social: form.razao_social || null,
          p_nome_fantasia: form.nome_fantasia.trim(),
          p_cnpj: form.cnpj || null,
          p_ie: form.ie || null,
          p_email: form.email || null,
          p_telefone: form.telefone || null,
          p_segmento: form.segmento || null,
          p_site: form.site || null,
          p_logradouro: form.logradouro || null,
          p_numero: form.numero || null,
          p_complemento: form.complemento || null,
          p_bairro: form.bairro || null,
          p_cidade: form.cidade || null,
          p_estado: form.estado || null,
          p_cep: form.cep || null,
          p_timezone: form.timezone,
        },
      );
      if (rpcError) throw rpcError;
      if (!data) throw new Error("O banco não confirmou a atualização.");
      setMessage("Dados da empresa salvos no banco.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar a empresa.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Empresa</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dados cadastrais da empresa atualmente selecionada.
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
          Carregando empresa...
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                <Building2 className="h-4 w-4" />
              </span>
              <div>
                <h2 className="font-semibold">Identificação</h2>
                <p className="text-xs text-muted-foreground">
                  Alterações exigem permissão real da empresa.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Razão social" wide>
                <input
                  value={form.razao_social}
                  onChange={(e) => update("razao_social", e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </Field>
              <Field label="Nome fantasia">
                <input
                  value={form.nome_fantasia}
                  onChange={(e) => update("nome_fantasia", e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </Field>
              <Field label="CNPJ">
                <input
                  value={form.cnpj}
                  onChange={(e) => update("cnpj", e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </Field>
              <Field label="Inscrição estadual">
                <input
                  value={form.ie}
                  onChange={(e) => update("ie", e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </Field>
              <Field label="E-mail fiscal">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </Field>
              <Field label="Telefone">
                <input
                  value={form.telefone}
                  onChange={(e) => update("telefone", e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </Field>
              <Field label="Segmento">
                <input
                  value={form.segmento}
                  onChange={(e) => update("segmento", e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </Field>
              <Field label="Website">
                <input
                  type="url"
                  value={form.site}
                  onChange={(e) => update("site", e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </Field>
              <Field label="Fuso operacional">
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
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <h2 className="font-semibold">Endereço</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Rua">
                <input
                  value={form.logradouro}
                  onChange={(e) => update("logradouro", e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Número">
                  <input
                    value={form.numero}
                    onChange={(e) => update("numero", e.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  />
                </Field>
                <Field label="Complemento">
                  <input
                    value={form.complemento}
                    onChange={(e) => update("complemento", e.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  />
                </Field>
              </div>
              <Field label="Bairro">
                <input
                  value={form.bairro}
                  onChange={(e) => update("bairro", e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Cidade">
                  <input
                    value={form.cidade}
                    onChange={(e) => update("cidade", e.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  />
                </Field>
                <Field label="UF">
                  <input
                    maxLength={2}
                    value={form.estado}
                    onChange={(e) => update("estado", e.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm uppercase"
                  />
                </Field>
              </div>
              <Field label="CEP">
                <input
                  value={form.cep}
                  onChange={(e) => update("cep", e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </Field>
            </div>
          </section>

          <div className="flex justify-end">
            <button
              onClick={() => void save()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Salvando..." : "Salvar dados da empresa"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  wide = false,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={wide ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
      <span className="text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}
