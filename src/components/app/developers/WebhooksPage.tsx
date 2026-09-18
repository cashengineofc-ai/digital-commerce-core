import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Copy,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  Webhook,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime, formatInt } from "@/lib/format";
import { EmptyState } from "@/components/app/EmptyState";
import { cn } from "@/lib/utils";

type Company = {
  id: string;
  nome_fantasia: string | null;
  razao_social: string | null;
};

type WebhookRow = {
  id: string;
  empresa_id: string;
  empresa_nome: string;
  nome: string;
  url_endpoint: string;
  eventos_ouvidos: string[];
  segredo_prefixo: string | null;
  ativo: boolean;
  data_ultimo_disparo: string | null;
  total_disparos: number;
  total_sucessos: number;
  total_falhas: number;
  ultima_resposta_status: number | null;
  created_at: string;
  revogado_em: string | null;
};

type DeliveryRow = {
  id: string;
  webhook_id: string;
  webhook_nome: string;
  endpoint_url: string;
  evento: string;
  status_resposta: number | null;
  tempo_resposta_ms: number | null;
  tentativa_numero: number;
  max_tentativas: number;
  sucesso: boolean;
  mensagem_erro: string | null;
  idempotency_key: string | null;
  created_at: string;
  total_registros: number;
};

const eventOptions = [
  "pedido.*",
  "transacao.*",
  "estorno.*",
  "saque.*",
  "comissao.*",
  "order.created",
  "payment.pending",
  "payment.confirmed",
  "payment.failed",
  "refund.completed",
  "withdrawal.paid",
  "affiliate.commission.approved",
] as const;

