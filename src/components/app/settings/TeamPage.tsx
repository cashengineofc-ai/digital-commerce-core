import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Copy,
  Mail,
  MoreHorizontal,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime, formatInt } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/app/EmptyState";

type Member = {
  membro_id: string | null;
  profile_id: string;
  nome: string;
  email: string;
  avatar_url: string | null;
  cargo: string;
  status: string;
  ultimo_acesso: string | null;
  created_at: string;
  role_id: string | null;
  role_nome: string | null;
  is_owner: boolean;
};

type Role = {
  id: string;
  nome: string;
  descricao: string | null;
  nivel: number;
  is_sistema: boolean;
  is_admin: boolean;
};

type Invite = {
  id: string;
  email: string;
  nome: string | null;
  cargo: string | null;
  role_id: string | null;
  role_nome: string | null;
  status: string;
  expira_em: string;
  created_at: string;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "CE";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0] + parts[parts.length - 1]![0]).toUpperCase();
}

function statusClass(status: string) {
  if (status === "ativo") return "bg-emerald-500/10 text-emerald-700";
  if (status === "pendente") return "bg-amber-500/10 text-amber-700";
  if (status === "suspenso") return "bg-orange-500/10 text-orange-700";
  return "bg-muted text-muted-foreground";
}

export function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState("");
  const [inviteForm, setInviteForm] = useState({
    email: "",
    nome: "",
    cargo: "",
    role_id: "",
    expira_dias: "7",
  });

  const [roleMember, setRoleMember] = useState<Member | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [removeMember, setRemoveMember] = useState<Member | null>(null);
  const [removeReason, setRemoveReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [memberResult, roleResult, inviteResult] = await Promise.all([
        (supabase as any).rpc("fn_equipe_listar"),
        (supabase as any).rpc("fn_roles_listar"),
        (supabase as any).rpc("fn_equipe_convites_listar"),
      ]);

      if (memberResult.error) throw memberResult.error;
      if (roleResult.error) throw roleResult.error;
      if (inviteResult.error) throw inviteResult.error;

      setMembers(
        ((memberResult.data ?? []) as any[]).map((row) => ({
          membro_id: row.membro_id ? String(row.membro_id) : null,
          profile_id: String(row.profile_id),
          nome: String(row.nome ?? "Membro"),
          email: String(row.email ?? ""),
          avatar_url: row.avatar_url ? String(row.avatar_url) : null,
          cargo: String(row.cargo ?? "Membro"),
          status: String(row.status ?? "ativo"),
          ultimo_acesso: row.ultimo_acesso ? String(row.ultimo_acesso) : null,
          created_at: String(row.created_at),
          role_id: row.role_id ? String(row.role_id) : null,
          role_nome: row.role_nome ? String(row.role_nome) : null,
          is_owner: Boolean(row.is_owner),
        })),
      );

      setRoles(
        ((roleResult.data ?? []) as any[]).map((row) => ({
          id: String(row.id),
          nome: String(row.nome),
          descricao: row.descricao ? String(row.descricao) : null,
          nivel: Number(row.nivel ?? 0),
          is_sistema: Boolean(row.is_sistema),
          is_admin: Boolean(row.is_admin),
        })),
      );

      setInvites(
        ((inviteResult.data ?? []) as any[]).map((row) => ({
          id: String(row.id),
          email: String(row.email ?? ""),
          nome: row.nome ? String(row.nome) : null,
          cargo: row.cargo ? String(row.cargo) : null,
          role_id: row.role_id ? String(row.role_id) : null,
          role_nome: row.role_nome ? String(row.role_nome) : null,
          status: String(row.status ?? "pendente"),
          expira_em: String(row.expira_em),
          created_at: String(row.created_at),
        })),
      );
    } catch (cause) {
      setMembers([]);
      setRoles([]);
      setInvites([]);
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar a equipe.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeMembers = useMemo(
    () => members.filter((member) => member.status === "ativo"),
    [members],
  );

  function openInvite() {
    const defaultRole =
      roles.find((role) => !role.is_admin)?.id ?? roles.at(0)?.id ?? "";
    setInviteForm({
      email: "",
      nome: "",
      cargo: "",
      role_id: defaultRole,
      expira_dias: "7",
    });
    setGeneratedInviteUrl("");
    setError(null);
    setMessage(null);
    setInviteOpen(true);
  }

  async function createInvite() {
    const days = Number(inviteForm.expira_dias);
    if (
      !inviteForm.email.trim() ||
      !inviteForm.cargo.trim() ||
      !inviteForm.role_id ||
      !Number.isInteger(days) ||
      days < 1 ||
      days > 30
    ) {
      setError("Revise e-mail, cargo, função e validade do convite.");
      return;
    }

    setActing(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_equipe_convite_criar",
        {
          p_email: inviteForm.email.trim(),
          p_nome: inviteForm.nome.trim() || null,
          p_cargo: inviteForm.cargo.trim(),
          p_role_id: inviteForm.role_id,
          p_expira_dias: days,
        },
      );
      if (rpcError) throw rpcError;

      const code = String(data?.code ?? "");
      const token = String(data?.token ?? "");
      if (!code || !token) throw new Error("O banco não retornou o convite.");

      setGeneratedInviteUrl(
        `${window.location.origin}/convite-equipe/${encodeURIComponent(
          code,
        )}?token=${encodeURIComponent(token)}`,
      );
      setMessage(
        "Convite criado. Nenhum e-mail foi marcado como enviado; copie o link seguro.",
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível criar o convite.",
      );
    } finally {
      setActing(false);
    }
  }

  async function revokeInvite(id: string) {
    setActing(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_equipe_convite_revogar",
        { p_invite_id: id },
      );
      if (rpcError) throw rpcError;
      if (!data) throw new Error("O convite já não estava pendente.");
      setMessage("Convite revogado.");
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível revogar.",
      );
    } finally {
      setActing(false);
    }
  }

  function openRole(member: Member) {
    setRoleMember(member);
    setSelectedRoleId(member.role_id ?? roles.at(0)?.id ?? "");
    setOpenMenu(null);
  }

  async function saveRole() {
    if (!roleMember || !selectedRoleId) return;
    setActing(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_equipe_role_definir",
        {
          p_profile_id: roleMember.profile_id,
          p_role_id: selectedRoleId,
        },
      );
      if (rpcError) throw rpcError;
      if (!data) throw new Error("A função não foi atualizada.");
      setRoleMember(null);
      setMessage("Função atualizada. O acesso será revalidado pelo backend.");
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível alterar a função.",
      );
    } finally {
      setActing(false);
    }
  }

  async function remove() {
    if (!removeMember || !removeReason.trim()) {
      setError("Informe o motivo da remoção.");
      return;
    }
    setActing(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_equipe_remover",
        {
          p_profile_id: removeMember.profile_id,
          p_motivo: removeReason.trim(),
        },
      );
      if (rpcError) throw rpcError;
      if (!data) throw new Error("O membro não foi removido.");
      setRemoveMember(null);
      setRemoveReason("");
      setMessage(
        "Membro removido. Roles, contexto da empresa e sessões registradas foram revogados.",
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível remover o membro.",
      );
    } finally {
      setActing(false);
    }
  }

  async function copyInvite() {
    if (!generatedInviteUrl) return;
    await navigator.clipboard.writeText(generatedInviteUrl);
    setMessage("Link do convite copiado.");
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Equipe
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Membros, convites, funções e acessos reais da empresa atual.
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
            onClick={openInvite}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            <UserPlus className="h-4 w-4" />
            Convidar membro
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

      <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Carregando equipe...
          </div>
        ) : members.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title="Nenhum membro encontrado"
            description="O estado vazio não é preenchido com membros demonstrativos."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Membro</th>
                  <th className="px-5 py-3 font-medium">Cargo</th>
                  <th className="px-5 py-3 font-medium">Função</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Último acesso</th>
                  <th className="px-5 py-3 font-medium">Vínculo desde</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {members.map((member) => (
                  <tr key={member.profile_id} className="hover:bg-muted/40">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {member.avatar_url ? (
                          <img
                            src={member.avatar_url}
                            alt=""
                            className="h-9 w-9 rounded-full object-cover"
                          />
                        ) : (
                          <span
                            className={cn(
                              "flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold",
                              member.is_owner
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            {initials(member.nome)}
                          </span>
                        )}
                        <div>
                          <p className="font-medium">{member.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {member.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                      {member.cargo}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                        {member.is_owner
                          ? "Proprietário"
                          : member.role_nome ?? "Sem função"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                          statusClass(member.status),
                        )}
                      >
                        {member.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                      {member.ultimo_acesso
                        ? formatDateTime(member.ultimo_acesso)
                        : "Nunca registrado"}
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                      {formatDateTime(member.created_at)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {!member.is_owner && (
                        <div className="relative inline-block">
                          <button
                            onClick={() =>
                              setOpenMenu(
                                openMenu === member.profile_id
                                  ? null
                                  : member.profile_id,
                              )
                            }
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border"
                            aria-label="Ações"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          {openMenu === member.profile_id && (
                            <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
                              <button
                                onClick={() => openRole(member)}
                                className="w-full px-3 py-2 text-left text-xs hover:bg-muted"
                              >
                                Alterar função
                              </button>
                              <button
                                onClick={() => {
                                  setRemoveMember(member);
                                  setOpenMenu(null);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-destructive hover:bg-destructive/5"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Remover acesso
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
          <span>{formatInt(activeMembers.length)} membros ativos</span>
          <span>
            Convites por e-mail só ficam ativos quando houver provedor configurado
          </span>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-semibold">Convites</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Convites pendentes podem ser revogados; tokens não são recuperáveis.
          </p>
        </div>
        {invites.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhum convite criado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3">Convidado</th>
                  <th className="px-5 py-3">Cargo</th>
                  <th className="px-5 py-3">Função</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Expira</th>
                  <th className="px-5 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invites.map((invite) => (
                  <tr key={invite.id}>
                    <td className="px-5 py-3.5">
                      <p className="font-medium">{invite.nome || invite.email}</p>
                      {invite.nome && (
                        <p className="text-xs text-muted-foreground">
                          {invite.email}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                      {invite.cargo ?? "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      {invite.role_nome ?? "Sem função"}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                          statusClass(invite.status),
                        )}
                      >
                        {invite.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                      {formatDateTime(invite.expira_em)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {invite.status === "pendente" && (
                        <button
                          onClick={() => void revokeInvite(invite.id)}
                          disabled={acting}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium"
                        >
                          Revogar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {inviteOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">Convidar membro</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  O link só poderá ser aceito pelo e-mail convidado.
                </p>
              </div>
              <button onClick={() => setInviteOpen(false)} className="rounded-lg p-2 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            {generatedInviteUrl ? (
              <div className="mt-5">
                <div className="rounded-xl border border-border bg-background p-4">
                  <p className="text-sm font-medium">Link seguro</p>
                  <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
                    {generatedInviteUrl}
                  </p>
                </div>
                <button
                  onClick={() => void copyInvite()}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                >
                  <Copy className="h-4 w-4" />
                  Copiar link
                </button>
                <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  Nenhum e-mail foi marcado como enviado neste fluxo.
                </p>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="text-sm font-medium">E-mail</span>
                  <input
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, email: e.target.value })
                    }
                    className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Nome</span>
                  <input
                    value={inviteForm.nome}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, nome: e.target.value })
                    }
                    className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Cargo</span>
                  <input
                    value={inviteForm.cargo}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, cargo: e.target.value })
                    }
                    className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Função</span>
                  <select
                    value={inviteForm.role_id}
                    onChange={(e) =>
                      setInviteForm({ ...inviteForm, role_id: e.target.value })
                    }
                    className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.nome}
                        {role.is_admin ? " · administrativa" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Validade</span>
                  <select
                    value={inviteForm.expira_dias}
                    onChange={(e) =>
                      setInviteForm({
                        ...inviteForm,
                        expira_dias: e.target.value,
                      })
                    }
                    className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  >
                    <option value="1">1 dia</option>
                    <option value="3">3 dias</option>
                    <option value="7">7 dias</option>
                    <option value="14">14 dias</option>
                    <option value="30">30 dias</option>
                  </select>
                </label>
                <button
                  onClick={() => void createInvite()}
                  disabled={acting}
                  className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {acting ? "Criando..." : "Gerar convite seguro"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {roleMember && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">Alterar função</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {roleMember.nome}
                </p>
              </div>
              <button onClick={() => setRoleMember(null)} className="rounded-lg p-2 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <select
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
              className="mt-5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.nome}
                </option>
              ))}
            </select>
            <button
              onClick={() => void saveRole()}
              disabled={acting || !selectedRoleId}
              className="mt-5 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {acting ? "Salvando..." : "Salvar função"}
            </button>
          </div>
        </div>
      )}

      {removeMember && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">Remover acesso</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {removeMember.nome}
                </p>
              </div>
              <button onClick={() => setRemoveMember(null)} className="rounded-lg p-2 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <textarea
              value={removeReason}
              onChange={(e) => setRemoveReason(e.target.value)}
              placeholder="Motivo da remoção"
              rows={4}
              className="mt-5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-muted-foreground">
              A remoção revoga roles, contexto desta empresa e sessões registradas da empresa.
            </div>
            <button
              onClick={() => void remove()}
              disabled={acting || !removeReason.trim()}
              className="mt-5 w-full rounded-lg bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
            >
              {acting ? "Removendo..." : "Confirmar remoção"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
