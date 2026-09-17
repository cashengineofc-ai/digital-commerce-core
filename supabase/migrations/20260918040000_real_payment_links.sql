-- Cash Engine PRO — links de pagamento reais, reservados e concorrentes
ALTER TABLE public.links_pagamento
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

CREATE UNIQUE INDEX IF NOT EXISTS idx_links_pagamento_empresa_idempotency
ON public.links_pagamento(empresa_id,idempotency_key)
WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.link_pagamento_reservas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_pagamento_id uuid NOT NULL REFERENCES public.links_pagamento(id) ON DELETE RESTRICT,
  pedido_id uuid NOT NULL UNIQUE REFERENCES public.pedidos(id) ON DELETE RESTRICT,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  status varchar(20) NOT NULL DEFAULT 'reservada'
    CHECK(status IN ('reservada','confirmada','liberada','expirada')),
  expira_em timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_link_reservas_ativas
ON public.link_pagamento_reservas(link_pagamento_id,expira_em)
WHERE status='reservada';

ALTER TABLE public.link_pagamento_reservas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS link_pagamento_reservas_tenant ON public.link_pagamento_reservas;
CREATE POLICY link_pagamento_reservas_tenant
ON public.link_pagamento_reservas
FOR SELECT TO authenticated
USING (empresa_id=public.current_empresa_id() OR public.fn_is_admin_global());

-- Reserva o uso enquanto existe pedido pendente. O lock do link serializa concorrência.
CREATE OR REPLACE FUNCTION public.fn_link_reservar_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_link public.links_pagamento%ROWTYPE;
  v_ativas bigint;
