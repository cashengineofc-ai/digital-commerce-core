-- Cash Engine PRO — regras versionadas de taxas, Split Engine e razão imutável.
-- Fonte única para distribuição econômica. Não representa transferência bancária automática.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- TAXAS VERSIONADAS
-- =========================================================
ALTER TABLE public.taxas_plataforma
  ADD COLUMN IF NOT EXISTS operacao text NOT NULL DEFAULT 'venda',
  ADD COLUMN IF NOT EXISTS base_calculo text NOT NULL DEFAULT 'valor_bruto',
  ADD COLUMN IF NOT EXISTS prioridade integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS versao integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS vigencia_inicio_em timestamptz,
  ADD COLUMN IF NOT EXISTS vigencia_fim_em timestamptz,
  ADD COLUMN IF NOT EXISTS criado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS alterado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS regra_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.taxas_plataforma
SET vigencia_inicio_em = COALESCE(vigencia_inicio_em, data_inicio_vigencia::timestamptz)
WHERE vigencia_inicio_em IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='taxas_plataforma_operacao_chk'
  ) THEN
    ALTER TABLE public.taxas_plataforma
      ADD CONSTRAINT taxas_plataforma_operacao_chk
      CHECK (operacao IN ('venda','saque','repasse','reembolso'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='taxas_plataforma_base_chk'
  ) THEN
    ALTER TABLE public.taxas_plataforma
      ADD CONSTRAINT taxas_plataforma_base_chk
      CHECK (base_calculo IN ('valor_bruto','valor_distribuivel'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='taxas_plataforma_valores_chk'
  ) THEN
    ALTER TABLE public.taxas_plataforma
      ADD CONSTRAINT taxas_plataforma_valores_chk
      CHECK (
        taxa_percentual >= 0
        AND taxa_fixa >= 0
        AND (taxa_minima IS NULL OR taxa_minima >= 0)
        AND (taxa_maxima IS NULL OR taxa_maxima >= 0)
        AND (taxa_minima IS NULL OR taxa_maxima IS NULL OR taxa_maxima >= taxa_minima)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_taxas_aplicaveis
ON public.taxas_plataforma(
  operacao, metodo_pagamento, empresa_id, ativo, vigencia_inicio_em DESC, prioridade
);

CREATE TABLE IF NOT EXISTS public.taxa_operacao_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  regra_id uuid REFERENCES public.taxas_plataforma(id) ON DELETE SET NULL,
  transacao_id uuid REFERENCES public.transacoes(id) ON DELETE RESTRICT,
  saque_id uuid REFERENCES public.saques(id) ON DELETE RESTRICT,
  estorno_id uuid REFERENCES public.estornos(id) ON DELETE RESTRICT,
  operacao text NOT NULL CHECK (operacao IN ('venda','saque','repasse','reembolso')),
  base_valor numeric(15,2) NOT NULL CHECK(base_valor >= 0),
  percentual_snapshot numeric(9,4) NOT NULL DEFAULT 0 CHECK(percentual_snapshot >= 0),
  fixo_snapshot numeric(15,2) NOT NULL DEFAULT 0 CHECK(fixo_snapshot >= 0),
  minimo_snapshot numeric(15,2),
  maximo_snapshot numeric(15,2),
  valor_calculado numeric(15,2) NOT NULL CHECK(valor_calculado >= 0),
  regra_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT taxa_snapshot_origem_chk CHECK (
    (transacao_id IS NOT NULL)::int +
    (saque_id IS NOT NULL)::int +
    (estorno_id IS NOT NULL)::int = 1
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_taxa_snapshot_transacao
ON public.taxa_operacao_snapshots(transacao_id,operacao)
WHERE transacao_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_taxa_snapshot_saque
ON public.taxa_operacao_snapshots(saque_id,operacao)
WHERE saque_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_taxa_snapshot_estorno
ON public.taxa_operacao_snapshots(estorno_id,operacao)
WHERE estorno_id IS NOT NULL;

ALTER TABLE public.taxa_operacao_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS taxa_snapshots_tenant_read ON public.taxa_operacao_snapshots;
CREATE POLICY taxa_snapshots_tenant_read
ON public.taxa_operacao_snapshots
FOR SELECT TO authenticated
USING (empresa_id=public.current_empresa_id() OR public.fn_is_admin_global());

CREATE OR REPLACE FUNCTION public.fn_taxa_calcular(
  p_base numeric,
  p_percentual numeric,
  p_fixo numeric,
  p_minimo numeric DEFAULT NULL,
  p_maximo numeric DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path=public
AS $$
DECLARE v numeric;
BEGIN
  IF p_base IS NULL OR p_base < 0 THEN RAISE EXCEPTION 'invalid_fee_base'; END IF;
  IF coalesce(p_percentual,0) < 0 OR coalesce(p_fixo,0) < 0 THEN
    RAISE EXCEPTION 'invalid_fee_rule';
  END IF;

  v:=round(
    p_base*coalesce(p_percentual,0)/100.0 + coalesce(p_fixo,0),
    2
  );
  IF p_minimo IS NOT NULL THEN v:=greatest(v,p_minimo); END IF;
  IF p_maximo IS NOT NULL THEN v:=least(v,p_maximo); END IF;
  RETURN greatest(round(v,2),0);
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_taxa_regra_aplicavel(
  p_empresa_id uuid,
  p_operacao text,
  p_metodo public.metodo_pagamento,
  p_momento timestamptz
)
RETURNS SETOF public.taxas_plataforma
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
  SELECT t.*
  FROM public.taxas_plataforma t
  LEFT JOIN public.empresas e ON e.id=p_empresa_id
  WHERE t.ativo
    AND t.operacao=p_operacao
    AND t.metodo_pagamento=p_metodo
    AND (t.empresa_id=p_empresa_id OR t.empresa_id IS NULL)
    AND (t.plano=coalesce(e.plano,t.plano) OR t.empresa_id=p_empresa_id)
    AND coalesce(t.vigencia_inicio_em,t.data_inicio_vigencia::timestamptz) <= p_momento
    AND (
      coalesce(t.vigencia_fim_em,(t.data_fim_vigencia + 1)::timestamptz) IS NULL
      OR coalesce(t.vigencia_fim_em,(t.data_fim_vigencia + 1)::timestamptz) > p_momento
    )
  ORDER BY
    (t.empresa_id IS NOT NULL) DESC,
    t.prioridade ASC,
    coalesce(t.vigencia_inicio_em,t.data_inicio_vigencia::timestamptz) DESC,
    t.versao DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.fn_taxa_regra_aplicavel(uuid,text,public.metodo_pagamento,timestamptz)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_taxa_regra_aplicavel(uuid,text,public.metodo_pagamento,timestamptz)
TO service_role;

CREATE OR REPLACE FUNCTION public.fn_admin_taxa_criar_versao(
  p_empresa_id uuid,
  p_operacao text,
  p_metodo public.metodo_pagamento,
  p_percentual numeric,
  p_fixo numeric,
  p_minimo numeric DEFAULT NULL,
  p_maximo numeric DEFAULT NULL,
  p_dias_liquidacao integer DEFAULT 0,
  p_vigencia_inicio timestamptz DEFAULT now(),
  p_base_calculo text DEFAULT 'valor_bruto',
  p_prioridade integer DEFAULT 100,
  p_plano text DEFAULT 'free'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_id uuid;
  v_versao integer;
BEGIN
  IF NOT public.fn_is_admin_global() THEN RAISE EXCEPTION 'platform_admin_required'; END IF;
  IF p_operacao NOT IN ('venda','saque','repasse','reembolso') THEN
    RAISE EXCEPTION 'invalid_fee_operation';
  END IF;
  IF p_base_calculo NOT IN ('valor_bruto','valor_distribuivel') THEN
    RAISE EXCEPTION 'invalid_fee_base';
  END IF;
  IF coalesce(p_percentual,0)<0 OR coalesce(p_fixo,0)<0
     OR (p_minimo IS NOT NULL AND p_minimo<0)
     OR (p_maximo IS NOT NULL AND p_maximo<0)
     OR (p_minimo IS NOT NULL AND p_maximo IS NOT NULL AND p_maximo<p_minimo) THEN
    RAISE EXCEPTION 'invalid_fee_values';
  END IF;
  IF p_dias_liquidacao<0 THEN RAISE EXCEPTION 'invalid_settlement_days'; END IF;

  -- Fecha somente a versão vigente com o mesmo escopo. Histórico permanece.
  UPDATE public.taxas_plataforma
  SET ativo=false,
      vigencia_fim_em=p_vigencia_inicio,
      data_fim_vigencia=p_vigencia_inicio::date,
      alterado_por=auth.uid(),
      updated_at=now()
  WHERE ativo
    AND operacao=p_operacao
    AND metodo_pagamento=p_metodo
    AND empresa_id IS NOT DISTINCT FROM p_empresa_id
    AND plano=p_plano
    AND coalesce(vigencia_inicio_em,data_inicio_vigencia::timestamptz) < p_vigencia_inicio
    AND (
      coalesce(vigencia_fim_em,(data_fim_vigencia+1)::timestamptz) IS NULL
      OR coalesce(vigencia_fim_em,(data_fim_vigencia+1)::timestamptz) > p_vigencia_inicio
    );

  SELECT coalesce(max(versao),0)+1
  INTO v_versao
  FROM public.taxas_plataforma
  WHERE operacao=p_operacao
    AND metodo_pagamento=p_metodo
    AND empresa_id IS NOT DISTINCT FROM p_empresa_id
    AND plano=p_plano;

  INSERT INTO public.taxas_plataforma(
    empresa_id,plano,metodo_pagamento,taxa_percentual,taxa_fixa,
    taxa_minima,taxa_maxima,dias_liquidacao,is_padrao,
    data_inicio_vigencia,ativo,operacao,base_calculo,prioridade,versao,
    vigencia_inicio_em,criado_por,regra_snapshot
  ) VALUES (
    p_empresa_id,p_plano,p_metodo,round(p_percentual,4),round(p_fixo,2),
    p_minimo,p_maximo,p_dias_liquidacao,p_empresa_id IS NULL,
    p_vigencia_inicio::date,true,p_operacao,p_base_calculo,p_prioridade,v_versao,
    p_vigencia_inicio,auth.uid(),
    jsonb_build_object(
      'percentual',round(p_percentual,4),
      'fixo',round(p_fixo,2),
      'minimo',p_minimo,
      'maximo',p_maximo,
      'dias_liquidacao',p_dias_liquidacao,
      'base_calculo',p_base_calculo,
      'rounding','numeric_round_2'
    )
  ) RETURNING id INTO v_id;

  INSERT INTO public.seguranca_audit_log(
    empresa_id,profile_id,acao,modulo,entidade,entidade_id,descricao,detalhes
  ) VALUES (
    p_empresa_id,auth.uid(),'create','financeiro','taxa_plataforma',v_id,
    'Nova versão de taxa criada',
    jsonb_build_object(
      'operacao',p_operacao,'metodo',p_metodo,'versao',v_versao,
      'percentual',p_percentual,'fixo',p_fixo
    )
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_taxa_criar_versao(
  uuid,text,public.metodo_pagamento,numeric,numeric,numeric,numeric,integer,timestamptz,text,integer,text
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_taxa_criar_versao(
  uuid,text,public.metodo_pagamento,numeric,numeric,numeric,numeric,integer,timestamptz,text,integer,text
) TO authenticated;

-- =========================================================
-- SPLIT VERSIONADO
-- =========================================================
CREATE TABLE IF NOT EXISTS public.split_regras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  nome text NOT NULL,
  versao integer NOT NULL DEFAULT 1 CHECK(versao>0),
  status text NOT NULL DEFAULT 'ativa'
    CHECK(status IN ('rascunho','ativa','encerrada')),
  base_calculo text NOT NULL DEFAULT 'apos_taxa_plataforma'
    CHECK(base_calculo IN ('valor_bruto','apos_taxa_plataforma')),
  arredondamento text NOT NULL DEFAULT 'numeric_round_2'
    CHECK(arredondamento='numeric_round_2'),
  vigencia_inicio timestamptz NOT NULL DEFAULT now(),
  vigencia_fim timestamptz,
  criado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(empresa_id,nome,versao)
);

CREATE TABLE IF NOT EXISTS public.split_regra_beneficiarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  split_regra_id uuid NOT NULL REFERENCES public.split_regras(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  tipo text NOT NULL
    CHECK(tipo IN ('produtor','afiliado','plataforma','autorizado')),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  afiliado_id uuid REFERENCES public.afiliados(id) ON DELETE RESTRICT,
  percentual numeric(9,4) NOT NULL DEFAULT 0 CHECK(percentual>=0 AND percentual<=100),
  valor_fixo numeric(15,2) NOT NULL DEFAULT 0 CHECK(valor_fixo>=0),
  prioridade integer NOT NULL DEFAULT 100,
  ativo boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT split_beneficiario_identidade_chk CHECK (
    (tipo='produtor' AND profile_id IS NULL AND afiliado_id IS NULL)
    OR (tipo='plataforma' AND profile_id IS NULL AND afiliado_id IS NULL)
    OR (tipo='afiliado' AND afiliado_id IS NOT NULL)
    OR (tipo='autorizado' AND profile_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.split_distribuicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  transacao_id uuid NOT NULL REFERENCES public.transacoes(id) ON DELETE RESTRICT,
  pedido_id uuid REFERENCES public.pedidos(id) ON DELETE RESTRICT,
  regra_id uuid REFERENCES public.split_regras(id) ON DELETE SET NULL,
  regra_versao integer,
  beneficiario_tipo text NOT NULL
    CHECK(beneficiario_tipo IN ('produtor','afiliado','plataforma','autorizado')),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  afiliado_id uuid REFERENCES public.afiliados(id) ON DELETE RESTRICT,
  base_calculo numeric(15,2) NOT NULL CHECK(base_calculo>=0),
  percentual_snapshot numeric(9,4),
  valor_fixo_snapshot numeric(15,2),
  valor_distribuido numeric(15,2) NOT NULL CHECK(valor_distribuido>=0),
  valor_revertido numeric(15,2) NOT NULL DEFAULT 0 CHECK(valor_revertido>=0),
  regra_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT split_distribuicao_reversao_chk CHECK(valor_revertido<=valor_distribuido)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_split_unico_beneficiario
ON public.split_distribuicoes(
  transacao_id,beneficiario_tipo,coalesce(profile_id,'00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(afiliado_id,'00000000-0000-0000-0000-000000000000'::uuid)
);

CREATE INDEX IF NOT EXISTS idx_split_transacao
ON public.split_distribuicoes(transacao_id,beneficiario_tipo);

ALTER TABLE public.split_regras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.split_regra_beneficiarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.split_distribuicoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS split_regras_tenant ON public.split_regras;
CREATE POLICY split_regras_tenant ON public.split_regras
FOR ALL TO authenticated
USING (
  empresa_id=public.current_empresa_id()
  AND (
    public.fn_is_empresa_owner(empresa_id)
    OR public.fn_tem_permissao('financeiro','split','manage'::public.tipo_operacao)
  )
  OR public.fn_is_admin_global()
)
WITH CHECK (
  empresa_id=public.current_empresa_id()
  AND (
    public.fn_is_empresa_owner(empresa_id)
    OR public.fn_tem_permissao('financeiro','split','manage'::public.tipo_operacao)
  )
  OR public.fn_is_admin_global()
);

DROP POLICY IF EXISTS split_regra_benef_tenant ON public.split_regra_beneficiarios;
CREATE POLICY split_regra_benef_tenant ON public.split_regra_beneficiarios
FOR ALL TO authenticated
USING (
  empresa_id=public.current_empresa_id()
  AND (
    public.fn_is_empresa_owner(empresa_id)
    OR public.fn_tem_permissao('financeiro','split','manage'::public.tipo_operacao)
  )
  OR public.fn_is_admin_global()
)
WITH CHECK (
  empresa_id=public.current_empresa_id()
  AND (
    public.fn_is_empresa_owner(empresa_id)
    OR public.fn_tem_permissao('financeiro','split','manage'::public.tipo_operacao)
  )
  OR public.fn_is_admin_global()
);

DROP POLICY IF EXISTS split_distribuicoes_read ON public.split_distribuicoes;
CREATE POLICY split_distribuicoes_read ON public.split_distribuicoes
FOR SELECT TO authenticated
USING (
  public.fn_is_admin_global()
  OR empresa_id=public.current_empresa_id()
  OR afiliado_id IN (
    SELECT a.id FROM public.afiliados a
    WHERE a.profile_id=auth.uid() AND a.deleted_at IS NULL
  )
);

-- =========================================================
-- RAZÃO IMUTÁVEL E IDEMPOTENTE
-- =========================================================
ALTER TABLE public.lancamentos_contabeis
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS bucket text NOT NULL DEFAULT 'disponivel',
  ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'efetivo',
  ADD COLUMN IF NOT EXISTS reversao_de uuid REFERENCES public.lancamentos_contabeis(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS origem_tipo text,
  ADD COLUMN IF NOT EXISTS origem_id uuid,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='lancamentos_bucket_chk'
  ) THEN
    ALTER TABLE public.lancamentos_contabeis
      ADD CONSTRAINT lancamentos_bucket_chk
      CHECK(bucket IN ('a_receber','disponivel','reservado','bloqueado','liquidado','estornado'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='lancamentos_estado_chk'
  ) THEN
    ALTER TABLE public.lancamentos_contabeis
      ADD CONSTRAINT lancamentos_estado_chk
      CHECK(estado IN ('efetivo','reversao','ajuste'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lancamentos_idempotency
ON public.lancamentos_contabeis(idempotency_key)
WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lancamentos_entidade_bucket_data
ON public.lancamentos_contabeis(
  empresa_id,profile_id,afiliado_id,bucket,data_lancamento DESC,id DESC
);

CREATE OR REPLACE FUNCTION public.fn_ledger_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=public
AS $$
BEGIN
  IF auth.role()='service_role' THEN
    RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
  END IF;

  -- Nem admin corrige um lançamento existente. Correção = novo ajuste/reversão.
  RAISE EXCEPTION 'ledger_entries_are_immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_ledger_immutable ON public.lancamentos_contabeis;
CREATE TRIGGER trg_ledger_immutable
BEFORE UPDATE OR DELETE ON public.lancamentos_contabeis
FOR EACH ROW EXECUTE FUNCTION public.fn_ledger_immutable();

CREATE OR REPLACE FUNCTION public.fn_ledger_registrar(
  p_idempotency_key text,
  p_empresa_id uuid,
  p_profile_id uuid,
  p_afiliado_id uuid,
  p_transacao_id uuid,
  p_saque_id uuid,
  p_estorno_id uuid,
  p_comissao_id uuid,
  p_repasse_id uuid,
  p_conta text,
  p_descricao text,
  p_tipo char,
  p_valor numeric,
  p_bucket text,
  p_estado text,
  p_documento text,
  p_origem_tipo text,
  p_origem_id uuid,
  p_reversao_de uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v_id uuid;
BEGIN
  IF p_idempotency_key IS NULL OR trim(p_idempotency_key)='' THEN
    RAISE EXCEPTION 'ledger_idempotency_required';
  END IF;
  IF p_tipo NOT IN ('C','D') THEN RAISE EXCEPTION 'ledger_type_invalid'; END IF;
  IF p_valor IS NULL OR p_valor<=0 THEN RAISE EXCEPTION 'ledger_value_invalid'; END IF;
  IF p_bucket NOT IN ('a_receber','disponivel','reservado','bloqueado','liquidado','estornado') THEN
    RAISE EXCEPTION 'ledger_bucket_invalid';
  END IF;

  SELECT id INTO v_id
  FROM public.lancamentos_contabeis
  WHERE idempotency_key=p_idempotency_key;
  IF FOUND THEN RETURN v_id; END IF;

  INSERT INTO public.lancamentos_contabeis(
    empresa_id,profile_id,afiliado_id,transacao_id,saque_id,estorno_id,
    comissao_id,repasse_id,conta_contabil,descricao,tipo_lancamento,valor,
    competencia,documento_referencia,criado_por,automatico,motivo_manual,
    idempotency_key,bucket,estado,reversao_de,origem_tipo,origem_id,metadata
  ) VALUES (
    p_empresa_id,p_profile_id,p_afiliado_id,p_transacao_id,p_saque_id,p_estorno_id,
    p_comissao_id,p_repasse_id,p_conta,left(p_descricao,255),p_tipo,round(p_valor,2),
    current_date,p_documento,auth.uid(),p_estado<>'ajuste',
    CASE WHEN p_estado='ajuste' THEN coalesce(p_metadata->>'motivo','Ajuste auditado') ELSE NULL END,
    p_idempotency_key,p_bucket,p_estado,p_reversao_de,p_origem_tipo,p_origem_id,
    coalesce(p_metadata,'{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_ledger_registrar(
  text,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,char,numeric,text,text,text,text,uuid,uuid,jsonb
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ledger_registrar(
  text,uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,char,numeric,text,text,text,text,uuid,uuid,jsonb
) TO service_role;

-- =========================================================
-- SNAPSHOT + DISTRIBUIÇÃO DE VENDA
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_financeiro_snapshot_venda(p_transacao_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_t public.transacoes%ROWTYPE;
  v_p public.pedidos%ROWTYPE;
  v_rule public.taxas_plataforma%ROWTYPE;
  v_rule_found boolean:=false;
  v_fee numeric(15,2):=0;
  v_gross numeric(15,2);
  v_commission numeric(15,2):=0;
  v_producer numeric(15,2);
  v_fee_snapshot uuid;
  v_available boolean;
  v_bucket text;
  v_commission_id uuid;
  v_ref text;
BEGIN
  SELECT * INTO v_t
  FROM public.transacoes
  WHERE id=p_transacao_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN false; END IF;
  IF v_t.status NOT IN ('aprovada','capturada','paga','disponivel') THEN RETURN false; END IF;

  -- Idempotência: se já existe split, não redistribui.
  IF EXISTS(SELECT 1 FROM public.split_distribuicoes WHERE transacao_id=v_t.id) THEN
    RETURN false;
  END IF;

  IF v_t.pedido_id IS NOT NULL THEN
    SELECT * INTO v_p FROM public.pedidos WHERE id=v_t.pedido_id FOR UPDATE;
  END IF;

  v_gross:=round(coalesce(v_p.valor_total,v_t.valor_bruto,0),2);
  IF v_gross<=0 THEN RAISE EXCEPTION 'financial_gross_invalid'; END IF;
  v_ref:=coalesce(v_t.pedido_numero,v_t.id::text);

  SELECT *
  INTO v_rule
  FROM public.fn_taxa_regra_aplicavel(
    v_t.empresa_id,'venda',coalesce(v_t.metodo_pagamento,'pix'::public.metodo_pagamento),
    coalesce(v_t.data_pagamento,v_t.created_at)
  )
  LIMIT 1;
  v_rule_found:=FOUND;

  IF v_rule_found THEN
    v_fee:=public.fn_taxa_calcular(
      v_gross,v_rule.taxa_percentual,v_rule.taxa_fixa,v_rule.taxa_minima,v_rule.taxa_maxima
    );

    INSERT INTO public.taxa_operacao_snapshots(
      empresa_id,regra_id,transacao_id,operacao,base_valor,
      percentual_snapshot,fixo_snapshot,minimo_snapshot,maximo_snapshot,
      valor_calculado,regra_snapshot
    ) VALUES (
      v_t.empresa_id,v_rule.id,v_t.id,'venda',v_gross,
      v_rule.taxa_percentual,v_rule.taxa_fixa,v_rule.taxa_minima,v_rule.taxa_maxima,
      v_fee,
      coalesce(v_rule.regra_snapshot,'{}'::jsonb) || jsonb_build_object(
        'rule_id',v_rule.id,'versao',v_rule.versao,'aplicada_em',coalesce(v_t.data_pagamento,now())
      )
    )
    ON CONFLICT(transacao_id,operacao) WHERE transacao_id IS NOT NULL
    DO NOTHING
    RETURNING id INTO v_fee_snapshot;
  END IF;

  -- Comissão vem do snapshot do pedido, nunca do produto atual.
  IF v_t.afiliado_id IS NOT NULL AND v_t.pedido_id IS NOT NULL THEN
    SELECT coalesce(sum(comissao_valor_snapshot),0)
    INTO v_commission
    FROM public.pedido_itens
    WHERE pedido_id=v_t.pedido_id;
  END IF;

  v_fee:=least(greatest(v_fee,0),v_gross);
  v_commission:=least(greatest(round(v_commission,2),0),greatest(v_gross-v_fee,0));
  v_producer:=round(v_gross-v_fee-v_commission,2);

  IF v_producer<0 OR round(v_producer+v_fee+v_commission,2)<>v_gross THEN
    RAISE EXCEPTION 'split_distribution_invalid';
  END IF;

  INSERT INTO public.split_distribuicoes(
    empresa_id,transacao_id,pedido_id,regra_id,regra_versao,
    beneficiario_tipo,base_calculo,valor_distribuido,regra_snapshot
  ) VALUES (
    v_t.empresa_id,v_t.id,v_t.pedido_id,NULL,NULL,
    'produtor',v_gross,v_producer,
    jsonb_build_object(
      'formula','gross-platform_fee-affiliate_commission',
      'gross',v_gross,'platform_fee',v_fee,'affiliate_commission',v_commission
    )
  );

  IF v_fee>0 THEN
    INSERT INTO public.split_distribuicoes(
      empresa_id,transacao_id,pedido_id,regra_id,regra_versao,
      beneficiario_tipo,base_calculo,valor_distribuido,regra_snapshot
    ) VALUES (
      v_t.empresa_id,v_t.id,v_t.pedido_id,
      CASE WHEN v_rule_found THEN v_rule.id ELSE NULL END,
      CASE WHEN v_rule_found THEN v_rule.versao ELSE NULL END,
      'plataforma',v_gross,v_fee,
      jsonb_build_object(
        'rule_id',CASE WHEN v_rule_found THEN v_rule.id ELSE NULL END,
        'tax_snapshot_id',v_fee_snapshot,
        'provider_cost_included',false
      )
    );
  END IF;

  IF v_commission>0 AND v_t.afiliado_id IS NOT NULL THEN
    INSERT INTO public.split_distribuicoes(
      empresa_id,transacao_id,pedido_id,beneficiario_tipo,afiliado_id,
      base_calculo,valor_distribuido,regra_snapshot
    ) VALUES (
      v_t.empresa_id,v_t.id,v_t.pedido_id,'afiliado',v_t.afiliado_id,
      v_gross,v_commission,
      jsonb_build_object('source','pedido_itens.comissao_valor_snapshot')
    );
  END IF;

  v_available:=v_t.status='disponivel'
    OR (v_t.data_disponivel IS NOT NULL AND v_t.data_disponivel<=now());
  v_bucket:=CASE WHEN v_available THEN 'disponivel' ELSE 'a_receber' END;

  -- Extrato da empresa: crédito bruto e débitos econômicos preservam transparência.
  PERFORM public.fn_ledger_registrar(
    'sale:'||v_t.id||':gross',
    v_t.empresa_id,NULL,NULL,v_t.id,NULL,NULL,NULL,NULL,
    'VENDA_BRUTA','Venda confirmada','C',v_gross,v_bucket,'efetivo',
    v_ref,'venda',v_t.id,NULL,
    jsonb_build_object('pedido_id',v_t.pedido_id)
  );

  IF v_fee>0 THEN
    PERFORM public.fn_ledger_registrar(
      'sale:'||v_t.id||':platform_fee',
      v_t.empresa_id,NULL,NULL,v_t.id,NULL,NULL,NULL,NULL,
      'TAXA_PLATAFORMA','Taxa da plataforma','D',v_fee,v_bucket,'efetivo',
      v_ref,'taxa',coalesce(v_fee_snapshot,v_t.id),NULL,
      jsonb_build_object('tax_snapshot_id',v_fee_snapshot)
    );
  END IF;

  IF v_commission>0 AND v_t.afiliado_id IS NOT NULL THEN
    -- Comissão na empresa = obrigação/débito.
    PERFORM public.fn_ledger_registrar(
      'sale:'||v_t.id||':affiliate_expense',
      v_t.empresa_id,NULL,NULL,v_t.id,NULL,NULL,NULL,NULL,
      'COMISSAO_AFILIADO','Comissão de afiliado','D',v_commission,v_bucket,'efetivo',
      v_ref,'comissao',v_t.id,NULL,
      jsonb_build_object('afiliado_id',v_t.afiliado_id)
    );

    INSERT INTO public.comissoes(
      empresa_id,afiliado_id,produto_id,transacao_id,cliente_id,link_afiliado_id,
      valor_venda,taxa_comissao_percentual,valor_comissao_bruta,
      valor_comissao_liquida,status,data_prevista_liberacao,data_aprovacao,metadata
    ) VALUES (
      v_t.empresa_id,v_t.afiliado_id,v_t.produto_id,v_t.id,v_t.cliente_id,v_t.link_afiliado_id,
      v_gross,
      CASE WHEN v_gross>0 THEN round(v_commission*100.0/v_gross,2) ELSE 0 END,
      v_commission,v_commission,
      CASE WHEN v_available THEN 'liberada'::public.status_comissao ELSE 'aprovada'::public.status_comissao END,
      v_t.data_disponivel,now(),
      jsonb_build_object('origem','snapshot_pedido','pedido_id',v_t.pedido_id)
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_commission_id;

    IF v_commission_id IS NULL THEN
      SELECT id INTO v_commission_id
      FROM public.comissoes
      WHERE transacao_id=v_t.id AND afiliado_id=v_t.afiliado_id AND deleted_at IS NULL
      ORDER BY created_at LIMIT 1;
    END IF;

    -- Comissão no extrato do afiliado = crédito próprio.
    PERFORM public.fn_ledger_registrar(
      'sale:'||v_t.id||':affiliate_credit:'||v_t.afiliado_id,
      v_t.empresa_id,NULL,v_t.afiliado_id,v_t.id,NULL,NULL,v_commission_id,NULL,
      'COMISSAO_RECEBIDA','Comissão de venda confirmada','C',v_commission,v_bucket,'efetivo',
      v_ref,'comissao',coalesce(v_commission_id,v_t.id),NULL,
      jsonb_build_object('pedido_id',v_t.pedido_id)
    );
  END IF;

  UPDATE public.transacoes
  SET valor_taxa_plataforma=v_fee,
      valor_comissao_afiliado=v_commission,
      valor_saldo_empresa=v_producer,
      valor_liquido=v_producer,
      saldo_processado_em=coalesce(saldo_processado_em,now()),
      saldo_liberado_em=CASE WHEN v_available THEN coalesce(saldo_liberado_em,now()) ELSE saldo_liberado_em END,
      updated_at=now()
  WHERE id=v_t.id;

  IF v_t.pedido_id IS NOT NULL THEN
    UPDATE public.pedidos
    SET valor_taxas=v_fee,
        valor_comissoes=v_commission,
        updated_at=now()
    WHERE id=v_t.pedido_id;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_financeiro_snapshot_venda(uuid)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_financeiro_snapshot_venda(uuid) TO service_role;

-- Substitui o processador legado para nunca tratar 'autorizada' como dinheiro confirmado.
CREATE OR REPLACE FUNCTION public.fn_processar_financeiro_transacao(p_transacao_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_status public.status_transacao;
BEGIN
  SELECT status INTO v_status FROM public.transacoes WHERE id=p_transacao_id;
  IF NOT FOUND THEN RETURN false; END IF;

  IF v_status IN ('aprovada','capturada','paga','disponivel') THEN
    RETURN public.fn_financeiro_snapshot_venda(p_transacao_id);
  END IF;

  -- Reversões passam pelo fluxo de estorno versionado; não apaga histórico aqui.
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_processar_financeiro_transacao(uuid)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_processar_financeiro_transacao(uuid) TO service_role;
