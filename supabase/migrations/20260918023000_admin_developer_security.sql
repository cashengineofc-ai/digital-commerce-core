-- Cash Engine PRO — hardening de papéis, admin global e Desenvolvedores
-- Corrige precedência lógica, bloqueia autopromoção e restringe credenciais globais.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- PERMISSÕES: corrigir precedência e reservar developers ao admin global
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_tem_permissao(
    p_modulo VARCHAR,
    p_recurso VARCHAR,
    p_acao public.tipo_operacao
) RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
    v_empresa_id UUID;
    v_profile_id UUID;
BEGIN
    v_profile_id := auth.uid();
    IF v_profile_id IS NULL THEN
      RETURN FALSE;
    END IF;

    IF public.fn_is_admin_global() THEN
        RETURN TRUE;
    END IF;

    -- Área de desenvolvedores é exclusiva do administrador da plataforma.
    IF lower(coalesce(p_modulo,'')) = 'developers' THEN
        RETURN FALSE;
    END IF;

    v_empresa_id := public.fn_get_empresa_usuario();
    IF v_empresa_id IS NULL THEN
      RETURN FALSE;
    END IF;

    -- Owner da empresa possui os poderes empresariais, nunca os globais.
    IF public.fn_is_empresa_owner(v_empresa_id) THEN
        RETURN TRUE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.profile_roles pr
        JOIN public.role_permissions rp ON rp.role_id = pr.role_id
        JOIN public.permissions p ON p.id = rp.permission_id
        JOIN public.roles r ON r.id = pr.role_id
        WHERE pr.profile_id = v_profile_id
          AND pr.empresa_id = v_empresa_id
          AND p.modulo = p_modulo
          AND p.recurso = p_recurso
          AND p.acao = p_acao
          AND r.deleted_at IS NULL
          AND (pr.expira_em IS NULL OR pr.expira_em > NOW())
    );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_tem_permissao(VARCHAR,VARCHAR,public.tipo_operacao) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_tem_permissao(VARCHAR,VARCHAR,public.tipo_operacao)
TO authenticated,service_role;

-- =========================================================
-- PERFIL: campos de autoridade nunca podem ser alterados pelo próprio usuário
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_proteger_autoridade_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  -- service_role/backend confiável não possui a limitação abaixo.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthenticated_profile_change';
  END IF;

  IF public.fn_is_admin_global() THEN
    RETURN NEW;
  END IF;

  IF NEW.is_admin_global IS DISTINCT FROM OLD.is_admin_global
     OR NEW.is_owner IS DISTINCT FROM OLD.is_owner
     OR NEW.empresa_id IS DISTINCT FROM OLD.empresa_id
     OR NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'protected_profile_authority_fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_autoridade_profile ON public.profiles;
CREATE TRIGGER trg_proteger_autoridade_profile
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.fn_proteger_autoridade_profile();

-- =========================================================
-- PROFILE_ROLES: leitura própria; gestão apenas autorizada, nunca autopromoção
-- =========================================================
DROP POLICY IF EXISTS "profile_roles_all" ON public.profile_roles;
DROP POLICY IF EXISTS "profile_roles_select" ON public.profile_roles;
DROP POLICY IF EXISTS "profile_roles_insert" ON public.profile_roles;
DROP POLICY IF EXISTS "profile_roles_update" ON public.profile_roles;
DROP POLICY IF EXISTS "profile_roles_delete" ON public.profile_roles;

CREATE POLICY profile_roles_select ON public.profile_roles
FOR SELECT TO authenticated
USING (
  public.fn_is_admin_global()
  OR profile_id=auth.uid()
  OR (
    empresa_id=public.fn_get_empresa_usuario()
    AND (
      public.fn_is_empresa_owner(empresa_id)
      OR public.fn_tem_permissao('configuracoes','permissoes','manage'::public.tipo_operacao)
    )
  )
);

CREATE POLICY profile_roles_insert ON public.profile_roles
FOR INSERT TO authenticated
WITH CHECK (
  public.fn_is_admin_global()
  OR (
    empresa_id=public.fn_get_empresa_usuario()
    AND profile_id <> auth.uid()
    AND (
      public.fn_is_empresa_owner(empresa_id)
      OR public.fn_tem_permissao('configuracoes','permissoes','manage'::public.tipo_operacao)
    )
    AND EXISTS (
      SELECT 1
      FROM public.roles r
      WHERE r.id=role_id
        AND r.deleted_at IS NULL
        AND (r.empresa_id IS NULL OR r.empresa_id=profile_roles.empresa_id)
    )
  )
);

