import { useCallback, useEffect, useState } from "react";
import {
  Copy,
  KeyRound,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/format";
import { EmptyState } from "@/components/app/EmptyState";
import { cn } from "@/lib/utils";

type ApiKeyRow = {
  id: string;
  empresa_id: string;
  empresa_nome: string;
  nome: string;
  chave_prefixo: string;
  tipo_chave: string;
  escopos: string[];
  data_criacao: string;
  data_ultimo_uso: string | null;
  data_expiracao: string | null;
  total_requisicoes: number;
  ativa: boolean;
  revogada_em: string | null;
};

type Company = {
  id: string;
  nome_fantasia: string | null;
  razao_social: string | null;
};

const scopeOptions = [
  "payments:read",
  "orders:read",
  "products:read",
  "affiliates:read",
  "reports:read",
  "webhooks:manage",
] as const;

export function ApiPage() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [shownSecret, setShownSecret] = useState<string | null>(null);
  const [shownPrefix, setShownPrefix] = useState("");
  const [form, setForm] = useState({
    empresa_id: "",
    nome: "",
    tipo: "teste",
    scopes: ["orders:read", "products:read"] as string[],
    expira_em: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [keyResult, companyResult] = await Promise.all([
        (supabase as any).rpc("fn_dev_api_keys_list"),
        supabase
          .from("empresas")
          .select("id,nome_fantasia,razao_social")
          .is("deleted_at", null)
          .order("nome_fantasia"),
      ]);

      if (keyResult.error) throw keyResult.error;
      if (companyResult.error) throw companyResult.error;

      setKeys(
        ((keyResult.data ?? []) as any[]).map((row) => ({
          id: String(row.id),
          empresa_id: String(row.empresa_id),
          empresa_nome: String(row.empresa_nome ?? "Empresa"),
          nome: String(row.nome ?? "Chave"),
          chave_prefixo: String(row.chave_prefixo ?? ""),
          tipo_chave: String(row.tipo_chave ?? "teste"),
          escopos: Array.isArray(row.escopos)
            ? row.escopos.map(String)
            : [],
          data_criacao: String(row.data_criacao),
          data_ultimo_uso: row.data_ultimo_uso
            ? String(row.data_ultimo_uso)
            : null,
          data_expiracao: row.data_expiracao
            ? String(row.data_expiracao)
            : null,
          total_requisicoes: Number(row.total_requisicoes ?? 0),
          ativa: Boolean(row.ativa),
          revogada_em: row.revogada_em ? String(row.revogada_em) : null,
        })),
      );
      setCompanies((companyResult.data ?? []) as Company[]);
    } catch (cause) {
      setKeys([]);
      setCompanies([]);
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar as chaves de API.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    const company = companies.at(0);
    setForm({
      empresa_id: company?.id ?? "",
      nome: "",
      tipo: "teste",
      scopes: ["orders:read", "products:read"],
      expira_em: "",
    });
    setShownSecret(null);
    setShownPrefix("");
    setError(null);
    setMessage(null);
    setCreateOpen(true);
  }

  function toggleScope(scope: string) {
    setForm((current) => ({
      ...current,
      scopes: current.scopes.includes(scope)
        ? current.scopes.filter((item) => item !== scope)
        : [...current.scopes, scope],
    }));
  }

  async function createKey() {
    if (!form.empresa_id || !form.nome.trim() || form.scopes.length === 0) {
      setError("Informe empresa, nome e pelo menos um escopo.");
      return;
    }

    setActing(true);
    setError(null);
    try {
      const expiration = form.expira_em
        ? new Date(`${form.expira_em}T23:59:59`).toISOString()
        : null;
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_dev_api_key_create",
        {
          p_empresa_id: form.empresa_id,
          p_nome: form.nome.trim(),
          p_tipo: form.tipo,
          p_escopos: form.scopes,
          p_expira_em: expiration,
        },
      );
      if (rpcError) throw rpcError;

      const secret = String(data?.secret ?? "");
      if (!secret) {
        throw new Error("A chave foi criada, mas o segredo não foi retornado.");
      }

      setShownSecret(secret);
      setShownPrefix(String(data?.prefix ?? ""));
      setMessage(
        "Copie a chave agora. Depois que esta janela for fechada, o segredo não poderá ser recuperado.",
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível criar a chave.",
      );
    } finally {
      setActing(false);
    }
  }

  async function rotateKey(id: string) {
    if (
      !window.confirm(
        "Rotacionar esta chave? A chave atual será revogada imediatamente.",
      )
    ) {
      return;
    }

    setActing(true);
    setError(null);
    setMessage(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_dev_api_key_rotate",
        { p_key_id: id },
      );
      if (rpcError) throw rpcError;
      const secret = String(data?.secret ?? "");
      if (!secret) throw new Error("A nova chave não foi retornada.");

      setShownSecret(secret);
      setShownPrefix(String(data?.prefix ?? ""));
      setCreateOpen(true);
      setMessage(
        "Rotação concluída. A chave anterior foi revogada; copie a nova chave agora.",
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível rotacionar.",
      );
    } finally {
      setActing(false);
    }
  }

  async function revokeKey(id: string) {
    if (!window.confirm("Revogar esta chave de API?")) return;
    setActing(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_dev_api_key_revoke",
        {
          p_key_id: id,
          p_motivo: "Revogada pelo Admin Global na interface",
        },
      );
      if (rpcError) throw rpcError;
      if (!data) throw new Error("A chave já estava inativa.");
      setMessage("Chave revogada.");
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível revogar.",
      );
    } finally {
      setActing(false);
    }
  }

  async function copySecret() {
    if (!shownSecret) return;
    await navigator.clipboard.writeText(shownSecret);
    setMessage("Chave copiada. Guarde-a em armazenamento seguro.");
  }

  function closeModal() {
    setShownSecret(null);
    setShownPrefix("");
    setCreateOpen(false);
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">API</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Chaves com escopo, revogação e hash persistido. Acesso exclusivo do Admin Global.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void load()}
            disabled={loading || acting}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Atualizar
          </button>
          <button
            onClick={openCreate}
            disabled={companies.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Nova chave
          </button>
        </div>
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

      <div className="mt-5 flex items-start gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
        O banco armazena apenas SHA-256 da chave de API. Chaves existentes nunca podem ser reveladas novamente. Segredos de provedores de pagamento não fazem parte desta tela.
      </div>

      <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Carregando chaves...
          </div>
        ) : keys.length === 0 ? (
          <EmptyState
            icon={KeyRound}
            title="Nenhuma chave de API"
            description="Crie uma chave somente quando houver uma integração que precise dela."
          />
        ) : (
          <div className="divide-y divide-border">
            {keys.map((key) => (
              <div key={key.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{key.nome}</h2>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] capitalize text-muted-foreground">
                        {key.tipo_chave}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-medium",
                          key.ativa
                            ? "bg-emerald-500/10 text-emerald-700"
                            : "bg-destructive/10 text-destructive",
                        )}
                      >
                        {key.ativa ? "Ativa" : "Revogada"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {key.empresa_nome}
                    </p>
                    <code className="mt-3 block rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-xs">
                      {key.chave_prefixo}••••••••••••••••
                    </code>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {key.escopos.map((scope) => (
                        <span
                          key={scope}
                          className="rounded-md border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground"
                        >
                          {scope}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Criada {formatDateTime(key.data_criacao)}
                      {key.data_ultimo_uso
                        ? ` · último uso ${formatDateTime(key.data_ultimo_uso)}`
                        : " · nunca usada"}
                      {key.data_expiracao
                        ? ` · expira ${formatDateTime(key.data_expiracao)}`
                        : " · sem expiração"}
                    </p>
                  </div>

                  {key.ativa && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => void rotateKey(key.id)}
                        disabled={acting}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Rotacionar
                      </button>
                      <button
                        onClick={() => void revokeKey(key.id)}
                        disabled={acting}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-2 text-xs font-medium text-destructive disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Revogar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
        A autenticação por chave está preparada no banco para validação server-side por escopo. Esta tela não afirma que um endpoint externo específico existe enquanto ele não tiver sido implementado e publicado no backend.
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  {shownSecret ? "Segredo da chave" : "Nova chave de API"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {shownSecret
                    ? "Esta é a única vez em que o segredo será exibido."
                    : "Defina o menor conjunto de escopos necessário."}
                </p>
              </div>
              <button onClick={closeModal} className="rounded-lg p-2 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            {shownSecret ? (
              <div className="mt-5">
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                  <p className="text-xs font-medium text-amber-800">
                    Copie e armazene agora
                  </p>
                  <code className="mt-3 block break-all font-mono text-sm">
                    {shownSecret}
                  </code>
                  {shownPrefix && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Prefixo salvo: {shownPrefix}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => void copySecret()}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                >
                  <Copy className="h-4 w-4" />
                  Copiar chave
                </button>
                <button
                  onClick={closeModal}
                  className="mt-2 w-full rounded-lg border border-border px-4 py-2.5 text-sm font-medium"
                >
                  Já armazenei com segurança
                </button>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="text-sm font-medium">Empresa vinculada</span>
                  <select
                    value={form.empresa_id}
                    onChange={(e) =>
                      setForm({ ...form, empresa_id: e.target.value })
                    }
                    className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  >
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.nome_fantasia ||
                          company.razao_social ||
                          company.id}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-medium">Nome</span>
                  <input
                    value={form.nome}
                    onChange={(e) =>
                      setForm({ ...form, nome: e.target.value })
                    }
                    placeholder="Ex.: Integração ERP"
                    className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="text-sm font-medium">Ambiente</span>
                    <select
                      value={form.tipo}
                      onChange={(e) =>
                        setForm({ ...form, tipo: e.target.value })
                      }
                      className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    >
                      <option value="teste">Teste</option>
                      <option value="producao">Produção</option>
                    </select>
                  </label>
                  <label>
                    <span className="text-sm font-medium">Expiração</span>
                    <input
                      type="date"
                      value={form.expira_em}
                      onChange={(e) =>
                        setForm({ ...form, expira_em: e.target.value })
                      }
                      className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    />
                  </label>
                </div>

                <div>
                  <p className="text-sm font-medium">Escopos</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {scopeOptions.map((scope) => (
                      <label
                        key={scope}
                        className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={form.scopes.includes(scope)}
                          onChange={() => toggleScope(scope)}
                        />
                        <code>{scope}</code>
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => void createKey()}
                  disabled={acting}
                  className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {acting ? "Criando..." : "Criar chave"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
