-- Cash Engine PRO — correção de precedência na autorização granular.
-- Uma role só autoriza se pertencer ao usuário/empresa, estiver válida e
-- for admin da empresa OU possuir explicitamente a permissão pedida.

CREATE OR REPLACE FUNCTION public.fn_tem_permissao(
  p_modulo varchar,
  p_recurso varchar,
  p_acao public.tipo_operacao
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_empresa_id uuid:=public.current_empresa_id();
  v_profile_id uuid:=auth.uid();
BEGIN
  IF v_profile_id IS NULL OR v_empresa_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.fn_is_admin_global() THEN
    RETURN true;
  END IF;

  IF public.fn_is_empresa_owner(v_empresa_id) THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.profile_roles pr
    JOIN public.roles r ON r.id=pr.role_id
    WHERE pr.profile_id=v_profile_id
      AND pr.empresa_id=v_empresa_id
      AND r.deleted_at IS NULL
      AND (r.empresa_id=v_empresa_id OR r.empresa_id IS NULL)
      AND (pr.expira_em IS NULL OR pr.expira_em>now())
      AND (
        r.is_admin
        OR EXISTS (
          SELECT 1
          FROM public.role_permissions rp
          JOIN public.permissions p ON p.id=rp.permission_id
          WHERE rp.role_id=r.id
            AND p.modulo=p_modulo
            AND p.recurso=p_recurso
            AND p.acao=p_acao
        )
      )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_tem_permissao(
  varchar,varchar,public.tipo_operacao
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_tem_permissao(
  varchar,varchar,public.tipo_operacao
) TO authenticated,service_role;
