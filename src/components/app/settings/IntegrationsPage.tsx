import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Plug,
  RefreshCw,
  ShieldCheck,
  Unplug,
  X,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/app/EmptyState";

type IntegrationRow = {
  provider: string;
  nome: string;
  descricao: string | null;
  categoria: string;
  operational: boolean;
  integracao_id: string | null;
  status: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  last_error_at: string | null;
  connected_at: string | null;
  disconnected_at: string | null;
};

export function IntegrationsPage() {
  const [rows, setRows] = useState<IntegrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [connectRow, setConnectRow] = useState<IntegrationRow | null>(null);
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_integracoes_listar_safe",
      );
      if (rpcError) throw rpcError;

      setRows(
        ((data ?? []) as any[]).map((row) => ({
          provider: String(row.provider),
          nome: String(row.nome),
          descricao: row.descricao ? String(row.descricao) : null,
          categoria: String(row.categoria ?? "Outro"),
          operational: Boolean(row.operational),
          integracao_id: row.integracao_id ? String(row.integracao_id) : null,
          status: row.status ? String(row.status) : null,
          last_sync_at: row.last_sync_at ? String(row.last_sync_at) : null,
          last_error: row.last_error ? String(row.last_error) : null,
          last_error_at: row.last_error_at ? String(row.last_error_at) : null,
          connected_at: row.connected_at ? String(row.connected_at) : null,
          disconnected_at: row.disconnected_at
            ? String(row.disconnected_at)
            : null,
        })),
      );
    } catch (cause) {
      setRows([]);
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar as integrações.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const connected = useMemo(
    () => rows.filter((row) => row.status === "conectado").length,
    [rows],
  );

  async function testIntegration(integrationId: string) {
    setActingId(integrationId);
    setError(null);
    setMessage(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        "integration-test",
        {
          body: { integration_id: integrationId },
        },
      );
      if (invokeError) throw invokeError;
      if (!data?.ok) {
        throw new Error(
          String(data?.error ?? "A conexão com o provedor falhou."),
        );
      }
      setMessage(
        `Conexão validada pelo provedor. HTTP ${String(
          data.provider_status ?? "",
        )}.`,
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível testar a conexão.",
      );
      await load();
    } finally {
      setActingId(null);
    }
  }

  async function connect() {
    if (!connectRow || !secret.trim()) {
      setError("Informe a credencial do provedor.");
      return;
    }

    setActingId(connectRow.provider);
    setError(null);
    setMessage(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_integracao_configurar_secret",
        {
          p_provider: connectRow.provider,
          p_secret: secret.trim(),
        },
      );
      if (rpcError) throw rpcError;
      const integrationId = String(data ?? "");
      if (!integrationId) throw new Error("A integração não foi criada.");

      setSecret("");
      setConnectRow(null);

      const { data: testData, error: invokeError } =
        await supabase.functions.invoke("integration-test", {
          body: { integration_id: integrationId },
        });

      if (invokeError) {
        setMessage(
          "Credencial armazenada no servidor, mas o serviço de teste ainda não está disponível na publicação.",
        );
      } else if (!testData?.ok) {
        setError(
          `Credencial armazenada, porém o provedor rejeitou o teste: ${String(
            testData?.error ?? "erro desconhecido",
          )}`,
        );
      } else {
        setMessage("Integração configurada e conexão validada pelo provedor.");
      }

      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível configurar a integração.",
      );
    } finally {
      setActingId(null);
    }
  }

  async function disconnect(row: IntegrationRow) {
    if (!row.integracao_id) return;
    if (
      !window.confirm(
        `Desconectar ${row.nome}? A credencial armazenada no servidor será removida.`,
      )
    ) {
      return;
    }

    setActingId(row.integracao_id);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_integracao_desconectar",
        { p_integracao_id: row.integracao_id },
      );
      if (rpcError) throw rpcError;
      if (!data) throw new Error("A integração não foi desconectada.");
      setMessage("Integração desconectada e credencial removida do Vault.");
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível desconectar a integração.",
      );
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Integrações</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Serviços realmente suportados e credenciais mantidas no servidor.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
            <Zap className="h-3.5 w-3.5 text-emerald-600" />
            {connected} conectada{connected === 1 ? "" : "s"}
          </span>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Atualizar
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
        Credenciais não são retornadas pela API nem salvas no navegador. O frontend recebe apenas status, erros e datas de conexão.
      </div>

      {loading ? (
        <div className="mt-6 rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          Carregando integrações...
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={Plug}
            title="Nenhum provider disponível"
            description="O sistema não inventa integrações demonstrativas."
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => {
            const connectedNow = row.status === "conectado";
            const configured = Boolean(row.integracao_id);
            const acting =
              actingId === row.integracao_id || actingId === row.provider;

            return (
              <article
                key={row.provider}
                className="flex h-full flex-col rounded-xl border border-border bg-card p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{row.nome}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.categoria}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium",
                      connectedNow
                        ? "bg-emerald-500/10 text-emerald-700"
                        : row.status === "erro"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {connectedNow
                      ? "Conectado"
                      : row.status === "erro"
                        ? "Erro"
                        : configured
                          ? "Configurado"
                          : row.operational
                            ? "Disponível"
                            : "Indisponível"}
                  </span>
                </div>

                <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {row.descricao || "Sem descrição."}
                </p>

                {row.last_error && (
                  <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
                    <strong>Último erro:</strong> {row.last_error}
                    {row.last_error_at && (
                      <span className="mt-1 block text-muted-foreground">
                        {formatDateTime(row.last_error_at)}
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-4 border-t border-border pt-4">
                  {row.connected_at && (
                    <p className="mb-3 text-xs text-muted-foreground">
                      Conectado em {formatDateTime(row.connected_at)}
                      {row.last_sync_at
                        ? ` · último teste ${formatDateTime(row.last_sync_at)}`
                        : ""}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {!configured ? (
                      <button
                        onClick={() => {
                          setConnectRow(row);
                          setSecret("");
                          setError(null);
                        }}
                        disabled={!row.operational || acting}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                      >
                        <Plug className="h-3.5 w-3.5" />
                        Conectar
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() =>
                            row.integracao_id &&
                            void testIntegration(row.integracao_id)
                          }
                          disabled={acting}
                          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Testar conexão
                        </button>
                        <button
                          onClick={() => void disconnect(row)}
                          disabled={acting}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-2 text-xs font-medium text-destructive disabled:opacity-50"
                        >
                          <Unplug className="h-3.5 w-3.5" />
                          Desconectar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {connectRow && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  Conectar {connectRow.nome}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  A credencial será enviada ao backend e armazenada no Vault.
                </p>
              </div>
              <button
                onClick={() => setConnectRow(null)}
                className="rounded-lg p-2 hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {connectRow.provider === "mercado_pago" && (
              <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                Informe o Access Token privado do Mercado Pago. Ele não será exibido novamente nesta interface.
              </div>
            )}

            <label className="mt-5 block">
              <span className="text-sm font-medium">Credencial secreta</span>
              <input
                type="password"
                autoComplete="off"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 font-mono text-sm"
              />
            </label>

            <button
              onClick={() => void connect()}
              disabled={actingId !== null || !secret.trim()}
              className="mt-5 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {actingId ? "Configurando..." : "Salvar e testar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
