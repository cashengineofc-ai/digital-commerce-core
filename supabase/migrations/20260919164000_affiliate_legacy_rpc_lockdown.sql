-- Retire direct browser access to legacy affiliate management RPCs.
-- The application uses the permission-aware fn_afiliado_* entrypoints.
-- The two click increment helpers remain callable by service_role because the
-- affiliate-click Edge Function uses them after writing a deduplicated click.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.fn_aceitar_convite_afiliado(text)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_configurar_produto_afiliado(uuid, uuid, numeric, numeric, boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_criar_convite_afiliado(text, timestamptz, uuid[], numeric, text)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_criar_link_afiliado(uuid, uuid, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_gerir_afiliacao(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_increment_afiliado_clique(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_increment_link_afiliado_clique(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_pode_gerir_afiliados()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_revogar_convite_afiliado(uuid)
  FROM PUBLIC, anon, authenticated;

-- Trigger functions are not public API endpoints and should not be executable
-- directly by browser roles.
REVOKE EXECUTE ON FUNCTION public.fn_snapshot_comissao_pedido_item()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_notificar_repasse_status()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.fn_aceitar_convite_afiliado(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_configurar_produto_afiliado(uuid, uuid, numeric, numeric, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_criar_convite_afiliado(text, timestamptz, uuid[], numeric, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_criar_link_afiliado(uuid, uuid, uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_gerir_afiliacao(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_increment_afiliado_clique(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_increment_link_afiliado_clique(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_pode_gerir_afiliados() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_revogar_convite_afiliado(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_snapshot_comissao_pedido_item() TO service_role;
GRANT EXECUTE ON FUNCTION public.trg_notificar_repasse_status() TO service_role;

COMMIT;
