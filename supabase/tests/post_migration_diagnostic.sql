-- Cash Engine PRO — diagnóstico pós-migration (somente leitura).
-- Execute em ambiente de validação após aplicar todas as migrations.
-- Não cria, altera nem apaga dados.

DO $$
DECLARE
  v_missing text[];
  v_bad integer;
BEGIN
  SELECT array_agg(name ORDER BY name)
  INTO v_missing
  FROM (
    VALUES
      ('pedidos'),
      ('pedido_itens'),
      ('ofertas'),
      ('checkout_versoes'),
      ('checkout_order_bumps'),
      ('taxa_operacao_snapshots'),
      ('split_regras'),
      ('split_distribuicoes'),
      ('lancamentos_contabeis'),
      ('notificacoes_push_inscricoes'),
      ('notificacoes_entregas')
  ) expected(name)
  WHERE to_regclass('public.'||name) IS NULL;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Missing required tables: %',v_missing;
  END IF;

  SELECT count(*) INTO v_bad
  FROM public.taxas_plataforma
  WHERE ativo AND metodo_pagamento::text<>'pix';
  IF v_bad>0 THEN
    RAISE EXCEPTION 'Found % active non-Pix platform fee rules',v_bad;
  END IF;

  SELECT count(*) INTO v_bad
  FROM pg_policies
  WHERE schemaname='public'
    AND tablename IN ('admin_empresas_gestao','admin_banimentos','admin_moderacao')
    AND (
      qual IS NULL
      OR qual NOT ILIKE '%fn_is_admin_global%'
    );
  IF v_bad>0 THEN
    RAISE EXCEPTION 'Global-admin tables contain non-global policies';
  END IF;

  SELECT count(*) INTO v_bad
  FROM information_schema.routine_privileges
  WHERE specific_schema='public'
    AND grantee IN ('anon','authenticated','PUBLIC')
    AND routine_name IN (
      'fn_admin_bootstrap_platform',
      'fn_notification_delivery_claim',
      'fn_notification_delivery_finish',
      'fn_push_subscription_fail',
      'fn_push_subscription_success',
      'fn_notificacao_criar'
    );
  IF v_bad>0 THEN
    RAISE EXCEPTION 'Trusted backend functions are executable by browser roles';
  END IF;

  IF to_regprocedure('public.fn_is_admin_global()') IS NULL
     OR to_regprocedure('public.fn_tem_permissao(character varying,character varying,public.tipo_operacao)') IS NULL
     OR to_regprocedure('public.fn_pesquisa_global(text,integer)') IS NULL
     OR to_regprocedure('public.fn_notificacoes_me(integer,integer)') IS NULL
     OR to_regprocedure('public.fn_admin_dashboard_global(integer)') IS NULL
  THEN
    RAISE EXCEPTION 'One or more critical RPCs are missing';
  END IF;

  RAISE NOTICE 'Cash Engine PRO schema/security diagnostic passed.';
END $$;

-- Visão de conciliação estrutural por pedido real, sem modificar nada.
SELECT
  p.id,
  p.numero,
  p.status_pagamento,
  p.valor_total,
  p.valor_devolvido,
  coalesce(items.item_total,0) AS item_total,
  coalesce(items.item_count,0) AS item_count,
  coalesce(fees.fee_total,0) AS fee_total,
  coalesce(commissions.commission_net,0) AS commission_net,
  coalesce(split.split_net,0) AS split_net
FROM public.pedidos p
LEFT JOIN LATERAL (
  SELECT sum(i.total_snapshot) AS item_total,count(*) AS item_count
  FROM public.pedido_itens i
  WHERE i.pedido_id=p.id
) items ON true
LEFT JOIN LATERAL (
  SELECT sum(s.valor_calculado) AS fee_total
  FROM public.taxa_operacao_snapshots s
  WHERE s.pedido_id=p.id
) fees ON true
LEFT JOIN LATERAL (
  SELECT sum(greatest(c.valor_comissao_liquida-coalesce(c.valor_estornado,0),0)) AS commission_net
  FROM public.comissoes c
  JOIN public.transacoes t ON t.id=c.transacao_id
  WHERE t.pedido_id=p.id AND c.deleted_at IS NULL
) commissions ON true
LEFT JOIN LATERAL (
  SELECT sum(greatest(sd.valor_distribuido-sd.valor_revertido,0)) AS split_net
  FROM public.split_distribuicoes sd
  WHERE sd.pedido_id=p.id
) split ON true
WHERE p.status_pagamento IN ('confirmado','reembolsado_parcial','reembolsado_total')
ORDER BY p.confirmado_em DESC NULLS LAST
LIMIT 20;
