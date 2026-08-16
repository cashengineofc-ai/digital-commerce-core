import { useState } from "react";
import { MoreHorizontal, UserPlus, Mail, Trash2, Edit3, RefreshCw } from "lucide-react";
import { teamMembers, type TeamMember } from "@/lib/mock/data";
import { formatDateTime, formatInt } from "@/lib/format";
import { cn } from "@/lib/utils";

const statusMap: Record<TeamMember["status"], string> = {
  ativo: "bg-emerald-500/10 text-emerald-700",
  convite_pendente: "bg-amber-500/10 text-amber-700",
  inativo: "bg-muted text-muted-foreground",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function TeamPage() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Equipe</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Colaboradores, funções e últimos acessos.
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90">
          <UserPlus className="h-4 w-4" />
          Convidar membro
        </button>
      </header>

      <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-5 py-3 font-medium">Membro</th>
                <th className="px-5 py-3 font-medium">Função</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Último acesso</th>
                <th className="px-5 py-3 font-medium">Convidado em</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {teamMembers.map((m) => (
                <tr key={m.id} className="transition-colors hover:bg-muted/40">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                          m.role === "Proprietário"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {initials(m.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{m.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">{m.role}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                        statusMap[m.status],
                      )}
                    >
                      {m.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 tabular-nums text-muted-foreground">
                    {m.lastAccess ? formatDateTime(m.lastAccess) : "—"}
                  </td>
                  <td className="px-5 py-3.5 tabular-nums text-muted-foreground">
                    {formatDateTime(m.createdAt)}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="relative inline-block">
                      <button
                        onClick={() => setOpenMenu(openMenu === m.id ? null : m.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition hover:bg-muted"
                        aria-label="Ações"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {openMenu === m.id ? (
                        <div className="absolute right-0 z-10 mt-1 w-48 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
                          <button
                            onClick={() => setOpenMenu(null)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground hover:bg-muted"
                          >
                            <Edit3 className="h-3.5 w-3.5 text-muted-foreground" />
                            Editar função
                          </button>
                          {m.status === "convite_pendente" ? (
                            <button
                              onClick={() => setOpenMenu(null)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground hover:bg-muted"
                            >
                              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                              Reenviar convite
                            </button>
                          ) : null}
                          <button
                            onClick={() => setOpenMenu(null)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-rose-600 hover:bg-rose-500/5"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remover
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
          <span>{formatInt(teamMembers.length)} membros</span>
          <span className="inline-flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" />
            Convites enviados por e-mail
          </span>
        </div>
      </section>
    </div>
  );
}
