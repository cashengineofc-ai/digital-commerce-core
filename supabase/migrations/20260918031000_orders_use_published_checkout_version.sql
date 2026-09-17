-- Cash Engine PRO — pedido usa exclusivamente os bumps da versão publicada
CREATE OR REPLACE FUNCTION public.fn_checkout_criar_pedido_pix(
  p_empresa_id uuid,
  p_cliente_id uuid,
  p_checkout_id uuid,
  p_link_pagamento_id uuid,
  p_idempotency_key uuid,
  p_valor_solicitado numeric DEFAULT NULL,
  p_order_bump_ids uuid[] DEFAULT '{}'::uuid[],
  p_afiliado_id uuid DEFAULT NULL,
  p_link_afiliado_id uuid DEFAULT NULL,
  p_provedor text DEFAULT 'pix_chave'
)
RETURNS TABLE(pedido_id uuid, transacao_id uuid, numero_pedido text, valor_total numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_checkout public.checkouts%ROWTYPE;
  v_offer public.ofertas%ROWTYPE;
  v_product public.produtos%ROWTYPE;
  v_link public.links_pagamento%ROWTYPE;
  v_customer public.clientes%ROWTYPE;
  v_existing public.pedidos%ROWTYPE;
  v_pedido_id uuid;
  v_tx_id uuid;
  v_numero text;
  v_base numeric(15,2);
  v_bumps numeric(15,2) := 0;
  v_total numeric(15,2);
  v_item_id uuid;
  v_bump record;
  v_group record;
  v_commission_rate numeric(7,4);
  v_commission_fixed numeric(15,2);
  v_commission_value numeric(15,2);
BEGIN
  IF p_empresa_id IS NULL OR p_cliente_id IS NULL
     OR p_checkout_id IS NULL OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'checkout_order_invalid_input';
  END IF;
  IF p_provedor NOT IN ('pix_chave','mercadopago') THEN
    RAISE EXCEPTION 'payment_provider_invalid';
  END IF;

  SELECT * INTO v_existing
  FROM public.pedidos
  WHERE empresa_id=p_empresa_id AND idempotency_key=p_idempotency_key
  LIMIT 1;

  IF FOUND THEN
    SELECT id INTO v_tx_id
    FROM public.transacoes
    WHERE pedido_id=v_existing.id
    ORDER BY created_at LIMIT 1;
    RETURN QUERY SELECT v_existing.id,v_tx_id,v_existing.numero::text,v_existing.valor_total;
    RETURN;
  END IF;

  SELECT * INTO v_checkout
  FROM public.checkouts
  WHERE id=p_checkout_id
    AND empresa_id=p_empresa_id
    AND status='publicado'
    AND publicado_versao_id IS NOT NULL
    AND desativado_em IS NULL
    AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'checkout_unavailable'; END IF;

  SELECT * INTO v_offer
  FROM public.ofertas
  WHERE id=coalesce(
      (SELECT oferta_id FROM public.links_pagamento WHERE id=p_link_pagamento_id),
      v_checkout.oferta_id
    )
    AND empresa_id=p_empresa_id
    AND status='ativa'
    AND deleted_at IS NULL
    AND (vigencia_inicio IS NULL OR vigencia_inicio<=now())
    AND (vigencia_fim IS NULL OR vigencia_fim>now())
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'offer_unavailable'; END IF;

  IF p_link_pagamento_id IS NOT NULL THEN
    SELECT * INTO v_link
    FROM public.links_pagamento
    WHERE id=p_link_pagamento_id
      AND empresa_id=p_empresa_id
      AND checkout_id=p_checkout_id
      AND status='ativo'
      AND deleted_at IS NULL
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'payment_link_unavailable'; END IF;
    IF v_link.data_expiracao IS NOT NULL AND v_link.data_expiracao<=now() THEN
      RAISE EXCEPTION 'payment_link_expired';
    END IF;
    IF v_link.max_usos IS NOT NULL
       AND coalesce(v_link.contador_usos,0)>=v_link.max_usos THEN
      RAISE EXCEPTION 'payment_link_limit_reached';
    END IF;
  END IF;

  SELECT * INTO v_product
  FROM public.produtos
  WHERE id=v_offer.produto_id
    AND empresa_id=p_empresa_id
    AND status='publicado'
    AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'product_unavailable'; END IF;

  IF coalesce(v_product.gerencia_estoque,false)
     AND (coalesce(v_product.estoque,0)-coalesce(v_product.estoque_reservado,0))<1 THEN
    RAISE EXCEPTION 'product_out_of_stock';
  END IF;

  SELECT * INTO v_customer
  FROM public.clientes
  WHERE id=p_cliente_id AND empresa_id=p_empresa_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'customer_not_found'; END IF;

  v_base:=round(v_offer.preco,2);
  IF p_link_pagamento_id IS NOT NULL
     AND NOT coalesce(v_link.permite_editar_valor,false)
     AND coalesce(v_link.valor,0)>0 THEN
    v_base:=round(v_link.valor,2);
  ELSIF (
      v_offer.permitir_valor_personalizado
      OR (p_link_pagamento_id IS NOT NULL AND coalesce(v_link.permite_editar_valor,false))
    )
    AND p_valor_solicitado IS NOT NULL THEN
    v_base:=round(p_valor_solicitado,2);
    IF v_base<=0 THEN RAISE EXCEPTION 'invalid_checkout_amount'; END IF;
    IF v_offer.valor_minimo IS NOT NULL AND v_base<v_offer.valor_minimo THEN
      RAISE EXCEPTION 'amount_below_minimum';
    END IF;
    IF v_offer.valor_maximo IS NOT NULL AND v_base>v_offer.valor_maximo THEN
      RAISE EXCEPTION 'amount_above_maximum';
    END IF;
  END IF;

  IF cardinality(p_order_bump_ids) <> (
    SELECT count(DISTINCT x) FROM unnest(p_order_bump_ids) x
  ) THEN
    RAISE EXCEPTION 'duplicate_order_bump';
  END IF;

  -- Todos os IDs pertencem exatamente à versão publicada e os produtos ainda existem.
  IF cardinality(p_order_bump_ids) <> (
    SELECT count(*)
    FROM public.checkout_version_order_bumps vb
    JOIN public.produtos p ON p.id=vb.produto_id
    WHERE vb.id=ANY(p_order_bump_ids)
      AND vb.checkout_version_id=v_checkout.publicado_versao_id
      AND vb.checkout_id=p_checkout_id
      AND vb.empresa_id=p_empresa_id
      AND p.empresa_id=p_empresa_id
      AND p.status='publicado'
      AND p.deleted_at IS NULL
      AND (
        NOT coalesce(p.gerencia_estoque,false)
        OR (coalesce(p.estoque,0)-coalesce(p.estoque_reservado,0))>0
      )
  ) THEN
    RAISE EXCEPTION 'invalid_order_bumps';
  END IF;

  FOR v_group IN
    SELECT vb.grupo_combinacao,
           max(coalesce(vb.max_selecao_grupo,1)) AS max_sel,
           count(*) AS qty
    FROM public.checkout_version_order_bumps vb
    WHERE vb.id=ANY(p_order_bump_ids)
      AND vb.checkout_version_id=v_checkout.publicado_versao_id
      AND vb.grupo_combinacao IS NOT NULL
    GROUP BY vb.grupo_combinacao
  LOOP
    IF v_group.qty>v_group.max_sel THEN
      RAISE EXCEPTION 'order_bump_combination_not_allowed';
    END IF;
  END LOOP;

  SELECT coalesce(sum(vb.preco_publicado_snapshot),0)
  INTO v_bumps
  FROM public.checkout_version_order_bumps vb
  WHERE vb.id=ANY(p_order_bump_ids)
    AND vb.checkout_version_id=v_checkout.publicado_versao_id;

  v_total:=round(v_base+v_bumps,2);
  IF v_total<=0 THEN RAISE EXCEPTION 'invalid_checkout_amount'; END IF;

  v_numero:='CE-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));

  INSERT INTO public.pedidos(
    empresa_id,numero,cliente_id,afiliado_id,link_afiliado_id,
    checkout_id,checkout_versao_id,oferta_id,link_pagamento_id,
    idempotency_key,status,status_pagamento,metodo_pagamento,
    comprador_nome,comprador_email,comprador_documento,
    subtotal,valor_total,moeda,metadata
  ) VALUES (
    p_empresa_id,v_numero,p_cliente_id,p_afiliado_id,p_link_afiliado_id,
    p_checkout_id,v_checkout.publicado_versao_id,v_offer.id,p_link_pagamento_id,
    p_idempotency_key,'aguardando_pagamento','pendente','pix',
    v_customer.nome_completo,v_customer.email,v_customer.cpf,
    v_total,v_total,coalesce(v_offer.moeda,'BRL'),
    jsonb_build_object(
      'base_amount',v_base,
      'order_bumps_amount',v_bumps,
      'checkout_version_id',v_checkout.publicado_versao_id
    )
  ) RETURNING id INTO v_pedido_id;

  -- item principal + snapshot de comissão
  v_commission_rate:=0;
  v_commission_fixed:=NULL;
  v_commission_value:=0;

  IF p_afiliado_id IS NOT NULL THEN
    SELECT
      coalesce(ap.taxa_comissao_personalizada,v_product.taxa_comissao_afiliado,a.taxa_comissao_padrao,0),
      coalesce(ap.comissao_valor_fixo,v_product.comissao_valor_fixo)
    INTO v_commission_rate,v_commission_fixed
    FROM public.afiliados a
    LEFT JOIN public.afiliados_produtos ap
      ON ap.afiliado_id=a.id
      AND ap.produto_id=v_product.id
      AND ap.empresa_id=p_empresa_id
      AND ap.ativo
      AND (ap.data_inicio IS NULL OR ap.data_inicio<=now())
      AND (ap.data_fim IS NULL OR ap.data_fim>now())
    WHERE a.id=p_afiliado_id
      AND a.empresa_id=p_empresa_id
      AND a.status='ativo'
      AND a.deleted_at IS NULL;

    IF FOUND THEN
      IF v_commission_fixed IS NOT NULL THEN
        v_commission_value:=least(greatest(v_commission_fixed,0),v_base);
      ELSE
        v_commission_value:=round(v_base*greatest(v_commission_rate,0)/100.0,2);
      END IF;
    END IF;
  END IF;

  INSERT INTO public.pedido_itens(
    pedido_id,empresa_id,produto_id,oferta_id,tipo_item,
    nome_snapshot,descricao_snapshot,imagem_snapshot,
    preco_unitario_snapshot,total_snapshot,
    comissao_percentual_snapshot,comissao_valor_snapshot,
    regra_comissao_snapshot,regra_preco_snapshot
  ) VALUES (
    v_pedido_id,p_empresa_id,v_product.id,v_offer.id,'principal',
    v_product.nome,v_product.descricao_curta,v_product.imagem_principal_url,
    v_base,v_base,coalesce(v_commission_rate,0),v_commission_value,
    jsonb_build_object('fixa',v_commission_fixed,'percentual',coalesce(v_commission_rate,0)),
    jsonb_build_object('oferta_id',v_offer.id,'preco_oferta',v_offer.preco)
  ) RETURNING id INTO v_item_id;

  IF coalesce(v_product.gerencia_estoque,false) THEN
    UPDATE public.produtos
    SET estoque_reservado=estoque_reservado+1,updated_at=now()
    WHERE id=v_product.id;
    INSERT INTO public.pedido_estoque_reservas(
      pedido_id,pedido_item_id,empresa_id,produto_id,quantidade
    ) VALUES (v_pedido_id,v_item_id,p_empresa_id,v_product.id,1);
  END IF;

  -- bumps da publicação
  FOR v_bump IN
    SELECT vb.*,p AS product_row
    FROM public.checkout_version_order_bumps vb
    JOIN public.produtos p ON p.id=vb.produto_id
    WHERE vb.id=ANY(p_order_bump_ids)
      AND vb.checkout_version_id=v_checkout.publicado_versao_id
    ORDER BY vb.ordem,vb.created_at
  LOOP
    v_commission_rate:=0;
    v_commission_fixed:=NULL;
    v_commission_value:=0;

    IF p_afiliado_id IS NOT NULL THEN
      SELECT
        coalesce(ap.taxa_comissao_personalizada,(v_bump.product_row).taxa_comissao_afiliado,a.taxa_comissao_padrao,0),
        coalesce(ap.comissao_valor_fixo,(v_bump.product_row).comissao_valor_fixo)
      INTO v_commission_rate,v_commission_fixed
      FROM public.afiliados a
      JOIN public.afiliados_produtos ap
        ON ap.afiliado_id=a.id
        AND ap.produto_id=v_bump.produto_id
        AND ap.empresa_id=p_empresa_id
        AND ap.ativo
        AND (ap.data_inicio IS NULL OR ap.data_inicio<=now())
        AND (ap.data_fim IS NULL OR ap.data_fim>now())
      WHERE a.id=p_afiliado_id
        AND a.empresa_id=p_empresa_id
        AND a.status='ativo'
        AND a.deleted_at IS NULL;

      IF FOUND THEN
        IF v_commission_fixed IS NOT NULL THEN
          v_commission_value:=least(
            greatest(v_commission_fixed,0),
            v_bump.preco_publicado_snapshot
          );
        ELSE
          v_commission_value:=round(
            v_bump.preco_publicado_snapshot*greatest(v_commission_rate,0)/100.0,2
          );
        END IF;
      END IF;
    END IF;

    INSERT INTO public.pedido_itens(
      pedido_id,empresa_id,produto_id,order_bump_id,tipo_item,
      nome_snapshot,descricao_snapshot,imagem_snapshot,
      preco_unitario_snapshot,total_snapshot,
      comissao_percentual_snapshot,comissao_valor_snapshot,
      regra_comissao_snapshot,regra_preco_snapshot
    ) VALUES (
      v_pedido_id,p_empresa_id,v_bump.produto_id,v_bump.source_order_bump_id,'order_bump',
      v_bump.titulo_snapshot,v_bump.descricao_snapshot,v_bump.imagem_snapshot,
      v_bump.preco_publicado_snapshot,v_bump.preco_publicado_snapshot,
      coalesce(v_commission_rate,0),v_commission_value,
      jsonb_build_object(
        'fixa',v_commission_fixed,'percentual',coalesce(v_commission_rate,0)
      ),
      v_bump.regra_preco_snapshot
        || jsonb_build_object('published_bump_version_id',v_bump.id)
    ) RETURNING id INTO v_item_id;

    IF coalesce((v_bump.product_row).gerencia_estoque,false) THEN
      UPDATE public.produtos
      SET estoque_reservado=estoque_reservado+1,updated_at=now()
      WHERE id=v_bump.produto_id;
      INSERT INTO public.pedido_estoque_reservas(
        pedido_id,pedido_item_id,empresa_id,produto_id,quantidade
      ) VALUES (v_pedido_id,v_item_id,p_empresa_id,v_bump.produto_id,1);
    END IF;
  END LOOP;

  INSERT INTO public.transacoes(
    empresa_id,cliente_id,afiliado_id,produto_id,checkout_id,
    link_pagamento_id,link_afiliado_id,pedido_id,pedido_numero,
    codigo_externo,tipo,metodo_pagamento,status,
    valor_bruto,valor_liquido,moeda,idempotency_key,
    provedor_pagamento,origem_dispositivo,metadata
  ) VALUES (
    p_empresa_id,p_cliente_id,p_afiliado_id,v_product.id,p_checkout_id,
    p_link_pagamento_id,p_link_afiliado_id,v_pedido_id,v_numero,
    coalesce(v_link.codigo_unico,v_checkout.slug),
    CASE WHEN p_link_pagamento_id IS NULL
      THEN 'venda'::public.tipo_transacao
      ELSE 'link_pagamento'::public.tipo_transacao END,
    'pix'::public.metodo_pagamento,
    'pendente'::public.status_transacao,
    v_total,v_total,coalesce(v_offer.moeda,'BRL'),p_idempotency_key,
    p_provedor,'web',
    jsonb_build_object(
      'pedido_id',v_pedido_id,
      'checkout_version_id',v_checkout.publicado_versao_id,
      'published_order_bump_ids',p_order_bump_ids
    )
  ) RETURNING id INTO v_tx_id;

  RETURN QUERY SELECT v_pedido_id,v_tx_id,v_numero,v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_checkout_criar_pedido_pix(
  uuid,uuid,uuid,uuid,uuid,numeric,uuid[],uuid,uuid,text
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_checkout_criar_pedido_pix(
  uuid,uuid,uuid,uuid,uuid,numeric,uuid[],uuid,uuid,text
) TO service_role;
