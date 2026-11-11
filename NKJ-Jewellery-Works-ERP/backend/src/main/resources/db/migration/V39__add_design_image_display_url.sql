-- V39: add the display-image URL used by the HD jewellery image pipeline.
-- V25 originally created original_url and thumbnail_url only, while the
-- upload/replace endpoints and catalogue response now also read/write display_url.
-- Backfill legacy rows from their original URL so existing photographs continue
-- to display without requiring owners to upload them again.

ALTER TABLE public.jewellery_design_images
    ADD COLUMN IF NOT EXISTS display_url VARCHAR(500);

UPDATE public.jewellery_design_images
   SET display_url = COALESCE(NULLIF(BTRIM(display_url), ''), original_url)
 WHERE display_url IS NULL
    OR BTRIM(display_url) = '';

ALTER TABLE public.jewellery_design_images
    ALTER COLUMN display_url SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jewellery_design_images_design_order
    ON public.jewellery_design_images (design_id, display_order, id);
