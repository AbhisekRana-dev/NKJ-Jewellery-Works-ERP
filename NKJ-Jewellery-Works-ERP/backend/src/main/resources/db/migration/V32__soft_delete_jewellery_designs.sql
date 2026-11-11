-- V32: archive designs without destroying catalogue history, image records or generated IDs.
-- The category-scoped design ID counters are deliberately independent of design rows;
-- archiving a design never releases or reuses its identifier.

ALTER TABLE public.jewellery_designs
    ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(150);

CREATE INDEX IF NOT EXISTS idx_jewellery_designs_visible_category
    ON public.jewellery_designs(category_id, is_deleted, is_active, created_at DESC);