BEGIN
  IF NEW.link_pagamento_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_link
  FROM public.links_pagamento
  WHERE id=NEW.link_pagamento_id
    AND empresa_id=NEW.empresa_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND OR v_link.status<>'ativo' THEN
    RAISE EXCEPTION 'payment_link_unavailable';
  END IF;
  IF v_link.data_expiracao IS NOT NULL AND v_link.data_expiracao<=now() THEN
    RAISE EXCEPTION 'payment_link_expired';
  END IF;

  UPDATE public.link_pagamento_reservas
  SET status='expirada',updated_at=now()
  WHERE link_pagamento_id=v_link.id
    AND status='reservada'
    AND expira_em<=now();

  SELECT count(*) INTO v_ativas
  FROM public.link_pagamento_reservas
  WHERE link_pagamento_id=v_link.id
    AND status='reservada'
    AND expira_em>now();

  IF v_link.max_usos IS NOT NULL
     AND coalesce(v_link.contador_usos,0)+v_ativas>=v_link.max_usos THEN
    RAISE EXCEPTION 'payment_link_limit_reached';
  END IF;

  INSERT INTO public.link_pagamento_reservas(
    link_pagamento_id,pedido_id,empresa_id,status,expira_em
  ) VALUES (
    v_link.id,NEW.id,NEW.empresa_id,'reservada',
    least(
      coalesce(v_link.data_expiracao,now()+interval '1 hour'),
      now()+interval '1 hour'
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_reservar_pedido ON public.pedidos;
CREATE TRIGGER trg_link_reservar_pedido
AFTER INSERT ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.fn_link_reservar_pedido();

CREATE OR REPLACE FUNCTION public.fn_link_finalizar_reserva()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_res public.link_pagamento_reservas%ROWTYPE;
  v_max integer;
  v_count integer;
BEGIN
  IF NEW.link_pagamento_id IS NULL
     OR NEW.status_pagamento IS NOT DISTINCT FROM OLD.status_pagamento THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_res
  FROM public.link_pagamento_reservas
  WHERE pedido_id=NEW.id
  FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF NEW.status_pagamento IN ('confirmado','reembolsado_parcial','reembolsado_total')
     AND v_res.status='reservada' THEN
    UPDATE public.links_pagamento
    SET contador_usos=coalesce(contador_usos,0)+1,updated_at=now()
    WHERE id=v_res.link_pagamento_id
    RETURNING max_usos,contador_usos INTO v_max,v_count;

    UPDATE public.link_pagamento_reservas
    SET status='confirmada',updated_at=now()
    WHERE id=v_res.id;

    IF v_max IS NOT NULL AND v_count>=v_max THEN
      UPDATE public.links_pagamento
      SET status='usado',updated_at=now()
      WHERE id=v_res.link_pagamento_id;
    END IF;

  ELSIF NEW.status_pagamento IN ('falhou','cancelado')
        AND v_res.status='reservada' THEN
    UPDATE public.link_pagamento_reservas
    SET status='liberada',updated_at=now()
    WHERE id=v_res.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_finalizar_reserva ON public.pedidos;
CREATE TRIGGER trg_link_finalizar_reserva
AFTER UPDATE OF status_pagamento ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.fn_link_finalizar_reserva();

-- Evita o contador legado duplicar pedidos modernos. Mantém compatibilidade com transações antigas.
CREATE OR REPLACE FUNCTION public.fn_contabilizar_uso_link_pagamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_max_usos integer;
  v_novo_contador integer;
BEGIN
  IF NEW.link_pagamento_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('aprovada','capturada','paga','disponivel') THEN RETURN NEW; END IF;
  IF NEW.link_uso_contabilizado_em IS NOT NULL THEN RETURN NEW; END IF;

  IF NEW.pedido_id IS NOT NULL THEN
    NEW.link_uso_contabilizado_em:=now();
    RETURN NEW;
  END IF;

  SELECT max_usos INTO v_max_usos
  FROM public.links_pagamento
  WHERE id=NEW.link_pagamento_id AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;

  UPDATE public.links_pagamento
  SET contador_usos=coalesce(contador_usos,0)+1,updated_at=now()
  WHERE id=NEW.link_pagamento_id
  RETURNING contador_usos INTO v_novo_contador;

  IF v_max_usos IS NOT NULL AND v_novo_contador>=v_max_usos THEN
    UPDATE public.links_pagamento
    SET status='usado',updated_at=now()
    WHERE id=NEW.link_pagamento_id;
  END IF;

  NEW.link_uso_contabilizado_em:=now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_link_pagamento_criar(
  p_checkout_id uuid,
  p_titulo text,
  p_descricao text DEFAULT NULL,
  p_uso_unico boolean DEFAULT false,
  p_max_usos integer DEFAULT NULL,
  p_expira_em timestamptz DEFAULT NULL,
  p_permitir_editar_valor boolean DEFAULT false,
  p_valor numeric DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_checkout public.checkouts%ROWTYPE;
  v_offer public.ofertas%ROWTYPE;
  v_id uuid;
  v_code text;
  v_max integer;
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.fn_is_admin_global()
     AND NOT public.fn_tem_permissao('vendas','links','create'::public.tipo_operacao) THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;
  IF trim(coalesce(p_titulo,''))='' THEN RAISE EXCEPTION 'payment_link_title_required'; END IF;
  IF p_expira_em IS NOT NULL AND p_expira_em<=now() THEN RAISE EXCEPTION 'payment_link_expiration_invalid'; END IF;

  SELECT * INTO v_checkout
  FROM public.checkouts
  WHERE id=p_checkout_id AND empresa_id=v_empresa
    AND status='publicado' AND publicado_versao_id IS NOT NULL
    AND deleted_at IS NULL AND desativado_em IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'published_checkout_required'; END IF;

  SELECT * INTO v_offer
  FROM public.ofertas
  WHERE id=v_checkout.oferta_id AND empresa_id=v_empresa
    AND status='ativa' AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'active_offer_required'; END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_id
    FROM public.links_pagamento
    WHERE empresa_id=v_empresa AND idempotency_key=p_idempotency_key
    LIMIT 1;
    IF FOUND THEN RETURN v_id; END IF;
  END IF;

  v_max:=CASE
    WHEN p_uso_unico THEN 1
    WHEN p_max_usos IS NULL THEN NULL
    ELSE greatest(p_max_usos,1)
  END;
  v_code:='PAY-'||upper(encode(gen_random_bytes(12),'hex'));

  INSERT INTO public.links_pagamento(
    empresa_id,criado_por,checkout_id,produto_id,oferta_id,
    titulo,descricao,codigo_unico,public_token,valor,moeda,status,
    max_usos,contador_usos,uso_unico,permite_editar_valor,data_expiracao,
    idempotency_key,metadata
  ) VALUES (
    v_empresa,auth.uid(),v_checkout.id,v_offer.produto_id,v_offer.id,
    trim(p_titulo),nullif(trim(coalesce(p_descricao,'')),''),
    v_code,gen_random_uuid(),
    round(coalesce(p_valor,v_offer.preco),2),coalesce(v_offer.moeda,'BRL'),'ativo',
    v_max,0,p_uso_unico,coalesce(p_permitir_editar_valor,false),p_expira_em,
    p_idempotency_key,
    jsonb_build_object('source','real_payment_link','offer_price_at_creation',v_offer.preco)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_link_pagamento_criar(
  uuid,text,text,boolean,integer,timestamptz,boolean,numeric,uuid
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_link_pagamento_criar(
  uuid,text,text,boolean,integer,timestamptz,boolean,numeric,uuid
) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_link_pagamento_desativar(p_link_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v_empresa uuid:=public.current_empresa_id();
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.fn_is_admin_global()
     AND NOT public.fn_tem_permissao('vendas','links','update'::public.tipo_operacao) THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  UPDATE public.links_pagamento
  SET status='desativado',updated_at=now()
  WHERE id=p_link_id AND empresa_id=v_empresa
    AND deleted_at IS NULL AND status IN ('ativo','expirado');

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_link_pagamento_desativar(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_link_pagamento_desativar(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_links_pagamento_listar(
  p_busca text DEFAULT NULL,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  public_token uuid,
  codigo text,
  titulo text,
  checkout_nome text,
  oferta_nome text,
  produto_nome text,
  valor numeric,
  status text,
  uso_unico boolean,
  max_usos integer,
  contador_usos integer,
  data_expiracao timestamptz,
  pedidos_confirmados bigint,
  faturamento_bruto numeric,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
  SELECT
    l.id,l.public_token,l.codigo_unico::text,l.titulo::text,
    c.nome::text,o.nome::text,p.nome::text,l.valor,l.status::text,
    l.uso_unico,l.max_usos,coalesce(l.contador_usos,0),l.data_expiracao,
    (
      SELECT count(*) FROM public.pedidos pd
      WHERE pd.link_pagamento_id=l.id
        AND pd.status_pagamento IN ('confirmado','reembolsado_parcial','reembolsado_total')
    ),
    coalesce((
      SELECT sum(pd.valor_total) FROM public.pedidos pd
      WHERE pd.link_pagamento_id=l.id
        AND pd.status_pagamento IN ('confirmado','reembolsado_parcial','reembolsado_total')
    ),0),
    l.created_at
  FROM public.links_pagamento l
  LEFT JOIN public.checkouts c ON c.id=l.checkout_id
  LEFT JOIN public.ofertas o ON o.id=l.oferta_id
  LEFT JOIN public.produtos p ON p.id=l.produto_id
  WHERE l.empresa_id=public.current_empresa_id()
    AND l.deleted_at IS NULL
    AND (
      coalesce(trim(p_busca),'')=''
      OR l.codigo_unico ILIKE '%'||trim(p_busca)||'%'
      OR l.titulo ILIKE '%'||trim(p_busca)||'%'
      OR coalesce(p.nome,'') ILIKE '%'||trim(p_busca)||'%'
    )
  ORDER BY l.created_at DESC
  LIMIT greatest(1,least(coalesce(p_limit,100),200))
  OFFSET greatest(coalesce(p_offset,0),0);
$$;

REVOKE ALL ON FUNCTION public.fn_links_pagamento_listar(text,integer,integer)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_links_pagamento_listar(text,integer,integer)
TO authenticated;
