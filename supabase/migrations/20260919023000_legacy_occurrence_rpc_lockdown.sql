-- Cash Engine PRO
-- Fecha o RPC legado de estornos/contestações para sessões de navegador.
-- A interface atual usa fn_ocorrencias_financeiras_listar, que aplica
-- permissões separadas para financeiro/estornos/read e chargebacks/read.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.fn_estornos_contestacoes(integer,integer)
FROM PUBLIC, anon, authenticated;

COMMIT;
