-- V44: bind a one-time mobile photo upload session to an existing design.
-- NULL preserves the original QR workflow that creates a new catalogue entry.
ALTER TABLE public.jewellery_design_upload_sessions
    ADD COLUMN IF NOT EXISTS target_design_id BIGINT
        REFERENCES public.jewellery_designs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_jewellery_design_upload_sessions_target_design
    ON public.jewellery_design_upload_sessions(target_design_id)
    WHERE target_design_id IS NOT NULL;
