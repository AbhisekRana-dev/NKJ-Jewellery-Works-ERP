-- V8: protect installment conversion/payment posting and support payment-date sales reporting.
-- Existing invoice, booking, installment, and payment rows are retained unchanged.

ALTER TABLE public.installment_payments
    ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(120);

CREATE UNIQUE INDEX IF NOT EXISTS uq_installment_payments_idempotency_key
    ON public.installment_payments (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- A saved invoice can have no more than one installment conversion.
-- V2 already creates this index in standard deployments; keep it guaranteed
-- for databases that were provisioned manually or from an earlier schema.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bookings_invoice_no_nonnull
    ON public.bookings (invoice_no)
    WHERE invoice_no IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_booking_date_invoice
    ON public.bookings (booking_date, invoice_no)
    WHERE invoice_no IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_installment_payments_payment_date
    ON public.installment_payments (payment_date);
