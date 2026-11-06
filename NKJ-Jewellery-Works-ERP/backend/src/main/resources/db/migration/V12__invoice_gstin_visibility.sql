-- V12: persist GSTIN visibility independently for each invoice.
-- Existing invoices retain the previous behavior (GSTIN visible).
ALTER TABLE public.invoices
    ADD COLUMN IF NOT EXISTS show_gstin BOOLEAN NOT NULL DEFAULT TRUE;
