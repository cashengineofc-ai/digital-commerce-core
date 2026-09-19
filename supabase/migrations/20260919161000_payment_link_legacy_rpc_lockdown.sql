-- Lock down legacy payment-link RPCs that have been superseded by the
-- permission-aware fn_link_pagamento_* entrypoints used by the application.
--
-- These functions are SECURITY DEFINER and must not be callable by anonymous
-- or regular authenticated sessions.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.fn_criar_link_pagamento(
  uuid,
  uuid,
  text,
  timestamptz,
  boolean,
  integer
) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_desativar_link_pagamento(uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.fn_criar_link_pagamento(
  uuid,
  uuid,
  text,
  timestamptz,
  boolean,
  integer
) TO service_role;

GRANT EXECUTE ON FUNCTION public.fn_desativar_link_pagamento(uuid)
  TO service_role;

COMMIT;
