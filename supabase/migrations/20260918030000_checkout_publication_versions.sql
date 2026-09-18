-- Cash Engine PRO — publicação real e versionada de checkouts
-- Rascunho editável; publicação imutável; order bumps congelados por versão.

CREATE TABLE IF NOT EXISTS public.checkout_version_order_bumps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_version_id uuid NOT NULL REFERENCES public.checkout_versions(id) ON DELETE CASCADE,
  checkout_id uuid NOT NULL REFERENCES public.checkouts(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  source_order_bump_id uuid REFERENCES public.checkout_order_bumps(id) ON DELETE SET NULL,
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  titulo_snapshot varchar(180) NOT NULL,
  descricao_snapshot text,
  imagem_snapshot text,
  texto_oferta_snapshot text,
  preco_publicado_snapshot numeric(15,2) NOT NULL CHECK (preco_publicado_snapshot >= 0),
  regra_preco_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ordem integer NOT NULL DEFAULT 0,
  grupo_combinacao varchar(80),
  max_selecao_grupo integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(checkout_version_id, source_order_bump_id)
);

CREATE INDEX IF NOT EXISTS idx_checkout_version_bumps_version
  ON public.checkout_version_order_bumps(checkout_version_id,ordem,created_at);
ALTER TABLE public.checkout_version_order_bumps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS checkout_version_bumps_tenant ON public.checkout_version_order_bumps;
CREATE POLICY checkout_version_bumps_tenant
ON public.checkout_version_order_bumps
FOR ALL TO authenticated
USING (empresa_id=public.current_empresa_id() OR public.fn_is_admin_global())
WITH CHECK (empresa_id=public.current_empresa_id() OR public.fn_is_admin_global());

-- =========================================================
-- MÍDIA DE CHECKOUT
-- =========================================================
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES (
  'checkout-media','checkout-media',true,8388608,
  ARRAY['image/jpeg','image/png','image/webp','image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public=EXCLUDED.public,
    file_size_limit=EXCLUDED.file_size_limit,
    allowed_mime_types=EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS checkout_media_insert_company ON storage.objects;
CREATE POLICY checkout_media_insert_company
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id='checkout-media'
  AND (storage.foldername(name))[1]=public.current_empresa_id()::text
);

DROP POLICY IF EXISTS checkout_media_update_company ON storage.objects;
CREATE POLICY checkout_media_update_company
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id='checkout-media'
  AND (storage.foldername(name))[1]=public.current_empresa_id()::text
)
WITH CHECK (
  bucket_id='checkout-media'
  AND (storage.foldername(name))[1]=public.current_empresa_id()::text
);

DROP POLICY IF EXISTS checkout_media_delete_company ON storage.objects;
CREATE POLICY checkout_media_delete_company
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id='checkout-media'
  AND (storage.foldername(name))[1]=public.current_empresa_id()::text
  AND NOT EXISTS (
    SELECT 1
    FROM public.checkout_versions cv
    WHERE cv.empresa_id=public.current_empresa_id()
      AND cv.estado='publicado'
      AND cv.config::text LIKE '%' || storage.objects.name || '%'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.checkout_version_order_bumps vb
    WHERE vb.empresa_id=public.current_empresa_id()
      AND (
        coalesce(vb.imagem_snapshot,'') LIKE '%' || storage.objects.name || '%'
      )
  )
);

