import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/app/EmptyState";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/configuracoes")({
  component: AdminConfiguracoesPage,
});

type Row = {
  id: string;
  chave: string;
  valor: unknown;
  tipo_valor: string;
  descricao: string | null;
  categoria: string | null;
  modulo: string | null;
  somente_leitura: boolean;
  sensivel: boolean;
  publico: boolean;
  updated_at: string;
};

type PixMode = "desativado" | "chave" | "provedor";
type PendingPix = {
  transacao_id: string;
  pedido_numero: string | null;
  valor: number;
  recebedor_nome: string | null;
  recebedor_cidade: string | null;
  txid: string | null;
  criado_em: string;
  cliente_nome: string | null;
  cliente_email: string | null;
};

function AdminConfiguracoesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pixMode, setPixMode] = useState<PixMode>("desativado");
  const [pixKey, setPixKey] = useState("");
  const [pixKeyConfigured, setPixKeyConfigured] = useState(false);
  const [receiverName, setReceiverName] = useState("");
  const [receiverCity, setReceiverCity] = useState("");
  const [pendingPix, setPendingPix] = useState<PendingPix[]>([]);
  const [pixEvidence, setPixEvidence] = useState<
    Record<string, { reference: string; evidence: string }>
  >({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [
      { data, error: rpcError },
      { data: pixData, error: pixError },
      { data: pendingData, error: pendingError },
    ] = await Promise.all([
      (supabase as any).rpc("fn_admin_config_list"),
      (supabase as any).rpc("fn_obter_config_pix_admin"),
      (supabase as any).rpc("fn_listar_pix_manual_pendente"),
    ]);

    if (rpcError) {
      setError(rpcError.message);
      setRows([]);
    } else {
      setRows(
        ((data ?? []) as any[]).map((row) => ({
          id: String(row.id),
          chave: String(row.chave),
          valor: row.valor,
          tipo_valor: String(row.tipo_valor ?? ""),
          descricao: row.descricao ? String(row.descricao) : null,
          categoria: row.categoria ? String(row.categoria) : null,
          modulo: row.modulo ? String(row.modulo) : null,
          somente_leitura: Boolean(row.somente_leitura),
          sensivel: Boolean(row.sensivel),
          publico: Boolean(row.publico),
          updated_at: String(row.updated_at),
        })),
      );
    }

    const pix = Array.isArray(pixData) ? pixData[0] : pixData;
    if (pixError) {
      setError(pixError.message);
    } else if (pix) {
      setPixMode((pix.modo ?? "desativado") as PixMode);
      setPixKey("");
      setPixKeyConfigured(Boolean(pix.configurado));
      setReceiverName(String(pix.recebedor_nome ?? ""));
      setReceiverCity(String(pix.recebedor_cidade ?? ""));
    }

    if (pendingError) {
      setError(pendingError.message);
    } else {
      setPendingPix(
        ((pendingData ?? []) as any[]).map((item) => ({
          ...item,
          valor: Number(item.valor ?? 0),
        })),
      );
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.chave, row.descricao, row.categoria, row.modulo].some((value) =>
        String(value ?? "").toLowerCase().includes(q),
      ),
    );
  }, [rows, query]);

  async function edit(row: Row) {
    if (row.sensivel) {
      setError(
        "Configurações sensíveis só podem ser alteradas no armazenamento seguro do servidor.",
      );
      return;
    }
    if (row.somente_leitura) return;

    const raw = window.prompt(
      `Novo valor JSON para ${row.chave}:`,
      JSON.stringify(row.valor),
    );
    if (raw == null) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      setError("JSON inválido.");
      return;
    }

    setActing(true);
    setError(null);
    const { data, error: rpcError } = await (supabase as any).rpc(
      "fn_admin_config_set",
      { p_key: row.chave, p_value: parsed },
    );
    if (rpcError) {
      setError(rpcError.message);
    } else if (data) {
      setMessage("Configuração atualizada e auditada.");
      await load();
    }
    setActing(false);
  }

  async function savePix() {
    if (
      pixMode === "chave" &&
      ((!pixKey.trim() && !pixKeyConfigured) ||
        !receiverName.trim() ||
        !receiverCity.trim())
    ) {
      setError(
        "Informe uma chave Pix, o nome do recebedor e a cidade. Se já existir uma chave salva, deixe o campo da chave vazio para mantê-la.",
      );
      return;
    }

    setActing(true);
    setError(null);
    setMessage(null);
    const { error: rpcError } = await (supabase as any).rpc(
      "fn_salvar_config_pix",
      {
        p_modo: pixMode,
        p_chave: pixKey.trim() || null,
        p_recebedor_nome: receiverName.trim() || null,
        p_recebedor_cidade: receiverCity.trim() || null,
      },
    );

    if (rpcError) {
      setError(rpcError.message);
    } else {
      setMessage(
        pixKey.trim()
          ? "Configuração Pix salva. A nova chave foi armazenada sem ser devolvida ao navegador."
          : "Configuração Pix salva com sucesso.",
      );
      await load();
    }
    setActing(false);
  }

  async function confirmPix(item: PendingPix) {
    const values = pixEvidence[item.transacao_id] ?? {
      reference: "",
      evidence: "",
    };
    if (!values.reference.trim() || !values.evidence.trim()) {
      setError(
        "Informe a referência bancária e a evidência antes de confirmar.",
      );
      return;
    }

    setActing(true);
    setError(null);
    setMessage(null);
    const { error: rpcError } = await (supabase as any).rpc(
      "fn_confirmar_pix_manual",
      {
        p_transacao_id: item.transacao_id,
        p_referencia_bancaria: values.reference.trim(),
        p_evidencia: values.evidence.trim(),
      },
    );

    if (rpcError) {
      setError(rpcError.message);
    } else {
      setMessage("Pix confirmado após conferência bancária.");
      setPixEvidence((current) => {
        const next = { ...current };
        delete next[item.transacao_id];
        return next;
      });
      await load();
    }
    setActing(false);
  }

  return (
    <div className="mx-auto w-full max-w-[1300px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="rounded-md bg-destructive/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-destructive">
            Admin Global
          </span>
          <h1 className="mt-2 text-2xl font-semibold">Configurações globais</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Valores persistidos do backend. Segredos não são expostos nesta tela.
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-medium disabled:opacity-50"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Atualizar
        </button>
      </header>

      {error && (
        <div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {message && (
        <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-700">
          {message}
        </div>
      )}

      <section className="mt-5 rounded-xl border border-border bg-card p-5">
        <div>
          <h2 className="text-base font-semibold">Pix</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure o recebimento e faça a conciliação manual quando usar uma chave Pix.
          </p>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium">
            Modo de recebimento
            <select
              value={pixMode}
              onChange={(e) => setPixMode(e.target.value as PixMode)}
              className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 font-normal"
            >
              <option value="desativado">Desativado</option>
              <option value="chave">Chave Pix (conciliação manual)</option>
              <option value="provedor">Provedor integrado</option>
            </select>
          </label>

          {pixMode === "chave" && (
            <>
              <label className="text-sm font-medium">
                Chave Pix
                <input
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  autoComplete="off"
                  placeholder={
                    pixKeyConfigured
                      ? "Chave já configurada — digite somente para substituir"
                      : "Informe a chave Pix"
                  }
                  className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 font-normal"
                />
                <span className="mt-1.5 block text-xs font-normal text-muted-foreground">
                  {pixKeyConfigured
                    ? "Existe uma chave armazenada no servidor. O valor atual não é enviado ao navegador."
                    : "Nenhuma chave Pix está armazenada."}
                </span>
              </label>

              <label className="text-sm font-medium">
                Nome do recebedor
                <input
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  maxLength={25}
                  className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 font-normal"
                />
              </label>

              <label className="text-sm font-medium">
                Cidade do recebedor
                <input
                  value={receiverCity}
                  onChange={(e) => setReceiverCity(e.target.value)}
                  maxLength={15}
                  className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 font-normal"
                />
              </label>
            </>
          )}
        </div>

        {pixMode === "chave" && (
          <p className="mt-4 text-sm text-muted-foreground">
            Uma chave Pix não dá acesso à API bancária. O pagamento fica “Aguardando conferência” até a conciliação abaixo.
          </p>
        )}
        {pixMode === "provedor" && (
          <p className="mt-4 text-sm text-muted-foreground">
            A confirmação vem da API e do webhook autenticado e depende das credenciais externas já configuradas. Nenhum segredo é exibido aqui.
          </p>
        )}

        <button
          onClick={() => void savePix()}
          disabled={acting}
          className="mt-5 h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Salvar Pix
        </button>

        <div className="mt-8 border-t border-border pt-5">
          <h3 className="text-sm font-semibold">Pix aguardando conferência</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            O comprovante enviado pelo comprador não aprova automaticamente. Confira o crédito na conta recebedora.
          </p>
        </div>

        <div className="mt-4 space-y-3">
          {pendingPix.length === 0 ? (
            <p className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
              Nenhum Pix por chave está pendente.
            </p>
          ) : (
            pendingPix.map((item) => {
              const values = pixEvidence[item.transacao_id] ?? {
                reference: "",
                evidence: "",
              };
              return (
                <div
                  key={item.transacao_id}
                  className="rounded-lg border border-border p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">
                        {item.pedido_numero || item.transacao_id}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.cliente_nome || "Cliente"} · {item.cliente_email || "Sem e-mail"} · TXID {item.txid || "—"}
                      </p>
                    </div>
                    <strong className="text-sm tabular-nums">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(item.valor)}
                    </strong>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <input
                      value={values.reference}
                      onChange={(e) =>
                        setPixEvidence((current) => ({
                          ...current,
                          [item.transacao_id]: {
                            ...values,
                            reference: e.target.value,
                          },
                        }))
                      }
                      placeholder="Referência bancária"
                      className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                    />
                    <input
                      value={values.evidence}
                      onChange={(e) =>
                        setPixEvidence((current) => ({
                          ...current,
                          [item.transacao_id]: {
                            ...values,
                            evidence: e.target.value,
                          },
                        }))
                      }
                      placeholder="Evidência (texto ou URL)"
                      className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                    />
                  </div>

                  <button
                    onClick={() => void confirmPix(item)}
                    disabled={acting}
                    className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs font-medium disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Confirmar após conferência
                  </button>
                </div>
              );
            })
          )}
        </div>
      </section>

      <div className="relative mt-5">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar chave, descrição, categoria ou módulo"
          className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm"
        />
      </div>

      <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Carregando configurações...
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={SlidersHorizontal}
            title="Nenhuma configuração encontrada"
            description="Nenhum valor demonstrativo é exibido."
          />
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((row) => (
              <div
                key={row.id}
                className="grid gap-4 p-5 md:grid-cols-[1fr_1fr_auto]"
              >
                <div>
                  <p className="font-mono text-sm font-medium">{row.chave}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.descricao || "Sem descrição"} · {row.categoria || "sem categoria"}
                  </p>
                </div>
                <pre className="overflow-x-auto rounded-lg bg-muted/40 p-3 text-xs">
                  {JSON.stringify(row.valor)}
                </pre>
                <button
                  disabled={acting || row.somente_leitura || row.sensivel}
                  onClick={() => void edit(row)}
                  className="h-9 rounded-lg border border-border px-3 text-xs disabled:opacity-40"
                >
                  {row.sensivel
                    ? "Protegido"
                    : row.somente_leitura
                      ? "Somente leitura"
                      : "Editar"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
