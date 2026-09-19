import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTempAuth } from "@/lib/auth-temp";

export type PermissionAction = "read" | "create" | "update" | "delete" | "approve";

type PermissionState = {
  allowed: boolean;
  loading: boolean;
  error: string | null;
};

export function usePermission(
  module: string,
  resource: string,
  action: PermissionAction,
  enabled = true,
): PermissionState {
  const { user, isAuthed, isLoading: authLoading } = useTempAuth();
  const [state, setState] = useState<PermissionState>({
    allowed: false,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let active = true;

    if (!enabled) {
      setState({ allowed: false, loading: false, error: null });
      return () => {
        active = false;
      };
    }

    if (authLoading) {
      setState((current) => ({ ...current, loading: true, error: null }));
      return () => {
        active = false;
      };
    }

    if (!isAuthed || !user) {
      setState({ allowed: false, loading: false, error: null });
      return () => {
        active = false;
      };
    }

    setState((current) => ({ ...current, loading: true, error: null }));

    void (supabase as any)
      .rpc("fn_tem_permissao", {
        p_modulo: module,
        p_recurso: resource,
        p_acao: action,
      })
      .then(({ data, error }: { data: boolean | null; error: Error | null }) => {
        if (!active) return;
        if (error) {
          setState({
            allowed: false,
            loading: false,
            error: error.message || "Não foi possível validar a permissão.",
          });
          return;
        }

        setState({ allowed: data === true, loading: false, error: null });
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setState({
          allowed: false,
          loading: false,
          error:
            cause instanceof Error
              ? cause.message
              : "Não foi possível validar a permissão.",
        });
      });

    return () => {
      active = false;
    };
  }, [action, authLoading, enabled, isAuthed, module, resource, user?.id]);

  return state;
}
