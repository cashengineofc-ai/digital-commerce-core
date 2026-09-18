-- Existing installations used the English checkout_version_id column.
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS checkout_versao_id uuid
  REFERENCES public.checkout_versions(id) ON DELETE SET NULL;
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND table_name='pedidos' AND column_name='checkout_version_id') THEN
    UPDATE public.pedidos SET checkout_versao_id=checkout_version_id
      WHERE checkout_versao_id IS NULL AND checkout_version_id IS NOT NULL;
  END IF;
END $$;
