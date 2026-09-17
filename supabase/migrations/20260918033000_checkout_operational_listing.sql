-- Cash Engine PRO — listagem operacional de checkouts sem duplicar pedidos
CREATE OR REPLACE FUNCTION public.fn_checkouts_listar(
  p_busca text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  nome text,
  descricao text,
  status text,
  public_token uuid,
  slug text,
  oferta_id uuid,
  oferta_nome text,
  produto_id uuid,
  produto_nome text,
  preco numeric,
  publicado_em timestamptz,
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
    c.id,c.nome::text,c.descricao,c.status::text,c.public_token,c.slug::text,
    o.id,o.nome::text,p.id,p.nome::text,o.preco,c.publicacao_data,
    (
      SELECT count(*)
      FROM public.pedidos pd
      WHERE pd.checkout_id=c.id
        AND pd.status_pagamento IN ('confirmado','reembolsado_parcial','reembolsado_total')
    ),
    coalesce((
      SELECT sum(pd.valor_total)
      FROM public.pedidos pd
      WHERE pd.checkout_id=c.id
        AND pd.status_pagamento IN ('confirmado','reembolsado_parcial','reembolsado_total')
    ),0),
    c.updated_at
  FROM public.checkouts c
  LEFT JOIN public.ofertas o
    ON o.id=c.oferta_id AND o.empresa_id=c.empresa_id AND o.deleted_at IS NULL
  LEFT JOIN public.produtos p
    ON p.id=o.produto_id AND p.empresa_id=c.empresa_id
  WHERE c.empresa_id=public.current_empresa_id()
    AND c.deleted_at IS NULL
    AND (coalesce(trim(p_status),'')='' OR c.status::text=p_status)
    AND (
      coalesce(trim(p_busca),'')=''
      OR c.nome ILIKE '%'||trim(p_busca)||'%'
      OR coalesce(o.nome,'') ILIKE '%'||trim(p_busca)||'%'
      OR coalesce(p.nome,'') ILIKE '%'||trim(p_busca)||'%'
      OR c.id::text ILIKE '%'||trim(p_busca)||'%'
    )
  ORDER BY c.updated_at DESC
  LIMIT greatest(1,least(coalesce(p_limit,100),200))
  OFFSET greatest(coalesce(p_offset,0),0);
$$;

REVOKE ALL ON FUNCTION public.fn_checkouts_listar(text,text,integer,integer)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_checkouts_listar(text,text,integer,integer)
TO authenticated;
