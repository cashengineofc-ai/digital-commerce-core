-- Cash Engine PRO — consultas financeiras canônicas para UI/exportação.

CREATE OR REPLACE FUNCTION public.fn_extrato_financeiro_v2(
  p_entidade text DEFAULT 'empresa',
  p_inicio timestamptz DEFAULT NULL,
  p_fim timestamptz DEFAULT NULL,
  p_tipo text DEFAULT NULL,
  p_bucket text DEFAULT NULL,
  p_busca text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  data_lancamento timestamptz,
  descricao text,
  conta text,
  bucket text,
  tipo text,
  valor numeric,
  valor_assinado numeric,
  documento text,
  transacao_id uuid,
  saque_id uuid,
  estorno_id uuid,
  saldo_abertura numeric,
  movimento_periodo numeric,
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

  IF coalesce(trim(p_tipo),'')<>'' AND p_tipo NOT IN ('credito','debito') THEN
    RAISE EXCEPTION 'invalid_statement_type';
  END IF;

  RETURN QUERY
  WITH entity_rows AS (
    SELECT
      l.*,
      CASE
        WHEN l.bucket='devedor'
          THEN CASE WHEN l.tipo_lancamento='C' THEN -l.valor ELSE l.valor END
        ELSE CASE WHEN l.tipo_lancamento='C' THEN l.valor ELSE -l.valor END
      END AS signed_value
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
    WHERE p_inicio IS NOT NULL
      AND data_lancamento<p_inicio
      AND bucket IN ('a_receber','disponivel','reservado','bloqueado','devedor')
  ),
  filtered AS (
    SELECT *
    FROM entity_rows
    WHERE (p_inicio IS NULL OR data_lancamento>=p_inicio)
      AND (p_fim IS NULL OR data_lancamento<p_fim)
      AND (coalesce(trim(p_tipo),'')='' OR
        (p_tipo='credito' AND signed_value>=0)
        OR (p_tipo='debito' AND signed_value<0)
      )
      AND (coalesce(trim(p_bucket),'')='' OR bucket=p_bucket)
      AND (
        coalesce(trim(p_busca),'')=''
        OR descricao ILIKE '%'||trim(p_busca)||'%'
        OR coalesce(documento_referencia,'') ILIKE '%'||trim(p_busca)||'%'
        OR conta_contabil ILIKE '%'||trim(p_busca)||'%'
        OR id::text ILIKE '%'||trim(p_busca)||'%'
      )
  ),
  period_total AS (
    SELECT coalesce(sum(signed_value),0) AS value FROM filtered
  )
  SELECT
    f.id,f.data_lancamento,f.descricao::text,f.conta_contabil::text,
    f.bucket::text,
    CASE WHEN f.signed_value>=0 THEN 'credito' ELSE 'debito' END::text,
    f.valor,f.signed_value,f.documento_referencia::text,
    f.transacao_id,f.saque_id,f.estorno_id,
    (SELECT value FROM opening),
    (SELECT value FROM period_total),
    count(*) OVER()
  FROM filtered f
  ORDER BY f.data_lancamento DESC,f.id DESC
  LIMIT greatest(1,least(coalesce(p_limit,50),200))
  OFFSET greatest(coalesce(p_offset,0),0);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_extrato_financeiro_v2(
  text,timestamptz,timestamptz,text,text,text,integer,integer
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_extrato_financeiro_v2(
  text,timestamptz,timestamptz,text,text,text,integer,integer
) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_taxas_operacionais(
  p_inicio timestamptz DEFAULT NULL,
  p_fim timestamptz DEFAULT NULL
)
RETURNS TABLE(
  operacao text,
  metodo text,
  volume_base numeric,
  taxa_plataforma numeric,
  custo_provedor_registrado numeric,
  quantidade bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
  WITH platform_fees AS (
    SELECT
      tos.operacao,
      coalesce(t.metodo_pagamento::text,'pix') AS metodo,
      sum(tos.base_valor)::numeric AS volume_base,
      sum(tos.valor_calculado)::numeric AS taxa_plataforma,
      count(*)::bigint AS quantidade
    FROM public.taxa_operacao_snapshots tos
    LEFT JOIN public.transacoes t ON t.id=tos.transacao_id
    WHERE tos.empresa_id=public.current_empresa_id()
      AND (p_inicio IS NULL OR tos.created_at>=p_inicio)
      AND (p_fim IS NULL OR tos.created_at<p_fim)
    GROUP BY tos.operacao,coalesce(t.metodo_pagamento::text,'pix')
  ),
  provider_costs AS (
    SELECT
      'venda'::text AS operacao,
      t.metodo_pagamento::text AS metodo,
      sum(coalesce(t.valor_bruto,0))::numeric AS volume_base,
      sum(coalesce(t.valor_taxa_processamento,0))::numeric AS provider_cost,
      count(*)::bigint AS quantidade
    FROM public.transacoes t
    WHERE t.empresa_id=public.current_empresa_id()
      AND t.status IN (
        'aprovada','capturada','paga','disponivel',
        'estornada_parcial','reembolsada'
      )
      AND (p_inicio IS NULL OR coalesce(t.data_pagamento,t.created_at)>=p_inicio)
      AND (p_fim IS NULL OR coalesce(t.data_pagamento,t.created_at)<p_fim)
      AND coalesce(t.valor_taxa_processamento,0)>0
    GROUP BY t.metodo_pagamento
  ),
  combined AS (
    SELECT
      coalesce(f.operacao,p.operacao) AS operacao,
      coalesce(f.metodo,p.metodo) AS metodo,
      coalesce(f.volume_base,p.volume_base,0) AS volume_base,
      coalesce(f.taxa_plataforma,0) AS taxa_plataforma,
      coalesce(p.provider_cost,0) AS provider_cost,
      greatest(coalesce(f.quantidade,0),coalesce(p.quantidade,0)) AS quantidade
    FROM platform_fees f
    FULL OUTER JOIN provider_costs p
      ON p.operacao=f.operacao AND p.metodo=f.metodo
  )
  SELECT
    operacao,
    metodo,
    round(volume_base,2),
    round(taxa_plataforma,2),
    round(provider_cost,2),
    quantidade
  FROM combined
  ORDER BY operacao,metodo;
$$;

REVOKE ALL ON FUNCTION public.fn_taxas_operacionais(timestamptz,timestamptz)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_taxas_operacionais(timestamptz,timestamptz)
TO authenticated;
