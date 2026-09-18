-- Cash Engine PRO — hardening das tabelas internas do Admin Global.
-- Owner/admin de empresa não pode ler nem alterar gestão global, bans ou moderação.

ALTER TABLE public.admin_empresas_gestao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_banimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_moderacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_comunicados ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tablename,policyname
    FROM pg_policies
    WHERE schemaname='public'
      AND tablename IN ('admin_empresas_gestao','admin_banimentos','admin_moderacao')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',r.policyname,r.tablename);
  END LOOP;
END $$;

CREATE POLICY admin_empresas_global_only
ON public.admin_empresas_gestao
FOR ALL TO authenticated
USING(public.fn_is_admin_global())
WITH CHECK(public.fn_is_admin_global());

CREATE POLICY admin_banimentos_global_only
ON public.admin_banimentos
FOR ALL TO authenticated
USING(public.fn_is_admin_global())
WITH CHECK(public.fn_is_admin_global());

CREATE POLICY admin_moderacao_global_only
ON public.admin_moderacao
FOR ALL TO authenticated
USING(public.fn_is_admin_global())
WITH CHECK(public.fn_is_admin_global());

-- Comunicados publicados podem ser lidos conforme a regra pública já existente,
-- mas toda mutação é exclusiva do Admin Global.
DROP POLICY IF EXISTS "admin_comunicados_insert" ON public.admin_comunicados;
DROP POLICY IF EXISTS "admin_comunicados_update" ON public.admin_comunicados;
DROP POLICY IF EXISTS "admin_comunicados_delete" ON public.admin_comunicados;

CREATE POLICY admin_comunicados_insert_global_only
ON public.admin_comunicados
FOR INSERT TO authenticated
WITH CHECK(public.fn_is_admin_global());

CREATE POLICY admin_comunicados_update_global_only
ON public.admin_comunicados
FOR UPDATE TO authenticated
USING(public.fn_is_admin_global())
WITH CHECK(public.fn_is_admin_global());

CREATE POLICY admin_comunicados_delete_global_only
ON public.admin_comunicados
FOR DELETE TO authenticated
USING(public.fn_is_admin_global());

-- Recria a função de alteração de Admin Global com proteção contra lockout.
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
  v_other_admins integer;
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

  IF NOT p_enabled AND v_target.is_admin_global THEN
    SELECT count(*)
    INTO v_other_admins
    FROM public.profiles p
    WHERE p.is_admin_global
      AND p.id<>p_profile_id
      AND p.deleted_at IS NULL
      AND p.status='ativo';

    IF v_other_admins=0 THEN
      RAISE EXCEPTION 'cannot_remove_last_platform_admin';
    END IF;
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
