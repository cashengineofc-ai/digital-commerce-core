-- Cash Engine PRO — API operacional consistente de vendas/relatórios
-- Regra de data: data_referencia = confirmado_em para pagamento confirmado; caso contrário criado_em.
-- Valores financeiros são do pedido, nunca somados por item para evitar duplicação.

CREATE OR REPLACE FUNCTION public.fn_recalcular_pedido_financeiro(p_pedido_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_tx public.transacoes%ROWTYPE;
  v_taxas numeric(15,2) := 0;
  v_comissoes numeric(15,2) := 0;
  v_devolvido numeric(15,2) := 0;
BEGIN
  SELECT * INTO v_tx
  FROM public.transacoes
  WHERE pedido_id=p_pedido_id
  ORDER BY created_at
  LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;

  v_taxas := round(
    coalesce(v_tx.valor_taxa_plataforma,0)
    + coalesce(v_tx.valor_taxa_processamento,0)
    + coalesce(v_tx.valor_taxa_antecipacao,0), 2
  );

  SELECT coalesce(sum(c.valor_comissao_liquida),0)
  INTO v_comissoes
  FROM public.comissoes c
  WHERE c.transacao_id=v_tx.id
    AND c.deleted_at IS NULL
    AND c.status NOT IN ('cancelada','estornada');

  SELECT coalesce(sum(coalesce(e.valor_efetivamente_estornado,0)),0)
  INTO v_devolvido
  FROM public.estornos e
  WHERE e.transacao_id=v_tx.id
    AND e.status='concluido';

  UPDATE public.pedidos
  SET valor_taxas=v_taxas,
      valor_comissoes=round(v_comissoes,2),
      valor_devolvido=least(valor_total,round(v_devolvido,2)),
      status=CASE
        WHEN v_devolvido >= valor_total AND valor_total > 0 THEN 'reembolsado_total'
        WHEN v_devolvido > 0 THEN 'reembolsado_parcial'
        ELSE status
      END,
      status_pagamento=CASE
        WHEN v_devolvido >= valor_total AND valor_total > 0 THEN 'reembolsado_total'
        WHEN v_devolvido > 0 THEN 'reembolsado_parcial'
        ELSE status_pagamento
      END,
      updated_at=now()
  WHERE id=p_pedido_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_trigger_recalcular_pedido_financeiro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_pedido_id uuid;
BEGIN
  IF TG_TABLE_NAME='transacoes' THEN
    v_pedido_id := NEW.pedido_id;
  ELSIF TG_TABLE_NAME='comissoes' THEN
    SELECT pedido_id INTO v_pedido_id FROM public.transacoes WHERE id=NEW.transacao_id;
  ELSIF TG_TABLE_NAME='estornos' THEN
    SELECT pedido_id INTO v_pedido_id FROM public.transacoes WHERE id=NEW.transacao_id;
  END IF;
  IF v_pedido_id IS NOT NULL THEN
    PERFORM public.fn_recalcular_pedido_financeiro(v_pedido_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zz_pedido_fin_transacoes ON public.transacoes;
CREATE TRIGGER trg_zz_pedido_fin_transacoes
AFTER INSERT OR UPDATE OF status,valor_taxa_plataforma,valor_taxa_processamento,valor_taxa_antecipacao
ON public.transacoes
FOR EACH ROW EXECUTE FUNCTION public.fn_trigger_recalcular_pedido_financeiro();

DROP TRIGGER IF EXISTS trg_zz_pedido_fin_comissoes ON public.comissoes;
CREATE TRIGGER trg_zz_pedido_fin_comissoes
AFTER INSERT OR UPDATE OF status,valor_comissao_liquida
ON public.comissoes
FOR EACH ROW EXECUTE FUNCTION public.fn_trigger_recalcular_pedido_financeiro();

DROP TRIGGER IF EXISTS trg_zz_pedido_fin_estornos ON public.estornos;
CREATE TRIGGER trg_zz_pedido_fin_estornos
AFTER INSERT OR UPDATE OF status,valor_efetivamente_estornado
ON public.estornos
FOR EACH ROW EXECUTE FUNCTION public.fn_trigger_recalcular_pedido_financeiro();

CREATE OR REPLACE FUNCTION public.fn_vendas_consultar(
  p_status text DEFAULT NULL,
  p_metodo text DEFAULT NULL,
  p_busca text DEFAULT NULL,
  p_produto_id uuid DEFAULT NULL,
  p_inicio timestamptz DEFAULT NULL,
  p_fim timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  pedido_id uuid,
  numero text,
  comprador_nome text,
  comprador_email text,
  valor_total numeric,
  metodo_pagamento text,
  status_pedido text,
  status_pagamento text,
  criado_em timestamptz,
  confirmado_em timestamptz,
  data_referencia timestamptz,
  itens jsonb,
  taxas numeric,
  comissoes numeric,
  devolvido numeric,
  valor_liquido numeric,
  total_registros bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
  WITH filtered AS (
    SELECT p.*,
           coalesce(p.confirmado_em,p.criado_em) AS ref_date
    FROM public.pedidos p
    WHERE p.empresa_id=public.current_empresa_id()
      AND (
        coalesce(trim(p_status),'')=''
        OR p.status=p_status
        OR p.status_pagamento=p_status
      )
      AND (coalesce(trim(p_metodo),'')='' OR p.metodo_pagamento=p_metodo)
      AND (p_inicio IS NULL OR coalesce(p.confirmado_em,p.criado_em) >= p_inicio)
      AND (p_fim IS NULL OR coalesce(p.confirmado_em,p.criado_em) < p_fim)
      AND (
        p_produto_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.pedido_itens pi
          WHERE pi.pedido_id=p.id AND pi.produto_id=p_produto_id
        )
      )
      AND (
        coalesce(trim(p_busca),'')=''
        OR p.numero ILIKE '%'||trim(p_busca)||'%'
        OR coalesce(p.comprador_nome,'') ILIKE '%'||trim(p_busca)||'%'
        OR coalesce(p.comprador_email,'') ILIKE '%'||trim(p_busca)||'%'
        OR EXISTS (
          SELECT 1 FROM public.pedido_itens pi
          WHERE pi.pedido_id=p.id
            AND pi.nome_snapshot ILIKE '%'||trim(p_busca)||'%'
        )
      )
  )
  SELECT
    p.id,
    p.numero::text,
    coalesce(p.comprador_nome,'')::text,
    coalesce(p.comprador_email,'')::text,
    p.valor_total,
    p.metodo_pagamento::text,
    p.status::text,
    p.status_pagamento::text,
    p.criado_em,
    p.confirmado_em,
    p.ref_date,
    coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',pi.id,
          'tipo',pi.tipo_item,
          'produto_id',pi.produto_id,
          'nome',pi.nome_snapshot,
          'preco',pi.preco_unitario_snapshot,
          'quantidade',pi.quantidade,
          'total',pi.total_snapshot
        )
        ORDER BY CASE WHEN pi.tipo_item='principal' THEN 0 ELSE 1 END,pi.created_at
      )
      FROM public.pedido_itens pi
      WHERE pi.pedido_id=p.id
    ),'[]'::jsonb),
    coalesce(p.valor_taxas,0),
    coalesce(p.valor_comissoes,0),
    coalesce(p.valor_devolvido,0),
    greatest(
      round(
        p.valor_total
        - coalesce(p.valor_taxas,0)
        - coalesce(p.valor_comissoes,0)
        - coalesce(p.valor_devolvido,0),2
      ),0
    ),
    count(*) OVER()
  FROM filtered p
  ORDER BY p.ref_date DESC,p.id DESC
  LIMIT greatest(1,least(coalesce(p_limit,25),200))
  OFFSET greatest(coalesce(p_offset,0),0);
