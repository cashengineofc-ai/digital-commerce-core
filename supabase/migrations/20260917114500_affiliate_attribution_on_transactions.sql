-- Cash Engine PRO — atribuição de afiliado por transação.
-- Guarda o link de afiliado na venda e propaga para a comissão gerada.

ALTER TABLE public.transacoes
ADD COLUMN IF NOT EXISTS link_afiliado_id UUID
REFERENCES public.links_afiliados(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transacoes_link_afiliado
ON public.transacoes(link_afiliado_id)
WHERE link_afiliado_id IS NOT NULL;

DO $$
DECLARE
    v_def TEXT;
BEGIN
    SELECT pg_get_functiondef('public.fn_processar_financeiro_transacao(uuid)'::regprocedure)
    INTO v_def;

    IF v_def NOT LIKE '%link_afiliado_id%' THEN
        v_def := replace(
            v_def,
            '                cliente_id,' || chr(10) || '                valor_venda,',
            '                cliente_id,' || chr(10) || '                link_afiliado_id,' || chr(10) || '                valor_venda,'
        );

        v_def := replace(
            v_def,
            '                v_t.cliente_id,' || chr(10) || '                v_t.valor_bruto,',
            '                v_t.cliente_id,' || chr(10) || '                v_t.link_afiliado_id,' || chr(10) || '                v_t.valor_bruto,'
        );

        EXECUTE v_def;
    END IF;
END $$;
