-- Cash Engine PRO — gestão real de ofertas
ALTER TABLE public.ofertas
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ofertas_empresa_idempotency
ON public.ofertas(empresa_id,idempotency_key)
WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_oferta_salvar(
  p_id uuid DEFAULT NULL,
  p_produto_id uuid DEFAULT NULL,
  p_nome text DEFAULT NULL,
  p_descricao text DEFAULT NULL,
  p_preco numeric DEFAULT 0,
  p_preco_comparacao numeric DEFAULT NULL,
  p_status text DEFAULT 'rascunho',
  p_vigencia_inicio timestamptz DEFAULT NULL,
  p_vigencia_fim timestamptz DEFAULT NULL,
  p_permitir_valor_personalizado boolean DEFAULT false,
  p_valor_minimo numeric DEFAULT NULL,
  p_valor_maximo numeric DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL
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
     AND NOT public.fn_tem_permissao('produtos','produtos',
       CASE WHEN p_id IS NULL THEN 'create'::public.tipo_operacao ELSE 'update'::public.tipo_operacao END
     ) THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  IF p_produto_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.produtos
    WHERE id=p_produto_id AND empresa_id=v_empresa AND deleted_at IS NULL
  ) THEN RAISE EXCEPTION 'product_not_found'; END IF;

  IF trim(coalesce(p_nome,''))='' THEN RAISE EXCEPTION 'offer_name_required'; END IF;
  IF coalesce(p_preco,0)<0 THEN RAISE EXCEPTION 'invalid_offer_price'; END IF;
  IF p_preco_comparacao IS NOT NULL AND p_preco_comparacao<0 THEN
    RAISE EXCEPTION 'invalid_offer_compare_price';
  END IF;
  IF p_status NOT IN ('rascunho','ativa','pausada','arquivada') THEN
    RAISE EXCEPTION 'invalid_offer_status';
  END IF;
  IF p_vigencia_fim IS NOT NULL AND p_vigencia_inicio IS NOT NULL
     AND p_vigencia_fim<=p_vigencia_inicio THEN
    RAISE EXCEPTION 'invalid_offer_period';
  END IF;
  IF p_valor_minimo IS NOT NULL AND p_valor_minimo<0 THEN RAISE EXCEPTION 'invalid_minimum'; END IF;
  IF p_valor_maximo IS NOT NULL AND p_valor_maximo<0 THEN RAISE EXCEPTION 'invalid_maximum'; END IF;
  IF p_valor_minimo IS NOT NULL AND p_valor_maximo IS NOT NULL
     AND p_valor_maximo<p_valor_minimo THEN RAISE EXCEPTION 'invalid_custom_amount_range'; END IF;

  IF p_id IS NULL AND p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_id
    FROM public.ofertas
    WHERE empresa_id=v_empresa AND idempotency_key=p_idempotency_key
    LIMIT 1;
    IF FOUND THEN RETURN v_id; END IF;
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.ofertas(
      empresa_id,produto_id,criado_por,nome,descricao,preco,preco_comparacao,
      status,vigencia_inicio,vigencia_fim,permitir_valor_personalizado,
      valor_minimo,valor_maximo,idempotency_key
    ) VALUES (
      v_empresa,p_produto_id,auth.uid(),trim(p_nome),
      nullif(trim(coalesce(p_descricao,'')),''),
      round(coalesce(p_preco,0),2),
      CASE WHEN p_preco_comparacao IS NULL THEN NULL ELSE round(p_preco_comparacao,2) END,
      p_status,p_vigencia_inicio,p_vigencia_fim,coalesce(p_permitir_valor_personalizado,false),
      p_valor_minimo,p_valor_maximo,p_idempotency_key
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.ofertas
    SET produto_id=p_produto_id,
        nome=trim(p_nome),
        descricao=nullif(trim(coalesce(p_descricao,'')),''),
        preco=round(coalesce(p_preco,0),2),
        preco_comparacao=CASE WHEN p_preco_comparacao IS NULL THEN NULL ELSE round(p_preco_comparacao,2) END,
        status=p_status,
        vigencia_inicio=p_vigencia_inicio,
        vigencia_fim=p_vigencia_fim,
        permitir_valor_personalizado=coalesce(p_permitir_valor_personalizado,false),
        valor_minimo=p_valor_minimo,
        valor_maximo=p_valor_maximo,
        updated_at=now()
    WHERE id=p_id AND empresa_id=v_empresa AND deleted_at IS NULL
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'offer_not_found'; END IF;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_oferta_salvar(
  uuid,uuid,text,text,numeric,numeric,text,timestamptz,timestamptz,boolean,numeric,numeric,uuid
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_oferta_salvar(
  uuid,uuid,text,text,numeric,numeric,text,timestamptz,timestamptz,boolean,numeric,numeric,uuid
) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_ofertas_listar(
  p_busca text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  produto_id uuid,
  produto_nome text,
  nome text,
  descricao text,
  preco numeric,
  preco_comparacao numeric,
  status text,
  checkouts bigint,
  pedidos_confirmados bigint,
  faturamento_bruto numeric,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
  SELECT
    o.id,o.produto_id,p.nome::text,o.nome::text,o.descricao,
    o.preco,o.preco_comparacao,o.status::text,
    (
      SELECT count(*) FROM public.checkouts c
      WHERE c.oferta_id=o.id AND c.deleted_at IS NULL
    ),
    (
      SELECT count(*) FROM public.pedidos pd
      WHERE pd.oferta_id=o.id
        AND pd.status_pagamento IN ('confirmado','reembolsado_parcial','reembolsado_total')
    ),
    coalesce((
      SELECT sum(pd.valor_total)
      FROM public.pedidos pd
      WHERE pd.oferta_id=o.id
        AND pd.status_pagamento IN ('confirmado','reembolsado_parcial','reembolsado_total')
    ),0),
    o.updated_at
  FROM public.ofertas o
  JOIN public.produtos p ON p.id=o.produto_id
  WHERE o.empresa_id=public.current_empresa_id()
    AND o.deleted_at IS NULL
    AND (coalesce(trim(p_status),'')='' OR o.status=p_status)
    AND (
      coalesce(trim(p_busca),'')=''
      OR o.nome ILIKE '%'||trim(p_busca)||'%'
      OR p.nome ILIKE '%'||trim(p_busca)||'%'
      OR o.id::text ILIKE '%'||trim(p_busca)||'%'
    )
  ORDER BY o.updated_at DESC
  LIMIT greatest(1,least(coalesce(p_limit,100),200))
  OFFSET greatest(coalesce(p_offset,0),0);
$$;

REVOKE ALL ON FUNCTION public.fn_ofertas_listar(text,text,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_ofertas_listar(text,text,integer,integer) TO authenticated;
