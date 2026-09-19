-- Cash Engine PRO
-- Fecha RPCs legados de escrita do checkout e evita devolver a chave Pix
-- sensível ao navegador do Admin Global.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_obter_config_pix_admin()
RETURNS TABLE(
  modo text,
  chave text,
  recebedor_nome text,
  recebedor_cidade text,
  configurado boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_modo text;
  v_chave text;
  v_nome text;
  v_cidade text;
BEGIN
  IF NOT public.fn_is_admin_global() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_modo := coalesce(
    (SELECT valor #>> '{}' FROM public.admin_global_config WHERE chave='pix_modo_recebimento'),
    'desativado'
  );
  v_chave := coalesce(
    (SELECT valor #>> '{}' FROM public.admin_global_config WHERE chave='pix_chave'),
    ''
  );
  v_nome := coalesce(
    (SELECT valor #>> '{}' FROM public.admin_global_config WHERE chave='pix_recebedor_nome'),
    ''
  );
  v_cidade := coalesce(
    (SELECT valor #>> '{}' FROM public.admin_global_config WHERE chave='pix_recebedor_cidade'),
    ''
  );

  RETURN QUERY SELECT
    v_modo,
    NULL::text, -- nunca devolve a chave Pix já salva ao cliente
    nullif(v_nome,''),
    nullif(v_cidade,''),
    CASE
      WHEN v_modo='chave' THEN v_chave<>'' AND v_nome<>'' AND v_cidade<>''
      WHEN v_modo='provedor' THEN true
      ELSE false
    END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_salvar_config_pix(
  p_modo text,
  p_chave text DEFAULT NULL::text,
  p_recebedor_nome text DEFAULT NULL::text,
  p_recebedor_cidade text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_modo text:=lower(trim(coalesce(p_modo,'')));
  v_chave text:=trim(coalesce(p_chave,''));
  v_existing_key text;
  v_nome text:=upper(trim(coalesce(p_recebedor_nome,'')));
  v_cidade text:=upper(trim(coalesce(p_recebedor_cidade,'')));
BEGIN
  IF NOT public.fn_is_admin_global() THEN
    RAISE EXCEPTION 'Apenas administrador da plataforma pode alterar Pix';
  END IF;

  IF v_modo NOT IN ('desativado','chave','provedor') THEN
    RAISE EXCEPTION 'Modo Pix inválido';
  END IF;

  SELECT valor #>> '{}'
  INTO v_existing_key
  FROM public.admin_global_config
  WHERE chave='pix_chave';

  -- Campo vazio significa “manter a chave atual”, nunca “devolver e reenviar”
  -- a credencial sensível ao navegador.
  IF v_chave='' THEN
    v_chave:=trim(coalesce(v_existing_key,''));
  END IF;

  IF v_modo='chave' THEN
    IF v_chave='' OR v_nome='' OR v_cidade='' THEN
      RAISE EXCEPTION 'Chave, recebedor e cidade são obrigatórios';
    END IF;
    IF octet_length(v_chave)>77 THEN
      RAISE EXCEPTION 'Chave Pix excede 77 bytes';
    END IF;
    IF char_length(v_nome)>25 OR char_length(v_cidade)>15 THEN
      RAISE EXCEPTION 'Nome ou cidade excede o limite do BR Code';
    END IF;
  END IF;

  INSERT INTO public.admin_global_config(
    chave,valor,tipo_valor,descricao,categoria,modulo,sensivel,publico,updated_by,updated_at
  ) VALUES(
    'pix_modo_recebimento',to_jsonb(v_modo),'string','Modo operacional Pix',
    'pagamentos','pix',false,false,auth.uid(),now()
  )
  ON CONFLICT(chave) DO UPDATE
    SET valor=excluded.valor,updated_by=excluded.updated_by,updated_at=now();

  INSERT INTO public.admin_global_config(
    chave,valor,tipo_valor,descricao,categoria,modulo,sensivel,publico,updated_by,updated_at
  ) VALUES(
    'pix_chave',to_jsonb(nullif(v_chave,'')),'string','Chave Pix para BR Code estático',
    'pagamentos','pix',true,false,auth.uid(),now()
  )
  ON CONFLICT(chave) DO UPDATE
    SET valor=excluded.valor,updated_by=excluded.updated_by,updated_at=now();

  INSERT INTO public.admin_global_config(
    chave,valor,tipo_valor,descricao,categoria,modulo,sensivel,publico,updated_by,updated_at
  ) VALUES(
    'pix_recebedor_nome',to_jsonb(nullif(v_nome,'')),'string','Recebedor Pix',
    'pagamentos','pix',false,false,auth.uid(),now()
  )
  ON CONFLICT(chave) DO UPDATE
    SET valor=excluded.valor,updated_by=excluded.updated_by,updated_at=now();

  INSERT INTO public.admin_global_config(
    chave,valor,tipo_valor,descricao,categoria,modulo,sensivel,publico,updated_by,updated_at
  ) VALUES(
    'pix_recebedor_cidade',to_jsonb(nullif(v_cidade,'')),'string','Cidade do recebedor Pix',
    'pagamentos','pix',false,false,auth.uid(),now()
  )
  ON CONFLICT(chave) DO UPDATE
    SET valor=excluded.valor,updated_by=excluded.updated_by,updated_at=now();
END;
$function$;

-- RPCs administrativos continuam acessíveis a authenticated, mas a própria
-- função exige Admin Global. Não há motivo para exposição à role anônima.
REVOKE EXECUTE ON FUNCTION public.fn_obter_config_pix_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_salvar_config_pix(text,text,text,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_listar_pix_manual_pendente() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fn_confirmar_pix_manual(uuid,text,text) FROM PUBLIC, anon;

-- A criação pública atual passa exclusivamente pela Edge Function, que chama
-- fn_checkout_criar_pedido_pix com service_role e snapshots publicados.
REVOKE EXECUTE ON FUNCTION public.fn_criar_pedido_checkout_pix(
  uuid,uuid,uuid,uuid[],numeric,uuid,uuid,uuid,text
) FROM PUBLIC, anon, authenticated;

-- Overload legado sem check granular de permissão. O editor atual usa a versão
-- de quatro argumentos, protegida por produtos/checkouts/update.
REVOKE EXECUTE ON FUNCTION public.fn_checkout_salvar_rascunho(uuid,jsonb)
FROM PUBLIC, anon, authenticated;

COMMIT;
