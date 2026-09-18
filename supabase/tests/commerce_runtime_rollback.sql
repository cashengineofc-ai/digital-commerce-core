-- Synthetic checkout regression. No provider is called, no funds are moved.
-- Run the complete file after commerce migrations; all fixtures are rolled back.
BEGIN;
SET LOCAL statement_timeout='30s';
DO $$
DECLARE u uuid:=gen_random_uuid(); e uuid; customer uuid;
BEGIN
  INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(u,u||'@example.invalid','{}');
  SELECT empresa_id INTO e FROM public.profiles WHERE id=u;
  INSERT INTO public.clientes(empresa_id,nome_completo,email) VALUES(e,'Rollback buyer',u||'@example.invalid') RETURNING id INTO customer;
  PERFORM set_config('test.commerce',jsonb_build_object('user',u,'company',e,'customer',customer)::text,true);
END $$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE t jsonb:=current_setting('test.commerce')::jsonb; p uuid; bump_product uuid; o uuid; c uuid; b uuid; l uuid;
BEGIN
  PERFORM set_config('request.jwt.claim.sub',t->>'user',true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  p:=public.fn_produto_salvar(NULL,'Rollback main',NULL,NULL,NULL,'{}','publicado',100,gen_random_uuid());
  bump_product:=public.fn_produto_salvar(NULL,'Rollback extra',NULL,NULL,NULL,'{}','publicado',25,gen_random_uuid());
  o:=public.fn_oferta_salvar(p_produto_id=>p,p_nome=>'Rollback offer',p_preco=>100,p_status=>'ativa');
  c:=public.fn_checkout_criar('Rollback checkout',o,'Regression');
  b:=public.fn_checkout_bump_salvar(c,NULL,bump_product,'Extra');
  PERFORM public.fn_checkout_publicar(c);
  SELECT vb.id INTO b FROM public.checkout_version_order_bumps vb
    JOIN public.checkouts ch ON ch.publicado_versao_id=vb.checkout_version_id
    WHERE ch.id=c AND vb.source_order_bump_id=b;
  l:=public.fn_link_pagamento_criar(c,'Rollback single-use link',p_uso_unico=>true);
  PERFORM public.fn_produtos_operacionais();
  PERFORM public.fn_ofertas_listar();
  PERFORM public.fn_checkouts_listar();
  PERFORM public.fn_links_pagamento_listar();
  PERFORM set_config('test.commerce',(t||jsonb_build_object('checkout',c,'bump',b,'link',l))::text,true);
END $$;
RESET ROLE;
SET LOCAL ROLE service_role;
DO $$
DECLARE t jsonb:=current_setting('test.commerce')::jsonb; k uuid:=gen_random_uuid(); first_order record; retry record;
BEGIN
  PERFORM set_config('request.jwt.claim.role','service_role',true);
  SELECT * INTO first_order FROM public.fn_checkout_criar_pedido_pix(
    (t->>'company')::uuid,(t->>'customer')::uuid,(t->>'checkout')::uuid,(t->>'link')::uuid,k,
    NULL,ARRAY[(t->>'bump')::uuid]);
  IF first_order.valor_total<>125 THEN RAISE EXCEPTION 'incorrect_order_total'; END IF;
  SELECT * INTO retry FROM public.fn_checkout_criar_pedido_pix(
    (t->>'company')::uuid,(t->>'customer')::uuid,(t->>'checkout')::uuid,(t->>'link')::uuid,k,
    NULL,ARRAY[(t->>'bump')::uuid]);
  IF retry.pedido_id<>first_order.pedido_id THEN RAISE EXCEPTION 'order_idempotency_failed'; END IF;
  BEGIN
    PERFORM public.fn_checkout_criar_pedido_pix(
      (t->>'company')::uuid,(t->>'customer')::uuid,(t->>'checkout')::uuid,(t->>'link')::uuid,gen_random_uuid(),NULL,'{}');
    RAISE EXCEPTION 'single_use_link_reused';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'payment_link_limit_reached' THEN RAISE; END IF;
  END;
  IF (SELECT status_pagamento FROM public.pedidos WHERE id=first_order.pedido_id)<>'pendente' THEN RAISE EXCEPTION 'unpaid_order_confirmed'; END IF;
  -- Simulate only the database event inside this rolled-back transaction.
  UPDATE public.transacoes SET status='paga',data_pagamento=now() WHERE id=first_order.transacao_id;
  PERFORM public.fn_processar_financeiro_transacao(first_order.transacao_id);
  PERFORM public.fn_processar_financeiro_transacao(first_order.transacao_id);
  IF (SELECT status_pagamento FROM public.pedidos WHERE id=first_order.pedido_id)<>'confirmado' THEN RAISE EXCEPTION 'paid_order_not_reconciled'; END IF;
  IF (SELECT sum(valor_distribuido) FROM public.split_distribuicoes WHERE transacao_id=first_order.transacao_id)<>125 THEN RAISE EXCEPTION 'split_total_mismatch'; END IF;
  IF (SELECT count(*) FROM public.lancamentos_contabeis WHERE idempotency_key='sale:'||first_order.transacao_id||':gross')<>1 THEN RAISE EXCEPTION 'duplicate_sale_ledger_entry'; END IF;

END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  PERFORM public.fn_vendas_operacionais();
  PERFORM public.fn_relatorio_resumo(current_date,current_date);
  PERFORM public.fn_pesquisa_global('Rollback',10);
  PERFORM public.fn_notificacoes_me();
  PERFORM public.fn_financeiro_saldo();
  PERFORM public.fn_saques_listar();
  PERFORM public.fn_extrato_financeiro_v2();
END $$;
RESET ROLE;
SELECT 'commerce settlement regression passed; fixtures rolled back' AS result;
ROLLBACK;
