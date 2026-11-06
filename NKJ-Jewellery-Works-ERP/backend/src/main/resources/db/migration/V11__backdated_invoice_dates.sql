-- V11: separate the invoice's business date from its actual creation timestamp.
-- Existing invoices are backfilled from created_at, preserving their displayed dates.
ALTER TABLE public.invoices
    ADD COLUMN IF NOT EXISTS invoice_date DATE;

UPDATE public.invoices
SET invoice_date = created_at::date
WHERE invoice_date IS NULL;

ALTER TABLE public.invoices
    ALTER COLUMN invoice_date SET DEFAULT CURRENT_DATE;

ALTER TABLE public.invoices
    ALTER COLUMN invoice_date SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date
    ON public.invoices (invoice_date DESC, created_at DESC);

-- Preserve/repair daily counters from already-numbered invoices. This is
-- idempotent and never lowers an existing counter.
INSERT INTO public.invoice_daily_sequences (invoice_date, last_number, updated_at)
SELECT
    invoice_date,
    MAX(SPLIT_PART(invoice_no, '-', 3)::BIGINT),
    CURRENT_TIMESTAMP
FROM public.invoices
WHERE invoice_no ~ '^NKJ-[0-9]{6}-[0-9]{3,}$'
GROUP BY invoice_date
ON CONFLICT (invoice_date)
DO UPDATE SET
    last_number = GREATEST(
        public.invoice_daily_sequences.last_number,
        EXCLUDED.last_number
    ),
    updated_at = CURRENT_TIMESTAMP;
