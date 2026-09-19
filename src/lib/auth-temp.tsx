import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import type { RoleKey } from "@/components/app/app-shell-context";
import { supabase } from "@/integrations/supabase/client";

export const ACCOUNT_ACCESS_DISABLED = "ACCOUNT_ACCESS_DISABLED";

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

function createAccountAccessError() {
  const error = new Error(ACCOUNT_ACCESS_DISABLED);
  error.name = "AccountAccessError";
  return error;
}

async function loadUser(authUser: User): Promise<TempUser> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "id, nome_completo, email, empresa_id, is_admin_global, is_owner, status, deleted_at, created_at",
    )
    .eq("id", authUser.id)
    .maybeSingle();

  if (profileError) throw profileError;

  // Uma sessão do Supabase, sozinha, não concede acesso à plataforma.
  // O perfil precisa existir, estar ativo e não pode ter sido removido.
  if (!profile || profile.deleted_at || profile.status !== "ativo") {
    throw createAccountAccessError();
  }

  // A interface nunca escolhe o próprio papel. O contexto vem exclusivamente
  // de vínculos persistidos e autorizados no backend.
  const isAdminGlobal = profile.is_admin_global === true;
  let role: RoleKey = "produtor";

  if (isAdminGlobal) {
    role = "admin_global";
  } else if (profile.is_owner) {
    role = "super-admin";
  } else {
    const { data: affiliate, error: affiliateError } = await supabase
      .from("afiliados")
      .select("id")
      .eq("profile_id", authUser.id)
      .eq("status", "ativo")
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    if (affiliateError) throw affiliateError;
    role = affiliate ? "afiliado" : "produtor";
  }

  return {
    id: authUser.id,
    username: authUser.email?.split("@")[0] ?? authUser.id,
    name:
      profile.nome_completo ??
      authUser.user_metadata?.["full_name"] ??
      authUser.email ??
      "Usuário",
    email: profile.email ?? authUser.email ?? "",
    empresaId: profile.empresa_id ?? null,
    role,
    isAdminGlobal,
    createdAt: profile.created_at ?? authUser.created_at,
  };
}

export function TempAuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<TempUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    void supabase.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (error) throw error;
        if (!alive) return;

        if (!data.session?.user) {
          setUser(null);
          return;
        }

        try {
          const nextUser = await loadUser(data.session.user);
          if (alive) setUser(nextUser);
        } catch (error) {
          console.error("Sessão recusada pelo contexto de perfil", error);
          if (alive) setUser(null);
          await supabase.auth.signOut().catch(() => undefined);
        }
      })
      .catch((error) => {
        console.error("Falha ao restaurar sessão", error);
        if (alive) setUser(null);
      })
      .finally(() => {
        if (alive) setIsLoading(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null);
        return;
      }

      void loadUser(session.user)
        .then((nextUser) => {
          if (alive) setUser(nextUser);
        })
        .catch((error) => {
          console.error("Contexto autenticado recusado", error);
          if (alive) setUser(null);
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

    try {
      const nextUser = await loadUser(data.user);
      setUser(nextUser);
      return nextUser;
    } catch (accessError) {
      await supabase.auth.signOut().catch(() => undefined);
      setUser(null);
      throw accessError;
    }
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

  const value = useMemo<TempAuthContextValue>(
    () => ({
      user,
      isAuthed: !!user,
      isLoading,
      login,
      logout,
      isAdminGlobal: user?.isAdminGlobal ?? false,
    }),
    [user, isLoading],
  );

  return <TempAuthContext.Provider value={value}>{children}</TempAuthContext.Provider>;
}

export function useTempAuth() {
  const ctx = useContext(TempAuthContext);
  if (!ctx) throw new Error("useTempAuth precisa estar dentro de TempAuthProvider");
  return ctx;
}
