import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import type { RoleKey } from "@/components/app/app-shell-context";
import { supabase } from "@/integrations/supabase/client";

export type TempUser = {
  id: string;
  username: string;
  name: string;
  email: string;
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

async function loadUser(userId: string): Promise<TempUser | null> {
  const { data: authData } = await supabase.auth.getUser();
  const authUser = authData.user;
  if (!authUser || authUser.id !== userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, nome_completo, email, is_admin_global, is_owner, created_at")
    .eq("id", userId)
    .maybeSingle();

  const isAdminGlobal = profile?.is_admin_global === true;
  const role: RoleKey = isAdminGlobal ? "admin_global" : profile?.is_owner ? "produtor" : "afiliado";
  return {
    id: authUser.id,
    username: authUser.email?.split("@")[0] ?? authUser.id,
    name: profile?.nome_completo ?? authUser.user_metadata?.full_name ?? authUser.email ?? "Usuário",
    email: profile?.email ?? authUser.email ?? "",
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
      if (alive && data.session?.user) setUser(await loadUser(data.session.user.id));
      if (alive) setIsLoading(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null);
        return;
      }
      loadUser(session.user.id).then(setUser);
    });
    return () => {
      alive = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function login(email: string, password: string): Promise<TempUser | null> {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.user) return null;
    const nextUser = await loadUser(data.user.id);
    setUser(nextUser);
    return nextUser;
  }

  function logout() {
    supabase.auth.signOut().finally(() => {
      setUser(null);
      router.navigate({ to: "/login", replace: true }).catch(() => {
        if (typeof window !== "undefined") window.location.href = "/login";
      });
    });
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
