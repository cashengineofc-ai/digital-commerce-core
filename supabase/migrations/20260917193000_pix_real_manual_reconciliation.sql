-- Cash Engine PRO — Pix real por chave + conciliação manual auditável.
-- Não configura nenhuma chave demonstrativa. O modo padrão permanece desativado
-- enquanto o admin global não salvar uma configuração real.

ALTER TABLE public.transacoes
  ADD COLUMN IF NOT EXISTS pix_modo TEXT,
  ADD COLUMN IF NOT EXISTS pix_txid VARCHAR(25),
  ADD COLUMN IF NOT EXISTS pix_chave_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS pix_recebedor_nome TEXT,
  ADD COLUMN IF NOT EXISTS pix_recebedor_cidade TEXT,
  ADD COLUMN IF NOT EXISTS pix_gerado_em TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.pix_confirmacoes_manuais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transacao_id UUID NOT NULL UNIQUE REFERENCES public.transacoes(id) ON DELETE RESTRICT,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  referencia_bancaria TEXT NOT NULL,
  evidencia TEXT NOT NULL,
  valor_confirmado NUMERIC(15,2) NOT NULL CHECK (valor_confirmado > 0),
  recebedor_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  confirmado_por UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  confirmado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.pix_confirmacoes_manuais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pix_confirmacoes_admin_only
ON public.pix_confirmacoes_manuais;

CREATE POLICY pix_confirmacoes_admin_only
ON public.pix_confirmacoes_manuais
FOR ALL TO authenticated
USING (public.fn_is_admin_global())
WITH CHECK (public.fn_is_admin_global());

CREATE INDEX IF NOT EXISTS idx_pix_manual_pendente
ON public.transacoes (created_at DESC)
WHERE provedor_pagamento = 'pix_chave'
  AND metodo_pagamento = 'pix'
  AND status = 'pendente';

