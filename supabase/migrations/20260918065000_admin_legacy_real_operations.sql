-- Cash Engine PRO — operações reais das páginas legadas do Admin Global.
-- Empresas, usuários, banimentos, moderação, configurações e comunicados.

CREATE OR REPLACE FUNCTION public.fn_admin_empresas_list(
  p_query text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_plano text DEFAULT NULL,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  nome text,
  razao_social text,
  cnpj text,
  email text,
  plano text,
  status text,
  cidade text,
  estado text,
  owner_nome text,
  owner_email text,
  usuarios bigint,
  pedidos_confirmados bigint,
  volume_confirmado numeric,
  devolucoes numeric,
  saques_pendentes numeric,
  risco_score integer,
  risco_nivel text,
  vip boolean,
  created_at timestamptz,
  updated_at timestamptz,
  total_registros bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public
AS $$
BEGIN
  IF NOT public.fn_is_admin_global() THEN RAISE EXCEPTION 'platform_admin_required'; END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.nome_fantasia::text,
    e.razao_social::text,
    e.cnpj::text,
    e.email::text,
    e.plano::text,
    e.status::text,
    e.cidade::text,
    e.estado::text,
    owner.nome_completo::text,
    owner.email::text,
    (SELECT count(*) FROM public.profiles p WHERE p.empresa_id=e.id AND p.deleted_at IS NULL),
    (SELECT count(*) FROM public.pedidos pd WHERE pd.empresa_id=e.id AND pd.status_pagamento IN ('confirmado','reembolsado_parcial','reembolsado_total')),
    coalesce((SELECT sum(pd.valor_total) FROM public.pedidos pd WHERE pd.empresa_id=e.id AND pd.status_pagamento IN ('confirmado','reembolsado_parcial','reembolsado_total')),0),
    coalesce((SELECT sum(pd.valor_devolvido) FROM public.pedidos pd WHERE pd.empresa_id=e.id AND pd.status_pagamento IN ('confirmado','reembolsado_parcial','reembolsado_total')),0),
    coalesce((SELECT sum(s.valor_solicitado) FROM public.saques s WHERE s.empresa_id=e.id AND s.status IN ('solicitado','em_analise','aprovado','processando','enviado')),0),
    coalesce(g.risco_score,0),
    coalesce(g.risco_nivel,'nao_avaliado')::text,
    coalesce(g.vip,false),
    e.created_at,e.updated_at,
    count(*) OVER()
  FROM public.empresas e
  LEFT JOIN public.admin_empresas_gestao g ON g.empresa_id=e.id
  LEFT JOIN LATERAL (
    SELECT p.nome_completo,p.email
    FROM public.profiles p
    WHERE p.empresa_id=e.id AND p.is_owner AND p.deleted_at IS NULL
    ORDER BY p.created_at
    LIMIT 1
  ) owner ON true
  WHERE e.deleted_at IS NULL
    AND (coalesce(trim(p_status),'')='' OR e.status::text=p_status)
    AND (coalesce(trim(p_plano),'')='' OR e.plano=p_plano)
    AND (
      coalesce(trim(p_query),'')=''
      OR e.nome_fantasia ILIKE '%'||trim(p_query)||'%'
      OR coalesce(e.razao_social,'') ILIKE '%'||trim(p_query)||'%'
      OR coalesce(e.cnpj,'') ILIKE '%'||trim(p_query)||'%'
      OR coalesce(e.email,'') ILIKE '%'||trim(p_query)||'%'
      OR coalesce(owner.email,'') ILIKE '%'||trim(p_query)||'%'
    )
  ORDER BY e.created_at DESC,e.id DESC
  LIMIT greatest(1,least(coalesce(p_limit,100),200))
  OFFSET greatest(coalesce(p_offset,0),0);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_empresas_list(text,text,text,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_empresas_list(text,text,text,integer,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_empresa_set(
  p_empresa_id uuid,
  p_status text DEFAULT NULL,
  p_plano text DEFAULT NULL,
  p_vip boolean DEFAULT NULL,
  p_risco_score integer DEFAULT NULL,
  p_risco_nivel text DEFAULT NULL,
  p_observacao text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_before jsonb; v_after jsonb;
BEGIN
  IF NOT public.fn_is_admin_global() THEN RAISE EXCEPTION 'platform_admin_required'; END IF;

  SELECT to_jsonb(e) INTO v_before FROM public.empresas e WHERE e.id=p_empresa_id AND e.deleted_at IS NULL FOR UPDATE;
  IF v_before IS NULL THEN RAISE EXCEPTION 'company_not_found'; END IF;

  IF p_status IS NOT NULL AND p_status NOT IN ('ativo','inativo','suspenso','bloqueado') THEN
    RAISE EXCEPTION 'company_status_invalid';
  END IF;
  IF p_risco_score IS NOT NULL AND (p_risco_score<0 OR p_risco_score>100) THEN
    RAISE EXCEPTION 'risk_score_invalid';
  END IF;

  UPDATE public.empresas
  SET status=coalesce(p_status::public.status_ativo,status),
      plano=coalesce(nullif(trim(p_plano),''),plano),
      updated_at=now()
  WHERE id=p_empresa_id;

  INSERT INTO public.admin_empresas_gestao(
    empresa_id,risco_score,risco_nivel,vip,observacoes_admin,
    data_ultima_revisao,revisado_por
  ) VALUES(
    p_empresa_id,coalesce(p_risco_score,50),coalesce(nullif(trim(p_risco_nivel),''),'medio'),
    coalesce(p_vip,false),nullif(trim(coalesce(p_observacao,'')),''),
    now(),auth.uid()
  )
  ON CONFLICT(empresa_id) DO UPDATE SET
    risco_score=coalesce(p_risco_score,admin_empresas_gestao.risco_score),
    risco_nivel=coalesce(nullif(trim(p_risco_nivel),''),admin_empresas_gestao.risco_nivel),
    vip=coalesce(p_vip,admin_empresas_gestao.vip),
    observacoes_admin=coalesce(nullif(trim(coalesce(p_observacao,'')),''),admin_empresas_gestao.observacoes_admin),
    data_ultima_revisao=now(),
    revisado_por=auth.uid(),
    updated_at=now();

  SELECT jsonb_build_object(
    'empresa',to_jsonb(e),
    'gestao',to_jsonb(g)
  ) INTO v_after
  FROM public.empresas e
  LEFT JOIN public.admin_empresas_gestao g ON g.empresa_id=e.id
  WHERE e.id=p_empresa_id;

  INSERT INTO public.seguranca_audit_log(
    empresa_id,profile_id,acao,modulo,entidade,entidade_id,descricao,dados_antes,dados_depois
  ) VALUES(
    p_empresa_id,auth.uid(),'update','admin_global','empresa',p_empresa_id,
    'Configuração administrativa da empresa atualizada',v_before,v_after
  );
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_empresa_set(uuid,text,text,boolean,integer,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_empresa_set(uuid,text,text,boolean,integer,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_usuarios_list(
  p_query text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_admin_global boolean DEFAULT NULL,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,nome text,email text,empresa_id uuid,empresa_nome text,cargo text,
  status text,is_owner boolean,is_admin_global boolean,ultimo_login timestamptz,
  created_at timestamptz,total_registros bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public
AS $$
BEGIN
  IF NOT public.fn_is_admin_global() THEN RAISE EXCEPTION 'platform_admin_required'; END IF;
  RETURN QUERY
  SELECT
    p.id,p.nome_completo::text,p.email::text,p.empresa_id,
    coalesce(e.nome_fantasia,e.razao_social,'Sem empresa')::text,
    coalesce(p.cargo,'')::text,p.status::text,p.is_owner,p.is_admin_global,
    p.ultimo_login,p.created_at,count(*) OVER()
  FROM public.profiles p
  LEFT JOIN public.empresas e ON e.id=p.empresa_id
  WHERE p.deleted_at IS NULL
    AND (coalesce(trim(p_status),'')='' OR p.status::text=p_status)
    AND (p_admin_global IS NULL OR p.is_admin_global=p_admin_global)
    AND (
      coalesce(trim(p_query),'')=''
      OR p.nome_completo ILIKE '%'||trim(p_query)||'%'
      OR p.email ILIKE '%'||trim(p_query)||'%'
      OR coalesce(e.nome_fantasia,'') ILIKE '%'||trim(p_query)||'%'
    )
  ORDER BY p.created_at DESC,p.id DESC
  LIMIT greatest(1,least(coalesce(p_limit,100),200))
  OFFSET greatest(coalesce(p_offset,0),0);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_usuarios_list(text,text,boolean,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_usuarios_list(text,text,boolean,integer,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_usuario_status_set(
  p_profile_id uuid,p_status text,p_reason text
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_p public.profiles%ROWTYPE;
BEGIN
  IF NOT public.fn_is_admin_global() THEN RAISE EXCEPTION 'platform_admin_required'; END IF;
  IF p_profile_id=auth.uid() THEN RAISE EXCEPTION 'self_status_change_forbidden'; END IF;
  IF p_status NOT IN ('ativo','inativo','suspenso','bloqueado') THEN RAISE EXCEPTION 'user_status_invalid'; END IF;
  IF trim(coalesce(p_reason,''))='' THEN RAISE EXCEPTION 'reason_required'; END IF;

  SELECT * INTO v_p FROM public.profiles WHERE id=p_profile_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile_not_found'; END IF;

  UPDATE public.profiles SET status=p_status::public.status_ativo,updated_at=now() WHERE id=p_profile_id;
  IF p_status<>'ativo' THEN
    UPDATE public.seguranca_sessoes
    SET status='revogada',data_logout=coalesce(data_logout,now())
    WHERE profile_id=p_profile_id AND status='ativa';
  END IF;

  INSERT INTO public.seguranca_audit_log(
    empresa_id,profile_id,acao,modulo,entidade,entidade_id,descricao,detalhes
  ) VALUES(
    v_p.empresa_id,auth.uid(),'update','admin_global','profile',p_profile_id,
    'Status de usuário alterado',
    jsonb_build_object('old_status',v_p.status::text,'new_status',p_status,'reason',trim(p_reason))
  );
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_usuario_status_set(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_usuario_status_set(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_banimentos_list(p_active boolean DEFAULT NULL)
RETURNS TABLE(
  id uuid,tipo text,identificador text,empresa_id uuid,empresa_nome text,
  profile_id uuid,profile_nome text,motivo text,detalhamento text,gravidade text,
  data_inicio timestamptz,data_fim timestamptz,permanente boolean,desfeito boolean,
  aplicado_por_nome text,created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public
AS $$
BEGIN
  IF NOT public.fn_is_admin_global() THEN RAISE EXCEPTION 'platform_admin_required'; END IF;
  RETURN QUERY
  SELECT b.id,b.tipo::text,b.identificador::text,b.empresa_id,
    coalesce(e.nome_fantasia,e.razao_social)::text,b.profile_id,p.nome_completo::text,
    b.motivo_principal::text,b.detalhamento,b.nivel_gravidade::text,
    b.data_inicio,b.data_fim,b.permanente,b.desfeito,a.nome_completo::text,b.created_at
  FROM public.admin_banimentos b
  LEFT JOIN public.empresas e ON e.id=b.empresa_id
  LEFT JOIN public.profiles p ON p.id=b.profile_id
  LEFT JOIN public.profiles a ON a.id=b.aplicado_por
  WHERE p_active IS NULL OR (NOT b.desfeito)=p_active
  ORDER BY b.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_banimentos_list(boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_banimentos_list(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_banir(
  p_tipo text,p_empresa_id uuid,p_profile_id uuid,p_identificador text,
  p_motivo text,p_detalhamento text DEFAULT NULL,p_gravidade text DEFAULT 'alto',
  p_permanente boolean DEFAULT true,p_data_fim timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_id uuid; v_identifier text;
BEGIN
  IF NOT public.fn_is_admin_global() THEN RAISE EXCEPTION 'platform_admin_required'; END IF;
  IF p_tipo NOT IN ('empresa','usuario','email','ip','dispositivo') THEN RAISE EXCEPTION 'ban_type_invalid'; END IF;
  IF p_profile_id=auth.uid() THEN RAISE EXCEPTION 'self_ban_forbidden'; END IF;
  IF trim(coalesce(p_motivo,''))='' THEN RAISE EXCEPTION 'reason_required'; END IF;

  v_identifier:=coalesce(
    nullif(trim(p_identificador),''),
    p_empresa_id::text,
    p_profile_id::text
  );
  IF v_identifier IS NULL THEN RAISE EXCEPTION 'ban_identifier_required'; END IF;

  INSERT INTO public.admin_banimentos(
    tipo,identificador,empresa_id,profile_id,motivo_principal,detalhamento,
    nivel_gravidade,data_fim,permanente,aplicado_por
  ) VALUES(
    p_tipo,v_identifier,p_empresa_id,p_profile_id,trim(p_motivo),
    nullif(trim(coalesce(p_detalhamento,'')),''),
    coalesce(nullif(trim(p_gravidade),''),'alto'),p_data_fim,p_permanente,auth.uid()
  )
  ON CONFLICT(tipo,identificador) DO UPDATE SET
    empresa_id=excluded.empresa_id,profile_id=excluded.profile_id,
    motivo_principal=excluded.motivo_principal,detalhamento=excluded.detalhamento,
    nivel_gravidade=excluded.nivel_gravidade,data_inicio=now(),data_fim=excluded.data_fim,
    permanente=excluded.permanente,aplicado_por=auth.uid(),
    desfeito=false,desfeito_por=NULL,data_desfeito=NULL,motivo_desfeito=NULL,updated_at=now()
  RETURNING id INTO v_id;

  IF p_empresa_id IS NOT NULL THEN
    UPDATE public.empresas SET status='bloqueado',updated_at=now() WHERE id=p_empresa_id;
  END IF;
  IF p_profile_id IS NOT NULL THEN
    UPDATE public.profiles SET status='bloqueado',updated_at=now() WHERE id=p_profile_id;
    UPDATE public.seguranca_sessoes SET status='revogada',data_logout=coalesce(data_logout,now())
    WHERE profile_id=p_profile_id AND status='ativa';
  END IF;

  INSERT INTO public.seguranca_audit_log(
    empresa_id,profile_id,acao,modulo,entidade,entidade_id,descricao,detalhes
  ) VALUES(
    p_empresa_id,auth.uid(),'update','admin_global','banimento',v_id,
    'Banimento administrativo aplicado',
    jsonb_build_object('tipo',p_tipo,'identificador',v_identifier,'motivo',trim(p_motivo))
  );
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_banir(text,uuid,uuid,text,text,text,text,boolean,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_banir(text,uuid,uuid,text,text,text,text,boolean,timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_banimento_revogar(p_id uuid,p_motivo text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_b public.admin_banimentos%ROWTYPE;
BEGIN
  IF NOT public.fn_is_admin_global() THEN RAISE EXCEPTION 'platform_admin_required'; END IF;
  IF trim(coalesce(p_motivo,''))='' THEN RAISE EXCEPTION 'reason_required'; END IF;
  SELECT * INTO v_b FROM public.admin_banimentos WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR v_b.desfeito THEN RETURN false; END IF;

  UPDATE public.admin_banimentos
  SET desfeito=true,desfeito_por=auth.uid(),data_desfeito=now(),
      motivo_desfeito=trim(p_motivo),updated_at=now()
  WHERE id=p_id;

  IF v_b.empresa_id IS NOT NULL THEN
    UPDATE public.empresas SET status='ativo',updated_at=now()
    WHERE id=v_b.empresa_id AND status='bloqueado';
  END IF;
  IF v_b.profile_id IS NOT NULL THEN
    UPDATE public.profiles SET status='ativo',updated_at=now()
    WHERE id=v_b.profile_id AND status='bloqueado';
  END IF;

  INSERT INTO public.seguranca_audit_log(
    empresa_id,profile_id,acao,modulo,entidade,entidade_id,descricao,detalhes
  ) VALUES(
    v_b.empresa_id,auth.uid(),'update','admin_global','banimento',p_id,
    'Banimento administrativo revogado',jsonb_build_object('reason',trim(p_motivo))
  );
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_banimento_revogar(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_banimento_revogar(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_moderacao_list(p_status text DEFAULT NULL)
RETURNS TABLE(
  id uuid,tipo_item text,motivo text,detalhe text,categoria_risco text,status text,
  empresa_id uuid,empresa_nome text,profile_id uuid,profile_nome text,
  produto_id uuid,produto_nome text,checkout_id uuid,checkout_nome text,
  sinalizacoes integer,decisao text,detalhe_decisao text,created_at timestamptz,updated_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public
AS $$
BEGIN
  IF NOT public.fn_is_admin_global() THEN RAISE EXCEPTION 'platform_admin_required'; END IF;
  RETURN QUERY
  SELECT m.id,m.tipo_item_reportado::text,m.motivo::text,m.detalhe_motivo,
    m.categoria_risco::text,m.status::text,m.empresa_reportada_id,
    coalesce(e.nome_fantasia,e.razao_social)::text,m.profile_reportado_id,p.nome_completo::text,
    m.produto_reportado_id,pr.nome::text,m.checkout_reportado_id,c.nome::text,
    m.sinalizacoes_count,m.decisao::text,m.detalhe_decisao,m.created_at,m.updated_at
  FROM public.admin_moderacao m
  LEFT JOIN public.empresas e ON e.id=m.empresa_reportada_id
  LEFT JOIN public.profiles p ON p.id=m.profile_reportado_id
  LEFT JOIN public.produtos pr ON pr.id=m.produto_reportado_id
  LEFT JOIN public.checkouts c ON c.id=m.checkout_reportado_id
  WHERE coalesce(trim(p_status),'')='' OR m.status=p_status
  ORDER BY
    CASE m.status WHEN 'pendente' THEN 1 WHEN 'em_analise' THEN 2 ELSE 9 END,
    m.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_moderacao_list(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_moderacao_list(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_moderacao_decidir(
  p_id uuid,p_status text,p_decisao text,p_detalhe text
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_m public.admin_moderacao%ROWTYPE;
BEGIN
  IF NOT public.fn_is_admin_global() THEN RAISE EXCEPTION 'platform_admin_required'; END IF;
  IF p_status NOT IN ('em_analise','resolvido','rejeitado','arquivado') THEN RAISE EXCEPTION 'moderation_status_invalid'; END IF;
  IF p_status IN ('resolvido','rejeitado','arquivado') AND trim(coalesce(p_decisao,''))='' THEN
    RAISE EXCEPTION 'decision_required';
  END IF;

  SELECT * INTO v_m FROM public.admin_moderacao WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'moderation_not_found'; END IF;

  UPDATE public.admin_moderacao
  SET status=p_status,
      atribuido_para=coalesce(atribuido_para,auth.uid()),
      atribuido_em=coalesce(atribuido_em,now()),
      analisado_em=CASE WHEN p_status IN ('resolvido','rejeitado','arquivado') THEN now() ELSE analisado_em END,
      analisado_por=CASE WHEN p_status IN ('resolvido','rejeitado','arquivado') THEN auth.uid() ELSE analisado_por END,
      decisao=coalesce(nullif(trim(p_decisao),''),decisao),
      detalhe_decisao=coalesce(nullif(trim(coalesce(p_detalhe,'')),''),detalhe_decisao),
      updated_at=now()
  WHERE id=p_id;

  INSERT INTO public.seguranca_audit_log(
    empresa_id,profile_id,acao,modulo,entidade,entidade_id,descricao,detalhes
  ) VALUES(
    v_m.empresa_reportada_id,auth.uid(),'update','admin_global','moderacao',p_id,
    'Caso de moderação atualizado',
    jsonb_build_object('status',p_status,'decisao',p_decisao,'detail',p_detalhe)
  );
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_moderacao_decidir(uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_moderacao_decidir(uuid,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_config_list()
RETURNS TABLE(
  id uuid,chave text,valor jsonb,tipo_valor text,descricao text,categoria text,
  modulo text,somente_leitura boolean,sensivel boolean,publico boolean,updated_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public
AS $$
BEGIN
  IF NOT public.fn_is_admin_global() THEN RAISE EXCEPTION 'platform_admin_required'; END IF;
  RETURN QUERY
  SELECT c.id,c.chave::text,
    CASE WHEN c.sensivel THEN '"[REDACTED]"'::jsonb ELSE c.valor END,
    c.tipo_valor::text,c.descricao,c.categoria::text,c.modulo::text,
    c.somente_leitura,c.sensivel,c.publico,c.updated_at
  FROM public.admin_global_config c
  ORDER BY c.categoria,c.chave;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_config_list() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_config_list() TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_config_set(p_key text,p_value jsonb)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_c public.admin_global_config%ROWTYPE;
BEGIN
  IF NOT public.fn_is_admin_global() THEN RAISE EXCEPTION 'platform_admin_required'; END IF;
  SELECT * INTO v_c FROM public.admin_global_config WHERE chave=p_key FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'config_not_found'; END IF;
  IF v_c.somente_leitura THEN RAISE EXCEPTION 'config_read_only'; END IF;
  IF v_c.sensivel THEN RAISE EXCEPTION 'sensitive_config_requires_server_secret_storage'; END IF;

  UPDATE public.admin_global_config
  SET valor=p_value,updated_by=auth.uid(),updated_at=now()
  WHERE chave=p_key;

  INSERT INTO public.seguranca_audit_log(
    profile_id,acao,modulo,entidade,entidade_id,descricao,dados_antes,dados_depois
  ) VALUES(
    auth.uid(),'update','admin_global','config',v_c.id,
    'Configuração global atualizada',
    jsonb_build_object('key',p_key,'value',v_c.valor),
    jsonb_build_object('key',p_key,'value',p_value)
  );
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_config_set(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_config_set(text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_comunicados_list()
RETURNS TABLE(
  id uuid,titulo text,mensagem text,tipo text,nivel_importancia integer,
  publico_alvo text,data_inicio timestamptz,data_fim timestamptz,
  publicado boolean,data_publicacao timestamptz,total_visualizacoes integer,
  total_confirmacoes integer,requer_confirmacao boolean,created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public
AS $$
BEGIN
  IF NOT public.fn_is_admin_global() THEN RAISE EXCEPTION 'platform_admin_required'; END IF;
  RETURN QUERY
  SELECT c.id,c.titulo::text,c.mensagem,c.tipo::text,c.nivel_importancia,
    c.publico_alvo::text,c.data_inicio,c.data_fim,c.publicado,c.data_publicacao,
    c.total_visualizacoes,c.total_confirmacoes,c.requer_confirmacao,c.created_at
  FROM public.admin_comunicados c
  WHERE c.deleted_at IS NULL
  ORDER BY c.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_comunicados_list() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_comunicados_list() TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_comunicado_criar(
  p_titulo text,p_mensagem text,p_tipo text,p_publico text,
  p_importancia integer DEFAULT 0,p_inicio timestamptz DEFAULT now(),
  p_fim timestamptz DEFAULT NULL,p_requer_confirmacao boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.fn_is_admin_global() THEN RAISE EXCEPTION 'platform_admin_required'; END IF;
  IF trim(coalesce(p_titulo,''))='' OR trim(coalesce(p_mensagem,''))='' THEN
    RAISE EXCEPTION 'announcement_content_required';
  END IF;
  IF p_publico NOT IN ('todos','empresas_pro','empresas_enterprise','usuarios_admin','afiliados') THEN
    RAISE EXCEPTION 'announcement_audience_invalid';
  END IF;

  INSERT INTO public.admin_comunicados(
    titulo,mensagem,tipo,nivel_importancia,publico_alvo,data_inicio,data_fim,
    publicado_por,requer_confirmacao,publicado
  ) VALUES(
    trim(p_titulo),trim(p_mensagem),coalesce(nullif(trim(p_tipo),''),'informacao'),
    greatest(0,least(coalesce(p_importancia,0),100)),p_publico,
    coalesce(p_inicio,now()),p_fim,auth.uid(),p_requer_confirmacao,false
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_comunicado_criar(text,text,text,text,integer,timestamptz,timestamptz,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_comunicado_criar(text,text,text,text,integer,timestamptz,timestamptz,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_comunicado_publicar(p_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_c public.admin_comunicados%ROWTYPE; v_p record; v_count integer:=0;
BEGIN
  IF NOT public.fn_is_admin_global() THEN RAISE EXCEPTION 'platform_admin_required'; END IF;
  SELECT * INTO v_c FROM public.admin_comunicados WHERE id=p_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'announcement_not_found'; END IF;

  UPDATE public.admin_comunicados
  SET publicado=true,data_publicacao=coalesce(data_publicacao,now()),publicado_por=auth.uid(),updated_at=now()
  WHERE id=p_id;

  FOR v_p IN
    SELECT DISTINCT p.id,p.empresa_id
    FROM public.profiles p
    LEFT JOIN public.empresas e ON e.id=p.empresa_id
    WHERE p.deleted_at IS NULL AND p.status='ativo'
      AND (
        v_c.publico_alvo='todos'
        OR (v_c.publico_alvo='usuarios_admin' AND p.is_admin_global)
        OR (v_c.publico_alvo='empresas_pro' AND e.plano='pro')
        OR (v_c.publico_alvo='empresas_enterprise' AND e.plano='enterprise')
        OR (
          v_c.publico_alvo='afiliados'
          AND EXISTS(SELECT 1 FROM public.afiliados a WHERE a.profile_id=p.id AND a.status='ativo' AND a.deleted_at IS NULL)
        )
      )
  LOOP
    IF public.fn_notificacao_criar(
      v_p.id,v_p.empresa_id,'sistema',
      v_c.titulo,v_c.mensagem,'comunicado',v_c.id,
      '/app', 'comunicado:'||v_c.id::text||':'||v_p.id::text,
      jsonb_build_object('tipo',v_c.tipo,'importancia',v_c.nivel_importancia)
    ) IS NOT NULL THEN
      v_count:=v_count+1;
    END IF;
  END LOOP;

  INSERT INTO public.seguranca_audit_log(
    profile_id,acao,modulo,entidade,entidade_id,descricao,detalhes
  ) VALUES(
    auth.uid(),'create','admin_global','comunicado',p_id,
    'Comunicado global publicado',
    jsonb_build_object('audience',v_c.publico_alvo,'notifications_created',v_count)
  );
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_comunicado_publicar(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_comunicado_publicar(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_comunicado_arquivar(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
BEGIN
  IF NOT public.fn_is_admin_global() THEN RAISE EXCEPTION 'platform_admin_required'; END IF;
  UPDATE public.admin_comunicados
  SET publicado=false,deleted_at=now(),updated_at=now()
  WHERE id=p_id AND deleted_at IS NULL;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_comunicado_arquivar(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_comunicado_arquivar(uuid) TO authenticated;
