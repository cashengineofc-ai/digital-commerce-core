-- Cash Engine PRO — compatibilidade não destrutiva com o schema de comércio já provisionado.
-- Mantém colunas legadas e adiciona o contrato canônico usado pelas migrations 20260918+.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- OFERTAS
-- =========================================================
ALTER TABLE public.ofertas
  ADD COLUMN IF NOT EXISTS preco_comparacao numeric(15,2),
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

UPDATE public.ofertas
SET preco_comparacao=preco_original
WHERE preco_comparacao IS NULL AND preco_original IS NOT NULL;

ALTER TABLE public.ofertas
  DROP CONSTRAINT IF EXISTS ofertas_status_check;

ALTER TABLE public.ofertas
  ADD CONSTRAINT ofertas_status_check
  CHECK (status IN ('rascunho','ativa','pausada','inativa','arquivada'));

-- =========================================================
-- CHECKOUT VERSIONS: numero (legado) <-> versao (canônico)
-- =========================================================
ALTER TABLE public.checkout_versions
  ADD COLUMN IF NOT EXISTS versao integer;

UPDATE public.checkout_versions
SET versao=numero
WHERE versao IS NULL;

ALTER TABLE public.checkout_versions
  ALTER COLUMN numero DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_checkout_versions_checkout_versao_unique
ON public.checkout_versions(checkout_id,versao)
WHERE versao IS NOT NULL;

ALTER TABLE public.checkout_versions
  DROP CONSTRAINT IF EXISTS checkout_versions_estado_check;

ALTER TABLE public.checkout_versions
  ADD CONSTRAINT checkout_versions_estado_check
  CHECK (estado IN ('rascunho','publicado','substituido'));

CREATE OR REPLACE FUNCTION public.fn_checkout_version_compat_sync()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=public
AS $$
BEGIN
  IF NEW.versao IS NULL AND NEW.numero IS NOT NULL THEN
    NEW.versao:=NEW.numero;
  ELSIF NEW.numero IS NULL AND NEW.versao IS NOT NULL THEN
    NEW.numero:=NEW.versao;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_checkout_version_compat_sync ON public.checkout_versions;
CREATE TRIGGER trg_checkout_version_compat_sync
BEFORE INSERT OR UPDATE ON public.checkout_versions
FOR EACH ROW EXECUTE FUNCTION public.fn_checkout_version_compat_sync();

-- =========================================================
-- CHECKOUT ORDER BUMPS: rascunho canônico + compatibilidade com modelo anterior
-- =========================================================
ALTER TABLE public.checkout_order_bumps
  ALTER COLUMN checkout_version_id DROP NOT NULL;

ALTER TABLE public.checkout_order_bumps
  ADD COLUMN IF NOT EXISTS criado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tipo_preco varchar(24),
  ADD COLUMN IF NOT EXISTS grupo_combinacao varchar(80),
  ADD COLUMN IF NOT EXISTS max_selecao_grupo integer,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

UPDATE public.checkout_order_bumps
SET tipo_preco=CASE
  WHEN modo_preco IN ('produto','preco_fixo','desconto_percentual') THEN modo_preco
  WHEN modo_preco='desconto_fixo' THEN 'preco_fixo'
  ELSE 'produto'
END
WHERE tipo_preco IS NULL;

ALTER TABLE public.checkout_order_bumps
  ALTER COLUMN tipo_preco SET DEFAULT 'produto';

