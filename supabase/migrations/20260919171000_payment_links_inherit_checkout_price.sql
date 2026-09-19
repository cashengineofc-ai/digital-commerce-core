-- Payment links are Pix-only entrypoints that inherit their monetary value
-- from the published checkout/offer. A payment link must not introduce a
-- second editable price source.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_link_pagamento_criar(
  p_checkout_id uuid,
  p_titulo text,
  p_descricao text DEFAULT NULL::text,
  p_uso_unico boolean DEFAULT false,
  p_max_usos integer DEFAULT NULL::integer,
  p_expira_em timestamptz DEFAULT NULL::timestamptz,
  p_permitir_editar_valor boolean DEFAULT false,
  p_valor numeric DEFAULT NULL::numeric,
  p_idempotency_key uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_checkout public.checkouts%ROWTYPE;
  v_offer public.ofertas%ROWTYPE;
  v_id uuid;
  v_code text;
  v_max integer;
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT public.fn_is_admin_global()
     AND NOT public.fn_tem_permissao('vendas','links','create'::public.tipo_operacao) THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  IF trim(coalesce(p_titulo,''))='' THEN
    RAISE EXCEPTION 'payment_link_title_required';
  END IF;

  IF p_expira_em IS NOT NULL AND p_expira_em<=now() THEN
    RAISE EXCEPTION 'payment_link_expiration_invalid';
  END IF;

  SELECT * INTO v_checkout
  FROM public.checkouts
  WHERE id=p_checkout_id
    AND empresa_id=v_empresa
    AND status='publicado'
    AND publicado_versao_id IS NOT NULL
    AND deleted_at IS NULL
    AND desativado_em IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'published_checkout_required';
  END IF;

  SELECT * INTO v_offer
  FROM public.ofertas
  WHERE id=v_checkout.oferta_id
    AND empresa_id=v_empresa
    AND status='ativa'
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'active_offer_required';
  END IF;

  IF coalesce(v_offer.preco,0) <= 0 THEN
    RAISE EXCEPTION 'invalid_checkout_amount';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_id
    FROM public.links_pagamento
    WHERE empresa_id=v_empresa
      AND idempotency_key=p_idempotency_key
    LIMIT 1;
    IF FOUND THEN RETURN v_id; END IF;
  END IF;

  v_max:=CASE
    WHEN p_uso_unico THEN 1
    WHEN p_max_usos IS NULL THEN NULL
    ELSE greatest(p_max_usos,1)
  END;

  v_code:='PAY-'||upper(encode(gen_random_bytes(12),'hex'));

  INSERT INTO public.links_pagamento(
    empresa_id,criado_por,checkout_id,produto_id,oferta_id,
    titulo,descricao,codigo_unico,public_token,valor,moeda,status,
    max_usos,contador_usos,uso_unico,permite_editar_valor,data_expiracao,
    idempotency_key,metadata
  ) VALUES (
    v_empresa,auth.uid(),v_checkout.id,v_offer.produto_id,v_offer.id,
    trim(p_titulo),nullif(trim(coalesce(p_descricao,'')),''),
    v_code,gen_random_uuid(),
    round(v_offer.preco,2),coalesce(v_offer.moeda,'BRL'),'ativo',
    v_max,0,p_uso_unico,false,p_expira_em,
    p_idempotency_key,
    jsonb_build_object(
      'source','published_checkout_pix',
      'price_source','checkout_offer',
      'offer_price_at_creation',v_offer.preco,
      'payment_method','pix'
    )
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_link_pagamento_criar(
  uuid,text,text,boolean,integer,timestamptz,boolean,numeric,uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_link_pagamento_criar(
  uuid,text,text,boolean,integer,timestamptz,boolean,numeric,uuid
) TO authenticated, service_role;

COMMIT;
