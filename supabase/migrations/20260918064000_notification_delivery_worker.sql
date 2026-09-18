-- Cash Engine PRO — fila e payloads server-side para entrega de notificações.
-- Somente service_role/backend pode consumir e concluir tentativas.

CREATE OR REPLACE FUNCTION public.fn_notification_delivery_claim(p_limit integer DEFAULT 25)
RETURNS TABLE(
  delivery_id uuid,
  notificacao_id uuid,
  profile_id uuid,
  canal text,
  tentativa integer,
  titulo text,
  mensagem text,
  url_destino text,
  email_destino text,
  push_subscriptions jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_key text;
BEGIN
  IF current_user NOT IN ('service_role','postgres','supabase_admin') THEN
    RAISE EXCEPTION 'trusted_backend_required';
  END IF;

  v_key:=current_setting('app.push_encryption_key',true);

  RETURN QUERY
  WITH claimed AS (
    SELECT d.id
    FROM public.notificacoes_entregas d
    WHERE d.status IN ('pendente','falhou')
      AND (d.proxima_tentativa_em IS NULL OR d.proxima_tentativa_em<=now())
      AND d.tentativa<=5
    ORDER BY d.created_at,d.id
    FOR UPDATE SKIP LOCKED
    LIMIT greatest(1,least(coalesce(p_limit,25),100))
  ),
  updated AS (
    UPDATE public.notificacoes_entregas d
    SET status='pendente',
        updated_at=now()
    FROM claimed c
    WHERE d.id=c.id
    RETURNING d.*
  )
  SELECT
    d.id,
    d.notificacao_id,
    d.profile_id,
    d.canal,
    d.tentativa,
    n.titulo::text,
    n.mensagem,
    n.url_destino,
    p.email::text,
    CASE
      WHEN d.canal='push' AND coalesce(v_key,'')<>''
      THEN coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'subscription_id',s.id,
          'endpoint',pgp_sym_decrypt(decode(s.endpoint_ciphertext,'base64'),v_key),
          'p256dh',pgp_sym_decrypt(decode(s.p256dh_ciphertext,'base64'),v_key),
          'auth',pgp_sym_decrypt(decode(s.auth_ciphertext,'base64'),v_key),
          'device_id',s.device_id
        ))
        FROM public.notificacoes_push_inscricoes s
        WHERE s.profile_id=d.profile_id AND s.ativo
      ),'[]'::jsonb)
      ELSE '[]'::jsonb
    END
  FROM updated d
  JOIN public.notificacoes n ON n.id=d.notificacao_id
  LEFT JOIN public.profiles p ON p.id=d.profile_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_notification_delivery_claim(integer)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_notification_delivery_claim(integer)
TO service_role;

CREATE OR REPLACE FUNCTION public.fn_notification_delivery_finish(
  p_delivery_id uuid,
  p_success boolean,
  p_provider_id text DEFAULT NULL,
  p_error text DEFAULT NULL,
  p_retry_after_seconds integer DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_row public.notificacoes_entregas%ROWTYPE;
BEGIN
  IF current_user NOT IN ('service_role','postgres','supabase_admin') THEN
    RAISE EXCEPTION 'trusted_backend_required';
  END IF;

  SELECT * INTO v_row
  FROM public.notificacoes_entregas
  WHERE id=p_delivery_id
  FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  IF p_success THEN
    UPDATE public.notificacoes_entregas
    SET status='enviado',
        provedor_id=nullif(trim(coalesce(p_provider_id,'')),''),
        erro=NULL,
        proxima_tentativa_em=NULL,
        updated_at=now()
    WHERE id=p_delivery_id;

    UPDATE public.notificacoes
    SET
      email_enviado=CASE WHEN v_row.canal='email' THEN true ELSE email_enviado END,
      data_envio_email=CASE WHEN v_row.canal='email' THEN now() ELSE data_envio_email END,
      id_email_provedor=CASE WHEN v_row.canal='email' THEN p_provider_id ELSE id_email_provedor END,
      push_enviado=CASE WHEN v_row.canal='push' THEN true ELSE push_enviado END,
      data_envio_push=CASE WHEN v_row.canal='push' THEN now() ELSE data_envio_push END,
      updated_at=now()
    WHERE id=v_row.notificacao_id;
  ELSE
    IF v_row.tentativa>=5 OR p_retry_after_seconds IS NULL THEN
      UPDATE public.notificacoes_entregas
      SET status=CASE WHEN v_row.tentativa>=5 THEN 'descartado' ELSE 'falhou' END,
          erro=left(coalesce(p_error,'delivery_failed'),1000),
          proxima_tentativa_em=NULL,
          updated_at=now()
      WHERE id=p_delivery_id;
    ELSE
      UPDATE public.notificacoes_entregas
      SET status='falhou',
          erro=left(coalesce(p_error,'delivery_failed'),1000),
          proxima_tentativa_em=now()+make_interval(secs=>greatest(60,p_retry_after_seconds)),
          updated_at=now()
      WHERE id=p_delivery_id;

      INSERT INTO public.notificacoes_entregas(
        notificacao_id,profile_id,canal,tentativa,status,proxima_tentativa_em
      ) VALUES (
        v_row.notificacao_id,v_row.profile_id,v_row.canal,
        v_row.tentativa+1,'pendente',
        now()+make_interval(secs=>greatest(60,p_retry_after_seconds))
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_notification_delivery_finish(
  uuid,boolean,text,text,integer
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_notification_delivery_finish(
  uuid,boolean,text,text,integer
) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_push_subscription_fail(
  p_subscription_id uuid,
  p_error text,
  p_expired boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  IF current_user NOT IN ('service_role','postgres','supabase_admin') THEN
    RAISE EXCEPTION 'trusted_backend_required';
  END IF;

  UPDATE public.notificacoes_push_inscricoes
  SET erro_ultimo=left(coalesce(p_error,'push_failed'),1000),
      erro_em=now(),
      ativo=CASE WHEN p_expired THEN false ELSE ativo END,
      updated_at=now()
  WHERE id=p_subscription_id;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_push_subscription_fail(uuid,text,boolean)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_push_subscription_fail(uuid,text,boolean)
TO service_role;

CREATE OR REPLACE FUNCTION public.fn_push_subscription_success(p_subscription_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  IF current_user NOT IN ('service_role','postgres','supabase_admin') THEN
    RAISE EXCEPTION 'trusted_backend_required';
  END IF;
  UPDATE public.notificacoes_push_inscricoes
  SET ultimo_sucesso_em=now(),erro_ultimo=NULL,erro_em=NULL,updated_at=now()
  WHERE id=p_subscription_id;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_push_subscription_success(uuid)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_push_subscription_success(uuid)
TO service_role;
