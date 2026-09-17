-- Cash Engine PRO — runtime real do Split Engine.
-- Ordem econômica: bruto -> taxa da plataforma -> comissão do afiliado
-- -> parceiros autorizados -> produtor residual.
-- Split contábil não equivale a transferência bancária automática.

ALTER TABLE public.split_regras
  DROP CONSTRAINT IF EXISTS split_regras_base_calculo_check;

ALTER TABLE public.split_regras
  ADD CONSTRAINT split_regras_base_calculo_check
  CHECK(base_calculo IN ('valor_bruto','apos_taxa_plataforma','apos_taxa_e_comissao'));

-- Apenas uma regra ativa por empresa para evitar ambiguidade operacional.
CREATE UNIQUE INDEX IF NOT EXISTS idx_split_regra_ativa_empresa
ON public.split_regras(empresa_id)
WHERE status='ativa';

CREATE OR REPLACE FUNCTION public.fn_split_regra_criar_versao(
  p_nome text,
  p_beneficiarios jsonb,
  p_vigencia_inicio timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_id uuid;
  v_versao integer;
  v_item jsonb;
  v_profile uuid;
  v_percent numeric(9,4);
  v_priority integer;
  v_total_percent numeric(9,4):=0;
  v_count integer:=0;
  v_distinct integer:=0;
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT (
    public.fn_is_admin_global()
    OR public.fn_is_empresa_owner(v_empresa)
    OR public.fn_tem_permissao('financeiro','split','manage'::public.tipo_operacao)
  ) THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  IF trim(coalesce(p_nome,''))='' THEN RAISE EXCEPTION 'split_rule_name_required'; END IF;
  IF p_beneficiarios IS NULL OR jsonb_typeof(p_beneficiarios)<>'array' THEN
    RAISE EXCEPTION 'split_beneficiaries_must_be_array';
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS pg_temp.split_input(
    profile_id uuid PRIMARY KEY,
    percentual numeric(9,4) NOT NULL,
    prioridade integer NOT NULL
  ) ON COMMIT DROP;
  TRUNCATE pg_temp.split_input;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_beneficiarios)
  LOOP
    IF jsonb_typeof(v_item)<>'object' THEN
      RAISE EXCEPTION 'split_beneficiary_invalid';
    END IF;

    BEGIN
      v_profile:=(v_item->>'profile_id')::uuid;
      v_percent:=round((v_item->>'percentual')::numeric,4);
      v_priority:=coalesce((v_item->>'prioridade')::integer,100);
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'split_beneficiary_invalid';
    END;

    IF v_percent<=0 OR v_percent>100 THEN
      RAISE EXCEPTION 'split_percentage_invalid';
    END IF;

    IF NOT EXISTS(
      SELECT 1 FROM public.profiles p
      WHERE p.id=v_profile
        AND p.empresa_id=v_empresa
        AND p.status='ativo'
        AND p.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'split_beneficiary_not_authorized';
    END IF;

    INSERT INTO pg_temp.split_input(profile_id,percentual,prioridade)
    VALUES(v_profile,v_percent,v_priority)
    ON CONFLICT(profile_id) DO UPDATE
      SET percentual=excluded.percentual,prioridade=excluded.prioridade;
  END LOOP;

  SELECT count(*),coalesce(sum(percentual),0)
  INTO v_count,v_total_percent
  FROM pg_temp.split_input;

  IF v_total_percent>100 THEN
    RAISE EXCEPTION 'split_percentages_exceed_100';
  END IF;

  -- Fecha a regra anterior sem apagar histórico.
  UPDATE public.split_regras
  SET status='encerrada',vigencia_fim=p_vigencia_inicio
  WHERE empresa_id=v_empresa AND status='ativa';

  SELECT coalesce(max(versao),0)+1
  INTO v_versao
  FROM public.split_regras
  WHERE empresa_id=v_empresa;

  INSERT INTO public.split_regras(
    empresa_id,nome,versao,status,base_calculo,arredondamento,
    vigencia_inicio,criado_por,metadata
  ) VALUES (
    v_empresa,trim(p_nome),v_versao,'ativa','apos_taxa_e_comissao',
    'numeric_round_2',p_vigencia_inicio,auth.uid(),
    jsonb_build_object(
      'authorized_percent_total',v_total_percent,
      'beneficiary_count',v_count,
      'calculation_order',jsonb_build_array(
        'platform_fee','affiliate_commission','authorized_partners','producer_residual'
      )
    )
  )
  RETURNING id INTO v_id;

  INSERT INTO public.split_regra_beneficiarios(
    split_regra_id,empresa_id,tipo,profile_id,percentual,
    valor_fixo,prioridade,ativo,metadata
  )
  SELECT
    v_id,v_empresa,'autorizado',profile_id,percentual,
    0,prioridade,true,
    jsonb_build_object('base','producer_pool_after_fee_and_commission')
  FROM pg_temp.split_input
  ORDER BY prioridade,profile_id;

  INSERT INTO public.seguranca_audit_log(
    empresa_id,profile_id,acao,modulo,entidade,entidade_id,descricao,detalhes
  ) VALUES (
    v_empresa,auth.uid(),'create','financeiro','split_regra',v_id,
    'Nova versão de regra do Split Engine criada',
    jsonb_build_object(
      'versao',v_versao,
      'percentual_parceiros',v_total_percent,
      'beneficiarios',v_count
    )
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_split_regra_criar_versao(text,jsonb,timestamptz)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_split_regra_criar_versao(text,jsonb,timestamptz)
TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_split_regra_atual()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_rule public.split_regras%ROWTYPE;
  v_beneficiaries jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_rule
  FROM public.split_regras
  WHERE empresa_id=v_empresa
    AND status='ativa'
    AND vigencia_inicio<=now()
    AND (vigencia_fim IS NULL OR vigencia_fim>now())
  ORDER BY vigencia_inicio DESC,versao DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'rule',NULL,
      'beneficiaries','[]'::jsonb
    );
  END IF;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id',b.id,
      'profile_id',b.profile_id,
      'name',p.nome_completo,
      'percentual',b.percentual,
      'prioridade',b.prioridade
    )
    ORDER BY b.prioridade,b.id
  ),'[]'::jsonb)
  INTO v_beneficiaries
  FROM public.split_regra_beneficiarios b
  JOIN public.profiles p ON p.id=b.profile_id
  WHERE b.split_regra_id=v_rule.id
    AND b.tipo='autorizado'
    AND b.ativo;

  RETURN jsonb_build_object(
    'rule',jsonb_build_object(
      'id',v_rule.id,
      'name',v_rule.nome,
      'version',v_rule.versao,
      'base',v_rule.base_calculo,
      'effective_at',v_rule.vigencia_inicio
    ),
    'beneficiaries',v_beneficiaries
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_split_regra_atual() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_split_regra_atual() TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_split_aplicar_regra_venda(p_transacao_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_t public.transacoes%ROWTYPE;
  v_rule public.split_regras%ROWTYPE;
  v_producer_row public.split_distribuicoes%ROWTYPE;
  v_b record;
  v_pool numeric(15,2);
  v_remaining numeric(15,2);
  v_amount numeric(15,2);
  v_total numeric(15,2):=0;
  v_bucket text;
  v_ref text;
BEGIN
  SELECT * INTO v_t
  FROM public.transacoes
  WHERE id=p_transacao_id
  FOR UPDATE;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- Se já foi aplicado, apenas devolve o total idempotente.
  IF EXISTS(
    SELECT 1 FROM public.split_distribuicoes
    WHERE transacao_id=v_t.id AND beneficiario_tipo='autorizado'
  ) THEN
    SELECT coalesce(sum(valor_distribuido),0)
    INTO v_total
    FROM public.split_distribuicoes
    WHERE transacao_id=v_t.id AND beneficiario_tipo='autorizado';
    RETURN round(v_total,2);
  END IF;

  SELECT * INTO v_producer_row
  FROM public.split_distribuicoes
  WHERE transacao_id=v_t.id
    AND beneficiario_tipo='produtor'
  FOR UPDATE;
  IF NOT FOUND OR v_producer_row.valor_distribuido<=0 THEN RETURN 0; END IF;

  SELECT * INTO v_rule
  FROM public.split_regras
  WHERE empresa_id=v_t.empresa_id
    AND status='ativa'
    AND vigencia_inicio<=coalesce(v_t.data_pagamento,v_t.created_at)
    AND (
      vigencia_fim IS NULL
      OR vigencia_fim>coalesce(v_t.data_pagamento,v_t.created_at)
    )
  ORDER BY vigencia_inicio DESC,versao DESC
  LIMIT 1;
  IF NOT FOUND THEN RETURN 0; END IF;

  IF (
    SELECT coalesce(sum(percentual),0)
    FROM public.split_regra_beneficiarios
    WHERE split_regra_id=v_rule.id AND tipo='autorizado' AND ativo
  ) > 100 THEN
    RAISE EXCEPTION 'split_rule_invalid_percentage_sum';
  END IF;

  v_pool:=round(v_producer_row.valor_distribuido,2);
  v_remaining:=v_pool;
  v_bucket:=CASE
    WHEN v_t.status='disponivel'
      OR (v_t.data_disponivel IS NOT NULL AND v_t.data_disponivel<=now())
    THEN 'disponivel'
    ELSE 'a_receber'
  END;
  v_ref:=coalesce(v_t.pedido_numero,v_t.id::text);

  FOR v_b IN
    SELECT b.*,p.nome_completo
    FROM public.split_regra_beneficiarios b
    JOIN public.profiles p ON p.id=b.profile_id
    WHERE b.split_regra_id=v_rule.id
      AND b.tipo='autorizado'
      AND b.ativo
    ORDER BY b.prioridade,b.id
  LOOP
    v_amount:=least(
      v_remaining,
      greatest(round(v_pool*v_b.percentual/100.0,2),0)
    );
    IF v_amount<=0 THEN CONTINUE; END IF;

    INSERT INTO public.split_distribuicoes(
      empresa_id,transacao_id,pedido_id,regra_id,regra_versao,
      beneficiario_tipo,profile_id,base_calculo,percentual_snapshot,
      valor_fixo_snapshot,valor_distribuido,regra_snapshot
    ) VALUES (
      v_t.empresa_id,v_t.id,v_t.pedido_id,v_rule.id,v_rule.versao,
      'autorizado',v_b.profile_id,v_pool,v_b.percentual,0,v_amount,
      jsonb_build_object(
        'rule_name',v_rule.nome,
        'base','producer_pool_after_fee_and_commission',
        'rounding','numeric_round_2'
      )
    );

    -- Débito da empresa e crédito individual do beneficiário.
    PERFORM public.fn_ledger_registrar(
      'sale:'||v_t.id||':authorized_expense:'||v_b.profile_id,
      v_t.empresa_id,NULL,NULL,v_t.id,NULL,NULL,NULL,NULL,
      'SPLIT_AUTORIZADO','Participação de parceiro autorizado','D',v_amount,
      v_bucket,'efetivo',v_ref,'split_autorizado',v_rule.id,NULL,
      jsonb_build_object(
        'profile_id',v_b.profile_id,
        'beneficiary_name',v_b.nome_completo,
        'rule_version',v_rule.versao
      )
    );

    PERFORM public.fn_ledger_registrar(
      'sale:'||v_t.id||':authorized_credit:'||v_b.profile_id,
      v_t.empresa_id,v_b.profile_id,NULL,v_t.id,NULL,NULL,NULL,NULL,
      'SPLIT_RECEBIDO','Participação de venda recebida','C',v_amount,
      v_bucket,'efetivo',v_ref,'split_autorizado',v_rule.id,NULL,
      jsonb_build_object(
        'rule_version',v_rule.versao,
        'percentual',v_b.percentual
      )
    );

    v_total:=round(v_total+v_amount,2);
    v_remaining:=round(v_remaining-v_amount,2);
  END LOOP;

  UPDATE public.split_distribuicoes
  SET valor_distribuido=greatest(round(v_pool-v_total,2),0),
      regra_id=v_rule.id,
      regra_versao=v_rule.versao,
      regra_snapshot=coalesce(regra_snapshot,'{}'::jsonb)
        || jsonb_build_object(
          'authorized_total',v_total,
          'rule_id',v_rule.id,
          'rule_version',v_rule.versao,
          'producer_residual',greatest(round(v_pool-v_total,2),0)
        )
  WHERE id=v_producer_row.id;

  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_split_aplicar_regra_venda(uuid)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_split_aplicar_regra_venda(uuid)
TO service_role;

CREATE OR REPLACE FUNCTION public.fn_split_simular(
  p_valor numeric,
  p_produto_id uuid,
  p_afiliado_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_product public.produtos%ROWTYPE;
  v_affiliate public.afiliados%ROWTYPE;
  v_ap public.afiliados_produtos%ROWTYPE;
  v_fee_rule public.taxas_plataforma%ROWTYPE;
  v_fee numeric(15,2):=0;
  v_commission numeric(15,2):=0;
  v_commission_rate numeric(9,4):=0;
  v_commission_fixed numeric(15,2);
  v_pool numeric(15,2);
  v_remaining numeric(15,2);
  v_rule public.split_regras%ROWTYPE;
  v_b record;
  v_amount numeric(15,2);
  v_components jsonb:='[]'::jsonb;
  v_authorized_total numeric(15,2):=0;
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_valor IS NULL OR p_valor<=0 THEN RAISE EXCEPTION 'split_value_invalid'; END IF;

  SELECT * INTO v_product
  FROM public.produtos
  WHERE id=p_produto_id
    AND empresa_id=v_empresa
    AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'product_not_found'; END IF;

  SELECT * INTO v_fee_rule
  FROM public.fn_taxa_regra_aplicavel(
    v_empresa,'venda','pix'::public.metodo_pagamento,now()
  )
  LIMIT 1;

  IF FOUND THEN
    v_fee:=public.fn_taxa_calcular(
      p_valor,v_fee_rule.taxa_percentual,v_fee_rule.taxa_fixa,
      v_fee_rule.taxa_minima,v_fee_rule.taxa_maxima
    );
  END IF;
  v_fee:=least(v_fee,p_valor);

  IF p_afiliado_id IS NOT NULL THEN
    SELECT * INTO v_affiliate
    FROM public.afiliados
    WHERE id=p_afiliado_id
      AND empresa_id=v_empresa
      AND status='ativo'
      AND deleted_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'affiliate_not_found'; END IF;

    SELECT * INTO v_ap
    FROM public.afiliados_produtos
    WHERE afiliado_id=v_affiliate.id
      AND produto_id=v_product.id
      AND empresa_id=v_empresa
      AND ativo
      AND (data_inicio IS NULL OR data_inicio<=now())
      AND (data_fim IS NULL OR data_fim>now());
    IF NOT FOUND THEN RAISE EXCEPTION 'affiliate_not_authorized_for_product'; END IF;

    v_commission_rate:=coalesce(
      v_ap.taxa_comissao_personalizada,
      v_product.taxa_comissao_afiliado,
      v_affiliate.taxa_comissao_padrao,
      0
    );
    v_commission_fixed:=coalesce(
      v_ap.comissao_valor_fixo,
      v_product.comissao_valor_fixo
    );

    IF v_commission_fixed IS NOT NULL THEN
      v_commission:=least(greatest(round(v_commission_fixed,2),0),greatest(p_valor-v_fee,0));
    ELSE
      v_commission:=least(
        greatest(round(p_valor*v_commission_rate/100.0,2),0),
        greatest(p_valor-v_fee,0)
      );
    END IF;
  END IF;

  v_pool:=greatest(round(p_valor-v_fee-v_commission,2),0);
  v_remaining:=v_pool;

  SELECT * INTO v_rule
  FROM public.split_regras
  WHERE empresa_id=v_empresa
    AND status='ativa'
    AND vigencia_inicio<=now()
    AND (vigencia_fim IS NULL OR vigencia_fim>now())
  ORDER BY vigencia_inicio DESC,versao DESC
  LIMIT 1;

  IF FOUND THEN
    FOR v_b IN
      SELECT b.*,p.nome_completo
      FROM public.split_regra_beneficiarios b
      JOIN public.profiles p ON p.id=b.profile_id
      WHERE b.split_regra_id=v_rule.id
        AND b.tipo='autorizado'
        AND b.ativo
      ORDER BY b.prioridade,b.id
    LOOP
      v_amount:=least(
        v_remaining,
        greatest(round(v_pool*v_b.percentual/100.0,2),0)
      );
      IF v_amount<=0 THEN CONTINUE; END IF;
      v_components:=v_components||jsonb_build_array(jsonb_build_object(
        'type','autorizado',
        'label',v_b.nome_completo,
        'profile_id',v_b.profile_id,
        'amount',v_amount,
        'percent_of_gross',round(v_amount*100.0/p_valor,4),
        'rule_percent',v_b.percentual
      ));
      v_authorized_total:=round(v_authorized_total+v_amount,2);
      v_remaining:=round(v_remaining-v_amount,2);
    END LOOP;
  END IF;

  v_components:=jsonb_build_array(jsonb_build_object(
    'type','produtor',
    'label','Produtor',
    'amount',v_remaining,
    'percent_of_gross',round(v_remaining*100.0/p_valor,4)
  ))
  || CASE WHEN v_commission>0 THEN jsonb_build_array(jsonb_build_object(
    'type','afiliado',
    'label','Afiliado',
    'amount',v_commission,
    'percent_of_gross',round(v_commission*100.0/p_valor,4),
    'commission_rate',v_commission_rate,
    'commission_fixed',v_commission_fixed
  )) ELSE '[]'::jsonb END
  || CASE WHEN v_fee>0 THEN jsonb_build_array(jsonb_build_object(
    'type','plataforma',
    'label','Cash Engine PRO',
    'amount',v_fee,
    'percent_of_gross',round(v_fee*100.0/p_valor,4),
    'fee_rule_id',v_fee_rule.id,
    'fee_rule_version',v_fee_rule.versao
  )) ELSE '[]'::jsonb END
  || v_components;

  RETURN jsonb_build_object(
    'gross',round(p_valor,2),
    'platform_fee',v_fee,
    'affiliate_commission',v_commission,
    'authorized_total',v_authorized_total,
    'producer_residual',v_remaining,
    'distributed_total',round(v_remaining+v_commission+v_fee+v_authorized_total,2),
    'difference',round(
      p_valor-(v_remaining+v_commission+v_fee+v_authorized_total),2
    ),
    'method','pix',
    'provider_cost_included',false,
    'bank_transfer_performed',false,
    'split_rule',CASE WHEN v_rule.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id',v_rule.id,'name',v_rule.nome,'version',v_rule.versao
    ) END,
    'components',v_components
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_split_simular(numeric,uuid,uuid)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_split_simular(numeric,uuid,uuid)
TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_split_registros(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  transacao_id uuid,
  pedido_id uuid,
  pedido_numero text,
  valor_bruto numeric,
  status_pagamento text,
  data_referencia timestamptz,
  distribuicoes jsonb,
  total_distribuido numeric,
  total_revertido numeric,
  total_registros bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
  WITH base AS (
    SELECT
      t.id AS transacao_id,
      t.pedido_id,
      t.pedido_numero,
      t.valor_bruto,
      coalesce(p.status_pagamento,'confirmado') AS status_pagamento,
      coalesce(t.data_pagamento,t.created_at) AS data_referencia
    FROM public.transacoes t
    LEFT JOIN public.pedidos p ON p.id=t.pedido_id
    WHERE t.empresa_id=public.current_empresa_id()
      AND EXISTS(
        SELECT 1 FROM public.split_distribuicoes sd
        WHERE sd.transacao_id=t.id
      )
  )
  SELECT
    b.transacao_id,
    b.pedido_id,
    b.pedido_numero::text,
    b.valor_bruto,
    b.status_pagamento::text,
    b.data_referencia,
    (
      SELECT jsonb_agg(jsonb_build_object(
        'id',sd.id,
        'type',sd.beneficiario_tipo,
        'profile_id',sd.profile_id,
        'affiliate_id',sd.afiliado_id,
        'amount',sd.valor_distribuido,
        'reversed',sd.valor_revertido,
        'net',sd.valor_distribuido-sd.valor_revertido,
        'rule_id',sd.regra_id,
        'rule_version',sd.regra_versao,
        'snapshot',sd.regra_snapshot
      ) ORDER BY
        CASE sd.beneficiario_tipo
          WHEN 'produtor' THEN 1
          WHEN 'afiliado' THEN 2
          WHEN 'autorizado' THEN 3
          WHEN 'plataforma' THEN 4
          ELSE 5
        END,
        sd.id
      )
      FROM public.split_distribuicoes sd
      WHERE sd.transacao_id=b.transacao_id
    ),
    (
      SELECT coalesce(sum(sd.valor_distribuido),0)
      FROM public.split_distribuicoes sd
      WHERE sd.transacao_id=b.transacao_id
    ),
    (
      SELECT coalesce(sum(sd.valor_revertido),0)
      FROM public.split_distribuicoes sd
      WHERE sd.transacao_id=b.transacao_id
    ),
    count(*) OVER()
  FROM base b
  ORDER BY b.data_referencia DESC,b.transacao_id DESC
  LIMIT greatest(1,least(coalesce(p_limit,50),200))
  OFFSET greatest(coalesce(p_offset,0),0);
$$;

REVOKE ALL ON FUNCTION public.fn_split_registros(integer,integer)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_split_registros(integer,integer)
TO authenticated;

-- Override do snapshot financeiro para aplicar parceiros autorizados antes de
-- persistir o valor final do produtor.
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
  v_authorized numeric(15,2):=0;
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
        'reembolsar_em_estorno',v_rule.reembolsar_em_estorno,
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

  -- Aplica a versão ativa da regra de parceiros autorizados sobre o residual do produtor.
  v_authorized:=public.fn_split_aplicar_regra_venda(v_t.id);
  v_producer:=greatest(round(v_producer-v_authorized,2),0);

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
