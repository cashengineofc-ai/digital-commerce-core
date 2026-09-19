-- Make affiliate click deduplication concurrency-safe and ensure commission
-- snapshots always contain the monetary value that the financial settlement
-- later consumes.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_afiliado_link_resolver(
  p_code text,
  p_fingerprint text,
  p_referrer text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_l public.links_afiliados%ROWTYPE;
  v_hash text;
  v_counted boolean := false;
BEGIN
  IF trim(coalesce(p_code,''))='' THEN
    RAISE EXCEPTION 'affiliate_link_invalid';
  END IF;
  IF trim(coalesce(p_fingerprint,''))='' OR length(p_fingerprint)>256 THEN
    RAISE EXCEPTION 'affiliate_fingerprint_invalid';
  END IF;

  SELECT * INTO v_l
  FROM public.links_afiliados
  WHERE codigo_rastreio=trim(p_code)
    AND status='ativo'
    AND deleted_at IS NULL
    AND (data_inicio IS NULL OR data_inicio<=now())
    AND (data_fim IS NULL OR data_fim>now())
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'affiliate_link_unavailable';
  END IF;

  IF NOT EXISTS(
    SELECT 1
    FROM public.afiliados a
    JOIN public.afiliados_produtos ap
      ON ap.afiliado_id=a.id
     AND ap.produto_id=v_l.produto_id
     AND ap.empresa_id=v_l.empresa_id
    WHERE a.id=v_l.afiliado_id
      AND a.status='ativo'
      AND a.deleted_at IS NULL
      AND ap.ativo
      AND (ap.data_inicio IS NULL OR ap.data_inicio<=now())
      AND (ap.data_fim IS NULL OR ap.data_fim>now())
  ) THEN
    RAISE EXCEPTION 'affiliate_link_unavailable';
  END IF;

  v_hash:=encode(digest(trim(p_fingerprint),'sha256'),'hex');

  -- Serialize only identical link/fingerprint pairs. Without this lock, two
  -- concurrent requests can both pass NOT EXISTS before either inserts.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_l.id::text || ':' || v_hash, 0)
  );

  IF NOT EXISTS(
    SELECT 1
    FROM public.cliques_afiliados
    WHERE link_afiliado_id=v_l.id
      AND fingerprint_hash=v_hash
      AND created_at>now()-interval '10 minutes'
  ) THEN
    INSERT INTO public.cliques_afiliados(
      empresa_id,link_afiliado_id,afiliado_id,produto_id,
      fingerprint_hash,referrer,contabilizado
    ) VALUES (
      v_l.empresa_id,v_l.id,v_l.afiliado_id,v_l.produto_id,
      v_hash,left(nullif(trim(coalesce(p_referrer,'')),''),500),true
    );
    v_counted:=true;

    UPDATE public.links_afiliados
    SET total_cliques=coalesce(total_cliques,0)+1,
        updated_at=now()
    WHERE id=v_l.id;

    UPDATE public.afiliados
    SET total_cliques=coalesce(total_cliques,0)+1,
        updated_at=now()
    WHERE id=v_l.afiliado_id;
  END IF;

  RETURN jsonb_build_object(
    'destination',v_l.url_destino,
    'affiliate_code',v_l.codigo_rastreio,
    'counted',v_counted
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_afiliado_link_resolver(text,text,text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_afiliado_link_resolver(text,text,text)
  TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_snapshot_comissao_pedido_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aff uuid;
  v_empresa uuid;
  v_ap public.afiliados_produtos%ROWTYPE;
  v_p public.produtos%ROWTYPE;
  v_a public.afiliados%ROWTYPE;
  v_rate numeric(7,4):=0;
  v_fixed numeric(15,2):=NULL;
  v_item_base numeric(15,2):=0;
BEGIN
  SELECT afiliado_id,empresa_id
  INTO v_aff,v_empresa
  FROM public.pedidos
  WHERE id=NEW.pedido_id;

  SELECT * INTO v_p
  FROM public.produtos
  WHERE id=NEW.produto_id AND empresa_id=v_empresa;

  IF v_aff IS NULL THEN
    NEW.taxa_comissao_percentual_snapshot:=0;
    NEW.comissao_percentual_snapshot:=0;
    NEW.comissao_valor_snapshot:=NULL;
    RETURN NEW;
  END IF;

  SELECT * INTO v_a
  FROM public.afiliados
  WHERE id=v_aff
    AND empresa_id=v_empresa
    AND status='ativo'
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    NEW.taxa_comissao_percentual_snapshot:=0;
    NEW.comissao_percentual_snapshot:=0;
    NEW.comissao_valor_snapshot:=NULL;
    RETURN NEW;
  END IF;

  SELECT * INTO v_ap
  FROM public.afiliados_produtos
  WHERE afiliado_id=v_aff
    AND produto_id=NEW.produto_id
    AND empresa_id=v_empresa
    AND ativo
    AND (data_inicio IS NULL OR data_inicio<=now())
    AND (data_fim IS NULL OR data_fim>now());

  IF NOT FOUND THEN
    NEW.taxa_comissao_percentual_snapshot:=0;
    NEW.comissao_percentual_snapshot:=0;
    NEW.comissao_valor_snapshot:=NULL;
    NEW.regras_comissao_snapshot:=jsonb_build_object(
      'authorized',false,
      'attribution','direct_link'
    );
    NEW.regra_comissao_snapshot:=NEW.regras_comissao_snapshot;
    RETURN NEW;
  END IF;

  v_rate:=least(
    greatest(
      coalesce(
        v_ap.taxa_comissao_personalizada,
        v_p.taxa_comissao_afiliado,
        v_a.taxa_comissao_padrao,
        0
      ),
      0
    ),
    100
  );
  v_fixed:=coalesce(v_ap.comissao_valor_fixo,v_p.comissao_valor_fixo);
  v_item_base:=greatest(
    round(
      coalesce(
        NEW.total_snapshot,
        NEW.subtotal,
        coalesce(NEW.preco_final_unitario,NEW.preco_unitario_snapshot,0)
          * coalesce(NEW.quantidade,1),
        0
      ),
      2
    ),
    0
  );

  NEW.taxa_comissao_percentual_snapshot:=v_rate;
  NEW.comissao_percentual_snapshot:=v_rate;

  IF v_fixed IS NOT NULL THEN
    NEW.comissao_valor_snapshot:=least(greatest(round(v_fixed,2),0),v_item_base);
  ELSE
    NEW.comissao_valor_snapshot:=round(v_item_base*v_rate/100.0,2);
  END IF;

  NEW.regras_comissao_snapshot:=jsonb_build_object(
    'authorized',true,
    'affiliate_product_id',v_ap.id,
    'percent',v_rate,
    'fixed',v_fixed,
    'calculated_value',NEW.comissao_valor_snapshot,
    'base_value',v_item_base,
    'attribution',v_ap.regra_atribuicao
  );
  NEW.regra_comissao_snapshot:=NEW.regras_comissao_snapshot;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_snapshot_comissao_pedido_item()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_snapshot_comissao_pedido_item()
  TO service_role;

COMMIT;
