import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import type { RoleKey } from "@/components/app/app-shell-context";
import { supabase } from "@/integrations/supabase/client";

export type TempUser = {
  id: string;
  username: string;
  name: string;
  email: string;
  empresaId: string | null;
  role: RoleKey;
  isAdminGlobal: boolean;
  createdAt: string;
};

type TempAuthContextValue = {
  user: TempUser | null;
  isAuthed: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<TempUser | null>;
  logout: () => void;
  isAdminGlobal: boolean;
};

const TempAuthContext = createContext<TempAuthContextValue | null>(null);

async function loadUser(authUser: User): Promise<TempUser> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, nome_completo, email, empresa_id, is_admin_global, is_owner, created_at")
    .eq("id", authUser.id)
    .maybeSingle();

  // A interface nunca escolhe o próprio papel. O contexto vem exclusivamente
  // de vínculos persistidos e autorizados no backend.
  const isAdminGlobal = profile?.is_admin_global === true;
  let role: RoleKey = "produtor";

  if (isAdminGlobal) {
    role = "admin_global";
  } else if (profile?.is_owner) {
    role = "super-admin";
  } else {
    const { data: affiliate } = await supabase
      .from("afiliados")
      .select("id")
      .eq("profile_id", authUser.id)
      .eq("status", "ativo")
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    role = affiliate ? "afiliado" : "produtor";
  }

  return {
    id: authUser.id,
    username: authUser.email?.split("@")[0] ?? authUser.id,
    name: profile?.nome_completo ?? authUser.user_metadata?.["full_name"] ?? authUser.email ?? "Usuário",
    email: profile?.email ?? authUser.email ?? "",
    empresaId: profile?.empresa_id ?? null,
    role,
    isAdminGlobal,
    createdAt: profile?.created_at ?? authUser.created_at,
  };
}

export function TempAuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<TempUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (alive && data.session?.user) {
        setUser(await loadUser(data.session.user));
      }
      if (alive) setIsLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null);
        return;
      }

      loadUser(session.user).then((nextUser) => {
        if (alive) setUser(nextUser);
      });
    });

    return () => {
      alive = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function login(email: string, password: string): Promise<TempUser | null> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) throw error;
    if (!data.user) return null;

    const nextUser = await loadUser(data.user);
    setUser(nextUser);
    return nextUser;
  }

  function logout() {
    async function run() {
      if (typeof window !== "undefined") {
        const deviceId = window.localStorage.getItem("ce-push-device-id");
        if (deviceId) {
          await (supabase as any)
            .rpc("fn_push_inscricao_desativar_device", {
              p_device_id: deviceId,
            })
            .catch(() => undefined);
        }
      }

      await supabase.auth.signOut();
      setUser(null);
      router.navigate({ to: "/login", replace: true }).catch(() => {
        if (typeof window !== "undefined") window.location.href = "/login";
      });
    }

    void run();
  }

  const value = useMemo<TempAuthContextValue>(() => ({
    user,
    isAuthed: !!user,
    isLoading,
    login,
    logout,
    isAdminGlobal: user?.isAdminGlobal ?? false,
  }), [user, isLoading]);

  return <TempAuthContext.Provider value={value}>{children}</TempAuthContext.Provider>;
}

export function useTempAuth() {
  const ctx = useContext(TempAuthContext);
  if (!ctx) throw new Error("useTempAuth precisa estar dentro de TempAuthProvider");
  return ctx;
}
