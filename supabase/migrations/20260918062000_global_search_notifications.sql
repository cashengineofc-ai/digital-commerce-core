-- Cash Engine PRO — pesquisa global real + notificações in-app reais.
-- Busca respeita tenant e permissões; notificações são idempotentes por chave de evento.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.fn_search_normalize(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT lower(public.unaccent('public.unaccent',coalesce(p_text,'')));
$$;

CREATE INDEX IF NOT EXISTS idx_produtos_search_norm
ON public.produtos USING gin (public.fn_search_normalize(nome) gin_trgm_ops)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pedidos_search_numero_norm
ON public.pedidos USING gin (public.fn_search_normalize(numero) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_pedidos_search_buyer_norm
ON public.pedidos USING gin (public.fn_search_normalize(coalesce(comprador_nome,'')||' '||coalesce(comprador_email,'')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_checkouts_search_norm
ON public.checkouts USING gin (public.fn_search_normalize(nome) gin_trgm_ops)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_links_pagamento_search_norm
ON public.links_pagamento USING gin (public.fn_search_normalize(coalesce(titulo,'')||' '||coalesce(slug,'')) gin_trgm_ops)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ajuda_artigos_search_norm
ON public.ajuda_artigos USING gin (
  public.fn_search_normalize(
    titulo||' '||coalesce(resumo,'')||' '||coalesce(array_to_string(palavras_chave,' '),'')
  ) gin_trgm_ops
)
WHERE deleted_at IS NULL AND status='publicado';

CREATE INDEX IF NOT EXISTS idx_lancamentos_search_norm
ON public.lancamentos_contabeis USING gin (
  public.fn_search_normalize(coalesce(descricao,'')||' '||coalesce(documento_referencia,'')||' '||coalesce(conta_contabil,''))
  gin_trgm_ops
);

CREATE OR REPLACE FUNCTION public.fn_pesquisa_global(
  p_query text,
  p_limit integer DEFAULT 6
)
RETURNS TABLE(
  grupo text,
  id uuid,
  titulo text,
  subtitulo text,
  url text,
  relevancia numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_q text:=public.fn_search_normalize(trim(coalesce(p_query,'')));
  v_limit integer:=greatest(1,least(coalesce(p_limit,6),20));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF length(v_q)<2 THEN RETURN; END IF;
  IF v_empresa IS NULL AND NOT public.fn_is_admin_global() THEN
    RAISE EXCEPTION 'company_context_required';
  END IF;

  RETURN QUERY
  WITH raw AS (
    SELECT
      'produtos'::text AS grupo,
      p.id,
      p.nome::text AS titulo,
      coalesce(p.status::text,'')||' · '||to_char(p.preco,'FM999G999G990D00') AS subtitulo,
      ('/app/produtos?produto='||p.id::text)::text AS url,
      similarity(public.fn_search_normalize(p.nome),v_q)::numeric AS score
    FROM public.produtos p
    WHERE p.deleted_at IS NULL
      AND p.empresa_id=v_empresa
      AND public.fn_tem_permissao('produtos','produtos','read'::public.tipo_operacao)
      AND public.fn_search_normalize(p.nome) % v_q

    UNION ALL

    SELECT
      'vendas'::text,
      pd.id,
      pd.numero::text,
      (
        coalesce(pd.comprador_nome,'Cliente')||' · '||
        to_char(pd.valor_total,'FM999G999G990D00')||' · '||
        pd.status_pagamento
      )::text,
      ('/app/vendas?pedido='||pd.id::text)::text,
      greatest(
        similarity(public.fn_search_normalize(pd.numero),v_q),
        similarity(public.fn_search_normalize(coalesce(pd.comprador_nome,'')||' '||coalesce(pd.comprador_email,'')),v_q)
      )::numeric
    FROM public.pedidos pd
    WHERE pd.empresa_id=v_empresa
      AND public.fn_tem_permissao('vendas','vendas','read'::public.tipo_operacao)
      AND (
        public.fn_search_normalize(pd.numero) % v_q
        OR public.fn_search_normalize(coalesce(pd.comprador_nome,'')||' '||coalesce(pd.comprador_email,'')) % v_q
      )

    UNION ALL

    SELECT
      'checkouts'::text,
      c.id,
      c.nome::text,
      coalesce(c.status::text,'')::text,
      ('/app/checkouts?checkout='||c.id::text)::text,
      similarity(public.fn_search_normalize(c.nome),v_q)::numeric
    FROM public.checkouts c
    WHERE c.deleted_at IS NULL
      AND c.empresa_id=v_empresa
      AND public.fn_tem_permissao('produtos','checkouts','read'::public.tipo_operacao)
      AND public.fn_search_normalize(c.nome) % v_q

    UNION ALL

    SELECT
      'links_pagamento'::text,
      lp.id,
      coalesce(lp.titulo,lp.slug,'Link de pagamento')::text,
      coalesce(lp.status::text,'')::text,
      ('/app/links-de-pagamento?link='||lp.id::text)::text,
      similarity(public.fn_search_normalize(coalesce(lp.titulo,'')||' '||coalesce(lp.slug,'')),v_q)::numeric
    FROM public.links_pagamento lp
    WHERE lp.deleted_at IS NULL
      AND lp.empresa_id=v_empresa
      AND public.fn_tem_permissao('vendas','links','read'::public.tipo_operacao)
      AND public.fn_search_normalize(coalesce(lp.titulo,'')||' '||coalesce(lp.slug,'')) % v_q

    UNION ALL

    SELECT
      'afiliados'::text,
      a.id,
      coalesce(pf.nome_completo,a.codigo_afiliado)::text,
      (a.codigo_afiliado||' · '||a.status::text)::text,
      ('/app/afiliados?afiliado='||a.id::text)::text,
      greatest(
        similarity(public.fn_search_normalize(coalesce(pf.nome_completo,'')),v_q),
        similarity(public.fn_search_normalize(a.codigo_afiliado),v_q)
      )::numeric
    FROM public.afiliados a
    LEFT JOIN public.profiles pf ON pf.id=a.profile_id
    WHERE a.deleted_at IS NULL
      AND a.empresa_id=v_empresa
      AND public.fn_tem_permissao('afiliados','afiliados','read'::public.tipo_operacao)
      AND (
        public.fn_search_normalize(coalesce(pf.nome_completo,'')) % v_q
        OR public.fn_search_normalize(a.codigo_afiliado) % v_q
      )

    UNION ALL

    SELECT
      'financeiro'::text,
      l.id,
      coalesce(l.descricao,l.conta_contabil)::text,
      (
        l.conta_contabil||' · '||
        CASE WHEN l.tipo_lancamento='C' THEN '+' ELSE '-' END||
        to_char(l.valor,'FM999G999G990D00')
      )::text,
      ('/app/extrato?lancamento='||l.id::text)::text,
      similarity(
        public.fn_search_normalize(coalesce(l.descricao,'')||' '||coalesce(l.documento_referencia,'')||' '||coalesce(l.conta_contabil,'')),
        v_q
      )::numeric
    FROM public.lancamentos_contabeis l
    WHERE l.empresa_id=v_empresa
      AND public.fn_tem_permissao('financeiro','extrato','read'::public.tipo_operacao)
      AND public.fn_search_normalize(coalesce(l.descricao,'')||' '||coalesce(l.documento_referencia,'')||' '||coalesce(l.conta_contabil,'')) % v_q

    UNION ALL

    SELECT
      'ajuda'::text,
      aa.id,
      aa.titulo::text,
      coalesce(aa.resumo,'Artigo de ajuda')::text,
      ('/app/ajuda?artigo='||aa.id::text)::text,
      similarity(
        public.fn_search_normalize(aa.titulo||' '||coalesce(aa.resumo,'')),
        v_q
      )::numeric
    FROM public.ajuda_artigos aa
    WHERE aa.deleted_at IS NULL
      AND aa.status='publicado'
      AND (
        aa.publico
        OR aa.empresa_id IS NULL
        OR aa.empresa_id=v_empresa
      )
      AND public.fn_search_normalize(aa.titulo||' '||coalesce(aa.resumo,'')) % v_q
  ),
  ranked AS (
    SELECT raw.*,
      row_number() OVER(PARTITION BY grupo ORDER BY score DESC,id) AS rn
    FROM raw
  )
  SELECT grupo,id,titulo,subtitulo,url,score
  FROM ranked
  WHERE rn<=v_limit
  ORDER BY grupo,score DESC,titulo;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_pesquisa_global(text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_pesquisa_global(text,integer) TO authenticated;

-- =========================================================
-- NOTIFICAÇÕES
-- =========================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_notificacoes_evento_unico
ON public.notificacoes(agrupamento_chave)
WHERE agrupamento_chave IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.notificacoes_push_inscricoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  endpoint_hash text NOT NULL,
  endpoint_ciphertext text,
  p256dh_ciphertext text,
  auth_ciphertext text,
  user_agent text,
  ativo boolean NOT NULL DEFAULT true,
  erro_ultimo text,
  erro_em timestamptz,
  ultimo_sucesso_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id,device_id),
  UNIQUE(endpoint_hash)
);

CREATE INDEX IF NOT EXISTS idx_push_profile_active
ON public.notificacoes_push_inscricoes(profile_id,ativo);

ALTER TABLE public.notificacoes_push_inscricoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_self_only ON public.notificacoes_push_inscricoes;
CREATE POLICY push_self_only
ON public.notificacoes_push_inscricoes
FOR SELECT TO authenticated
USING(profile_id=auth.uid());

CREATE TABLE IF NOT EXISTS public.notificacoes_entregas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notificacao_id uuid NOT NULL REFERENCES public.notificacoes(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  canal text NOT NULL CHECK(canal IN ('email','push')),
  tentativa integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pendente'
    CHECK(status IN ('pendente','enviado','falhou','descartado')),
  provedor_id text,
  erro text,
  proxima_tentativa_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(notificacao_id,canal,tentativa)
);

CREATE INDEX IF NOT EXISTS idx_notif_delivery_retry
ON public.notificacoes_entregas(status,proxima_tentativa_em)
WHERE status IN ('pendente','falhou');

ALTER TABLE public.notificacoes_entregas ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.fn_notificacao_preferencia(
  p_profile_id uuid,
  p_tipo text,
  p_canal text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
  SELECT CASE p_canal
    WHEN 'inapp' THEN coalesce((
      SELECT receber_inapp FROM public.notificacoes_preferencias
      WHERE profile_id=p_profile_id
        AND afiliado_id IS NULL
        AND tipo_notificacao=p_tipo
    ),true)
    WHEN 'email' THEN coalesce((
      SELECT receber_email FROM public.notificacoes_preferencias
      WHERE profile_id=p_profile_id
        AND afiliado_id IS NULL
        AND tipo_notificacao=p_tipo
    ),false)
    WHEN 'push' THEN coalesce((
      SELECT receber_push FROM public.notificacoes_preferencias
      WHERE profile_id=p_profile_id
        AND afiliado_id IS NULL
        AND tipo_notificacao=p_tipo
    ),false)
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.fn_notificacao_criar(
  p_profile_id uuid,
  p_empresa_id uuid,
  p_tipo public.tipo_notificacao,
  p_titulo text,
  p_mensagem text,
  p_entidade_tipo text,
  p_entidade_id uuid,
  p_url text,
  p_event_key text,
  p_dados jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_profile_id IS NULL OR trim(coalesce(p_event_key,''))='' THEN RETURN NULL; END IF;
  IF NOT public.fn_notificacao_preferencia(p_profile_id,p_tipo::text,'inapp') THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notificacoes(
    empresa_id,profile_id,tipo,titulo,mensagem,resumo_curto,
    dados_relacionados,entidade_tipo,entidade_id,url_destino,
    canal_inapp,canal_email,canal_push,agrupamento_chave,
    criada_sistema
  ) VALUES (
    p_empresa_id,p_profile_id,p_tipo,left(p_titulo,255),p_mensagem,
    left(p_mensagem,160),coalesce(p_dados,'{}'::jsonb),
    p_entidade_tipo,p_entidade_id,p_url,true,
    public.fn_notificacao_preferencia(p_profile_id,p_tipo::text,'email'),
    public.fn_notificacao_preferencia(p_profile_id,p_tipo::text,'push'),
    p_event_key,true
  )
  ON CONFLICT(agrupamento_chave) WHERE agrupamento_chave IS NOT NULL AND deleted_at IS NULL
  DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NOT NULL THEN
    IF public.fn_notificacao_preferencia(p_profile_id,p_tipo::text,'email') THEN
      INSERT INTO public.notificacoes_entregas(notificacao_id,profile_id,canal)
      VALUES(v_id,p_profile_id,'email') ON CONFLICT DO NOTHING;
    END IF;
    IF public.fn_notificacao_preferencia(p_profile_id,p_tipo::text,'push') THEN
      INSERT INTO public.notificacoes_entregas(notificacao_id,profile_id,canal)
      VALUES(v_id,p_profile_id,'push') ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_notificacao_criar(
  uuid,uuid,public.tipo_notificacao,text,text,text,uuid,text,text,jsonb
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_notificacao_criar(
  uuid,uuid,public.tipo_notificacao,text,text,text,uuid,text,text,jsonb
) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_notificacoes_me(
  p_limit integer DEFAULT 30,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  tipo text,
  titulo text,
  mensagem text,
  url_destino text,
  lida boolean,
  created_at timestamptz,
  total_registros bigint,
  total_nao_lidas bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
  SELECT
    n.id,n.tipo::text,n.titulo::text,n.mensagem,
    n.url_destino,n.lida,n.created_at,
    count(*) OVER(),
    count(*) FILTER(WHERE NOT n.lida) OVER()
  FROM public.notificacoes n
  WHERE n.profile_id=auth.uid()
    AND n.deleted_at IS NULL
    AND NOT n.arquivada
    AND (n.expira_em IS NULL OR n.expira_em>now())
  ORDER BY n.fixada DESC,n.created_at DESC,n.id DESC
  LIMIT greatest(1,least(coalesce(p_limit,30),100))
  OFFSET greatest(coalesce(p_offset,0),0);
$$;

REVOKE ALL ON FUNCTION public.fn_notificacoes_me(integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_notificacoes_me(integer,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_notificacao_marcar_lida(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  UPDATE public.notificacoes
  SET lida=true,data_leitura=coalesce(data_leitura,now()),updated_at=now()
  WHERE id=p_id AND profile_id=auth.uid() AND deleted_at IS NULL;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_notificacao_marcar_lida(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_notificacao_marcar_lida(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_notificacoes_marcar_todas_lidas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v_count integer;
BEGIN
  UPDATE public.notificacoes
  SET lida=true,data_leitura=coalesce(data_leitura,now()),updated_at=now()
  WHERE profile_id=auth.uid() AND NOT lida AND deleted_at IS NULL;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_notificacoes_marcar_todas_lidas() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_notificacoes_marcar_todas_lidas() TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_notificacao_preferencias_me()
RETURNS TABLE(
  tipo text,
  receber_inapp boolean,
  receber_email boolean,
  receber_push boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
  WITH types AS (
    SELECT unnest(enum_range(NULL::public.tipo_notificacao))::text AS tipo
  )
  SELECT
    t.tipo,
    coalesce(p.receber_inapp,true),
    coalesce(p.receber_email,false),
    coalesce(p.receber_push,false)
  FROM types t
  LEFT JOIN public.notificacoes_preferencias p
    ON p.profile_id=auth.uid()
   AND p.afiliado_id IS NULL
   AND p.tipo_notificacao=t.tipo
  ORDER BY t.tipo;
$$;

REVOKE ALL ON FUNCTION public.fn_notificacao_preferencias_me() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_notificacao_preferencias_me() TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_notificacao_preferencia_salvar(
  p_tipo text,
  p_inapp boolean,
  p_email boolean,
  p_push boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v_email_enabled boolean:=false; v_push_enabled boolean:=false;
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM unnest(enum_range(NULL::public.tipo_notificacao)) x
    WHERE x::text=p_tipo
  ) THEN RAISE EXCEPTION 'notification_type_invalid'; END IF;

  SELECT coalesce((valor->>'enabled')::boolean,false)
  INTO v_email_enabled
  FROM public.admin_global_config
  WHERE chave='notifications.email';

  SELECT coalesce((valor->>'enabled')::boolean,false)
  INTO v_push_enabled
  FROM public.admin_global_config
  WHERE chave='notifications.push';

  IF p_email AND NOT v_email_enabled THEN RAISE EXCEPTION 'email_channel_not_configured'; END IF;
  IF p_push AND NOT v_push_enabled THEN RAISE EXCEPTION 'push_channel_not_configured'; END IF;

  INSERT INTO public.notificacoes_preferencias(
    profile_id,afiliado_id,tipo_notificacao,receber_inapp,receber_email,receber_push
  ) VALUES (
    auth.uid(),NULL,p_tipo,p_inapp,p_email,p_push
  )
  ON CONFLICT(profile_id,afiliado_id,tipo_notificacao)
  DO UPDATE SET
    receber_inapp=excluded.receber_inapp,
    receber_email=excluded.receber_email,
    receber_push=excluded.receber_push,
    updated_at=now();

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_notificacao_preferencia_salvar(text,boolean,boolean,boolean)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_notificacao_preferencia_salvar(text,boolean,boolean,boolean)
TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_notificacao_canais_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v_email boolean:=false; v_push boolean:=false;
BEGIN
  SELECT coalesce((valor->>'enabled')::boolean,false)
  INTO v_email FROM public.admin_global_config WHERE chave='notifications.email';
  SELECT coalesce((valor->>'enabled')::boolean,false)
  INTO v_push FROM public.admin_global_config WHERE chave='notifications.push';
  RETURN jsonb_build_object('inapp',true,'email',v_email,'push',v_push);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_notificacao_canais_status() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_notificacao_canais_status() TO authenticated;
