import { useCallback, useEffect, useState } from "react";
import {
  Check,
  KeyRound,
  Lock,
  LogOut,
  Monitor,
  RefreshCw,
  ShieldAlert,
  Smartphone,
  X,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type AuditEvent = {
  id: string;
  acao: string;
  descricao: string;
  modulo: string | null;
  ip_address: string | null;
  user_agent: string | null;
  cidade: string | null;
  pais: string | null;
  status_resposta: number | null;
  risco_nivel: string | null;
  created_at: string;
};

type SessionRecord = {
  id: string;
  navegador: string | null;
  sistema_operacional: string | null;
  dispositivo: string | null;
  dispositivo_tipo: string | null;
  ip_address: string | null;
  cidade: string | null;
  regiao: string | null;
  pais: string | null;
  status: string;
  data_ultima_atividade: string;
  data_login: string;
  data_expiracao: string;
};

type TotpEnrollment = {
  factorId: string;
  qr: string;
  secret: string;
};

export function SecurityPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [sessionRecords, setSessionRecords] = useState<SessionRecord[]>([]);
  const [currentSession, setCurrentSession] = useState<{
    expiresAt: number | null;
    userAgent: string;
  } | null>(null);
  const [totpFactors, setTotpFactors] = useState<any[]>([]);
  const [aal, setAal] = useState<{ currentLevel: string | null; nextLevel: string | null }>({
    currentLevel: null,
    nextLevel: null,
  });
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        sessionResult,
        factorResult,
        aalResult,
        eventResult,
        recordsResult,
      ] = await Promise.all([
        supabase.auth.getSession(),
        supabase.auth.mfa.listFactors(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        (supabase as any).rpc("fn_seguranca_eventos_me", { p_limit: 50 }),
        (supabase as any).rpc("fn_seguranca_sessoes_me"),
      ]);

      if (sessionResult.error) throw sessionResult.error;
      if (factorResult.error) throw factorResult.error;
      if (aalResult.error) throw aalResult.error;
      if (eventResult.error) throw eventResult.error;
      if (recordsResult.error) throw recordsResult.error;

      setCurrentSession(
        sessionResult.data.session
          ? {
              expiresAt: sessionResult.data.session.expires_at ?? null,
              userAgent: navigator.userAgent,
            }
          : null,
      );
      setTotpFactors(factorResult.data.totp ?? []);
      setAal({
        currentLevel: aalResult.data.currentLevel ?? null,
        nextLevel: aalResult.data.nextLevel ?? null,
      });

      setEvents(
        ((eventResult.data ?? []) as any[]).map((row) => ({
          id: String(row.id),
          acao: String(row.acao ?? ""),
          descricao: String(row.descricao ?? ""),
          modulo: row.modulo ? String(row.modulo) : null,
          ip_address: row.ip_address ? String(row.ip_address) : null,
          user_agent: row.user_agent ? String(row.user_agent) : null,
          cidade: row.cidade ? String(row.cidade) : null,
          pais: row.pais ? String(row.pais) : null,
          status_resposta:
            row.status_resposta == null ? null : Number(row.status_resposta),
          risco_nivel: row.risco_nivel ? String(row.risco_nivel) : null,
          created_at: String(row.created_at),
        })),
      );

      setSessionRecords(
        ((recordsResult.data ?? []) as any[]).map((row) => ({
          id: String(row.id),
          navegador: row.navegador ? String(row.navegador) : null,
          sistema_operacional: row.sistema_operacional
            ? String(row.sistema_operacional)
            : null,
          dispositivo: row.dispositivo ? String(row.dispositivo) : null,
          dispositivo_tipo: row.dispositivo_tipo
            ? String(row.dispositivo_tipo)
            : null,
          ip_address: row.ip_address ? String(row.ip_address) : null,
          cidade: row.cidade ? String(row.cidade) : null,
          regiao: row.regiao ? String(row.regiao) : null,
          pais: row.pais ? String(row.pais) : null,
          status: String(row.status ?? ""),
          data_ultima_atividade: String(row.data_ultima_atividade),
          data_login: String(row.data_login),
          data_expiracao: String(row.data_expiracao),
        })),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar as configurações de segurança.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function startTotp() {
    setActing(true);
    setError(null);
    setMessage(null);
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Cash Engine PRO",
        issuer: "Cash Engine PRO",
      });
      if (enrollError) throw enrollError;
      if (!data.totp?.qr_code || !data.id) {
        if (data.id) {
          await supabase.auth.mfa.unenroll({ factorId: data.id }).catch(() => undefined);
        }
        throw new Error("O provedor não retornou os dados do TOTP.");
      }
      setEnrollment({
        factorId: data.id,
        qr: data.totp.qr_code,
        secret: data.totp.secret,
      });
      setVerifyCode("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível iniciar o 2FA.",
      );
    } finally {
      setActing(false);
    }
  }

  async function verifyTotp() {
    if (!enrollment || verifyCode.trim().length < 6) {
      setError("Digite o código atual do aplicativo autenticador.");
      return;
    }

    setActing(true);
    setError(null);
    try {
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({
          factorId: enrollment.factorId,
        });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollment.factorId,
        challengeId: challenge.id,
        code: verifyCode.trim(),
      });
      if (verifyError) throw verifyError;

      setEnrollment(null);
      setVerifyCode("");
      setMessage("Autenticação TOTP ativada e verificada pelo provedor.");
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível verificar o 2FA.",
      );
    } finally {
      setActing(false);
    }
  }

  async function cancelTotpEnrollment() {
    if (!enrollment || acting) return;

    setActing(true);
    setError(null);
    try {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId: enrollment.factorId,
      });
      if (unenrollError) throw unenrollError;

      setEnrollment(null);
      setVerifyCode("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível cancelar a configuração do 2FA.",
      );
    } finally {
      setActing(false);
    }
  }

  async function disableTotp(factorId: string) {
    if (
      !window.confirm(
        "Desativar este fator TOTP? Você perderá essa segunda camada de autenticação.",
      )
    ) {
      return;
    }
    setActing(true);
    setError(null);
    try {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId,
      });
      if (unenrollError) throw unenrollError;
      setMessage("Fator TOTP removido pelo provedor.");
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível remover o 2FA.",
      );
    } finally {
      setActing(false);
    }
  }

  async function signOutOtherSessions() {
    if (
      !window.confirm(
        "Encerrar todas as outras sessões da sua conta? Esta sessão permanecerá ativa.",
      )
    ) {
      return;
    }
    setActing(true);
    setError(null);
    try {
      const { error: signOutError } = await supabase.auth.signOut({
        scope: "others",
      });
      if (signOutError) throw signOutError;
      setMessage(
        "O provedor revogou as outras sessões. Registros históricos podem continuar visíveis na auditoria.",
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível encerrar as outras sessões.",
      );
    } finally {
      setActing(false);
    }
  }

  const verifiedFactor = totpFactors.find(
    (factor) => factor.status === "verified",
  );

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Segurança</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Credenciais, MFA, sessões do provedor e auditoria da conta.
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

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <KeyRound className="h-4 w-4" />
            </span>
            <div className="flex-1">
              <h2 className="font-semibold">Senha</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                A alteração exige validação da senha atual e é feita pelo provedor.
              </p>
              <Link
                to="/app/configuracoes/conta"
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted"
              >
                <Lock className="h-3.5 w-3.5" />
                Alterar senha
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-500/10 text-emerald-700">
              <Smartphone className="h-4 w-4" />
            </span>
            <div className="flex-1">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Autenticação adicional</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    TOTP gerenciado pelo provedor de autenticação.
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    verifiedFactor
                      ? "bg-emerald-500/10 text-emerald-700"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {verifiedFactor ? "Ativado" : "Desativado"}
                </span>
              </div>

              <p className="mt-3 text-xs text-muted-foreground">
                Nível atual: {aal.currentLevel ?? "não informado"} · próximo:{" "}
                {aal.nextLevel ?? "não informado"}
              </p>

              <div className="mt-4">
                {verifiedFactor ? (
                  <button
                    onClick={() => void disableTotp(verifiedFactor.id)}
                    disabled={acting}
                    className="rounded-lg border border-destructive/30 px-3 py-2 text-xs font-medium text-destructive disabled:opacity-50"
                  >
                    Desativar TOTP
                  </button>
                ) : (
                  <button
                    onClick={() => void startTotp()}
                    disabled={acting}
                    className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    Ativar TOTP
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="mt-5 rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-5">
          <div className="flex items-start gap-3">
            <Monitor className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <h2 className="font-semibold">Sessões</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                A sessão atual vem do provedor. Registros internos abaixo só aparecem quando existem de verdade.
              </p>
            </div>
          </div>
          <button
            onClick={() => void signOutOtherSessions()}
            disabled={acting || !currentSession}
            className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-2 text-xs font-medium text-destructive disabled:opacity-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            Encerrar outras sessões
          </button>
        </div>

        <div className="p-5">
          {currentSession ? (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm">
              <p className="font-medium text-emerald-800">Sessão atual</p>
              <p className="mt-1 break-all text-xs text-muted-foreground">
                {currentSession.userAgent}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Expira:{" "}
                {currentSession.expiresAt
                  ? formatDateTime(
                      new Date(currentSession.expiresAt * 1000).toISOString(),
                    )
                  : "não informado"}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma sessão autenticada encontrada.
            </p>
          )}

          {sessionRecords.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-3 pr-4">Dispositivo registrado</th>
                    <th className="px-4 py-3">Local</th>
                    <th className="px-4 py-3">IP</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Última atividade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sessionRecords.map((session) => (
                    <tr key={session.id}>
                      <td className="py-3.5 pr-4">
                        {session.dispositivo ||
                          session.navegador ||
                          "Dispositivo não identificado"}
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {session.sistema_operacional ?? ""}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground">
                        {[session.cidade, session.regiao, session.pais]
                          .filter(Boolean)
                          .join(", ") || "Não registrado"}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">
                        {session.ip_address ?? "Não registrado"}
                      </td>
                      <td className="px-4 py-3.5 capitalize">
                        {session.status}
                      </td>
                      <td className="px-4 py-3.5 text-right text-xs text-muted-foreground">
                        {formatDateTime(session.data_ultima_atividade)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="mt-5 overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          <div>
            <h2 className="font-semibold">Eventos de segurança</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Somente eventos realmente persistidos para esta conta.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Carregando auditoria...
          </div>
        ) : events.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Nenhum evento de segurança registrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3">Ação</th>
                  <th className="px-5 py-3">Descrição</th>
                  <th className="px-5 py-3">IP</th>
                  <th className="px-5 py-3">Local</th>
                  <th className="px-5 py-3">Risco</th>
                  <th className="px-5 py-3 text-right">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {events.map((event) => {
                  const failed =
                    (event.status_resposta ?? 0) >= 400 ||
                    event.acao === "login_falha" ||
                    event.acao === "acesso_negado";
                  return (
                    <tr key={event.id}>
                      <td className="px-5 py-3.5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                            failed
                              ? "bg-destructive/10 text-destructive"
                              : "bg-emerald-500/10 text-emerald-700",
                          )}
                        >
                          {failed ? (
                            <X className="h-3 w-3" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                          {event.acao}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">
                        {event.descricao}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">
                        {event.ip_address ?? "—"}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground">
                        {[event.cidade, event.pais].filter(Boolean).join(", ") ||
                          "—"}
                      </td>
                      <td className="px-5 py-3.5 text-xs capitalize text-muted-foreground">
                        {event.risco_nivel ?? "—"}
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs text-muted-foreground">
                        {formatDateTime(event.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {enrollment && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
            <h2 className="text-xl font-semibold">Configurar TOTP</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Escaneie o QR Code e confirme com o código atual do aplicativo.
            </p>

            <div className="mt-5 grid place-items-center rounded-xl bg-white p-4">
              <img
                src={enrollment.qr}
                alt="QR Code do TOTP"
                className="h-52 w-52"
              />
            </div>

            <details className="mt-3 rounded-lg border border-border p-3 text-xs">
              <summary className="cursor-pointer font-medium">
                Mostrar chave manual
              </summary>
              <code className="mt-2 block break-all text-muted-foreground">
                {enrollment.secret}
              </code>
            </details>

            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value)}
              placeholder="Código de 6 dígitos"
              className="mt-4 h-11 w-full rounded-lg border border-border bg-background px-3 text-center font-mono text-lg tracking-[0.25em]"
            />

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => void cancelTotpEnrollment()}
                disabled={acting}
                className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {acting ? "Cancelando..." : "Cancelar"}
              </button>
              <button
                onClick={() => void verifyTotp()}
                disabled={acting}
                className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {acting ? "Verificando..." : "Confirmar 2FA"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}