CREATE POLICY profile_roles_update ON public.profile_roles
FOR UPDATE TO authenticated
USING (
  public.fn_is_admin_global()
  OR (
    empresa_id=public.fn_get_empresa_usuario()
    AND profile_id <> auth.uid()
    AND (
      public.fn_is_empresa_owner(empresa_id)
      OR public.fn_tem_permissao('configuracoes','permissoes','manage'::public.tipo_operacao)
    )
  )
)
WITH CHECK (
  public.fn_is_admin_global()
  OR (
    empresa_id=public.fn_get_empresa_usuario()
    AND profile_id <> auth.uid()
    AND (
      public.fn_is_empresa_owner(empresa_id)
      OR public.fn_tem_permissao('configuracoes','permissoes','manage'::public.tipo_operacao)
    )
    AND EXISTS (
      SELECT 1 FROM public.roles r
      WHERE r.id=role_id
        AND r.deleted_at IS NULL
        AND (r.empresa_id IS NULL OR r.empresa_id=profile_roles.empresa_id)
    )
  )
);

CREATE POLICY profile_roles_delete ON public.profile_roles
FOR DELETE TO authenticated
USING (
  public.fn_is_admin_global()
  OR (
    empresa_id=public.fn_get_empresa_usuario()
    AND profile_id <> auth.uid()
    AND (
      public.fn_is_empresa_owner(empresa_id)
      OR public.fn_tem_permissao('configuracoes','permissoes','manage'::public.tipo_operacao)
    )
  )
);

