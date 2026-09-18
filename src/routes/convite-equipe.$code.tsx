import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/format";

type Preview = {
  company_name: string;
  name: string | null;
  email_hint: string;
  job_title: string | null;
  role_name: string | null;
  expires_at: string;
};

export const Route = createFileRoute("/convite-equipe/$code")({
  component: TeamInvitePage,
});

function TeamInvitePage() {
  const { code } = Route.useParams();
  const token = useMemo(
    () => new URLSearchParams(window.location.search).get("token")?.trim() ?? "",
    [],
  );
  const [preview, setPreview] = useState<Preview | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        if (!token) throw new Error("Token do convite ausente.");

        const [{ data, error: rpcError }, auth] = await Promise.all([
          (supabase as any).rpc("fn_equipe_convite_visualizar", {
            p_code: code,
            p_token: token,
          }),
          supabase.auth.getUser(),
        ]);
        if (rpcError) throw rpcError;
        if (!active) return;

        setPreview({
          company_name: String(data?.company_name ?? "Empresa"),
          name: data?.name ? String(data.name) : null,
          email_hint: String(data?.email_hint ?? "***"),
          job_title: data?.job_title ? String(data.job_title) : null,
          role_name: data?.role_name ? String(data.role_name) : null,
          expires_at: String(data?.expires_at ?? ""),
        });
        setSignedIn(Boolean(auth.data.user));
      } catch (cause) {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Este convite não está disponível.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [code, token]);

  async function accept() {
    setAccepting(true);
    setError(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setSignedIn(false);
        throw new Error("Entre na conta convidada para aceitar.");
      }

      const { data, error: rpcError } = await (supabase as any).rpc(
        "fn_equipe_convite_aceitar",
        {
          p_code: code,
          p_token: token,
        },
      );
      if (rpcError) throw rpcError;
      if (!data) throw new Error("O vínculo não foi criado.");
      setAccepted(true);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível aceitar.",
      );
    } finally {
      setAccepting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10 text-foreground">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-sm">
        {loading ? (
          <div className="py-12 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">
              Validando convite...
            </p>
          </div>
        ) : accepted ? (
          <div className="py-8 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
            <h1 className="mt-4 text-xl font-semibold">Acesso liberado</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              O vínculo com a empresa foi criado e o contexto foi alterado para essa operação.
            </p>
            <Link
              to="/app"
              className="mt-6 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Abrir Cash Engine PRO
            </Link>
          </div>
        ) : error && !preview ? (
          <div className="py-8 text-center">
            <h1 className="text-xl font-semibold">Convite indisponível</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </div>
        ) : preview ? (
          <>
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-xl font-semibold">Convite para equipe</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {preview.company_name}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3 rounded-xl border border-border bg-background p-4 text-sm">
              {preview.name && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Convidado</span>
                  <span className="font-medium">{preview.name}</span>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Conta esperada</span>
                <span className="font-medium">{preview.email_hint}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Cargo</span>
                <span className="font-medium">{preview.job_title ?? "Membro"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Função</span>
                <span className="font-medium">{preview.role_name ?? "Sem função"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Expira em</span>
                <span className="font-medium">
                  {formatDateTime(preview.expires_at)}
                </span>
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="mt-6">
              {signedIn ? (
                <button
                  onClick={() => void accept()}
                  disabled={accepting}
                  className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {accepting ? "Aceitando..." : "Aceitar convite"}
                </button>
              ) : (
                <Link
                  to="/login"
                  className="block w-full rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground"
                >
                  Entrar na conta convidada
                </Link>
              )}
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              O convite só pode ser aceito pela conta cujo e-mail corresponde ao destinatário.
            </p>
          </>
        ) : null}
      </section>
    </main>
  );
}
