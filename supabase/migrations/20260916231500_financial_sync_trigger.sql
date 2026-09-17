-- Cash Engine PRO — sincronização de saldo e disparo automático da liquidação.
-- Mantém o financeiro alinhado com mudanças de status do gateway sem duplicar valores.

CREATE OR REPLACE FUNCTION public.fn_sincronizar_saldo_empresa()
RETURNS INTEGER
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id UUID;
    v_t RECORD;
    v_c RECORD;
    v_total INTEGER := 0;
BEGIN
    v_empresa_id := public.fn_get_empresa_usuario();

    IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado ou sem empresa';
    END IF;

    -- Recupera transações efetivamente pagas que ainda não foram processadas.
    FOR v_t IN
        SELECT id
        FROM public.transacoes
        WHERE empresa_id = v_empresa_id
          AND status IN ('aprovada', 'capturada', 'paga', 'disponivel')
          AND saldo_processado_em IS NULL
        ORDER BY created_at
    LOOP
        PERFORM public.fn_processar_financeiro_transacao(v_t.id);
    END LOOP;

    -- Libera valores cuja data de disponibilidade chegou.
    FOR v_t IN
        SELECT id, valor_saldo_empresa
        FROM public.transacoes
        WHERE empresa_id = v_empresa_id
          AND saldo_processado_em IS NOT NULL
          AND saldo_liberado_em IS NULL
          AND saldo_revertido_em IS NULL
          AND status IN ('aprovada', 'capturada', 'paga', 'disponivel')
          AND (
              status = 'disponivel'
              OR (data_disponivel IS NOT NULL AND data_disponivel <= NOW())
          )
        ORDER BY COALESCE(data_disponivel, created_at)
        FOR UPDATE SKIP LOCKED
    LOOP
        UPDATE public.saldos
        SET
            saldo_previsao_liberar = GREATEST(0, saldo_previsao_liberar - v_t.valor_saldo_empresa),
            saldo_disponivel = saldo_disponivel + v_t.valor_saldo_empresa,
            ultimo_movimento = NOW(),
            atualizado_em = NOW()
        WHERE empresa_id = v_empresa_id;

        FOR v_c IN
            SELECT id, afiliado_id, valor_comissao_liquida
            FROM public.comissoes
            WHERE transacao_id = v_t.id
              AND status = 'aprovada'
              AND deleted_at IS NULL
            FOR UPDATE
        LOOP
            UPDATE public.comissoes
            SET
                status = 'liberada',
                updated_at = NOW()
            WHERE id = v_c.id;

            UPDATE public.afiliados
            SET
                saldo_aprovado = GREATEST(0, saldo_aprovado - v_c.valor_comissao_liquida),
                saldo_disponivel = saldo_disponivel + v_c.valor_comissao_liquida,
                updated_at = NOW()
            WHERE id = v_c.afiliado_id;

            UPDATE public.saldos
            SET
                saldo_previsao_liberar = GREATEST(0, saldo_previsao_liberar - v_c.valor_comissao_liquida),
                saldo_disponivel = saldo_disponivel + v_c.valor_comissao_liquida,
                ultimo_movimento = NOW(),
                atualizado_em = NOW()
            WHERE afiliado_id = v_c.afiliado_id;
        END LOOP;

        UPDATE public.transacoes
        SET
            saldo_liberado_em = NOW(),
            updated_at = NOW()
        WHERE id = v_t.id;

        v_total := v_total + 1;
    END LOOP;

    RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_sincronizar_saldo_empresa() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_sincronizar_saldo_empresa() TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_trigger_processar_financeiro_transacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public.fn_processar_financeiro_transacao(NEW.id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_processar_financeiro_transacao
ON public.transacoes;

CREATE TRIGGER trg_processar_financeiro_transacao
AFTER INSERT OR UPDATE OF status, data_disponivel
ON public.transacoes
FOR EACH ROW
EXECUTE FUNCTION public.fn_trigger_processar_financeiro_transacao();
