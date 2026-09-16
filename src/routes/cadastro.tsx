import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/cadastro")({ component: CadastroPage });

function CadastroPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", company: "", email: "", password: "" });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: { data: { full_name: form.name.trim(), company_name: form.company.trim() } },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (data.session) {
      toast.success("Conta criada. Bem-vindo ao Cash Engine PRO.");
      navigate({ to: "/app" }).catch(() => {});
    } else {
      toast.success("Conta criada. Confirme seu e-mail para entrar.");
      navigate({ to: "/login" }).catch(() => {});
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-background p-4">
    <form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-2xl border border-border bg-card p-7 shadow-xl">
      <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground"><Zap className="h-5 w-5" /></span><div><p className="font-bold tracking-wide">CASH ENGINE PRO</p><p className="text-sm text-muted-foreground">Crie sua operação</p></div></div>
      <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Seu nome" className="h-11 w-full rounded-lg border border-border bg-background px-3" />
      <input required value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Nome da empresa" className="h-11 w-full rounded-lg border border-border bg-background px-3" />
      <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="voce@empresa.com" className="h-11 w-full rounded-lg border border-border bg-background px-3" />
      <input required minLength={8} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Crie uma senha (mínimo 8 caracteres)" className="h-11 w-full rounded-lg border border-border bg-background px-3" />
      <button disabled={loading} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-primary-foreground disabled:opacity-60">{loading ? "Criando..." : <>Criar conta <ArrowRight className="h-4 w-4" /></>}</button>
      <p className="text-center text-sm text-muted-foreground">Já possui conta? <Link to="/login" className="font-medium text-primary">Entrar</Link></p>
    </form>
  </main>;
}