-- Supabase installs pgcrypto in extensions. Keep each routine's existing
-- trusted path and add that schema when its body uses pgcrypto primitives.
DO $$
DECLARE r record; v_path text;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS signature,p.proconfig
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prokind='f'
      AND p.prosrc ~ '\m(gen_random_bytes|digest|hmac)\s*\('
  LOOP
    SELECT substr(c,length('search_path=')+1) INTO v_path
    FROM unnest(r.proconfig) c WHERE c LIKE 'search_path=%';
    IF v_path IS NULL THEN v_path:='public'; END IF;
    IF v_path !~ '\mextensions\M' THEN
      EXECUTE format('ALTER FUNCTION %s SET search_path TO %s, extensions',r.signature,v_path);
    END IF;
  END LOOP;
END $$;