export function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
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
    url: "",
    eventos: ["payment.confirmed", "refund.completed"] as string[],
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [webhookResult, deliveryResult, companyResult] =
        await Promise.all([
          (supabase as any).rpc("fn_dev_webhooks_list"),
          (supabase as any).rpc("fn_dev_webhook_deliveries", {
            p_webhook_id: null,
            p_limit: 100,
            p_offset: 0,
          }),
          supabase
            .from("empresas")
            .select("id,nome_fantasia,razao_social")
            .is("deleted_at", null)
            .order("nome_fantasia"),
        ]);

      if (webhookResult.error) throw webhookResult.error;
      if (deliveryResult.error) throw deliveryResult.error;
      if (companyResult.error) throw companyResult.error;

      setWebhooks(
        ((webhookResult.data ?? []) as any[]).map((row) => ({
          id: String(row.id),
          empresa_id: String(row.empresa_id),
          empresa_nome: String(row.empresa_nome ?? "Empresa"),
          nome: String(row.nome ?? "Webhook"),
          url_endpoint: String(row.url_endpoint ?? ""),
          eventos_ouvidos: Array.isArray(row.eventos_ouvidos)
            ? row.eventos_ouvidos.map(String)
            : [],
          segredo_prefixo: row.segredo_prefixo
            ? String(row.segredo_prefixo)
            : null,
          ativo: Boolean(row.ativo),
          data_ultimo_disparo: row.data_ultimo_disparo
            ? String(row.data_ultimo_disparo)
            : null,
          total_disparos: Number(row.total_disparos ?? 0),
          total_sucessos: Number(row.total_sucessos ?? 0),
          total_falhas: Number(row.total_falhas ?? 0),
          ultima_resposta_status:
            row.ultima_resposta_status == null
              ? null
              : Number(row.ultima_resposta_status),
          created_at: String(row.created_at),
          revogado_em: row.revogado_em ? String(row.revogado_em) : null,
        })),
      );

      setDeliveries(
        ((deliveryResult.data ?? []) as any[]).map((row) => ({
          id: String(row.id),
          webhook_id: String(row.webhook_id),
          webhook_nome: String(row.webhook_nome ?? "Webhook"),
          endpoint_url: String(row.endpoint_url ?? ""),
          evento: String(row.evento ?? ""),
          status_resposta:
            row.status_resposta == null ? null : Number(row.status_resposta),
          tempo_resposta_ms:
            row.tempo_resposta_ms == null
              ? null
              : Number(row.tempo_resposta_ms),
          tentativa_numero: Number(row.tentativa_numero ?? 1),
          max_tentativas: Number(row.max_tentativas ?? 1),
          sucesso: Boolean(row.sucesso),
          mensagem_erro: row.mensagem_erro
            ? String(row.mensagem_erro)
            : null,
          idempotency_key: row.idempotency_key
            ? String(row.idempotency_key)
            : null,
          created_at: String(row.created_at),
          total_registros: Number(row.total_registros ?? 0),
        })),
      );

      setCompanies((companyResult.data ?? []) as Company[]);
    } catch (cause) {
      setWebhooks([]);
      setDeliveries([]);
      setCompanies([]);
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar os webhooks.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const deliverySummary = useMemo(
    () =>
      deliveries.reduce(
        (acc, row) => {
          acc.total += 1;
          if (row.sucesso) acc.success += 1;
          else acc.failed += 1;
          return acc;
        },
        { total: 0, success: 0, failed: 0 },
      ),
    [deliveries],
  );

  function openCreate() {
    const company = companies.at(0);
    setForm({
      empresa_id: company?.id ?? "",
      nome: "",
      url: "",
      eventos: ["payment.confirmed", "refund.completed"],
    });
    setShownSecret(null);
    setShownPrefix("");
    setCreateOpen(true);
    setError(null);
    setMessage(null);
  }

  function toggleEvent(event: string) {
    setForm((current) => ({
      ...current,
      eventos: current.eventos.includes(event)
        ? current.eventos.filter((item) => item !== event)
        : [...current.eventos, event],
    }));
  }

  async function createWebhook() {
    if (
      !form.empresa_id ||
      !form.nome.trim() ||
      !form.url.trim() ||
      form.eventos.length === 0
    ) {
      setError("Informe empresa, nome, URL HTTPS e ao menos um evento.");
      return;
    }

    setActing(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_dev_webhook_create",
        {
          p_empresa_id: form.empresa_id,
          p_nome: form.nome.trim(),
          p_url: form.url.trim(),
          p_eventos: form.eventos,
        },
      );
      if (rpcError) throw rpcError;

      const secret = String(data?.signing_secret ?? "");
      if (!secret) {
        throw new Error("O endpoint foi criado sem retornar o segredo.");
      }

      setShownSecret(secret);
      setShownPrefix(String(data?.secret_prefix ?? ""));
      setMessage(
        "Endpoint criado. Copie o segredo de assinatura agora; ele não será exibido novamente.",
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível criar o webhook.",
      );
    } finally {
      setActing(false);
    }
  }

  async function setActive(webhook: WebhookRow, active: boolean) {
    setActing(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_dev_webhook_set_active",
        {
          p_webhook_id: webhook.id,
          p_active: active,
        },
      );
      if (rpcError) throw rpcError;
      if (!data) throw new Error("O webhook não pôde ser atualizado.");
      setMessage(active ? "Webhook reativado." : "Webhook pausado.");
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível atualizar o webhook.",
      );
    } finally {
      setActing(false);
    }
  }

  async function revokeWebhook(webhook: WebhookRow) {
    if (!window.confirm("Revogar este webhook?")) return;
    setActing(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_dev_webhook_revoke",
        { p_webhook_id: webhook.id },
      );
      if (rpcError) throw rpcError;
      if (!data) throw new Error("O webhook já estava revogado.");
      setMessage("Webhook revogado.");
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
    setMessage("Segredo copiado. Armazene-o no servidor receptor.");
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
          <h1 className="text-2xl font-semibold tracking-tight">Webhooks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Endpoints reais e histórico de tentativas registradas pelo backend.
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
            Novo endpoint
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

      <div className="mt-5 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-muted-foreground">
        Segredos existentes não são recuperados pela interface. URLs novas exigem HTTPS e destinos obviamente locais/privados são recusados. O serviço que efetivamente envia webhooks também deve revalidar DNS/IP antes de abrir conexão.
      </div>

      <section className="mt-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            <div className="col-span-full p-10 text-center text-sm text-muted-foreground">
              Carregando endpoints...
            </div>
          ) : webhooks.length === 0 ? (
            <div className="col-span-full">
              <EmptyState
                icon={Webhook}
                title="Nenhum webhook configurado"
                description="Nenhum endpoint demonstrativo é criado automaticamente."
              />
            </div>
          ) : (
            webhooks.map((webhook) => (
              <article
                key={webhook.id}
                className="rounded-xl border border-border bg-card p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{webhook.nome}</h2>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-medium",
                          webhook.revogado_em
                            ? "bg-destructive/10 text-destructive"
                            : webhook.ativo
                              ? "bg-emerald-500/10 text-emerald-700"
                              : "bg-muted text-muted-foreground",
                        )}
                      >
                        {webhook.revogado_em
                          ? "Revogado"
                          : webhook.ativo
                            ? "Ativo"
                            : "Pausado"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {webhook.empresa_nome}
                    </p>
                  </div>
                </div>

                <p
                  className="mt-3 truncate font-mono text-xs"
                  title={webhook.url_endpoint}
                >
                  {webhook.url_endpoint}
                </p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {webhook.eventos_ouvidos.map((event) => (
                    <span
                      key={event}
                      className="rounded-md border border-border bg-muted/40 px-2 py-1 font-mono text-[10px] text-muted-foreground"
                    >
                      {event}
                    </span>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4 text-xs">
                  <div>
                    <p className="text-muted-foreground">Tentativas</p>
                    <p className="mt-1 font-semibold tabular-nums">
                      {formatInt(webhook.total_disparos)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Sucesso</p>
                    <p className="mt-1 font-semibold tabular-nums">
                      {formatInt(webhook.total_sucessos)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Falhas</p>
                    <p className="mt-1 font-semibold tabular-nums">
                      {formatInt(webhook.total_falhas)}
                    </p>
                  </div>
                </div>

                <p className="mt-3 text-[11px] text-muted-foreground">
                  Segredo: {webhook.segredo_prefixo ?? "prefixo indisponível"}••••
                  {webhook.data_ultimo_disparo
                    ? ` · último disparo ${formatDateTime(
                        webhook.data_ultimo_disparo,
                      )}`
                    : " · sem disparos registrados"}
                </p>

                {!webhook.revogado_em && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() =>
                        void setActive(webhook, !webhook.ativo)
                      }
                      disabled={acting}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
                    >
                      {webhook.ativo ? (
                        <>
                          <Pause className="h-3.5 w-3.5" />
                          Pausar
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5" />
                          Reativar
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => void revokeWebhook(webhook)}
                      disabled={acting}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-2.5 py-1.5 text-xs font-medium text-destructive disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Revogar
                    </button>
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      </section>

      <section className="mt-8 overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">Entregas registradas</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Somente tentativas realmente registradas pelo servidor.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {deliverySummary.total} tentativa
            {deliverySummary.total === 1 ? "" : "s"} ·{" "}
            {deliverySummary.success} sucesso · {deliverySummary.failed} falha
          </p>
        </div>

        {deliveries.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Nenhuma tentativa de entrega registrada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3">Webhook</th>
                  <th className="px-5 py-3">Evento</th>
                  <th className="px-5 py-3 text-right">Tentativa</th>
                  <th className="px-5 py-3 text-right">HTTP</th>
                  <th className="px-5 py-3 text-right">Duração</th>
                  <th className="px-5 py-3">Resultado</th>
                  <th className="px-5 py-3 text-right">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {deliveries.map((delivery) => (
                  <tr key={delivery.id} className="hover:bg-muted/40">
                    <td className="px-5 py-3.5">
                      <p className="font-medium">{delivery.webhook_nome}</p>
                      <p className="mt-0.5 max-w-64 truncate font-mono text-[10px] text-muted-foreground">
                        {delivery.endpoint_url}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs">
                      {delivery.evento}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums">
                      {delivery.tentativa_numero}/{delivery.max_tentativas}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums">
                      {delivery.status_resposta ?? "—"}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-muted-foreground">
                      {delivery.tempo_resposta_ms == null
                        ? "—"
                        : `${delivery.tempo_resposta_ms} ms`}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-medium",
                          delivery.sucesso
                            ? "bg-emerald-500/10 text-emerald-700"
                            : "bg-destructive/10 text-destructive",
                        )}
                      >
                        {delivery.sucesso ? "Sucesso" : "Falha"}
                      </span>
                      {delivery.mensagem_erro && (
                        <p className="mt-1 max-w-72 truncate text-[10px] text-destructive">
                          {delivery.mensagem_erro}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right text-xs text-muted-foreground">
                      {formatDateTime(delivery.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {createOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  {shownSecret ? "Segredo de assinatura" : "Novo webhook"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {shownSecret
                    ? "Esta é a única exibição do segredo."
                    : "Configure um endpoint HTTPS e os eventos necessários."}
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
                    Armazene no servidor receptor
                  </p>
                  <code className="mt-3 block break-all font-mono text-sm">
                    {shownSecret}
                  </code>
                  {shownPrefix && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Prefixo visível depois: {shownPrefix}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => void copySecret()}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                >
                  <Copy className="h-4 w-4" />
                  Copiar segredo
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
                  <span className="text-sm font-medium">Empresa</span>
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
                    placeholder="Ex.: Eventos do ERP"
                    className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium">URL HTTPS</span>
                  <input
                    type="url"
                    value={form.url}
                    onChange={(e) =>
                      setForm({ ...form, url: e.target.value })
                    }
                    placeholder="https://api.exemplo.com/webhooks/cash-engine"
                    className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  />
                </label>

                <div>
                  <p className="text-sm font-medium">Eventos</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {eventOptions.map((event) => (
                      <label
                        key={event}
                        className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={form.eventos.includes(event)}
                          onChange={() => toggleEvent(event)}
                        />
                        <code>{event}</code>
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => void createWebhook()}
                  disabled={acting}
                  className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {acting ? "Criando..." : "Criar webhook"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
