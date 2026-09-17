-- Cash Engine PRO — consultas operacionais globais para o admin da plataforma.
-- Somente leitura/processamento; nenhuma transferência externa é executada aqui.

CREATE OR REPLACE FUNCTION public.fn_admin_saques_operacionais(
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  protocolo text,
  empresa_id uuid,
  empresa_nome text,
  solicitante text,
  valor_solicitado numeric,
  taxa_saque numeric,
  valor_liquido numeric,
  status text,
  modo_processamento text,
  destino jsonb,
  data_solicitacao timestamptz,
  data_pagamento timestamptz,
  referencia_conciliacao text,
  total_registros bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  IF NOT public.fn_is_admin_global() THEN
    RAISE EXCEPTION 'platform_admin_required';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.protocolo::text,
    s.empresa_id,
    coalesce(e.nome_fantasia,e.razao_social,'Sem empresa')::text,
    coalesce(
      requester.nome_completo,
      affiliate_profile.nome_completo,
      profile_owner.nome_completo,
      'Solicitante não identificado'
    )::text,
    s.valor_solicitado,
    s.taxa_saque,
    s.valor_liquido,
    CASE
      WHEN s.status='processando' THEN 'em_processamento'
      WHEN s.status='rejeitado' THEN 'recusado'
      ELSE s.status::text
    END,
    s.modo_processamento::text,
    s.destino_snapshot,
    s.data_solicitacao,
    s.data_pagamento,
    s.referencia_conciliacao::text,
    count(*) OVER()
  FROM public.saques s
  LEFT JOIN public.empresas e ON e.id=s.empresa_id
  LEFT JOIN public.profiles requester ON requester.id=s.solicitado_por_profile_id
  LEFT JOIN public.profiles profile_owner ON profile_owner.id=s.profile_id
  LEFT JOIN public.afiliados a ON a.id=s.afiliado_id
  LEFT JOIN public.profiles affiliate_profile ON affiliate_profile.id=a.profile_id
  WHERE (
    coalesce(trim(p_status),'')=''
    OR CASE
      WHEN s.status='processando' THEN 'em_processamento'
      WHEN s.status='rejeitado' THEN 'recusado'
      ELSE s.status::text
    END=p_status
  )
  ORDER BY
    CASE s.status
      WHEN 'solicitado' THEN 1
      WHEN 'em_analise' THEN 2
      WHEN 'aprovado' THEN 3
      WHEN 'processando' THEN 4
      WHEN 'enviado' THEN 5
      ELSE 9
    END,
    s.data_solicitacao DESC,
    s.id DESC
  LIMIT greatest(1,least(coalesce(p_limit,50),200))
  OFFSET greatest(coalesce(p_offset,0),0);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_saques_operacionais(text,integer,integer)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_saques_operacionais(text,integer,integer)
TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_estornos_operacionais(
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  protocolo text,
  empresa_id uuid,
  empresa_nome text,
  transacao_id uuid,
  pedido_numero text,
  valor_original numeric,
  valor_solicitado numeric,
  valor_efetivo numeric,
  status text,
  motivo text,
  modo_processamento text,
  data_solicitacao timestamptz,
  data_conclusao timestamptz,
  referencia_conciliacao text,
  total_registros bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  IF NOT public.fn_is_admin_global() THEN
    RAISE EXCEPTION 'platform_admin_required';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.protocolo::text,
    r.empresa_id,
    coalesce(e.nome_fantasia,e.razao_social,'Sem empresa')::text,
    r.transacao_id,
    t.pedido_numero::text,
    r.valor_original,
    r.valor_solicitado_estorno,
    coalesce(r.valor_efetivamente_estornado,0),
    r.status::text,
    r.motivo::text,
    r.modo_processamento::text,
    r.data_solicitacao,
    r.data_conclusao,
    r.referencia_conciliacao::text,
    count(*) OVER()
  FROM public.estornos r
  LEFT JOIN public.empresas e ON e.id=r.empresa_id
  JOIN public.transacoes t ON t.id=r.transacao_id
  WHERE (
    coalesce(trim(p_status),'')=''
    OR r.status::text=p_status
  )
  ORDER BY
    CASE r.status
      WHEN 'solicitado' THEN 1
      WHEN 'processando' THEN 2
      WHEN 'em_disputa' THEN 3
      WHEN 'aprovado_parcial' THEN 4
      WHEN 'aprovado_total' THEN 4
      ELSE 9
    END,
    r.data_solicitacao DESC,
    r.id DESC
  LIMIT greatest(1,least(coalesce(p_limit,50),200))
  OFFSET greatest(coalesce(p_offset,0),0);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_estornos_operacionais(text,integer,integer)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_estornos_operacionais(text,integer,integer)
TO authenticated;
