-- Cash Engine PRO — blindagem adicional dos campos financeiros.
-- Impede alteração direta pelo navegador, mantendo Edge Functions/RPCs seguras funcionais.

CREATE OR REPLACE FUNCTION public.fn_guard_transacao_financeira()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    -- Bloqueia mutações financeiras diretas feitas pelo papel authenticated.
    -- Operações internas em funções SECURITY DEFINER e service_role continuam permitidas.
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

DROP TRIGGER IF EXISTS trg_guard_transacao_financeira
ON public.transacoes;

CREATE TRIGGER trg_guard_transacao_financeira
BEFORE INSERT OR UPDATE
ON public.transacoes
FOR EACH ROW
EXECUTE FUNCTION public.fn_guard_transacao_financeira();
