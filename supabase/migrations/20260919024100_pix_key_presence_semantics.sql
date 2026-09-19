-- O campo `configurado` deste RPC representa somente a existência de uma
-- chave Pix armazenada. O valor da chave nunca é devolvido ao navegador.

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
    NULL::text,
    nullif(v_nome,''),
    nullif(v_cidade,''),
    v_chave<>'';
END;
$function$;
