import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  ChevronLeft,
  FileText,
  LifeBuoy,
  MessageCircle,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Send,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/app/EmptyState";

type Category = {
  id: string;
  nome: string;
  descricao: string | null;
  ordem: number;
};

type Article = {
  id: string;
  categoria_id: string | null;
  categoria_nome: string | null;
  titulo: string;
  resumo: string | null;
  conteudo: string;
  tempo_leitura_minutos: number | null;
  destaque: boolean;
  updated_at: string;
  total_records: number;
};

type Ticket = {
  id: string;
  protocolo: string;
  assunto: string;
  tipo: string;
  prioridade: string;
  status: string;
  categoria: string | null;
  updated_at: string;
  created_at: string;
  mensagens: number;
};

type Attachment = {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
};

type TicketMessage = {
  id: string;
  sender_name: string;
  sender_type: string;
  body: string;
  is_automatic: boolean;
  created_at: string;
  attachments: Attachment[];
};

type SupportChannel = {
  canal: string;
  label: string;
  valor: string | null;
  ativo: boolean;
};

const statusLabels: Record<string, string> = {
  aberto: "Aberto",
  respondido_cliente: "Aguardando atendimento",
  respondido_suporte: "Aguardando você",
  em_analise: "Em atendimento",
  pendente_terceiro: "Em análise externa",
  resolvido: "Resolvido",
  fechado: "Fechado",
  reaberto: "Reaberto",
};

