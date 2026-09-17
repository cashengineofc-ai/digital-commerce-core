-- Cash Engine PRO — saldo e extrato derivados do razão.
-- Não reconstrói vendas históricas nem inventa lançamentos: apenas materializa o que existe no ledger.

ALTER TABLE public.saldos
  ADD COLUMN IF NOT EXISTS saldo_a_receber numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saldo_reservado numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saldo_liquidado numeric(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saldo_bloqueado_operacional numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS origem_calculo text NOT NULL DEFAULT 'legacy';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='saldos_nao_negativos_novos_chk'
  ) THEN
    ALTER TABLE public.saldos
      ADD CONSTRAINT saldos_nao_negativos_novos_chk
      CHECK (
        saldo_a_receber >= 0
        AND saldo_reservado >= 0
        AND saldo_liquidado >= 0
        AND saldo_bloqueado_operacional >= 0
      );
  END IF;
END $$;

-- Uma comissão real por transação/afiliado. Evita webhook/reprocessamento duplicar crédito.
CREATE UNIQUE INDEX IF NOT EXISTS idx_comissoes_transacao_afiliado_unica
ON public.comissoes(transacao_id,afiliado_id)
WHERE transacao_id IS NOT NULL AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.fn_ledger_saldo_bucket(
  p_empresa_id uuid,
  p_profile_id uuid,
  p_afiliado_id uuid,
  p_bucket text
)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path=public
AS $$
  SELECT coalesce(sum(
    CASE WHEN l.tipo_lancamento='C' THEN l.valor ELSE -l.valor END
  ),0)::numeric
  FROM public.lancamentos_contabeis l
  WHERE l.bucket=p_bucket
    AND (
      (
        p_afiliado_id IS NOT NULL
        AND l.afiliado_id=p_afiliado_id
      )
      OR (
        p_afiliado_id IS NULL
        AND p_profile_id IS NOT NULL
        AND l.profile_id=p_profile_id
        AND l.afiliado_id IS NULL
      )
      OR (
        p_afiliado_id IS NULL
        AND p_profile_id IS NULL
        AND p_empresa_id IS NOT NULL
        AND l.empresa_id=p_empresa_id
        AND l.profile_id IS NULL
        AND l.afiliado_id IS NULL
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.fn_saldo_recalcular_entidade(
  p_empresa_id uuid DEFAULT NULL,
  p_profile_id uuid DEFAULT NULL,
  p_afiliado_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_id uuid;
  v_a_receber numeric(15,2);
  v_disponivel numeric(15,2);
  v_reservado numeric(15,2);
  v_bloqueado numeric(15,2);
  v_liquidado numeric(18,2);
  v_estornado numeric(15,2);
  v_bruto numeric(15,2);
BEGIN
  IF (p_empresa_id IS NOT NULL)::int
     + (p_profile_id IS NOT NULL)::int
     + (p_afiliado_id IS NOT NULL)::int <> 1 THEN
    RAISE EXCEPTION 'balance_entity_must_be_exactly_one';
  END IF;

  v_a_receber:=round(public.fn_ledger_saldo_bucket(p_empresa_id,p_profile_id,p_afiliado_id,'a_receber'),2);
  v_disponivel:=round(public.fn_ledger_saldo_bucket(p_empresa_id,p_profile_id,p_afiliado_id,'disponivel'),2);
  v_reservado:=round(public.fn_ledger_saldo_bucket(p_empresa_id,p_profile_id,p_afiliado_id,'reservado'),2);
  v_bloqueado:=round(public.fn_ledger_saldo_bucket(p_empresa_id,p_profile_id,p_afiliado_id,'bloqueado'),2);
  v_liquidado:=round(public.fn_ledger_saldo_bucket(p_empresa_id,p_profile_id,p_afiliado_id,'liquidado'),2);
  v_estornado:=abs(round(public.fn_ledger_saldo_bucket(p_empresa_id,p_profile_id,p_afiliado_id,'estornado'),2));

  -- Valores negativos em buckets ativos representam inconsistência e nunca viram saldo utilizável.
  v_a_receber:=greatest(v_a_receber,0);
  v_disponivel:=greatest(v_disponivel,0);
  v_reservado:=greatest(v_reservado,0);
  v_bloqueado:=greatest(v_bloqueado,0);
  v_liquidado:=greatest(v_liquidado,0);
  v_bruto:=round(v_a_receber+v_disponivel+v_reservado+v_bloqueado,2);

  INSERT INTO public.saldos(
    empresa_id,profile_id,afiliado_id,
    saldo_bruto,saldo_disponivel,saldo_bloqueado,saldo_estornado,
    saldo_previsao_liberar,saldo_a_receber,saldo_reservado,
    saldo_liquidado,saldo_bloqueado_operacional,origem_calculo,
    ultimo_movimento,atualizado_em
  ) VALUES (
    p_empresa_id,p_profile_id,p_afiliado_id,
    v_bruto,v_disponivel,v_reservado+v_bloqueado,v_estornado,
    v_a_receber,v_a_receber,v_reservado,
    v_liquidado,v_bloqueado,'ledger',
    now(),now()
  )
  ON CONFLICT (empresa_id,profile_id,afiliado_id)
  DO UPDATE SET
    saldo_bruto=excluded.saldo_bruto,
    saldo_disponivel=excluded.saldo_disponivel,
    saldo_bloqueado=excluded.saldo_bloqueado,
    saldo_estornado=excluded.saldo_estornado,
    saldo_previsao_liberar=excluded.saldo_previsao_liberar,
    saldo_a_receber=excluded.saldo_a_receber,
    saldo_reservado=excluded.saldo_reservado,
    saldo_liquidado=excluded.saldo_liquidado,
    saldo_bloqueado_operacional=excluded.saldo_bloqueado_operacional,
    origem_calculo='ledger',
    ultimo_movimento=now(),
    atualizado_em=now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_saldo_recalcular_entidade(uuid,uuid,uuid)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_saldo_recalcular_entidade(uuid,uuid,uuid)
TO service_role;

CREATE OR REPLACE FUNCTION public.fn_trigger_recalcular_saldo_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  IF NEW.afiliado_id IS NOT NULL THEN
    PERFORM public.fn_saldo_recalcular_entidade(NULL,NULL,NEW.afiliado_id);
  ELSIF NEW.profile_id IS NOT NULL THEN
    PERFORM public.fn_saldo_recalcular_entidade(NULL,NEW.profile_id,NULL);
  ELSIF NEW.empresa_id IS NOT NULL THEN
    PERFORM public.fn_saldo_recalcular_entidade(NEW.empresa_id,NULL,NULL);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalcular_saldo_ledger ON public.lancamentos_contabeis;
CREATE TRIGGER trg_recalcular_saldo_ledger
AFTER INSERT ON public.lancamentos_contabeis
FOR EACH ROW EXECUTE FUNCTION public.fn_trigger_recalcular_saldo_ledger();

-- Browser não edita saldos diretamente. Apenas funções internas materializam o ledger.
CREATE OR REPLACE FUNCTION public.fn_guard_saldos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path=public
AS $$
BEGIN
  IF current_user='authenticated' AND auth.role()='authenticated' THEN
    RAISE EXCEPTION 'balances_are_derived_from_ledger';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_saldos ON public.saldos;
CREATE TRIGGER trg_guard_saldos
BEFORE INSERT OR UPDATE OR DELETE ON public.saldos
FOR EACH ROW EXECUTE FUNCTION public.fn_guard_saldos();

-- RLS: empresa vê saldo da empresa; afiliado vê somente o próprio.
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='saldos'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.saldos',p.policyname);
  END LOOP;
END $$;

CREATE POLICY saldos_read
ON public.saldos
FOR SELECT TO authenticated
USING (
  public.fn_is_admin_global()
  OR (
    empresa_id IS NOT NULL
    AND profile_id IS NULL
    AND afiliado_id IS NULL
    AND empresa_id=public.current_empresa_id()
  )
  OR (
    afiliado_id IS NOT NULL
    AND afiliado_id IN (
      SELECT a.id FROM public.afiliados a
      WHERE a.profile_id=auth.uid() AND a.deleted_at IS NULL
    )
  )
  OR profile_id=auth.uid()
);

-- Ledger: empresa não enxerga créditos próprios de outros afiliados como extrato individual.
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='lancamentos_contabeis'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.lancamentos_contabeis',p.policyname);
  END LOOP;
END $$;

CREATE POLICY ledger_read
ON public.lancamentos_contabeis
FOR SELECT TO authenticated
USING (
  public.fn_is_admin_global()
  OR (
    empresa_id=public.current_empresa_id()
    AND profile_id IS NULL
    AND afiliado_id IS NULL
  )
  OR profile_id=auth.uid()
  OR afiliado_id IN (
    SELECT a.id FROM public.afiliados a
    WHERE a.profile_id=auth.uid() AND a.deleted_at IS NULL
  )
);

-- =========================================================
-- LIBERAÇÃO: a receber -> disponível, sem editar lançamento antigo
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_financeiro_liberar_transacao(p_transacao_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_t public.transacoes%ROWTYPE;
  v_company_net numeric(15,2);
  v_affiliate numeric(15,2);
  v_ref text;
BEGIN
  SELECT * INTO v_t
  FROM public.transacoes
  WHERE id=p_transacao_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN false; END IF;
  IF v_t.status NOT IN ('aprovada','capturada','paga','disponivel') THEN RETURN false; END IF;
  IF v_t.saldo_processado_em IS NULL THEN
    PERFORM public.fn_financeiro_snapshot_venda(v_t.id);
    SELECT * INTO v_t FROM public.transacoes WHERE id=v_t.id FOR UPDATE;
  END IF;
  IF v_t.saldo_liberado_em IS NOT NULL THEN RETURN false; END IF;
  IF v_t.status<>'disponivel'
     AND (v_t.data_disponivel IS NULL OR v_t.data_disponivel>now()) THEN
    RETURN false;
  END IF;

  v_company_net:=greatest(coalesce(v_t.valor_saldo_empresa,0),0);
  v_affiliate:=greatest(coalesce(v_t.valor_comissao_afiliado,0),0);
  v_ref:=coalesce(v_t.pedido_numero,v_t.id::text);

  IF v_company_net>0 THEN
    PERFORM public.fn_ledger_registrar(
      'sale:'||v_t.id||':release:company:debit',
      v_t.empresa_id,NULL,NULL,v_t.id,NULL,NULL,NULL,NULL,
      'LIBERACAO_SALDO','Liberação de saldo a receber','D',v_company_net,
      'a_receber','efetivo',v_ref,'liberacao',v_t.id,NULL,'{}'::jsonb
    );
    PERFORM public.fn_ledger_registrar(
      'sale:'||v_t.id||':release:company:credit',
      v_t.empresa_id,NULL,NULL,v_t.id,NULL,NULL,NULL,NULL,
      'LIBERACAO_SALDO','Saldo liberado para saque','C',v_company_net,
      'disponivel','efetivo',v_ref,'liberacao',v_t.id,NULL,'{}'::jsonb
    );
  END IF;

  IF v_affiliate>0 AND v_t.afiliado_id IS NOT NULL THEN
    PERFORM public.fn_ledger_registrar(
      'sale:'||v_t.id||':release:affiliate:debit:'||v_t.afiliado_id,
      v_t.empresa_id,NULL,v_t.afiliado_id,v_t.id,NULL,NULL,NULL,NULL,
      'LIBERACAO_COMISSAO','Liberação de comissão a receber','D',v_affiliate,
      'a_receber','efetivo',v_ref,'liberacao',v_t.id,NULL,'{}'::jsonb
    );
    PERFORM public.fn_ledger_registrar(
      'sale:'||v_t.id||':release:affiliate:credit:'||v_t.afiliado_id,
      v_t.empresa_id,NULL,v_t.afiliado_id,v_t.id,NULL,NULL,NULL,NULL,
      'LIBERACAO_COMISSAO','Comissão liberada','C',v_affiliate,
      'disponivel','efetivo',v_ref,'liberacao',v_t.id,NULL,'{}'::jsonb
    );

    UPDATE public.comissoes
    SET status='liberada',updated_at=now()
    WHERE transacao_id=v_t.id
      AND afiliado_id=v_t.afiliado_id
      AND status='aprovada'
      AND deleted_at IS NULL;
  END IF;

  UPDATE public.transacoes
  SET saldo_liberado_em=now(),updated_at=now()
  WHERE id=v_t.id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_financeiro_liberar_transacao(uuid)
FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_financeiro_liberar_transacao(uuid)
TO service_role;

CREATE OR REPLACE FUNCTION public.fn_sincronizar_saldo_empresa()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_row record;
  v_total integer:=0;
BEGIN
  IF auth.uid() IS NULL OR v_empresa IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  FOR v_row IN
    SELECT id
    FROM public.transacoes
    WHERE empresa_id=v_empresa
      AND status IN ('aprovada','capturada','paga','disponivel')
      AND saldo_processado_em IS NULL
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
  LOOP
    IF public.fn_financeiro_snapshot_venda(v_row.id) THEN
      v_total:=v_total+1;
    END IF;
  END LOOP;

  FOR v_row IN
    SELECT id
    FROM public.transacoes
    WHERE empresa_id=v_empresa
      AND status IN ('aprovada','capturada','paga','disponivel')
      AND saldo_processado_em IS NOT NULL
      AND saldo_liberado_em IS NULL
      AND (
        status='disponivel'
        OR (data_disponivel IS NOT NULL AND data_disponivel<=now())
      )
    ORDER BY coalesce(data_disponivel,created_at)
    FOR UPDATE SKIP LOCKED
  LOOP
    IF public.fn_financeiro_liberar_transacao(v_row.id) THEN
      v_total:=v_total+1;
    END IF;
  END LOOP;

  PERFORM public.fn_saldo_recalcular_entidade(v_empresa,NULL,NULL);
  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_sincronizar_saldo_empresa()
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_sincronizar_saldo_empresa()
TO authenticated;

-- Trigger: confirma -> snapshot; data disponível -> libera.
CREATE OR REPLACE FUNCTION public.fn_trigger_processar_financeiro_transacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  IF NEW.status IN ('aprovada','capturada','paga','disponivel') THEN
    PERFORM public.fn_processar_financeiro_transacao(NEW.id);
    IF NEW.status='disponivel'
       OR (NEW.data_disponivel IS NOT NULL AND NEW.data_disponivel<=now()) THEN
      PERFORM public.fn_financeiro_liberar_transacao(NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_processar_financeiro_transacao ON public.transacoes;
CREATE TRIGGER trg_processar_financeiro_transacao
AFTER INSERT OR UPDATE OF status,data_disponivel
ON public.transacoes
FOR EACH ROW EXECUTE FUNCTION public.fn_trigger_processar_financeiro_transacao();

-- =========================================================
-- CONSULTA CANÔNICA DE SALDO
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_financeiro_saldo(
  p_entidade text DEFAULT 'empresa'
)
RETURNS TABLE(
  entidade text,
  a_receber numeric,
  disponivel numeric,
  reservado_saque numeric,
  bloqueado numeric,
  liquidado_historico numeric,
  estornado_historico numeric,
  atualizado_em timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_afiliado uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  IF p_entidade='empresa' THEN
    IF v_empresa IS NULL THEN RAISE EXCEPTION 'company_not_found'; END IF;
    RETURN QUERY
    SELECT
      'empresa'::text,
      coalesce(s.saldo_a_receber,0),
      coalesce(s.saldo_disponivel,0),
      coalesce(s.saldo_reservado,0),
      coalesce(s.saldo_bloqueado_operacional,0),
      coalesce(s.saldo_liquidado,0),
      coalesce(s.saldo_estornado,0),
      s.atualizado_em
    FROM public.saldos s
    WHERE s.empresa_id=v_empresa
      AND s.profile_id IS NULL
      AND s.afiliado_id IS NULL;
    RETURN;
  END IF;

  IF p_entidade='afiliado' THEN
    SELECT a.id INTO v_afiliado
    FROM public.afiliados a
    WHERE a.profile_id=auth.uid()
      AND a.status='ativo'
      AND a.deleted_at IS NULL
    ORDER BY a.created_at
    LIMIT 1;
    IF v_afiliado IS NULL THEN RAISE EXCEPTION 'affiliate_not_found'; END IF;

    RETURN QUERY
    SELECT
      'afiliado'::text,
      coalesce(s.saldo_a_receber,0),
      coalesce(s.saldo_disponivel,0),
      coalesce(s.saldo_reservado,0),
      coalesce(s.saldo_bloqueado_operacional,0),
      coalesce(s.saldo_liquidado,0),
      coalesce(s.saldo_estornado,0),
      s.atualizado_em
    FROM public.saldos s
    WHERE s.afiliado_id=v_afiliado;
    RETURN;
  END IF;

  RAISE EXCEPTION 'invalid_balance_entity';
END;
$$;

REVOKE ALL ON FUNCTION public.fn_financeiro_saldo(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_financeiro_saldo(text) TO authenticated;

-- =========================================================
-- EXTRATO CANÔNICO
-- =========================================================
CREATE OR REPLACE FUNCTION public.fn_extrato_financeiro(
  p_entidade text DEFAULT 'empresa',
  p_inicio timestamptz DEFAULT NULL,
  p_fim timestamptz DEFAULT NULL,
  p_conta text DEFAULT NULL,
  p_bucket text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  data_lancamento timestamptz,
  descricao text,
  conta text,
  bucket text,
  tipo char,
  valor numeric,
  valor_assinado numeric,
  documento text,
  transacao_id uuid,
  saque_id uuid,
  estorno_id uuid,
  saldo_abertura numeric,
  saldo_periodo numeric,
  total_registros bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_afiliado uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  IF p_entidade='afiliado' THEN
    SELECT a.id INTO v_afiliado
    FROM public.afiliados a
    WHERE a.profile_id=auth.uid() AND a.status='ativo' AND a.deleted_at IS NULL
    ORDER BY a.created_at LIMIT 1;
    IF v_afiliado IS NULL THEN RAISE EXCEPTION 'affiliate_not_found'; END IF;
  ELSIF p_entidade<>'empresa' THEN
    RAISE EXCEPTION 'invalid_statement_entity';
  END IF;

  RETURN QUERY
  WITH entity_rows AS (
    SELECT l.*,
      CASE WHEN l.tipo_lancamento='C' THEN l.valor ELSE -l.valor END AS signed_value
    FROM public.lancamentos_contabeis l
    WHERE (
      (p_entidade='empresa'
       AND l.empresa_id=v_empresa
       AND l.profile_id IS NULL
       AND l.afiliado_id IS NULL)
      OR
      (p_entidade='afiliado' AND l.afiliado_id=v_afiliado)
    )
  ),
  opening AS (
    SELECT coalesce(sum(signed_value),0) AS value
    FROM entity_rows
    WHERE p_inicio IS NOT NULL AND data_lancamento<p_inicio
      AND bucket IN ('a_receber','disponivel','reservado','bloqueado')
  ),
  filtered AS (
    SELECT *
    FROM entity_rows
    WHERE (p_inicio IS NULL OR data_lancamento>=p_inicio)
      AND (p_fim IS NULL OR data_lancamento<p_fim)
      AND (coalesce(trim(p_conta),'')='' OR conta_contabil=p_conta)
      AND (coalesce(trim(p_bucket),'')='' OR bucket=p_bucket)
  ),
  period_total AS (
    SELECT coalesce(sum(signed_value),0) AS value FROM filtered
  )
  SELECT
    f.id,f.data_lancamento,f.descricao::text,f.conta_contabil::text,
    f.bucket::text,f.tipo_lancamento,f.valor,f.signed_value,
    f.documento_referencia::text,f.transacao_id,f.saque_id,f.estorno_id,
    (SELECT value FROM opening),
    (SELECT value FROM period_total),
    count(*) OVER()
  FROM filtered f
  ORDER BY f.data_lancamento DESC,f.id DESC
  LIMIT greatest(1,least(coalesce(p_limit,50),200))
  OFFSET greatest(coalesce(p_offset,0),0);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_extrato_financeiro(
  text,timestamptz,timestamptz,text,text,integer,integer
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_extrato_financeiro(
  text,timestamptz,timestamptz,text,text,integer,integer
) TO authenticated;

COMMENT ON FUNCTION public.fn_extrato_financeiro(
  text,timestamptz,timestamptz,text,text,integer,integer
)
IS 'Extrato derivado do ledger. saldo_abertura=soma dos buckets ativos antes do início; saldo_periodo=soma assinada dos movimentos filtrados. Liquidados e estornados são históricos e não compõem o saldo utilizável.';
