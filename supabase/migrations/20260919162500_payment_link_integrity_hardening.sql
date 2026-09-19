-- Strengthen payment-link invariants and make late successful payments
-- account for their link usage even if the temporary reservation expired.

BEGIN;

ALTER TABLE public.links_pagamento
  ADD CONSTRAINT links_pagamento_valor_positivo_chk
    CHECK (valor > 0),
  ADD CONSTRAINT links_pagamento_max_usos_positivo_chk
    CHECK (max_usos IS NULL OR max_usos > 0),
  ADD CONSTRAINT links_pagamento_contador_usos_nao_negativo_chk
    CHECK (contador_usos IS NULL OR contador_usos >= 0),
  ADD CONSTRAINT links_pagamento_uso_unico_max_chk
    CHECK (NOT uso_unico OR max_usos = 1);

CREATE OR REPLACE FUNCTION public.fn_link_finalizar_reserva()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res public.link_pagamento_reservas%ROWTYPE;
  v_max integer;
  v_count integer;
BEGIN
  IF NEW.link_pagamento_id IS NULL
     OR NEW.status_pagamento IS NOT DISTINCT FROM OLD.status_pagamento THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_res
  FROM public.link_pagamento_reservas
  WHERE pedido_id = NEW.id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- A successful payment is a real use even when its temporary reservation
  -- already expired. Ignoring an expired reservation would undercount sales
  -- and could leave a limited-use link active after a late confirmation.
  IF NEW.status_pagamento IN ('confirmado','reembolsado_parcial','reembolsado_total')
     AND v_res.status IN ('reservada','expirada') THEN
    UPDATE public.links_pagamento
    SET contador_usos = coalesce(contador_usos, 0) + 1,
        updated_at = now()
    WHERE id = v_res.link_pagamento_id
    RETURNING max_usos, contador_usos INTO v_max, v_count;

    UPDATE public.link_pagamento_reservas
    SET status = 'confirmada',
        updated_at = now()
    WHERE id = v_res.id;

    IF v_max IS NOT NULL AND v_count >= v_max THEN
      UPDATE public.links_pagamento
      SET status = 'usado',
          updated_at = now()
      WHERE id = v_res.link_pagamento_id;
    END IF;

  ELSIF NEW.status_pagamento IN ('falhou','cancelado')
        AND v_res.status IN ('reservada','expirada') THEN
    UPDATE public.link_pagamento_reservas
    SET status = 'liberada',
        updated_at = now()
    WHERE id = v_res.id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_link_finalizar_reserva() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_link_finalizar_reserva() TO service_role;

COMMIT;
