-- V38: reconcile image_status with actual owner-uploaded image references.
-- The initial V25 table did not include display_url, although the current image
-- storage/controller code requires it. Add it before any query below references it.
ALTER TABLE public.jewellery_design_images
    ADD COLUMN IF NOT EXISTS display_url VARCHAR(500);

UPDATE public.jewellery_design_images
   SET display_url = COALESCE(NULLIF(BTRIM(display_url), ''), original_url)
 WHERE display_url IS NULL OR BTRIM(display_url) = '';

ALTER TABLE public.jewellery_design_images
    ALTER COLUMN display_url SET NOT NULL;

-- Older upload code inserted image rows but did not set image_status='READY'.
-- The catalogue intentionally hides image URLs unless that status is READY.
-- This migration repairs existing owner-uploaded designs without deleting or
-- changing any image file, image row, design ID, or owner-entered design data.

UPDATE public.jewellery_designs d
   SET image_status = CASE WHEN EXISTS (
       SELECT 1
         FROM public.jewellery_design_images i
        WHERE i.design_id = d.id
          AND (
              i.original_url LIKE '/api/uploads/designs/%'
              OR i.display_url LIKE '/api/uploads/designs/%'
              OR i.thumbnail_url LIKE '/api/uploads/designs/%'
          )
   ) THEN 'READY' ELSE 'PENDING' END,
       updated_at = NOW()
 WHERE d.is_deleted = FALSE;
