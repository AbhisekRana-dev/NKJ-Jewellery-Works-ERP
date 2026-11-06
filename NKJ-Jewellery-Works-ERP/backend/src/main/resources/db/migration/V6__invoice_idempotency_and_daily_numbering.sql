-- V6: make invoice creation idempotent and install the daily numbering counter.
-- PostgreSQL is the configured database for this project.

CREATE TABLE IF NOT EXISTS public.invoice_daily_sequences (
    invoice_date DATE PRIMARY KEY,
    last_number BIGINT NOT NULL CHECK (last_number >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.invoices
    ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(120);

CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_idempotency_key
    ON public.invoices (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- V1 already declares invoice_no UNIQUE. This guard also covers databases
-- provisioned from an older/manual schema where that constraint may be absent.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.invoices
        GROUP BY invoice_no
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Cannot enforce unique invoice numbers: duplicate invoice_no values already exist in public.invoices.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'invoices'
          AND indexdef ILIKE 'CREATE UNIQUE INDEX% (invoice_no)'
    ) THEN
        CREATE UNIQUE INDEX uq_invoices_invoice_no ON public.invoices (invoice_no);
    END IF;
END $$;

-- Seed counters from invoices already present, so deploying this migration
-- never restarts a date whose invoices have already been numbered.
WITH numbered_invoices AS (
    SELECT
        TO_DATE(SPLIT_PART(invoice_no, '-', 2), 'DDMMYY') AS invoice_date,
        SPLIT_PART(invoice_no, '-', 3)::BIGINT AS invoice_number
    FROM public.invoices
    WHERE invoice_no ~ '^NKJ-[0-9]{6}-[0-9]{3,}$'
)
INSERT INTO public.invoice_daily_sequences (invoice_date, last_number, updated_at)
SELECT invoice_date, MAX(invoice_number), CURRENT_TIMESTAMP
FROM numbered_invoices
GROUP BY invoice_date
ON CONFLICT (invoice_date)
DO UPDATE SET
    last_number = GREATEST(public.invoice_daily_sequences.last_number, EXCLUDED.last_number),
    updated_at = CURRENT_TIMESTAMP;
