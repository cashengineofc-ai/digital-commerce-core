-- Cash Engine PRO — Central de Ajuda e suporte reais.
-- Tickets são privados; artigos publicados podem ser pesquisados; anexos ficam em bucket privado.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE public.notificacoes
  ADD COLUMN IF NOT EXISTS dedupe_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notificacoes_dedupe
ON public.notificacoes(dedupe_key)
WHERE dedupe_key IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ajuda_artigos_conteudo_trgm
ON public.ajuda_artigos USING GIN (conteudo gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_tickets_assunto_trgm
ON public.tickets USING GIN (assunto gin_trgm_ops);

CREATE TABLE IF NOT EXISTS public.tickets_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  mensagem_id uuid REFERENCES public.tickets_mensagens(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK(size_bytes>0 AND size_bytes<=10485760),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tickets_anexos_ticket
ON public.tickets_anexos(ticket_id,created_at);

CREATE TABLE IF NOT EXISTS public.suporte_canais_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canal text NOT NULL UNIQUE
    CHECK(canal IN ('email','telefone','whatsapp','portal')),
  label text NOT NULL,
  valor text,
  ativo boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.suporte_canais_config(canal,label,valor,ativo)
VALUES('portal','Central de Ajuda',NULL,true)
ON CONFLICT(canal) DO NOTHING;

ALTER TABLE public.tickets_anexos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suporte_canais_config ENABLE ROW LEVEL SECURITY;

-- Remove políticas genéricas de tickets para aplicar escopo próprio/atendimento.
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT tablename,policyname
    FROM pg_policies
    WHERE schemaname='public'
      AND tablename IN ('tickets','tickets_mensagens','tickets_anexos')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',p.policyname,p.tablename);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.fn_ticket_support_staff(p_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND (
      public.fn_is_admin_global()
      OR (
        public.current_empresa_id()=p_empresa_id
        AND (
          public.fn_is_empresa_owner(p_empresa_id)
          OR public.fn_tem_permissao('suporte','tickets','read'::public.tipo_operacao)
          OR public.fn_tem_permissao('suporte','tickets','manage'::public.tipo_operacao)
        )
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.fn_ticket_can_access(p_ticket_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.tickets t
    WHERE t.id=p_ticket_id
      AND t.deleted_at IS NULL
      AND (
        t.profile_id=auth.uid()
        OR public.fn_ticket_support_staff(t.empresa_id)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.fn_ticket_support_staff(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.fn_ticket_can_access(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_ticket_support_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ticket_can_access(uuid) TO authenticated;

CREATE POLICY tickets_read_authorized
ON public.tickets FOR SELECT TO authenticated
USING(public.fn_ticket_can_access(id));

CREATE POLICY ticket_messages_read_authorized
ON public.tickets_mensagens FOR SELECT TO authenticated
USING(public.fn_ticket_can_access(ticket_id));

CREATE POLICY ticket_attachments_read_authorized
ON public.tickets_anexos FOR SELECT TO authenticated
USING(public.fn_ticket_can_access(ticket_id));

CREATE POLICY support_channels_read
ON public.suporte_canais_config FOR SELECT TO authenticated
USING(ativo OR public.fn_is_admin_global());

CREATE POLICY support_channels_admin_write
ON public.suporte_canais_config FOR ALL TO authenticated
USING(public.fn_is_admin_global())
WITH CHECK(public.fn_is_admin_global());

-- Artigos/categorias: autenticado só vê publicado/publicável da sua empresa ou global.
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT tablename,policyname
    FROM pg_policies
    WHERE schemaname='public'
      AND tablename IN ('ajuda_artigos','ajuda_categorias')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',p.policyname,p.tablename);
  END LOOP;
END $$;

CREATE POLICY ajuda_artigos_read
ON public.ajuda_artigos FOR SELECT TO authenticated
USING(
  deleted_at IS NULL
  AND status='publicado'
  AND publico
  AND (empresa_id IS NULL OR empresa_id=public.current_empresa_id())
);

CREATE POLICY ajuda_artigos_admin
ON public.ajuda_artigos FOR ALL TO authenticated
USING(public.fn_is_admin_global())
WITH CHECK(public.fn_is_admin_global());

CREATE POLICY ajuda_categorias_read
ON public.ajuda_categorias FOR SELECT TO authenticated
USING(
  deleted_at IS NULL
  AND publica
  AND (empresa_id IS NULL OR empresa_id=public.current_empresa_id())
);

CREATE POLICY ajuda_categorias_admin
ON public.ajuda_categorias FOR ALL TO authenticated
USING(public.fn_is_admin_global())
WITH CHECK(public.fn_is_admin_global());

-- Bucket privado de anexos.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES(
  'support-attachments','support-attachments',false,10485760,
  ARRAY[
    'image/jpeg','image/png','image/webp','application/pdf','text/plain'
  ]::text[]
)
ON CONFLICT(id) DO UPDATE SET
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.fn_ticket_storage_access(p_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v_ticket uuid;
BEGIN
  BEGIN
    v_ticket:=split_part(p_name,'/',2)::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;
  RETURN public.fn_ticket_can_access(v_ticket);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_ticket_storage_access(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_ticket_storage_access(text) TO authenticated;

DROP POLICY IF EXISTS support_attachment_read ON storage.objects;
CREATE POLICY support_attachment_read
ON storage.objects FOR SELECT TO authenticated
USING(
  bucket_id='support-attachments'
  AND public.fn_ticket_storage_access(name)
);

DROP POLICY IF EXISTS support_attachment_insert ON storage.objects;
CREATE POLICY support_attachment_insert
ON storage.objects FOR INSERT TO authenticated
WITH CHECK(
  bucket_id='support-attachments'
  AND public.fn_ticket_storage_access(name)
);

DROP POLICY IF EXISTS support_attachment_delete ON storage.objects;
CREATE POLICY support_attachment_delete
ON storage.objects FOR DELETE TO authenticated
USING(
  bucket_id='support-attachments'
  AND public.fn_ticket_storage_access(name)
);

-- Busca de artigos.
CREATE OR REPLACE FUNCTION public.fn_ajuda_buscar(
  p_query text DEFAULT NULL,
  p_categoria_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 30,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  categoria_id uuid,
  categoria_nome text,
  titulo text,
  resumo text,
  conteudo text,
  tempo_leitura_minutos integer,
  destaque boolean,
  updated_at timestamptz,
  total_records bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
  WITH visible AS (
    SELECT
      a.id,a.categoria_id,c.nome AS category_name,a.titulo,a.resumo,a.conteudo,
      a.tempo_leitura_minutos,a.destaque,a.updated_at,
      CASE
        WHEN coalesce(trim(p_query),'')='' THEN 0
        ELSE
          similarity(lower(a.titulo),lower(trim(p_query)))*4
          + similarity(lower(coalesce(a.resumo,'')),lower(trim(p_query)))*2
          + similarity(lower(a.conteudo),lower(trim(p_query)))
      END AS score
    FROM public.ajuda_artigos a
    LEFT JOIN public.ajuda_categorias c ON c.id=a.categoria_id
    WHERE a.deleted_at IS NULL
      AND a.status='publicado'
      AND a.publico
      AND (a.empresa_id IS NULL OR a.empresa_id=public.current_empresa_id())
      AND (p_categoria_id IS NULL OR a.categoria_id=p_categoria_id)
      AND (
        coalesce(trim(p_query),'')=''
        OR a.titulo ILIKE '%'||trim(p_query)||'%'
        OR coalesce(a.resumo,'') ILIKE '%'||trim(p_query)||'%'
        OR a.conteudo ILIKE '%'||trim(p_query)||'%'
        OR trim(p_query)=ANY(coalesce(a.palavras_chave,ARRAY[]::varchar[]))
      )
  )
  SELECT
    v.id,v.categoria_id,v.category_name::text,v.titulo::text,v.resumo,
    v.conteudo,v.tempo_leitura_minutos,v.destaque,v.updated_at,count(*) OVER()
  FROM visible v
  ORDER BY
    CASE WHEN coalesce(trim(p_query),'')='' THEN 0 ELSE v.score END DESC,
    v.destaque DESC,v.updated_at DESC
  LIMIT greatest(1,least(coalesce(p_limit,30),100))
  OFFSET greatest(coalesce(p_offset,0),0);
$$;

REVOKE ALL ON FUNCTION public.fn_ajuda_buscar(text,uuid,integer,integer)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_ajuda_buscar(text,uuid,integer,integer)
TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_ajuda_categorias()
RETURNS TABLE(id uuid,nome text,descricao text,ordem integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
  SELECT id,nome::text,descricao,ordem
  FROM public.ajuda_categorias
  WHERE deleted_at IS NULL
    AND publica
    AND (empresa_id IS NULL OR empresa_id=public.current_empresa_id())
  ORDER BY ordem,nome;
$$;

REVOKE ALL ON FUNCTION public.fn_ajuda_categorias() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_ajuda_categorias() TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_suporte_ticket_criar(
  p_assunto text,
  p_descricao text,
  p_tipo text DEFAULT 'suporte',
  p_prioridade text DEFAULT 'media',
  p_categoria text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_profile public.profiles%ROWTYPE;
  v_id uuid;
  v_protocol text;
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF length(trim(coalesce(p_assunto,'')))<3 THEN RAISE EXCEPTION 'ticket_subject_too_short'; END IF;
  IF length(trim(coalesce(p_descricao,'')))<5 THEN RAISE EXCEPTION 'ticket_description_too_short'; END IF;
  IF p_tipo NOT IN ('suporte','duvida','reclamacao','sugestao','bug','financeiro')
    THEN RAISE EXCEPTION 'ticket_type_invalid'; END IF;
  IF p_prioridade NOT IN ('baixa','media','alta','critica','urgente')
    THEN RAISE EXCEPTION 'ticket_priority_invalid'; END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id=auth.uid();
  v_protocol:='SUP-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(encode(gen_random_bytes(6),'hex'),1,10));

  INSERT INTO public.tickets(
    empresa_id,numero_protocolo,profile_id,aberto_por_nome,aberto_por_email,
    tipo,prioridade,status,assunto,descricao,categoria,origem,canal_origem,
    sla_tempo_resposta
  ) VALUES(
    v_empresa,v_protocol,auth.uid(),v_profile.nome_completo,v_profile.email,
    p_tipo::public.tipo_ticket,p_prioridade::public.prioridade_ticket,'aberto',
    trim(p_assunto),trim(p_descricao),nullif(trim(coalesce(p_categoria,'')),''),
    'painel','web',NULL
  )
  RETURNING id INTO v_id;

  INSERT INTO public.tickets_mensagens(
    ticket_id,empresa_id,profile_id,nome_remetente,email_remetente,
    tipo_remetente,corpo_mensagem,eh_nota_interna,eh_resposta_automatica
  ) VALUES(
    v_id,v_empresa,auth.uid(),v_profile.nome_completo,v_profile.email,
    'cliente',trim(p_descricao),false,false
  );

  INSERT INTO public.notificacoes(
    empresa_id,profile_id,tipo,titulo,mensagem,resumo_curto,
    entidade_tipo,entidade_id,url_destino,canal_inapp,criada_sistema,dedupe_key
  ) VALUES(
    v_empresa,auth.uid(),'suporte','Chamado aberto',
    'Seu chamado '||v_protocol||' foi criado.',
    'Chamado '||v_protocol||' criado.',
    'ticket',v_id,'/app/ajuda?ticket='||v_id::text,true,true,
    'ticket-opened:'||v_id::text
  ) ON CONFLICT(dedupe_key) DO NOTHING;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_suporte_ticket_criar(text,text,text,text,text)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_suporte_ticket_criar(text,text,text,text,text)
TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_suporte_tickets_me()
RETURNS TABLE(
  id uuid,protocolo text,assunto text,tipo text,prioridade text,status text,
  categoria text,updated_at timestamptz,created_at timestamptz,mensagens bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
  SELECT
    t.id,t.numero_protocolo::text,t.assunto::text,t.tipo::text,t.prioridade::text,
    t.status::text,t.categoria::text,t.updated_at,t.created_at,
    (SELECT count(*) FROM public.tickets_mensagens m WHERE m.ticket_id=t.id)
  FROM public.tickets t
  WHERE t.profile_id=auth.uid() AND t.deleted_at IS NULL
  ORDER BY t.data_ultima_interacao DESC,t.id DESC;
$$;

REVOKE ALL ON FUNCTION public.fn_suporte_tickets_me() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_suporte_tickets_me() TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_suporte_ticket_mensagens(p_ticket_id uuid)
RETURNS TABLE(
  id uuid,
  sender_name text,
  sender_type text,
  body text,
  is_automatic boolean,
  created_at timestamptz,
  attachments jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  IF NOT public.fn_ticket_can_access(p_ticket_id) THEN
    RAISE EXCEPTION 'ticket_access_denied';
  END IF;

  RETURN QUERY
  SELECT
    m.id,m.nome_remetente::text,m.tipo_remetente::text,m.corpo_mensagem,
    m.eh_resposta_automatica,m.created_at,
    coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id',a.id,'file_name',a.file_name,'mime_type',a.mime_type,
        'size_bytes',a.size_bytes,'storage_path',a.storage_path
      ) ORDER BY a.created_at)
      FROM public.tickets_anexos a
      WHERE a.mensagem_id=m.id
    ),'[]'::jsonb)
  FROM public.tickets_mensagens m
  WHERE m.ticket_id=p_ticket_id
    AND (NOT m.eh_nota_interna OR public.fn_ticket_support_staff(m.empresa_id))
  ORDER BY m.created_at,m.id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_suporte_ticket_mensagens(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_suporte_ticket_mensagens(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_suporte_responder(
  p_ticket_id uuid,
  p_mensagem text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  t public.tickets%ROWTYPE;
  p public.profiles%ROWTYPE;
  v_id uuid;
  v_staff boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF length(trim(coalesce(p_mensagem,'')))<1 THEN RAISE EXCEPTION 'message_required'; END IF;

  SELECT * INTO t FROM public.tickets
  WHERE id=p_ticket_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR NOT public.fn_ticket_can_access(t.id)
    THEN RAISE EXCEPTION 'ticket_access_denied'; END IF;
  IF t.status='fechado' THEN RAISE EXCEPTION 'ticket_closed'; END IF;

  v_staff:=public.fn_ticket_support_staff(t.empresa_id);
  SELECT * INTO p FROM public.profiles WHERE id=auth.uid();

  INSERT INTO public.tickets_mensagens(
    ticket_id,empresa_id,profile_id,nome_remetente,email_remetente,
    tipo_remetente,corpo_mensagem,eh_nota_interna,eh_resposta_automatica
  ) VALUES(
    t.id,t.empresa_id,auth.uid(),p.nome_completo,p.email,
    CASE WHEN v_staff THEN 'agente' ELSE 'cliente' END,
    trim(p_mensagem),false,false
  ) RETURNING id INTO v_id;

  UPDATE public.tickets
  SET status=CASE
        WHEN v_staff THEN 'respondido_suporte'::public.status_ticket
        ELSE 'respondido_cliente'::public.status_ticket
      END,
      data_primeira_resposta=CASE
        WHEN v_staff THEN coalesce(data_primeira_resposta,now())
        ELSE data_primeira_resposta
      END,
      data_ultima_interacao=now(),
      updated_at=now()
  WHERE id=t.id;

  IF v_staff AND t.profile_id IS NOT NULL THEN
    INSERT INTO public.notificacoes(
      empresa_id,profile_id,tipo,titulo,mensagem,resumo_curto,
      entidade_tipo,entidade_id,url_destino,canal_inapp,criada_sistema,dedupe_key
    ) VALUES(
      t.empresa_id,t.profile_id,'suporte','Nova resposta no chamado',
      'Há uma nova resposta no chamado '||t.numero_protocolo||'.',
      'Nova resposta em '||t.numero_protocolo,
      'ticket',t.id,'/app/ajuda?ticket='||t.id::text,true,true,
      'ticket-message:'||v_id::text
    ) ON CONFLICT(dedupe_key) DO NOTHING;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_suporte_responder(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_suporte_responder(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_suporte_anexo_registrar(
  p_ticket_id uuid,
  p_mensagem_id uuid,
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_size_bytes bigint
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE t public.tickets%ROWTYPE; v_id uuid;
BEGIN
  SELECT * INTO t FROM public.tickets
  WHERE id=p_ticket_id AND deleted_at IS NULL;
  IF NOT FOUND OR NOT public.fn_ticket_can_access(t.id)
    THEN RAISE EXCEPTION 'ticket_access_denied'; END IF;
  IF p_size_bytes<=0 OR p_size_bytes>10485760 THEN RAISE EXCEPTION 'attachment_size_invalid'; END IF;
  IF p_mime_type NOT IN ('image/jpeg','image/png','image/webp','application/pdf','text/plain')
    THEN RAISE EXCEPTION 'attachment_type_invalid'; END IF;
  IF split_part(p_storage_path,'/',1)<>t.empresa_id::text
     OR split_part(p_storage_path,'/',2)<>t.id::text
    THEN RAISE EXCEPTION 'attachment_path_invalid'; END IF;
  IF p_mensagem_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.tickets_mensagens
    WHERE id=p_mensagem_id AND ticket_id=t.id
  ) THEN RAISE EXCEPTION 'message_not_in_ticket'; END IF;

  INSERT INTO public.tickets_anexos(
    ticket_id,mensagem_id,empresa_id,uploaded_by,storage_path,file_name,mime_type,size_bytes
  ) VALUES(
    t.id,p_mensagem_id,t.empresa_id,auth.uid(),p_storage_path,
    left(p_file_name,255),p_mime_type,p_size_bytes
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_suporte_anexo_registrar(
  uuid,uuid,text,text,text,bigint
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_suporte_anexo_registrar(
  uuid,uuid,text,text,text,bigint
) TO authenticated;

-- Admin Global: visão global de atendimento.
CREATE OR REPLACE FUNCTION public.fn_admin_suporte_tickets(
  p_status text DEFAULT NULL,
  p_query text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,protocolo text,empresa_id uuid,empresa_nome text,solicitante text,
  assunto text,tipo text,prioridade text,status text,atribuido_nome text,
  created_at timestamptz,updated_at timestamptz,mensagens bigint,total_records bigint
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
    t.id,t.numero_protocolo::text,t.empresa_id,
    coalesce(e.nome_fantasia,e.razao_social,'Empresa')::text,
    coalesce(p.nome_completo,t.aberto_por_nome,'Usuário')::text,
    t.assunto::text,t.tipo::text,t.prioridade::text,t.status::text,
    agent.nome_completo::text,t.created_at,t.updated_at,
    (SELECT count(*) FROM public.tickets_mensagens m WHERE m.ticket_id=t.id),
    count(*) OVER()
  FROM public.tickets t
  JOIN public.empresas e ON e.id=t.empresa_id
  LEFT JOIN public.profiles p ON p.id=t.profile_id
  LEFT JOIN public.profiles agent ON agent.id=t.atribuido_para
  WHERE t.deleted_at IS NULL
    AND (coalesce(trim(p_status),'')='' OR t.status::text=p_status)
    AND (
      coalesce(trim(p_query),'')=''
      OR t.numero_protocolo ILIKE '%'||trim(p_query)||'%'
      OR t.assunto ILIKE '%'||trim(p_query)||'%'
      OR coalesce(p.nome_completo,t.aberto_por_nome,'') ILIKE '%'||trim(p_query)||'%'
      OR coalesce(e.nome_fantasia,e.razao_social,'') ILIKE '%'||trim(p_query)||'%'
    )
  ORDER BY t.data_ultima_interacao DESC,t.id DESC
  LIMIT greatest(1,least(coalesce(p_limit,50),200))
  OFFSET greatest(coalesce(p_offset,0),0);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_suporte_tickets(text,text,integer,integer)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_suporte_tickets(text,text,integer,integer)
TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_suporte_status(
  p_ticket_id uuid,
  p_status text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  IF NOT public.fn_is_admin_global() THEN RAISE EXCEPTION 'platform_admin_required'; END IF;
  IF p_status NOT IN (
    'aberto','respondido_cliente','respondido_suporte','em_analise',
    'pendente_terceiro','resolvido','fechado','reaberto'
  ) THEN RAISE EXCEPTION 'ticket_status_invalid'; END IF;

  UPDATE public.tickets
  SET status=p_status::public.status_ticket,
      data_resolucao=CASE WHEN p_status='resolvido' THEN now() ELSE data_resolucao END,
      data_fechamento=CASE WHEN p_status='fechado' THEN now() ELSE data_fechamento END,
      resolvido_por=CASE WHEN p_status='resolvido' THEN auth.uid() ELSE resolvido_por END,
      fechado_por=CASE WHEN p_status='fechado' THEN auth.uid() ELSE fechado_por END,
      updated_at=now()
  WHERE id=p_ticket_id AND deleted_at IS NULL;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_suporte_status(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_suporte_status(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_suporte_canal_salvar(
  p_canal text,p_label text,p_valor text,p_ativo boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  IF NOT public.fn_is_admin_global() THEN RAISE EXCEPTION 'platform_admin_required'; END IF;
  IF p_canal NOT IN ('email','telefone','whatsapp','portal')
    THEN RAISE EXCEPTION 'support_channel_invalid'; END IF;
  IF p_canal<>'portal' AND p_ativo AND trim(coalesce(p_valor,''))=''
    THEN RAISE EXCEPTION 'support_channel_value_required'; END IF;

  INSERT INTO public.suporte_canais_config(canal,label,valor,ativo,updated_by,updated_at)
  VALUES(p_canal,trim(p_label),nullif(trim(coalesce(p_valor,'')),''),p_ativo,auth.uid(),now())
  ON CONFLICT(canal) DO UPDATE SET
    label=excluded.label,valor=excluded.valor,ativo=excluded.ativo,
    updated_by=auth.uid(),updated_at=now();

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_suporte_canal_salvar(text,text,text,boolean)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_suporte_canal_salvar(text,text,text,boolean)
TO authenticated;
