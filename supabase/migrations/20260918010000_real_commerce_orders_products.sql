-- Cash Engine PRO — núcleo real de comércio
-- Produto -> Oferta -> Checkout versionado -> Pedido -> Itens -> Tentativa de pagamento
-- Idempotente e compatível com o schema legado.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- OFERTAS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.ofertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  criado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  nome varchar(180) NOT NULL,
  descricao text,
  preco numeric(15,2) NOT NULL CHECK (preco >= 0),
  preco_comparacao numeric(15,2),
  moeda varchar(3) NOT NULL DEFAULT 'BRL',
  status varchar(24) NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','ativa','pausada','arquivada')),
  vigencia_inicio timestamptz,
  vigencia_fim timestamptz,
  permitir_valor_personalizado boolean NOT NULL DEFAULT false,
  valor_minimo numeric(15,2),
  valor_maximo numeric(15,2),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (vigencia_fim IS NULL OR vigencia_inicio IS NULL OR vigencia_fim > vigencia_inicio),
  CHECK (valor_minimo IS NULL OR valor_minimo >= 0),
  CHECK (valor_maximo IS NULL OR valor_maximo >= 0),
  CHECK (valor_maximo IS NULL OR valor_minimo IS NULL OR valor_maximo >= valor_minimo)
);

