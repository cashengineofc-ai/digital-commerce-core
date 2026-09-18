-- Cash Engine PRO — eventos reais de notificação.
-- Não dispara "venda paga" na criação de Pix; somente transição real para confirmado.

CREATE OR REPLACE FUNCTION public.fn_profile_tem_permissao(
  p_profile_id uuid,
  p_empresa_id uuid,
  p_modulo text,
  p_recurso text,
  p_acao public.tipo_operacao
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.profiles p
    WHERE p.id=p_profile_id
      AND p.deleted_at IS NULL
      AND p.status='ativo'
      AND (
        p.is_admin_global
        OR (p.empresa_id=p_empresa_id AND p.is_owner)
        OR EXISTS(
          SELECT 1
          FROM public.profile_roles pr
          JOIN public.roles r ON r.id=pr.role_id
          WHERE pr.profile_id=p_profile_id
            AND pr.empresa_id=p_empresa_id
            AND (pr.expira_em IS NULL OR pr.expira_em>now())
            AND r.deleted_at IS NULL
            AND (r.empresa_id=p_empresa_id OR r.empresa_id IS NULL)
            AND (
              r.is_admin
              OR EXISTS(
                SELECT 1
                FROM public.role_permissions rp
                JOIN public.permissions perm ON perm.id=rp.permission_id
                WHERE rp.role_id=r.id
                  AND perm.modulo=p_modulo
                  AND perm.recurso=p_recurso
                  AND perm.acao=p_acao
              )
            )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.fn_profile_tem_permissao(
  uuid,uuid,text,text,public.tipo_operacao
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_profile_tem_permissao(
  uuid,uuid,text,text,public.tipo_operacao
) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_notificar_empresa_permitidos(
  p_empresa_id uuid,
  p_modulo text,
  p_recurso text,
  p_tipo public.tipo_notificacao,
  p_titulo text,
  p_mensagem text,
  p_entidade_tipo text,
  p_entidade_id uuid,
  p_url text,
  p_event_prefix text,
  p_dados jsonb DEFAULT '{}'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_profile uuid;
  v_count integer:=0;
BEGIN
  FOR v_profile IN
    SELECT p.id
    FROM public.profiles p
    WHERE p.deleted_at IS NULL
      AND p.status='ativo'
      AND (
        p.is_admin_global
        OR (
          p.empresa_id=p_empresa_id
          AND public.fn_profile_tem_permissao(
            p.id,p_empresa_id,p_modulo,p_recurso,'read'::public.tipo_operacao
          )
        )
      )
  LOOP
    IF public.fn_notificacao_criar(
      v_profile,p_empresa_id,p_tipo,p_titulo,p_mensagem,
      p_entidade_tipo,p_entidade_id,p_url,
      p_event_prefix||':'||v_profile::text,p_dados
    ) IS NOT NULL THEN
      v_count:=v_count+1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_notificar_empresa_permitidos(
  uuid,text,text,public.tipo_notificacao,text,text,text,uuid,text,text,jsonb
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_notificar_empresa_permitidos(
  uuid,text,text,public.tipo_notificacao,text,text,text,uuid,text,text,jsonb
) TO service_role;

CREATE OR REPLACE FUNCTION public.trg_notificar_pagamento_confirmado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  IF NEW.status_pagamento='confirmado'
     AND OLD.status_pagamento IS DISTINCT FROM NEW.status_pagamento THEN
    PERFORM public.fn_notificar_empresa_permitidos(
      NEW.empresa_id,
      'vendas','vendas','venda',
      'Pagamento confirmado',
      'O pedido '||NEW.numero||' teve o pagamento confirmado no valor de R$ '||
        to_char(NEW.valor_total,'FM999G999G990D00')||'.',
      'pedido',NEW.id,
      '/app/vendas?pedido='||NEW.id::text,
      'pedido-pago:'||NEW.id::text,
      jsonb_build_object(
        'pedido_numero',NEW.numero,
        'valor_total',NEW.valor_total,
        'metodo_pagamento',NEW.metodo_pagamento
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificar_pagamento_confirmado ON public.pedidos;
CREATE TRIGGER trg_notificar_pagamento_confirmado
AFTER UPDATE OF status_pagamento ON public.pedidos
FOR EACH ROW
EXECUTE FUNCTION public.trg_notificar_pagamento_confirmado();

CREATE OR REPLACE FUNCTION public.trg_notificar_saque_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_empresa uuid;
  v_profile uuid;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;

  SELECT coalesce(
    NEW.empresa_id,
    (SELECT p.empresa_id FROM public.profiles p WHERE p.id=NEW.profile_id),
    (SELECT a.empresa_id FROM public.afiliados a WHERE a.id=NEW.afiliado_id)
  ) INTO v_empresa;

  SELECT coalesce(
    NEW.profile_id,
    (SELECT a.profile_id FROM public.afiliados a WHERE a.id=NEW.afiliado_id)
  ) INTO v_profile;

  IF v_profile IS NOT NULL THEN
    PERFORM public.fn_notificacao_criar(
      v_profile,v_empresa,'saque',
      'Saque atualizado',
      'O saque '||NEW.protocolo||' agora está com status '||NEW.status::text||'.',
      'saque',NEW.id,
      '/app/saques?saque='||NEW.id::text,
      'saque-status:'||NEW.id::text||':'||NEW.status::text||':'||v_profile::text,
      jsonb_build_object(
        'protocolo',NEW.protocolo,
        'status',NEW.status::text,
        'valor',NEW.valor_solicitado
      )
    );
  END IF;

  IF v_empresa IS NOT NULL THEN
    PERFORM public.fn_notificar_empresa_permitidos(
      v_empresa,'financeiro','saques','saque',
      'Saque atualizado',
      'O saque '||NEW.protocolo||' mudou para '||NEW.status::text||'.',
      'saque',NEW.id,
      '/app/saques?saque='||NEW.id::text,
      'saque-financeiro:'||NEW.id::text||':'||NEW.status::text,
      jsonb_build_object(
        'protocolo',NEW.protocolo,
        'status',NEW.status::text,
        'valor',NEW.valor_solicitado
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificar_saque_status ON public.saques;
CREATE TRIGGER trg_notificar_saque_status
AFTER UPDATE OF status ON public.saques
FOR EACH ROW
EXECUTE FUNCTION public.trg_notificar_saque_status();

CREATE OR REPLACE FUNCTION public.trg_notificar_repasse_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;

  PERFORM public.fn_notificar_empresa_permitidos(
    NEW.empresa_id,'financeiro','repasses','financeiro',
    'Repasse atualizado',
    'O repasse para '||NEW.destinatario_nome||' agora está '||NEW.status::text||'.',
    'repasse',NEW.id,
    '/app/repasses?repasse='||NEW.id::text,
    'repasse-status:'||NEW.id::text||':'||NEW.status::text,
    jsonb_build_object(
      'status',NEW.status::text,
      'valor_liquido',NEW.valor_liquido,
      'destinatario',NEW.destinatario_nome
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificar_repasse_status ON public.repasses;
CREATE TRIGGER trg_notificar_repasse_status
AFTER UPDATE OF status ON public.repasses
FOR EACH ROW
EXECUTE FUNCTION public.trg_notificar_repasse_status();

CREATE OR REPLACE FUNCTION public.trg_notificar_estorno_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;

  IF NEW.solicitado_por IS NOT NULL THEN
    PERFORM public.fn_notificacao_criar(
      NEW.solicitado_por,NEW.empresa_id,'financeiro',
      'Devolução atualizada',
      'A devolução '||NEW.protocolo||' agora está '||NEW.status::text||'.',
      'estorno',NEW.id,
      '/app/estornos?estorno='||NEW.id::text,
      'estorno-solicitante:'||NEW.id::text||':'||NEW.status::text||':'||NEW.solicitado_por::text,
      jsonb_build_object(
        'protocolo',NEW.protocolo,
        'status',NEW.status::text,
        'valor_solicitado',NEW.valor_solicitado_estorno,
        'valor_efetivo',NEW.valor_efetivamente_estornado
      )
    );
  END IF;

  PERFORM public.fn_notificar_empresa_permitidos(
    NEW.empresa_id,'financeiro','estornos','financeiro',
    'Devolução atualizada',
    'A devolução '||NEW.protocolo||' mudou para '||NEW.status::text||'.',
    'estorno',NEW.id,
    '/app/estornos?estorno='||NEW.id::text,
    'estorno-financeiro:'||NEW.id::text||':'||NEW.status::text,
    jsonb_build_object(
      'protocolo',NEW.protocolo,
      'status',NEW.status::text,
      'valor_solicitado',NEW.valor_solicitado_estorno,
      'valor_efetivo',NEW.valor_efetivamente_estornado
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificar_estorno_status ON public.estornos;
CREATE TRIGGER trg_notificar_estorno_status
AFTER UPDATE OF status ON public.estornos
FOR EACH ROW
EXECUTE FUNCTION public.trg_notificar_estorno_status();

CREATE OR REPLACE FUNCTION public.trg_notificar_convite_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_type public.tipo_notificacao;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  v_type:=CASE WHEN NEW.tipo='afiliado' THEN 'afiliado'::public.tipo_notificacao
               ELSE 'sistema'::public.tipo_notificacao END;

  PERFORM public.fn_notificacao_criar(
    NEW.convidado_por,NEW.empresa_id,v_type,
    'Convite atualizado',
    'O convite de '||NEW.email||' agora está '||NEW.status||'.',
    'invite',NEW.id,
    CASE WHEN NEW.tipo='afiliado' THEN '/app/afiliados' ELSE '/app/configuracoes/equipe' END,
    'invite-status:'||NEW.id::text||':'||NEW.status||':'||NEW.convidado_por::text,
    jsonb_build_object(
      'email',NEW.email,
      'tipo',NEW.tipo,
      'status',NEW.status
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificar_convite_status ON public.invites;
CREATE TRIGGER trg_notificar_convite_status
AFTER UPDATE OF status ON public.invites
FOR EACH ROW
EXECUTE FUNCTION public.trg_notificar_convite_status();

CREATE OR REPLACE FUNCTION public.trg_notificar_ticket_mensagem()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_ticket public.tickets%ROWTYPE;
  v_profile uuid;
BEGIN
  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE id=NEW.ticket_id;

  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Resposta humana/agente -> usuário dono do chamado.
  IF NEW.tipo_remetente='agente'
     AND NOT NEW.eh_nota_interna
     AND NOT NEW.eh_resposta_automatica
     AND v_ticket.profile_id IS NOT NULL THEN
    PERFORM public.fn_notificacao_criar(
      v_ticket.profile_id,v_ticket.empresa_id,'suporte',
      'Nova resposta no atendimento',
      'Há uma nova resposta no chamado '||v_ticket.numero_protocolo||'.',
      'ticket',v_ticket.id,
      '/app/ajuda?ticket='||v_ticket.id::text,
      'ticket-reply:'||NEW.id::text||':'||v_ticket.profile_id::text,
      jsonb_build_object(
        'ticket',v_ticket.numero_protocolo,
        'message_id',NEW.id,
        'automatic',false
      )
    );
  END IF;

  -- Resposta do usuário/afiliado -> equipe com permissão de suporte.
  IF NEW.tipo_remetente IN ('cliente','afiliado')
     AND NOT NEW.eh_nota_interna THEN
    PERFORM public.fn_notificar_empresa_permitidos(
      v_ticket.empresa_id,'suporte','tickets','suporte',
      'Nova mensagem de atendimento',
      'O chamado '||v_ticket.numero_protocolo||' recebeu uma nova mensagem.',
      'ticket',v_ticket.id,
      '/admin/suporte?ticket='||v_ticket.id::text,
      'ticket-user-reply:'||NEW.id::text,
      jsonb_build_object(
        'ticket',v_ticket.numero_protocolo,
        'message_id',NEW.id
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificar_ticket_mensagem ON public.tickets_mensagens;
CREATE TRIGGER trg_notificar_ticket_mensagem
AFTER INSERT ON public.tickets_mensagens
FOR EACH ROW
EXECUTE FUNCTION public.trg_notificar_ticket_mensagem();

-- Registro de push só é permitido quando o canal estiver explicitamente configurado.
CREATE OR REPLACE FUNCTION public.fn_push_inscricao_registrar(
  p_device_id text,
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_enabled boolean:=false;
  v_key text;
  v_id uuid;
BEGIN
  SELECT coalesce((valor->>'enabled')::boolean,false)
  INTO v_enabled
  FROM public.admin_global_config
  WHERE chave='notifications.push';

  IF NOT v_enabled THEN RAISE EXCEPTION 'push_channel_not_configured'; END IF;

  v_key:=current_setting('app.push_encryption_key',true);
  IF coalesce(v_key,'')='' THEN
    RAISE EXCEPTION 'push_encryption_key_not_configured';
  END IF;

  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF trim(coalesce(p_device_id,''))='' OR trim(coalesce(p_endpoint,''))='' THEN
    RAISE EXCEPTION 'push_subscription_invalid';
  END IF;

  INSERT INTO public.notificacoes_push_inscricoes(
    profile_id,device_id,endpoint_hash,endpoint_ciphertext,
    p256dh_ciphertext,auth_ciphertext,user_agent,ativo,erro_ultimo,erro_em
  ) VALUES (
    auth.uid(),left(trim(p_device_id),200),
    encode(digest(trim(p_endpoint),'sha256'),'hex'),
    encode(pgp_sym_encrypt(trim(p_endpoint),v_key),'base64'),
    encode(pgp_sym_encrypt(trim(p_p256dh),v_key),'base64'),
    encode(pgp_sym_encrypt(trim(p_auth),v_key),'base64'),
    left(coalesce(p_user_agent,''),500),true,NULL,NULL
  )
  ON CONFLICT(profile_id,device_id)
  DO UPDATE SET
    endpoint_hash=excluded.endpoint_hash,
    endpoint_ciphertext=excluded.endpoint_ciphertext,
    p256dh_ciphertext=excluded.p256dh_ciphertext,
    auth_ciphertext=excluded.auth_ciphertext,
    user_agent=excluded.user_agent,
    ativo=true,
    erro_ultimo=NULL,
    erro_em=NULL,
    updated_at=now()
  RETURNING id INTO v_id;

  -- Se o mesmo endpoint havia ficado associado a outra conta, desativa o vínculo antigo.
  UPDATE public.notificacoes_push_inscricoes
  SET ativo=false,
      erro_ultimo='device_reassigned_to_another_account',
      erro_em=now(),
      updated_at=now()
  WHERE endpoint_hash=encode(digest(trim(p_endpoint),'sha256'),'hex')
    AND profile_id<>auth.uid()
    AND id<>v_id
    AND ativo;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_push_inscricao_registrar(text,text,text,text,text)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_push_inscricao_registrar(text,text,text,text,text)
TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_push_inscricao_desativar_device(p_device_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v_count integer;
BEGIN
  UPDATE public.notificacoes_push_inscricoes
  SET ativo=false,updated_at=now()
  WHERE profile_id=auth.uid()
    AND device_id=left(trim(p_device_id),200)
    AND ativo;
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_push_inscricao_desativar_device(text)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_push_inscricao_desativar_device(text)
TO authenticated;
