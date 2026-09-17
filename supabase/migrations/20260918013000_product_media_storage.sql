-- Cash Engine PRO — mídia persistente de produtos/checkouts
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-media',
  'product-media',
  true,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp','image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS product_media_insert_company ON storage.objects;
CREATE POLICY product_media_insert_company
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id='product-media'
  AND (storage.foldername(name))[1] = public.current_empresa_id()::text
);

DROP POLICY IF EXISTS product_media_update_company ON storage.objects;
CREATE POLICY product_media_update_company
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id='product-media'
  AND (storage.foldername(name))[1] = public.current_empresa_id()::text
)
WITH CHECK (
  bucket_id='product-media'
  AND (storage.foldername(name))[1] = public.current_empresa_id()::text
);

DROP POLICY IF EXISTS product_media_delete_company ON storage.objects;
CREATE POLICY product_media_delete_company
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id='product-media'
  AND (storage.foldername(name))[1] = public.current_empresa_id()::text
  AND NOT EXISTS (
    SELECT 1 FROM public.produtos p
    WHERE p.empresa_id=public.current_empresa_id()
      AND p.deleted_at IS NULL
      AND (
        p.imagem_principal_url LIKE '%' || storage.objects.name
        OR EXISTS (
          SELECT 1 FROM unnest(coalesce(p.galeria_urls,'{}'::text[])) u
          WHERE u LIKE '%' || storage.objects.name
        )
      )
  )
);
