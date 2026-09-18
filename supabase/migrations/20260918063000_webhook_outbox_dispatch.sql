-- Cash Engine PRO — runtime de webhooks: outbox, assinatura, retry e idempotência.
-- Eventos só são enfileirados a partir de mudanças reais persistidas.

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

ALTER TABLE public.seguranca_webhooks
  ADD COLUMN IF NOT EXISTS segredo_vault_id uuid;

-- Move segredos legados para o Vault quando ainda estiverem armazenados diretamente.
DO $$
DECLARE
  w record;
  v_id uuid;
BEGIN
  FOR w IN
    SELECT id,empresa_id,segredo_assinatura
    FROM public.seguranca_webhooks
    WHERE segredo_vault_id IS NULL
      AND nullif(trim(segredo_assinatura),'') IS NOT NULL
      AND segredo_assinatura NOT LIKE 'vault:%'
  LOOP
    v_id:=vault.create_secret(
      w.segredo_assinatura,
      'cash_engine_webhook_'||w.id::text,
      'Segredo de assinatura de webhook do Cash Engine PRO'
    );
    UPDATE public.seguranca_webhooks
    SET segredo_vault_id=v_id,
        segredo_assinatura='vault:'||v_id::text,
        updated_at=now()
    WHERE id=w.id;
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS public.webhook_eventos_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  evento text NOT NULL,
  entidade_tipo text NOT NULL,
  entidade_id uuid NOT NULL,
  event_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_eventos_empresa_data
ON public.webhook_eventos_outbox(empresa_id,created_at DESC);

