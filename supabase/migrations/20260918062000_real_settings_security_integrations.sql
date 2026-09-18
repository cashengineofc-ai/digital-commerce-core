-- Cash Engine PRO — Conta, Empresa, Segurança e Integrações reais.

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- -------------------------------------------------------------------------
-- Avatar persistente
-- -------------------------------------------------------------------------
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES(
  'avatars','avatars',true,5242880,
  ARRAY['image/jpeg','image/png','image/webp']::text[]
)
ON CONFLICT(id) DO UPDATE SET
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

DROP POLICY IF EXISTS avatars_insert_own ON storage.objects;
CREATE POLICY avatars_insert_own
ON storage.objects FOR INSERT TO authenticated
WITH CHECK(
  bucket_id='avatars'
  AND (storage.foldername(name))[1]=auth.uid()::text
);

DROP POLICY IF EXISTS avatars_update_own ON storage.objects;
CREATE POLICY avatars_update_own
ON storage.objects FOR UPDATE TO authenticated
USING(
  bucket_id='avatars'
  AND (storage.foldername(name))[1]=auth.uid()::text
)
WITH CHECK(
  bucket_id='avatars'
  AND (storage.foldername(name))[1]=auth.uid()::text
);

DROP POLICY IF EXISTS avatars_delete_own ON storage.objects;
CREATE POLICY avatars_delete_own
ON storage.objects FOR DELETE TO authenticated
USING(
  bucket_id='avatars'
  AND (storage.foldername(name))[1]=auth.uid()::text
);

