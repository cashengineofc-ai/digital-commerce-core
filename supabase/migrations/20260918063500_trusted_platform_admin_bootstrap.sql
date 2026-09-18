-- Cash Engine PRO — bootstrap confiável do primeiro Admin Global.
-- Nenhum usuário autenticado pode chamar estas rotinas para se promover.

CREATE OR REPLACE FUNCTION public.fn_admin_bootstrap_platform(p_profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_exists boolean;
BEGIN
  -- Uso exclusivo por service_role/backend confiável.
  IF current_user NOT IN ('service_role','postgres','supabase_admin') THEN
    RAISE EXCEPTION 'trusted_backend_required';
  END IF;

  SELECT EXISTS(
    SELECT 1
    FROM public.profiles
    WHERE is_admin_global
      AND deleted_at IS NULL
      AND status='ativo'
  ) INTO v_exists;

  IF v_exists THEN
    RAISE EXCEPTION 'platform_admin_already_exists';
  END IF;

  IF NOT EXISTS(
    SELECT 1 FROM public.profiles
    WHERE id=p_profile_id
      AND deleted_at IS NULL
      AND status='ativo'
  ) THEN
    RAISE EXCEPTION 'profile_not_found_or_inactive';
  END IF;

  UPDATE public.profiles
  SET is_admin_global=true,
      updated_at=now()
  WHERE id=p_profile_id;

  INSERT INTO public.seguranca_audit_log(
    empresa_id,profile_id,acao,modulo,entidade,entidade_id,
    descricao,detalhes
  )
  SELECT
    p.empresa_id,p.id,'permissao_concedida','admin_global',
    'profile',p.id,
    'Primeiro administrador global definido por procedimento confiável do backend',
    jsonb_build_object('bootstrap',true,'executed_by',current_user)
  FROM public.profiles p
  WHERE p.id=p_profile_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_bootstrap_platform(uuid)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_admin_bootstrap_platform(uuid)
TO service_role;

CREATE OR REPLACE FUNCTION public.fn_admin_global_set(
  p_profile_id uuid,
  p_enabled boolean,
  p_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_target public.profiles%ROWTYPE;
BEGIN
  IF NOT public.fn_is_admin_global() THEN
    RAISE EXCEPTION 'platform_admin_required';
  END IF;

  IF auth.uid()=p_profile_id THEN
    RAISE EXCEPTION 'self_admin_role_change_forbidden';
  END IF;

  IF trim(coalesce(p_reason,''))='' THEN
    RAISE EXCEPTION 'reason_required';
  END IF;

  SELECT * INTO v_target
  FROM public.profiles
  WHERE id=p_profile_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  UPDATE public.profiles
  SET is_admin_global=p_enabled,
      updated_at=now()
  WHERE id=p_profile_id;

  INSERT INTO public.seguranca_audit_log(
    empresa_id,profile_id,acao,modulo,entidade,entidade_id,
    descricao,detalhes
  ) VALUES (
    v_target.empresa_id,
    auth.uid(),
    CASE WHEN p_enabled
      THEN 'permissao_concedida'::public.tipo_audit_log
      ELSE 'permissao_revogada'::public.tipo_audit_log
    END,
    'admin_global','profile',p_profile_id,
    CASE WHEN p_enabled
      THEN 'Acesso de administrador global concedido'
      ELSE 'Acesso de administrador global revogado'
    END,
    jsonb_build_object(
      'target_profile_id',p_profile_id,
      'reason',trim(p_reason)
    )
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_global_set(uuid,boolean,text)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_global_set(uuid,boolean,text)
TO authenticated;
