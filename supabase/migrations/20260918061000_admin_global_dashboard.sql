-- Cash Engine PRO — dashboard global real, exclusivo do admin da plataforma.

CREATE OR REPLACE FUNCTION public.fn_admin_dashboard_global(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_days integer:=greatest(1,least(coalesce(p_days,30),366));
  v_since timestamptz:=now()-(greatest(1,least(coalesce(p_days,30),366))||' days')::interval;
  v_recent_companies jsonb;
  v_recent_audit jsonb;
BEGIN
  IF NOT public.fn_is_admin_global() THEN
    RAISE EXCEPTION 'platform_admin_required';
  END IF;

  SELECT coalesce(jsonb_agg(x ORDER BY x.created_at DESC),'[]'::jsonb)
  INTO v_recent_companies
  FROM (
    SELECT
      e.id,
      e.nome_fantasia,
      e.razao_social,
      e.plano,
      e.status::text AS status,
      e.created_at,
      (
        SELECT p.nome_completo
        FROM public.profiles p
        WHERE p.empresa_id=e.id
          AND p.is_owner
          AND p.deleted_at IS NULL
        ORDER BY p.created_at
        LIMIT 1
      ) AS owner_name,
      coalesce((
        SELECT sum(pd.valor_total)
        FROM public.pedidos pd
        WHERE pd.empresa_id=e.id
          AND pd.status_pagamento IN ('confirmado','reembolsado_parcial','reembolsado_total')
      ),0) AS confirmed_volume
    FROM public.empresas e
    WHERE e.deleted_at IS NULL
    ORDER BY e.created_at DESC
    LIMIT 8
  ) x;

  SELECT coalesce(jsonb_agg(x ORDER BY x.created_at DESC),'[]'::jsonb)
  INTO v_recent_audit
  FROM (
    SELECT
      a.id,
      a.acao::text AS action,
      coalesce(a.descricao,a.entidade,'Evento administrativo')::text AS description,
      coalesce(a.modulo,'sistema')::text AS module,
      a.risco_nivel::text AS risk,
      a.created_at,
      coalesce(p.nome_completo,'Sistema')::text AS actor
    FROM public.seguranca_audit_log a
    LEFT JOIN public.profiles p ON p.id=a.profile_id
    ORDER BY a.created_at DESC
    LIMIT 10
  ) x;

  RETURN jsonb_build_object(
    'period_days',v_days,
    'companies_total',(
      SELECT count(*) FROM public.empresas e WHERE e.deleted_at IS NULL
    ),
    'companies_active',(
      SELECT count(*) FROM public.empresas e
      WHERE e.deleted_at IS NULL AND e.status='ativo'
    ),
    'companies_created_period',(
      SELECT count(*) FROM public.empresas e
      WHERE e.deleted_at IS NULL AND e.created_at>=v_since
    ),
    'users_total',(
      SELECT count(*) FROM public.profiles p WHERE p.deleted_at IS NULL
    ),
    'users_active',(
      SELECT count(*) FROM public.profiles p
      WHERE p.deleted_at IS NULL AND p.status='ativo'
    ),
    'orders_confirmed_period',(
      SELECT count(*) FROM public.pedidos pd
      WHERE pd.confirmado_em>=v_since
        AND pd.status_pagamento IN ('confirmado','reembolsado_parcial','reembolsado_total')
    ),
    'gross_volume_period',coalesce((
      SELECT sum(pd.valor_total)
      FROM public.pedidos pd
      WHERE pd.confirmado_em>=v_since
        AND pd.status_pagamento IN ('confirmado','reembolsado_parcial','reembolsado_total')
    ),0),
    'refunds_period',coalesce((
      SELECT sum(pd.valor_devolvido)
      FROM public.pedidos pd
      WHERE pd.confirmado_em>=v_since
        AND pd.status_pagamento IN ('confirmado','reembolsado_parcial','reembolsado_total')
    ),0),
    'withdrawals_pending',(
      SELECT count(*) FROM public.saques s
      WHERE s.status IN ('solicitado','em_analise','aprovado','processando','enviado')
    ),
    'withdrawals_pending_value',coalesce((
      SELECT sum(s.valor_solicitado) FROM public.saques s
      WHERE s.status IN ('solicitado','em_analise','aprovado','processando','enviado')
    ),0),
    'tickets_open',(
      SELECT count(*) FROM public.tickets t
      WHERE t.deleted_at IS NULL
        AND t.status NOT IN ('resolvido','fechado','cancelado')
    ),
    'commissions_recognized_period',coalesce((
      SELECT sum(greatest(c.valor_comissao_liquida-coalesce(c.valor_estornado,0),0))
      FROM public.comissoes c
      JOIN public.transacoes t ON t.id=c.transacao_id
      WHERE c.deleted_at IS NULL
        AND coalesce(t.data_pagamento,c.created_at)>=v_since
        AND c.status NOT IN ('cancelada','estornada')
    ),0),
    'recent_companies',v_recent_companies,
    'recent_audit',v_recent_audit
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_dashboard_global(integer)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_dashboard_global(integer)
TO authenticated;
