import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  LockKeyhole,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatInt } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/app/EmptyState";

type Permission = {
  id: string;
  modulo: string;
  recurso: string;
  acao: string;
  nome_exibicao: string;
  descricao: string | null;
};

type Role = {
  id: string;
  nome: string;
  descricao: string | null;
  nivel: number;
  is_sistema: boolean;
  is_admin: boolean;
  membros: number;
  permissoes: string[];
};

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    create: "Criar",
    read: "Visualizar",
    update: "Editar",
    delete: "Excluir",
    approve: "Aprovar",
    manage: "Gerenciar",
  };
  return labels[action] ?? action;
}

export function PermissionsPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [editorRole, setEditorRole] = useState<Role | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(
    new Set(),
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    nome: "",
    descricao: "",
  });
  const [createPermissions, setCreatePermissions] = useState<Set<string>>(
    new Set(),
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [roleResult, permissionResult] = await Promise.all([
        (supabase as any).rpc("fn_roles_listar"),
        (supabase as any).rpc("fn_permissions_listar"),
      ]);

      if (roleResult.error) throw roleResult.error;
      if (permissionResult.error) throw permissionResult.error;

      setRoles(
        ((roleResult.data ?? []) as any[]).map((row) => ({
          id: String(row.id),
          nome: String(row.nome),
          descricao: row.descricao ? String(row.descricao) : null,
          nivel: Number(row.nivel ?? 0),
          is_sistema: Boolean(row.is_sistema),
          is_admin: Boolean(row.is_admin),
          membros: Number(row.membros ?? 0),
          permissoes: Array.isArray(row.permissoes)
            ? row.permissoes.map(String)
            : [],
        })),
      );

      setPermissions(
        ((permissionResult.data ?? []) as any[]).map((row) => ({
          id: String(row.id),
          modulo: String(row.modulo),
          recurso: String(row.recurso),
          acao: String(row.acao),
          nome_exibicao: String(row.nome_exibicao),
          descricao: row.descricao ? String(row.descricao) : null,
        })),
      );
    } catch (cause) {
      setRoles([]);
      setPermissions([]);
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar as permissões.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const permissionsByModule = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const permission of permissions) {
      const list = map.get(permission.modulo) ?? [];
      list.push(permission);
      map.set(permission.modulo, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  }, [permissions]);

  const modules = useMemo(
    () => [...new Set(permissions.map((permission) => permission.modulo))].sort(),
    [permissions],
  );

  function openEditor(role: Role) {
    setEditorRole(role);
    setSelectedPermissions(new Set(role.permissoes));
    setError(null);
    setMessage(null);
  }

  function togglePermission(
    id: string,
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
  ) {
    setter((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function saveRole() {
    if (!editorRole || editorRole.is_sistema) return;
    setActing(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_role_permissoes_salvar",
        {
          p_role_id: editorRole.id,
          p_permission_ids: [...selectedPermissions],
        },
      );
      if (rpcError) throw rpcError;
      if (!data) throw new Error("As permissões não foram salvas.");
      setEditorRole(null);
      setMessage(
        "Permissões atualizadas. Operações protegidas serão revalidadas pelo backend.",
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível salvar.",
      );
    } finally {
      setActing(false);
    }
  }

  function openCreate() {
    setCreateForm({ nome: "", descricao: "" });
    setCreatePermissions(new Set());
    setCreateOpen(true);
    setError(null);
    setMessage(null);
  }

  async function createRole() {
    if (!createForm.nome.trim()) {
      setError("Informe o nome da função.");
      return;
    }
    setActing(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_role_criar",
        {
          p_nome: createForm.nome.trim(),
          p_descricao: createForm.descricao.trim() || null,
          p_permission_ids: [...createPermissions],
        },
      );
      if (rpcError) throw rpcError;
      if (!data) throw new Error("A função não foi criada.");
      setCreateOpen(false);
      setMessage(
        "Função criada para esta empresa. Ela não concede administração global da plataforma.",
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível criar a função.",
      );
    } finally {
      setActing(false);
    }
  }

  function roleHasModule(role: Role, module: string) {
    if (role.is_admin) return true;
    return permissions.some(
      (permission) =>
        permission.modulo === module && role.permissoes.includes(permission.id),
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1450px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Permissões
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Funções e permissões reais aplicadas pelo backend.
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
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            Criar função
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
        <strong className="text-foreground">Admin da empresa ≠ Admin da plataforma.</strong>{" "}
        Esta tela nunca altera <code>is_admin_global</code>. Roles globais do sistema são
        somente leitura; para personalizar, crie uma função da empresa.
      </div>

      <section className="mt-6">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Carregando funções...
          </div>
        ) : roles.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="Nenhuma função disponível"
            description="Nenhuma função demonstrativa é adicionada pela interface."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {roles.map((role) => (
              <article
                key={role.id}
                className="flex h-full flex-col rounded-xl border border-border bg-card p-5"
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                    {role.is_sistema ? (
                      <LockKeyhole className="h-4 w-4" />
                    ) : (
                      <ShieldCheck className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{role.nome}</h2>
                      {role.is_admin && (
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                          admin da empresa
                        </span>
                      )}
                      {role.is_sistema && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                          sistema
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {role.descricao || "Sem descrição"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  {formatInt(role.membros)} membro{role.membros === 1 ? "" : "s"}
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {modules
                    .filter((module) => roleHasModule(role, module))
                    .slice(0, 8)
                    .map((module) => (
                      <span
                        key={module}
                        className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {module}
                      </span>
                    ))}
                </div>

                <button
                  onClick={() => openEditor(role)}
                  className="mt-5 w-full rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted"
                >
                  {role.is_sistema ? "Consultar permissões" : "Gerenciar permissões"}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8 overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-semibold">Matriz por módulo</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Um marcador indica que a função possui ao menos uma permissão naquele módulo.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="sticky left-0 bg-muted/40 px-5 py-3">Função</th>
                {modules.map((module) => (
                  <th key={module} className="px-3 py-3 text-center whitespace-nowrap">
                    {module}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {roles.map((role) => (
                <tr key={role.id}>
                  <td className="sticky left-0 bg-card px-5 py-3 font-medium">
                    {role.nome}
                  </td>
                  {modules.map((module) => (
                    <td key={module} className="px-3 py-3 text-center">
                      {roleHasModule(role, module) ? (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        </span>
                      ) : (
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editorRole && (
        <PermissionEditor
          title={editorRole.nome}
          description={editorRole.descricao}
          readOnly={editorRole.is_sistema}
          groups={permissionsByModule}
          selected={selectedPermissions}
          onToggle={(id) => togglePermission(id, setSelectedPermissions)}
          onClose={() => setEditorRole(null)}
          onSave={() => void saveRole()}
          acting={acting}
        />
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-card p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">Nova função da empresa</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Funções personalizadas nunca concedem administração global.
                </p>
              </div>
              <button onClick={() => setCreateOpen(false)} className="rounded-lg p-2 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label>
                <span className="text-sm font-medium">Nome</span>
                <input
                  value={createForm.nome}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, nome: e.target.value })
                  }
                  className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </label>
              <label>
                <span className="text-sm font-medium">Descrição</span>
                <input
                  value={createForm.descricao}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, descricao: e.target.value })
                  }
                  className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                />
              </label>
            </div>

            <PermissionGrid
              groups={permissionsByModule}
              selected={createPermissions}
              onToggle={(id) => togglePermission(id, setCreatePermissions)}
              readOnly={false}
            />

            <button
              onClick={() => void createRole()}
              disabled={acting || !createForm.nome.trim()}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {acting ? "Criando..." : "Criar função"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PermissionGrid({
  groups,
  selected,
  onToggle,
  readOnly,
}: {
  groups: Array<[string, Permission[]]>;
  selected: Set<string>;
  onToggle: (id: string) => void;
  readOnly: boolean;
}) {
  return (
    <div className="mt-5 space-y-4">
      {groups.map(([module, items]) => (
        <section key={module} className="rounded-xl border border-border p-4">
          <h3 className="text-sm font-semibold capitalize">{module}</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {items.map((permission) => (
              <label
                key={permission.id}
                className={cn(
                  "flex items-start gap-3 rounded-lg border border-border p-3 text-sm",
                  readOnly ? "cursor-default opacity-80" : "cursor-pointer",
                )}
              >
                <input
                  type="checkbox"
                  checked={selected.has(permission.id)}
                  onChange={() => onToggle(permission.id)}
                  disabled={readOnly}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">
                    {permission.nome_exibicao || actionLabel(permission.acao)}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {permission.recurso} · {actionLabel(permission.acao)}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function PermissionEditor({
  title,
  description,
  readOnly,
  groups,
  selected,
  onToggle,
  onClose,
  onSave,
  acting,
}: {
  title: string;
  description: string | null;
  readOnly: boolean;
  groups: Array<[string, Permission[]]>;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onClose: () => void;
  onSave: () => void;
  acting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {description || "Sem descrição"}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {readOnly && (
          <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-muted-foreground">
            Esta é uma função global do sistema e não pode ser alterada por uma empresa.
          </div>
        )}

        <PermissionGrid
          groups={groups}
          selected={selected}
          onToggle={onToggle}
          readOnly={readOnly}
        />

        {!readOnly && (
          <button
            onClick={onSave}
            disabled={acting}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {acting ? "Salvando..." : "Salvar permissões"}
          </button>
        )}
      </div>
    </div>
  );
}
