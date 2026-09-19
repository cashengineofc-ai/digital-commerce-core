import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import type { RoleKey } from "@/components/app/app-shell-context";
import { supabase } from "@/integrations/supabase/client";

export const ACCOUNT_ACCESS_DISABLED = "ACCOUNT_ACCESS_DISABLED";
export const MFA_FACTOR_NOT_AVAILABLE = "MFA_FACTOR_NOT_AVAILABLE";

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

export type LoginResult =
  | { status: "authenticated"; user: TempUser }
  | { status: "mfa_required" };

type TempAuthContextValue = {
  user: TempUser | null;
  isAuthed: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResult | null>;
  mfaRequired: boolean;
  verifyMfa: (code: string) => Promise<TempUser>;
  cancelMfa: () => Promise<void>;
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

async function getPendingTotpFactorId(): Promise<string | null> {
  const { data: aalData, error: aalError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalError) throw aalError;

  if (aalData.currentLevel === "aal2" || aalData.nextLevel !== "aal2") {
    return null;
  }

  const { data: factorData, error: factorError } =
    await supabase.auth.mfa.listFactors();
  if (factorError) throw factorError;

  const verifiedTotp = factorData.totp.find(
    (factor) => factor.status === "verified",
  );

  if (!verifiedTotp) {
    throw new Error(MFA_FACTOR_NOT_AVAILABLE);
  }

  return verifiedTotp.id;
}

export function TempAuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<TempUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);

  const syncAuthenticatedUser = useCallback(async (authUser: User) => {
    const pendingFactorId = await getPendingTotpFactorId();
    if (pendingFactorId) {
      setMfaFactorId(pendingFactorId);
      setUser(null);
      return null;
    }

    const nextUser = await loadUser(authUser);
    setMfaFactorId(null);
    setUser(nextUser);
    return nextUser;
  }, []);

  useEffect(() => {
    let alive = true;

    void supabase.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (error) throw error;
        if (!alive) return;

        if (!data.session?.user) {
          setUser(null);
          setMfaFactorId(null);
          return;
        }

        try {
          await syncAuthenticatedUser(data.session.user);
        } catch (error) {
          console.error("Sessão recusada pelo contexto de autenticação", error);
          if (alive) {
            setUser(null);
            setMfaFactorId(null);
          }
          await supabase.auth.signOut().catch(() => undefined);
        }
      })
      .catch((error) => {
        console.error("Falha ao restaurar sessão", error);
        if (alive) {
          setUser(null);
          setMfaFactorId(null);
        }
      })
      .finally(() => {
        if (alive) setIsLoading(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null);
        setMfaFactorId(null);
        return;
      }

      // Executa fora do callback síncrono do Auth para evitar encadear novas
      // operações de autenticação dentro do mesmo lock interno do provedor.
      window.setTimeout(() => {
        if (!alive) return;
        void syncAuthenticatedUser(session.user).catch((error) => {
          console.error("Contexto autenticado recusado", error);
          if (alive) setUser(null);
        });
      }, 0);
    });

    return () => {
      alive = false;
      subscription.subscription.unsubscribe();
    };
  }, [syncAuthenticatedUser]);

  async function login(email: string, password: string): Promise<LoginResult | null> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) throw error;
    if (!data.user) return null;

    try {
      const pendingFactorId = await getPendingTotpFactorId();
      if (pendingFactorId) {
        setMfaFactorId(pendingFactorId);
        setUser(null);
        return { status: "mfa_required" };
      }

      const nextUser = await loadUser(data.user);
      setMfaFactorId(null);
      setUser(nextUser);
      return { status: "authenticated", user: nextUser };
    } catch (accessError) {
      await supabase.auth.signOut().catch(() => undefined);
      setMfaFactorId(null);
      setUser(null);
      throw accessError;
    }
  }

  async function verifyMfa(code: string): Promise<TempUser> {
    if (!mfaFactorId) {
      throw new Error(MFA_FACTOR_NOT_AVAILABLE);
    }

    const normalizedCode = code.replace(/\D/g, "").slice(0, 6);
    if (normalizedCode.length !== 6) {
      throw new Error("MFA_CODE_INVALID");
    }

    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
    if (challengeError) throw challengeError;

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: mfaFactorId,
      challengeId: challenge.id,
      code: normalizedCode,
    });
    if (verifyError) throw verifyError;

    const { data: aalData, error: aalError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError) throw aalError;
    if (aalData.currentLevel !== "aal2") {
      throw new Error("MFA_AAL2_NOT_REACHED");
    }

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      throw authError ?? new Error("AUTH_USER_NOT_AVAILABLE");
    }

    const nextUser = await loadUser(authData.user);
    setMfaFactorId(null);
    setUser(nextUser);
    return nextUser;
  }

  async function cancelMfa() {
    await supabase.auth.signOut().catch(() => undefined);
    setMfaFactorId(null);
    setUser(null);
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
      setMfaFactorId(null);
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
      mfaRequired: !!mfaFactorId,
      verifyMfa,
      cancelMfa,
      logout,
      isAdminGlobal: user?.isAdminGlobal ?? false,
    }),
    [user, isLoading, mfaFactorId],
  );

  return <TempAuthContext.Provider value={value}>{children}</TempAuthContext.Provider>;
}

export function useTempAuth() {
  const ctx = useContext(TempAuthContext);
  if (!ctx) throw new Error("useTempAuth precisa estar dentro de TempAuthProvider");
  return ctx;
}