export function HelpCenterPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [channels, setChannels] = useState<SupportChannel[]>([]);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [reply, setReply] = useState("");
  const [replyFile, setReplyFile] = useState<File | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [ticketForm, setTicketForm] = useState({
    assunto: "",
    descricao: "",
    tipo: "suporte",
    prioridade: "media",
    categoria: "",
  });
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 220);
    return () => window.clearTimeout(timer);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [categoryResult, articleResult, ticketResult, channelResult] =
        await Promise.all([
          (supabase as any).rpc("fn_ajuda_categorias"),
          (supabase as any).rpc("fn_ajuda_buscar", {
            p_query: debounced || null,
            p_categoria_id: categoryId || null,
            p_limit: 50,
            p_offset: 0,
          }),
          (supabase as any).rpc("fn_suporte_tickets_me"),
          (supabase as any)
            .from("suporte_canais_config")
            .select("canal,label,valor,ativo")
            .eq("ativo", true),
        ]);

      if (categoryResult.error) throw categoryResult.error;
      if (articleResult.error) throw articleResult.error;
      if (ticketResult.error) throw ticketResult.error;
      if (channelResult.error) throw channelResult.error;

      setCategories(
        ((categoryResult.data ?? []) as any[]).map((row) => ({
          id: String(row.id),
          nome: String(row.nome),
          descricao: row.descricao ? String(row.descricao) : null,
          ordem: Number(row.ordem ?? 0),
        })),
      );
      setArticles(
        ((articleResult.data ?? []) as any[]).map((row) => ({
          id: String(row.id),
          categoria_id: row.categoria_id ? String(row.categoria_id) : null,
          categoria_nome: row.categoria_nome
            ? String(row.categoria_nome)
            : null,
          titulo: String(row.titulo),
          resumo: row.resumo ? String(row.resumo) : null,
          conteudo: String(row.conteudo ?? ""),
          tempo_leitura_minutos:
            row.tempo_leitura_minutos == null
              ? null
              : Number(row.tempo_leitura_minutos),
          destaque: Boolean(row.destaque),
          updated_at: String(row.updated_at),
          total_records: Number(row.total_records ?? 0),
        })),
      );
      setTickets(
        ((ticketResult.data ?? []) as any[]).map((row) => ({
          id: String(row.id),
          protocolo: String(row.protocolo),
          assunto: String(row.assunto),
          tipo: String(row.tipo),
          prioridade: String(row.prioridade),
          status: String(row.status),
          categoria: row.categoria ? String(row.categoria) : null,
          updated_at: String(row.updated_at),
          created_at: String(row.created_at),
          mensagens: Number(row.mensagens ?? 0),
        })),
      );
      setChannels((channelResult.data ?? []) as unknown as SupportChannel[]);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar a Central de Ajuda.",
      );
    } finally {
      setLoading(false);
    }
  }, [debounced, categoryId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openTicket(ticket: Ticket) {
    setSelectedTicket(ticket);
    setSelectedArticle(null);
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
        sender_type: String(row.sender_type ?? "cliente"),
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

  async function createTicket() {
    if (
      ticketForm.assunto.trim().length < 3 ||
      ticketForm.descricao.trim().length < 5
    ) {
      setError("Informe assunto e descrição do chamado.");
      return;
    }

    setActing(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_suporte_ticket_criar",
        {
          p_assunto: ticketForm.assunto.trim(),
          p_descricao: ticketForm.descricao.trim(),
          p_tipo: ticketForm.tipo,
          p_prioridade: ticketForm.prioridade,
          p_categoria: ticketForm.categoria.trim() || null,
        },
      );
      if (rpcError) throw rpcError;
      if (!data) throw new Error("O chamado não foi criado.");

      setCreateOpen(false);
      setTicketForm({
        assunto: "",
        descricao: "",
        tipo: "suporte",
        prioridade: "media",
        categoria: "",
      });
      setMessage("Chamado criado no banco.");
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível abrir o chamado.",
      );
    } finally {
      setActing(false);
    }
  }

  async function sendReply() {
    if (!selectedTicket || !reply.trim()) {
      setError("Digite uma mensagem.");
      return;
    }

    setActing(true);
    setError(null);
    try {
      const { data: messageId, error: rpcError } = await (supabase as any).rpc(
        "fn_suporte_responder",
        {
          p_ticket_id: selectedTicket.id,
          p_mensagem: reply.trim(),
        },
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

        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw new Error("Sessão não encontrada.");

        const ticket = tickets.find((item) => item.id === selectedTicket.id);
        if (!ticket) throw new Error("Chamado não encontrado.");

        const companyResult = await (supabase as any).rpc("fn_empresas_autorizadas");
        if (companyResult.error) throw companyResult.error;
        const company = ((companyResult.data ?? []) as any[]).find(
          (item) => Boolean(item.contexto_ativo),
        );
        if (!company?.empresa_id) throw new Error("Empresa não identificada.");

        const safeName = replyFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath = `${String(company.empresa_id)}/${selectedTicket.id}/${crypto.randomUUID()}-${safeName}`;

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
      setMessage("Resposta enviada.");
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

  async function openAttachment(attachment: Attachment) {
    const { data, error: signedError } = await supabase.storage
      .from("support-attachments")
      .createSignedUrl(attachment.storage_path, 60);
    if (signedError || !data?.signedUrl) {
      setError(signedError?.message ?? "Não foi possível abrir o anexo.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  const filteredTickets = useMemo(() => tickets, [tickets]);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Central de Ajuda</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Artigos persistidos e atendimento vinculado à sua conta.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Atualizar
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            Abrir chamado
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

      {channels.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {channels.map((channel) => (
            <span
              key={channel.canal}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground"
            >
              {channel.label}
              {channel.valor ? `: ${channel.valor}` : ""}
            </span>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
        <section>
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pesquisar artigos"
                className="h-11 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button
                onClick={() => setCategoryId("")}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium",
                  !categoryId
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                Todos
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setCategoryId(category.id)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium",
                    categoryId === category.id
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {category.nome}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
                Carregando artigos...
              </div>
            ) : articles.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="Nenhum artigo encontrado"
                description="A busca não retorna conteúdo demonstrativo."
              />
            ) : (
              articles.map((article) => (
                <button
                  key={article.id}
                  onClick={() => {
                    setSelectedArticle(article);
                    setSelectedTicket(null);
                  }}
                  className="w-full rounded-xl border border-border bg-card p-5 text-left hover:bg-muted/30"
                >
                  <div className="flex items-start gap-3">
                    <FileText className="mt-0.5 h-5 w-5 text-primary" />
                    <div>
                      <p className="font-semibold">{article.titulo}</p>
                      {article.resumo && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {article.resumo}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-muted-foreground">
                        {article.categoria_nome ?? "Ajuda"}
                        {article.tempo_leitura_minutos
                          ? ` · ${article.tempo_leitura_minutos} min`
                          : ""}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <aside className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-semibold">Meus chamados</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Apenas chamados vinculados à sua conta.
            </p>
          </div>
          {filteredTickets.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhum chamado aberto.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => void openTicket(ticket)}
                  className="w-full p-4 text-left hover:bg-muted/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {ticket.protocolo}
                      </p>
                      <p className="mt-1 truncate text-sm font-medium">
                        {ticket.assunto}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px]">
                      {statusLabels[ticket.status] ?? ticket.status}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    <MessageCircle className="mr-1 inline h-3 w-3" />
                    {ticket.mensagens} mensagens · {formatDateTime(ticket.updated_at)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </aside>
      </div>

      {selectedArticle && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
          <article className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">
                  {selectedArticle.categoria_nome ?? "Ajuda"}
                </p>
                <h2 className="mt-1 text-2xl font-semibold">
                  {selectedArticle.titulo}
                </h2>
              </div>
              <button
                onClick={() => setSelectedArticle(null)}
                className="rounded-lg p-2 hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-6 whitespace-pre-wrap text-sm leading-7 text-foreground/90">
              {selectedArticle.conteudo}
            </div>
          </article>
        </div>
      )}

      {selectedTicket && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
          <section className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card">
            <header className="flex items-start justify-between border-b border-border p-5">
              <div>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Fechar
                </button>
                <p className="font-mono text-xs text-muted-foreground">
                  {selectedTicket.protocolo}
                </p>
                <h2 className="mt-1 font-semibold">{selectedTicket.assunto}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {statusLabels[selectedTicket.status] ?? selectedTicket.status}
                </p>
              </div>
              <LifeBuoy className="h-5 w-5 text-primary" />
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
                        ? "border-primary/15 bg-primary/5"
                        : "ml-auto border-border bg-muted/40",
                    )}
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-medium">{item.sender_name}</span>
                      {item.is_automatic && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] uppercase text-muted-foreground">
                          resposta automática
                        </span>
                      )}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm">{item.body}</p>
                    {item.attachments.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {item.attachments.map((attachment) => (
                          <button
                            key={attachment.id}
                            onClick={() => void openAttachment(attachment)}
                            className="flex items-center gap-2 text-xs text-primary hover:underline"
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                            {attachment.file_name}
                          </button>
                        ))}
                      </div>
                    )}
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
                  placeholder="Escreva sua resposta"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
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
                    onClick={() => void sendReply()}
                    disabled={acting || !reply.trim()}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    {acting ? "Enviando..." : "Enviar"}
                  </button>
                </div>
              </footer>
            )}
          </section>
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">Abrir chamado</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Nenhum prazo ou canal externo é inventado pelo sistema.
                </p>
              </div>
              <button
                onClick={() => setCreateOpen(false)}
                className="rounded-lg p-2 hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-medium">Assunto</span>
                <input
                  value={ticketForm.assunto}
                  onChange={(e) =>
                    setTicketForm({ ...ticketForm, assunto: e.target.value })
                  }
                  className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Descrição</span>
                <textarea
                  rows={5}
                  value={ticketForm.descricao}
                  onChange={(e) =>
                    setTicketForm({ ...ticketForm, descricao: e.target.value })
                  }
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="text-sm font-medium">Tipo</span>
                  <select
                    value={ticketForm.tipo}
                    onChange={(e) =>
                      setTicketForm({ ...ticketForm, tipo: e.target.value })
                    }
                    className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  >
                    <option value="suporte">Suporte</option>
                    <option value="duvida">Dúvida</option>
                    <option value="bug">Bug</option>
                    <option value="financeiro">Financeiro</option>
                    <option value="sugestao">Sugestão</option>
                    <option value="reclamacao">Reclamação</option>
                  </select>
                </label>
                <label>
                  <span className="text-sm font-medium">Prioridade</span>
                  <select
                    value={ticketForm.prioridade}
                    onChange={(e) =>
                      setTicketForm({
                        ...ticketForm,
                        prioridade: e.target.value,
                      })
                    }
                    className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  >
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                    <option value="critica">Crítica</option>
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="text-sm font-medium">Categoria</span>
                <input
                  value={ticketForm.categoria}
                  onChange={(e) =>
                    setTicketForm({ ...ticketForm, categoria: e.target.value })
                  }
                  placeholder="Opcional"
                  className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </label>
              <button
                onClick={() => void createTicket()}
                disabled={acting}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {acting ? "Criando..." : "Criar chamado"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
