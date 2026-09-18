-- Cash Engine PRO — consultas de API externa isoladas pela empresa da chave.
-- Somente service_role pode executá-las; o Edge Function valida hash e escopo antes.

CREATE OR REPLACE FUNCTION public.fn_api_products(
  p_empresa_id uuid,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  name text,
  description text,
  status text,
  price numeric,
  currency text,
  created_at timestamptz,
  updated_at timestamptz,
  total_records bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  IF current_setting('role',true)<>'service_role' THEN
    RAISE EXCEPTION 'service_role_required';
  END IF;

  RETURN QUERY
  SELECT
    p.id,p.nome::text,coalesce(p.descricao_curta,p.descricao_longa)::text,p.status::text,p.preco,
    coalesce(p.moeda,'BRL')::text,p.created_at,p.updated_at,count(*) OVER()
  FROM public.produtos p
  WHERE p.empresa_id=p_empresa_id
    AND p.deleted_at IS NULL
  ORDER BY p.created_at DESC,p.id DESC
  LIMIT greatest(1,least(coalesce(p_limit,50),100))
  OFFSET greatest(coalesce(p_offset,0),0);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_api_products(uuid,integer,integer)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_api_products(uuid,integer,integer)
TO service_role;

CREATE OR REPLACE FUNCTION public.fn_api_orders(
  p_empresa_id uuid,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_status text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  number text,
  payment_status text,
  payment_method text,
  currency text,
  subtotal numeric,
  discounts numeric,
  fees numeric,
  commissions numeric,
  refunded numeric,
  total numeric,
  created_at timestamptz,
  confirmed_at timestamptz,
  items jsonb,
  total_records bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  IF current_setting('role',true)<>'service_role' THEN
    RAISE EXCEPTION 'service_role_required';
  END IF;

  RETURN QUERY
  SELECT
    p.id,p.numero::text,p.status_pagamento::text,p.metodo_pagamento::text,
    p.moeda::text,p.valor_subtotal,p.valor_descontos,p.valor_taxas,
    p.valor_comissoes,p.valor_devolvido,p.valor_total,p.criado_em,p.confirmado_em,
    coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',i.id,
          'type',i.tipo_item,
          'product_id',i.produto_id,
          'name',i.nome_snapshot,
          'quantity',i.quantidade,
          'unit_price',i.preco_unitario_snapshot,
          'discount',i.desconto_snapshot,
          'total',i.total_snapshot
        )
        ORDER BY i.created_at,i.id
      )
      FROM public.pedido_itens i
      WHERE i.pedido_id=p.id
    ),'[]'::jsonb),
    count(*) OVER()
  FROM public.pedidos p
  WHERE p.empresa_id=p_empresa_id
    AND (
      coalesce(trim(p_status),'')=''
      OR p.status_pagamento::text=p_status
    )
  ORDER BY p.criado_em DESC,p.id DESC
  LIMIT greatest(1,least(coalesce(p_limit,50),100))
  OFFSET greatest(coalesce(p_offset,0),0);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_api_orders(uuid,integer,integer,text)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_api_orders(uuid,integer,integer,text)
TO service_role;

CREATE OR REPLACE FUNCTION public.fn_api_report_summary(
  p_empresa_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE result jsonb;
BEGIN
  IF current_setting('role',true)<>'service_role' THEN
    RAISE EXCEPTION 'service_role_required';
  END IF;
  IF p_start IS NULL OR p_end IS NULL OR p_end<=p_start
     OR p_end-p_start>interval '366 days' THEN
    RAISE EXCEPTION 'report_period_invalid';
  END IF;

  SELECT jsonb_build_object(
    'period_start',p_start,
    'period_end',p_end,
    'orders_created',count(*),
    'payments_confirmed',count(*) FILTER(
      WHERE status_pagamento IN ('confirmado','reembolsado_parcial','reembolsado_total')
    ),
    'gross_revenue',coalesce(sum(valor_total) FILTER(
      WHERE status_pagamento IN ('confirmado','reembolsado_parcial','reembolsado_total')
    ),0),
    'refunds',coalesce(sum(valor_devolvido) FILTER(
      WHERE status_pagamento IN ('confirmado','reembolsado_parcial','reembolsado_total')
    ),0),
    'net_after_refunds',coalesce(sum(valor_total-valor_devolvido) FILTER(
      WHERE status_pagamento IN ('confirmado','reembolsado_parcial','reembolsado_total')
    ),0),
    'platform_fees',coalesce(sum(valor_taxas) FILTER(
      WHERE status_pagamento IN ('confirmado','reembolsado_parcial','reembolsado_total')
    ),0),
    'commissions_snapshot',coalesce(sum(valor_comissoes) FILTER(
      WHERE status_pagamento IN ('confirmado','reembolsado_parcial','reembolsado_total')
    ),0)
  )
  INTO result
  FROM public.pedidos
  WHERE empresa_id=p_empresa_id
    AND criado_em>=p_start AND criado_em<p_end;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_api_report_summary(uuid,timestamptz,timestamptz)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_api_report_summary(uuid,timestamptz,timestamptz)
TO service_role;
