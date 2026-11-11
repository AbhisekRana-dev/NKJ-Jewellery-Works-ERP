-- V38: reserve category-scoped Design IDs for short-lived mobile QR sessions.
-- Sequence values are allocated by the existing atomic PostgreSQL upsert and are never reused.
ALTER TABLE public.jewellery_design_upload_sessions
    ADD COLUMN IF NOT EXISTS reserved_design_id VARCHAR(180),
    ADD COLUMN IF NOT EXISTS reserved_category_id BIGINT
        REFERENCES public.jewellery_design_categories(id) ON DELETE RESTRICT;

ALTER TABLE public.jewellery_design_upload_sessions
    DROP CONSTRAINT IF EXISTS chk_jewellery_upload_reserved_design_pair;

ALTER TABLE public.jewellery_design_upload_sessions
    ADD CONSTRAINT chk_jewellery_upload_reserved_design_pair
    CHECK ((reserved_design_id IS NULL AND reserved_category_id IS NULL)
        OR (reserved_design_id IS NOT NULL AND reserved_category_id IS NOT NULL));

CREATE INDEX IF NOT EXISTS idx_jewellery_design_upload_reserved_category
    ON public.jewellery_design_upload_sessions(reserved_category_id)
    WHERE reserved_category_id IS NOT NULL;
