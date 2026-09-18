import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({
    meta: [
      { title: "Redefinir senha · Cash Engine PRO" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function inspect() {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setReady(Boolean(data.session));
      if (!data.session) {
        setError(
          "A sessão de recuperação não está disponível. Abra novamente o link enviado pelo provedor.",
        );
      }
    }
    void inspect();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!active) return;
        if (event === "PASSWORD_RECOVERY" || session) {
          setReady(true);
          setError(null);
        }
      },
    );

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8 || password !== confirm) {
      setError(
        "Use uma senha de pelo menos 8 caracteres e confirme o mesmo valor.",
      );
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) throw updateError;

      setDone(true);
      window.setTimeout(() => {
        navigate({ to: "/app", replace: true }).catch(() => {});
      }, 1200);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível redefinir a senha.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Zap className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.14em]">
              Cash Engine
            </p>
            <p className="text-[10px] font-semibold tracking-[0.28em] text-primary">
              PRO
            </p>
          </div>
        </div>

        {done ? (
          <div className="py-10 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
            <h1 className="mt-4 text-xl font-semibold">Senha redefinida</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              A nova senha foi confirmada pelo provedor de autenticação.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-6 flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-semibold">Nova senha</h1>
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <form onSubmit={save} className="mt-6 space-y-4">
              <label className="block">
                <span className="text-sm font-medium">Nova senha</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  disabled={!ready}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-50"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Confirmar senha</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  disabled={!ready}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-50"
                />
              </label>
              <button
                type="submit"
                disabled={!ready || saving}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Redefinir senha"}
              </button>
            </form>

            {!ready && (
              <Link
                to="/recuperar-senha"
                className="mt-5 block text-center text-sm text-primary"
              >
                Solicitar um novo link
              </Link>
            )}
          </>
        )}
      </section>
    </main>
  );
}