CREATE OR REPLACE FUNCTION public.fn_checkout_bump_compat_sync()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=public
AS $$
BEGIN
  IF NEW.tipo_preco IS NULL THEN
    NEW.tipo_preco:=CASE
      WHEN NEW.modo_preco IN ('produto','preco_fixo','desconto_percentual') THEN NEW.modo_preco
      WHEN NEW.modo_preco='desconto_fixo' THEN 'preco_fixo'
      ELSE 'produto'
    END;
  END IF;

  IF NEW.modo_preco IS NULL
     OR NEW.modo_preco IS DISTINCT FROM NEW.tipo_preco THEN
    NEW.modo_preco:=CASE
      WHEN NEW.tipo_preco IN ('produto','preco_fixo','desconto_percentual') THEN NEW.tipo_preco
      ELSE 'produto'
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_checkout_bump_compat_sync ON public.checkout_order_bumps;
CREATE TRIGGER trg_checkout_bump_compat_sync
BEFORE INSERT OR UPDATE ON public.checkout_order_bumps
FOR EACH ROW EXECUTE FUNCTION public.fn_checkout_bump_compat_sync();

-- =========================================================
-- PEDIDOS: contrato canônico sem apagar as colunas legadas.
-- =========================================================
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status_pagamento varchar(30) NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS metodo_pagamento varchar(32) NOT NULL DEFAULT 'pix',
  ADD COLUMN IF NOT EXISTS comprador_nome varchar(180),
  ADD COLUMN IF NOT EXISTS comprador_email varchar(320),
  ADD COLUMN IF NOT EXISTS comprador_documento varchar(40),
  ADD COLUMN IF NOT EXISTS valor_desconto numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_total numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_taxas numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_comissoes numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_devolvido numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS criado_em timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS cancelado_em timestamptz;

UPDATE public.pedidos
SET valor_desconto=coalesce(desconto_total,0),
    valor_total=coalesce(total,0),
    criado_em=coalesce(created_at,now()),
    status_pagamento=CASE
      WHEN status IN ('pago','reembolso_parcial','reembolsado','reembolsado_parcial','reembolsado_total') THEN
        CASE
          WHEN status IN ('reembolso_parcial','reembolsado_parcial') THEN 'reembolsado_parcial'
          WHEN status IN ('reembolsado','reembolsado_total') THEN 'reembolsado_total'
          ELSE 'confirmado'
        END
      WHEN status='cancelado' THEN 'cancelado'
      ELSE 'pendente'
    END
WHERE true;

ALTER TABLE public.pedidos
  DROP CONSTRAINT IF EXISTS pedidos_status_check;

ALTER TABLE public.pedidos
  ADD CONSTRAINT pedidos_status_check
  CHECK (status IN (
    'criado','pagamento_pendente','aguardando_pagamento','pago',
    'cancelado','falhou','reembolso_parcial','reembolsado',
    'reembolsado_parcial','reembolsado_total'
  ));

CREATE OR REPLACE FUNCTION public.fn_pedido_compat_sync()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=public
AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.valor_total IS NULL OR (NEW.valor_total=0 AND coalesce(NEW.total,0)<>0) THEN
      NEW.valor_total:=coalesce(NEW.total,0);
    END IF;
    IF NEW.total IS NULL OR (NEW.total=0 AND coalesce(NEW.valor_total,0)<>0) THEN
      NEW.total:=coalesce(NEW.valor_total,0);
    END IF;
    IF NEW.valor_desconto IS NULL OR (NEW.valor_desconto=0 AND coalesce(NEW.desconto_total,0)<>0) THEN
      NEW.valor_desconto:=coalesce(NEW.desconto_total,0);
    END IF;
    IF NEW.desconto_total IS NULL OR (NEW.desconto_total=0 AND coalesce(NEW.valor_desconto,0)<>0) THEN
      NEW.desconto_total:=coalesce(NEW.valor_desconto,0);
    END IF;
    NEW.criado_em:=coalesce(NEW.criado_em,NEW.created_at,now());
    NEW.created_at:=coalesce(NEW.created_at,NEW.criado_em,now());
  ELSE
    IF NEW.valor_total IS DISTINCT FROM OLD.valor_total
       AND NEW.total IS NOT DISTINCT FROM OLD.total THEN
      NEW.total:=NEW.valor_total;
    ELSIF NEW.total IS DISTINCT FROM OLD.total
       AND NEW.valor_total IS NOT DISTINCT FROM OLD.valor_total THEN
      NEW.valor_total:=NEW.total;
    END IF;

    IF NEW.valor_desconto IS DISTINCT FROM OLD.valor_desconto
       AND NEW.desconto_total IS NOT DISTINCT FROM OLD.desconto_total THEN
      NEW.desconto_total:=NEW.valor_desconto;
    ELSIF NEW.desconto_total IS DISTINCT FROM OLD.desconto_total
       AND NEW.valor_desconto IS NOT DISTINCT FROM OLD.valor_desconto THEN
      NEW.valor_desconto:=NEW.desconto_total;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pedido_compat_sync ON public.pedidos;