-- =========================================================
-- SANITIZAÇÃO E VALIDAÇÃO ESTRUTURADA
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_checkout_config_validar(p_config jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path=public
AS $$
DECLARE
  v_key text;
  v_redirect text;
  v_text text;
BEGIN
  IF p_config IS NULL OR jsonb_typeof(p_config) <> 'object' THEN
    RAISE EXCEPTION 'checkout_config_must_be_object';
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(p_config)
  LOOP
    IF v_key NOT IN (
      'theme','texts','buyer_fields','confirmation','banners',
      'sections','payment_ui','support','legal'
    ) THEN
      RAISE EXCEPTION 'checkout_config_key_not_allowed:%',v_key;
    END IF;
  END LOOP;

  v_text := p_config::text;
  IF v_text ~* '(<[[:space:]]*script|javascript[[:space:]]*:|onerror[[:space:]]*=|onload[[:space:]]*=|<iframe|<object|<embed)' THEN
    RAISE EXCEPTION 'checkout_unsafe_content';
  END IF;

  v_redirect := nullif(trim(p_config #>> '{confirmation,redirect_url}'),'');
  IF v_redirect IS NOT NULL
     AND v_redirect !~* '^(https://[^[:space:]]+|/[^[:space:]]*)$' THEN
    RAISE EXCEPTION 'checkout_redirect_url_invalid';
  END IF;

  -- Cartão e boleto não podem ser habilitados por customização visual.
  IF coalesce((p_config #>> '{payment_ui,card}')::boolean,false)
     OR coalesce((p_config #>> '{payment_ui,boleto}')::boolean,false) THEN
    RAISE EXCEPTION 'payment_method_not_operational';
  END IF;

  RETURN TRUE;
EXCEPTION
  WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'checkout_config_invalid_boolean';
END;
$$;

-- Versão publicada não pode ter o conteúdo alterado retroativamente.
CREATE OR REPLACE FUNCTION public.fn_checkout_version_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=public
AS $$
BEGIN
  IF TG_OP='DELETE' AND OLD.estado='publicado' THEN
    RAISE EXCEPTION 'published_checkout_version_is_immutable';
  END IF;

  IF TG_OP='UPDATE' AND OLD.estado='publicado' THEN
    IF NEW.config IS DISTINCT FROM OLD.config
       OR NEW.checkout_id IS DISTINCT FROM OLD.checkout_id
       OR NEW.empresa_id IS DISTINCT FROM OLD.empresa_id
       OR NEW.versao IS DISTINCT FROM OLD.versao
       OR NEW.criado_por IS DISTINCT FROM OLD.criado_por
       OR NEW.publicado_por IS DISTINCT FROM OLD.publicado_por
       OR NEW.publicado_em IS DISTINCT FROM OLD.publicado_em
       OR NEW.estado NOT IN ('publicado','substituido') THEN
      RAISE EXCEPTION 'published_checkout_version_is_immutable';
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_checkout_version_immutable ON public.checkout_versions;
CREATE TRIGGER trg_checkout_version_immutable
BEFORE UPDATE OR DELETE ON public.checkout_versions
FOR EACH ROW EXECUTE FUNCTION public.fn_checkout_version_immutable();

-- =========================================================
-- CRIAR CHECKOUT
-- =========================================================
-- Signature changed from the legacy p_slug argument to p_descricao.
-- RESTRICT (the default) preserves any external dependency instead of cascading.
DROP FUNCTION IF EXISTS public.fn_checkout_criar(text,uuid,text);
CREATE OR REPLACE FUNCTION public.fn_checkout_criar(
  p_nome text,
  p_oferta_id uuid,
  p_descricao text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_checkout uuid;
  v_version uuid;
  v_slug text;
  v_product uuid;
  v_config jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.fn_is_admin_global()
     AND NOT public.fn_tem_permissao('produtos','checkouts','create'::public.tipo_operacao) THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;
  IF trim(coalesce(p_nome,''))='' THEN RAISE EXCEPTION 'checkout_name_required'; END IF;

  SELECT produto_id INTO v_product
  FROM public.ofertas
  WHERE id=p_oferta_id
    AND empresa_id=v_empresa
    AND deleted_at IS NULL
    AND status IN ('rascunho','ativa','pausada');
  IF NOT FOUND THEN RAISE EXCEPTION 'offer_not_found'; END IF;

  v_slug:=lower(regexp_replace(trim(p_nome),'[^a-zA-Z0-9]+','-','g'))
          || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,8);

  v_config:=jsonb_build_object(
    'theme',jsonb_build_object(
      'primary','#2563EB','secondary','#0F172A','background','#050505',
      'text','#FFFFFF','font','Inter'
    ),
    'texts',jsonb_build_object(
      'title',trim(p_nome),'subtitle',coalesce(p_descricao,''),'pay_button','Gerar Pix'
    ),
    'buyer_fields',jsonb_build_object('cpf',true,'phone',true,'address',false),
    'payment_ui',jsonb_build_object('pix',true,'card',false,'boleto',false),
    'confirmation',jsonb_build_object('redirect_url',null),
    'banners',jsonb_build_object(),
    'sections',jsonb_build_array('produto','dados','adicionais','pagamento','resumo'),
    'support',jsonb_build_object(),
    'legal',jsonb_build_object()
  );

  INSERT INTO public.checkouts(
    empresa_id,criado_por,produto_id,oferta_id,nome,slug,descricao,status,public_token
  ) VALUES (
    v_empresa,auth.uid(),v_product,p_oferta_id,trim(p_nome),v_slug,
    nullif(trim(coalesce(p_descricao,'')),''),
    'rascunho'::public.status_checkout,gen_random_uuid()
  )
  RETURNING id INTO v_checkout;

  INSERT INTO public.checkout_versions(
    checkout_id,empresa_id,versao,estado,config,criado_por
  ) VALUES (
    v_checkout,v_empresa,1,'rascunho',v_config,auth.uid()
  )
  RETURNING id INTO v_version;

  UPDATE public.checkouts
  SET rascunho_versao_id=v_version,updated_at=now()
  WHERE id=v_checkout;

  RETURN v_checkout;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_checkout_criar(text,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_checkout_criar(text,uuid,text) TO authenticated;

-- =========================================================
-- SALVAR RASCUNHO
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_checkout_salvar_rascunho(
  p_checkout_id uuid,
  p_nome text,
  p_descricao text,
  p_config jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_checkout public.checkouts%ROWTYPE;
  v_version uuid;
  v_next integer;
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.fn_is_admin_global()
     AND NOT public.fn_tem_permissao('produtos','checkouts','update'::public.tipo_operacao) THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;
  PERFORM public.fn_checkout_config_validar(p_config);
  IF trim(coalesce(p_nome,''))='' THEN RAISE EXCEPTION 'checkout_name_required'; END IF;

  SELECT * INTO v_checkout
  FROM public.checkouts
  WHERE id=p_checkout_id AND empresa_id=v_empresa AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'checkout_not_found'; END IF;

  IF v_checkout.rascunho_versao_id IS NOT NULL THEN
    UPDATE public.checkout_versions
    SET config=p_config
    WHERE id=v_checkout.rascunho_versao_id
      AND checkout_id=p_checkout_id
      AND empresa_id=v_empresa
      AND estado='rascunho'
    RETURNING id INTO v_version;
  END IF;

  IF v_version IS NULL THEN
    SELECT coalesce(max(versao),0)+1 INTO v_next
    FROM public.checkout_versions WHERE checkout_id=p_checkout_id;

    INSERT INTO public.checkout_versions(
      checkout_id,empresa_id,versao,estado,config,criado_por
    ) VALUES (
      p_checkout_id,v_empresa,v_next,'rascunho',p_config,auth.uid()
    ) RETURNING id INTO v_version;
  END IF;

  UPDATE public.checkouts
  SET nome=trim(p_nome),
      descricao=nullif(trim(coalesce(p_descricao,'')),''),
      rascunho_versao_id=v_version,
      updated_at=now()
  WHERE id=p_checkout_id;

  RETURN v_version;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_checkout_salvar_rascunho(uuid,text,text,jsonb)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_checkout_salvar_rascunho(uuid,text,text,jsonb)
TO authenticated;

-- =========================================================
-- ORDER BUMP DE RASCUNHO
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_checkout_bump_salvar(
  p_checkout_id uuid,
  p_id uuid,
  p_produto_id uuid,
  p_titulo text,
  p_descricao text DEFAULT NULL,
  p_imagem_url text DEFAULT NULL,
  p_texto_oferta text DEFAULT NULL,
  p_tipo_preco text DEFAULT 'produto',
  p_preco_fixo numeric DEFAULT NULL,
  p_desconto_percentual numeric DEFAULT NULL,
  p_ordem integer DEFAULT 0,
  p_ativo boolean DEFAULT true,
  p_grupo_combinacao text DEFAULT NULL,
  p_max_selecao_grupo integer DEFAULT NULL
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
  IF auth.uid() IS NULL OR v_empresa IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.fn_is_admin_global()
     AND NOT public.fn_tem_permissao('produtos','checkouts','update'::public.tipo_operacao) THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.checkouts
    WHERE id=p_checkout_id AND empresa_id=v_empresa AND deleted_at IS NULL
  ) THEN RAISE EXCEPTION 'checkout_not_found'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.produtos
    WHERE id=p_produto_id AND empresa_id=v_empresa AND deleted_at IS NULL
  ) THEN RAISE EXCEPTION 'bump_product_not_found'; END IF;

  IF p_tipo_preco NOT IN ('produto','preco_fixo','desconto_percentual') THEN
    RAISE EXCEPTION 'invalid_bump_price_type';
  END IF;
  IF p_tipo_preco='preco_fixo' AND (p_preco_fixo IS NULL OR p_preco_fixo<0) THEN
    RAISE EXCEPTION 'invalid_bump_fixed_price';
  END IF;
  IF p_tipo_preco='desconto_percentual'
     AND (p_desconto_percentual IS NULL OR p_desconto_percentual<0 OR p_desconto_percentual>100) THEN
    RAISE EXCEPTION 'invalid_bump_discount';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.checkout_order_bumps(
      empresa_id,checkout_id,produto_id,criado_por,titulo,descricao,imagem_url,
      texto_oferta,tipo_preco,preco_fixo,desconto_percentual,ordem,ativo,
      grupo_combinacao,max_selecao_grupo
    ) VALUES (
      v_empresa,p_checkout_id,p_produto_id,auth.uid(),
      nullif(trim(coalesce(p_titulo,'')),''),
      nullif(trim(coalesce(p_descricao,'')),''),
      nullif(trim(coalesce(p_imagem_url,'')),''),
      nullif(trim(coalesce(p_texto_oferta,'')),''),
      p_tipo_preco,p_preco_fixo,p_desconto_percentual,coalesce(p_ordem,0),p_ativo,
      nullif(trim(coalesce(p_grupo_combinacao,'')),''),
      p_max_selecao_grupo
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.checkout_order_bumps
    SET produto_id=p_produto_id,
        titulo=nullif(trim(coalesce(p_titulo,'')),''),
        descricao=nullif(trim(coalesce(p_descricao,'')),''),
        imagem_url=nullif(trim(coalesce(p_imagem_url,'')),''),
        texto_oferta=nullif(trim(coalesce(p_texto_oferta,'')),''),
        tipo_preco=p_tipo_preco,
        preco_fixo=p_preco_fixo,
        desconto_percentual=p_desconto_percentual,
        ordem=coalesce(p_ordem,0),
        ativo=p_ativo,
        grupo_combinacao=nullif(trim(coalesce(p_grupo_combinacao,'')),''),
        max_selecao_grupo=p_max_selecao_grupo,
        updated_at=now()
    WHERE id=p_id AND checkout_id=p_checkout_id
      AND empresa_id=v_empresa AND deleted_at IS NULL
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'order_bump_not_found'; END IF;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_checkout_bump_salvar(
  uuid,uuid,uuid,text,text,text,text,text,numeric,numeric,integer,boolean,text,integer
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_checkout_bump_salvar(
  uuid,uuid,uuid,text,text,text,text,text,numeric,numeric,integer,boolean,text,integer
) TO authenticated;

-- =========================================================
-- PUBLICAR: copia rascunho e bumps para snapshot imutável
-- =========================================================
DROP FUNCTION IF EXISTS public.fn_checkout_publicar(uuid);
CREATE OR REPLACE FUNCTION public.fn_checkout_publicar(p_checkout_id uuid)
RETURNS TABLE(version_id uuid, public_token uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_checkout public.checkouts%ROWTYPE;
  v_draft public.checkout_versions%ROWTYPE;
  v_offer public.ofertas%ROWTYPE;
  v_product public.produtos%ROWTYPE;
  v_new uuid;
  v_next integer;
  v_bump record;
  v_price numeric(15,2);
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.fn_is_admin_global()
     AND NOT public.fn_tem_permissao('produtos','checkouts','update'::public.tipo_operacao) THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  SELECT * INTO v_checkout
  FROM public.checkouts
  WHERE id=p_checkout_id AND empresa_id=v_empresa AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'checkout_not_found'; END IF;
  IF v_checkout.rascunho_versao_id IS NULL THEN RAISE EXCEPTION 'checkout_draft_missing'; END IF;

  SELECT * INTO v_draft
  FROM public.checkout_versions
  WHERE id=v_checkout.rascunho_versao_id
    AND checkout_id=p_checkout_id AND empresa_id=v_empresa AND estado='rascunho'
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'checkout_draft_missing'; END IF;
  PERFORM public.fn_checkout_config_validar(v_draft.config);

  SELECT * INTO v_offer
  FROM public.ofertas
  WHERE id=v_checkout.oferta_id
    AND empresa_id=v_empresa
    AND status='ativa'
    AND deleted_at IS NULL
    AND (vigencia_inicio IS NULL OR vigencia_inicio<=now())
    AND (vigencia_fim IS NULL OR vigencia_fim>now());
  IF NOT FOUND THEN RAISE EXCEPTION 'active_offer_required'; END IF;

  SELECT * INTO v_product
  FROM public.produtos
  WHERE id=v_offer.produto_id
    AND empresa_id=v_empresa
    AND status='publicado'
    AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'published_product_required'; END IF;

  SELECT coalesce(max(versao),0)+1 INTO v_next
  FROM public.checkout_versions WHERE checkout_id=p_checkout_id;

  IF v_checkout.publicado_versao_id IS NOT NULL THEN
    UPDATE public.checkout_versions
    SET estado='substituido'
    WHERE id=v_checkout.publicado_versao_id AND estado='publicado';
  END IF;

  INSERT INTO public.checkout_versions(
    checkout_id,empresa_id,versao,estado,config,criado_por,publicado_por,publicado_em
  ) VALUES (
    p_checkout_id,v_empresa,v_next,'publicado',v_draft.config,
    auth.uid(),auth.uid(),now()
  ) RETURNING id INTO v_new;

  FOR v_bump IN
    SELECT b.*,p AS product_row
    FROM public.checkout_order_bumps b
    JOIN public.produtos p ON p.id=b.produto_id
    WHERE b.checkout_id=p_checkout_id
      AND b.empresa_id=v_empresa
      AND b.ativo
      AND b.deleted_at IS NULL
      AND p.empresa_id=v_empresa
      AND p.status='publicado'
      AND p.deleted_at IS NULL
    ORDER BY b.ordem,b.created_at
  LOOP
    IF v_bump.tipo_preco='preco_fixo' THEN
      v_price:=round(coalesce(v_bump.preco_fixo,0),2);
    ELSIF v_bump.tipo_preco='desconto_percentual' THEN
      v_price:=round(
        public.fn_preco_produto_atual(v_bump.product_row)
        * (1-coalesce(v_bump.desconto_percentual,0)/100.0),2
      );
    ELSE
      v_price:=public.fn_preco_produto_atual(v_bump.product_row);
    END IF;

    INSERT INTO public.checkout_version_order_bumps(
      checkout_version_id,checkout_id,empresa_id,source_order_bump_id,produto_id,
      titulo_snapshot,descricao_snapshot,imagem_snapshot,texto_oferta_snapshot,
      preco_publicado_snapshot,regra_preco_snapshot,ordem,
      grupo_combinacao,max_selecao_grupo
    ) VALUES (
      v_new,p_checkout_id,v_empresa,v_bump.id,v_bump.produto_id,
      coalesce(nullif(v_bump.titulo,''),(v_bump.product_row).nome),
      coalesce(v_bump.descricao,(v_bump.product_row).descricao_curta),
      coalesce(v_bump.imagem_url,(v_bump.product_row).imagem_principal_url),
      v_bump.texto_oferta,
      greatest(v_price,0),
      jsonb_build_object(
        'tipo',v_bump.tipo_preco,
        'preco_fixo',v_bump.preco_fixo,
        'desconto_percentual',v_bump.desconto_percentual,
        'preco_produto_no_publish',public.fn_preco_produto_atual(v_bump.product_row)
      ),
      v_bump.ordem,v_bump.grupo_combinacao,v_bump.max_selecao_grupo
    );
  END LOOP;

  UPDATE public.checkouts
  SET status='publicado'::public.status_checkout,
      publicado_versao_id=v_new,
      publicacao_data=now(),
      desativado_em=NULL,
      updated_at=now()
  WHERE id=p_checkout_id;

  INSERT INTO public.seguranca_audit_log(
    empresa_id,profile_id,acao,modulo,entidade,entidade_id,descricao,detalhes
  ) VALUES (
    v_empresa,auth.uid(),'checkout_publicado','produtos','checkout',p_checkout_id,
    'Checkout publicado',
    jsonb_build_object('version_id',v_new,'public_token',v_checkout.public_token)
  );

  RETURN QUERY SELECT v_new,v_checkout.public_token;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_checkout_publicar(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_checkout_publicar(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_checkout_despublicar(p_checkout_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v_empresa uuid:=public.current_empresa_id();
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.fn_is_admin_global()
     AND NOT public.fn_tem_permissao('produtos','checkouts','update'::public.tipo_operacao) THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  UPDATE public.checkouts
  SET status='rascunho'::public.status_checkout,
      desativado_em=now(),updated_at=now()
  WHERE id=p_checkout_id AND empresa_id=v_empresa
    AND deleted_at IS NULL AND status='publicado'::public.status_checkout;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_checkout_despublicar(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_checkout_despublicar(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_checkout_restaurar_publicado(p_checkout_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_checkout public.checkouts%ROWTYPE;
  v_pub public.checkout_versions%ROWTYPE;
  v_draft uuid;
  v_next integer;
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.fn_is_admin_global()
     AND NOT public.fn_tem_permissao('produtos','checkouts','update'::public.tipo_operacao) THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  SELECT * INTO v_checkout FROM public.checkouts
  WHERE id=p_checkout_id AND empresa_id=v_empresa AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND OR v_checkout.publicado_versao_id IS NULL THEN
    RAISE EXCEPTION 'published_version_missing';
  END IF;

  SELECT * INTO v_pub FROM public.checkout_versions
  WHERE id=v_checkout.publicado_versao_id AND checkout_id=p_checkout_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'published_version_missing'; END IF;

  IF v_checkout.rascunho_versao_id IS NOT NULL THEN
    UPDATE public.checkout_versions
    SET config=v_pub.config
    WHERE id=v_checkout.rascunho_versao_id AND estado='rascunho'
    RETURNING id INTO v_draft;
  END IF;

  IF v_draft IS NULL THEN
    SELECT coalesce(max(versao),0)+1 INTO v_next
    FROM public.checkout_versions WHERE checkout_id=p_checkout_id;
    INSERT INTO public.checkout_versions(
      checkout_id,empresa_id,versao,estado,config,criado_por
    ) VALUES (
      p_checkout_id,v_empresa,v_next,'rascunho',v_pub.config,auth.uid()
    ) RETURNING id INTO v_draft;
    UPDATE public.checkouts SET rascunho_versao_id=v_draft,updated_at=now()
    WHERE id=p_checkout_id;
  END IF;

  -- restaura também os bumps no rascunho sem tocar na versão publicada
  UPDATE public.checkout_order_bumps
  SET ativo=false,updated_at=now()
  WHERE checkout_id=p_checkout_id AND empresa_id=v_empresa AND deleted_at IS NULL;

  INSERT INTO public.checkout_order_bumps(
    empresa_id,checkout_id,produto_id,criado_por,titulo,descricao,imagem_url,
    texto_oferta,tipo_preco,preco_fixo,desconto_percentual,ordem,ativo,
    grupo_combinacao,max_selecao_grupo,metadata
  )
  SELECT
    v_empresa,p_checkout_id,vb.produto_id,auth.uid(),
    vb.titulo_snapshot,vb.descricao_snapshot,vb.imagem_snapshot,
    vb.texto_oferta_snapshot,
    coalesce(vb.regra_preco_snapshot->>'tipo','preco_fixo'),
    CASE
      WHEN vb.regra_preco_snapshot->>'tipo'='preco_fixo'
      THEN nullif(vb.regra_preco_snapshot->>'preco_fixo','')::numeric
      ELSE vb.preco_publicado_snapshot
    END,
    nullif(vb.regra_preco_snapshot->>'desconto_percentual','')::numeric,
    vb.ordem,true,vb.grupo_combinacao,vb.max_selecao_grupo,
    jsonb_build_object('restaurado_de_version_id',v_pub.id)
  FROM public.checkout_version_order_bumps vb
  WHERE vb.checkout_version_id=v_pub.id
  ORDER BY vb.ordem,vb.created_at;

  RETURN v_draft;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_checkout_restaurar_publicado(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_checkout_restaurar_publicado(uuid) TO authenticated;
