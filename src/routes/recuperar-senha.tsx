import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Mail, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/recuperar-senha")({
  head: () => ({
    meta: [
      { title: "Recuperar senha · Cash Engine PRO" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RecoverPasswordPage,
});

function RecoverPasswordPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;

    setSending(true);
    setError(null);
    try {
      const redirectTo = `${window.location.origin}/redefinir-senha`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo },
      );
      if (resetError) throw resetError;
      setSent(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível iniciar a recuperação.",
      );
    } finally {
      setSending(false);
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

        <h1 className="mt-6 text-2xl font-semibold">Recuperar senha</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O provedor de autenticação enviará o link de recuperação para o e-mail informado.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {sent ? (
          <div className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-5 w-5 text-emerald-700" />
              <div>
                <p className="font-medium text-emerald-800">
                  Solicitação enviada
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Se a conta puder receber recuperação, siga o link enviado pelo provedor. Esta tela não revela se um e-mail específico existe no sistema.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6">
            <label className="block">
              <span className="text-sm font-medium">E-mail</span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@empresa.com"
                className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={sending}
              className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {sending ? "Enviando..." : "Enviar link de recuperação"}
            </button>
          </form>
        )}

        <Link
          to="/login"
          className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao login
        </Link>
      </section>
    </main>
  );
}
