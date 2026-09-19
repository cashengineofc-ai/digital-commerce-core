-- Cash Engine PRO
-- Endurece autorização financeira por equipe sem alterar saldos ou movimentos.
-- Esta migration só modifica funções, policies e grants.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_financeiro_saldo(
  p_entidade text DEFAULT 'empresa'::text
)
RETURNS TABLE(
  entidade text,
  a_receber numeric,
  disponivel numeric,
  reservado_saque numeric,
  bloqueado numeric,
  liquidado_historico numeric,
  estornado_historico numeric,
  devedor numeric,
  atualizado_em timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_afiliado uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_entidade='empresa' THEN
    IF v_empresa IS NULL THEN
      RAISE EXCEPTION 'company_not_found';
    END IF;

    IF NOT (
      public.fn_is_admin_global()
      OR public.fn_is_empresa_owner(v_empresa)
      OR public.fn_tem_permissao(
        'financeiro', 'saldo', 'read'::public.tipo_operacao
      )
    ) THEN
      RAISE EXCEPTION 'permission_denied';
    END IF;

    RETURN QUERY
    SELECT
      'empresa'::text,
      coalesce(s.saldo_a_receber,0),
      coalesce(s.saldo_disponivel,0),
      coalesce(s.saldo_reservado,0),
      coalesce(s.saldo_bloqueado_operacional,0),
      coalesce(s.saldo_liquidado,0),
      coalesce(s.saldo_estornado,0),
      coalesce(s.saldo_devedor,0),
      s.atualizado_em
    FROM public.saldos s
    WHERE s.empresa_id=v_empresa
      AND s.profile_id IS NULL
      AND s.afiliado_id IS NULL;
    RETURN;
  END IF;

  IF p_entidade='afiliado' THEN
    SELECT a.id INTO v_afiliado
    FROM public.afiliados a
    WHERE a.profile_id=auth.uid()
      AND a.status='ativo'
      AND a.deleted_at IS NULL
    ORDER BY a.created_at
    LIMIT 1;

    IF v_afiliado IS NULL THEN
      RAISE EXCEPTION 'affiliate_not_found';
    END IF;

    RETURN QUERY
    SELECT
      'afiliado'::text,
      coalesce(s.saldo_a_receber,0),
      coalesce(s.saldo_disponivel,0),
      coalesce(s.saldo_reservado,0),
      coalesce(s.saldo_bloqueado_operacional,0),
      coalesce(s.saldo_liquidado,0),
      coalesce(s.saldo_estornado,0),
      coalesce(s.saldo_devedor,0),
      s.atualizado_em
    FROM public.saldos s
    WHERE s.afiliado_id=v_afiliado;
    RETURN;
  END IF;

  RAISE EXCEPTION 'invalid_balance_entity';
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_saque_entidade_dados(p_entidade text)
RETURNS TABLE(empresa_id uuid, profile_id uuid, afiliado_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa uuid:=public.current_empresa_id();
  v_afiliado uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_entidade='empresa' THEN
    IF v_empresa IS NULL THEN
      RAISE EXCEPTION 'company_not_found';
    END IF;

    IF NOT (
      public.fn_is_admin_global()
      OR public.fn_is_empresa_owner(v_empresa)
      OR public.fn_tem_permissao(
        'financeiro', 'saques', 'create'::public.tipo_operacao
      )
    ) THEN
      RAISE EXCEPTION 'permission_denied';
    END IF;

    RETURN QUERY SELECT v_empresa,NULL::uuid,NULL::uuid;
    RETURN;
  END IF;

  IF p_entidade='afiliado' THEN
    SELECT a.id INTO v_afiliado
    FROM public.afiliados a
    WHERE a.profile_id=auth.uid()
      AND a.status='ativo'
      AND a.deleted_at IS NULL
    ORDER BY a.created_at
    LIMIT 1;

    IF v_afiliado IS NULL THEN
      RAISE EXCEPTION 'affiliate_not_found';
    END IF;

    RETURN QUERY SELECT NULL::uuid,NULL::uuid,v_afiliado;
    RETURN;
  END IF;

  IF p_entidade='profile' THEN
    RETURN QUERY SELECT NULL::uuid,auth.uid(),NULL::uuid;
    RETURN;
  END IF;

  RAISE EXCEPTION 'invalid_withdraw_entity';
END;
$function$;

DROP POLICY IF EXISTS saldos_read ON public.saldos;
CREATE POLICY saldos_read
ON public.saldos
FOR SELECT
TO authenticated
USING (
  public.fn_is_admin_global()
  OR (
    empresa_id IS NOT NULL
    AND profile_id IS NULL
    AND afiliado_id IS NULL
    AND empresa_id = public.current_empresa_id()
    AND (
      public.fn_is_empresa_owner(empresa_id)
      OR public.fn_tem_permissao(
        'financeiro', 'saldo', 'read'::public.tipo_operacao
      )
    )
  )
  OR (
    afiliado_id IS NOT NULL
    AND afiliado_id IN (
      SELECT a.id
      FROM public.afiliados a
      WHERE a.profile_id = auth.uid()
        AND a.deleted_at IS NULL
    )
  )
  OR profile_id = auth.uid()
);

DROP POLICY IF EXISTS ledger_read ON public.lancamentos_contabeis;
CREATE POLICY ledger_read
ON public.lancamentos_contabeis
FOR SELECT
TO authenticated
USING (
  public.fn_is_admin_global()
  OR (
    empresa_id = public.current_empresa_id()
    AND profile_id IS NULL
    AND afiliado_id IS NULL
    AND (
      public.fn_is_empresa_owner(empresa_id)
      OR public.fn_tem_permissao(
        'financeiro', 'extrato', 'read'::public.tipo_operacao
      )
    )
  )
  OR profile_id = auth.uid()
  OR afiliado_id IN (
    SELECT a.id
    FROM public.afiliados a
    WHERE a.profile_id = auth.uid()
      AND a.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS contas_bancarias_tenant_all ON public.contas_bancarias;
DROP POLICY IF EXISTS contas_bancarias_select_authorized ON public.contas_bancarias;
DROP POLICY IF EXISTS contas_bancarias_insert_authorized ON public.contas_bancarias;
DROP POLICY IF EXISTS contas_bancarias_update_authorized ON public.contas_bancarias;
DROP POLICY IF EXISTS contas_bancarias_delete_authorized ON public.contas_bancarias;

CREATE POLICY contas_bancarias_select_authorized
ON public.contas_bancarias
FOR SELECT
TO authenticated
USING (
  public.fn_is_admin_global()
  OR (
    empresa_id = public.current_empresa_id()
    AND (
      public.fn_is_empresa_owner(empresa_id)
      OR public.fn_tem_permissao(
        'financeiro', 'contas', 'read'::public.tipo_operacao
      )
    )
  )
);

CREATE POLICY contas_bancarias_insert_authorized
ON public.contas_bancarias
FOR INSERT
TO authenticated
WITH CHECK (
  public.fn_is_admin_global()
  OR (
    empresa_id = public.current_empresa_id()
    AND (
      public.fn_is_empresa_owner(empresa_id)
      OR public.fn_tem_permissao(
        'financeiro', 'contas', 'create'::public.tipo_operacao
      )
    )
  )
);

CREATE POLICY contas_bancarias_update_authorized
ON public.contas_bancarias
FOR UPDATE
TO authenticated
USING (
  public.fn_is_admin_global()
  OR (
    empresa_id = public.current_empresa_id()
    AND (
      public.fn_is_empresa_owner(empresa_id)
      OR public.fn_tem_permissao(
        'financeiro', 'contas', 'update'::public.tipo_operacao
      )
    )
  )
)
WITH CHECK (
  public.fn_is_admin_global()
  OR (
    empresa_id = public.current_empresa_id()
    AND (
      public.fn_is_empresa_owner(empresa_id)
      OR public.fn_tem_permissao(
        'financeiro', 'contas', 'update'::public.tipo_operacao
      )
    )
  )
);

CREATE POLICY contas_bancarias_delete_authorized
ON public.contas_bancarias
FOR DELETE
TO authenticated
USING (
  public.fn_is_admin_global()
  OR (
    empresa_id = public.current_empresa_id()
    AND (
      public.fn_is_empresa_owner(empresa_id)
      OR public.fn_tem_permissao(
        'financeiro', 'contas', 'delete'::public.tipo_operacao
      )
    )
  )
);

REVOKE ALL ON TABLE public.contas_bancarias FROM anon;
REVOKE SELECT ON TABLE public.saldos FROM anon;
REVOKE SELECT ON TABLE public.lancamentos_contabeis FROM anon;
REVOKE SELECT ON TABLE public.saques FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.contas_bancarias FROM authenticated;

COMMIT;
