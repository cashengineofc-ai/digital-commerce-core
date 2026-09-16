-- Cash Engine PRO — operações reais de saque.
-- Executar após 004_financeiro.sql e 007_rls_functions_triggers.sql.
-- Reserva saldo de forma atômica para impedir saque acima do disponível.

CREATE OR REPLACE FUNCTION public.fn_solicitar_saque(
    p_valor NUMERIC,
    p_conta_bancaria_id UUID
) RETURNS UUID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id UUID;
    v_saldo public.saldos%ROWTYPE;
    v_saque_id UUID;
    v_protocolo VARCHAR(32);
    v_taxa NUMERIC(15,2) := 0;
    v_taxa_percentual NUMERIC(10,4) := 0;
    v_taxa_fixa NUMERIC(15,2) := 0;
    v_valor_liquido NUMERIC(15,2);
BEGIN
    v_empresa_id := public.fn_get_empresa_usuario();

    IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado ou sem empresa';
    END IF;

    IF p_valor IS NULL OR p_valor <= 0 THEN
        RAISE EXCEPTION 'Valor de saque inválido';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.contas_bancarias cb
        WHERE cb.id = p_conta_bancaria_id
          AND cb.empresa_id = v_empresa_id
          AND cb.deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Conta bancária inválida para esta empresa';
    END IF;

    SELECT *
      INTO v_saldo
      FROM public.saldos
     WHERE empresa_id = v_empresa_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Carteira da empresa não encontrada';
    END IF;

    IF v_saldo.saldo_disponivel < p_valor THEN
        RAISE EXCEPTION 'Saldo disponível insuficiente';
    END IF;

    SELECT
        COALESCE(tp.taxa_saque_percentual, 0),
        COALESCE(tp.taxa_saque_fixa, 0)
      INTO v_taxa_percentual, v_taxa_fixa
      FROM public.empresas e
      LEFT JOIN LATERAL (
          SELECT t.*
          FROM public.taxas_plataforma t
          WHERE t.ativo = TRUE
            AND t.data_inicio_vigencia <= CURRENT_DATE
            AND (t.data_fim_vigencia IS NULL OR t.data_fim_vigencia >= CURRENT_DATE)
            AND (t.empresa_id = e.id OR t.empresa_id IS NULL)
            AND t.plano = e.plano
          ORDER BY (t.empresa_id IS NOT NULL) DESC, t.data_inicio_vigencia DESC
          LIMIT 1
      ) tp ON TRUE
     WHERE e.id = v_empresa_id;

    v_taxa := ROUND((p_valor * COALESCE(v_taxa_percentual, 0) / 100.0) + COALESCE(v_taxa_fixa, 0), 2);
    v_valor_liquido := p_valor - v_taxa;

    IF v_valor_liquido <= 0 THEN
        RAISE EXCEPTION 'Valor líquido do saque deve ser maior que zero';
    END IF;

    LOOP
        v_protocolo := public.fn_gerar_codigo_unico('SQ-', 16);
        EXIT WHEN NOT EXISTS (
            SELECT 1 FROM public.saques WHERE protocolo = v_protocolo
        );
    END LOOP;

    INSERT INTO public.saques (
        empresa_id,
        conta_bancaria_id,
        protocolo,
        valor_solicitado,
        taxa_saque,
        valor_liquido,
        metodo_saque,
        status,
        data_solicitacao,
        metadata
    ) VALUES (
        v_empresa_id,
        p_conta_bancaria_id,
        v_protocolo,
        p_valor,
        v_taxa,
        v_valor_liquido,
        'pix',
        'solicitado',
        NOW(),
        jsonb_build_object('solicitado_por', auth.uid())
    )
    RETURNING id INTO v_saque_id;

    UPDATE public.saldos
       SET saldo_disponivel = saldo_disponivel - p_valor,
           saldo_bloqueado = saldo_bloqueado + p_valor,
           ultimo_movimento = NOW(),
           atualizado_em = NOW()
     WHERE empresa_id = v_empresa_id;

    RETURN v_saque_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_solicitar_saque(NUMERIC, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_cancelar_saque(
    p_saque_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id UUID;
    v_saque public.saques%ROWTYPE;
BEGIN
    v_empresa_id := public.fn_get_empresa_usuario();

    IF auth.uid() IS NULL OR v_empresa_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado ou sem empresa';
    END IF;

    SELECT *
      INTO v_saque
      FROM public.saques
     WHERE id = p_saque_id
       AND empresa_id = v_empresa_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Saque não encontrado';
    END IF;

    IF v_saque.status NOT IN ('solicitado', 'em_analise') THEN
        RAISE EXCEPTION 'Este saque não pode mais ser cancelado';
    END IF;

    UPDATE public.saques
       SET status = 'cancelado',
           data_cancelamento = NOW(),
           cancelado_por = auth.uid(),
           motivo_cancelamento = COALESCE(motivo_cancelamento, 'Cancelado pelo usuário')
     WHERE id = p_saque_id;

    UPDATE public.saldos
       SET saldo_disponivel = saldo_disponivel + v_saque.valor_solicitado,
           saldo_bloqueado = GREATEST(0, saldo_bloqueado - v_saque.valor_solicitado),
           ultimo_movimento = NOW(),
           atualizado_em = NOW()
     WHERE empresa_id = v_empresa_id;

    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_cancelar_saque(UUID) TO authenticated;
