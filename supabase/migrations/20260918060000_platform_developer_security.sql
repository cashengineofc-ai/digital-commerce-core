-- Cash Engine PRO — área Desenvolvedores exclusiva do admin da plataforma.
-- API keys: segredo mostrado uma única vez; apenas SHA-256 persistido.
-- Webhook signing secret: permanece no servidor e nunca é retornado depois da criação.
-- Provider secrets não são expostos ao frontend.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.seguranca_chaves_api
  ADD COLUMN IF NOT EXISTS revogada_em timestamptz,
  ADD COLUMN IF NOT EXISTS revogada_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motivo_revogacao text;

ALTER TABLE public.seguranca_webhooks
  ADD COLUMN IF NOT EXISTS segredo_prefixo varchar(32),
  ADD COLUMN IF NOT EXISTS revogado_em timestamptz,
  ADD COLUMN IF NOT EXISTS revogado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_dev_api_key_hash
ON public.seguranca_chaves_api(chave_hash)
WHERE deleted_at IS NULL;

-- Defesa em profundidade: essas tabelas nunca são consumidas diretamente pelo browser.
REVOKE ALL ON public.seguranca_chaves_api FROM anon,authenticated;
REVOKE ALL ON public.seguranca_webhooks FROM anon,authenticated;
REVOKE ALL ON public.seguranca_webhooks_log FROM anon,authenticated;

-- Remove políticas antigas e mantém uma política explícita para eventual acesso
-- administrativo em contexto privilegiado. As RPCs abaixo continuam sendo o caminho oficial.
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT tablename,policyname
    FROM pg_policies
    WHERE schemaname='public'
      AND tablename IN (
        'seguranca_chaves_api',
        'seguranca_webhooks',
        'seguranca_webhooks_log'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      p.policyname,p.tablename
    );
  END LOOP;
END $$;

ALTER TABLE public.seguranca_chaves_api ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seguranca_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seguranca_webhooks_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY dev_api_keys_admin_only
ON public.seguranca_chaves_api
FOR ALL TO authenticated
USING(public.fn_is_admin_global())
WITH CHECK(public.fn_is_admin_global());

CREATE POLICY dev_webhooks_admin_only
ON public.seguranca_webhooks
FOR ALL TO authenticated
USING(public.fn_is_admin_global())
WITH CHECK(public.fn_is_admin_global());

CREATE POLICY dev_webhook_logs_admin_only
ON public.seguranca_webhooks_log
FOR SELECT TO authenticated
USING(
  public.fn_is_admin_global()
  AND EXISTS(
    SELECT 1 FROM public.seguranca_webhooks w
    WHERE w.id=seguranca_webhooks_log.webhook_id
  )
);

-- Provider credentials remain server-side. Authenticated clients get only safe metadata.
REVOKE SELECT ON public.integracoes FROM authenticated;
GRANT SELECT (
  id,empresa_id,provider,nome_integracao,descricao,categoria,logo_url,status,
  webhook_url,last_sync_at,last_error,last_error_at,connected_at,disconnected_at,
  rate_limit_por_minuto,rate_limit_por_dia,total_requisicoes,created_at,updated_at,deleted_at
) ON public.integracoes TO authenticated;