-- =========================================================
-- FUNÇÃO DE BOOTSTRAP/GESTÃO DO ADMIN GLOBAL
-- service_role pode criar o primeiro; após isso admins globais também podem gerir.
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_admin_definir_global(
  p_profile_id uuid,
  p_ativo boolean,
  p_motivo text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_before boolean;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.fn_is_admin_global() THEN
    RAISE EXCEPTION 'platform_admin_required';
  END IF;

  IF trim(coalesce(p_motivo,'')) = '' THEN
    RAISE EXCEPTION 'audit_reason_required';
  END IF;

  SELECT is_admin_global INTO v_before
  FROM public.profiles
  WHERE id=p_profile_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  UPDATE public.profiles
  SET is_admin_global=p_ativo, updated_at=now()
  WHERE id=p_profile_id;

  INSERT INTO public.seguranca_audit_log (
    empresa_id,profile_id,acao,modulo,entidade,entidade_id,descricao,detalhes,
    dados_antes,dados_depois
  ) VALUES (
    NULL,
    CASE WHEN auth.uid() IS NOT NULL THEN auth.uid() ELSE NULL END,
    CASE WHEN p_ativo THEN 'permissao_concedida'::public.tipo_audit_log
         ELSE 'permissao_revogada'::public.tipo_audit_log END,
    'admin',
    'profiles',
    p_profile_id,
    CASE WHEN p_ativo THEN 'Acesso de administrador global concedido'
         ELSE 'Acesso de administrador global revogado' END,
    jsonb_build_object('motivo',p_motivo,'target_profile_id',p_profile_id),
    jsonb_build_object('is_admin_global',v_before),
    jsonb_build_object('is_admin_global',p_ativo)
  );

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_definir_global(uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_definir_global(uuid,boolean,text)
TO authenticated,service_role;

-- =========================================================
-- DESENVOLVEDORES: apenas admin global
-- Remove todas as policies anteriores dessas tabelas e recria de forma explícita.
-- =========================================================
DO $$
DECLARE
  t text;
  p record;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'seguranca_chaves_api',
    'seguranca_webhooks',
    'seguranca_webhooks_log'
  ]
  LOOP
    FOR p IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname='public' AND tablename=t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',p.policyname,t);
    END LOOP;
  END LOOP;
END $$;

CREATE POLICY developer_api_keys_admin_only
ON public.seguranca_chaves_api
FOR ALL TO authenticated
USING (public.fn_is_admin_global())
WITH CHECK (public.fn_is_admin_global());

CREATE POLICY developer_webhooks_admin_only
ON public.seguranca_webhooks
FOR ALL TO authenticated
USING (public.fn_is_admin_global())
WITH CHECK (public.fn_is_admin_global());

CREATE POLICY developer_webhook_logs_admin_only
ON public.seguranca_webhooks_log
FOR ALL TO authenticated
USING (public.fn_is_admin_global())
WITH CHECK (public.fn_is_admin_global());

-- Configuração global também é somente plataforma.
DROP POLICY IF EXISTS agc_all ON public.admin_global_config;
DROP POLICY IF EXISTS "agc_all" ON public.admin_global_config;
CREATE POLICY agc_all
ON public.admin_global_config
FOR ALL TO authenticated
USING (public.fn_is_admin_global())
WITH CHECK (public.fn_is_admin_global());

-- Taxas da plataforma: leitura/escrita administrativa global.
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname='public' AND tablename='taxas_plataforma'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.taxas_plataforma',p.policyname);
  END LOOP;
END $$;

CREATE POLICY platform_fees_admin_only
ON public.taxas_plataforma
FOR ALL TO authenticated
USING (public.fn_is_admin_global())
WITH CHECK (public.fn_is_admin_global());

-- =========================================================
-- API KEYS: segredo retornado uma vez, somente hash persiste.
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_admin_criar_chave_api(
  p_empresa_id uuid,
  p_nome text,
  p_escopos text[] DEFAULT ARRAY['read']::text[],
  p_expira_em timestamptz DEFAULT NULL
)
RETURNS TABLE(id uuid, chave text, prefixo text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_id uuid;
  v_secret text;
  v_prefix text;
BEGIN
  IF NOT public.fn_is_admin_global() THEN
    RAISE EXCEPTION 'platform_admin_required';
  END IF;
  IF trim(coalesce(p_nome,''))='' THEN
    RAISE EXCEPTION 'api_key_name_required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.empresas WHERE id=p_empresa_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'company_not_found';
  END IF;
  IF p_escopos IS NULL OR cardinality(p_escopos)=0
     OR EXISTS (
       SELECT 1 FROM unnest(p_escopos) s
       WHERE s NOT IN ('read','write','webhooks','orders','products','reports')
     ) THEN
    RAISE EXCEPTION 'invalid_api_key_scope';
  END IF;

  v_secret := 'ce_live_' || encode(gen_random_bytes(32),'hex');
  v_prefix := left(v_secret,24);

  INSERT INTO public.seguranca_chaves_api (
    empresa_id,profile_id,nome,chave_prefixo,chave_hash,tipo_chave,
    escopos,data_expiracao,criado_por,ativa,metadata
  ) VALUES (
    p_empresa_id,auth.uid(),trim(p_nome),v_prefix,
    encode(digest(v_secret,'sha256'),'hex'),'producao',
    p_escopos,p_expira_em,auth.uid(),true,
    jsonb_build_object('hash','sha256','exibida_uma_vez',true)
  )
  RETURNING seguranca_chaves_api.id INTO v_id;

  INSERT INTO public.seguranca_audit_log (
    empresa_id,profile_id,acao,modulo,entidade,entidade_id,descricao,detalhes
  ) VALUES (
    p_empresa_id,auth.uid(),'create','developers','api_key',v_id,
    'Chave de API criada',
    jsonb_build_object('prefixo',v_prefix,'escopos',p_escopos)
  );

  RETURN QUERY SELECT v_id,v_secret,v_prefix;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_criar_chave_api(uuid,text,text[],timestamptz)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_criar_chave_api(uuid,text,text[],timestamptz)
TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_revogar_chave_api(
  p_id uuid,
  p_motivo text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v_empresa uuid;
BEGIN
  IF NOT public.fn_is_admin_global() THEN
    RAISE EXCEPTION 'platform_admin_required';
  END IF;
  IF trim(coalesce(p_motivo,''))='' THEN RAISE EXCEPTION 'audit_reason_required'; END IF;

  UPDATE public.seguranca_chaves_api
  SET ativa=false,deleted_at=coalesce(deleted_at,now()),updated_at=now(),
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('revogada_motivo',p_motivo)
  WHERE id=p_id AND deleted_at IS NULL
  RETURNING empresa_id INTO v_empresa;

  IF NOT FOUND THEN RAISE EXCEPTION 'api_key_not_found'; END IF;

  INSERT INTO public.seguranca_audit_log (
    empresa_id,profile_id,acao,modulo,entidade,entidade_id,descricao,detalhes
  ) VALUES (
    v_empresa,auth.uid(),'delete','developers','api_key',p_id,
    'Chave de API revogada',jsonb_build_object('motivo',p_motivo)
  );
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_revogar_chave_api(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_revogar_chave_api(uuid,text) TO authenticated;

-- Nunca exponha hashes como mecanismo de autenticação ao cliente.
REVOKE SELECT (chave_hash) ON public.seguranca_chaves_api FROM authenticated;