CREATE INDEX IF NOT EXISTS idx_ofertas_empresa_status
  ON public.ofertas (empresa_id, status, updated_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ofertas_produto
  ON public.ofertas (produto_id, status)
  WHERE deleted_at IS NULL;

ALTER TABLE public.ofertas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ofertas_tenant_all ON public.ofertas;
CREATE POLICY ofertas_tenant_all ON public.ofertas
FOR ALL TO authenticated
USING (empresa_id = public.current_empresa_id() OR public.fn_is_admin_global())
WITH CHECK (empresa_id = public.current_empresa_id() OR public.fn_is_admin_global());

-- =========================================================
-- CHECKOUT: referências estáveis e versões
-- =========================================================
ALTER TABLE public.checkouts
  ADD COLUMN IF NOT EXISTS oferta_id uuid REFERENCES public.ofertas(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS public_token uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS rascunho_versao_id uuid,
  ADD COLUMN IF NOT EXISTS publicado_versao_id uuid,
  ADD COLUMN IF NOT EXISTS desativado_em timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_checkouts_public_token
  ON public.checkouts(public_token)
  WHERE public_token IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.checkout_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_id uuid NOT NULL REFERENCES public.checkouts(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  versao integer NOT NULL CHECK (versao > 0),
  estado varchar(20) NOT NULL DEFAULT 'rascunho'
    CHECK (estado IN ('rascunho','publicado','substituido')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  publicado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  publicado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (checkout_id, versao)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'checkouts_rascunho_versao_fk'
  ) THEN
    ALTER TABLE public.checkouts
      ADD CONSTRAINT checkouts_rascunho_versao_fk
      FOREIGN KEY (rascunho_versao_id) REFERENCES public.checkout_versions(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'checkouts_publicado_versao_fk'
  ) THEN
    ALTER TABLE public.checkouts
      ADD CONSTRAINT checkouts_publicado_versao_fk
      FOREIGN KEY (publicado_versao_id) REFERENCES public.checkout_versions(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_checkout_versions_checkout
  ON public.checkout_versions(checkout_id, versao DESC);
ALTER TABLE public.checkout_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS checkout_versions_tenant_all ON public.checkout_versions;
CREATE POLICY checkout_versions_tenant_all ON public.checkout_versions
FOR ALL TO authenticated
USING (empresa_id = public.current_empresa_id() OR public.fn_is_admin_global())
WITH CHECK (empresa_id = public.current_empresa_id() OR public.fn_is_admin_global());

-- =========================================================
-- ORDER BUMPS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.checkout_order_bumps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  checkout_id uuid NOT NULL REFERENCES public.checkouts(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  criado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  titulo varchar(180),
  descricao text,
  imagem_url text,
  texto_oferta text,
  tipo_preco varchar(24) NOT NULL DEFAULT 'produto'
    CHECK (tipo_preco IN ('produto','preco_fixo','desconto_percentual')),
  preco_fixo numeric(15,2),
  desconto_percentual numeric(7,4),
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  grupo_combinacao varchar(80),
  max_selecao_grupo integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (preco_fixo IS NULL OR preco_fixo >= 0),
  CHECK (desconto_percentual IS NULL OR (desconto_percentual >= 0 AND desconto_percentual <= 100)),
  CHECK (max_selecao_grupo IS NULL OR max_selecao_grupo > 0)
);

CREATE INDEX IF NOT EXISTS idx_checkout_bumps_checkout
  ON public.checkout_order_bumps(checkout_id, ativo, ordem)
  WHERE deleted_at IS NULL;
ALTER TABLE public.checkout_order_bumps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS checkout_order_bumps_tenant_all ON public.checkout_order_bumps;
CREATE POLICY checkout_order_bumps_tenant_all ON public.checkout_order_bumps
FOR ALL TO authenticated
USING (empresa_id = public.current_empresa_id() OR public.fn_is_admin_global())
WITH CHECK (empresa_id = public.current_empresa_id() OR public.fn_is_admin_global());

-- =========================================================
-- LINKS DE PAGAMENTO
-- =========================================================
ALTER TABLE public.links_pagamento
  ADD COLUMN IF NOT EXISTS oferta_id uuid REFERENCES public.ofertas(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS public_token uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS uso_unico boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_links_pagamento_public_token
  ON public.links_pagamento(public_token)
  WHERE public_token IS NOT NULL AND deleted_at IS NULL;

-- =========================================================
-- PEDIDOS E ITENS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  numero varchar(64) NOT NULL UNIQUE,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  afiliado_id uuid REFERENCES public.afiliados(id) ON DELETE SET NULL,
  link_afiliado_id uuid REFERENCES public.links_afiliados(id) ON DELETE SET NULL,
  checkout_id uuid REFERENCES public.checkouts(id) ON DELETE SET NULL,
  checkout_versao_id uuid REFERENCES public.checkout_versions(id) ON DELETE SET NULL,
  oferta_id uuid REFERENCES public.ofertas(id) ON DELETE SET NULL,
  link_pagamento_id uuid REFERENCES public.links_pagamento(id) ON DELETE SET NULL,
  idempotency_key uuid NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'criado'
    CHECK (status IN ('criado','aguardando_pagamento','pago','cancelado','falhou','reembolsado_parcial','reembolsado_total')),
  status_pagamento varchar(30) NOT NULL DEFAULT 'pendente'
    CHECK (status_pagamento IN ('pendente','confirmado','falhou','cancelado','reembolsado_parcial','reembolsado_total')),
  metodo_pagamento varchar(32) NOT NULL DEFAULT 'pix',
  comprador_nome varchar(180),
  comprador_email varchar(320),
  comprador_documento varchar(40),
  subtotal numeric(15,2) NOT NULL DEFAULT 0,
  valor_desconto numeric(15,2) NOT NULL DEFAULT 0,
  valor_total numeric(15,2) NOT NULL DEFAULT 0,
  valor_taxas numeric(15,2) NOT NULL DEFAULT 0,
  valor_comissoes numeric(15,2) NOT NULL DEFAULT 0,
  valor_devolvido numeric(15,2) NOT NULL DEFAULT 0,
  moeda varchar(3) NOT NULL DEFAULT 'BRL',
  criado_em timestamptz NOT NULL DEFAULT now(),
  confirmado_em timestamptz,
  cancelado_em timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (empresa_id, idempotency_key),
  CHECK (subtotal >= 0 AND valor_desconto >= 0 AND valor_total >= 0),
  CHECK (valor_devolvido >= 0 AND valor_devolvido <= valor_total)
);

CREATE TABLE IF NOT EXISTS public.pedido_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE RESTRICT,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  produto_id uuid REFERENCES public.produtos(id) ON DELETE SET NULL,
  oferta_id uuid REFERENCES public.ofertas(id) ON DELETE SET NULL,
  order_bump_id uuid REFERENCES public.checkout_order_bumps(id) ON DELETE SET NULL,
  tipo_item varchar(24) NOT NULL CHECK (tipo_item IN ('principal','order_bump')),
  nome_snapshot varchar(220) NOT NULL,
  descricao_snapshot text,
  imagem_snapshot text,
  quantidade integer NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  preco_unitario_snapshot numeric(15,2) NOT NULL CHECK (preco_unitario_snapshot >= 0),
  desconto_snapshot numeric(15,2) NOT NULL DEFAULT 0 CHECK (desconto_snapshot >= 0),
  total_snapshot numeric(15,2) NOT NULL CHECK (total_snapshot >= 0),
  comissao_percentual_snapshot numeric(7,4) NOT NULL DEFAULT 0,
  comissao_valor_snapshot numeric(15,2) NOT NULL DEFAULT 0,
  regra_comissao_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  regra_preco_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pedidos_empresa_criado
  ON public.pedidos(empresa_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_empresa_pagamento
  ON public.pedidos(empresa_id, status_pagamento, confirmado_em DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente
  ON public.pedidos(cliente_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_afiliado
  ON public.pedidos(afiliado_id, criado_em DESC)
  WHERE afiliado_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pedido_itens_pedido
  ON public.pedido_itens(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pedido_itens_produto
  ON public.pedido_itens(empresa_id, produto_id, created_at DESC);

ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pedidos_tenant_select ON public.pedidos;
DROP POLICY IF EXISTS pedidos_tenant_write ON public.pedidos;
CREATE POLICY pedidos_tenant_select ON public.pedidos
FOR SELECT TO authenticated
USING (empresa_id = public.current_empresa_id() OR public.fn_is_admin_global());
CREATE POLICY pedidos_tenant_write ON public.pedidos
FOR ALL TO authenticated
USING (empresa_id = public.current_empresa_id() OR public.fn_is_admin_global())
WITH CHECK (empresa_id = public.current_empresa_id() OR public.fn_is_admin_global());

DROP POLICY IF EXISTS pedido_itens_tenant_select ON public.pedido_itens;
DROP POLICY IF EXISTS pedido_itens_tenant_write ON public.pedido_itens;
CREATE POLICY pedido_itens_tenant_select ON public.pedido_itens
FOR SELECT TO authenticated
USING (empresa_id = public.current_empresa_id() OR public.fn_is_admin_global());
CREATE POLICY pedido_itens_tenant_write ON public.pedido_itens
FOR ALL TO authenticated
USING (empresa_id = public.current_empresa_id() OR public.fn_is_admin_global())
WITH CHECK (empresa_id = public.current_empresa_id() OR public.fn_is_admin_global());

-- =========================================================
-- ESTOQUE RESERVADO
-- =========================================================
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS estoque_reservado integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

CREATE UNIQUE INDEX IF NOT EXISTS idx_produtos_empresa_idempotency
  ON public.produtos(empresa_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.pedido_estoque_reservas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE RESTRICT,
  pedido_item_id uuid NOT NULL REFERENCES public.pedido_itens(id) ON DELETE RESTRICT,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  quantidade integer NOT NULL CHECK (quantidade > 0),
  status varchar(20) NOT NULL DEFAULT 'reservada'
    CHECK (status IN ('reservada','consumida','liberada')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pedido_item_id)
);

ALTER TABLE public.pedido_estoque_reservas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pedido_estoque_reservas_tenant ON public.pedido_estoque_reservas;
CREATE POLICY pedido_estoque_reservas_tenant ON public.pedido_estoque_reservas
FOR ALL TO authenticated
USING (empresa_id = public.current_empresa_id() OR public.fn_is_admin_global())
WITH CHECK (empresa_id = public.current_empresa_id() OR public.fn_is_admin_global());

-- =========================================================
-- TRANSAÇÃO -> PEDIDO + PIX SNAPSHOT
-- =========================================================
ALTER TABLE public.transacoes
  ADD COLUMN IF NOT EXISTS pedido_id uuid REFERENCES public.pedidos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pix_modo text,
  ADD COLUMN IF NOT EXISTS pix_txid varchar(25),
  ADD COLUMN IF NOT EXISTS pix_chave_snapshot text,
  ADD COLUMN IF NOT EXISTS pix_recebedor_nome text,
  ADD COLUMN IF NOT EXISTS pix_recebedor_cidade text,
  ADD COLUMN IF NOT EXISTS pix_gerado_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_transacoes_pedido_id
  ON public.transacoes(pedido_id)
  WHERE pedido_id IS NOT NULL;

-- =========================================================
-- HELPERS DE CÁLCULO
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_preco_produto_atual(p_produto public.produtos)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  IF p_produto.preco_promocional IS NOT NULL
     AND (p_produto.promocao_inicio IS NULL OR p_produto.promocao_inicio <= now())
     AND (p_produto.promocao_fim IS NULL OR p_produto.promocao_fim > now()) THEN
    RETURN round(p_produto.preco_promocional, 2);
  END IF;
  RETURN round(p_produto.preco, 2);
END;
$$;

-- Cria pedido + itens + tentativa Pix de forma atômica.
CREATE OR REPLACE FUNCTION public.fn_checkout_criar_pedido_pix(
  p_empresa_id uuid,
  p_cliente_id uuid,
  p_checkout_id uuid,
  p_link_pagamento_id uuid,
  p_idempotency_key uuid,
  p_valor_solicitado numeric DEFAULT NULL,
  p_order_bump_ids uuid[] DEFAULT '{}'::uuid[],
  p_afiliado_id uuid DEFAULT NULL,
  p_link_afiliado_id uuid DEFAULT NULL,
  p_provedor text DEFAULT 'pix_chave'
)
RETURNS TABLE(pedido_id uuid, transacao_id uuid, numero_pedido text, valor_total numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_checkout public.checkouts%ROWTYPE;
  v_offer public.ofertas%ROWTYPE;
  v_product public.produtos%ROWTYPE;
  v_link public.links_pagamento%ROWTYPE;
  v_customer public.clientes%ROWTYPE;
  v_existing public.pedidos%ROWTYPE;
  v_pedido_id uuid;
  v_tx_id uuid;
  v_numero text;
  v_base numeric(15,2);
  v_bumps numeric(15,2) := 0;
  v_total numeric(15,2);
  v_item_id uuid;
  v_bump record;
  v_price numeric(15,2);
  v_group_count integer;
  v_commission_rate numeric(7,4);
  v_commission_fixed numeric(15,2);
  v_commission_value numeric(15,2);
BEGIN
  IF p_empresa_id IS NULL OR p_cliente_id IS NULL OR p_checkout_id IS NULL OR p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'checkout_order_invalid_input';
  END IF;
  IF p_provedor NOT IN ('pix_chave','mercadopago') THEN
    RAISE EXCEPTION 'payment_provider_invalid';
  END IF;

  SELECT * INTO v_existing
  FROM public.pedidos
  WHERE empresa_id = p_empresa_id AND idempotency_key = p_idempotency_key
  LIMIT 1;

  IF FOUND THEN
    SELECT id INTO v_tx_id
    FROM public.transacoes
    WHERE pedido_id = v_existing.id
    ORDER BY created_at
    LIMIT 1;
    RETURN QUERY SELECT v_existing.id, v_tx_id, v_existing.numero::text, v_existing.valor_total;
    RETURN;
  END IF;

  SELECT * INTO v_checkout
  FROM public.checkouts
  WHERE id = p_checkout_id
    AND empresa_id = p_empresa_id
    AND status = 'publicado'
    AND publicado_versao_id IS NOT NULL
    AND desativado_em IS NULL
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'checkout_unavailable';
  END IF;

  SELECT * INTO v_offer
  FROM public.ofertas
  WHERE id = v_checkout.oferta_id
    AND empresa_id = p_empresa_id
    AND status = 'ativa'
    AND deleted_at IS NULL
    AND (vigencia_inicio IS NULL OR vigencia_inicio <= now())
    AND (vigencia_fim IS NULL OR vigencia_fim > now())
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'offer_unavailable';
  END IF;

  IF p_link_pagamento_id IS NOT NULL THEN
    SELECT * INTO v_link
    FROM public.links_pagamento
    WHERE id = p_link_pagamento_id
      AND empresa_id = p_empresa_id
      AND checkout_id = p_checkout_id
      AND status = 'ativo'
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'payment_link_unavailable';
    END IF;
    IF v_link.data_expiracao IS NOT NULL AND v_link.data_expiracao <= now() THEN
      RAISE EXCEPTION 'payment_link_expired';
    END IF;
    IF v_link.max_usos IS NOT NULL AND coalesce(v_link.contador_usos,0) >= v_link.max_usos THEN
      RAISE EXCEPTION 'payment_link_limit_reached';
    END IF;
    IF v_link.oferta_id IS NOT NULL AND v_link.oferta_id <> v_offer.id THEN
      RAISE EXCEPTION 'payment_link_mismatch';
    END IF;
  END IF;

  SELECT * INTO v_product
  FROM public.produtos
  WHERE id = v_offer.produto_id
    AND empresa_id = p_empresa_id
    AND status = 'publicado'
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'product_unavailable';
  END IF;

  IF coalesce(v_product.gerencia_estoque,false)
     AND (coalesce(v_product.estoque,0) - coalesce(v_product.estoque_reservado,0)) < 1 THEN
    RAISE EXCEPTION 'product_out_of_stock';
  END IF;

  SELECT * INTO v_customer
  FROM public.clientes
  WHERE id = p_cliente_id AND empresa_id = p_empresa_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'customer_not_found';
  END IF;

  v_base := round(v_offer.preco, 2);
  IF p_link_pagamento_id IS NOT NULL AND NOT coalesce(v_link.permite_editar_valor,false)
     AND coalesce(v_link.valor,0) > 0 THEN
    v_base := round(v_link.valor, 2);
  ELSIF (v_offer.permitir_valor_personalizado OR
         (p_link_pagamento_id IS NOT NULL AND coalesce(v_link.permite_editar_valor,false)))
        AND p_valor_solicitado IS NOT NULL THEN
    v_base := round(p_valor_solicitado, 2);
    IF v_base <= 0 THEN RAISE EXCEPTION 'invalid_checkout_amount'; END IF;
    IF v_offer.valor_minimo IS NOT NULL AND v_base < v_offer.valor_minimo THEN
      RAISE EXCEPTION 'amount_below_minimum';
    END IF;
    IF v_offer.valor_maximo IS NOT NULL AND v_base > v_offer.valor_maximo THEN
      RAISE EXCEPTION 'amount_above_maximum';
    END IF;
  END IF;

  IF cardinality(p_order_bump_ids) <> (
    SELECT count(DISTINCT x) FROM unnest(p_order_bump_ids) AS x
  ) THEN
    RAISE EXCEPTION 'duplicate_order_bump';
  END IF;

  -- Regras de grupo/composição.
  FOR v_bump IN
    SELECT b.grupo_combinacao, max(coalesce(b.max_selecao_grupo,1)) AS max_sel, count(*) AS qty
    FROM public.checkout_order_bumps b
    WHERE b.id = ANY(p_order_bump_ids)
      AND b.checkout_id = p_checkout_id
      AND b.empresa_id = p_empresa_id
      AND b.ativo
      AND b.deleted_at IS NULL
      AND b.grupo_combinacao IS NOT NULL
    GROUP BY b.grupo_combinacao
  LOOP
    IF v_bump.qty > v_bump.max_sel THEN
      RAISE EXCEPTION 'order_bump_combination_not_allowed';
    END IF;
  END LOOP;

  -- Todos os IDs enviados precisam existir e estar ativos.
  IF cardinality(p_order_bump_ids) <> (
    SELECT count(*)
    FROM public.checkout_order_bumps b
    JOIN public.produtos p ON p.id = b.produto_id
    WHERE b.id = ANY(p_order_bump_ids)
      AND b.checkout_id = p_checkout_id
      AND b.empresa_id = p_empresa_id
      AND b.ativo
      AND b.deleted_at IS NULL
      AND p.empresa_id = p_empresa_id
      AND p.status = 'publicado'
      AND p.deleted_at IS NULL
      AND (NOT coalesce(p.gerencia_estoque,false)
           OR (coalesce(p.estoque,0) - coalesce(p.estoque_reservado,0)) > 0)
  ) THEN
    RAISE EXCEPTION 'invalid_order_bumps';
  END IF;

  FOR v_bump IN
    SELECT b.*, p AS product_row
    FROM public.checkout_order_bumps b
    JOIN public.produtos p ON p.id = b.produto_id
    WHERE b.id = ANY(p_order_bump_ids)
      AND b.checkout_id = p_checkout_id
      AND b.empresa_id = p_empresa_id
      AND b.ativo
      AND b.deleted_at IS NULL
    ORDER BY b.ordem, b.created_at
  LOOP
    IF v_bump.tipo_preco = 'preco_fixo' THEN
      v_price := round(coalesce(v_bump.preco_fixo,0),2);
    ELSIF v_bump.tipo_preco = 'desconto_percentual' THEN
      v_price := round(
        public.fn_preco_produto_atual(v_bump.product_row)
        * (1 - coalesce(v_bump.desconto_percentual,0) / 100.0), 2
      );
    ELSE
      v_price := public.fn_preco_produto_atual(v_bump.product_row);
    END IF;
    v_bumps := v_bumps + greatest(v_price,0);
  END LOOP;

  v_total := round(v_base + v_bumps, 2);
  IF v_total <= 0 THEN RAISE EXCEPTION 'invalid_checkout_amount'; END IF;

  v_numero := 'CE-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));

  INSERT INTO public.pedidos (
    empresa_id, numero, cliente_id, afiliado_id, link_afiliado_id,
    checkout_id, checkout_versao_id, oferta_id, link_pagamento_id,
    idempotency_key, status, status_pagamento, metodo_pagamento,
    comprador_nome, comprador_email, comprador_documento,
    subtotal, valor_total, moeda, metadata
  ) VALUES (
    p_empresa_id, v_numero, p_cliente_id, p_afiliado_id, p_link_afiliado_id,
    p_checkout_id, v_checkout.publicado_versao_id, v_offer.id, p_link_pagamento_id,
    p_idempotency_key, 'aguardando_pagamento', 'pendente', 'pix',
    v_customer.nome_completo, v_customer.email, v_customer.cpf,
    v_total, v_total, coalesce(v_offer.moeda,'BRL'),
    jsonb_build_object('base_amount',v_base,'order_bumps_amount',v_bumps)
  )
  RETURNING id INTO v_pedido_id;

  -- Item principal
  v_commission_rate := 0;
  v_commission_fixed := NULL;
  v_commission_value := 0;
  IF p_afiliado_id IS NOT NULL THEN
    SELECT
      coalesce(ap.taxa_comissao_personalizada, v_product.taxa_comissao_afiliado, a.taxa_comissao_padrao, 0),
      coalesce(ap.comissao_valor_fixo, v_product.comissao_valor_fixo)
    INTO v_commission_rate, v_commission_fixed
    FROM public.afiliados a
    LEFT JOIN public.afiliados_produtos ap
      ON ap.afiliado_id = a.id
     AND ap.produto_id = v_product.id
     AND ap.empresa_id = p_empresa_id
     AND ap.ativo
     AND (ap.data_inicio IS NULL OR ap.data_inicio <= now())
     AND (ap.data_fim IS NULL OR ap.data_fim > now())
    WHERE a.id = p_afiliado_id
      AND a.empresa_id = p_empresa_id
      AND a.status = 'ativo'
      AND a.deleted_at IS NULL;
    IF FOUND THEN
      IF v_commission_fixed IS NOT NULL THEN
        v_commission_value := least(greatest(v_commission_fixed,0),v_base);
      ELSE
        v_commission_value := round(v_base * greatest(v_commission_rate,0) / 100.0,2);
      END IF;
    END IF;
  END IF;

  INSERT INTO public.pedido_itens (
    pedido_id, empresa_id, produto_id, oferta_id, tipo_item,
    nome_snapshot, descricao_snapshot, imagem_snapshot,
    preco_unitario_snapshot, total_snapshot,
    comissao_percentual_snapshot, comissao_valor_snapshot,
    regra_comissao_snapshot, regra_preco_snapshot
  ) VALUES (
    v_pedido_id, p_empresa_id, v_product.id, v_offer.id, 'principal',
    v_product.nome, v_product.descricao_curta, v_product.imagem_principal_url,
    v_base, v_base, coalesce(v_commission_rate,0), v_commission_value,
    jsonb_build_object('fixa',v_commission_fixed,'percentual',coalesce(v_commission_rate,0)),
    jsonb_build_object('oferta_id',v_offer.id,'preco_oferta',v_offer.preco)
  )
  RETURNING id INTO v_item_id;

  IF coalesce(v_product.gerencia_estoque,false) THEN
    UPDATE public.produtos
    SET estoque_reservado = estoque_reservado + 1, updated_at = now()
    WHERE id = v_product.id;
    INSERT INTO public.pedido_estoque_reservas
      (pedido_id,pedido_item_id,empresa_id,produto_id,quantidade)
    VALUES (v_pedido_id,v_item_id,p_empresa_id,v_product.id,1);
  END IF;

  -- Itens order bump
  FOR v_bump IN
    SELECT b.*, p AS product_row
    FROM public.checkout_order_bumps b
    JOIN public.produtos p ON p.id = b.produto_id
    WHERE b.id = ANY(p_order_bump_ids)
      AND b.checkout_id = p_checkout_id
      AND b.empresa_id = p_empresa_id
      AND b.ativo
      AND b.deleted_at IS NULL
    ORDER BY b.ordem, b.created_at
  LOOP
    IF v_bump.tipo_preco = 'preco_fixo' THEN
      v_price := round(coalesce(v_bump.preco_fixo,0),2);
    ELSIF v_bump.tipo_preco = 'desconto_percentual' THEN
      v_price := round(
        public.fn_preco_produto_atual(v_bump.product_row)
        * (1 - coalesce(v_bump.desconto_percentual,0) / 100.0), 2
      );
    ELSE
      v_price := public.fn_preco_produto_atual(v_bump.product_row);
    END IF;

    v_commission_rate := 0;
    v_commission_fixed := NULL;
    v_commission_value := 0;

    IF p_afiliado_id IS NOT NULL THEN
      SELECT
        coalesce(ap.taxa_comissao_personalizada, (v_bump.product_row).taxa_comissao_afiliado, a.taxa_comissao_padrao, 0),
        coalesce(ap.comissao_valor_fixo, (v_bump.product_row).comissao_valor_fixo)
      INTO v_commission_rate, v_commission_fixed
      FROM public.afiliados a
      JOIN public.afiliados_produtos ap
        ON ap.afiliado_id = a.id
       AND ap.produto_id = v_bump.produto_id
       AND ap.empresa_id = p_empresa_id
       AND ap.ativo
       AND (ap.data_inicio IS NULL OR ap.data_inicio <= now())
       AND (ap.data_fim IS NULL OR ap.data_fim > now())
      WHERE a.id = p_afiliado_id
        AND a.empresa_id = p_empresa_id
        AND a.status = 'ativo'
        AND a.deleted_at IS NULL;
      IF FOUND THEN
        IF v_commission_fixed IS NOT NULL THEN
          v_commission_value := least(greatest(v_commission_fixed,0),v_price);
        ELSE
          v_commission_value := round(v_price * greatest(v_commission_rate,0) / 100.0,2);
        END IF;
      END IF;
    END IF;

    INSERT INTO public.pedido_itens (
      pedido_id, empresa_id, produto_id, order_bump_id, tipo_item,
      nome_snapshot, descricao_snapshot, imagem_snapshot,
      preco_unitario_snapshot, total_snapshot,
      comissao_percentual_snapshot, comissao_valor_snapshot,
      regra_comissao_snapshot, regra_preco_snapshot
    ) VALUES (
      v_pedido_id, p_empresa_id, v_bump.produto_id, v_bump.id, 'order_bump',
      coalesce(v_bump.titulo,(v_bump.product_row).nome),
      coalesce(v_bump.descricao,(v_bump.product_row).descricao_curta),
      coalesce(v_bump.imagem_url,(v_bump.product_row).imagem_principal_url),
      v_price, v_price, coalesce(v_commission_rate,0), v_commission_value,
      jsonb_build_object('fixa',v_commission_fixed,'percentual',coalesce(v_commission_rate,0)),
      jsonb_build_object(
        'tipo',v_bump.tipo_preco,
        'preco_fixo',v_bump.preco_fixo,
        'desconto_percentual',v_bump.desconto_percentual
      )
    )
    RETURNING id INTO v_item_id;

    IF coalesce((v_bump.product_row).gerencia_estoque,false) THEN
      UPDATE public.produtos
      SET estoque_reservado = estoque_reservado + 1, updated_at = now()
      WHERE id = v_bump.produto_id;
      INSERT INTO public.pedido_estoque_reservas
        (pedido_id,pedido_item_id,empresa_id,produto_id,quantidade)
      VALUES (v_pedido_id,v_item_id,p_empresa_id,v_bump.produto_id,1);
    END IF;
  END LOOP;

  INSERT INTO public.transacoes (
    empresa_id, cliente_id, afiliado_id, produto_id, checkout_id,
    link_pagamento_id, link_afiliado_id, pedido_id, pedido_numero,
    codigo_externo, tipo, metodo_pagamento, status,
    valor_bruto, valor_liquido, moeda, idempotency_key,
    provedor_pagamento, origem_dispositivo, metadata
  ) VALUES (
    p_empresa_id, p_cliente_id, p_afiliado_id, v_product.id, p_checkout_id,
    p_link_pagamento_id, p_link_afiliado_id, v_pedido_id, v_numero,
    coalesce(v_link.codigo_unico,v_checkout.slug),
    CASE WHEN p_link_pagamento_id IS NULL
      THEN 'venda'::public.tipo_transacao
      ELSE 'link_pagamento'::public.tipo_transacao END,
    'pix'::public.metodo_pagamento,
    'pendente'::public.status_transacao,
    v_total, v_total, coalesce(v_offer.moeda,'BRL'), p_idempotency_key,
    p_provedor, 'web',
    jsonb_build_object('pedido_id',v_pedido_id,'checkout_version_id',v_checkout.publicado_versao_id)
  )
  RETURNING id INTO v_tx_id;

  RETURN QUERY SELECT v_pedido_id, v_tx_id, v_numero, v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_checkout_criar_pedido_pix(
  uuid,uuid,uuid,uuid,uuid,numeric,uuid[],uuid,uuid,text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_checkout_criar_pedido_pix(
  uuid,uuid,uuid,uuid,uuid,numeric,uuid[],uuid,uuid,text
) TO service_role;

-- Sincroniza pedido e estoque a partir da situação real da tentativa de pagamento.
CREATE OR REPLACE FUNCTION public.fn_sync_pedido_por_transacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res record;
BEGIN
  IF NEW.pedido_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('aprovada','capturada','paga','disponivel') THEN
    UPDATE public.pedidos
    SET status='pago',
        status_pagamento='confirmado',
        confirmado_em=coalesce(confirmado_em,NEW.data_pagamento,now()),
        updated_at=now()
    WHERE id=NEW.pedido_id AND status_pagamento <> 'confirmado';

    FOR v_res IN
      SELECT * FROM public.pedido_estoque_reservas
      WHERE pedido_id=NEW.pedido_id AND status='reservada'
      FOR UPDATE
    LOOP
      UPDATE public.produtos
      SET estoque = greatest(coalesce(estoque,0)-v_res.quantidade,0),
          estoque_reservado = greatest(estoque_reservado-v_res.quantidade,0),
          updated_at=now()
      WHERE id=v_res.produto_id;
      UPDATE public.pedido_estoque_reservas
      SET status='consumida', updated_at=now()
      WHERE id=v_res.id;
    END LOOP;

  ELSIF NEW.status IN ('cancelada','rejeitada','falhou','expirada') THEN
    UPDATE public.pedidos
    SET status=CASE WHEN NEW.status='cancelada' THEN 'cancelado' ELSE 'falhou' END,
        status_pagamento=CASE WHEN NEW.status='cancelada' THEN 'cancelado' ELSE 'falhou' END,
        cancelado_em=CASE WHEN NEW.status='cancelada' THEN coalesce(cancelado_em,now()) ELSE cancelado_em END,
        updated_at=now()
    WHERE id=NEW.pedido_id AND status_pagamento='pendente';

    FOR v_res IN
      SELECT * FROM public.pedido_estoque_reservas
      WHERE pedido_id=NEW.pedido_id AND status='reservada'
      FOR UPDATE
    LOOP
      UPDATE public.produtos
      SET estoque_reservado = greatest(estoque_reservado-v_res.quantidade,0),
          updated_at=now()
      WHERE id=v_res.produto_id;
      UPDATE public.pedido_estoque_reservas
      SET status='liberada', updated_at=now()
      WHERE id=v_res.id;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_pedido_por_transacao ON public.transacoes;
CREATE TRIGGER trg_sync_pedido_por_transacao
AFTER INSERT OR UPDATE OF status,data_pagamento ON public.transacoes
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_pedido_por_transacao();

-- =========================================================
-- PRODUTOS: salvar/editar/arquivar no servidor
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_produto_salvar(
  p_id uuid DEFAULT NULL,
  p_nome text DEFAULT NULL,
  p_descricao text DEFAULT NULL,
  p_categoria_id uuid DEFAULT NULL,
  p_imagem_url text DEFAULT NULL,
  p_galeria_urls text[] DEFAULT '{}'::text[],
  p_status text DEFAULT 'rascunho',
  p_preco numeric DEFAULT 0,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid := public.current_empresa_id();
  v_id uuid;
  v_slug text;
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF NOT public.fn_tem_permissao('produtos','produtos','update'::public.tipo_operacao)
     AND NOT public.fn_tem_permissao('produtos','produtos','create'::public.tipo_operacao)
     AND NOT public.fn_is_admin_global() THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;
  IF trim(coalesce(p_nome,'')) = '' THEN RAISE EXCEPTION 'product_name_required'; END IF;
  IF coalesce(p_preco,0) < 0 THEN RAISE EXCEPTION 'invalid_product_price'; END IF;
  IF p_status NOT IN ('rascunho','publicado','arquivado','indisponivel') THEN
    RAISE EXCEPTION 'invalid_product_status';
  END IF;

  IF p_id IS NULL AND p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_id
    FROM public.produtos
    WHERE empresa_id=v_empresa AND idempotency_key=p_idempotency_key
    LIMIT 1;
    IF FOUND THEN RETURN v_id; END IF;
  END IF;

  IF p_id IS NULL THEN
    v_slug := lower(regexp_replace(trim(p_nome),'[^a-zA-Z0-9]+','-','g'))
              || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,8);
    INSERT INTO public.produtos (
      empresa_id,categoria_id,criado_por,nome,slug,
      descricao_curta,preco,imagem_principal_url,galeria_urls,status,
      idempotency_key
    ) VALUES (
      v_empresa,p_categoria_id,auth.uid(),trim(p_nome),v_slug,
      nullif(trim(coalesce(p_descricao,'')),''),round(coalesce(p_preco,0),2),
      nullif(trim(coalesce(p_imagem_url,'')),''),
      coalesce(p_galeria_urls,'{}'::text[]),
      p_status::public.status_produto,p_idempotency_key
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.produtos
    SET nome=trim(p_nome),
        descricao_curta=nullif(trim(coalesce(p_descricao,'')),''),
        categoria_id=p_categoria_id,
        imagem_principal_url=nullif(trim(coalesce(p_imagem_url,'')),''),
        galeria_urls=coalesce(p_galeria_urls,'{}'::text[]),
        preco=round(coalesce(p_preco,0),2),
        status=p_status::public.status_produto,
        updated_at=now()
    WHERE id=p_id AND empresa_id=v_empresa AND deleted_at IS NULL
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'product_not_found'; END IF;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_produto_salvar(uuid,text,text,uuid,text,text[],text,numeric,uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_produto_salvar(uuid,text,text,uuid,text,text[],text,numeric,uuid)
TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_produto_arquivar(p_produto_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid := public.current_empresa_id();
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.fn_tem_permissao('produtos','produtos','delete'::public.tipo_operacao)
     AND NOT public.fn_is_admin_global() THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;
  UPDATE public.produtos
  SET status='arquivado'::public.status_produto, updated_at=now()
  WHERE id=p_produto_id AND empresa_id=v_empresa AND deleted_at IS NULL;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_produto_arquivar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_produto_arquivar(uuid) TO authenticated;

-- =========================================================
-- CONSULTAS REAIS E SEM DUPLICAÇÃO
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_produtos_operacionais(
  p_busca text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  nome text,
  preco numeric,
  status text,
  comissao_percentual numeric,
  ofertas_ativas bigint,
  checkouts_publicados bigint,
  vendas_confirmadas bigint,
  faturamento_bruto numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT p.*
    FROM public.produtos p
    WHERE p.empresa_id=public.current_empresa_id()
      AND p.deleted_at IS NULL
      AND (
        coalesce(trim(p_busca),'')=''
        OR p.nome ILIKE '%'||trim(p_busca)||'%'
        OR p.id::text ILIKE '%'||trim(p_busca)||'%'
      )
  ),
  vendas AS (
    SELECT i.produto_id,
           count(DISTINCT pd.id) AS vendas,
           coalesce(sum(i.total_snapshot) FILTER (WHERE pd.status_pagamento='confirmado'),0) AS bruto
    FROM public.pedido_itens i
    JOIN public.pedidos pd ON pd.id=i.pedido_id
    WHERE pd.empresa_id=public.current_empresa_id()
      AND pd.status_pagamento='confirmado'
    GROUP BY i.produto_id
  )
  SELECT
    p.id,
    p.nome::text,
    p.preco,
    p.status::text,
    coalesce(p.taxa_comissao_afiliado,0),
    (SELECT count(*) FROM public.ofertas o
      WHERE o.produto_id=p.id AND o.empresa_id=p.empresa_id
        AND o.status='ativa' AND o.deleted_at IS NULL),
    (SELECT count(*) FROM public.checkouts c
      JOIN public.ofertas o ON o.id=c.oferta_id
      WHERE o.produto_id=p.id AND c.empresa_id=p.empresa_id
        AND c.status='publicado' AND c.deleted_at IS NULL),
    coalesce(v.vendas,0),
    coalesce(v.bruto,0)
  FROM base p
  LEFT JOIN vendas v ON v.produto_id=p.id
  ORDER BY p.updated_at DESC
  LIMIT greatest(1,least(coalesce(p_limit,50),200))
  OFFSET greatest(coalesce(p_offset,0),0);
$$;

REVOKE ALL ON FUNCTION public.fn_produtos_operacionais(text,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_produtos_operacionais(text,integer,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_vendas_operacionais(
  p_status text DEFAULT NULL,
  p_busca text DEFAULT NULL,
  p_limit integer DEFAULT 50,
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
  itens jsonb,
  taxas numeric,
  comissoes numeric,
  devolvido numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id',i.id,
        'tipo',i.tipo_item,
        'produto_id',i.produto_id,
        'nome',i.nome_snapshot,
        'preco',i.preco_unitario_snapshot,
        'quantidade',i.quantidade,
        'total',i.total_snapshot
      ) ORDER BY CASE WHEN i.tipo_item='principal' THEN 0 ELSE 1 END, i.created_at)
      FROM public.pedido_itens i WHERE i.pedido_id=p.id
    ),'[]'::jsonb),
    coalesce(p.valor_taxas,0),
    coalesce(p.valor_comissoes,0),
    coalesce(p.valor_devolvido,0)
  FROM public.pedidos p
  WHERE p.empresa_id=public.current_empresa_id()
    AND (coalesce(trim(p_status),'')='' OR p.status_pagamento=p_status OR p.status=p_status)
    AND (
      coalesce(trim(p_busca),'')=''
      OR p.numero ILIKE '%'||trim(p_busca)||'%'
      OR p.comprador_nome ILIKE '%'||trim(p_busca)||'%'
      OR p.comprador_email ILIKE '%'||trim(p_busca)||'%'
      OR EXISTS (
        SELECT 1 FROM public.pedido_itens i
        WHERE i.pedido_id=p.id AND i.nome_snapshot ILIKE '%'||trim(p_busca)||'%'
      )
    )
  ORDER BY p.criado_em DESC
  LIMIT greatest(1,least(coalesce(p_limit,50),200))
  OFFSET greatest(coalesce(p_offset,0),0);
$$;

REVOKE ALL ON FUNCTION public.fn_vendas_operacionais(text,text,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_vendas_operacionais(text,text,integer,integer) TO authenticated;
