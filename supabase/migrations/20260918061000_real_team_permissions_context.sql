-- Cash Engine PRO — Equipe, permissões e contexto multiempresa reais.
-- Segurança: impede autopromoção via profiles e separa admin da empresa de admin global.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -------------------------------------------------------------------------
-- Contexto de empresa por usuário
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profile_company_context (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_company_context ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profile_company_context FROM anon,authenticated;

CREATE POLICY profile_company_context_self_read
ON public.profile_company_context FOR SELECT TO authenticated
USING(profile_id=auth.uid());

CREATE OR REPLACE FUNCTION public.fn_usuario_tem_empresa(p_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND p_empresa_id IS NOT NULL
    AND (
      EXISTS(
        SELECT 1 FROM public.profiles p
        WHERE p.id=auth.uid()
          AND p.empresa_id=p_empresa_id
          AND p.status='ativo'
          AND p.deleted_at IS NULL
      )
      OR EXISTS(
        SELECT 1 FROM public.equipe_membros em
        JOIN public.profiles p ON p.id=em.profile_id
        WHERE em.profile_id=auth.uid()
          AND em.empresa_id=p_empresa_id
          AND em.status='ativo'
          AND em.deleted_at IS NULL
          AND p.status='ativo'
          AND p.deleted_at IS NULL
      )
    );
$$;

REVOKE ALL ON FUNCTION public.fn_usuario_tem_empresa(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_usuario_tem_empresa(uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.current_empresa_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN NULL
    WHEN EXISTS(
      SELECT 1
      FROM public.profile_company_context c
      WHERE c.profile_id=auth.uid()
        AND public.fn_usuario_tem_empresa(c.empresa_id)
    )
    THEN (
      SELECT c.empresa_id
      FROM public.profile_company_context c
      WHERE c.profile_id=auth.uid()
    )
    ELSE (
      SELECT p.empresa_id
      FROM public.profiles p
      WHERE p.id=auth.uid()
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.fn_empresas_autorizadas()
RETURNS TABLE(
  empresa_id uuid,
  nome text,
  contexto_ativo boolean,
  vinculo text,
  is_owner boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v_current uuid:=public.current_empresa_id();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  RETURN QUERY
  WITH memberships AS (
    SELECT
      p.empresa_id,
      CASE WHEN p.is_owner THEN 'proprietario' ELSE 'principal' END::text AS vinculo,
      p.is_owner
    FROM public.profiles p
    WHERE p.id=auth.uid()
      AND p.empresa_id IS NOT NULL
      AND p.status='ativo'
      AND p.deleted_at IS NULL

    UNION

    SELECT
      em.empresa_id,
      'equipe'::text,
      false
    FROM public.equipe_membros em
    WHERE em.profile_id=auth.uid()
      AND em.status='ativo'
      AND em.deleted_at IS NULL
  )
  SELECT
    e.id,
    coalesce(e.nome_fantasia,e.razao_social,'Empresa')::text,
    e.id=v_current,
    m.vinculo,
    m.is_owner
  FROM memberships m
  JOIN public.empresas e ON e.id=m.empresa_id
  WHERE e.status='ativo' AND e.deleted_at IS NULL
  ORDER BY (e.id=v_current) DESC,2;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_empresas_autorizadas() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_empresas_autorizadas() TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_contexto_empresa_definir(p_empresa_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.fn_usuario_tem_empresa(p_empresa_id) THEN
    RAISE EXCEPTION 'company_context_not_authorized';
  END IF;

  INSERT INTO public.profile_company_context(profile_id,empresa_id,updated_at)
  VALUES(auth.uid(),p_empresa_id,now())
  ON CONFLICT(profile_id)
  DO UPDATE SET empresa_id=excluded.empresa_id,updated_at=now();

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_contexto_empresa_definir(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_contexto_empresa_definir(uuid) TO authenticated;

-- -------------------------------------------------------------------------
-- Bloqueio de autopromoção e troca de tenant por update direto
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_guard_profile_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT public.fn_is_admin_global()
     AND (
       NEW.is_admin_global IS DISTINCT FROM OLD.is_admin_global
       OR NEW.is_owner IS DISTINCT FROM OLD.is_owner
       OR NEW.empresa_id IS DISTINCT FROM OLD.empresa_id
       OR NEW.status IS DISTINCT FROM OLD.status
     ) THEN
    RAISE EXCEPTION 'privileged_profile_fields_cannot_be_self_modified';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_privileged_fields ON public.profiles;
CREATE TRIGGER trg_guard_profile_privileged_fields
BEFORE UPDATE OF is_admin_global,is_owner,empresa_id,status
ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.fn_guard_profile_privileged_fields();

-- -------------------------------------------------------------------------
-- Helpers de gestão
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_pode_gerenciar_equipe()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
  SELECT public.fn_is_admin_global()
    OR public.fn_is_empresa_owner(public.current_empresa_id())
    OR public.fn_tem_permissao('rh','equipe','manage'::public.tipo_operacao)
    OR public.fn_tem_permissao('rh','equipe','update'::public.tipo_operacao);
$$;

CREATE OR REPLACE FUNCTION public.fn_pode_gerenciar_permissoes()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
  SELECT public.fn_is_admin_global()
    OR public.fn_is_empresa_owner(public.current_empresa_id())
    OR public.fn_tem_permissao('configuracoes','permissoes','manage'::public.tipo_operacao);
$$;

REVOKE ALL ON FUNCTION public.fn_pode_gerenciar_equipe() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.fn_pode_gerenciar_permissoes() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_pode_gerenciar_equipe() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_pode_gerenciar_permissoes() TO authenticated;

-- -------------------------------------------------------------------------
-- Convites de equipe: token bruto só sai na criação; hash persiste.
-- -------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_invite_equipe_pendente_empresa_email
ON public.invites(empresa_id,lower(email),tipo)
WHERE tipo='equipe' AND status='pendente';

CREATE OR REPLACE FUNCTION public.fn_equipe_convite_criar(
  p_email text,
  p_nome text,
  p_cargo text,
  p_role_id uuid,
  p_expira_dias integer DEFAULT 7
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,auth
AS $$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_email text:=lower(trim(coalesce(p_email,'')));
  v_code text;
  v_token text;
  v_hash text;
  v_id uuid;
  v_expira timestamptz;
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.fn_pode_gerenciar_equipe() THEN RAISE EXCEPTION 'permission_denied'; END IF;
  IF v_email='' OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'team_invite_email_invalid';
  END IF;
  IF trim(coalesce(p_cargo,''))='' THEN RAISE EXCEPTION 'team_job_title_required'; END IF;
  IF p_expira_dias<1 OR p_expira_dias>30 THEN RAISE EXCEPTION 'team_invite_expiration_invalid'; END IF;

  IF p_role_id IS NOT NULL AND NOT EXISTS(
    SELECT 1
    FROM public.roles r
    WHERE r.id=p_role_id
      AND r.deleted_at IS NULL
      AND (r.empresa_id=v_empresa OR r.empresa_id IS NULL)
  ) THEN RAISE EXCEPTION 'role_not_available'; END IF;

  UPDATE public.invites
  SET status='expirado',updated_at=now()
  WHERE empresa_id=v_empresa AND tipo='equipe'
    AND lower(email)=v_email
    AND status='pendente' AND expira_em<=now();

  IF EXISTS(
    SELECT 1 FROM public.invites
    WHERE empresa_id=v_empresa AND tipo='equipe'
      AND lower(email)=v_email
      AND status='pendente' AND expira_em>now()
  ) THEN RAISE EXCEPTION 'team_invite_already_pending'; END IF;

  IF EXISTS(
    SELECT 1
    FROM public.equipe_membros em
    JOIN public.profiles p ON p.id=em.profile_id
    WHERE em.empresa_id=v_empresa
      AND lower(p.email)=v_email
      AND em.deleted_at IS NULL
      AND em.status='ativo'
  ) THEN RAISE EXCEPTION 'team_member_already_exists'; END IF;

  v_code:='TEAM-'||upper(encode(gen_random_bytes(10),'hex'));
  v_token:=encode(gen_random_bytes(32),'hex');
  v_hash:=encode(digest(v_token,'sha256'),'hex');
  v_expira:=now()+(p_expira_dias||' days')::interval;

  INSERT INTO public.invites(
    empresa_id,convidado_por,tipo,email,nome,cargo,role_id,
    codigo_convite,token_hash,status,expira_em,metadata
  ) VALUES (
    v_empresa,auth.uid(),'equipe',v_email,
    nullif(trim(coalesce(p_nome,'')),''),
    trim(p_cargo),p_role_id,
    v_code,v_hash,'pendente',v_expira,
    jsonb_build_object('delivery','copy_link','email_sent',false)
  )
  RETURNING id INTO v_id;

  INSERT INTO public.seguranca_audit_log(
    empresa_id,profile_id,acao,modulo,entidade,entidade_id,descricao,detalhes
  ) VALUES (
    v_empresa,auth.uid(),'convite_enviado','configuracoes','invite',v_id,
    'Convite de equipe criado',
    jsonb_build_object('email',v_email,'role_id',p_role_id,'email_sent',false)
  );

  RETURN jsonb_build_object(
    'invite_id',v_id,
    'code',v_code,
    'token',v_token,
    'expires_at',v_expira,
    'email_sent',false,
    'delivery','copy_link'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_equipe_convite_criar(text,text,text,uuid,integer)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_equipe_convite_criar(text,text,text,uuid,integer)
TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_equipe_convite_visualizar(p_code text,p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_i public.invites%ROWTYPE;
  v_company text;
  v_role text;
  v_hint text;
BEGIN
  SELECT * INTO v_i
  FROM public.invites
  WHERE codigo_convite=trim(coalesce(p_code,''))
    AND tipo='equipe'
  LIMIT 1;

  IF NOT FOUND
     OR v_i.token_hash<>encode(digest(trim(coalesce(p_token,'')),'sha256'),'hex') THEN
    RAISE EXCEPTION 'team_invite_invalid';
  END IF;
  IF v_i.status<>'pendente' THEN RAISE EXCEPTION 'team_invite_not_pending'; END IF;
  IF v_i.expira_em<=now() THEN RAISE EXCEPTION 'team_invite_expired'; END IF;

  SELECT coalesce(nome_fantasia,razao_social,'Empresa') INTO v_company
  FROM public.empresas WHERE id=v_i.empresa_id;
  SELECT nome INTO v_role FROM public.roles WHERE id=v_i.role_id;

  v_hint:=CASE WHEN position('@' in v_i.email)>2
    THEN left(v_i.email,2)||'***'||substring(v_i.email from position('@' in v_i.email))
    ELSE '***' END;

  RETURN jsonb_build_object(
    'company_name',v_company,
    'name',v_i.nome,
    'email_hint',v_hint,
    'job_title',v_i.cargo,
    'role_name',v_role,
    'expires_at',v_i.expira_em
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_equipe_convite_visualizar(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_equipe_convite_visualizar(text,text)
TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.fn_equipe_convite_aceitar(p_code text,p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,auth
AS $$
DECLARE
  v_i public.invites%ROWTYPE;
  v_email text;
  v_member uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_i
  FROM public.invites
  WHERE codigo_convite=trim(coalesce(p_code,''))
    AND tipo='equipe'
  FOR UPDATE;

  IF NOT FOUND
     OR v_i.token_hash<>encode(digest(trim(coalesce(p_token,'')),'sha256'),'hex') THEN
    RAISE EXCEPTION 'team_invite_invalid';
  END IF;
  IF v_i.status<>'pendente' THEN RAISE EXCEPTION 'team_invite_not_pending'; END IF;
  IF v_i.expira_em<=now() THEN
    UPDATE public.invites SET status='expirado',updated_at=now() WHERE id=v_i.id;
    RAISE EXCEPTION 'team_invite_expired';
  END IF;

  SELECT lower(email) INTO v_email FROM auth.users WHERE id=auth.uid();
  IF v_email IS NULL OR v_email<>lower(v_i.email) THEN
    RAISE EXCEPTION 'team_invite_wrong_account';
  END IF;

  INSERT INTO public.equipe_membros(
    empresa_id,profile_id,convite_id,adicionado_por,cargo,
    status,data_admissao,metadata
  ) VALUES (
    v_i.empresa_id,auth.uid(),v_i.id,v_i.convidado_por,
    coalesce(nullif(trim(v_i.cargo),''),'Membro'),
    'ativo',current_date,jsonb_build_object('source','secure_invite')
  )
  ON CONFLICT(empresa_id,profile_id)
  DO UPDATE SET
    convite_id=excluded.convite_id,
    cargo=excluded.cargo,
    status='ativo',
    data_desligamento=NULL,
    deleted_at=NULL,
    updated_at=now()
  RETURNING id INTO v_member;

  IF v_i.role_id IS NOT NULL THEN
    INSERT INTO public.profile_roles(
      profile_id,role_id,empresa_id,concedido_por,data_concessao
    ) VALUES (
      auth.uid(),v_i.role_id,v_i.empresa_id,v_i.convidado_por,now()
    )
    ON CONFLICT(profile_id,role_id,empresa_id)
    DO UPDATE SET
      concedido_por=excluded.concedido_por,
      data_concessao=now(),
      expira_em=NULL;
  END IF;

  UPDATE public.invites
  SET status='aceito',aceito_em=now(),aceito_por=auth.uid(),updated_at=now()
  WHERE id=v_i.id;

  INSERT INTO public.profile_company_context(profile_id,empresa_id,updated_at)
  VALUES(auth.uid(),v_i.empresa_id,now())
  ON CONFLICT(profile_id)
  DO UPDATE SET empresa_id=excluded.empresa_id,updated_at=now();

  INSERT INTO public.seguranca_audit_log(
    empresa_id,profile_id,acao,modulo,entidade,entidade_id,descricao,detalhes
  ) VALUES (
    v_i.empresa_id,auth.uid(),'convite_aceito','configuracoes','equipe_membro',
    v_member,'Convite de equipe aceito',jsonb_build_object('invite_id',v_i.id)
  );

  RETURN v_member;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_equipe_convite_aceitar(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_equipe_convite_aceitar(text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_equipe_convite_revogar(p_invite_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v_empresa uuid:=public.current_empresa_id();
BEGIN
  IF NOT public.fn_pode_gerenciar_equipe() THEN RAISE EXCEPTION 'permission_denied'; END IF;

  UPDATE public.invites
  SET status='revogado',revogado_em=now(),revogado_por=auth.uid(),updated_at=now()
  WHERE id=p_invite_id AND empresa_id=v_empresa
    AND tipo='equipe' AND status='pendente';

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_equipe_convite_revogar(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_equipe_convite_revogar(uuid) TO authenticated;

-- -------------------------------------------------------------------------
-- Equipe: leitura, função e remoção
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_equipe_listar()
RETURNS TABLE(
  membro_id uuid,
  profile_id uuid,
  nome text,
  email text,
  avatar_url text,
  cargo text,
  status text,
  ultimo_acesso timestamptz,
  created_at timestamptz,
  role_id uuid,
  role_nome text,
  is_owner boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v_empresa uuid:=public.current_empresa_id();
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT (
    public.fn_pode_gerenciar_equipe()
    OR public.fn_tem_permissao('rh','equipe','read'::public.tipo_operacao)
  ) THEN RAISE EXCEPTION 'permission_denied'; END IF;

  RETURN QUERY
  WITH members AS (
    SELECT
      em.id AS membro_id,em.profile_id,em.cargo,em.status::text,
      em.created_at,false AS owner_flag
    FROM public.equipe_membros em
    WHERE em.empresa_id=v_empresa AND em.deleted_at IS NULL

    UNION ALL

    SELECT
      NULL::uuid,p.id,p.cargo,p.status::text,p.created_at,true
    FROM public.profiles p
    WHERE p.empresa_id=v_empresa
      AND p.is_owner
      AND p.deleted_at IS NULL
      AND NOT EXISTS(
        SELECT 1 FROM public.equipe_membros em
        WHERE em.empresa_id=v_empresa AND em.profile_id=p.id AND em.deleted_at IS NULL
      )
  )
  SELECT
    m.membro_id,m.profile_id,p.nome_completo::text,p.email::text,p.avatar_url,
    coalesce(m.cargo,p.cargo,'Membro')::text,m.status,p.ultimo_login,m.created_at,
    pr.role_id,r.nome::text,(p.is_owner OR m.owner_flag)
  FROM members m
  JOIN public.profiles p ON p.id=m.profile_id
  LEFT JOIN LATERAL (
    SELECT x.role_id
    FROM public.profile_roles x
    JOIN public.roles rr ON rr.id=x.role_id
    WHERE x.profile_id=m.profile_id
      AND x.empresa_id=v_empresa
      AND (x.expira_em IS NULL OR x.expira_em>now())
      AND rr.deleted_at IS NULL
    ORDER BY rr.nivel DESC,x.data_concessao DESC
    LIMIT 1
  ) pr ON true
  LEFT JOIN public.roles r ON r.id=pr.role_id
  ORDER BY (p.is_owner OR m.owner_flag) DESC,p.nome_completo;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_equipe_listar() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_equipe_listar() TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_equipe_convites_listar()
RETURNS TABLE(
  id uuid,email text,nome text,cargo text,role_id uuid,role_nome text,
  status text,expira_em timestamptz,created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v_empresa uuid:=public.current_empresa_id();
BEGIN
  IF NOT public.fn_pode_gerenciar_equipe() THEN RAISE EXCEPTION 'permission_denied'; END IF;

  RETURN QUERY
  SELECT
    i.id,i.email::text,i.nome::text,i.cargo::text,i.role_id,r.nome::text,
    CASE WHEN i.status='pendente' AND i.expira_em<=now()
      THEN 'expirado' ELSE i.status END::text,
    i.expira_em,i.created_at
  FROM public.invites i
  LEFT JOIN public.roles r ON r.id=i.role_id
  WHERE i.empresa_id=v_empresa AND i.tipo='equipe'
  ORDER BY i.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_equipe_convites_listar() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_equipe_convites_listar() TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_equipe_role_definir(
  p_profile_id uuid,
  p_role_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_role public.roles%ROWTYPE;
BEGIN
  IF NOT public.fn_pode_gerenciar_equipe() THEN RAISE EXCEPTION 'permission_denied'; END IF;
  IF p_profile_id=auth.uid() THEN RAISE EXCEPTION 'cannot_change_own_role'; END IF;

  IF NOT EXISTS(
    SELECT 1 FROM public.equipe_membros
    WHERE empresa_id=v_empresa AND profile_id=p_profile_id
      AND status='ativo' AND deleted_at IS NULL
  ) THEN RAISE EXCEPTION 'team_member_not_found'; END IF;

  SELECT * INTO v_role FROM public.roles
  WHERE id=p_role_id AND deleted_at IS NULL
    AND (empresa_id=v_empresa OR empresa_id IS NULL);
  IF NOT FOUND THEN RAISE EXCEPTION 'role_not_available'; END IF;

  -- Admin global nunca é concedido por role de empresa. Além disso,
  -- somente o owner pode conceder uma role administrativa da empresa.
  IF v_role.is_admin AND NOT (
    public.fn_is_admin_global() OR public.fn_is_empresa_owner(v_empresa)
  ) THEN RAISE EXCEPTION 'owner_required_for_admin_role'; END IF;

  DELETE FROM public.profile_roles
  WHERE profile_id=p_profile_id AND empresa_id=v_empresa;

  INSERT INTO public.profile_roles(
    profile_id,role_id,empresa_id,concedido_por,data_concessao
  ) VALUES(p_profile_id,p_role_id,v_empresa,auth.uid(),now());

  INSERT INTO public.seguranca_audit_log(
    empresa_id,profile_id,acao,modulo,entidade,entidade_id,descricao,detalhes
  ) VALUES(
    v_empresa,auth.uid(),'permissao_concedida','configuracoes','profile',p_profile_id,
    'Função de membro atualizada',
    jsonb_build_object('target_profile_id',p_profile_id,'role_id',p_role_id)
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_equipe_role_definir(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_equipe_role_definir(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_equipe_remover(
  p_profile_id uuid,
  p_motivo text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_member uuid;
BEGIN
  IF NOT public.fn_pode_gerenciar_equipe() THEN RAISE EXCEPTION 'permission_denied'; END IF;
  IF p_profile_id=auth.uid() THEN RAISE EXCEPTION 'cannot_remove_self'; END IF;
  IF EXISTS(
    SELECT 1 FROM public.profiles
    WHERE id=p_profile_id AND empresa_id=v_empresa AND is_owner
  ) THEN RAISE EXCEPTION 'cannot_remove_owner'; END IF;
  IF trim(coalesce(p_motivo,''))='' THEN RAISE EXCEPTION 'removal_reason_required'; END IF;

  UPDATE public.equipe_membros
  SET status='inativo',data_desligamento=current_date,
      deleted_at=now(),updated_at=now(),
      metadata=coalesce(metadata,'{}'::jsonb)||
        jsonb_build_object('removal_reason',left(trim(p_motivo),500),'removed_by',auth.uid())
  WHERE empresa_id=v_empresa AND profile_id=p_profile_id
    AND deleted_at IS NULL
  RETURNING id INTO v_member;
  IF v_member IS NULL THEN RAISE EXCEPTION 'team_member_not_found'; END IF;

  DELETE FROM public.profile_roles
  WHERE profile_id=p_profile_id AND empresa_id=v_empresa;

  DELETE FROM public.profile_company_context
  WHERE profile_id=p_profile_id AND empresa_id=v_empresa;

  UPDATE public.seguranca_sessoes
  SET status='revogada',data_logout=now()
  WHERE profile_id=p_profile_id AND empresa_id=v_empresa AND status='ativa';

  INSERT INTO public.seguranca_audit_log(
    empresa_id,profile_id,acao,modulo,entidade,entidade_id,descricao,detalhes
  ) VALUES(
    v_empresa,auth.uid(),'permissao_revogada','configuracoes','equipe_membro',v_member,
    'Membro removido da empresa',
    jsonb_build_object('target_profile_id',p_profile_id,'reason',left(trim(p_motivo),500))
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_equipe_remover(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_equipe_remover(uuid,text) TO authenticated;

-- -------------------------------------------------------------------------
-- Roles e matriz de permissões reais
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_roles_listar()
RETURNS TABLE(
  id uuid,nome text,descricao text,nivel integer,is_sistema boolean,is_admin boolean,
  membros bigint,permissoes uuid[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v_empresa uuid:=public.current_empresa_id();
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT (
    public.fn_pode_gerenciar_permissoes()
    OR public.fn_pode_gerenciar_equipe()
  ) THEN RAISE EXCEPTION 'permission_denied'; END IF;

  RETURN QUERY
  SELECT
    r.id,r.nome::text,r.descricao::text,r.nivel,r.is_sistema,r.is_admin,
    (
      SELECT count(*)
      FROM public.profile_roles pr
      WHERE pr.role_id=r.id AND pr.empresa_id=v_empresa
        AND (pr.expira_em IS NULL OR pr.expira_em>now())
    ),
    coalesce((
      SELECT array_agg(rp.permission_id ORDER BY rp.permission_id)
      FROM public.role_permissions rp WHERE rp.role_id=r.id
    ),ARRAY[]::uuid[])
  FROM public.roles r
  WHERE r.deleted_at IS NULL
    AND (r.empresa_id=v_empresa OR r.empresa_id IS NULL)
  ORDER BY r.nivel DESC,r.nome;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_roles_listar() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_roles_listar() TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_permissions_listar()
RETURNS TABLE(
  id uuid,modulo text,recurso text,acao text,nome_exibicao text,descricao text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT (
    public.fn_pode_gerenciar_permissoes()
    OR public.fn_pode_gerenciar_equipe()
  ) THEN RAISE EXCEPTION 'permission_denied'; END IF;

  RETURN QUERY
  SELECT p.id,p.modulo::text,p.recurso::text,p.acao::text,
         p.nome_exibicao::text,p.descricao::text
  FROM public.permissions p
  ORDER BY p.modulo,p.recurso,p.acao;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_permissions_listar() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_permissions_listar() TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_role_criar(
  p_nome text,
  p_descricao text,
  p_permission_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_id uuid;
BEGIN
  IF NOT public.fn_pode_gerenciar_permissoes() THEN RAISE EXCEPTION 'permission_denied'; END IF;
  IF trim(coalesce(p_nome,''))='' THEN RAISE EXCEPTION 'role_name_required'; END IF;

  IF EXISTS(
    SELECT 1 FROM unnest(coalesce(p_permission_ids,ARRAY[]::uuid[])) x
    WHERE NOT EXISTS(SELECT 1 FROM public.permissions p WHERE p.id=x)
  ) THEN RAISE EXCEPTION 'permission_not_found'; END IF;

  INSERT INTO public.roles(
    empresa_id,nome,descricao,nivel,is_sistema,is_admin
  ) VALUES(
    v_empresa,trim(p_nome),nullif(trim(coalesce(p_descricao,'')),''),100,false,false
  )
  RETURNING id INTO v_id;

  INSERT INTO public.role_permissions(role_id,permission_id)
  SELECT v_id,x
  FROM unnest(coalesce(p_permission_ids,ARRAY[]::uuid[])) x
  ON CONFLICT DO NOTHING;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_role_criar(text,text,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_role_criar(text,text,uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_role_permissoes_salvar(
  p_role_id uuid,
  p_permission_ids uuid[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_role public.roles%ROWTYPE;
BEGIN
  IF NOT public.fn_pode_gerenciar_permissoes() THEN RAISE EXCEPTION 'permission_denied'; END IF;

  SELECT * INTO v_role FROM public.roles
  WHERE id=p_role_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'role_not_found'; END IF;

  -- Roles globais do sistema são template imutável. Crie uma role da empresa para customizar.
  IF v_role.empresa_id IS NULL OR v_role.is_sistema THEN
    RAISE EXCEPTION 'system_role_is_read_only';
  END IF;
  IF v_role.empresa_id<>v_empresa THEN RAISE EXCEPTION 'role_not_in_company'; END IF;

  IF EXISTS(
    SELECT 1 FROM unnest(coalesce(p_permission_ids,ARRAY[]::uuid[])) x
    WHERE NOT EXISTS(SELECT 1 FROM public.permissions p WHERE p.id=x)
  ) THEN RAISE EXCEPTION 'permission_not_found'; END IF;

  DELETE FROM public.role_permissions WHERE role_id=p_role_id;
  INSERT INTO public.role_permissions(role_id,permission_id)
  SELECT p_role_id,x
  FROM unnest(coalesce(p_permission_ids,ARRAY[]::uuid[])) x
  ON CONFLICT DO NOTHING;

  INSERT INTO public.seguranca_audit_log(
    empresa_id,profile_id,acao,modulo,entidade,entidade_id,descricao,detalhes
  ) VALUES(
    v_empresa,auth.uid(),'update','configuracoes','role',p_role_id,
    'Permissões de função atualizadas',
    jsonb_build_object('permission_count',coalesce(cardinality(p_permission_ids),0))
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_role_permissoes_salvar(uuid,uuid[])
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_role_permissoes_salvar(uuid,uuid[])
TO authenticated;
