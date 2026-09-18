-- Run with a trusted SQL connection, after team_authorization_repair.
-- ALWAYS run this entire file: fixtures are synthetic and rolled back.
BEGIN;
SET LOCAL statement_timeout='25s';
DO $$
DECLARE a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); m uuid:=gen_random_uuid();
  ea uuid; eb uuid; r uuid; admin_r uuid; perm uuid;
BEGIN
  INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
    (a,a||'@example.invalid','{}'),(b,b||'@example.invalid','{}'),(m,m||'@example.invalid','{}');
  SELECT empresa_id INTO ea FROM public.profiles WHERE id=a;
  SELECT empresa_id INTO eb FROM public.profiles WHERE id=b;
  UPDATE public.profiles SET is_owner=false,empresa_id=ea,cpf=left(m::text,14) WHERE id=m;
  INSERT INTO public.equipe_membros(empresa_id,profile_id,cargo,status) VALUES(ea,m,'Test manager','ativo');
  INSERT INTO public.roles(empresa_id,nome,nivel,is_sistema,is_admin)
    VALUES(ea,'Test manager '||m,100,false,false) RETURNING id INTO r;
  INSERT INTO public.roles(empresa_id,nome,nivel,is_sistema,is_admin)
    VALUES(ea,'Test admin '||m,200,false,true) RETURNING id INTO admin_r;
  SELECT id INTO perm FROM public.permissions WHERE modulo='rh' AND recurso='equipe' AND acao='update';
  IF perm IS NULL THEN RAISE EXCEPTION 'test_permission_missing'; END IF;
  INSERT INTO public.role_permissions(role_id,permission_id) VALUES(r,perm);
  INSERT INTO public.profile_roles(profile_id,role_id,empresa_id) VALUES(m,r,ea);
  PERFORM set_config('test.team',jsonb_build_object('a',a,'b',b,'m',m,'ea',ea,'eb',eb,'r',r,'admin',admin_r)::text,true);
END $$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE t jsonb:=current_setting('test.team')::jsonb; inv jsonb; member_row record;
BEGIN
  PERFORM set_config('request.jwt.claim.sub',t->>'m',true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  IF NOT public.fn_pode_gerenciar_equipe() THEN RAISE EXCEPTION 'manager_permission_missing'; END IF;
  IF public.fn_tem_permissao('developers','api_keys','read') THEN RAISE EXCEPTION 'developer_access_leak'; END IF;
  BEGIN
    PERFORM public.fn_contexto_empresa_definir((t->>'eb')::uuid);
    RAISE EXCEPTION 'cross_company_context_allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'company_context_not_authorized' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.fn_equipe_convite_criar('test@example.invalid','Test','Test',(t->>'admin')::uuid,7);
    RAISE EXCEPTION 'admin_invite_escalation_allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'owner_required_for_admin_role' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.roles SET is_admin=true WHERE id=(t->>'r')::uuid;
    RAISE EXCEPTION 'direct_role_escalation_allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.profiles SET is_admin_global=true WHERE id=(t->>'m')::uuid;
    RAISE EXCEPTION 'self_promotion_allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT IN ('privileged_profile_fields_cannot_be_self_modified','protected_profile_authority_fields','Somente administradores globais podem alterar permissões de admin') THEN RAISE; END IF;
  END;
  inv:=public.fn_equipe_convite_criar('test-'||(t->>'m')||'@example.invalid','Test','Test',(t->>'r')::uuid,7);
  PERFORM public.fn_equipe_convite_visualizar(inv->>'code',inv->>'token');
  PERFORM public.fn_equipe_convites_listar();
  PERFORM public.fn_equipe_listar();
  PERFORM public.fn_roles_listar();
  PERFORM public.fn_permissions_listar();
  IF NOT public.fn_equipe_convite_revogar((inv->>'invite_id')::uuid) THEN RAISE EXCEPTION 'revoke_failed'; END IF;

  PERFORM set_config('request.jwt.claim.sub',t->>'a',true);
  IF NOT public.fn_is_empresa_owner((t->>'ea')::uuid) THEN RAISE EXCEPTION 'owner_not_recognized'; END IF;
  inv:=public.fn_equipe_convite_criar((t->>'b')||'@example.invalid','Other owner','Guest',(t->>'r')::uuid,7);
  PERFORM set_config('request.jwt.claim.sub',t->>'b',true);
  BEGIN
    PERFORM public.fn_equipe_convite_aceitar(inv->>'code','wrong-token');
    RAISE EXCEPTION 'bad_token_accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'team_invite_invalid' THEN RAISE; END IF;
  END;
  PERFORM public.fn_equipe_convite_aceitar(inv->>'code',inv->>'token');
  IF public.current_empresa_id()<>(t->>'ea')::uuid OR public.fn_get_empresa_usuario()<>(t->>'ea')::uuid THEN RAISE EXCEPTION 'company_context_mismatch'; END IF;
  IF public.fn_is_empresa_owner() THEN RAISE EXCEPTION 'owner_privilege_crossed_company'; END IF;
  BEGIN
    PERFORM public.fn_equipe_convite_aceitar(inv->>'code',inv->>'token');
    RAISE EXCEPTION 'invite_reused';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'team_invite_not_pending' THEN RAISE; END IF;
  END;
  FOR member_row IN SELECT * FROM public.fn_equipe_listar() LOOP
    IF member_row.profile_id=(t->>'b')::uuid AND member_row.is_owner THEN RAISE EXCEPTION 'incorrect_owner_label'; END IF;
  END LOOP;
  PERFORM public.fn_empresas_autorizadas();
  PERFORM set_config('request.jwt.claim.sub',t->>'a',true);
  PERFORM public.fn_conta_obter();
  PERFORM public.fn_empresa_config_obter();
  PERFORM public.fn_seguranca_eventos_me(10);
  PERFORM public.fn_seguranca_sessoes_me();
  PERFORM public.fn_integracoes_listar_safe();
  PERFORM public.fn_integracao_configurar_secret('mercado_pago','synthetic-rollback-secret-1');
  PERFORM public.fn_integracao_configurar_secret('mercado_pago','synthetic-rollback-secret-2');
  FOR member_row IN SELECT * FROM public.fn_integracoes_listar_safe() LOOP
    IF member_row.integracao_id IS NOT NULL THEN
      PERFORM public.fn_integracao_desconectar(member_row.integracao_id);
    END IF;
  END LOOP;
  PERFORM public.fn_equipe_remover((t->>'m')::uuid,'Rollback regression test');
  PERFORM set_config('request.jwt.claim.sub',t->>'m',true);
  IF public.current_empresa_id() IS NOT NULL OR public.fn_pode_gerenciar_equipe() THEN RAISE EXCEPTION 'removed_member_still_authorized'; END IF;
END $$;
RESET ROLE;
-- A blocked global administrator must not pass either authorization helper.
DO $$
DECLARE t jsonb:=current_setting('test.team')::jsonb;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','',true);
  PERFORM set_config('request.jwt.claim.role','service_role',true);
  UPDATE public.profiles SET is_admin_global=true,status='bloqueado' WHERE id=(t->>'b')::uuid;
  PERFORM set_config('request.jwt.claim.sub',t->>'b',true);
  IF public.fn_is_admin_global() OR public.is_admin_global() THEN RAISE EXCEPTION 'blocked_admin_authorized'; END IF;
END $$;
SELECT 'team and settings regression passed; fixtures rolled back' AS result;
ROLLBACK;

