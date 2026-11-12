-- V40: reconcile image_status with actual owner-uploaded image references.
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
