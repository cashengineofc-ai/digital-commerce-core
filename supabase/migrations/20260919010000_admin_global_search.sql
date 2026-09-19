-- Busca central do Admin Global. Nenhum dado é exposto sem a checagem de
-- privilégio no banco; a interface apenas consome este resultado limitado.
CREATE OR REPLACE FUNCTION public.fn_admin_pesquisa_global(
  p_query text,
  p_limit integer DEFAULT 12
)
RETURNS TABLE(
  tipo text,
  id uuid,
  titulo text,
  subtitulo text,
  destino text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_query text := trim(coalesce(p_query, ''));
  v_limit integer := greatest(1, least(coalesce(p_limit, 12), 30));
BEGIN
  IF NOT public.fn_is_admin_global() THEN
    RAISE EXCEPTION 'platform_admin_required';
  END IF;

  IF length(v_query) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT resultado.tipo, resultado.id, resultado.titulo, resultado.subtitulo, resultado.destino
  FROM (
    SELECT
      'empresa'::text AS tipo,
      e.id,
      e.nome_fantasia::text AS titulo,
      concat_ws(' · ', nullif(e.cnpj, ''), nullif(e.email, ''), e.status::text) AS subtitulo,
      '/admin/empresas'::text AS destino,
      1 AS prioridade,
      e.created_at AS ordenacao
    FROM public.empresas e
    WHERE e.deleted_at IS NULL
      AND (
        e.nome_fantasia ILIKE '%' || v_query || '%'
        OR coalesce(e.razao_social, '') ILIKE '%' || v_query || '%'
        OR coalesce(e.cnpj, '') ILIKE '%' || v_query || '%'
        OR coalesce(e.email, '') ILIKE '%' || v_query || '%'
      )

    UNION ALL

    SELECT
      'usuario'::text,
      p.id,
      p.nome_completo::text,
      concat_ws(' · ', p.email, coalesce(e.nome_fantasia, e.razao_social), p.status::text),
      '/admin/usuarios'::text,
      2,
      p.created_at
    FROM public.profiles p
    LEFT JOIN public.empresas e ON e.id = p.empresa_id
    WHERE p.deleted_at IS NULL
      AND (
        p.nome_completo ILIKE '%' || v_query || '%'
        OR p.email ILIKE '%' || v_query || '%'
      )

    UNION ALL

    SELECT
      'pedido'::text,
      pd.id,
      ('Pedido ' || pd.numero)::text,
      concat_ws(' · ', coalesce(e.nome_fantasia, e.razao_social), pd.status_pagamento, pd.metodo_pagamento),
      '/admin/financeiro'::text,
      3,
      pd.criado_em
    FROM public.pedidos pd
    JOIN public.empresas e ON e.id = pd.empresa_id
    WHERE e.deleted_at IS NULL
      AND (
        pd.numero ILIKE '%' || v_query || '%'
        OR coalesce(pd.comprador_nome, '') ILIKE '%' || v_query || '%'
        OR coalesce(pd.comprador_email, '') ILIKE '%' || v_query || '%'
      )
  ) AS resultado
  ORDER BY resultado.prioridade, resultado.ordenacao DESC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_admin_pesquisa_global(text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_pesquisa_global(text,integer) TO authenticated;
