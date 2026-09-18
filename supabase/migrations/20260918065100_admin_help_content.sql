-- Cash Engine PRO — gestão administrativa do conteúdo da Central de Ajuda.

CREATE OR REPLACE FUNCTION public.fn_admin_ajuda_categorias()
RETURNS TABLE(
  id uuid,nome text,slug text,descricao text,publica boolean,ordem integer,updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  IF NOT public.fn_is_admin_global() THEN RAISE EXCEPTION 'platform_admin_required'; END IF;
  RETURN QUERY
  SELECT c.id,c.nome::text,c.slug::text,c.descricao,c.publica,c.ordem,c.updated_at
  FROM public.ajuda_categorias c
  WHERE c.empresa_id IS NULL AND c.deleted_at IS NULL
  ORDER BY c.ordem,c.nome;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_ajuda_categorias() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_ajuda_categorias() TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_ajuda_categoria_salvar(
  p_id uuid,
  p_nome text,
  p_descricao text,
  p_publica boolean,
  p_ordem integer DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v_id uuid; v_slug text;
BEGIN
  IF NOT public.fn_is_admin_global() THEN RAISE EXCEPTION 'platform_admin_required'; END IF;
  IF trim(coalesce(p_nome,''))='' THEN RAISE EXCEPTION 'help_category_name_required'; END IF;

  v_slug:=lower(trim(regexp_replace(
    translate(trim(p_nome),'ÁÀÃÂÉÊÍÓÔÕÚÜÇáàãâéêíóôõúüç','AAAAEEIOOOUUCaaaaeeiooouuc'),
    '[^a-zA-Z0-9]+','-','g'
  ),'-'));
  IF v_slug='' THEN v_slug:='categoria-'||substr(gen_random_uuid()::text,1,8); END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.ajuda_categorias(
      empresa_id,nome,slug,descricao,ordem,publica
    ) VALUES(
      NULL,trim(p_nome),v_slug,nullif(trim(coalesce(p_descricao,'')),''),coalesce(p_ordem,0),p_publica
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.ajuda_categorias
    SET nome=trim(p_nome),slug=v_slug,
        descricao=nullif(trim(coalesce(p_descricao,'')),''),
        ordem=coalesce(p_ordem,0),publica=p_publica,updated_at=now()
    WHERE id=p_id AND empresa_id IS NULL AND deleted_at IS NULL
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'help_category_not_found'; END IF;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_ajuda_categoria_salvar(
  uuid,text,text,boolean,integer
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_ajuda_categoria_salvar(
  uuid,text,text,boolean,integer
) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_ajuda_artigos(
  p_query text DEFAULT NULL,
  p_limit integer DEFAULT 100
)
RETURNS TABLE(
  id uuid,categoria_id uuid,categoria_nome text,titulo text,resumo text,
  conteudo text,status text,publico boolean,destaque boolean,
  tempo_leitura_minutos integer,updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  IF NOT public.fn_is_admin_global() THEN RAISE EXCEPTION 'platform_admin_required'; END IF;
  RETURN QUERY
  SELECT
    a.id,a.categoria_id,c.nome::text,a.titulo::text,a.resumo,a.conteudo,
    a.status::text,a.publico,a.destaque,a.tempo_leitura_minutos,a.updated_at
  FROM public.ajuda_artigos a
  LEFT JOIN public.ajuda_categorias c ON c.id=a.categoria_id
  WHERE a.empresa_id IS NULL
    AND a.deleted_at IS NULL
    AND (
      coalesce(trim(p_query),'')=''
      OR a.titulo ILIKE '%'||trim(p_query)||'%'
      OR coalesce(a.resumo,'') ILIKE '%'||trim(p_query)||'%'
      OR a.conteudo ILIKE '%'||trim(p_query)||'%'
    )
  ORDER BY a.updated_at DESC,a.id DESC
  LIMIT greatest(1,least(coalesce(p_limit,100),200));
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_ajuda_artigos(text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_ajuda_artigos(text,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_ajuda_artigo_salvar(
  p_id uuid,
  p_categoria_id uuid,
  p_titulo text,
  p_resumo text,
  p_conteudo text,
  p_publico boolean,
  p_destaque boolean,
  p_status text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_id uuid;
  v_slug text;
  v_minutes integer;
BEGIN
  IF NOT public.fn_is_admin_global() THEN RAISE EXCEPTION 'platform_admin_required'; END IF;
  IF length(trim(coalesce(p_titulo,'')))<3 THEN RAISE EXCEPTION 'help_article_title_required'; END IF;
  IF length(trim(coalesce(p_conteudo,'')))<10 THEN RAISE EXCEPTION 'help_article_content_too_short'; END IF;
  IF p_status NOT IN ('rascunho','publicado','arquivado')
    THEN RAISE EXCEPTION 'help_article_status_invalid'; END IF;
  IF p_categoria_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.ajuda_categorias
    WHERE id=p_categoria_id AND empresa_id IS NULL AND deleted_at IS NULL
  ) THEN RAISE EXCEPTION 'help_category_not_found'; END IF;

  v_slug:=lower(trim(regexp_replace(
    translate(trim(p_titulo),'ÁÀÃÂÉÊÍÓÔÕÚÜÇáàãâéêíóôõúüç','AAAAEEIOOOUUCaaaaeeiooouuc'),
    '[^a-zA-Z0-9]+','-','g'
  ),'-'));
  IF v_slug='' THEN v_slug:='artigo-'||substr(gen_random_uuid()::text,1,8); END IF;
  v_minutes:=greatest(1,ceil(array_length(regexp_split_to_array(trim(p_conteudo),'\s+'),1)/220.0)::integer);

  IF p_id IS NULL THEN
    INSERT INTO public.ajuda_artigos(
      empresa_id,categoria_id,criado_por,atualizado_por,titulo,slug,resumo,
      conteudo,publico,destaque,status,data_publicacao,tempo_leitura_minutos
    ) VALUES(
      NULL,p_categoria_id,auth.uid(),auth.uid(),trim(p_titulo),v_slug,
      nullif(trim(coalesce(p_resumo,'')),''),trim(p_conteudo),p_publico,p_destaque,
      p_status,CASE WHEN p_status='publicado' THEN now() ELSE NULL END,v_minutes
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.ajuda_artigos
    SET categoria_id=p_categoria_id,atualizado_por=auth.uid(),titulo=trim(p_titulo),
        slug=v_slug,resumo=nullif(trim(coalesce(p_resumo,'')),''),
        conteudo=trim(p_conteudo),publico=p_publico,destaque=p_destaque,
        status=p_status,
        data_publicacao=CASE
          WHEN p_status='publicado' THEN coalesce(data_publicacao,now())
          ELSE data_publicacao END,
        tempo_leitura_minutos=v_minutes,versao=coalesce(versao,1)+1,updated_at=now()
    WHERE id=p_id AND empresa_id IS NULL AND deleted_at IS NULL
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'help_article_not_found'; END IF;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_ajuda_artigo_salvar(
  uuid,uuid,text,text,text,boolean,boolean,text
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_ajuda_artigo_salvar(
  uuid,uuid,text,text,text,boolean,boolean,text
) TO authenticated;
