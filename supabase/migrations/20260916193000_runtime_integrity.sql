-- Cash Engine PRO — integridade operacional para dados reais.
-- Pode ser executado após as migrations base 001..008.
-- Não cria dados demonstrativos e não apaga dados existentes.

-- 1) Corrige a verificação de permissões para impedir que ORs fora do escopo
--    liberem acesso por uma role expirada/deletada ou de outra empresa.
CREATE OR REPLACE FUNCTION public.fn_tem_permissao(
    p_modulo VARCHAR,
    p_recurso VARCHAR,
    p_acao tipo_operacao
) RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_empresa_id UUID;
    v_profile_id UUID;
BEGIN
    v_profile_id := auth.uid();
    v_empresa_id := public.fn_get_empresa_usuario();

    IF v_profile_id IS NULL OR v_empresa_id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF public.fn_is_admin_global() THEN
        RETURN TRUE;
    END IF;

    IF public.fn_is_empresa_owner(v_empresa_id) THEN
        RETURN TRUE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.profile_roles pr
        JOIN public.roles r
          ON r.id = pr.role_id
        LEFT JOIN public.role_permissions rp
          ON rp.role_id = r.id
        LEFT JOIN public.permissions p
          ON p.id = rp.permission_id
        WHERE pr.profile_id = v_profile_id
          AND pr.empresa_id = v_empresa_id
          AND r.deleted_at IS NULL
          AND (pr.expira_em IS NULL OR pr.expira_em > NOW())
          AND (
              r.is_admin = TRUE
              OR (
                  p.modulo = p_modulo
                  AND p.recurso = p_recurso
                  AND p.acao = p_acao
              )
          )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_tem_permissao(VARCHAR, VARCHAR, tipo_operacao)
TO authenticated, service_role;

-- 2) Cadastro real: todo novo auth.users recebe sua própria empresa e perfil owner.
--    Nunca concede admin global automaticamente.
CREATE OR REPLACE FUNCTION public.fn_handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_nome TEXT := COALESCE(
        NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
        NULLIF(NEW.raw_user_meta_data->>'name', ''),
        split_part(NEW.email, '@', 1)
    );
    v_empresa_nome TEXT := COALESCE(
        NULLIF(NEW.raw_user_meta_data->>'company_name', ''),
        v_nome || ' - Operação'
    );
    v_empresa_id UUID;
BEGIN
    SELECT empresa_id
      INTO v_empresa_id
      FROM public.profiles
     WHERE id = NEW.id;

    IF v_empresa_id IS NULL THEN
        INSERT INTO public.empresas (nome_fantasia, email, status)
        VALUES (v_empresa_nome, NEW.email, 'ativo')
        ON CONFLICT (email)
        DO UPDATE SET nome_fantasia = EXCLUDED.nome_fantasia
        RETURNING id INTO v_empresa_id;
    END IF;

    INSERT INTO public.profiles (
        id,
        empresa_id,
        nome_completo,
        email,
        status,
        is_owner,
        is_admin_global
    ) VALUES (
        NEW.id,
        v_empresa_id,
        v_nome,
        NEW.email,
        'ativo',
        TRUE,
        FALSE
    )
    ON CONFLICT (id)
    DO UPDATE SET
        empresa_id = EXCLUDED.empresa_id,
        nome_completo = EXCLUDED.nome_completo,
        email = EXCLUDED.email,
        status = 'ativo',
        is_owner = TRUE;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auth_create_profile ON auth.users;
CREATE TRIGGER trg_auth_create_profile
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.fn_handle_new_user();

-- 3) Garante carteira zerada para empresas antigas que ainda não possuem saldo.
INSERT INTO public.saldos (empresa_id)
SELECT e.id
FROM public.empresas e
WHERE NOT EXISTS (
    SELECT 1
    FROM public.saldos s
    WHERE s.empresa_id = e.id
)
ON CONFLICT DO NOTHING;

