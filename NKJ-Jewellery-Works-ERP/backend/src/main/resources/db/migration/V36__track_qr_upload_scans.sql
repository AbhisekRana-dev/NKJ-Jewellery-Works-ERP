-- V36: distinguish a QR link that has been opened on a phone from one not yet scanned.
-- This is informational only; possession of the hashed, short-lived session token
-- remains the only authority for the single permitted mobile design upload.
ALTER TABLE public.jewellery_design_upload_sessions
    ADD COLUMN IF NOT EXISTS first_scanned_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_jewellery_design_upload_sessions_scanned
    ON public.jewellery_design_upload_sessions(first_scanned_at)
    WHERE first_scanned_at IS NOT NULL;
