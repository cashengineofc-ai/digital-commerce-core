-- Cash Engine PRO — contador idempotente de uso de links de pagamento.
-- Conta somente pagamentos realmente efetivados e protege o marcador interno.

ALTER TABLE public.transacoes
ADD COLUMN IF NOT EXISTS link_uso_contabilizado_em TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.fn_contabilizar_uso_link_pagamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_max_usos INTEGER;
    v_novo_contador INTEGER;
BEGIN
    IF NEW.link_pagamento_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.status NOT IN ('aprovada','capturada','paga','disponivel') THEN
        RETURN NEW;
    END IF;

    IF NEW.link_uso_contabilizado_em IS NOT NULL THEN
        RETURN NEW;
    END IF;

    SELECT max_usos
    INTO v_max_usos
    FROM public.links_pagamento
    WHERE id = NEW.link_pagamento_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    UPDATE public.links_pagamento
    SET contador_usos = COALESCE(contador_usos, 0) + 1,
        updated_at = NOW()
    WHERE id = NEW.link_pagamento_id
    RETURNING contador_usos INTO v_novo_contador;

    IF v_max_usos IS NOT NULL
       AND v_novo_contador >= v_max_usos THEN
        UPDATE public.links_pagamento
        SET status = 'usado',
            updated_at = NOW()
        WHERE id = NEW.link_pagamento_id;
    END IF;

    NEW.link_uso_contabilizado_em := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contabilizar_uso_link_pagamento
ON public.transacoes;

CREATE TRIGGER trg_contabilizar_uso_link_pagamento
BEFORE INSERT OR UPDATE OF status, link_pagamento_id, link_uso_contabilizado_em
ON public.transacoes
FOR EACH ROW
EXECUTE FUNCTION public.fn_contabilizar_uso_link_pagamento();

CREATE OR REPLACE FUNCTION public.fn_guard_transacao_financeira()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    IF current_user = 'authenticated'
       AND auth.role() = 'authenticated'
       AND NOT public.fn_is_admin_global() THEN

        IF TG_OP = 'INSERT' THEN
            RAISE EXCEPTION 'Transações devem ser criadas pelo backend seguro';
        END IF;

        IF OLD.status IS DISTINCT FROM NEW.status
           OR OLD.valor_bruto IS DISTINCT FROM NEW.valor_bruto
           OR OLD.valor_liquido IS DISTINCT FROM NEW.valor_liquido
           OR OLD.valor_taxa_processamento IS DISTINCT FROM NEW.valor_taxa_processamento
           OR OLD.valor_taxa_plataforma IS DISTINCT FROM NEW.valor_taxa_plataforma
           OR OLD.afiliado_id IS DISTINCT FROM NEW.afiliado_id
           OR OLD.link_afiliado_id IS DISTINCT FROM NEW.link_afiliado_id
           OR OLD.id_transacao_gateway IS DISTINCT FROM NEW.id_transacao_gateway
           OR OLD.provedor_pagamento IS DISTINCT FROM NEW.provedor_pagamento
           OR OLD.idempotency_key IS DISTINCT FROM NEW.idempotency_key
           OR OLD.status_detalhe_provedor IS DISTINCT FROM NEW.status_detalhe_provedor
           OR OLD.payload_provedor IS DISTINCT FROM NEW.payload_provedor
           OR OLD.data_pagamento IS DISTINCT FROM NEW.data_pagamento
           OR OLD.data_disponivel IS DISTINCT FROM NEW.data_disponivel
           OR OLD.data_estorno IS DISTINCT FROM NEW.data_estorno
           OR OLD.saldo_processado_em IS DISTINCT FROM NEW.saldo_processado_em
           OR OLD.saldo_liberado_em IS DISTINCT FROM NEW.saldo_liberado_em
           OR OLD.saldo_revertido_em IS DISTINCT FROM NEW.saldo_revertido_em
           OR OLD.valor_saldo_empresa IS DISTINCT FROM NEW.valor_saldo_empresa
           OR OLD.valor_comissao_afiliado IS DISTINCT FROM NEW.valor_comissao_afiliado
           OR OLD.link_uso_contabilizado_em IS DISTINCT FROM NEW.link_uso_contabilizado_em
           OR OLD.pix_qrcode IS DISTINCT FROM NEW.pix_qrcode
           OR OLD.pix_copia_cola IS DISTINCT FROM NEW.pix_copia_cola
           OR OLD.pix_expiracao IS DISTINCT FROM NEW.pix_expiracao
           OR OLD.cartao_final IS DISTINCT FROM NEW.cartao_final
           OR OLD.cartao_bandeira IS DISTINCT FROM NEW.cartao_bandeira THEN
            RAISE EXCEPTION 'Campos financeiros protegidos; use uma operação segura do backend';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;