-- -------------------------------------------------------------------------
-- Conta
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_conta_obter()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE p public.profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO p FROM public.profiles WHERE id=auth.uid() AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile_not_found'; END IF;

  RETURN jsonb_build_object(
    'id',p.id,
    'name',p.nome_completo,
    'email',p.email,
    'phone',coalesce(p.celular,p.telefone),
    'avatar_url',p.avatar_url,
    'language',coalesce(p.preferencias->>'idioma','pt-BR'),
    'timezone',coalesce(p.preferencias->>'timezone','America/Sao_Paulo'),
    'currency',coalesce(p.preferencias->>'currency','BRL')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_conta_obter() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_conta_obter() TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_conta_atualizar(
  p_nome text,
  p_telefone text,
  p_avatar_url text,
  p_idioma text,
  p_timezone text,
  p_currency text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF trim(coalesce(p_nome,''))='' THEN RAISE EXCEPTION 'name_required'; END IF;
  IF p_idioma NOT IN ('pt-BR','en-US','es-ES') THEN RAISE EXCEPTION 'language_invalid'; END IF;
  IF p_currency NOT IN ('BRL','USD','EUR') THEN RAISE EXCEPTION 'currency_invalid'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_timezone) THEN
    RAISE EXCEPTION 'timezone_invalid';
  END IF;

  UPDATE public.profiles
  SET nome_completo=trim(p_nome),
      celular=nullif(trim(coalesce(p_telefone,'')),''),
      avatar_url=nullif(trim(coalesce(p_avatar_url,'')),''),
      preferencias=coalesce(preferencias,'{}'::jsonb)
        || jsonb_build_object(
          'idioma',p_idioma,
          'timezone',p_timezone,
          'currency',p_currency
        ),
      updated_at=now()
  WHERE id=auth.uid() AND deleted_at IS NULL;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_conta_atualizar(text,text,text,text,text,text)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_conta_atualizar(text,text,text,text,text,text)
TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_sync_profile_email_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email AND NEW.email IS NOT NULL THEN
    UPDATE public.profiles
    SET email=lower(NEW.email),updated_at=now()
    WHERE id=NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_email_from_auth ON auth.users;
CREATE TRIGGER trg_sync_profile_email_from_auth
AFTER UPDATE OF email ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_profile_email_from_auth();

-- -------------------------------------------------------------------------
-- Empresa
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_empresa_config_obter()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  e public.empresas%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO e FROM public.empresas WHERE id=v_empresa AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'company_not_found'; END IF;

  RETURN jsonb_build_object(
    'id',e.id,
    'razao_social',e.razao_social,
    'nome_fantasia',e.nome_fantasia,
    'cnpj',e.cnpj,
    'ie',e.ie,
    'email',e.email,
    'telefone',e.telefone,
    'segmento',e.segmento,
    'site',e.site,
    'logradouro',e.logradouro,
    'numero',e.numero,
    'complemento',e.complemento,
    'bairro',e.bairro,
    'cidade',e.cidade,
    'estado',e.estado,
    'cep',e.cep,
    'timezone',coalesce(e.configuracoes->>'timezone','America/Sao_Paulo')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_empresa_config_obter() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_empresa_config_obter() TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_empresa_config_atualizar(
  p_razao_social text,
  p_nome_fantasia text,
  p_cnpj text,
  p_ie text,
  p_email text,
  p_telefone text,
  p_segmento text,
  p_site text,
  p_logradouro text,
  p_numero text,
  p_complemento text,
  p_bairro text,
  p_cidade text,
  p_estado text,
  p_cep text,
  p_timezone text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v_empresa uuid:=public.current_empresa_id();
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT (
    public.fn_is_admin_global()
    OR public.fn_is_empresa_owner(v_empresa)
    OR public.fn_tem_permissao('configuracoes','empresa','update'::public.tipo_operacao)
    OR public.fn_tem_permissao('configuracoes','empresa','manage'::public.tipo_operacao)
  ) THEN RAISE EXCEPTION 'permission_denied'; END IF;

  IF trim(coalesce(p_nome_fantasia,''))='' THEN RAISE EXCEPTION 'company_name_required'; END IF;
  IF p_timezone IS NULL OR NOT EXISTS(
    SELECT 1 FROM pg_timezone_names WHERE name=p_timezone
  ) THEN RAISE EXCEPTION 'timezone_invalid'; END IF;

  UPDATE public.empresas
  SET razao_social=nullif(trim(coalesce(p_razao_social,'')),''),
      nome_fantasia=trim(p_nome_fantasia),
      cnpj=nullif(regexp_replace(coalesce(p_cnpj,''),'[^0-9]','','g'),''),
      ie=nullif(trim(coalesce(p_ie,'')),''),
      email=nullif(lower(trim(coalesce(p_email,''))),''),
      telefone=nullif(trim(coalesce(p_telefone,'')),''),
      segmento=nullif(trim(coalesce(p_segmento,'')),''),
      site=nullif(trim(coalesce(p_site,'')),''),
      logradouro=nullif(trim(coalesce(p_logradouro,'')),''),
      numero=nullif(trim(coalesce(p_numero,'')),''),
      complemento=nullif(trim(coalesce(p_complemento,'')),''),
      bairro=nullif(trim(coalesce(p_bairro,'')),''),
      cidade=nullif(trim(coalesce(p_cidade,'')),''),
      estado=nullif(upper(trim(coalesce(p_estado,''))),''),
      cep=nullif(regexp_replace(coalesce(p_cep,''),'[^0-9]','','g'),''),
      configuracoes=coalesce(configuracoes,'{}'::jsonb)
        || jsonb_build_object('timezone',p_timezone),
      updated_at=now()
  WHERE id=v_empresa AND deleted_at IS NULL;

  INSERT INTO public.seguranca_audit_log(
    empresa_id,profile_id,acao,modulo,entidade,entidade_id,descricao
  ) VALUES(
    v_empresa,auth.uid(),'update','configuracoes','empresa',v_empresa,
    'Dados da empresa atualizados'
  );

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_empresa_config_atualizar(
  text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_empresa_config_atualizar(
  text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text
) TO authenticated;

-- -------------------------------------------------------------------------
-- Segurança: eventos e registros internos de sessão, sem inventar dados.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_seguranca_eventos_me(p_limit integer DEFAULT 50)
RETURNS TABLE(
  id uuid,
  acao text,
  descricao text,
  modulo text,
  ip_address text,
  user_agent text,
  cidade text,
  pais text,
  status_resposta integer,
  risco_nivel text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
  SELECT
    a.id,a.acao::text,a.descricao,a.modulo::text,a.ip_address,a.user_agent,
    a.cidade::text,a.pais::text,a.status_resposta,a.risco_nivel::text,a.created_at
  FROM public.seguranca_audit_log a
  WHERE a.profile_id=auth.uid()
  ORDER BY a.created_at DESC,a.id DESC
  LIMIT greatest(1,least(coalesce(p_limit,50),100));
$$;

REVOKE ALL ON FUNCTION public.fn_seguranca_eventos_me(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_seguranca_eventos_me(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_seguranca_sessoes_me()
RETURNS TABLE(
  id uuid,
  navegador text,
  sistema_operacional text,
  dispositivo text,
  dispositivo_tipo text,
  ip_address text,
  cidade text,
  regiao text,
  pais text,
  status text,
  data_ultima_atividade timestamptz,
  data_login timestamptz,
  data_expiracao timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
  SELECT
    s.id,s.navegador::text,s.sistema_operacional::text,s.dispositivo::text,
    s.dispositivo_tipo::text,s.ip_address,s.cidade::text,s.regiao::text,s.pais::text,
    s.status::text,s.data_ultima_atividade,s.data_login,s.data_expiracao
  FROM public.seguranca_sessoes s
  WHERE s.profile_id=auth.uid()
  ORDER BY s.data_ultima_atividade DESC,s.id DESC
  LIMIT 100;
$$;

REVOKE ALL ON FUNCTION public.fn_seguranca_sessoes_me() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_seguranca_sessoes_me() TO authenticated;

-- -------------------------------------------------------------------------
-- Catálogo e armazenamento seguro de integrações
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.integracoes_catalogo (
  provider text PRIMARY KEY,
  nome text NOT NULL,
  descricao text,
  categoria text NOT NULL,
  operational boolean NOT NULL DEFAULT false,
  requires_secret boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.integracoes_catalogo(
  provider,nome,descricao,categoria,operational,requires_secret
) VALUES (
  'mercado_pago',
  'Mercado Pago',
  'Processamento Pix integrado e confirmação por API/webhook.',
  'Pagamentos',
  true,
  true
)
ON CONFLICT(provider) DO UPDATE SET
  nome=excluded.nome,
  descricao=excluded.descricao,
  categoria=excluded.categoria,
  operational=excluded.operational,
  requires_secret=excluded.requires_secret,
  updated_at=now();

ALTER TABLE public.integracoes_catalogo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS integracoes_catalogo_read ON public.integracoes_catalogo;
CREATE POLICY integracoes_catalogo_read
ON public.integracoes_catalogo FOR SELECT TO authenticated
USING(true);

CREATE OR REPLACE FUNCTION public.fn_integracoes_listar_safe()
RETURNS TABLE(
  provider text,
  nome text,
  descricao text,
  categoria text,
  operational boolean,
  integracao_id uuid,
  status text,
  last_sync_at timestamptz,
  last_error text,
  last_error_at timestamptz,
  connected_at timestamptz,
  disconnected_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v_empresa uuid:=public.current_empresa_id();
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  RETURN QUERY
  SELECT
    c.provider,c.nome,c.descricao,c.categoria,c.operational,
    i.id,i.status::text,i.last_sync_at,i.last_error,i.last_error_at,
    i.connected_at,i.disconnected_at
  FROM public.integracoes_catalogo c
  LEFT JOIN public.integracoes i
    ON i.provider=c.provider
   AND i.empresa_id=v_empresa
   AND i.deleted_at IS NULL
  ORDER BY c.nome;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_integracoes_listar_safe() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_integracoes_listar_safe() TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_integracao_pode_gerenciar()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
  SELECT public.fn_is_admin_global()
    OR public.fn_is_empresa_owner(public.current_empresa_id())
    OR public.fn_tem_permissao(
      'configuracoes','integracoes','manage'::public.tipo_operacao
    )
    OR public.fn_tem_permissao(
      'configuracoes','integracoes','update'::public.tipo_operacao
    );
$$;

REVOKE ALL ON FUNCTION public.fn_integracao_pode_gerenciar() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_integracao_pode_gerenciar() TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_integracao_configurar_secret(
  p_provider text,
  p_secret text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,vault
AS $$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_id uuid;
  v_secret_id uuid;
  v_old_secret_id uuid;
  v_name text;
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.fn_integracao_pode_gerenciar() THEN RAISE EXCEPTION 'permission_denied'; END IF;
  IF trim(coalesce(p_secret,''))='' THEN RAISE EXCEPTION 'integration_secret_required'; END IF;

  SELECT nome INTO v_name
  FROM public.integracoes_catalogo
  WHERE provider=p_provider AND operational;
  IF NOT FOUND THEN RAISE EXCEPTION 'integration_provider_not_operational'; END IF;

  SELECT
    CASE
      WHEN metadata->>'vault_secret_id' ~* '^[0-9a-f-]{36}$'
      THEN (metadata->>'vault_secret_id')::uuid
      ELSE NULL
    END
  INTO v_old_secret_id
  FROM public.integracoes
  WHERE empresa_id=v_empresa AND provider=p_provider AND deleted_at IS NULL;

  v_secret_id:=vault.create_secret(
    p_secret,
    'cash_engine_'||p_provider||'_'||v_empresa::text,
    'Credencial por empresa do Cash Engine PRO'
  );

  INSERT INTO public.integracoes(
    empresa_id,provider,nome_integracao,categoria,status,
    credenciais_criptografadas,config,connected_at,conectado_por,metadata
  ) VALUES(
    v_empresa,p_provider,v_name,'Pagamentos','nao_configurado',
    '{}'::jsonb,'{}'::jsonb,NULL,auth.uid(),
    jsonb_build_object('vault_secret_id',v_secret_id,'secret_storage','vault')
  )
  ON CONFLICT(empresa_id,provider)
  DO UPDATE SET
    nome_integracao=excluded.nome_integracao,
    metadata=coalesce(integracoes.metadata,'{}'::jsonb)
      || jsonb_build_object('vault_secret_id',v_secret_id,'secret_storage','vault'),
    status='nao_configurado',
    last_error=NULL,
    last_error_at=NULL,
    conectado_por=auth.uid(),
    disconnected_at=NULL,
    deleted_at=NULL,
    updated_at=now()
  RETURNING id INTO v_id;

  IF v_old_secret_id IS NOT NULL AND v_old_secret_id<>v_secret_id THEN
    DELETE FROM vault.secrets WHERE id=v_old_secret_id;
  END IF;

  INSERT INTO public.seguranca_audit_log(
    empresa_id,profile_id,acao,modulo,entidade,entidade_id,descricao,detalhes
  ) VALUES(
    v_empresa,auth.uid(),'update','configuracoes','integracao',v_id,
    'Credencial de integração atualizada',
    jsonb_build_object('provider',p_provider,'storage','vault')
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_integracao_configurar_secret(text,text)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_integracao_configurar_secret(text,text)
TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_integracao_desconectar(p_integracao_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,vault
AS $$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_secret_id uuid;
BEGIN
  IF NOT public.fn_integracao_pode_gerenciar() THEN RAISE EXCEPTION 'permission_denied'; END IF;

  SELECT CASE
    WHEN metadata->>'vault_secret_id' ~* '^[0-9a-f-]{36}$'
    THEN (metadata->>'vault_secret_id')::uuid
    ELSE NULL END
  INTO v_secret_id
  FROM public.integracoes
  WHERE id=p_integracao_id AND empresa_id=v_empresa AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'integration_not_found'; END IF;

  UPDATE public.integracoes
  SET status='revogado',disconnected_at=now(),desconectado_por=auth.uid(),
      metadata=coalesce(metadata,'{}'::jsonb)-'vault_secret_id',
      updated_at=now()
  WHERE id=p_integracao_id;

  IF v_secret_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id=v_secret_id;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_integracao_desconectar(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_integracao_desconectar(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_integracao_service_secret(p_integracao_id uuid)
RETURNS TABLE(provider text,secret text,empresa_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path=public,vault
AS $$
  SELECT
    i.provider,
    ds.decrypted_secret,
    i.empresa_id
  FROM public.integracoes i
  JOIN vault.decrypted_secrets ds
    ON ds.id=(i.metadata->>'vault_secret_id')::uuid
  WHERE i.id=p_integracao_id
    AND i.deleted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.fn_integracao_service_secret(uuid)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_integracao_service_secret(uuid)
TO service_role;

CREATE OR REPLACE FUNCTION public.fn_integracao_test_result(
  p_integracao_id uuid,
  p_success boolean,
  p_status integer,
  p_error text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  IF current_setting('role',true)<>'service_role' THEN
    RAISE EXCEPTION 'service_role_required';
  END IF;

  UPDATE public.integracoes
  SET status=CASE WHEN p_success THEN 'conectado'::public.status_integracao
                  ELSE 'erro'::public.status_integracao END,
      last_sync_at=CASE WHEN p_success THEN now() ELSE last_sync_at END,
      connected_at=CASE WHEN p_success THEN coalesce(connected_at,now()) ELSE connected_at END,
      last_error=CASE WHEN p_success THEN NULL ELSE left(coalesce(p_error,'Falha de conexão'),1000) END,
      last_error_at=CASE WHEN p_success THEN NULL ELSE now() END,
      total_requisicoes=coalesce(total_requisicoes,0)+1,
      updated_at=now()
  WHERE id=p_integracao_id AND deleted_at IS NULL;

  INSERT INTO public.integracoes_logs(
    integracao_id,empresa_id,acao,metodo_http,endpoint_url,status_resposta,
    sucesso,mensagem_erro,tentativa_numero
  )
  SELECT
    i.id,i.empresa_id,'test_connection','GET','provider_identity',
    p_status,p_success,left(p_error,1000),1
  FROM public.integracoes i
  WHERE i.id=p_integracao_id AND i.deleted_at IS NULL;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_integracao_test_result(uuid,boolean,integer,text)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_integracao_test_result(uuid,boolean,integer,text)
TO service_role;
