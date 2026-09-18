-- Cash Engine PRO — fluxo real de afiliados, convites, autorização e rastreio.
-- Convites armazenam somente hash do token. E-mail não é enviado sem provedor configurado.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.invites
  ADD COLUMN IF NOT EXISTS revogado_em timestamptz,
  ADD COLUMN IF NOT EXISTS revogado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.afiliados
  ADD COLUMN IF NOT EXISTS status_alterado_em timestamptz,
  ADD COLUMN IF NOT EXISTS status_alterado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS encerrado_em timestamptz,
  ADD COLUMN IF NOT EXISTS encerrado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invite_afiliado_pendente_empresa_email
ON public.invites(empresa_id,lower(email),tipo)
WHERE tipo='afiliado' AND status='pendente';

CREATE TABLE IF NOT EXISTS public.cliques_afiliados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  link_afiliado_id uuid NOT NULL REFERENCES public.links_afiliados(id) ON DELETE RESTRICT,
  afiliado_id uuid NOT NULL REFERENCES public.afiliados(id) ON DELETE RESTRICT,
  produto_id uuid REFERENCES public.produtos(id) ON DELETE SET NULL,
  fingerprint_hash text NOT NULL,
  referrer text,
  contabilizado boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cliques_afiliados_link_data
ON public.cliques_afiliados(link_afiliado_id,created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cliques_afiliados_fingerprint
ON public.cliques_afiliados(link_afiliado_id,fingerprint_hash,created_at DESC);

ALTER TABLE public.cliques_afiliados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cliques_afiliados_tenant_read ON public.cliques_afiliados;
CREATE POLICY cliques_afiliados_tenant_read
ON public.cliques_afiliados
FOR SELECT TO authenticated
USING (
  public.fn_is_admin_global()
  OR empresa_id=public.current_empresa_id()
  OR afiliado_id IN (
    SELECT a.id
    FROM public.afiliados a
    WHERE a.profile_id=auth.uid() AND a.deleted_at IS NULL
  )
);

-- =========================================================
-- CONVITE SEGURO
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_afiliado_convite_criar(
  p_email text,
  p_nome text DEFAULT NULL,
  p_taxa_comissao numeric DEFAULT NULL,
  p_expira_dias integer DEFAULT 7
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,auth
AS $$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_id uuid;
  v_code text;
  v_token text;
  v_hash text;
  v_expira timestamptz;
  v_email text:=lower(trim(coalesce(p_email,'')));
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT (
    public.fn_is_admin_global()
    OR public.fn_is_empresa_owner(v_empresa)
    OR public.fn_tem_permissao('afiliados','afiliados','create'::public.tipo_operacao)
  ) THEN RAISE EXCEPTION 'permission_denied'; END IF;

  IF v_email='' OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'affiliate_invite_email_invalid';
  END IF;
  IF p_taxa_comissao IS NOT NULL AND (p_taxa_comissao<0 OR p_taxa_comissao>100) THEN
    RAISE EXCEPTION 'affiliate_commission_invalid';
  END IF;
  IF p_expira_dias IS NULL OR p_expira_dias<1 OR p_expira_dias>30 THEN
    RAISE EXCEPTION 'affiliate_invite_expiration_invalid';
  END IF;

  -- Libera o índice de pendentes para convites realmente expirados.
  UPDATE public.invites
  SET status='expirado',updated_at=now()
  WHERE empresa_id=v_empresa
    AND tipo='afiliado'
    AND lower(email)=v_email
    AND status='pendente'
    AND expira_em<=now();

  IF EXISTS(
    SELECT 1 FROM public.invites
    WHERE empresa_id=v_empresa
      AND tipo='afiliado'
      AND lower(email)=v_email
      AND status='pendente'
      AND expira_em>now()
  ) THEN RAISE EXCEPTION 'affiliate_invite_already_pending'; END IF;

  IF EXISTS(
    SELECT 1
    FROM public.afiliados a
    JOIN public.profiles p ON p.id=a.profile_id
    WHERE a.empresa_id=v_empresa
      AND lower(p.email)=v_email
      AND a.deleted_at IS NULL
      AND a.status IN ('pendente','ativo','suspenso')
  ) THEN RAISE EXCEPTION 'affiliate_relationship_already_exists'; END IF;

  v_code:='INV-'||upper(encode(gen_random_bytes(10),'hex'));
  v_token:=encode(gen_random_bytes(32),'hex');
  v_hash:=encode(digest(v_token,'sha256'),'hex');
  v_expira:=now()+(p_expira_dias||' days')::interval;

  INSERT INTO public.invites(
    empresa_id,convidado_por,tipo,email,nome,codigo_convite,token_hash,
    status,taxa_comissao_padrao,expira_em,metadata
  ) VALUES (
    v_empresa,auth.uid(),'afiliado',v_email,
    nullif(trim(coalesce(p_nome,'')),''),
    v_code,v_hash,'pendente',p_taxa_comissao,v_expira,
    jsonb_build_object('delivery','copy_link','email_sent',false)
  )
  RETURNING id INTO v_id;

  INSERT INTO public.seguranca_audit_log(
    empresa_id,profile_id,acao,modulo,entidade,entidade_id,descricao,detalhes
  ) VALUES (
    v_empresa,auth.uid(),'convite_enviado','afiliados','invite',v_id,
    'Convite de afiliado criado',
    jsonb_build_object(
      'email',v_email,
      'expira_em',v_expira,
      'delivery','copy_link',
      'email_sent',false
    )
  );

  RETURN jsonb_build_object(
    'invite_id',v_id,
    'code',v_code,
    'token',v_token,
    'expires_at',v_expira,
    'delivery','copy_link',
    'email_sent',false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_afiliado_convite_criar(text,text,numeric,integer)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_afiliado_convite_criar(text,text,numeric,integer)
TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_afiliado_convite_revogar(p_invite_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT (
    public.fn_is_admin_global()
    OR public.fn_is_empresa_owner(v_empresa)
    OR public.fn_tem_permissao('afiliados','afiliados','manage'::public.tipo_operacao)
  ) THEN RAISE EXCEPTION 'permission_denied'; END IF;

  UPDATE public.invites
  SET status='revogado',
      revogado_em=now(),
      revogado_por=auth.uid(),
      updated_at=now()
  WHERE id=p_invite_id
    AND empresa_id=v_empresa
    AND tipo='afiliado'
    AND status='pendente';

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_afiliado_convite_revogar(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_afiliado_convite_revogar(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_afiliado_convite_visualizar(
  p_code text,
  p_token text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_i public.invites%ROWTYPE;
  v_company text;
  v_hint text;
BEGIN
  IF trim(coalesce(p_code,''))='' OR trim(coalesce(p_token,''))='' THEN
    RAISE EXCEPTION 'affiliate_invite_invalid';
  END IF;

  SELECT * INTO v_i
  FROM public.invites
  WHERE codigo_convite=trim(p_code)
    AND tipo='afiliado'
  LIMIT 1;

  IF NOT FOUND
     OR v_i.token_hash<>encode(digest(trim(p_token),'sha256'),'hex') THEN
    RAISE EXCEPTION 'affiliate_invite_invalid';
  END IF;

  IF v_i.status<>'pendente' THEN RAISE EXCEPTION 'affiliate_invite_not_pending'; END IF;
  IF v_i.expira_em<=now() THEN RAISE EXCEPTION 'affiliate_invite_expired'; END IF;

  SELECT coalesce(nome_fantasia,razao_social,'Cash Engine PRO')
  INTO v_company
  FROM public.empresas
  WHERE id=v_i.empresa_id;

  v_hint:=CASE
    WHEN position('@' in v_i.email)>2
    THEN left(v_i.email,2)||'***'||substring(v_i.email from position('@' in v_i.email))
    ELSE '***'
  END;

  RETURN jsonb_build_object(
    'code',v_i.codigo_convite,
    'company_name',v_company,
    'name',v_i.nome,
    'email_hint',v_hint,
    'commission',v_i.taxa_comissao_padrao,
    'expires_at',v_i.expira_em
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_afiliado_convite_visualizar(text,text)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_afiliado_convite_visualizar(text,text)
TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.fn_afiliado_convite_aceitar(
  p_code text,
  p_token text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,auth
AS $$
DECLARE
  v_i public.invites%ROWTYPE;
  v_user_email text;
  v_affiliate uuid;
  v_code text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_i
  FROM public.invites
  WHERE codigo_convite=trim(coalesce(p_code,''))
    AND tipo='afiliado'
  FOR UPDATE;

  IF NOT FOUND
     OR v_i.token_hash<>encode(digest(trim(coalesce(p_token,'')),'sha256'),'hex') THEN
    RAISE EXCEPTION 'affiliate_invite_invalid';
  END IF;
  IF v_i.status<>'pendente' THEN RAISE EXCEPTION 'affiliate_invite_not_pending'; END IF;
  IF v_i.expira_em<=now() THEN
    UPDATE public.invites SET status='expirado',updated_at=now() WHERE id=v_i.id;
    RAISE EXCEPTION 'affiliate_invite_expired';
  END IF;

  SELECT lower(email) INTO v_user_email
  FROM auth.users
  WHERE id=auth.uid();

  IF v_user_email IS NULL OR v_user_email<>lower(v_i.email) THEN
    RAISE EXCEPTION 'affiliate_invite_wrong_account';
  END IF;

  SELECT id INTO v_affiliate
  FROM public.afiliados
  WHERE empresa_id=v_i.empresa_id
    AND profile_id=auth.uid()
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_affiliate IS NULL THEN
    LOOP
      v_code:='AFF-'||upper(encode(gen_random_bytes(8),'hex'));
      EXIT WHEN NOT EXISTS(
        SELECT 1 FROM public.afiliados WHERE codigo_afiliado=v_code
      );
    END LOOP;

    INSERT INTO public.afiliados(
      empresa_id,profile_id,convite_id,codigo_afiliado,taxa_comissao_padrao,
      status,status_alterado_em,metadata
    ) VALUES (
      v_i.empresa_id,auth.uid(),v_i.id,v_code,
      coalesce(v_i.taxa_comissao_padrao,30),
      'pendente',now(),
      jsonb_build_object('source','secure_invite')
    )
    RETURNING id INTO v_affiliate;
  ELSE
    UPDATE public.afiliados
    SET convite_id=v_i.id,
        status='pendente',
        taxa_comissao_padrao=coalesce(v_i.taxa_comissao_padrao,taxa_comissao_padrao),
        status_alterado_em=now(),
        updated_at=now()
    WHERE id=v_affiliate
      AND status IN ('inativo','banido');
  END IF;

  UPDATE public.invites
  SET status='aceito',
      aceito_em=now(),
      aceito_por=auth.uid(),
      updated_at=now()
  WHERE id=v_i.id;

  INSERT INTO public.seguranca_audit_log(
    empresa_id,profile_id,acao,modulo,entidade,entidade_id,descricao,detalhes
  ) VALUES (
    v_i.empresa_id,auth.uid(),'convite_aceito','afiliados','afiliado',v_affiliate,
    'Convite de afiliado aceito',
    jsonb_build_object('invite_id',v_i.id,'status','pendente_aprovacao')
  );

  RETURN v_affiliate;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_afiliado_convite_aceitar(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_afiliado_convite_aceitar(text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_afiliado_convites_listar()
RETURNS TABLE(
  id uuid,
  email text,
  nome text,
  status text,
  taxa_comissao numeric,
  expira_em timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v_empresa uuid:=public.current_empresa_id();
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT (
    public.fn_is_admin_global()
    OR public.fn_is_empresa_owner(v_empresa)
    OR public.fn_tem_permissao('afiliados','afiliados','read'::public.tipo_operacao)
  ) THEN RAISE EXCEPTION 'permission_denied'; END IF;

  RETURN QUERY
  SELECT
    i.id,i.email::text,i.nome::text,
    CASE
      WHEN i.status='pendente' AND i.expira_em<=now() THEN 'expirado'
      ELSE i.status
    END::text,
    i.taxa_comissao_padrao,
    i.expira_em,
    i.created_at
  FROM public.invites i
  WHERE i.empresa_id=v_empresa AND i.tipo='afiliado'
  ORDER BY i.created_at DESC
  LIMIT 200;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_afiliado_convites_listar() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_afiliado_convites_listar() TO authenticated;

-- =========================================================
-- STATUS / APROVAÇÃO DO VÍNCULO
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_afiliado_status_definir(
  p_afiliado_id uuid,
  p_status text,
  p_motivo text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_a public.afiliados%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT (
    public.fn_is_admin_global()
    OR public.fn_is_empresa_owner(v_empresa)
    OR public.fn_tem_permissao('afiliados','afiliados','manage'::public.tipo_operacao)
  ) THEN RAISE EXCEPTION 'permission_denied'; END IF;

  IF p_status NOT IN ('ativo','inativo','suspenso','banido') THEN
    RAISE EXCEPTION 'affiliate_status_invalid';
  END IF;

  SELECT * INTO v_a
  FROM public.afiliados
  WHERE id=p_afiliado_id
    AND empresa_id=v_empresa
    AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'affiliate_not_found'; END IF;

  IF p_status IN ('inativo','suspenso','banido')
     AND trim(coalesce(p_motivo,''))='' THEN
    RAISE EXCEPTION 'affiliate_status_reason_required';
  END IF;

  UPDATE public.afiliados
  SET status=p_status::public.status_afiliado,
      motivo_rejeicao=CASE
        WHEN p_status IN ('inativo','suspenso','banido') THEN trim(p_motivo)
        ELSE NULL
      END,
      data_aprovacao=CASE
        WHEN p_status='ativo' THEN coalesce(data_aprovacao,now())
        ELSE data_aprovacao
      END,
      aprovado_por=CASE
        WHEN p_status='ativo' THEN auth.uid()
        ELSE aprovado_por
      END,
      status_alterado_em=now(),
      status_alterado_por=auth.uid(),
      encerrado_em=CASE WHEN p_status IN ('inativo','banido') THEN now() ELSE NULL END,
      encerrado_por=CASE WHEN p_status IN ('inativo','banido') THEN auth.uid() ELSE NULL END,
      updated_at=now()
  WHERE id=v_a.id;

  IF p_status<>'ativo' THEN
    UPDATE public.links_afiliados
    SET status='desativado',updated_at=now()
    WHERE afiliado_id=v_a.id AND status='ativo';
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_afiliado_status_definir(uuid,text,text)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_afiliado_status_definir(uuid,text,text)
TO authenticated;

-- =========================================================
-- PRODUTOS AUTORIZADOS
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_afiliado_produto_definir(
  p_afiliado_id uuid,
  p_produto_id uuid,
  p_ativo boolean,
  p_percentual numeric DEFAULT NULL,
  p_valor_fixo numeric DEFAULT NULL,
  p_data_inicio timestamptz DEFAULT NULL,
  p_data_fim timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT (
    public.fn_is_admin_global()
    OR public.fn_is_empresa_owner(v_empresa)
    OR public.fn_tem_permissao('afiliados','afiliados','manage'::public.tipo_operacao)
  ) THEN RAISE EXCEPTION 'permission_denied'; END IF;

  IF NOT EXISTS(
    SELECT 1 FROM public.afiliados
    WHERE id=p_afiliado_id AND empresa_id=v_empresa AND deleted_at IS NULL
  ) THEN RAISE EXCEPTION 'affiliate_not_found'; END IF;

  IF NOT EXISTS(
    SELECT 1 FROM public.produtos
    WHERE id=p_produto_id AND empresa_id=v_empresa AND deleted_at IS NULL
  ) THEN RAISE EXCEPTION 'product_not_found'; END IF;

  IF p_percentual IS NOT NULL AND (p_percentual<0 OR p_percentual>100) THEN
    RAISE EXCEPTION 'affiliate_commission_invalid';
  END IF;
  IF p_valor_fixo IS NOT NULL AND p_valor_fixo<0 THEN
    RAISE EXCEPTION 'affiliate_fixed_commission_invalid';
  END IF;
  IF p_percentual IS NOT NULL AND p_valor_fixo IS NOT NULL THEN
    RAISE EXCEPTION 'affiliate_commission_rule_ambiguous';
  END IF;
  IF p_data_inicio IS NOT NULL AND p_data_fim IS NOT NULL AND p_data_fim<=p_data_inicio THEN
    RAISE EXCEPTION 'affiliate_authorization_period_invalid';
  END IF;

  INSERT INTO public.afiliados_produtos(
    afiliado_id,produto_id,empresa_id,taxa_comissao_personalizada,
    comissao_valor_fixo,data_inicio,data_fim,autorizado_em,autorizado_por,ativo
  ) VALUES (
    p_afiliado_id,p_produto_id,v_empresa,p_percentual,p_valor_fixo,
    p_data_inicio,p_data_fim,CASE WHEN p_ativo THEN now() ELSE NULL END,
    auth.uid(),p_ativo
  )
  ON CONFLICT(afiliado_id,produto_id)
  DO UPDATE SET
    taxa_comissao_personalizada=excluded.taxa_comissao_personalizada,
    comissao_valor_fixo=excluded.comissao_valor_fixo,
    data_inicio=excluded.data_inicio,
    data_fim=excluded.data_fim,
    autorizado_em=CASE WHEN excluded.ativo THEN now() ELSE afiliados_produtos.autorizado_em END,
    autorizado_por=auth.uid(),
    ativo=excluded.ativo,
    updated_at=now()
  RETURNING id INTO v_id;

  IF NOT p_ativo THEN
    UPDATE public.links_afiliados
    SET status='desativado',updated_at=now()
    WHERE afiliado_id=p_afiliado_id
      AND produto_id=p_produto_id
      AND status='ativo';
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_afiliado_produto_definir(
  uuid,uuid,boolean,numeric,numeric,timestamptz,timestamptz
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_afiliado_produto_definir(
  uuid,uuid,boolean,numeric,numeric,timestamptz,timestamptz
) TO authenticated;

-- =========================================================
-- LINK DE AFILIADO
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_afiliado_link_criar(
  p_afiliado_id uuid,
  p_produto_id uuid,
  p_checkout_id uuid DEFAULT NULL,
  p_link_pagamento_id uuid DEFAULT NULL,
  p_nome_campanha text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_empresa uuid;
  v_a public.afiliados%ROWTYPE;
  v_code text;
  v_dest text;
  v_checkout_token uuid;
  v_payment_token uuid;
  v_id uuid;
  v_self boolean:=false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_a
  FROM public.afiliados
  WHERE id=p_afiliado_id AND deleted_at IS NULL;
  IF NOT FOUND OR v_a.status<>'ativo' THEN RAISE EXCEPTION 'affiliate_not_active'; END IF;
  v_empresa:=v_a.empresa_id;
  v_self:=v_a.profile_id=auth.uid();

  IF NOT (
    v_self
    OR public.fn_is_admin_global()
    OR (
      public.current_empresa_id()=v_empresa
      AND (
        public.fn_is_empresa_owner(v_empresa)
        OR public.fn_tem_permissao('afiliados','links','create'::public.tipo_operacao)
      )
    )
  ) THEN RAISE EXCEPTION 'permission_denied'; END IF;

  IF NOT EXISTS(
    SELECT 1 FROM public.afiliados_produtos ap
    WHERE ap.afiliado_id=v_a.id
      AND ap.produto_id=p_produto_id
      AND ap.empresa_id=v_empresa
      AND ap.ativo
      AND (ap.data_inicio IS NULL OR ap.data_inicio<=now())
      AND (ap.data_fim IS NULL OR ap.data_fim>now())
  ) THEN RAISE EXCEPTION 'affiliate_not_authorized_for_product'; END IF;

  IF (p_checkout_id IS NULL)::int+(p_link_pagamento_id IS NULL)::int<>1 THEN
    RAISE EXCEPTION 'affiliate_link_requires_one_destination';
  END IF;

  IF p_checkout_id IS NOT NULL THEN
    SELECT public_token INTO v_checkout_token
    FROM public.checkouts
    WHERE id=p_checkout_id
      AND empresa_id=v_empresa
      AND produto_id=p_produto_id
      AND status='publicado'
      AND publicado_versao_id IS NOT NULL
      AND desativado_em IS NULL
      AND deleted_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'affiliate_checkout_invalid'; END IF;
    v_dest:='/checkout/'||v_checkout_token::text;
  ELSE
    SELECT public_token INTO v_payment_token
    FROM public.links_pagamento
    WHERE id=p_link_pagamento_id
      AND empresa_id=v_empresa
      AND produto_id=p_produto_id
      AND status='ativo'
      AND (data_expiracao IS NULL OR data_expiracao>now())
      AND deleted_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'affiliate_payment_link_invalid'; END IF;
    v_dest:='/pagar/'||v_payment_token::text;
  END IF;

  LOOP
    v_code:='AFFL-'||upper(encode(gen_random_bytes(10),'hex'));
    EXIT WHEN NOT EXISTS(
      SELECT 1 FROM public.links_afiliados WHERE codigo_rastreio=v_code
    );
  END LOOP;

  INSERT INTO public.links_afiliados(
    empresa_id,afiliado_id,produto_id,checkout_id,link_pagamento_id,
    nome_campanha,url_destino,codigo_rastreio,status,criado_por,
    data_inicio,metadata
  ) VALUES (
    v_empresa,v_a.id,p_produto_id,p_checkout_id,p_link_pagamento_id,
    nullif(trim(coalesce(p_nome_campanha,'')),''),
    v_dest,v_code,'ativo',auth.uid(),now(),
    jsonb_build_object('source','authorized_affiliate_link')
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_afiliado_link_criar(
  uuid,uuid,uuid,uuid,text
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_afiliado_link_criar(
  uuid,uuid,uuid,uuid,text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_afiliado_link_resolver(
  p_code text,
  p_fingerprint text,
  p_referrer text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_l public.links_afiliados%ROWTYPE;
  v_hash text;
  v_counted boolean:=false;
BEGIN
  IF trim(coalesce(p_code,''))='' THEN RAISE EXCEPTION 'affiliate_link_invalid'; END IF;
  IF trim(coalesce(p_fingerprint,''))='' OR length(p_fingerprint)>256 THEN
    RAISE EXCEPTION 'affiliate_fingerprint_invalid';
  END IF;

  SELECT * INTO v_l
  FROM public.links_afiliados
  WHERE codigo_rastreio=trim(p_code)
    AND status='ativo'
    AND deleted_at IS NULL
    AND (data_inicio IS NULL OR data_inicio<=now())
    AND (data_fim IS NULL OR data_fim>now())
  LIMIT 1;

  IF NOT FOUND THEN RAISE EXCEPTION 'affiliate_link_unavailable'; END IF;

  IF NOT EXISTS(
    SELECT 1
    FROM public.afiliados a
    JOIN public.afiliados_produtos ap
      ON ap.afiliado_id=a.id
     AND ap.produto_id=v_l.produto_id
     AND ap.empresa_id=v_l.empresa_id
    WHERE a.id=v_l.afiliado_id
      AND a.status='ativo'
      AND a.deleted_at IS NULL
      AND ap.ativo
      AND (ap.data_inicio IS NULL OR ap.data_inicio<=now())
      AND (ap.data_fim IS NULL OR ap.data_fim>now())
  ) THEN RAISE EXCEPTION 'affiliate_link_unavailable'; END IF;

  v_hash:=encode(digest(trim(p_fingerprint),'sha256'),'hex');

  IF NOT EXISTS(
    SELECT 1 FROM public.cliques_afiliados
    WHERE link_afiliado_id=v_l.id
      AND fingerprint_hash=v_hash
      AND created_at>now()-interval '10 minutes'
  ) THEN
    INSERT INTO public.cliques_afiliados(
      empresa_id,link_afiliado_id,afiliado_id,produto_id,
      fingerprint_hash,referrer,contabilizado
    ) VALUES (
      v_l.empresa_id,v_l.id,v_l.afiliado_id,v_l.produto_id,
      v_hash,left(nullif(trim(coalesce(p_referrer,'')),''),500),true
    );
    v_counted:=true;

    UPDATE public.links_afiliados
    SET total_cliques=coalesce(total_cliques,0)+1,
        updated_at=now()
    WHERE id=v_l.id;

    UPDATE public.afiliados
    SET total_cliques=coalesce(total_cliques,0)+1,
        updated_at=now()
    WHERE id=v_l.afiliado_id;
  END IF;

  RETURN jsonb_build_object(
    'destination',v_l.url_destino,
    'affiliate_code',v_l.codigo_rastreio,
    'counted',v_counted
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_afiliado_link_resolver(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_afiliado_link_resolver(text,text,text)
TO anon,authenticated;

-- =========================================================
-- CONSULTAS CANÔNICAS
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_afiliados_listar()
RETURNS TABLE(
  id uuid,
  profile_id uuid,
  nome text,
  email text,
  codigo text,
  status text,
  produtos_autorizados bigint,
  cliques bigint,
  vendas_confirmadas bigint,
  faturamento_bruto numeric,
  faturamento_liquido_devolucoes numeric,
  comissao_reconhecida numeric,
  comissao_estornada numeric,
  conversao numeric,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v_empresa uuid:=public.current_empresa_id();
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT (
    public.fn_is_admin_global()
    OR public.fn_is_empresa_owner(v_empresa)
    OR public.fn_tem_permissao('afiliados','afiliados','read'::public.tipo_operacao)
  ) THEN RAISE EXCEPTION 'permission_denied'; END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.profile_id,
    coalesce(p.nome_completo,'Afiliado sem perfil')::text,
    coalesce(p.email,'')::text,
    a.codigo_afiliado::text,
    a.status::text,
    (
      SELECT count(*)
      FROM public.afiliados_produtos ap
      WHERE ap.afiliado_id=a.id AND ap.ativo
        AND (ap.data_inicio IS NULL OR ap.data_inicio<=now())
        AND (ap.data_fim IS NULL OR ap.data_fim>now())
    ),
    (
      SELECT count(*)
      FROM public.cliques_afiliados ca
      WHERE ca.afiliado_id=a.id AND ca.contabilizado
    ),
    (
      SELECT count(*)
      FROM public.pedidos pd
      WHERE pd.afiliado_id=a.id
        AND pd.status_pagamento IN ('confirmado','reembolsado_parcial','reembolsado_total')
    ),
    coalesce((
      SELECT sum(pd.valor_total)
      FROM public.pedidos pd
      WHERE pd.afiliado_id=a.id
        AND pd.status_pagamento IN ('confirmado','reembolsado_parcial','reembolsado_total')
    ),0),
    coalesce((
      SELECT sum(greatest(pd.valor_total-pd.valor_devolvido,0))
      FROM public.pedidos pd
      WHERE pd.afiliado_id=a.id
        AND pd.status_pagamento IN ('confirmado','reembolsado_parcial','reembolsado_total')
    ),0),
    coalesce((
      SELECT sum(greatest(c.valor_comissao_liquida-coalesce(c.valor_estornado,0),0))
      FROM public.comissoes c
      WHERE c.afiliado_id=a.id
        AND c.deleted_at IS NULL
        AND c.status NOT IN ('cancelada','estornada')
    ),0),
    coalesce((
      SELECT sum(coalesce(c.valor_estornado,0))
      FROM public.comissoes c
      WHERE c.afiliado_id=a.id AND c.deleted_at IS NULL
    ),0),
    CASE
      WHEN (
        SELECT count(*) FROM public.cliques_afiliados ca
        WHERE ca.afiliado_id=a.id AND ca.contabilizado
      )>0
      THEN round(
        (
          SELECT count(*)::numeric FROM public.pedidos pd
          WHERE pd.afiliado_id=a.id
            AND pd.status_pagamento IN ('confirmado','reembolsado_parcial','reembolsado_total')
        )*100.0/
        (
          SELECT count(*)::numeric FROM public.cliques_afiliados ca
          WHERE ca.afiliado_id=a.id AND ca.contabilizado
        ),2
      )
      ELSE 0
    END,
    a.created_at
  FROM public.afiliados a
  LEFT JOIN public.profiles p ON p.id=a.profile_id
  WHERE a.empresa_id=v_empresa AND a.deleted_at IS NULL
  ORDER BY a.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_afiliados_listar() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_afiliados_listar() TO authenticated;

-- O próprio afiliado enxerga somente a própria operação.
DROP POLICY IF EXISTS afiliados_produtos_select_self ON public.afiliados_produtos;
CREATE POLICY afiliados_produtos_select_self
ON public.afiliados_produtos
FOR SELECT TO authenticated
USING (
  afiliado_id IN (
    SELECT a.id FROM public.afiliados a
    WHERE a.profile_id=auth.uid() AND a.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS links_afiliados_select_self ON public.links_afiliados;
CREATE POLICY links_afiliados_select_self
ON public.links_afiliados
FOR SELECT TO authenticated
USING (
  afiliado_id IN (
    SELECT a.id FROM public.afiliados a
    WHERE a.profile_id=auth.uid() AND a.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS comissoes_select_self ON public.comissoes;
CREATE POLICY comissoes_select_self
ON public.comissoes
FOR SELECT TO authenticated
USING (
  afiliado_id IN (
    SELECT a.id FROM public.afiliados a
    WHERE a.profile_id=auth.uid() AND a.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS pedidos_affiliate_self ON public.pedidos;
CREATE POLICY pedidos_affiliate_self
ON public.pedidos
FOR SELECT TO authenticated
USING (
  afiliado_id IN (
    SELECT a.id FROM public.afiliados a
    WHERE a.profile_id=auth.uid() AND a.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS pedido_itens_affiliate_self ON public.pedido_itens;
CREATE POLICY pedido_itens_affiliate_self
ON public.pedido_itens
FOR SELECT TO authenticated
USING (
  EXISTS(
    SELECT 1
    FROM public.pedidos pd
    JOIN public.afiliados a ON a.id=pd.afiliado_id
    WHERE pd.id=pedido_itens.pedido_id
      AND a.profile_id=auth.uid()
      AND a.deleted_at IS NULL
  )
);
