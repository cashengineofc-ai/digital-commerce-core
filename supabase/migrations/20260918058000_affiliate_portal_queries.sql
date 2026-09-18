-- Cash Engine PRO — portal do próprio afiliado e consultas canônicas.
-- Um afiliado pode pertencer a operação distinta da empresa principal do profile.

CREATE OR REPLACE FUNCTION public.fn_afiliado_contextos()
RETURNS TABLE(
  afiliado_id uuid,
  empresa_id uuid,
  empresa_nome text,
  codigo text,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
  SELECT
    a.id,
    a.empresa_id,
    coalesce(e.nome_fantasia,e.razao_social,'Empresa')::text,
    a.codigo_afiliado::text,
    a.status::text
  FROM public.afiliados a
  JOIN public.empresas e ON e.id=a.empresa_id
  WHERE a.profile_id=auth.uid()
    AND a.deleted_at IS NULL
  ORDER BY a.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.fn_afiliado_contextos() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_afiliado_contextos() TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_afiliado_destinos_listar(p_afiliado_id uuid)
RETURNS TABLE(
  produto_id uuid,
  produto_nome text,
  destino_tipo text,
  destino_id uuid,
  destino_nome text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_a public.afiliados%ROWTYPE;
  v_manage boolean:=false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_a
  FROM public.afiliados
  WHERE id=p_afiliado_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'affiliate_not_found'; END IF;

  v_manage :=
    public.fn_is_admin_global()
    OR (
      public.current_empresa_id()=v_a.empresa_id
      AND (
        public.fn_is_empresa_owner(v_a.empresa_id)
        OR public.fn_tem_permissao('afiliados','links','read'::public.tipo_operacao)
      )
    );

  IF NOT v_manage AND v_a.profile_id<>auth.uid() THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  IF v_a.status<>'ativo' THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.nome::text,
    'checkout'::text,
    c.id,
    c.nome::text
  FROM public.afiliados_produtos ap
  JOIN public.produtos p ON p.id=ap.produto_id
  JOIN public.checkouts c
    ON c.produto_id=p.id
   AND c.empresa_id=v_a.empresa_id
   AND c.status='publicado'
   AND c.publicado_versao_id IS NOT NULL
   AND c.desativado_em IS NULL
   AND c.deleted_at IS NULL
  WHERE ap.afiliado_id=v_a.id
    AND ap.empresa_id=v_a.empresa_id
    AND ap.ativo
    AND (ap.data_inicio IS NULL OR ap.data_inicio<=now())
    AND (ap.data_fim IS NULL OR ap.data_fim>now())
    AND p.status='publicado'
    AND p.deleted_at IS NULL

  UNION ALL

  SELECT
    p.id,
    p.nome::text,
    'link_pagamento'::text,
    lp.id,
    lp.titulo::text
  FROM public.afiliados_produtos ap
  JOIN public.produtos p ON p.id=ap.produto_id
  JOIN public.links_pagamento lp
    ON lp.produto_id=p.id
   AND lp.empresa_id=v_a.empresa_id
   AND lp.status='ativo'
   AND (lp.data_expiracao IS NULL OR lp.data_expiracao>now())
   AND lp.deleted_at IS NULL
  WHERE ap.afiliado_id=v_a.id
    AND ap.empresa_id=v_a.empresa_id
    AND ap.ativo
    AND (ap.data_inicio IS NULL OR ap.data_inicio<=now())
    AND (ap.data_fim IS NULL OR ap.data_fim>now())
    AND p.status='publicado'
    AND p.deleted_at IS NULL

  ORDER BY 2,3,5;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_afiliado_destinos_listar(uuid)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_afiliado_destinos_listar(uuid)
TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_links_afiliados_listar(
  p_afiliado_id uuid DEFAULT NULL,
  p_busca text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  afiliado_id uuid,
  afiliado_nome text,
  produto_id uuid,
  produto_nome text,
  codigo text,
  destino text,
  status text,
  cliques bigint,
  vendas_confirmadas bigint,
  conversao numeric,
  comissao_reconhecida numeric,
  created_at timestamptz,
  total_registros bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_manage boolean:=false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  v_manage :=
    public.fn_is_admin_global()
    OR (
      v_empresa IS NOT NULL
      AND (
        public.fn_is_empresa_owner(v_empresa)
        OR public.fn_tem_permissao('afiliados','links','read'::public.tipo_operacao)
      )
    );

  RETURN QUERY
  WITH allowed_links AS (
    SELECT
      l.*,
      a.profile_id AS affiliate_profile_id,
      coalesce(pf.nome_completo,a.codigo_afiliado)::text AS affiliate_name,
      coalesce(pr.nome,'Produto')::text AS product_name
    FROM public.links_afiliados l
    JOIN public.afiliados a ON a.id=l.afiliado_id
    LEFT JOIN public.profiles pf ON pf.id=a.profile_id
    LEFT JOIN public.produtos pr ON pr.id=l.produto_id
    WHERE l.deleted_at IS NULL
      AND (
        (
          v_manage
          AND l.empresa_id=v_empresa
          AND (p_afiliado_id IS NULL OR l.afiliado_id=p_afiliado_id)
        )
        OR (
          a.profile_id=auth.uid()
          AND (p_afiliado_id IS NULL OR l.afiliado_id=p_afiliado_id)
        )
      )
      AND (
        coalesce(trim(p_busca),'')=''
        OR l.codigo_rastreio ILIKE '%'||trim(p_busca)||'%'
        OR coalesce(l.nome_campanha,'') ILIKE '%'||trim(p_busca)||'%'
        OR coalesce(pr.nome,'') ILIKE '%'||trim(p_busca)||'%'
        OR coalesce(pf.nome_completo,'') ILIKE '%'||trim(p_busca)||'%'
      )
  )
  SELECT
    l.id,
    l.afiliado_id,
    l.affiliate_name,
    l.produto_id,
    l.product_name,
    l.codigo_rastreio::text,
    l.url_destino::text,
    l.status::text,
    (
      SELECT count(*)
      FROM public.cliques_afiliados ca
      WHERE ca.link_afiliado_id=l.id AND ca.contabilizado
    ),
    (
      SELECT count(*)
      FROM public.pedidos pd
      WHERE pd.link_afiliado_id=l.id
        AND pd.status_pagamento IN ('confirmado','reembolsado_parcial','reembolsado_total')
    ),
    CASE
      WHEN (
        SELECT count(*)
        FROM public.cliques_afiliados ca
        WHERE ca.link_afiliado_id=l.id AND ca.contabilizado
      )>0
      THEN round(
        (
          SELECT count(*)::numeric
          FROM public.pedidos pd
          WHERE pd.link_afiliado_id=l.id
            AND pd.status_pagamento IN ('confirmado','reembolsado_parcial','reembolsado_total')
        )*100.0/
        (
          SELECT count(*)::numeric
          FROM public.cliques_afiliados ca
          WHERE ca.link_afiliado_id=l.id AND ca.contabilizado
        ),2
      )
      ELSE 0
    END,
    coalesce((
      SELECT sum(greatest(c.valor_comissao_liquida-coalesce(c.valor_estornado,0),0))
      FROM public.comissoes c
      WHERE c.link_afiliado_id=l.id
        AND c.deleted_at IS NULL
        AND c.status NOT IN ('cancelada','estornada')
    ),0),
    l.created_at,
    count(*) OVER()
  FROM allowed_links l
  ORDER BY l.created_at DESC,l.id DESC
  LIMIT greatest(1,least(coalesce(p_limit,50),200))
  OFFSET greatest(coalesce(p_offset,0),0);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_links_afiliados_listar(uuid,text,integer,integer)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_links_afiliados_listar(uuid,text,integer,integer)
TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_comissoes_listar(
  p_afiliado_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_inicio timestamptz DEFAULT NULL,
  p_fim timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  afiliado_id uuid,
  afiliado_nome text,
  transacao_id uuid,
  pedido_numero text,
  produto_nome text,
  valor_venda numeric,
  percentual numeric,
  valor_original numeric,
  valor_estornado numeric,
  valor_reconhecido numeric,
  status text,
  venda_em timestamptz,
  liberacao_em timestamptz,
  pagamento_em timestamptz,
  total_registros bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_manage boolean:=false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  v_manage :=
    public.fn_is_admin_global()
    OR (
      v_empresa IS NOT NULL
      AND (
        public.fn_is_empresa_owner(v_empresa)
        OR public.fn_tem_permissao('afiliados','comissoes','read'::public.tipo_operacao)
      )
    );

  RETURN QUERY
  WITH base AS (
    SELECT
      c.*,
      a.profile_id AS affiliate_profile_id,
      coalesce(pf.nome_completo,a.codigo_afiliado)::text AS affiliate_name,
      t.pedido_id,
      t.pedido_numero,
      coalesce(t.data_pagamento,c.created_at) AS sale_at
    FROM public.comissoes c
    JOIN public.afiliados a ON a.id=c.afiliado_id
    LEFT JOIN public.profiles pf ON pf.id=a.profile_id
    LEFT JOIN public.transacoes t ON t.id=c.transacao_id
    WHERE c.deleted_at IS NULL
      AND (
        (
          v_manage
          AND c.empresa_id=v_empresa
          AND (p_afiliado_id IS NULL OR c.afiliado_id=p_afiliado_id)
        )
        OR (
          a.profile_id=auth.uid()
          AND (p_afiliado_id IS NULL OR c.afiliado_id=p_afiliado_id)
        )
      )
      AND (
        coalesce(trim(p_status),'')=''
        OR c.status::text=p_status
      )
      AND (p_inicio IS NULL OR coalesce(t.data_pagamento,c.created_at)>=p_inicio)
      AND (p_fim IS NULL OR coalesce(t.data_pagamento,c.created_at)<p_fim)
  )
  SELECT
    b.id,
    b.afiliado_id,
    b.affiliate_name,
    b.transacao_id,
    b.pedido_numero::text,
    coalesce((
      SELECT pi.nome_snapshot
      FROM public.pedido_itens pi
      WHERE pi.pedido_id=b.pedido_id
        AND pi.tipo_item='principal'
      ORDER BY pi.created_at
      LIMIT 1
    ),p.nome,'Produto')::text,
    b.valor_venda,
    b.taxa_comissao_percentual,
    b.valor_comissao_liquida,
    coalesce(b.valor_estornado,0),
    greatest(b.valor_comissao_liquida-coalesce(b.valor_estornado,0),0),
    b.status::text,
    b.sale_at,
    b.data_prevista_liberacao,
    b.data_pagamento,
    count(*) OVER()
  FROM base b
  LEFT JOIN public.produtos p ON p.id=b.produto_id
  ORDER BY b.sale_at DESC,b.id DESC
  LIMIT greatest(1,least(coalesce(p_limit,50),200))
  OFFSET greatest(coalesce(p_offset,0),0);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_comissoes_listar(
  uuid,text,timestamptz,timestamptz,integer,integer
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_comissoes_listar(
  uuid,text,timestamptz,timestamptz,integer,integer
) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_afiliado_resumo(p_afiliado_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_a public.afiliados%ROWTYPE;
  v_manage boolean:=false;
  v_available numeric:=0;
  v_receivable numeric:=0;
  v_reserved numeric:=0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_a
  FROM public.afiliados
  WHERE id=p_afiliado_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'affiliate_not_found'; END IF;

  v_manage :=
    public.fn_is_admin_global()
    OR (
      public.current_empresa_id()=v_a.empresa_id
      AND (
        public.fn_is_empresa_owner(v_a.empresa_id)
        OR public.fn_tem_permissao('afiliados','afiliados','read'::public.tipo_operacao)
      )
    );

  IF NOT v_manage AND v_a.profile_id<>auth.uid() THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  SELECT
    coalesce(saldo_disponivel,0),
    coalesce(saldo_a_receber,0),
    coalesce(saldo_reservado,0)
  INTO v_available,v_receivable,v_reserved
  FROM public.saldos
  WHERE afiliado_id=v_a.id
  LIMIT 1;

  RETURN jsonb_build_object(
    'affiliate_id',v_a.id,
    'status',v_a.status,
    'code',v_a.codigo_afiliado,
    'clicks',(
      SELECT count(*) FROM public.cliques_afiliados
      WHERE afiliado_id=v_a.id AND contabilizado
    ),
    'confirmed_sales',(
      SELECT count(*) FROM public.pedidos
      WHERE afiliado_id=v_a.id
        AND status_pagamento IN ('confirmado','reembolsado_parcial','reembolsado_total')
    ),
    'gross_sales',coalesce((
      SELECT sum(valor_total) FROM public.pedidos
      WHERE afiliado_id=v_a.id
        AND status_pagamento IN ('confirmado','reembolsado_parcial','reembolsado_total')
    ),0),
    'net_sales_after_refunds',coalesce((
      SELECT sum(greatest(valor_total-valor_devolvido,0)) FROM public.pedidos
      WHERE afiliado_id=v_a.id
        AND status_pagamento IN ('confirmado','reembolsado_parcial','reembolsado_total')
    ),0),
    'commission_recognized',coalesce((
      SELECT sum(greatest(valor_comissao_liquida-coalesce(valor_estornado,0),0))
      FROM public.comissoes
      WHERE afiliado_id=v_a.id
        AND deleted_at IS NULL
        AND status NOT IN ('cancelada','estornada')
    ),0),
    'balance_available',v_available,
    'balance_receivable',v_receivable,
    'balance_reserved',v_reserved
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_afiliado_resumo(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_afiliado_resumo(uuid) TO authenticated;
