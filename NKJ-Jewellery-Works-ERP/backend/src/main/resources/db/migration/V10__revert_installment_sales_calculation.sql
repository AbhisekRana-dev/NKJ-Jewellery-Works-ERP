-- V10: revert the experimental installment-sales reporting changes from V8/V9.
-- Keep V8 and V9 migration files intact for Flyway checksum/history validation.
-- Only remove columns and indexes introduced solely for the reverted feature.
-- Existing invoice, booking, installment, and payment records are preserved.

DROP INDEX IF EXISTS public.uq_installment_payments_idempotency_key;
DROP INDEX IF EXISTS public.idx_bookings_booking_date_invoice;
DROP INDEX IF EXISTS public.idx_installment_payments_payment_date;
DROP INDEX IF EXISTS public.idx_bookings_installment_plan_date;

ALTER TABLE public.installment_payments
    DROP COLUMN IF EXISTS idempotency_key;

ALTER TABLE public.bookings
    DROP COLUMN IF EXISTS is_installment_plan;