CREATE TRIGGER trg_pedido_compat_sync
BEFORE INSERT OR UPDATE ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.fn_pedido_compat_sync();

-- =========================================================
-- ITENS: snapshots canônicos + espelho das colunas legadas.
-- =========================================================
ALTER TABLE public.pedido_itens
  ADD COLUMN IF NOT EXISTS tipo_item varchar(24),
  ADD COLUMN IF NOT EXISTS preco_unitario_snapshot numeric(15,2),
  ADD COLUMN IF NOT EXISTS desconto_snapshot numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_snapshot numeric(15,2),
  ADD COLUMN IF NOT EXISTS comissao_percentual_snapshot numeric(7,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS regra_comissao_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS regra_preco_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.pedido_itens
SET tipo_item=coalesce(tipo_item,tipo),
    preco_unitario_snapshot=coalesce(preco_unitario_snapshot,preco_final_unitario,preco_base_unitario),
    desconto_snapshot=coalesce(desconto_snapshot,desconto_unitario,0),
    total_snapshot=coalesce(total_snapshot,subtotal),
    comissao_percentual_snapshot=coalesce(comissao_percentual_snapshot,taxa_comissao_percentual_snapshot,0),
    regra_comissao_snapshot=CASE
      WHEN regra_comissao_snapshot='{}'::jsonb THEN coalesce(regras_comissao_snapshot,'{}'::jsonb)
      ELSE regra_comissao_snapshot
    END,
    regra_preco_snapshot=CASE
      WHEN regra_preco_snapshot='{}'::jsonb THEN coalesce(regras_preco_snapshot,'{}'::jsonb)
      ELSE regra_preco_snapshot
    END;

ALTER TABLE public.pedido_itens
  ALTER COLUMN tipo DROP NOT NULL,
  ALTER COLUMN item_chave DROP NOT NULL,
  ALTER COLUMN preco_base_unitario DROP NOT NULL,
  ALTER COLUMN preco_final_unitario DROP NOT NULL,
  ALTER COLUMN subtotal DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_pedido_item_compat_sync()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=public
AS $$
BEGIN
  NEW.tipo_item:=coalesce(NEW.tipo_item,NEW.tipo,'principal');
  NEW.tipo:=coalesce(NEW.tipo,NEW.tipo_item);

  NEW.preco_unitario_snapshot:=coalesce(
    NEW.preco_unitario_snapshot,NEW.preco_final_unitario,NEW.preco_base_unitario,0
  );
  NEW.preco_base_unitario:=coalesce(NEW.preco_base_unitario,NEW.preco_unitario_snapshot,0);
  NEW.preco_final_unitario:=coalesce(
    NEW.preco_final_unitario,
    greatest(NEW.preco_unitario_snapshot-coalesce(NEW.desconto_snapshot,0),0)
  );

  NEW.desconto_snapshot:=coalesce(NEW.desconto_snapshot,NEW.desconto_unitario,0);
  NEW.desconto_unitario:=coalesce(NEW.desconto_unitario,NEW.desconto_snapshot,0);

  NEW.total_snapshot:=coalesce(
    NEW.total_snapshot,
    NEW.subtotal,
    round(NEW.preco_final_unitario*coalesce(NEW.quantidade,1),2)
  );
  NEW.subtotal:=coalesce(NEW.subtotal,NEW.total_snapshot,0);

  NEW.comissao_percentual_snapshot:=coalesce(
    NEW.comissao_percentual_snapshot,NEW.taxa_comissao_percentual_snapshot,0
  );
  NEW.taxa_comissao_percentual_snapshot:=coalesce(
    NEW.taxa_comissao_percentual_snapshot,NEW.comissao_percentual_snapshot,0
  );

  NEW.regra_comissao_snapshot:=coalesce(NULLIF(NEW.regra_comissao_snapshot,'{}'::jsonb),NEW.regras_comissao_snapshot,'{}'::jsonb);
  NEW.regras_comissao_snapshot:=coalesce(NULLIF(NEW.regras_comissao_snapshot,'{}'::jsonb),NEW.regra_comissao_snapshot,'{}'::jsonb);
  NEW.regra_preco_snapshot:=coalesce(NULLIF(NEW.regra_preco_snapshot,'{}'::jsonb),NEW.regras_preco_snapshot,'{}'::jsonb);
  NEW.regras_preco_snapshot:=coalesce(NULLIF(NEW.regras_preco_snapshot,'{}'::jsonb),NEW.regra_preco_snapshot,'{}'::jsonb);

  NEW.item_chave:=coalesce(
    NEW.item_chave,
    NEW.tipo_item||':'||coalesce(NEW.produto_id::text,'sem-produto')||':'||substr(NEW.id::text,1,8)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pedido_item_compat_sync ON public.pedido_itens;
CREATE TRIGGER trg_pedido_item_compat_sync
BEFORE INSERT OR UPDATE ON public.pedido_itens
FOR EACH ROW EXECUTE FUNCTION public.fn_pedido_item_compat_sync();

-- =========================================================
-- TOKENS PÚBLICOS: converte contrato legado texto -> UUID sem perder linhas válidas.
-- Tabelas estão vazias hoje, mas a conversão permanece defensiva.
-- =========================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='checkouts'
      AND column_name='public_token' AND data_type='text'
  ) THEN
    ALTER TABLE public.checkouts
      ALTER COLUMN public_token TYPE uuid
      USING CASE
        WHEN nullif(trim(public_token),'') IS NULL THEN gen_random_uuid()
        WHEN public_token ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          THEN public_token::uuid
        ELSE gen_random_uuid()
      END;
  END IF;
END $$;

ALTER TABLE public.checkouts
  ALTER COLUMN public_token SET DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS desativado_em timestamptz;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='links_pagamento'
      AND column_name='public_token' AND data_type='text'
  ) THEN
    ALTER TABLE public.links_pagamento
      ALTER COLUMN public_token TYPE uuid
      USING CASE
        WHEN nullif(trim(public_token),'') IS NULL THEN gen_random_uuid()
        WHEN public_token ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          THEN public_token::uuid
        ELSE gen_random_uuid()
      END;
  END IF;
END $$;

ALTER TABLE public.links_pagamento
  ALTER COLUMN public_token SET DEFAULT gen_random_uuid();

-- Regras mínimas canônicas que CREATE TABLE IF NOT EXISTS não consegue adicionar em tabela preexistente.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pedidos_status_pagamento_chk') THEN
    ALTER TABLE public.pedidos
      ADD CONSTRAINT pedidos_status_pagamento_chk
      CHECK (status_pagamento IN ('pendente','confirmado','falhou','cancelado','reembolsado_parcial','reembolsado_total'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pedido_itens_tipo_item_chk') THEN
    ALTER TABLE public.pedido_itens
      ADD CONSTRAINT pedido_itens_tipo_item_chk
      CHECK (tipo_item IS NULL OR tipo_item IN ('principal','order_bump'));
  END IF;
END $$;
