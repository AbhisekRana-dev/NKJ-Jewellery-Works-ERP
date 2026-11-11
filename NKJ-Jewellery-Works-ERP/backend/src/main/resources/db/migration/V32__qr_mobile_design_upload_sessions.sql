-- V32: one-time QR sessions for mobile jewellery design creation.
-- The QR contains only a random short-lived capability; only its SHA-256 hash
-- is stored here. A session may create at most one design.
ALTER TABLE public.jewellery_designs
    ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(150);

ALTER TABLE public.jewellery_design_images
    ADD COLUMN IF NOT EXISTS display_url VARCHAR(500);

-- Existing photographs remain valid and continue to resolve at their original URL.
UPDATE public.jewellery_design_images
   SET display_url = original_url
 WHERE display_url IS NULL OR BTRIM(display_url) = '';

CREATE INDEX IF NOT EXISTS idx_jewellery_designs_not_deleted
    ON public.jewellery_designs(category_id, is_deleted, is_active, created_at DESC);

CREATE TABLE IF NOT EXISTS public.jewellery_design_upload_sessions (
    session_id UUID PRIMARY KEY,
    token_hash CHAR(64) NOT NULL UNIQUE,
    created_by VARCHAR(150) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    uploaded_design_id BIGINT REFERENCES public.jewellery_designs(id) ON DELETE SET NULL,
    created_ip VARCHAR(80),
    uploaded_ip VARCHAR(80),
    CONSTRAINT chk_jewellery_upload_session_expiry CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_jewellery_design_upload_sessions_owner
    ON public.jewellery_design_upload_sessions(created_by, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_jewellery_design_upload_sessions_expiry
    ON public.jewellery_design_upload_sessions(expires_at)
    WHERE consumed_at IS NULL AND revoked_at IS NULL;
