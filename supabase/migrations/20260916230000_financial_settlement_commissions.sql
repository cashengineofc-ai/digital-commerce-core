-- Cash Engine PRO — liquidação financeira, comissões e razão contábil.
-- Idempotente: um pagamento aprovado só gera saldo/comissão uma vez.
-- Reversões integrais também são aplicadas uma única vez.

ALTER TABLE public.transacoes
    ADD COLUMN IF NOT EXISTS saldo_processado_em TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS saldo_liberado_em TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS saldo_revertido_em TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS valor_saldo_empresa NUMERIC(15,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS valor_comissao_afiliado NUMERIC(15,2) NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_comissoes_transacao_afiliado_unico
    ON public.comissoes (transacao_id, afiliado_id)
    WHERE transacao_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_transacoes_liquidacao_pendente
    ON public.transacoes (empresa_id, data_disponivel, created_at)
    WHERE saldo_processado_em IS NOT NULL
      AND saldo_liberado_em IS NULL
      AND saldo_revertido_em IS NULL;

CREATE OR REPLACE FUNCTION public.fn_processar_financeiro_transacao(
    p_transacao_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_t public.transacoes%ROWTYPE;
    v_pago BOOLEAN;
    v_reversao BOOLEAN;
    v_liberado BOOLEAN;
    v_taxa_comissao NUMERIC(5,2) := 0;
    v_comissao_fixa NUMERIC(12,2);
    v_valor_comissao NUMERIC(15,2) := 0;
    v_valor_empresa NUMERIC(15,2) := 0;
    v_comissao_id UUID;
    v_comissao_criada BOOLEAN := FALSE;
    v_comissao_status public.status_comissao;
    v_comissao_valor NUMERIC(15,2);
    v_comissao_afiliado UUID;
BEGIN
    SELECT *
    INTO v_t
    FROM public.transacoes
    WHERE id = p_transacao_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    v_pago := v_t.status IN (
        'aprovada', 'autorizada', 'capturada', 'paga', 'disponivel'
    );

    v_reversao := v_t.status IN (
        'estornada_total', 'reembolsada', 'chargeback'
    );

    -- Processa a entrada financeira uma única vez.
    IF v_pago AND v_t.saldo_processado_em IS NULL THEN
        v_liberado := v_t.status = 'disponivel'
            OR (v_t.data_disponivel IS NOT NULL AND v_t.data_disponivel <= NOW());

        IF v_t.afiliado_id IS NOT NULL AND v_t.produto_id IS NOT NULL THEN
            SELECT
                COALESCE(ap.taxa_comissao_personalizada, p.taxa_comissao_afiliado, a.taxa_comissao_padrao, 0),
                COALESCE(ap.comissao_valor_fixo, p.comissao_valor_fixo)
            INTO v_taxa_comissao, v_comissao_fixa
            FROM public.afiliados a
            JOIN public.produtos p
              ON p.id = v_t.produto_id
             AND p.empresa_id = v_t.empresa_id
             AND p.deleted_at IS NULL
            LEFT JOIN public.afiliados_produtos ap
              ON ap.afiliado_id = a.id
             AND ap.produto_id = p.id
             AND ap.ativo = TRUE
             AND (ap.data_inicio IS NULL OR ap.data_inicio <= NOW())
             AND (ap.data_fim IS NULL OR ap.data_fim >= NOW())
            WHERE a.id = v_t.afiliado_id
              AND a.status = 'ativo'
              AND a.deleted_at IS NULL
            LIMIT 1;

            IF FOUND THEN
                IF v_comissao_fixa IS NOT NULL THEN
                    v_valor_comissao := GREATEST(v_comissao_fixa, 0);
                ELSE
                    v_valor_comissao := ROUND(
                        GREATEST(v_t.valor_bruto, 0) * GREATEST(v_taxa_comissao, 0) / 100.0,
                        2
                    );
                END IF;

                -- Nunca deixa a comissão superar o líquido recebido.
                v_valor_comissao := LEAST(
                    v_valor_comissao,
                    GREATEST(COALESCE(v_t.valor_liquido, 0), 0)
                );
            END IF;
        END IF;

        v_valor_empresa := GREATEST(
            COALESCE(v_t.valor_liquido, 0) - v_valor_comissao,
            0
        );

        INSERT INTO public.saldos (
            empresa_id,
            saldo_bruto,
            saldo_disponivel,
            saldo_previsao_liberar,
            total_entrado_historico,
            ultimo_movimento,
            atualizado_em
        )
        VALUES (
            v_t.empresa_id,
            v_valor_empresa,
            CASE WHEN v_liberado THEN v_valor_empresa ELSE 0 END,
            CASE WHEN v_liberado THEN 0 ELSE v_valor_empresa END,
            v_valor_empresa,
            NOW(),
            NOW()
        )
        ON CONFLICT (empresa_id) WHERE empresa_id IS NOT NULL
        DO UPDATE SET
            saldo_bruto = public.saldos.saldo_bruto + EXCLUDED.saldo_bruto,
            saldo_disponivel = public.saldos.saldo_disponivel + EXCLUDED.saldo_disponivel,
            saldo_previsao_liberar = public.saldos.saldo_previsao_liberar + EXCLUDED.saldo_previsao_liberar,
            total_entrado_historico = public.saldos.total_entrado_historico + EXCLUDED.total_entrado_historico,
            ultimo_movimento = NOW(),
            atualizado_em = NOW();

        INSERT INTO public.lancamentos_contabeis (
            empresa_id,
            transacao_id,
            conta_contabil,
            descricao,
            tipo_lancamento,
            valor,
            competencia,
            documento_referencia,
            automatico
        )
        VALUES (
            v_t.empresa_id,
            v_t.id,
            'VENDA_LIQUIDA',
            'Crédito líquido de venda',
            'C',
            v_valor_empresa,
            CURRENT_DATE,
            COALESCE(v_t.pedido_numero, v_t.id::TEXT),
            TRUE
        );

        IF v_valor_comissao > 0 AND v_t.afiliado_id IS NOT NULL THEN
            v_comissao_id := NULL;

            INSERT INTO public.comissoes (
                empresa_id,
                afiliado_id,
                produto_id,
                transacao_id,
                cliente_id,
                valor_venda,
                taxa_comissao_percentual,
                valor_comissao_bruta,
                valor_comissao_liquida,
                status,
                data_prevista_liberacao,
                data_aprovacao,
                metadata
            )
            VALUES (
                v_t.empresa_id,
                v_t.afiliado_id,
                v_t.produto_id,
                v_t.id,
                v_t.cliente_id,
                v_t.valor_bruto,
                COALESCE(v_taxa_comissao, 0),
                v_valor_comissao,
                v_valor_comissao,
                CASE WHEN v_liberado THEN 'liberada'::public.status_comissao ELSE 'aprovada'::public.status_comissao END,
                v_t.data_disponivel,
                NOW(),
                jsonb_build_object('origem', 'liquidacao_automatica')
            )
            ON CONFLICT DO NOTHING
            RETURNING id INTO v_comissao_id;

            IF v_comissao_id IS NOT NULL THEN
                v_comissao_criada := TRUE;

                UPDATE public.afiliados
                SET
                    total_vendas = total_vendas + 1,
                    total_vendas_confirmadas = total_vendas_confirmadas + 1,
                    total_comissao_bruta = total_comissao_bruta + v_valor_comissao,
                    total_comissao_liquida = total_comissao_liquida + v_valor_comissao,
                    saldo_aprovado = saldo_aprovado + CASE WHEN v_liberado THEN 0 ELSE v_valor_comissao END,
                    saldo_disponivel = saldo_disponivel + CASE WHEN v_liberado THEN v_valor_comissao ELSE 0 END,
                    ticket_medio_vendas = CASE
                        WHEN total_vendas_confirmadas + 1 > 0
                        THEN ROUND(((ticket_medio_vendas * total_vendas_confirmadas) + v_t.valor_bruto) / (total_vendas_confirmadas + 1), 2)
                        ELSE v_t.valor_bruto
                    END,
                    updated_at = NOW()
                WHERE id = v_t.afiliado_id;

                UPDATE public.afiliados_produtos
                SET
                    total_comissao_gerada = total_comissao_gerada + v_valor_comissao,
                    total_vendas = total_vendas + 1,
                    updated_at = NOW()
                WHERE afiliado_id = v_t.afiliado_id
                  AND produto_id = v_t.produto_id
                  AND ativo = TRUE;

                INSERT INTO public.saldos (
                    afiliado_id,
                    saldo_bruto,
                    saldo_disponivel,
                    saldo_previsao_liberar,
                    total_entrado_historico,
                    ultimo_movimento,
                    atualizado_em
                )
                VALUES (
                    v_t.afiliado_id,
                    v_valor_comissao,
                    CASE WHEN v_liberado THEN v_valor_comissao ELSE 0 END,
                    CASE WHEN v_liberado THEN 0 ELSE v_valor_comissao END,
                    v_valor_comissao,
                    NOW(),
                    NOW()
                )
                ON CONFLICT (afiliado_id) WHERE afiliado_id IS NOT NULL
                DO UPDATE SET
                    saldo_bruto = public.saldos.saldo_bruto + EXCLUDED.saldo_bruto,
                    saldo_disponivel = public.saldos.saldo_disponivel + EXCLUDED.saldo_disponivel,
                    saldo_previsao_liberar = public.saldos.saldo_previsao_liberar + EXCLUDED.saldo_previsao_liberar,
                    total_entrado_historico = public.saldos.total_entrado_historico + EXCLUDED.total_entrado_historico,
                    ultimo_movimento = NOW(),
                    atualizado_em = NOW();

                INSERT INTO public.lancamentos_contabeis (
                    empresa_id,
                    afiliado_id,
                    transacao_id,
                    comissao_id,
                    conta_contabil,
                    descricao,
                    tipo_lancamento,
                    valor,
                    competencia,
                    documento_referencia,
                    automatico
                )
                VALUES (
                    v_t.empresa_id,
                    v_t.afiliado_id,
                    v_t.id,
                    v_comissao_id,
                    'COMISSAO_AFILIADO',
                    'Comissão de afiliado gerada',
                    'C',
                    v_valor_comissao,
                    CURRENT_DATE,
                    COALESCE(v_t.pedido_numero, v_t.id::TEXT),
                    TRUE
                );
            ELSE
                SELECT id
                INTO v_comissao_id
                FROM public.comissoes
                WHERE transacao_id = v_t.id
                  AND afiliado_id = v_t.afiliado_id
                  AND deleted_at IS NULL
                LIMIT 1;
            END IF;
        END IF;

        UPDATE public.transacoes
        SET
            saldo_processado_em = NOW(),
            saldo_liberado_em = CASE WHEN v_liberado THEN NOW() ELSE saldo_liberado_em END,
            valor_saldo_empresa = v_valor_empresa,
            valor_comissao_afiliado = v_valor_comissao,
            updated_at = NOW()
        WHERE id = v_t.id;

        RETURN TRUE;
    END IF;

    -- Reverte integralmente uma entrada já processada, uma única vez.
    IF v_reversao
       AND v_t.saldo_processado_em IS NOT NULL
       AND v_t.saldo_revertido_em IS NULL THEN

        UPDATE public.saldos
        SET
            saldo_bruto = saldo_bruto - v_t.valor_saldo_empresa,
            saldo_disponivel = saldo_disponivel - CASE WHEN v_t.saldo_liberado_em IS NOT NULL THEN v_t.valor_saldo_empresa ELSE 0 END,
            saldo_previsao_liberar = GREATEST(
                0,
                saldo_previsao_liberar - CASE WHEN v_t.saldo_liberado_em IS NULL THEN v_t.valor_saldo_empresa ELSE 0 END
            ),
            saldo_estornado = saldo_estornado + v_t.valor_saldo_empresa,
            total_saido_historico = total_saido_historico + v_t.valor_saldo_empresa,
            ultimo_movimento = NOW(),
            atualizado_em = NOW()
        WHERE empresa_id = v_t.empresa_id;

        INSERT INTO public.lancamentos_contabeis (
            empresa_id,
            transacao_id,
            conta_contabil,
            descricao,
            tipo_lancamento,
            valor,
            competencia,
            documento_referencia,
            automatico
        )
        VALUES (
            v_t.empresa_id,
            v_t.id,
            CASE WHEN v_t.status = 'chargeback' THEN 'CHARGEBACK' ELSE 'ESTORNO' END,
            CASE WHEN v_t.status = 'chargeback' THEN 'Débito por chargeback' ELSE 'Débito por estorno/reembolso' END,
            'D',
            v_t.valor_saldo_empresa,
            CURRENT_DATE,
            COALESCE(v_t.pedido_numero, v_t.id::TEXT),
            TRUE
        );

        SELECT id, status, valor_comissao_liquida, afiliado_id
        INTO v_comissao_id, v_comissao_status, v_comissao_valor, v_comissao_afiliado
        FROM public.comissoes
        WHERE transacao_id = v_t.id
          AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE;

        IF FOUND AND v_comissao_valor > 0 THEN
            UPDATE public.comissoes
            SET
                status = 'estornada',
                data_cancelamento = NOW(),
                motivo_cancelamento = COALESCE(motivo_cancelamento, 'Transação estornada/reembolsada'),
                updated_at = NOW()
            WHERE id = v_comissao_id;

            UPDATE public.afiliados
            SET
                total_comissao_bruta = GREATEST(0, total_comissao_bruta - v_comissao_valor),
                total_comissao_liquida = GREATEST(0, total_comissao_liquida - v_comissao_valor),
                saldo_aprovado = GREATEST(0, saldo_aprovado - CASE WHEN v_comissao_status = 'aprovada' THEN v_comissao_valor ELSE 0 END),
                saldo_disponivel = saldo_disponivel - CASE WHEN v_comissao_status IN ('liberada', 'paga') THEN v_comissao_valor ELSE 0 END,
                updated_at = NOW()
            WHERE id = v_comissao_afiliado;

            UPDATE public.saldos
            SET
                saldo_bruto = saldo_bruto - v_comissao_valor,
                saldo_disponivel = saldo_disponivel - CASE WHEN v_comissao_status IN ('liberada', 'paga') THEN v_comissao_valor ELSE 0 END,
                saldo_previsao_liberar = GREATEST(0, saldo_previsao_liberar - CASE WHEN v_comissao_status = 'aprovada' THEN v_comissao_valor ELSE 0 END),
                saldo_estornado = saldo_estornado + v_comissao_valor,
                total_saido_historico = total_saido_historico + v_comissao_valor,
                ultimo_movimento = NOW(),
                atualizado_em = NOW()
            WHERE afiliado_id = v_comissao_afiliado;
        END IF;

        UPDATE public.transacoes
        SET
            saldo_revertido_em = NOW(),
            updated_at = NOW()
        WHERE id = v_t.id;

        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_processar_financeiro_transacao(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_processar_financeiro_transacao(UUID) TO service_role;

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

    -- Recupera transações aprovadas que, por qualquer motivo, ainda não foram processadas.
    FOR v_t IN
        SELECT id
        FROM public.transacoes
        WHERE empresa_id = v_empresa_id
          AND status IN ('aprovada', 'autorizada', 'capturada', 'paga', 'disponivel')
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
          AND status IN ('aprovada', 'autorizada', 'capturada', 'paga', 'disponivel')
          AND (status = 'disponivel' OR (data_disponivel IS NOT NULL AND data_disponivel <= NOW()))
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
            SET status = 'liberada', updated_at = NOW()
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
        SET saldo_liberado_em = NOW(), updated_at = NOW()
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

DROP TRIGGER IF EXISTS trg_processar_financeiro_transacao ON public.transacoes;
CREATE TRIGGER trg_processar_financeiro_transacao
AFTER INSERT OR UPDATE OF status, data_disponivel
ON public.transacoes
FOR EACH ROW
EXECUTE FUNCTION public.fn_trigger_processar_financeiro_transacao();

-- Evita que o navegador altere diretamente campos financeiros críticos.
CREATE OR REPLACE FUNCTION public.fn_guard_transacao_financeira()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.role() = 'authenticated' AND NOT public.fn_is_admin_global() THEN
        IF TG_OP = 'INSERT' THEN
            RAISE EXCEPTION 'Transações devem ser criadas pelo backend seguro';
        END IF;

        IF OLD.status IS DISTINCT FROM NEW.status
           OR OLD.valor_bruto IS DISTINCT FROM NEW.valor_bruto
           OR OLD.valor_liquido IS DISTINCT FROM NEW.valor_liquido
           OR OLD.valor_taxa_processamento IS DISTINCT FROM NEW.valor_taxa_processamento
           OR OLD.valor_taxa_plataforma IS DISTINCT FROM NEW.valor_taxa_plataforma
           OR OLD.afiliado_id IS DISTINCT FROM NEW.afiliado_id
           OR OLD.id_transacao_gateway IS DISTINCT FROM NEW.id_transacao_gateway
           OR OLD.provedor_pagamento IS DISTINCT FROM NEW.provedor_pagamento
           OR OLD.data_pagamento IS DISTINCT FROM NEW.data_pagamento
           OR OLD.data_disponivel IS DISTINCT FROM NEW.data_disponivel THEN
            RAISE EXCEPTION 'Campos financeiros protegidos; use uma operação segura do backend';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_transacao_financeira ON public.transacoes;
CREATE TRIGGER trg_guard_transacao_financeira
BEFORE INSERT OR UPDATE
ON public.transacoes
FOR EACH ROW
EXECUTE FUNCTION public.fn_guard_transacao_financeira();