$$;

REVOKE ALL ON FUNCTION public.fn_vendas_consultar(text,text,text,uuid,timestamptz,timestamptz,integer,integer)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_vendas_consultar(text,text,text,uuid,timestamptz,timestamptz,integer,integer)
TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_vendas_resumo(
  p_status text DEFAULT NULL,
  p_metodo text DEFAULT NULL,
  p_busca text DEFAULT NULL,
  p_produto_id uuid DEFAULT NULL,
  p_inicio timestamptz DEFAULT NULL,
  p_fim timestamptz DEFAULT NULL
)
RETURNS TABLE(
  pedidos bigint,
  pagamentos_pendentes bigint,
  pagamentos_confirmados bigint,
  faturamento_bruto numeric,
  taxas numeric,
  comissoes numeric,
  devolucoes numeric,
  valor_liquido numeric,
  ticket_medio numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
  WITH filtered AS (
    SELECT p.*
    FROM public.pedidos p
    WHERE p.empresa_id=public.current_empresa_id()
      AND (
        coalesce(trim(p_status),'')=''
        OR p.status=p_status
        OR p.status_pagamento=p_status
      )
      AND (coalesce(trim(p_metodo),'')='' OR p.metodo_pagamento=p_metodo)
      AND (p_inicio IS NULL OR coalesce(p.confirmado_em,p.criado_em) >= p_inicio)
      AND (p_fim IS NULL OR coalesce(p.confirmado_em,p.criado_em) < p_fim)
      AND (
        p_produto_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.pedido_itens pi
          WHERE pi.pedido_id=p.id AND pi.produto_id=p_produto_id
        )
      )
      AND (
        coalesce(trim(p_busca),'')=''
        OR p.numero ILIKE '%'||trim(p_busca)||'%'
        OR coalesce(p.comprador_nome,'') ILIKE '%'||trim(p_busca)||'%'
        OR coalesce(p.comprador_email,'') ILIKE '%'||trim(p_busca)||'%'
        OR EXISTS (
          SELECT 1 FROM public.pedido_itens pi
          WHERE pi.pedido_id=p.id
            AND pi.nome_snapshot ILIKE '%'||trim(p_busca)||'%'
        )
      )
  ),
  agg AS (
    SELECT
      count(*) AS pedidos,
      count(*) FILTER (WHERE status_pagamento='pendente') AS pendentes,
      count(*) FILTER (WHERE status_pagamento IN ('confirmado','reembolsado_parcial','reembolsado_total')) AS confirmados,
      coalesce(sum(valor_total) FILTER (
        WHERE status_pagamento IN ('confirmado','reembolsado_parcial','reembolsado_total')
      ),0) AS bruto,
      coalesce(sum(valor_taxas) FILTER (
        WHERE status_pagamento IN ('confirmado','reembolsado_parcial','reembolsado_total')
      ),0) AS taxas,
      coalesce(sum(valor_comissoes) FILTER (
        WHERE status_pagamento IN ('confirmado','reembolsado_parcial','reembolsado_total')
      ),0) AS comissoes,
      coalesce(sum(valor_devolvido),0) AS devolucoes
    FROM filtered
  )
  SELECT
    pedidos,
    pendentes,
    confirmados,
    round(bruto,2),
    round(taxas,2),
    round(comissoes,2),
    round(devolucoes,2),
    greatest(round(bruto-taxas-comissoes-devolucoes,2),0),
    CASE WHEN confirmados>0 THEN round(bruto/confirmados,2) ELSE 0 END
  FROM agg;
$$;

REVOKE ALL ON FUNCTION public.fn_vendas_resumo(text,text,text,uuid,timestamptz,timestamptz)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_vendas_resumo(text,text,text,uuid,timestamptz,timestamptz)
TO authenticated;

COMMENT ON FUNCTION public.fn_vendas_resumo(text,text,text,uuid,timestamptz,timestamptz)
IS 'Indicadores: faturamento_bruto=soma do total de pedidos com pagamento confirmado; taxas=taxas registradas da operação; comissoes=comissoes efetivamente registradas; devolucoes=valor efetivamente devolvido; valor_liquido=bruto-taxas-comissoes-devolucoes. Data de referência=confirmado_em, ou criado_em enquanto pendente.';