-- =========================================================
-- API KEYS
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_dev_api_key_create(
  p_empresa_id uuid,
  p_nome text,
  p_tipo text,
  p_escopos text[],
  p_expira_em timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_secret text;
  v_prefix text;
  v_hash text;
  v_id uuid;
  v_scopes text[];
  v_allowed constant text[]:=ARRAY[
    'payments:read',
    'orders:read',
    'products:read',
    'affiliates:read',
    'reports:read',
    'webhooks:manage'
  ]::text[];
BEGIN
  IF NOT public.fn_is_admin_global() THEN
    RAISE EXCEPTION 'platform_admin_required';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.empresas
    WHERE id=p_empresa_id AND deleted_at IS NULL
  ) THEN RAISE EXCEPTION 'company_not_found'; END IF;
  IF trim(coalesce(p_nome,''))='' THEN RAISE EXCEPTION 'api_key_name_required'; END IF;
  IF p_tipo NOT IN ('teste','producao') THEN RAISE EXCEPTION 'api_key_environment_invalid'; END IF;
  IF p_expira_em IS NOT NULL AND p_expira_em<=now() THEN
    RAISE EXCEPTION 'api_key_expiration_invalid';
  END IF;

  SELECT array_agg(DISTINCT scope ORDER BY scope)
  INTO v_scopes
  FROM unnest(coalesce(p_escopos,ARRAY[]::text[])) AS scope;

  IF coalesce(cardinality(v_scopes),0)=0
     OR NOT (v_scopes <@ v_allowed) THEN
    RAISE EXCEPTION 'api_key_scope_invalid';
  END IF;

  v_secret:='ce_'||
    CASE WHEN p_tipo='producao' THEN 'live_' ELSE 'test_' END||
    encode(gen_random_bytes(32),'hex');
  v_prefix:=left(v_secret,24);
  v_hash:=encode(digest(v_secret,'sha256'),'hex');

  INSERT INTO public.seguranca_chaves_api(
    empresa_id,profile_id,nome,chave_prefixo,chave_hash,tipo_chave,
    escopos,data_criacao,data_expiracao,criado_por,ativa,metadata
  ) VALUES (
    p_empresa_id,auth.uid(),trim(p_nome),v_prefix,v_hash,p_tipo,
    v_scopes,now(),p_expira_em,auth.uid(),true,
    jsonb_build_object(
      'secret_storage','sha256_only',
      'shown_once',true
    )
  )
  RETURNING id INTO v_id;

  INSERT INTO public.seguranca_audit_log(
    empresa_id,profile_id,acao,modulo,entidade,entidade_id,descricao,detalhes
  ) VALUES (
    p_empresa_id,auth.uid(),'create','developers','api_key',v_id,
    'Chave de API criada',
    jsonb_build_object(
      'prefix',v_prefix,'environment',p_tipo,'scopes',v_scopes
    )
  );

  RETURN jsonb_build_object(
    'id',v_id,
    'secret',v_secret,
    'prefix',v_prefix,
    'environment',p_tipo,
    'scopes',v_scopes,
    'expires_at',p_expira_em
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_dev_api_key_create(
  uuid,text,text,text[],timestamptz
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_dev_api_key_create(
  uuid,text,text,text[],timestamptz
) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_dev_api_keys_list()
RETURNS TABLE(
  id uuid,
  empresa_id uuid,
  empresa_nome text,
  nome text,
  chave_prefixo text,
  tipo_chave text,
  escopos text[],
  data_criacao timestamptz,
  data_ultimo_uso timestamptz,
  data_expiracao timestamptz,
  total_requisicoes bigint,
  ativa boolean,
  revogada_em timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  IF NOT public.fn_is_admin_global() THEN
    RAISE EXCEPTION 'platform_admin_required';
  END IF;

  RETURN QUERY
  SELECT
    k.id,k.empresa_id,
    coalesce(e.nome_fantasia,e.razao_social,'Empresa')::text,
    k.nome::text,k.chave_prefixo::text,k.tipo_chave::text,k.escopos,
    k.data_criacao,k.data_ultimo_uso,k.data_expiracao,
    coalesce(k.total_requisicoes,0)::bigint,
    k.ativa,k.revogada_em
  FROM public.seguranca_chaves_api k
  JOIN public.empresas e ON e.id=k.empresa_id
  WHERE k.deleted_at IS NULL
  ORDER BY k.data_criacao DESC,k.id DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_dev_api_keys_list() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_dev_api_keys_list() TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_dev_api_key_revoke(
  p_key_id uuid,
  p_motivo text DEFAULT 'Revogada pelo administrador da plataforma'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_company uuid;
BEGIN
  IF NOT public.fn_is_admin_global() THEN
    RAISE EXCEPTION 'platform_admin_required';
  END IF;

  UPDATE public.seguranca_chaves_api
  SET ativa=false,
      revogada_em=now(),
      revogada_por=auth.uid(),
      motivo_revogacao=left(coalesce(nullif(trim(p_motivo),''),'Revogada'),500),
      updated_at=now()
  WHERE id=p_key_id
    AND deleted_at IS NULL
    AND ativa
  RETURNING empresa_id INTO v_company;

  IF NOT FOUND THEN RETURN false; END IF;

  INSERT INTO public.seguranca_audit_log(
    empresa_id,profile_id,acao,modulo,entidade,entidade_id,descricao,detalhes
  ) VALUES (
    v_company,auth.uid(),'update','developers','api_key',p_key_id,
    'Chave de API revogada',
    jsonb_build_object('reason',p_motivo)
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_dev_api_key_revoke(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_dev_api_key_revoke(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_dev_api_key_rotate(p_key_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_old public.seguranca_chaves_api%ROWTYPE;
  v_secret text;
  v_prefix text;
  v_hash text;
  v_id uuid;
BEGIN
  IF NOT public.fn_is_admin_global() THEN
    RAISE EXCEPTION 'platform_admin_required';
  END IF;

  SELECT * INTO v_old
  FROM public.seguranca_chaves_api
  WHERE id=p_key_id AND deleted_at IS NULL AND ativa
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'api_key_not_active'; END IF;

  v_secret:='ce_'||
    CASE WHEN v_old.tipo_chave='producao' THEN 'live_' ELSE 'test_' END||
    encode(gen_random_bytes(32),'hex');
  v_prefix:=left(v_secret,24);
  v_hash:=encode(digest(v_secret,'sha256'),'hex');

  INSERT INTO public.seguranca_chaves_api(
    empresa_id,profile_id,nome,descricao,chave_prefixo,chave_hash,tipo_chave,
    escopos,permissoes,enderecos_ip_permitidos,enderecos_ip_bloqueados,
    data_criacao,data_expiracao,data_ultima_rotacao,taxa_limite_por_minuto,
    taxa_limite_por_dia,criado_por,ativa,metadata
  ) VALUES (
    v_old.empresa_id,auth.uid(),v_old.nome,v_old.descricao,v_prefix,v_hash,
    v_old.tipo_chave,v_old.escopos,v_old.permissoes,
    v_old.enderecos_ip_permitidos,v_old.enderecos_ip_bloqueados,
    now(),v_old.data_expiracao,now(),v_old.taxa_limite_por_minuto,
    v_old.taxa_limite_por_dia,auth.uid(),true,
    coalesce(v_old.metadata,'{}'::jsonb)||
      jsonb_build_object('rotated_from',v_old.id,'shown_once',true)
  )
  RETURNING id INTO v_id;

  UPDATE public.seguranca_chaves_api
  SET ativa=false,
      revogada_em=now(),
      revogada_por=auth.uid(),
      motivo_revogacao='Rotacionada',
      data_ultima_rotacao=now(),
      updated_at=now()
  WHERE id=v_old.id;

  INSERT INTO public.seguranca_audit_log(
    empresa_id,profile_id,acao,modulo,entidade,entidade_id,descricao,detalhes
  ) VALUES (
    v_old.empresa_id,auth.uid(),'update','developers','api_key',v_id,
    'Chave de API rotacionada',
    jsonb_build_object('old_key_id',v_old.id,'new_prefix',v_prefix)
  );

  RETURN jsonb_build_object(
    'id',v_id,
    'secret',v_secret,
    'prefix',v_prefix,
    'environment',v_old.tipo_chave,
    'scopes',v_old.escopos,
    'old_key_revoked',true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_dev_api_key_rotate(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_dev_api_key_rotate(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_api_key_validate(
  p_secret text,
  p_required_scope text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_key public.seguranca_chaves_api%ROWTYPE;
BEGIN
  IF trim(coalesce(p_secret,''))='' OR trim(coalesce(p_required_scope,''))='' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_key
  FROM public.seguranca_chaves_api
  WHERE chave_hash=encode(digest(p_secret,'sha256'),'hex')
    AND ativa
    AND deleted_at IS NULL
    AND (data_expiracao IS NULL OR data_expiracao>now())
  FOR UPDATE;

  IF NOT FOUND OR NOT (p_required_scope=ANY(v_key.escopos)) THEN
    RETURN NULL;
  END IF;

  UPDATE public.seguranca_chaves_api
  SET data_ultimo_uso=now(),
      total_requisicoes=coalesce(total_requisicoes,0)+1,
      total_requisicoes_sucesso=coalesce(total_requisicoes_sucesso,0)+1,
      updated_at=now()
  WHERE id=v_key.id;

  RETURN jsonb_build_object(
    'key_id',v_key.id,
    'empresa_id',v_key.empresa_id,
    'environment',v_key.tipo_chave,
    'scopes',v_key.escopos
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_api_key_validate(text,text)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_api_key_validate(text,text)
TO service_role;

-- =========================================================
-- WEBHOOKS
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_dev_webhook_create(
  p_empresa_id uuid,
  p_nome text,
  p_url text,
  p_eventos text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_secret text;
  v_prefix text;
  v_id uuid;
  v_events text[];
  v_allowed constant text[]:=ARRAY[
    'pedido.*','transacao.*','estorno.*','saque.*','comissao.*',
    'order.created','payment.pending','payment.confirmed','payment.failed',
    'refund.completed','withdrawal.paid','affiliate.commission.approved'
  ]::text[];
  v_url text:=trim(coalesce(p_url,''));
BEGIN
  IF NOT public.fn_is_admin_global() THEN
    RAISE EXCEPTION 'platform_admin_required';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.empresas
    WHERE id=p_empresa_id AND deleted_at IS NULL
  ) THEN RAISE EXCEPTION 'company_not_found'; END IF;
  IF trim(coalesce(p_nome,''))='' THEN RAISE EXCEPTION 'webhook_name_required'; END IF;

  IF v_url !~* '^https://[^[:space:]]+$'
     OR lower(v_url) ~ 'https://(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|169\.254\.|\[?::1\]?|[^/]*\.local([/:]|$))'
     OR lower(v_url) ~ 'https://172\.(1[6-9]|2[0-9]|3[01])\.' THEN
    RAISE EXCEPTION 'webhook_url_not_allowed';
  END IF;

  SELECT array_agg(DISTINCT event_name ORDER BY event_name)
  INTO v_events
  FROM unnest(coalesce(p_eventos,ARRAY[]::text[])) event_name;

  IF coalesce(cardinality(v_events),0)=0 OR NOT (v_events <@ v_allowed) THEN
    RAISE EXCEPTION 'webhook_events_invalid';
  END IF;

  v_secret:='whsec_'||encode(gen_random_bytes(32),'hex');
  v_prefix:=left(v_secret,18);

  INSERT INTO public.seguranca_webhooks(
    empresa_id,profile_id,nome,url_endpoint,metodo_http,eventos_ouvidos,
    segredo_assinatura,segredo_prefixo,algoritmo_assinatura,ativo
  ) VALUES (
    p_empresa_id,auth.uid(),trim(p_nome),v_url,'POST',v_events,
    v_secret,v_prefix,'sha256',true
  )
  RETURNING id INTO v_id;

  INSERT INTO public.seguranca_audit_log(
    empresa_id,profile_id,acao,modulo,entidade,entidade_id,descricao,detalhes
  ) VALUES (
    p_empresa_id,auth.uid(),'create','developers','webhook',v_id,
    'Endpoint de webhook criado',
    jsonb_build_object('url',v_url,'events',v_events,'secret_prefix',v_prefix)
  );

  RETURN jsonb_build_object(
    'id',v_id,
    'signing_secret',v_secret,
    'secret_prefix',v_prefix,
    'url',v_url,
    'events',v_events
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_dev_webhook_create(uuid,text,text,text[])
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_dev_webhook_create(uuid,text,text,text[])
TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_dev_webhooks_list()
RETURNS TABLE(
  id uuid,
  empresa_id uuid,
  empresa_nome text,
  nome text,
  url_endpoint text,
  eventos_ouvidos text[],
  segredo_prefixo text,
  ativo boolean,
  data_ultimo_disparo timestamptz,
  total_disparos bigint,
  total_sucessos bigint,
  total_falhas bigint,
  ultima_resposta_status integer,
  created_at timestamptz,
  revogado_em timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  IF NOT public.fn_is_admin_global() THEN
    RAISE EXCEPTION 'platform_admin_required';
  END IF;

  RETURN QUERY
  SELECT
    w.id,w.empresa_id,
    coalesce(e.nome_fantasia,e.razao_social,'Empresa')::text,
    w.nome::text,w.url_endpoint,
    w.eventos_ouvidos,w.segredo_prefixo::text,w.ativo,
    w.data_ultimo_disparo,
    coalesce(w.total_disparos,0)::bigint,
    coalesce(w.total_sucessos,0)::bigint,
    coalesce(w.total_falhas,0)::bigint,
    w.ultima_resposta_status,w.created_at,w.revogado_em
  FROM public.seguranca_webhooks w
  JOIN public.empresas e ON e.id=w.empresa_id
  WHERE w.deleted_at IS NULL
  ORDER BY w.created_at DESC,w.id DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_dev_webhooks_list() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_dev_webhooks_list() TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_dev_webhook_set_active(
  p_webhook_id uuid,
  p_active boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v_company uuid;
BEGIN
  IF NOT public.fn_is_admin_global() THEN
    RAISE EXCEPTION 'platform_admin_required';
  END IF;

  UPDATE public.seguranca_webhooks
  SET ativo=p_active,
      updated_at=now()
  WHERE id=p_webhook_id
    AND deleted_at IS NULL
    AND revogado_em IS NULL
  RETURNING empresa_id INTO v_company;

  IF NOT FOUND THEN RETURN false; END IF;

  INSERT INTO public.seguranca_audit_log(
    empresa_id,profile_id,acao,modulo,entidade,entidade_id,descricao,detalhes
  ) VALUES (
    v_company,auth.uid(),'update','developers','webhook',p_webhook_id,
    CASE WHEN p_active THEN 'Webhook reativado' ELSE 'Webhook pausado' END,
    jsonb_build_object('active',p_active)
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_dev_webhook_set_active(uuid,boolean)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_dev_webhook_set_active(uuid,boolean)
TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_dev_webhook_revoke(p_webhook_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v_company uuid;
BEGIN
  IF NOT public.fn_is_admin_global() THEN
    RAISE EXCEPTION 'platform_admin_required';
  END IF;

  UPDATE public.seguranca_webhooks
  SET ativo=false,
      revogado_em=now(),
      revogado_por=auth.uid(),
      updated_at=now()
  WHERE id=p_webhook_id
    AND deleted_at IS NULL
    AND revogado_em IS NULL
  RETURNING empresa_id INTO v_company;

  IF NOT FOUND THEN RETURN false; END IF;

  INSERT INTO public.seguranca_audit_log(
    empresa_id,profile_id,acao,modulo,entidade,entidade_id,descricao
  ) VALUES (
    v_company,auth.uid(),'delete','developers','webhook',p_webhook_id,
    'Webhook revogado'
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_dev_webhook_revoke(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_dev_webhook_revoke(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_dev_webhook_deliveries(
  p_webhook_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  webhook_id uuid,
  webhook_nome text,
  endpoint_url text,
  evento text,
  status_resposta integer,
  tempo_resposta_ms integer,
  tentativa_numero integer,
  max_tentativas integer,
  sucesso boolean,
  mensagem_erro text,
  idempotency_key text,
  created_at timestamptz,
  total_registros bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  IF NOT public.fn_is_admin_global() THEN
    RAISE EXCEPTION 'platform_admin_required';
  END IF;

  RETURN QUERY
  SELECT
    l.id,l.webhook_id,w.nome::text,w.url_endpoint,l.evento::text,
    l.status_resposta,l.tempo_resposta_ms,l.tentativa_numero,l.max_tentativas,
    l.sucesso,l.mensagem_erro::text,l.idempotency_key::text,l.created_at,
    count(*) OVER()
  FROM public.seguranca_webhooks_log l
  JOIN public.seguranca_webhooks w ON w.id=l.webhook_id
  WHERE (p_webhook_id IS NULL OR l.webhook_id=p_webhook_id)
  ORDER BY l.created_at DESC,l.id DESC
  LIMIT greatest(1,least(coalesce(p_limit,100),200))
  OFFSET greatest(coalesce(p_offset,0),0);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_dev_webhook_deliveries(uuid,integer,integer)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_dev_webhook_deliveries(uuid,integer,integer)
TO authenticated;

-- =========================================================
-- AUDIT LOGS — sanitized developer view
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_dev_audit_logs(
  p_search text DEFAULT NULL,
  p_result text DEFAULT NULL,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  actor text,
  action text,
  target text,
  module text,
  ip_address text,
  result text,
  status_resposta integer,
  risco_nivel text,
  created_at timestamptz,
  total_registros bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  IF NOT public.fn_is_admin_global() THEN
    RAISE EXCEPTION 'platform_admin_required';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      a.id,
      coalesce(p.nome_completo,'Sistema')::text AS actor,
      a.acao::text AS action,
      coalesce(a.entidade,'')||
        CASE
          WHEN a.entidade_id IS NOT NULL THEN ' · '||a.entidade_id::text
          ELSE ''
        END AS target,
      coalesce(a.modulo,'sistema')::text AS module,
      a.ip_address::text,
      CASE
        WHEN coalesce(a.status_resposta,0)>=400
          OR a.acao IN (
            'login_falha'::public.tipo_audit_log,
            'acesso_negado'::public.tipo_audit_log
          )
          OR lower(coalesce(a.detalhes->>'success','true'))='false'
        THEN 'falha'
        ELSE 'sucesso'
      END::text AS result,
      a.status_resposta,
      a.risco_nivel::text,
      a.created_at
    FROM public.seguranca_audit_log a
    LEFT JOIN public.profiles p ON p.id=a.profile_id
  )
  SELECT
    b.id,b.actor,b.action,b.target,b.module,b.ip_address,b.result,
    b.status_resposta,b.risco_nivel,b.created_at,count(*) OVER()
  FROM base b
  WHERE (
    coalesce(trim(p_search),'')=''
    OR b.actor ILIKE '%'||trim(p_search)||'%'
    OR b.action ILIKE '%'||trim(p_search)||'%'
    OR b.target ILIKE '%'||trim(p_search)||'%'
    OR b.module ILIKE '%'||trim(p_search)||'%'
  )
    AND (
      coalesce(trim(p_result),'')=''
      OR b.result=p_result
    )
  ORDER BY b.created_at DESC,b.id DESC
  LIMIT greatest(1,least(coalesce(p_limit,100),200))
  OFFSET greatest(coalesce(p_offset,0),0);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_dev_audit_logs(text,text,integer,integer)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_dev_audit_logs(text,text,integer,integer)
TO authenticated;