CREATE OR REPLACE FUNCTION public.fn_salvar_config_pix(
  p_modo TEXT,
  p_chave TEXT DEFAULT NULL,
  p_recebedor_nome TEXT DEFAULT NULL,
  p_recebedor_cidade TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_modo TEXT := lower(trim(COALESCE(p_modo, '')));
  v_chave TEXT := trim(COALESCE(p_chave, ''));
  v_nome TEXT := upper(trim(COALESCE(p_recebedor_nome, '')));
  v_cidade TEXT := upper(trim(COALESCE(p_recebedor_cidade, '')));
BEGIN
  IF NOT public.fn_is_admin_global() THEN
    RAISE EXCEPTION 'Apenas admin global pode alterar a configuração Pix';
  END IF;

  IF v_modo NOT IN ('desativado', 'chave', 'provedor') THEN
    RAISE EXCEPTION 'Modo Pix inválido';
  END IF;

  IF v_modo = 'chave' THEN
    IF v_chave = '' OR v_nome = '' OR v_cidade = '' THEN
      RAISE EXCEPTION 'Chave, recebedor e cidade são obrigatórios no modo por chave';
    END IF;
    IF octet_length(v_chave) > 77 THEN
      RAISE EXCEPTION 'Chave Pix excede o tamanho permitido no BR Code';
    END IF;
    IF char_length(v_nome) > 25 THEN
      RAISE EXCEPTION 'Nome do recebedor deve ter no máximo 25 caracteres';
    END IF;
    IF char_length(v_cidade) > 15 THEN
      RAISE EXCEPTION 'Cidade do recebedor deve ter no máximo 15 caracteres';
    END IF;
  END IF;

  INSERT INTO public.admin_global_config
    (chave, valor, tipo_valor, descricao, categoria, modulo, sensivel, publico, updated_by, updated_at)
  VALUES
    ('pix_modo_recebimento', to_jsonb(v_modo), 'string', 'Modo de recebimento Pix: desativado, chave ou provedor', 'pagamentos', 'pix', FALSE, FALSE, auth.uid(), NOW())
  ON CONFLICT (chave) DO UPDATE
  SET valor=EXCLUDED.valor, updated_by=EXCLUDED.updated_by, updated_at=NOW();

  INSERT INTO public.admin_global_config
    (chave, valor, tipo_valor, descricao, categoria, modulo, sensivel, publico, updated_by, updated_at)
  VALUES
    ('pix_chave', to_jsonb(NULLIF(v_chave,'')), 'string', 'Chave Pix usada no BR Code estático', 'pagamentos', 'pix', TRUE, FALSE, auth.uid(), NOW())
  ON CONFLICT (chave) DO UPDATE
  SET valor=EXCLUDED.valor, updated_by=EXCLUDED.updated_by, updated_at=NOW();

  INSERT INTO public.admin_global_config
    (chave, valor, tipo_valor, descricao, categoria, modulo, sensivel, publico, updated_by, updated_at)
  VALUES
    ('pix_recebedor_nome', to_jsonb(NULLIF(v_nome,'')), 'string', 'Nome do recebedor no BR Code', 'pagamentos', 'pix', FALSE, FALSE, auth.uid(), NOW())
  ON CONFLICT (chave) DO UPDATE
  SET valor=EXCLUDED.valor, updated_by=EXCLUDED.updated_by, updated_at=NOW();

  INSERT INTO public.admin_global_config
    (chave, valor, tipo_valor, descricao, categoria, modulo, sensivel, publico, updated_by, updated_at)
  VALUES
    ('pix_recebedor_cidade', to_jsonb(NULLIF(v_cidade,'')), 'string', 'Cidade do recebedor no BR Code', 'pagamentos', 'pix', FALSE, FALSE, auth.uid(), NOW())
  ON CONFLICT (chave) DO UPDATE
  SET valor=EXCLUDED.valor, updated_by=EXCLUDED.updated_by, updated_at=NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.fn_salvar_config_pix(TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_salvar_config_pix(TEXT,TEXT,TEXT,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_obter_config_pix_admin()
RETURNS TABLE(
  modo TEXT,
  chave TEXT,
  recebedor_nome TEXT,
  recebedor_cidade TEXT,
  configurado BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.fn_is_admin_global() THEN
    RAISE EXCEPTION 'Apenas admin global pode consultar a configuração Pix';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE((SELECT valor #>> '{}' FROM public.admin_global_config WHERE chave='pix_modo_recebimento'), 'desativado'),
    (SELECT valor #>> '{}' FROM public.admin_global_config WHERE chave='pix_chave'),
    (SELECT valor #>> '{}' FROM public.admin_global_config WHERE chave='pix_recebedor_nome'),
    (SELECT valor #>> '{}' FROM public.admin_global_config WHERE chave='pix_recebedor_cidade'),
    COALESCE((SELECT valor #>> '{}' FROM public.admin_global_config WHERE chave='pix_modo_recebimento'), 'desativado') <> 'desativado';
END;
$$;

REVOKE ALL ON FUNCTION public.fn_obter_config_pix_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_obter_config_pix_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_confirmar_pix_manual(
  p_transacao_id UUID,
  p_referencia_bancaria TEXT,
  p_evidencia TEXT
)
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_t public.transacoes%ROWTYPE;
  v_id UUID;
BEGIN
  IF NOT public.fn_is_admin_global() THEN
    RAISE EXCEPTION 'Apenas admin global pode confirmar Pix manual';
  END IF;

  IF trim(COALESCE(p_referencia_bancaria,'')) = ''
     OR trim(COALESCE(p_evidencia,'')) = '' THEN
    RAISE EXCEPTION 'Referência bancária e evidência são obrigatórias';
  END IF;

  SELECT * INTO v_t
  FROM public.transacoes
  WHERE id = p_transacao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transação não encontrada';
  END IF;

  IF v_t.provedor_pagamento IS DISTINCT FROM 'pix_chave'
     OR v_t.metodo_pagamento IS DISTINCT FROM 'pix' THEN
    RAISE EXCEPTION 'Transação não pertence ao fluxo Pix por chave';
  END IF;

  IF v_t.status IN ('aprovada','capturada','paga','disponivel')
     OR v_t.data_pagamento IS NOT NULL THEN
    RAISE EXCEPTION 'Transação já confirmada';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.pix_confirmacoes_manuais
    WHERE transacao_id = v_t.id
  ) THEN
    RAISE EXCEPTION 'Confirmação manual já registrada';
  END IF;

  INSERT INTO public.pix_confirmacoes_manuais (
    transacao_id,
    empresa_id,
    referencia_bancaria,
    evidencia,
    valor_confirmado,
    recebedor_snapshot,
    confirmado_por,
    metadata
  ) VALUES (
    v_t.id,
    v_t.empresa_id,
    trim(p_referencia_bancaria),
    trim(p_evidencia),
    v_t.valor_bruto,
    jsonb_build_object(
      'chave', v_t.pix_chave_snapshot,
      'nome', v_t.pix_recebedor_nome,
      'cidade', v_t.pix_recebedor_cidade,
      'txid', v_t.pix_txid
    ),
    auth.uid(),
    jsonb_build_object('origem','conferencia_bancaria_manual')
  ) RETURNING id INTO v_id;

  UPDATE public.transacoes
  SET
    status = 'paga',
    status_detalhe_provedor = 'confirmado_manual_admin',
    data_pagamento = NOW(),
    updated_at = NOW(),
    metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object(
      'pix_confirmacao_manual_id', v_id,
      'pix_confirmado_por', auth.uid(),
      'pix_confirmado_em', NOW()
    )
  WHERE id = v_t.id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_confirmar_pix_manual(UUID,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_confirmar_pix_manual(UUID,TEXT,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_listar_pix_manual_pendente()
RETURNS TABLE(
  transacao_id UUID,
  pedido_numero VARCHAR,
  valor NUMERIC,
  recebedor_nome TEXT,
  recebedor_cidade TEXT,
  txid VARCHAR,
  criado_em TIMESTAMPTZ,
  cliente_nome VARCHAR,
  cliente_email VARCHAR
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.fn_is_admin_global() THEN
    RAISE EXCEPTION 'Apenas admin global pode listar Pix pendente';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.pedido_numero,
    t.valor_bruto,
    t.pix_recebedor_nome,
    t.pix_recebedor_cidade,
    t.pix_txid,
    t.created_at,
    c.nome_completo,
    c.email
  FROM public.transacoes t
  LEFT JOIN public.clientes c ON c.id=t.cliente_id
  WHERE t.provedor_pagamento='pix_chave'
    AND t.metodo_pagamento='pix'
    AND t.status='pendente'
    AND t.data_pagamento IS NULL
  ORDER BY t.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_listar_pix_manual_pendente() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_listar_pix_manual_pendente() TO authenticated;
