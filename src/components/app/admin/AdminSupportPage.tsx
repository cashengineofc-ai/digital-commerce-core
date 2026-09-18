import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  FileText,
  MessageCircle,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime, formatInt } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/app/EmptyState";

type Ticket = {
  id: string;
  protocolo: string;
  empresa_id: string;
  empresa_nome: string;
  solicitante: string;
  assunto: string;
  tipo: string;
  prioridade: string;
  status: string;
  atribuido_nome: string | null;
  created_at: string;
  updated_at: string;
  mensagens: number;
  total_records: number;
};

type TicketMessage = {
  id: string;
  sender_name: string;
  sender_type: string;
  body: string;
  is_automatic: boolean;
  created_at: string;
  attachments: Array<{
    id: string;
    file_name: string;
    mime_type: string;
    size_bytes: number;
    storage_path: string;
  }>;
};

type Category = {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  publica: boolean;
  ordem: number;
  updated_at: string;
};

type Article = {
  id: string;
  categoria_id: string | null;
  categoria_nome: string | null;
  titulo: string;
  resumo: string | null;
  conteudo: string;
  status: string;
  publico: boolean;
  destaque: boolean;
  tempo_leitura_minutos: number | null;
  updated_at: string;
};

type Channel = {
  canal: string;
  label: string;
  valor: string | null;
  ativo: boolean;
};

const statusLabels: Record<string, string> = {
  aberto: "Aberto",
  respondido_cliente: "Usuário respondeu",
  respondido_suporte: "Aguardando usuário",
  em_analise: "Em atendimento",
  pendente_terceiro: "Aguardando terceiro",
  resolvido: "Resolvido",
  fechado: "Fechado",
  reaberto: "Reaberto",
};

