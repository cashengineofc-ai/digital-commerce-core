-- Cadastro público: cria uma empresa e um perfil proprietário para cada nova conta.
-- Administração global nunca é concedida pelo cadastro público.

CREATE OR REPLACE FUNCTION public.fn_handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome TEXT := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  v_empresa_nome TEXT := COALESCE(NULLIF(NEW.raw_user_meta_data->>'company_name', ''), v_nome || ' - Operação');
  v_empresa_id UUID;
BEGIN
  INSERT INTO public.empresas (nome_fantasia, email, status)
  VALUES (v_empresa_nome, NEW.email, 'ativo')
  ON CONFLICT (email) DO UPDATE SET nome_fantasia = EXCLUDED.nome_fantasia
  RETURNING id INTO v_empresa_id;

  INSERT INTO public.profiles (
    id, empresa_id, nome_completo, email, status, is_owner, is_admin_global
  ) VALUES (
    NEW.id, v_empresa_id, v_nome, NEW.email, 'ativo', TRUE, FALSE
  )
  ON CONFLICT (id) DO UPDATE SET
    empresa_id = EXCLUDED.empresa_id,
    nome_completo = EXCLUDED.nome_completo,
    email = EXCLUDED.email,
    is_owner = TRUE;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auth_create_profile ON auth.users;
CREATE TRIGGER trg_auth_create_profile
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.fn_handle_new_user();

-- Administração global não é concedida por cadastro público.
-- O primeiro administrador deve ser definido somente pelo procedimento confiável
-- fn_admin_bootstrap_platform(profile_id), executado com service_role/backend.