-- 4) Recalcula os agregados de cliente/produto/checkout usando apenas pagamentos
--    aprovados reais. Isso elimina dependência de números mockados.
CREATE OR REPLACE FUNCTION public.fn_recalcular_agregados_transacao(
    p_cliente_id UUID DEFAULT NULL,
    p_produto_id UUID DEFAULT NULL,
    p_checkout_id UUID DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_cliente_id IS NOT NULL THEN
        UPDATE public.clientes c
        SET
            total_pedidos = COALESCE((
                SELECT COUNT(*)::INTEGER
                FROM public.transacoes t
                WHERE t.cliente_id = p_cliente_id
                  AND t.tipo IN ('venda', 'assinatura', 'link_pagamento')
                  AND t.status IN ('aprovada', 'autorizada', 'capturada', 'paga', 'disponivel')
            ), 0),
            total_gasto = COALESCE((
                SELECT SUM(t.valor_bruto)
                FROM public.transacoes t
                WHERE t.cliente_id = p_cliente_id
                  AND t.tipo IN ('venda', 'assinatura', 'link_pagamento')
                  AND t.status IN ('aprovada', 'autorizada', 'capturada', 'paga', 'disponivel')
            ), 0),
            ticket_medio = COALESCE((
                SELECT AVG(t.valor_bruto)
                FROM public.transacoes t
                WHERE t.cliente_id = p_cliente_id
                  AND t.tipo IN ('venda', 'assinatura', 'link_pagamento')
                  AND t.status IN ('aprovada', 'autorizada', 'capturada', 'paga', 'disponivel')
            ), 0),
            data_primeira_compra = (
                SELECT MIN(COALESCE(t.data_pagamento, t.created_at))::DATE
                FROM public.transacoes t
                WHERE t.cliente_id = p_cliente_id
                  AND t.tipo IN ('venda', 'assinatura', 'link_pagamento')
                  AND t.status IN ('aprovada', 'autorizada', 'capturada', 'paga', 'disponivel')
            ),
            data_ultima_compra = (
                SELECT MAX(COALESCE(t.data_pagamento, t.created_at))::DATE
                FROM public.transacoes t
                WHERE t.cliente_id = p_cliente_id
                  AND t.tipo IN ('venda', 'assinatura', 'link_pagamento')
                  AND t.status IN ('aprovada', 'autorizada', 'capturada', 'paga', 'disponivel')
            ),
            updated_at = NOW()
        WHERE c.id = p_cliente_id;
    END IF;

    IF p_produto_id IS NOT NULL THEN
        UPDATE public.produtos p
        SET
            total_vendido = COALESCE((
                SELECT COUNT(*)::INTEGER
                FROM public.transacoes t
                WHERE t.produto_id = p_produto_id
                  AND t.tipo IN ('venda', 'assinatura', 'link_pagamento')
                  AND t.status IN ('aprovada', 'autorizada', 'capturada', 'paga', 'disponivel')
            ), 0),
            receita_total = COALESCE((
                SELECT SUM(t.valor_bruto)
                FROM public.transacoes t
                WHERE t.produto_id = p_produto_id
                  AND t.tipo IN ('venda', 'assinatura', 'link_pagamento')
                  AND t.status IN ('aprovada', 'autorizada', 'capturada', 'paga', 'disponivel')
            ), 0),
            updated_at = NOW()
        WHERE p.id = p_produto_id;
    END IF;

    IF p_checkout_id IS NOT NULL THEN
        UPDATE public.checkouts c
        SET
            total_vendido = COALESCE((
                SELECT COUNT(*)::INTEGER
                FROM public.transacoes t
                WHERE t.checkout_id = p_checkout_id
                  AND t.tipo IN ('venda', 'assinatura', 'link_pagamento')
                  AND t.status IN ('aprovada', 'autorizada', 'capturada', 'paga', 'disponivel')
            ), 0),
            total_arrecadado = COALESCE((
                SELECT SUM(t.valor_bruto)
                FROM public.transacoes t
                WHERE t.checkout_id = p_checkout_id
                  AND t.tipo IN ('venda', 'assinatura', 'link_pagamento')
                  AND t.status IN ('aprovada', 'autorizada', 'capturada', 'paga', 'disponivel')
            ), 0),
            updated_at = NOW()
        WHERE c.id = p_checkout_id;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_sync_agregados_transacao()
RETURNS TRIGGER
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM public.fn_recalcular_agregados_transacao(
            OLD.cliente_id,
            OLD.produto_id,
            OLD.checkout_id
        );
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        PERFORM public.fn_recalcular_agregados_transacao(
            OLD.cliente_id,
            OLD.produto_id,
            OLD.checkout_id
        );
    END IF;

    PERFORM public.fn_recalcular_agregados_transacao(
        NEW.cliente_id,
        NEW.produto_id,
        NEW.checkout_id
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_agregados_transacao ON public.transacoes;
CREATE TRIGGER trg_sync_agregados_transacao
AFTER INSERT OR DELETE OR UPDATE OF
    cliente_id,
    produto_id,
    checkout_id,
    tipo,
    status,
    valor_bruto,
    data_pagamento
ON public.transacoes
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_agregados_transacao();

-- 5) Backfill dos agregados já existentes.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.clientes LOOP
        PERFORM public.fn_recalcular_agregados_transacao(r.id, NULL, NULL);
    END LOOP;

    FOR r IN SELECT id FROM public.produtos LOOP
        PERFORM public.fn_recalcular_agregados_transacao(NULL, r.id, NULL);
    END LOOP;

    FOR r IN SELECT id FROM public.checkouts LOOP
        PERFORM public.fn_recalcular_agregados_transacao(NULL, NULL, r.id);
    END LOOP;
END $$;

-- 6) Índices usados pelas telas reais e pelos recalculos.
CREATE INDEX IF NOT EXISTS idx_transacoes_cliente_status_tipo
    ON public.transacoes (cliente_id, status, tipo, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transacoes_produto_status_tipo
    ON public.transacoes (produto_id, status, tipo, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transacoes_checkout_status_tipo
    ON public.transacoes (checkout_id, status, tipo, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transacoes_link_status
    ON public.transacoes (link_pagamento_id, status, created_at DESC);

-- Para liberar manualmente uma conta como Admin Global, rode separadamente e
-- troque o e-mail:
-- UPDATE public.profiles
-- SET is_admin_global = TRUE
-- WHERE email = 'SEU_EMAIL_AQUI';
