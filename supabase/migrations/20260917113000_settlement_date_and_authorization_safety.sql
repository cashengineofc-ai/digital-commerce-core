-- Cash Engine PRO — data de liquidação automática + correção de status financeiro.
-- Mantém 'autorizada' fora do processamento de saldo e define data_disponivel
-- usando regras ativas de taxas_plataforma, com fallback do próprio schema (30 dias).

DO $$
DECLARE
    v_def TEXT;
BEGIN
    SELECT pg_get_functiondef('public.fn_processar_financeiro_transacao(uuid)'::regprocedure)
    INTO v_def;

    IF v_def LIKE '%''autorizada''%' THEN
        v_def := replace(
            v_def,
            '''aprovada'', ''autorizada'', ''capturada'', ''paga'', ''disponivel''',
            '''aprovada'', ''capturada'', ''paga'', ''disponivel'''
        );
        EXECUTE v_def;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.fn_definir_data_disponivel_transacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_dias INTEGER;
    v_plano TEXT;
    v_base TIMESTAMPTZ;
BEGIN
    IF NEW.status NOT IN ('aprovada','capturada','paga','disponivel') THEN
        RETURN NEW;
    END IF;

    IF NEW.data_disponivel IS NOT NULL THEN
        RETURN NEW;
    END IF;

    SELECT e.plano
    INTO v_plano
    FROM public.empresas e
    WHERE e.id = NEW.empresa_id;

    SELECT tp.dias_liquidacao
    INTO v_dias
    FROM public.taxas_plataforma tp
    WHERE tp.ativo IS TRUE
      AND (tp.data_inicio_vigencia IS NULL OR tp.data_inicio_vigencia <= CURRENT_DATE)
      AND (tp.data_fim_vigencia IS NULL OR tp.data_fim_vigencia >= CURRENT_DATE)
      AND (
            tp.empresa_id = NEW.empresa_id
         OR (tp.empresa_id IS NULL AND tp.plano = v_plano)
         OR (tp.empresa_id IS NULL AND tp.plano IS NULL AND tp.is_padrao IS TRUE)
      )
      AND (tp.metodo_pagamento IS NULL OR tp.metodo_pagamento = NEW.metodo_pagamento)
    ORDER BY
      CASE
        WHEN tp.empresa_id = NEW.empresa_id AND tp.metodo_pagamento = NEW.metodo_pagamento THEN 1
        WHEN tp.empresa_id = NEW.empresa_id AND tp.metodo_pagamento IS NULL THEN 2
        WHEN tp.empresa_id IS NULL AND tp.plano = v_plano AND tp.metodo_pagamento = NEW.metodo_pagamento THEN 3
        WHEN tp.empresa_id IS NULL AND tp.plano = v_plano AND tp.metodo_pagamento IS NULL THEN 4
        WHEN tp.empresa_id IS NULL AND tp.plano IS NULL AND tp.is_padrao IS TRUE THEN 5
        ELSE 99
      END,
      tp.created_at DESC
    LIMIT 1;

    v_dias := GREATEST(COALESCE(v_dias, 30), 0);
    v_base := COALESCE(NEW.data_pagamento, NOW());
    NEW.data_disponivel := v_base + make_interval(days => v_dias);

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_definir_data_disponivel_transacao
ON public.transacoes;

CREATE TRIGGER trg_definir_data_disponivel_transacao
BEFORE INSERT OR UPDATE OF status, data_pagamento, metodo_pagamento, data_disponivel
ON public.transacoes
FOR EACH ROW
EXECUTE FUNCTION public.fn_definir_data_disponivel_transacao();