export function AdminSupportPage() {
  const [tab, setTab] = useState<"tickets" | "articles" | "channels">("tickets");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketStatus, setTicketStatus] = useState("");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [reply, setReply] = useState("");
  const [replyFile, setReplyFile] = useState<File | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [articleQuery, setArticleQuery] = useState("");
  const [articleOpen, setArticleOpen] = useState(false);
  const [articleForm, setArticleForm] = useState({
    id: "",
    categoria_id: "",
    titulo: "",
    resumo: "",
    conteudo: "",
    status: "rascunho",
    publico: true,
    destaque: false,
  });
  const [newCategory, setNewCategory] = useState("");

  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ticketResult, categoryResult, articleResult, channelResult] =
        await Promise.all([
          (supabase as any).rpc("fn_admin_suporte_tickets", {
            p_status: ticketStatus || null,
            p_query: debouncedQuery || null,
            p_limit: 100,
            p_offset: 0,
          }),
          (supabase as any).rpc("fn_admin_ajuda_categorias"),
          (supabase as any).rpc("fn_admin_ajuda_artigos", {
            p_query: articleQuery.trim() || null,
            p_limit: 200,
          }),
          supabase
            .from("suporte_canais_config")
            .select("canal,label,valor,ativo")
            .order("canal"),
        ]);

      if (ticketResult.error) throw ticketResult.error;
      if (categoryResult.error) throw categoryResult.error;
      if (articleResult.error) throw articleResult.error;
      if (channelResult.error) throw channelResult.error;

      setTickets(
        ((ticketResult.data ?? []) as any[]).map((row) => ({
          id: String(row.id),
          protocolo: String(row.protocolo),
          empresa_id: String(row.empresa_id),
          empresa_nome: String(row.empresa_nome),
          solicitante: String(row.solicitante),
          assunto: String(row.assunto),
          tipo: String(row.tipo),
          prioridade: String(row.prioridade),
          status: String(row.status),
          atribuido_nome: row.atribuido_nome
            ? String(row.atribuido_nome)
            : null,
          created_at: String(row.created_at),
          updated_at: String(row.updated_at),
          mensagens: Number(row.mensagens ?? 0),
          total_records: Number(row.total_records ?? 0),
        })),
      );
      setCategories((categoryResult.data ?? []) as Category[]);
      setArticles((articleResult.data ?? []) as Article[]);
      setChannels((channelResult.data ?? []) as Channel[]);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar o suporte.",
      );
    } finally {
      setLoading(false);
    }
  }, [ticketStatus, debouncedQuery, articleQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  const ticketCounts = useMemo(
    () =>
      tickets.reduce(
        (acc, ticket) => {
          acc.total += 1;
          if (!["resolvido", "fechado"].includes(ticket.status)) acc.open += 1;
          if (ticket.status === "respondido_cliente") acc.waitingSupport += 1;
          if (ticket.status === "resolvido") acc.resolved += 1;
          return acc;
        },
        { total: 0, open: 0, waitingSupport: 0, resolved: 0 },
      ),
    [tickets],
  );

  async function openTicket(ticket: Ticket) {
    setSelectedTicket(ticket);
    setReply("");
    setReplyFile(null);
    setError(null);
    const { data, error: rpcError } = await (supabase as any).rpc(
      "fn_suporte_ticket_mensagens",
      { p_ticket_id: ticket.id },
    );
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setMessages(
      ((data ?? []) as any[]).map((row) => ({
        id: String(row.id),
        sender_name: String(row.sender_name ?? "Remetente"),
        sender_type: String(row.sender_type ?? ""),
        body: String(row.body ?? ""),
        is_automatic: Boolean(row.is_automatic),
        created_at: String(row.created_at),
        attachments: Array.isArray(row.attachments)
          ? row.attachments.map((item: any) => ({
              id: String(item.id),
              file_name: String(item.file_name),
              mime_type: String(item.mime_type),
              size_bytes: Number(item.size_bytes ?? 0),
              storage_path: String(item.storage_path),
            }))
          : [],
      })),
    );
  }

  async function replyTicket() {
    if (!selectedTicket || !reply.trim()) return;
    setActing(true);
    setError(null);
    try {
      const { data: messageId, error: rpcError } = await (supabase as any).rpc(
        "fn_suporte_responder",
        { p_ticket_id: selectedTicket.id, p_mensagem: reply.trim() },
      );
      if (rpcError) throw rpcError;

      if (replyFile) {
        const allowed = [
          "image/jpeg",
          "image/png",
          "image/webp",
          "application/pdf",
          "text/plain",
        ];
        if (!allowed.includes(replyFile.type) || replyFile.size > 10 * 1024 * 1024) {
          throw new Error("Anexo inválido. Use imagem, PDF ou TXT de até 10 MB.");
        }
        const safeName = replyFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath = `${selectedTicket.empresa_id}/${selectedTicket.id}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("support-attachments")
          .upload(storagePath, replyFile, {
            upsert: false,
            contentType: replyFile.type,
          });
        if (uploadError) throw uploadError;

        const { error: registerError } = await (supabase as any).rpc(
          "fn_suporte_anexo_registrar",
          {
            p_ticket_id: selectedTicket.id,
            p_mensagem_id: messageId,
            p_storage_path: storagePath,
            p_file_name: replyFile.name,
            p_mime_type: replyFile.type,
            p_size_bytes: replyFile.size,
          },
        );
        if (registerError) throw registerError;
      }

      setReply("");
      setReplyFile(null);
      setMessage("Resposta registrada e usuário notificado internamente.");
      await openTicket(selectedTicket);
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível responder.",
      );
    } finally {
      setActing(false);
    }
  }

  async function changeStatus(status: string) {
    if (!selectedTicket) return;
    setActing(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_admin_suporte_status",
        {
          p_ticket_id: selectedTicket.id,
          p_status: status,
        },
      );
      if (rpcError) throw rpcError;
      if (!data) throw new Error("O status não foi atualizado.");
      const next = { ...selectedTicket, status };
      setSelectedTicket(next);
      setMessage("Status do chamado atualizado.");
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível atualizar.",
      );
    } finally {
      setActing(false);
    }
  }

  async function openAttachment(path: string) {
    const { data, error: signedError } = await supabase.storage
      .from("support-attachments")
      .createSignedUrl(path, 60);
    if (signedError || !data?.signedUrl) {
      setError(signedError?.message ?? "Não foi possível abrir o anexo.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  function newArticle() {
    setArticleForm({
      id: "",
      categoria_id: categories.at(0)?.id ?? "",
      titulo: "",
      resumo: "",
      conteudo: "",
      status: "rascunho",
      publico: true,
      destaque: false,
    });
    setArticleOpen(true);
  }

  function editArticle(article: Article) {
    setArticleForm({
      id: article.id,
      categoria_id: article.categoria_id ?? "",
      titulo: article.titulo,
      resumo: article.resumo ?? "",
      conteudo: article.conteudo,
      status: article.status,
      publico: article.publico,
      destaque: article.destaque,
    });
    setArticleOpen(true);
  }

  async function saveArticle() {
    if (
      articleForm.titulo.trim().length < 3 ||
      articleForm.conteudo.trim().length < 10
    ) {
      setError("Informe título e conteúdo do artigo.");
      return;
    }
    setActing(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_admin_ajuda_artigo_salvar",
        {
          p_id: articleForm.id || null,
          p_categoria_id: articleForm.categoria_id || null,
          p_titulo: articleForm.titulo.trim(),
          p_resumo: articleForm.resumo.trim() || null,
          p_conteudo: articleForm.conteudo.trim(),
          p_publico: articleForm.publico,
          p_destaque: articleForm.destaque,
          p_status: articleForm.status,
        },
      );
      if (rpcError) throw rpcError;
      if (!data) throw new Error("O artigo não foi salvo.");
      setArticleOpen(false);
      setMessage("Artigo salvo.");
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível salvar o artigo.",
      );
    } finally {
      setActing(false);
    }
  }

  async function createCategory() {
    if (!newCategory.trim()) return;
    setActing(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_admin_ajuda_categoria_salvar",
        {
          p_id: null,
          p_nome: newCategory.trim(),
          p_descricao: null,
          p_publica: true,
          p_ordem: categories.length,
        },
      );
      if (rpcError) throw rpcError;
      if (!data) throw new Error("A categoria não foi criada.");
      setNewCategory("");
      setMessage("Categoria criada.");
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível criar a categoria.",
      );
    } finally {
      setActing(false);
    }
  }

  async function saveChannel(channel: Channel) {
    setActing(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_admin_suporte_canal_salvar",
        {
          p_canal: channel.canal,
          p_label: channel.label,
          p_valor: channel.valor || null,
          p_ativo: channel.ativo,
        },
      );
      if (rpcError) throw rpcError;
      if (!data) throw new Error("O canal não foi salvo.");
      setMessage("Canal de suporte atualizado.");
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível salvar o canal.",
      );
    } finally {
      setActing(false);
    }
  }

  function updateChannel(canal: string, patch: Partial<Channel>) {
    setChannels((current) =>
      current.map((item) =>
        item.canal === canal ? { ...item, ...patch } : item,
      ),
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Suporte</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Chamados reais, conteúdo da Central de Ajuda e canais publicados.
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading || acting}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Atualizar
        </button>
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

      <div className="mt-6 flex gap-1 rounded-xl border border-border bg-card p-1">
        {[
          ["tickets", "Chamados", MessageCircle],
          ["articles", "Artigos", BookOpen],
          ["channels", "Canais", Settings2],
        ].map(([key, label, Icon]) => (
          <button
            key={String(key)}
            onClick={() => setTab(key as typeof tab)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
              tab === key
                ? "bg-destructive text-destructive-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            <Icon className="h-4 w-4" />
            {String(label)}
          </button>
        ))}
      </div>

      {tab === "tickets" && (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-4">
            {[
              ["Total carregado", ticketCounts.total],
              ["Em aberto", ticketCounts.open],
              ["Aguardando suporte", ticketCounts.waitingSupport],
              ["Resolvidos", ticketCounts.resolved],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-border bg-card p-5">
                <p className="text-sm text-muted-foreground">{String(label)}</p>
                <p className="mt-2 text-2xl font-semibold">{formatInt(Number(value))}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-3 rounded-xl border border-border bg-card p-3 sm:grid-cols-[1fr_220px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Protocolo, assunto, usuário ou empresa"
                className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm"
              />
            </div>
            <select
              value={ticketStatus}
              onChange={(e) => setTicketStatus(e.target.value)}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="">Todos os estados</option>
              {Object.entries(statusLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
            {loading ? (
              <div className="p-12 text-center text-sm text-muted-foreground">
                Carregando chamados...
              </div>
            ) : tickets.length === 0 ? (
              <EmptyState
                icon={MessageCircle}
                title="Nenhum chamado encontrado"
                description="Nenhum ticket demonstrativo é criado para preencher a fila."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-5 py-3">Protocolo</th>
                      <th className="px-5 py-3">Empresa / solicitante</th>
                      <th className="px-5 py-3">Assunto</th>
                      <th className="px-5 py-3">Tipo</th>
                      <th className="px-5 py-3">Prioridade</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Mensagens</th>
                      <th className="px-5 py-3 text-right">Atualizado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {tickets.map((ticket) => (
                      <tr
                        key={ticket.id}
                        onClick={() => void openTicket(ticket)}
                        className="cursor-pointer hover:bg-muted/40"
                      >
                        <td className="px-5 py-3.5 font-mono text-xs">
                          {ticket.protocolo}
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="font-medium">{ticket.empresa_nome}</p>
                          <p className="text-xs text-muted-foreground">{ticket.solicitante}</p>
                        </td>
                        <td className="px-5 py-3.5 font-medium">{ticket.assunto}</td>
                        <td className="px-5 py-3.5 capitalize text-muted-foreground">{ticket.tipo}</td>
                        <td className="px-5 py-3.5 capitalize">{ticket.prioridade}</td>
                        <td className="px-5 py-3.5">
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">
                            {statusLabels[ticket.status] ?? ticket.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right tabular-nums">{ticket.mensagens}</td>
                        <td className="px-5 py-3.5 text-right text-xs text-muted-foreground">
                          {formatDateTime(ticket.updated_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {tab === "articles" && (
        <div className="mt-5 grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="rounded-xl border border-border bg-card p-4">
            <h2 className="font-semibold">Categorias</h2>
            <div className="mt-3 space-y-2">
              {categories.map((category) => (
                <div key={category.id} className="rounded-lg border border-border px-3 py-2">
                  <p className="text-sm font-medium">{category.nome}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {category.publica ? "Publicada" : "Oculta"}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Nova categoria"
                className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-xs"
              />
              <button
                onClick={() => void createCategory()}
                disabled={acting || !newCategory.trim()}
                className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </aside>

          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex flex-wrap gap-3 border-b border-border p-4">
              <div className="relative min-w-[220px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={articleQuery}
                  onChange={(e) => setArticleQuery(e.target.value)}
                  placeholder="Pesquisar artigos"
                  className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm"
                />
              </div>
              <button
                onClick={newArticle}
                className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground"
              >
                <Plus className="h-4 w-4" />
                Novo artigo
              </button>
            </div>
            {articles.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="Nenhum artigo"
                description="Crie o primeiro conteúdo persistido da Central de Ajuda."
              />
            ) : (
              <div className="divide-y divide-border">
                {articles.map((article) => (
                  <button
                    key={article.id}
                    onClick={() => editArticle(article)}
                    className="w-full p-4 text-left hover:bg-muted/30"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium">{article.titulo}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {article.categoria_nome ?? "Sem categoria"} · {article.status}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(article.updated_at)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {tab === "channels" && (
        <section className="mt-5 rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold">Canais publicados</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Só canais ativos com valor real aparecem para o usuário.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {channels.map((channel) => (
              <div key={channel.canal} className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium capitalize">{channel.canal}</p>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={channel.ativo}
                      onChange={(e) =>
                        updateChannel(channel.canal, { ativo: e.target.checked })
                      }
                    />
                    Ativo
                  </label>
                </div>
                <input
                  value={channel.label}
                  onChange={(e) =>
                    updateChannel(channel.canal, { label: e.target.value })
                  }
                  className="mt-3 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  placeholder="Rótulo"
                />
                {channel.canal !== "portal" && (
                  <input
                    value={channel.valor ?? ""}
                    onChange={(e) =>
                      updateChannel(channel.canal, { valor: e.target.value })
                    }
                    className="mt-2 h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    placeholder="Valor real do canal"
                  />
                )}
                <button
                  onClick={() => void saveChannel(channel)}
                  disabled={acting}
                  className="mt-3 rounded-lg border border-border px-3 py-2 text-xs font-medium disabled:opacity-50"
                >
                  Salvar canal
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {selectedTicket && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
          <section className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-card">
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-5">
              <div>
                <p className="font-mono text-xs text-muted-foreground">
                  {selectedTicket.protocolo} · {selectedTicket.empresa_nome}
                </p>
                <h2 className="mt-1 text-lg font-semibold">{selectedTicket.assunto}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedTicket.solicitante}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={selectedTicket.status}
                  onChange={(e) => void changeStatus(e.target.value)}
                  disabled={acting}
                  className="h-9 rounded-lg border border-border bg-background px-3 text-xs"
                >
                  {Object.entries(statusLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="rounded-lg p-2 hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {messages.map((item) => {
                const support =
                  item.sender_type === "agente" ||
                  item.sender_type === "sistema" ||
                  item.sender_type === "bot";
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "max-w-[85%] rounded-xl border p-4",
                      support
                        ? "ml-auto border-destructive/15 bg-destructive/5"
                        : "border-border bg-muted/40",
                    )}
                  >
                    <p className="text-xs font-medium">
                      {item.sender_name}
                      {item.is_automatic && (
                        <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[9px] uppercase text-muted-foreground">
                          automática
                        </span>
                      )}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm">{item.body}</p>
                    {item.attachments.map((attachment) => (
                      <button
                        key={attachment.id}
                        onClick={() => void openAttachment(attachment.storage_path)}
                        className="mt-2 flex items-center gap-1.5 text-xs text-primary hover:underline"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        {attachment.file_name}
                      </button>
                    ))}
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      {formatDateTime(item.created_at)}
                    </p>
                  </div>
                );
              })}
            </div>

            {!["fechado", "resolvido"].includes(selectedTicket.status) && (
              <footer className="border-t border-border p-4">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={3}
                  placeholder="Responder como suporte"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs">
                    <Paperclip className="h-3.5 w-3.5" />
                    {replyFile ? replyFile.name : "Anexar"}
                    <input
                      type="file"
                      className="sr-only"
                      accept="image/jpeg,image/png,image/webp,application/pdf,text/plain"
                      onChange={(e) => setReplyFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  <button
                    onClick={() => void replyTicket()}
                    disabled={acting || !reply.trim()}
                    className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    {acting ? "Enviando..." : "Responder"}
                  </button>
                </div>
              </footer>
            )}
          </section>
        </div>
      )}

      {articleOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
          <section className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  {articleForm.id ? "Editar artigo" : "Novo artigo"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Conteúdo é renderizado como texto seguro na Central de Ajuda.
                </p>
              </div>
              <button
                onClick={() => setArticleOpen(false)}
                className="rounded-lg p-2 hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <input
                value={articleForm.titulo}
                onChange={(e) =>
                  setArticleForm({ ...articleForm, titulo: e.target.value })
                }
                placeholder="Título"
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
              />
              <input
                value={articleForm.resumo}
                onChange={(e) =>
                  setArticleForm({ ...articleForm, resumo: e.target.value })
                }
                placeholder="Resumo"
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
              />
              <textarea
                value={articleForm.conteudo}
                onChange={(e) =>
                  setArticleForm({ ...articleForm, conteudo: e.target.value })
                }
                rows={14}
                placeholder="Conteúdo do artigo"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  value={articleForm.categoria_id}
                  onChange={(e) =>
                    setArticleForm({
                      ...articleForm,
                      categoria_id: e.target.value,
                    })
                  }
                  className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                >
                  <option value="">Sem categoria</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.nome}
                    </option>
                  ))}
                </select>
                <select
                  value={articleForm.status}
                  onChange={(e) =>
                    setArticleForm({ ...articleForm, status: e.target.value })
                  }
                  className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                >
                  <option value="rascunho">Rascunho</option>
                  <option value="publicado">Publicado</option>
                  <option value="arquivado">Arquivado</option>
                </select>
              </div>
              <div className="flex flex-wrap gap-5 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={articleForm.publico}
                    onChange={(e) =>
                      setArticleForm({
                        ...articleForm,
                        publico: e.target.checked,
                      })
                    }
                  />
                  Visível na Central de Ajuda
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={articleForm.destaque}
                    onChange={(e) =>
                      setArticleForm({
                        ...articleForm,
                        destaque: e.target.checked,
                      })
                    }
                  />
                  Destaque
                </label>
              </div>
              <button
                onClick={() => void saveArticle()}
                disabled={acting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {acting ? "Salvando..." : "Salvar artigo"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
