import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeftToLine, Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function PlatformAdminGuard({
  children,
  compact = false,
}: {
  children: ReactNode;
  compact?: boolean;
}) {
  const [state, setState] = useState<"checking" | "allowed" | "denied">("checking");

  useEffect(() => {
    let active = true;

    async function validate() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user) {
        if (active) setState("denied");
        return;
      }

      const { data, error } = await (supabase as any).rpc("fn_is_admin_global");
      if (!active) return;
      setState(!error && data === true ? "allowed" : "denied");
    }

    void validate();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      void validate();
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (state === "checking") {
    return (
      <div className={compact ? "grid min-h-[320px] place-items-center" : "grid min-h-screen place-items-center bg-background"}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Validando autorização...
        </div>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className={compact ? "grid min-h-[420px] place-items-center px-4" : "flex min-h-screen items-center justify-center bg-background px-4"}>
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <Lock className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">
            Acesso negado
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta área exige autorização de administrador da plataforma validada no backend.
          </p>
          <Link
            to="/app"
            className="mt-7 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            <ArrowLeftToLine className="h-4 w-4" />
            Voltar ao dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
