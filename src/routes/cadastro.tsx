import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Eye, EyeOff, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/cadastro")({ component: CadastroPage });

function authMessage(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("already registered") || normalized.includes("already been registered")) {
    return "Este e-mail já possui uma conta. Entre com sua senha.";
  }
  if (normalized.includes("password")) {
    return "A senha não atende aos requisitos de segurança.";
  }
  if (normalized.includes("email")) {
    return "Não foi possível usar este e-mail. Confira o endereço informado.";
  }
  return "Não foi possível criar sua conta agora. Tente novamente.";
}

function CadastroPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;

    const email = form.email.trim().toLowerCase();
    const name = form.name.trim();
    const company = form.company.trim();

    if (!name || !company || !email) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    if (form.password.length < 8) {
      toast.error("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error("As senhas não conferem.");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/login?confirmado=1`,
        data: {
          full_name: name,
          company_name: company,
        },
      },
    });
    setLoading(false);

    if (error) {
      toast.error(authMessage(error.message));
      return;
    }

    if (data.session) {
      toast.success("Conta criada. Bem-vindo ao Cash Engine PRO.");
      navigate({ to: "/app" }).catch(() => {});
      return;
    }

    toast.success("Conta criada. Confira seu e-mail para confirmar o acesso.");
    navigate({ to: "/login" }).catch(() => {});
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-2xl border border-border bg-card p-7 shadow-xl">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Zap className="h-5 w-5" />
          </span>
          <div>
            <p className="font-bold tracking-wide">CASH ENGINE PRO</p>
            <p className="text-sm text-muted-foreground">Crie sua operação</p>
          </div>
        </div>

        <input
          required
          autoComplete="name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Seu nome"
          className="h-11 w-full rounded-lg border border-border bg-background px-3"
        />

        <input
          required
          autoComplete="organization"
          value={form.company}
          onChange={(e) => setForm({ ...form, company: e.target.value })}
          placeholder="Nome da empresa"
          className="h-11 w-full rounded-lg border border-border bg-background px-3"
        />

        <input
          required
          type="email"
          autoCapitalize="none"
          autoComplete="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="seunome@gmail.com"
          className="h-11 w-full rounded-lg border border-border bg-background px-3"
        />

        <div className="relative">
          <input
            required
            minLength={8}
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Crie uma senha (mínimo 8 caracteres)"
            className="h-11 w-full rounded-lg border border-border bg-background px-3 pr-11"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <input
          required
          minLength={8}
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
          placeholder="Confirme sua senha"
          className="h-11 w-full rounded-lg border border-border bg-background px-3"
        />

        <button
          type="submit"
          disabled={loading}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-primary-foreground disabled:opacity-60"
        >
          {loading ? "Criando..." : <>Criar conta <ArrowRight className="h-4 w-4" /></>}
        </button>

        <p className="text-center text-sm text-muted-foreground">
          Já possui conta? <Link to="/login" className="font-medium text-primary">Entrar</Link>
        </p>
      </form>
    </main>
  );
}
