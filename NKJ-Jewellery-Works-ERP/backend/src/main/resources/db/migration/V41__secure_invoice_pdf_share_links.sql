-- Store final PDFs generated from saved invoices behind expiring bearer links.
CREATE TABLE IF NOT EXISTS public.invoice_share_files (
    id BIGSERIAL PRIMARY KEY,
    invoice_id BIGINT NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    file_name VARCHAR(180) NOT NULL,
    pdf_bytes BYTEA NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    download_count BIGINT NOT NULL DEFAULT 0,
    last_downloaded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_invoice_share_files_expiry
    ON public.invoice_share_files (expires_at);

CREATE INDEX IF NOT EXISTS idx_invoice_share_files_invoice
    ON public.invoice_share_files (invoice_id, created_at DESC);