-- Cash Engine PRO — acesso seguro do próprio afiliado ao marketplace.
-- Execute no SQL Editor do Lovable/Supabase depois das migrations base 001..008.
-- Não cria dados de demonstração e não remove dados existentes.

ALTER TABLE public.afiliados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_inscricoes ENABLE ROW LEVEL SECURITY;

-- O afiliado pode enxergar apenas o próprio vínculo, mesmo quando o vínculo
-- estiver associado a uma operação diferente da empresa principal do profile.
DROP POLICY IF EXISTS "afiliados_select_self" ON public.afiliados;
CREATE POLICY "afiliados_select_self"
ON public.afiliados
FOR SELECT
TO authenticated
USING (
    profile_id = auth.uid()
    AND deleted_at IS NULL
);

-- O afiliado pode consultar apenas as próprias inscrições no marketplace.
DROP POLICY IF EXISTS "marketplace_inscricoes_select_self" ON public.marketplace_inscricoes;
CREATE POLICY "marketplace_inscricoes_select_self"
ON public.marketplace_inscricoes
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.afiliados a
        WHERE a.id = marketplace_inscricoes.afiliado_id
          AND a.profile_id = auth.uid()
          AND a.deleted_at IS NULL
    )
);

-- O próprio afiliado ativo pode solicitar promoção de um produto publicado.
-- empresa_id identifica a empresa/tenant do usuário que está fazendo a inscrição;
-- a empresa vendedora continua sendo identificada pelo marketplace_produto_id.
DROP POLICY IF EXISTS "marketplace_inscricoes_insert_self" ON public.marketplace_inscricoes;
CREATE POLICY "marketplace_inscricoes_insert_self"
ON public.marketplace_inscricoes
FOR INSERT
TO authenticated
WITH CHECK (
    empresa_id = public.fn_get_empresa_usuario()
    AND EXISTS (
        SELECT 1
        FROM public.afiliados a
        WHERE a.id = marketplace_inscricoes.afiliado_id
          AND a.profile_id = auth.uid()
          AND a.status = 'ativo'
          AND a.deleted_at IS NULL
    )
    AND EXISTS (
        SELECT 1
        FROM public.marketplace_produtos mp
        WHERE mp.id = marketplace_inscricoes.marketplace_produto_id
          AND mp.produto_id = marketplace_inscricoes.produto_id
          AND mp.status = 'publicado'
          AND mp.deleted_at IS NULL
    )
);

-- Índices para as verificações acima.
CREATE INDEX IF NOT EXISTS idx_afiliados_profile_status_runtime
    ON public.afiliados (profile_id, status)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_marketplace_inscricoes_afiliado_runtime
    ON public.marketplace_inscricoes (afiliado_id, created_at DESC);
