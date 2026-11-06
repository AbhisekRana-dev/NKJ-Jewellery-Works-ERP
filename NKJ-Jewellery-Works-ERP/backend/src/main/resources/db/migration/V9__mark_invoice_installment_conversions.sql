-- V9: explicitly identify invoice-to-installment conversions.
-- Legacy conversions are reconstructed from the existing invoice link and
-- saved schedule rows. No invoice, booking, schedule, or payment history is deleted.

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS is_installment_plan BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.bookings b
SET is_installment_plan = TRUE
WHERE b.invoice_no IS NOT NULL
  AND EXISTS (
      SELECT 1
      FROM public.installments i
      WHERE i.booking_id = b.id
  );

CREATE INDEX IF NOT EXISTS idx_bookings_installment_plan_date
    ON public.bookings (booking_date, invoice_no)
    WHERE is_installment_plan = TRUE;
