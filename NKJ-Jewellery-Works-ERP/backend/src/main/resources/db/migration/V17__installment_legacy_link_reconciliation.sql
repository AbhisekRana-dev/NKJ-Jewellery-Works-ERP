-- V17: reconcile legacy installment plans linked by invoice ID or invoice number.
-- No invoices, schedules, bookings or receipts are deleted.

UPDATE public.bookings b
   SET invoice_id = COALESCE(b.invoice_id, (
           SELECT i.id FROM public.invoices i
            WHERE i.invoice_no = b.invoice_no
            LIMIT 1
       )),
       is_installment_plan = TRUE,
       total_installments = GREATEST(
           COALESCE(b.total_installments, 0),
           (SELECT COUNT(*)::INTEGER FROM public.installments s WHERE s.booking_id = b.id)
       ),
       down_payment_date = COALESCE(b.down_payment_date, b.booking_date),
       converted_at = COALESCE(b.converted_at, b.created_at)
 WHERE EXISTS (SELECT 1 FROM public.installments s WHERE s.booking_id = b.id)
   AND (
       b.invoice_id IS NOT NULL
       OR EXISTS (
           SELECT 1 FROM public.invoices i
            WHERE i.invoice_no = b.invoice_no
       )
       OR b.is_installment_plan = TRUE
   );

-- Restore the account's balance from the remaining schedule rows.
UPDATE public.bookings b
   SET remaining_amount = COALESCE((
           SELECT SUM(s.remaining_amount)
             FROM public.installments s
            WHERE s.booking_id = b.id
       ), 0),
       updated_at = NOW()
 WHERE b.is_installment_plan = TRUE;

-- Ensure each legacy down payment is represented once in the immutable receipt ledger.
INSERT INTO public.installment_payments(
    installment_id, booking_id, entry_type, payment_date, amount,
    payment_method, reference_no, recorded_by, idempotency_key
)
SELECT NULL, b.id, 'DOWN_PAYMENT',
       COALESCE(b.down_payment_date, b.booking_date),
       b.advance_amount,
       COALESCE(NULLIF(BTRIM(b.down_payment_method), ''), 'Not recorded'),
       COALESCE(NULLIF(BTRIM(b.down_payment_reference_no), ''), 'DOWN PAYMENT'),
       COALESCE(NULLIF(BTRIM(b.down_payment_recorded_by), ''), 'SYSTEM MIGRATION'),
       'LEGACY-DOWNPAY-' || b.id::TEXT
  FROM public.bookings b
 WHERE b.is_installment_plan = TRUE
   AND b.advance_amount > 0
   AND NOT EXISTS (
       SELECT 1
         FROM public.installment_payments p
        WHERE p.booking_id = b.id
          AND p.entry_type = 'DOWN_PAYMENT'
   );

-- Keep a database-level one-plan-per-invoice guarantee for all converted records.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bookings_installment_invoice_id
    ON public.bookings(invoice_id)
 WHERE is_installment_plan = TRUE AND invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_installment_payments_booking_date
    ON public.installment_payments(booking_id, payment_date DESC, id DESC);
