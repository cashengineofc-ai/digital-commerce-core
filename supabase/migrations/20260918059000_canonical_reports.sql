-- Cash Engine PRO — camada canônica de relatórios.
-- Comercial: data_confirmado do pedido.
-- Financeiro: data_lancamento do razão.
-- Períodos são datas locais da empresa e convertidos para UTC no servidor.

CREATE OR REPLACE FUNCTION public.fn_relatorio_autorizado(p_recurso text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      public.fn_is_admin_global()
      OR public.fn_is_empresa_owner(public.current_empresa_id())
      OR public.fn_tem_permissao(
        'relatorios',
        p_recurso,
        'read'::public.tipo_operacao
      )
    );
$$;

REVOKE ALL ON FUNCTION public.fn_relatorio_autorizado(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_autorizado(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_relatorio_timezone()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_requested text;
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT nullif(trim(configuracoes->>'timezone'),'')
  INTO v_requested
  FROM public.empresas
  WHERE id=v_empresa;

  IF v_requested IS NOT NULL
     AND EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=v_requested) THEN
    RETURN v_requested;
  END IF;

  RETURN 'America/Sao_Paulo';
END;
$$;

REVOKE ALL ON FUNCTION public.fn_relatorio_timezone() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_timezone() TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_relatorio_intervalo(
  p_inicio date,
  p_fim date
)
RETURNS TABLE(
  timezone text,
  inicio_utc timestamptz,
  fim_utc timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_tz text;
  v_start date;
  v_end date;
BEGIN
  IF p_inicio IS NULL OR p_fim IS NULL OR p_fim<p_inicio THEN
    RAISE EXCEPTION 'report_period_invalid';
  END IF;
  IF p_fim-p_inicio>366 THEN
    RAISE EXCEPTION 'report_period_too_large';
  END IF;

  v_tz:=public.fn_relatorio_timezone();
  v_start:=p_inicio;
  v_end:=p_fim+1;

  RETURN QUERY
  SELECT
    v_tz,
    (v_start::timestamp AT TIME ZONE v_tz),
    (v_end::timestamp AT TIME ZONE v_tz);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_relatorio_intervalo(date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_intervalo(date,date) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_relatorio_definicoes()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  RETURN jsonb_build_object(
    'timezone',public.fn_relatorio_timezone(),
    'faturamento_bruto','Soma do valor_total dos pedidos com pagamento confirmado. Pedidos reembolsados permanecem no bruto histórico.',
    'devolucoes','Somente valor_devolvido efetivamente conciliado. Solicitações pendentes não entram.',
    'faturamento_liquido_devolucoes','Faturamento bruto menos devoluções efetivamente conciliadas.',
    'taxas','Taxas da plataforma congeladas no pedido no momento do processamento financeiro.',
    'comissoes','Comissões congeladas na venda. Reversões por estorno são apresentadas separadamente.',
    'resultado_financeiro','Movimentos econômicos do razão, excluindo transferências internas entre buckets e reservas/liquidações de saque.',
    'data_vendas','confirmado_em do pedido, no fuso horário da empresa.',
    'data_financeiro','data_lancamento do razão, no fuso horário da empresa.',
    'pedido_pendente','Pedido criado cujo status_pagamento ainda é pendente.',
    'pagamento_confirmado','Pedido com status_pagamento confirmado ou posteriormente reembolsado parcial/total.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_relatorio_definicoes() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_definicoes() TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_relatorio_resumo(
  p_inicio date,
  p_fim date,
  p_metodo text DEFAULT NULL
)
RETURNS TABLE(
  timezone text,
  inicio_utc timestamptz,
  fim_utc timestamptz,
  pedidos_criados bigint,
  pedidos_pendentes bigint,
  pagamentos_confirmados bigint,
  faturamento_bruto numeric,
  devolucoes numeric,
  faturamento_liquido_devolucoes numeric,
  taxas_plataforma numeric,
  comissoes_originais numeric,
  comissoes_estornadas numeric,
  comissoes_reconhecidas numeric,
  ticket_medio numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_tz text;
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.fn_relatorio_autorizado('vendas') THEN RAISE EXCEPTION 'permission_denied'; END IF;
  IF coalesce(trim(p_metodo),'')<>'' AND p_metodo<>'pix' THEN
    RAISE EXCEPTION 'payment_method_not_operational';
  END IF;

  SELECT i.timezone,i.inicio_utc,i.fim_utc
  INTO v_tz,v_start,v_end
  FROM public.fn_relatorio_intervalo(p_inicio,p_fim) i;

  RETURN QUERY
  WITH created_orders AS (
    SELECT p.id,p.status_pagamento
    FROM public.pedidos p
    WHERE p.empresa_id=v_empresa
      AND p.criado_em>=v_start AND p.criado_em<v_end
      AND (coalesce(trim(p_metodo),'')='' OR p.metodo_pagamento=p_metodo)
  ),
  confirmed_orders AS (
    SELECT p.*
    FROM public.pedidos p
    WHERE p.empresa_id=v_empresa
      AND p.confirmado_em>=v_start AND p.confirmado_em<v_end
      AND p.status_pagamento IN (
        'confirmado','reembolsado_parcial','reembolsado_total'
      )
      AND (coalesce(trim(p_metodo),'')='' OR p.metodo_pagamento=p_metodo)
  ),
  commission_by_order AS (
    SELECT
      t.pedido_id,
      coalesce(sum(c.valor_comissao_liquida),0) AS original_value,
      coalesce(sum(coalesce(c.valor_estornado,0)),0) AS reversed_value
    FROM public.comissoes c
    JOIN public.transacoes t ON t.id=c.transacao_id
    JOIN confirmed_orders o ON o.id=t.pedido_id
    WHERE c.deleted_at IS NULL
    GROUP BY t.pedido_id
  ),
  totals AS (
    SELECT
      count(*)::bigint AS paid_count,
      coalesce(sum(o.valor_total),0)::numeric AS gross,
      coalesce(sum(o.valor_devolvido),0)::numeric AS refunds,
      coalesce(sum(o.valor_taxas),0)::numeric AS fees,
      coalesce(sum(coalesce(cbo.original_value,o.valor_comissoes)),0)::numeric AS commission_original,
      coalesce(sum(coalesce(cbo.reversed_value,0)),0)::numeric AS commission_reversed
    FROM confirmed_orders o
    LEFT JOIN commission_by_order cbo ON cbo.pedido_id=o.id
  )
  SELECT
    v_tz,
    v_start,
    v_end,
    (SELECT count(*) FROM created_orders),
    (SELECT count(*) FROM created_orders WHERE status_pagamento='pendente'),
    t.paid_count,
    round(t.gross,2),
    round(t.refunds,2),
    round(t.gross-t.refunds,2),
    round(t.fees,2),
    round(t.commission_original,2),
    round(t.commission_reversed,2),
    round(greatest(t.commission_original-t.commission_reversed,0),2),
    CASE WHEN t.paid_count>0 THEN round(t.gross/t.paid_count,2) ELSE 0 END
  FROM totals t;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_relatorio_resumo(date,date,text)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_resumo(date,date,text)
TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_relatorio_vendas_diario(
  p_inicio date,
  p_fim date,
  p_metodo text DEFAULT NULL
)
RETURNS TABLE(
  dia date,
  pedidos bigint,
  faturamento_bruto numeric,
  devolucoes numeric,
  faturamento_liquido_devolucoes numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_tz text;
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  IF NOT public.fn_relatorio_autorizado('vendas') THEN RAISE EXCEPTION 'permission_denied'; END IF;
  SELECT i.timezone,i.inicio_utc,i.fim_utc
  INTO v_tz,v_start,v_end
  FROM public.fn_relatorio_intervalo(p_inicio,p_fim) i;

  RETURN QUERY
  SELECT
    (p.confirmado_em AT TIME ZONE v_tz)::date AS dia,
    count(*)::bigint,
    round(sum(p.valor_total),2),
    round(sum(p.valor_devolvido),2),
    round(sum(p.valor_total-p.valor_devolvido),2)
  FROM public.pedidos p
  WHERE p.empresa_id=v_empresa
    AND p.confirmado_em>=v_start AND p.confirmado_em<v_end
    AND p.status_pagamento IN (
      'confirmado','reembolsado_parcial','reembolsado_total'
    )
    AND (coalesce(trim(p_metodo),'')='' OR p.metodo_pagamento=p_metodo)
  GROUP BY 1
  ORDER BY 1;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_relatorio_vendas_diario(date,date,text)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_vendas_diario(date,date,text)
TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_relatorio_produtos(
  p_inicio date,
  p_fim date
)
RETURNS TABLE(
  produto_id uuid,
  produto_nome text,
  status_atual text,
  pedidos_confirmados bigint,
  unidades bigint,
  receita_bruta_itens numeric,
  devolucoes_rateadas numeric,
  receita_liquida_devolucoes numeric,
  comissao_snapshot numeric,
  ticket_medio_item numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  IF NOT public.fn_relatorio_autorizado('produtos') THEN RAISE EXCEPTION 'permission_denied'; END IF;
  SELECT i.inicio_utc,i.fim_utc
  INTO v_start,v_end
  FROM public.fn_relatorio_intervalo(p_inicio,p_fim) i;

  RETURN QUERY
  WITH items AS (
    SELECT
      pi.produto_id,
      pi.pedido_id,
      pi.quantidade,
      pi.total_snapshot,
      pi.comissao_valor_snapshot,
      p.valor_total,
      p.valor_devolvido
    FROM public.pedido_itens pi
    JOIN public.pedidos p ON p.id=pi.pedido_id
    WHERE pi.empresa_id=v_empresa
      AND p.empresa_id=v_empresa
      AND p.confirmado_em>=v_start AND p.confirmado_em<v_end
      AND p.status_pagamento IN (
        'confirmado','reembolsado_parcial','reembolsado_total'
      )
  ),
  grouped AS (
    SELECT
      i.produto_id,
      count(DISTINCT i.pedido_id)::bigint AS order_count,
      sum(i.quantidade)::bigint AS unit_count,
      sum(i.total_snapshot)::numeric AS gross_items,
      sum(
        CASE
          WHEN i.valor_total>0
          THEN i.valor_devolvido*(i.total_snapshot/i.valor_total)
          ELSE 0
        END
      )::numeric AS allocated_refund,
      sum(i.comissao_valor_snapshot)::numeric AS commission_snapshot
    FROM items i
    GROUP BY i.produto_id
  )
  SELECT
    g.produto_id,
    coalesce(p.nome,'Produto removido')::text,
    coalesce(p.status::text,'removido')::text,
    g.order_count,
    g.unit_count,
    round(g.gross_items,2),
    round(g.allocated_refund,2),
    round(g.gross_items-g.allocated_refund,2),
    round(g.commission_snapshot,2),
    CASE WHEN g.unit_count>0 THEN round(g.gross_items/g.unit_count,2) ELSE 0 END
  FROM grouped g
  LEFT JOIN public.produtos p ON p.id=g.produto_id
  ORDER BY g.gross_items DESC,g.produto_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_relatorio_produtos(date,date)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_produtos(date,date)
TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_relatorio_afiliados(
  p_inicio date,
  p_fim date
)
RETURNS TABLE(
  afiliado_id uuid,
  afiliado_nome text,
  cliques bigint,
  vendas_confirmadas bigint,
  faturamento_bruto numeric,
  devolucoes numeric,
  faturamento_liquido_devolucoes numeric,
  comissao_original numeric,
  comissao_estornada numeric,
  comissao_reconhecida numeric,
  conversao numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  IF NOT public.fn_relatorio_autorizado('afiliados') THEN RAISE EXCEPTION 'permission_denied'; END IF;
  SELECT i.inicio_utc,i.fim_utc
  INTO v_start,v_end
  FROM public.fn_relatorio_intervalo(p_inicio,p_fim) i;

  RETURN QUERY
  WITH affiliates AS (
    SELECT a.id,coalesce(p.nome_completo,a.codigo_afiliado)::text AS name
    FROM public.afiliados a
    LEFT JOIN public.profiles p ON p.id=a.profile_id
    WHERE a.empresa_id=v_empresa AND a.deleted_at IS NULL
  ),
  clicks AS (
    SELECT ca.afiliado_id,count(*)::bigint AS click_count
    FROM public.cliques_afiliados ca
    WHERE ca.empresa_id=v_empresa
      AND ca.contabilizado
      AND ca.created_at>=v_start AND ca.created_at<v_end
    GROUP BY ca.afiliado_id
  ),
  sales AS (
    SELECT
      pd.afiliado_id,
      count(*)::bigint AS sale_count,
      sum(pd.valor_total)::numeric AS gross,
      sum(pd.valor_devolvido)::numeric AS refunds
    FROM public.pedidos pd
    WHERE pd.empresa_id=v_empresa
      AND pd.afiliado_id IS NOT NULL
      AND pd.confirmado_em>=v_start AND pd.confirmado_em<v_end
      AND pd.status_pagamento IN (
        'confirmado','reembolsado_parcial','reembolsado_total'
      )
    GROUP BY pd.afiliado_id
  ),
  commissions AS (
    SELECT
      c.afiliado_id,
      sum(c.valor_comissao_liquida)::numeric AS original_value,
      sum(coalesce(c.valor_estornado,0))::numeric AS reversed_value
    FROM public.comissoes c
    JOIN public.transacoes t ON t.id=c.transacao_id
    JOIN public.pedidos pd ON pd.id=t.pedido_id
    WHERE c.empresa_id=v_empresa
      AND c.deleted_at IS NULL
      AND pd.confirmado_em>=v_start AND pd.confirmado_em<v_end
      AND pd.status_pagamento IN (
        'confirmado','reembolsado_parcial','reembolsado_total'
      )
    GROUP BY c.afiliado_id
  )
  SELECT
    a.id,
    a.name,
    coalesce(c.click_count,0),
    coalesce(s.sale_count,0),
    round(coalesce(s.gross,0),2),
    round(coalesce(s.refunds,0),2),
    round(coalesce(s.gross,0)-coalesce(s.refunds,0),2),
    round(coalesce(cm.original_value,0),2),
    round(coalesce(cm.reversed_value,0),2),
    round(greatest(coalesce(cm.original_value,0)-coalesce(cm.reversed_value,0),0),2),
    CASE WHEN coalesce(c.click_count,0)>0
      THEN round(coalesce(s.sale_count,0)*100.0/c.click_count,2)
      ELSE 0
    END
  FROM affiliates a
  LEFT JOIN clicks c ON c.afiliado_id=a.id
  LEFT JOIN sales s ON s.afiliado_id=a.id
  LEFT JOIN commissions cm ON cm.afiliado_id=a.id
  ORDER BY coalesce(s.gross,0) DESC,a.id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_relatorio_afiliados(date,date)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_afiliados(date,date)
TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_relatorio_financeiro_categorias(
  p_inicio date,
  p_fim date
)
RETURNS TABLE(
  conta text,
  creditos numeric,
  debitos numeric,
  liquido numeric,
  quantidade bigint,
  movimento_economico boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  IF NOT public.fn_relatorio_autorizado('financeiro') THEN RAISE EXCEPTION 'permission_denied'; END IF;
  SELECT i.inicio_utc,i.fim_utc
  INTO v_start,v_end
  FROM public.fn_relatorio_intervalo(p_inicio,p_fim) i;

  RETURN QUERY
  SELECT
    l.conta_contabil::text,
    round(coalesce(sum(l.valor) FILTER (
      WHERE (
        (l.bucket='devedor' AND l.tipo_lancamento='D')
        OR (l.bucket<>'devedor' AND l.tipo_lancamento='C')
      )
    ),0),2) AS credits,
    round(coalesce(sum(l.valor) FILTER (
      WHERE (
        (l.bucket='devedor' AND l.tipo_lancamento='C')
        OR (l.bucket<>'devedor' AND l.tipo_lancamento='D')
      )
    ),0),2) AS debits,
    round(sum(
      CASE
        WHEN l.bucket='devedor'
          THEN CASE WHEN l.tipo_lancamento='C' THEN -l.valor ELSE l.valor END
        ELSE CASE WHEN l.tipo_lancamento='C' THEN l.valor ELSE -l.valor END
      END
    ),2) AS net,
    count(*)::bigint,
    l.conta_contabil NOT IN (
      'LIBERACAO_SALDO',
      'LIBERACAO_COMISSAO',
      'SAQUE_RESERVA',
      'SAQUE_RESERVA_LIBERADA',
      'SAQUE_PAGO'
    )
  FROM public.lancamentos_contabeis l
  WHERE l.empresa_id=v_empresa
    AND l.profile_id IS NULL
    AND l.afiliado_id IS NULL
    AND l.data_lancamento>=v_start
    AND l.data_lancamento<v_end
  GROUP BY l.conta_contabil
  ORDER BY abs(sum(
    CASE
      WHEN l.bucket='devedor'
        THEN CASE WHEN l.tipo_lancamento='C' THEN -l.valor ELSE l.valor END
      ELSE CASE WHEN l.tipo_lancamento='C' THEN l.valor ELSE -l.valor END
    END
  )) DESC,l.conta_contabil;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_relatorio_financeiro_categorias(date,date)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_financeiro_categorias(date,date)
TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_relatorio_consistencia_pedido(p_pedido_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_p public.pedidos%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT (
    public.fn_relatorio_autorizado('vendas')
    OR public.fn_relatorio_autorizado('financeiro')
  ) THEN RAISE EXCEPTION 'permission_denied'; END IF;

  SELECT * INTO v_p
  FROM public.pedidos
  WHERE id=p_pedido_id AND empresa_id=v_empresa;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;

  RETURN jsonb_build_object(
    'pedido_id',v_p.id,
    'numero',v_p.numero,
    'status_pagamento',v_p.status_pagamento,
    'faturamento_bruto',v_p.valor_total,
    'devolucoes',v_p.valor_devolvido,
    'faturamento_liquido_devolucoes',v_p.valor_total-v_p.valor_devolvido,
    'taxas_snapshot',v_p.valor_taxas,
    'comissoes_snapshot',v_p.valor_comissoes,
    'itens_total',coalesce((
      SELECT sum(total_snapshot) FROM public.pedido_itens WHERE pedido_id=v_p.id
    ),0),
    'itens_count',(
      SELECT count(*) FROM public.pedido_itens WHERE pedido_id=v_p.id
    ),
    'comissao_reconhecida',coalesce((
      SELECT sum(greatest(c.valor_comissao_liquida-coalesce(c.valor_estornado,0),0))
      FROM public.comissoes c
      JOIN public.transacoes t ON t.id=c.transacao_id
      WHERE t.pedido_id=v_p.id AND c.deleted_at IS NULL
    ),0),
    'comissao_estornada',coalesce((
      SELECT sum(coalesce(c.valor_estornado,0))
      FROM public.comissoes c
      JOIN public.transacoes t ON t.id=c.transacao_id
      WHERE t.pedido_id=v_p.id AND c.deleted_at IS NULL
    ),0),
    'ledger_company_net',coalesce((
      SELECT sum(
        CASE
          WHEN l.bucket='devedor'
            THEN CASE WHEN l.tipo_lancamento='C' THEN -l.valor ELSE l.valor END
          ELSE CASE WHEN l.tipo_lancamento='C' THEN l.valor ELSE -l.valor END
        END
      )
      FROM public.lancamentos_contabeis l
      WHERE l.empresa_id=v_empresa
        AND l.profile_id IS NULL
        AND l.afiliado_id IS NULL
        AND l.transacao_id IN (
          SELECT t.id FROM public.transacoes t WHERE t.pedido_id=v_p.id
        )
        AND l.conta_contabil NOT IN (
          'LIBERACAO_SALDO',
          'SAQUE_RESERVA',
          'SAQUE_RESERVA_LIBERADA',
          'SAQUE_PAGO'
        )
    ),0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_relatorio_consistencia_pedido(uuid)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_relatorio_consistencia_pedido(uuid)
TO authenticated;