CREATE TABLE IF NOT EXISTS public.webhook_entregas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outbox_id uuid NOT NULL REFERENCES public.webhook_eventos_outbox(id) ON DELETE CASCADE,
  webhook_id uuid NOT NULL REFERENCES public.seguranca_webhooks(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pendente'
    CHECK(status IN ('pendente','processando','retry','sucesso','falhou')),
  tentativa_atual integer NOT NULL DEFAULT 0,
  max_tentativas integer NOT NULL DEFAULT 5,
  proxima_tentativa_em timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  last_error text,
  last_status integer,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(outbox_id,webhook_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_entregas_due
ON public.webhook_entregas(status,proxima_tentativa_em)
WHERE status IN ('pendente','retry');

ALTER TABLE public.webhook_eventos_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_entregas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.webhook_eventos_outbox FROM anon,authenticated;
REVOKE ALL ON public.webhook_entregas FROM anon,authenticated;

CREATE POLICY webhook_outbox_admin_read
ON public.webhook_eventos_outbox
FOR SELECT TO authenticated
USING(public.fn_is_admin_global());

CREATE POLICY webhook_deliveries_admin_read
ON public.webhook_entregas
FOR SELECT TO authenticated
USING(public.fn_is_admin_global());

CREATE OR REPLACE FUNCTION public.fn_webhook_event_match(
  p_subscriptions text[],
  p_event text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM unnest(coalesce(p_subscriptions,ARRAY[]::text[])) s
    WHERE s=p_event
       OR (right(s,2)='.*' AND p_event LIKE left(s,length(s)-1)||'%')
  );
$$;

CREATE OR REPLACE FUNCTION public.fn_webhook_enqueue(
  p_empresa_id uuid,
  p_event text,
  p_entidade_tipo text,
  p_entidade_id uuid,
  p_event_key text,
  p_payload jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v_outbox uuid;
BEGIN
  IF p_empresa_id IS NULL OR p_entidade_id IS NULL
     OR trim(coalesce(p_event,''))=''
     OR trim(coalesce(p_event_key,''))='' THEN
    RAISE EXCEPTION 'webhook_event_invalid';
  END IF;

  INSERT INTO public.webhook_eventos_outbox(
    empresa_id,evento,entidade_tipo,entidade_id,event_key,payload
  ) VALUES(
    p_empresa_id,p_event,p_entidade_tipo,p_entidade_id,p_event_key,
    coalesce(p_payload,'{}'::jsonb)
      || jsonb_build_object(
        'event',p_event,
        'event_id',p_event_key,
        'occurred_at',now()
      )
  )
  ON CONFLICT(event_key) DO NOTHING
  RETURNING id INTO v_outbox;

  IF v_outbox IS NULL THEN
    SELECT id INTO v_outbox
    FROM public.webhook_eventos_outbox
    WHERE event_key=p_event_key;
    RETURN v_outbox;
  END IF;

  INSERT INTO public.webhook_entregas(
    outbox_id,webhook_id,empresa_id,max_tentativas,proxima_tentativa_em
  )
  SELECT
    v_outbox,w.id,p_empresa_id,greatest(1,least(coalesce(w.tentativas_max,5),10)),now()
  FROM public.seguranca_webhooks w
  WHERE w.empresa_id=p_empresa_id
    AND w.ativo
    AND w.deleted_at IS NULL
    AND w.revogado_em IS NULL
    AND public.fn_webhook_event_match(w.eventos_ouvidos,p_event)
  ON CONFLICT(outbox_id,webhook_id) DO NOTHING;

  RETURN v_outbox;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_webhook_enqueue(
  uuid,text,text,uuid,text,jsonb
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_webhook_enqueue(
  uuid,text,text,uuid,text,jsonb
) TO service_role;

-- Trigger genérico que só observa fatos persistidos.
CREATE OR REPLACE FUNCTION public.fn_webhook_orders_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    PERFORM public.fn_webhook_enqueue(
      NEW.empresa_id,'order.created','pedido',NEW.id,
      'order.created:'||NEW.id::text,
      jsonb_build_object(
        'order_id',NEW.id,
        'order_number',NEW.numero,
        'amount',NEW.valor_total,
        'currency',NEW.moeda,
        'payment_status',NEW.status_pagamento,
        'payment_method',NEW.metodo_pagamento
      )
    );
    IF NEW.status_pagamento::text='pendente' THEN
      PERFORM public.fn_webhook_enqueue(
        NEW.empresa_id,'payment.pending','pedido',NEW.id,
        'payment.pending:'||NEW.id::text,
        jsonb_build_object(
          'order_id',NEW.id,'order_number',NEW.numero,
          'amount',NEW.valor_total,'payment_method',NEW.metodo_pagamento
        )
      );
    END IF;
  END IF;

  IF TG_OP='UPDATE'
     AND NEW.status_pagamento IS DISTINCT FROM OLD.status_pagamento THEN
    IF NEW.status_pagamento::text='confirmado' THEN
      PERFORM public.fn_webhook_enqueue(
        NEW.empresa_id,'payment.confirmed','pedido',NEW.id,
        'payment.confirmed:'||NEW.id::text,
        jsonb_build_object(
          'order_id',NEW.id,'order_number',NEW.numero,
          'amount',NEW.valor_total,'payment_method',NEW.metodo_pagamento,
          'confirmed_at',NEW.confirmado_em
        )
      );
    ELSIF NEW.status_pagamento::text IN ('falhou','cancelado') THEN
      PERFORM public.fn_webhook_enqueue(
        NEW.empresa_id,'payment.failed','pedido',NEW.id,
        'payment.failed:'||NEW.id::text||':'||NEW.status_pagamento::text,
        jsonb_build_object(
          'order_id',NEW.id,'order_number',NEW.numero,
          'payment_status',NEW.status_pagamento
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_webhook_orders ON public.pedidos;
CREATE TRIGGER trg_webhook_orders
AFTER INSERT OR UPDATE OF status_pagamento
ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.fn_webhook_orders_trigger();

CREATE OR REPLACE FUNCTION public.fn_webhook_refund_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status::text='concluido' THEN
    PERFORM public.fn_webhook_enqueue(
      NEW.empresa_id,'refund.completed','estorno',NEW.id,
      'refund.completed:'||NEW.id::text,
      jsonb_build_object(
        'refund_id',NEW.id,
        'protocol',NEW.protocolo,
        'transaction_id',NEW.transacao_id,
        'amount',NEW.valor_efetivamente_estornado,
        'completed_at',NEW.data_conclusao
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_webhook_refund ON public.estornos;
CREATE TRIGGER trg_webhook_refund
AFTER UPDATE OF status ON public.estornos
FOR EACH ROW EXECUTE FUNCTION public.fn_webhook_refund_trigger();

CREATE OR REPLACE FUNCTION public.fn_webhook_withdrawal_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status::text='pago' THEN
    PERFORM public.fn_webhook_enqueue(
      NEW.empresa_id,'withdrawal.paid','saque',NEW.id,
      'withdrawal.paid:'||NEW.id::text,
      jsonb_build_object(
        'withdrawal_id',NEW.id,
        'protocol',NEW.protocolo,
        'requested_amount',NEW.valor_solicitado,
        'net_amount',NEW.valor_liquido,
        'paid_at',NEW.data_pagamento,
        'reconciliation_reference',NEW.referencia_conciliacao
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_webhook_withdrawal ON public.saques;
CREATE TRIGGER trg_webhook_withdrawal
AFTER UPDATE OF status ON public.saques
FOR EACH ROW EXECUTE FUNCTION public.fn_webhook_withdrawal_trigger();

CREATE OR REPLACE FUNCTION public.fn_webhook_commission_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status::text IN ('aprovada','liberada') THEN
    PERFORM public.fn_webhook_enqueue(
      NEW.empresa_id,'affiliate.commission.approved','comissao',NEW.id,
      'affiliate.commission.approved:'||NEW.id::text,
      jsonb_build_object(
        'commission_id',NEW.id,
        'affiliate_id',NEW.afiliado_id,
        'transaction_id',NEW.transacao_id,
        'amount',greatest(NEW.valor_comissao_liquida-coalesce(NEW.valor_estornado,0),0),
        'status',NEW.status
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_webhook_commission ON public.comissoes;
CREATE TRIGGER trg_webhook_commission
AFTER UPDATE OF status ON public.comissoes
FOR EACH ROW EXECUTE FUNCTION public.fn_webhook_commission_trigger();

-- Claim de entregas por worker service_role. SKIP LOCKED permite concorrência segura.
CREATE OR REPLACE FUNCTION public.fn_webhook_dispatch_claim(p_limit integer DEFAULT 20)
RETURNS TABLE(
  delivery_id uuid,
  webhook_id uuid,
  evento text,
  payload jsonb,
  endpoint_url text,
  signing_secret text,
  custom_headers jsonb,
  timeout_ms integer,
  attempt integer,
  max_attempts integer,
  idempotency_key text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,vault
AS $$
BEGIN
  IF current_setting('role',true)<>'service_role' THEN
    RAISE EXCEPTION 'service_role_required';
  END IF;

  RETURN QUERY
  WITH due AS (
    SELECT d.id
    FROM public.webhook_entregas d
    JOIN public.seguranca_webhooks w ON w.id=d.webhook_id
    WHERE d.status IN ('pendente','retry')
      AND d.proxima_tentativa_em<=now()
      AND w.ativo
      AND w.deleted_at IS NULL
      AND w.revogado_em IS NULL
    ORDER BY d.proxima_tentativa_em,d.id
    FOR UPDATE OF d SKIP LOCKED
    LIMIT greatest(1,least(coalesce(p_limit,20),100))
  ),
  claimed AS (
    UPDATE public.webhook_entregas d
    SET status='processando',
        tentativa_atual=d.tentativa_atual+1,
        claimed_at=now(),
        updated_at=now()
    FROM due
    WHERE d.id=due.id
    RETURNING d.*
  )
  SELECT
    d.id,
    w.id,
    o.evento,
    o.payload,
    w.url_endpoint,
    coalesce(ds.decrypted_secret,
      CASE WHEN w.segredo_assinatura NOT LIKE 'vault:%'
        THEN w.segredo_assinatura ELSE NULL END
    ),
    coalesce(w.headers_personalizados,'{}'::jsonb),
    greatest(1000,least(coalesce(w.tempo_limite_ms,10000),30000)),
    d.tentativa_atual,
    d.max_tentativas,
    o.event_key
  FROM claimed d
  JOIN public.webhook_eventos_outbox o ON o.id=d.outbox_id
  JOIN public.seguranca_webhooks w ON w.id=d.webhook_id
  LEFT JOIN vault.decrypted_secrets ds ON ds.id=w.segredo_vault_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_webhook_dispatch_claim(integer)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_webhook_dispatch_claim(integer)
TO service_role;

CREATE OR REPLACE FUNCTION public.fn_webhook_dispatch_complete(
  p_delivery_id uuid,
  p_success boolean,
  p_status integer,
  p_duration_ms integer,
  p_response_headers jsonb,
  p_response_body text,
  p_error text,
  p_signature text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  d public.webhook_entregas%ROWTYPE;
  w public.seguranca_webhooks%ROWTYPE;
  o public.webhook_eventos_outbox%ROWTYPE;
  v_next timestamptz;
  v_final boolean;
BEGIN
  IF current_setting('role',true)<>'service_role' THEN
    RAISE EXCEPTION 'service_role_required';
  END IF;

  SELECT * INTO d FROM public.webhook_entregas
  WHERE id=p_delivery_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT * INTO w FROM public.seguranca_webhooks WHERE id=d.webhook_id;
  SELECT * INTO o FROM public.webhook_eventos_outbox WHERE id=d.outbox_id;
  IF NOT FOUND THEN RETURN false; END IF;

  v_final := p_success OR d.tentativa_atual>=d.max_tentativas;
  v_next := now() + make_interval(
    secs => least(
      greatest(coalesce(w.intervalo_entre_tentativas,300),10)
        * power(2,greatest(d.tentativa_atual-1,0))::integer,
      86400
    )
  );

  UPDATE public.webhook_entregas
  SET status=CASE
        WHEN p_success THEN 'sucesso'
        WHEN v_final THEN 'falhou'
        ELSE 'retry'
      END,
      proxima_tentativa_em=CASE WHEN p_success OR v_final THEN proxima_tentativa_em ELSE v_next END,
      last_error=CASE WHEN p_success THEN NULL ELSE left(coalesce(p_error,'delivery_failed'),1000) END,
      last_status=p_status,
      completed_at=CASE WHEN p_success OR v_final THEN now() ELSE NULL END,
      claimed_at=NULL,
      updated_at=now()
  WHERE id=d.id;

  INSERT INTO public.seguranca_webhooks_log(
    webhook_id,evento,corpo_requisicao,headers_resposta,corpo_resposta,
    status_resposta,tempo_resposta_ms,tentativa_numero,max_tentativas,
    sucesso,mensagem_erro,assinatura_enviada,idempotency_key
  ) VALUES(
    w.id,o.evento,o.payload,coalesce(p_response_headers,'{}'::jsonb),
    left(coalesce(p_response_body,''),4000),p_status,p_duration_ms,
    d.tentativa_atual,d.max_tentativas,p_success,
    left(p_error,1000),p_signature,o.event_key
  );

  UPDATE public.seguranca_webhooks
  SET data_ultimo_disparo=now(),
      total_disparos=coalesce(total_disparos,0)+1,
      total_sucessos=coalesce(total_sucessos,0)+CASE WHEN p_success THEN 1 ELSE 0 END,
      total_falhas=coalesce(total_falhas,0)+CASE WHEN p_success THEN 0 ELSE 1 END,
      ultima_resposta_status=p_status,
      ultima_resposta_corpo=left(coalesce(p_response_body,p_error,''),2000),
      updated_at=now()
  WHERE id=w.id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_webhook_dispatch_complete(
  uuid,boolean,integer,integer,jsonb,text,text,text
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_webhook_dispatch_complete(
  uuid,boolean,integer,integer,jsonb,text,text,text
) TO service_role;

-- Override da criação para novo segredo ir direto ao Vault.
CREATE OR REPLACE FUNCTION public.fn_dev_webhook_create(
  p_empresa_id uuid,
  p_nome text,
  p_url text,
  p_eventos text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,vault
AS $$
DECLARE
  v_secret text;
  v_prefix text;
  v_secret_id uuid;
  v_id uuid;
  v_events text[];
  v_allowed constant text[]:=ARRAY[
    'pedido.*','transacao.*','estorno.*','saque.*','comissao.*',
    'order.created','payment.pending','payment.confirmed','payment.failed',
    'refund.completed','withdrawal.paid','affiliate.commission.approved'
  ]::text[];
  v_url text:=trim(coalesce(p_url,''));
BEGIN
  IF NOT public.fn_is_admin_global() THEN RAISE EXCEPTION 'platform_admin_required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.empresas WHERE id=p_empresa_id AND deleted_at IS NULL)
    THEN RAISE EXCEPTION 'company_not_found'; END IF;
  IF trim(coalesce(p_nome,''))='' THEN RAISE EXCEPTION 'webhook_name_required'; END IF;
  IF v_url !~* '^https://[^[:space:]]+$'
     OR lower(v_url) ~ 'https://(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|169\.254\.|\[?::1\]?|[^/]*\.local([/:]|$))'
     OR lower(v_url) ~ 'https://172\.(1[6-9]|2[0-9]|3[01])\.' THEN
    RAISE EXCEPTION 'webhook_url_not_allowed';
  END IF;

  SELECT array_agg(DISTINCT event_name ORDER BY event_name)
  INTO v_events
  FROM unnest(coalesce(p_eventos,ARRAY[]::text[])) event_name;
  IF coalesce(cardinality(v_events),0)=0 OR NOT (v_events <@ v_allowed)
    THEN RAISE EXCEPTION 'webhook_events_invalid'; END IF;

  v_secret:='whsec_'||encode(gen_random_bytes(32),'hex');
  v_prefix:=left(v_secret,18);
  v_secret_id:=vault.create_secret(
    v_secret,'cash_engine_webhook_new_'||gen_random_uuid()::text,
    'Segredo de assinatura de webhook'
  );

  INSERT INTO public.seguranca_webhooks(
    empresa_id,profile_id,nome,url_endpoint,metodo_http,eventos_ouvidos,
    segredo_assinatura,segredo_vault_id,segredo_prefixo,algoritmo_assinatura,ativo
  ) VALUES(
    p_empresa_id,auth.uid(),trim(p_nome),v_url,'POST',v_events,
    'vault:'||v_secret_id::text,v_secret_id,v_prefix,'sha256',true
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id',v_id,'signing_secret',v_secret,'secret_prefix',v_prefix,
    'url',v_url,'events',v_events
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_dev_webhook_create(uuid,text,text,text[])
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_dev_webhook_create(uuid,text,text,text[])
TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_dev_webhook_revoke(p_webhook_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,vault
AS $$
DECLARE v_company uuid; v_secret uuid;
BEGIN
  IF NOT public.fn_is_admin_global() THEN RAISE EXCEPTION 'platform_admin_required'; END IF;

  SELECT empresa_id,segredo_vault_id INTO v_company,v_secret
  FROM public.seguranca_webhooks
  WHERE id=p_webhook_id AND deleted_at IS NULL AND revogado_em IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.seguranca_webhooks
  SET ativo=false,revogado_em=now(),revogado_por=auth.uid(),
      segredo_vault_id=NULL,segredo_assinatura='revoked',updated_at=now()
  WHERE id=p_webhook_id;

  IF v_secret IS NOT NULL THEN DELETE FROM vault.secrets WHERE id=v_secret; END IF;

  INSERT INTO public.seguranca_audit_log(
    empresa_id,profile_id,acao,modulo,entidade,entidade_id,descricao
  ) VALUES(v_company,auth.uid(),'delete','developers','webhook',p_webhook_id,'Webhook revogado');

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_dev_webhook_revoke(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_dev_webhook_revoke(uuid) TO authenticated;
