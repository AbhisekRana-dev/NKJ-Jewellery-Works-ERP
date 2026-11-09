-- V16: a real transaction ID for every installment receipt and down payment.
-- The original schedule and booking records are retained. Legacy down payments
-- are copied into the receipt ledger with an explicit "method not recorded" label.

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS down_payment_method VARCHAR(40),
    ADD COLUMN IF NOT EXISTS down_payment_reference_no VARCHAR(100);

ALTER TABLE public.installment_payments
    ALTER COLUMN installment_id DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS booking_id BIGINT REFERENCES public.bookings(id),
    ADD COLUMN IF NOT EXISTS entry_type VARCHAR(30) NOT NULL DEFAULT 'INSTALLMENT';

-- Repair existing invoice-linked installment accounts and their schedule counts.
UPDATE public.bookings b
   SET is_installment_plan = TRUE,
       total_installments = GREATEST(
           COALESCE(b.total_installments, 0),
           (SELECT COUNT(*)::INTEGER FROM public.installments i WHERE i.booking_id=b.id)
       ),
       invoice_id = COALESCE(b.invoice_id, (
           SELECT inv.id FROM public.invoices inv
            WHERE inv.invoice_no=b.invoice_no
            LIMIT 1
       )),
       down_payment_date = COALESCE(b.down_payment_date, b.booking_date)
 WHERE b.invoice_no IS NOT NULL
   AND EXISTS (SELECT 1 FROM public.installments i WHERE i.booking_id=b.id);

-- Attach historical installment transactions to their account.
UPDATE public.installment_payments p
   SET booking_id = i.booking_id,
       entry_type = 'INSTALLMENT'
  FROM public.installments i
 WHERE p.installment_id=i.id
   AND (p.booking_id IS NULL OR p.entry_type IS DISTINCT FROM 'INSTALLMENT');

-- Convert each old booking-level down payment to one real ledger transaction.
-- Do not invent a historic transaction method or reference.
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
 WHERE b.is_installment_plan=TRUE
   AND b.advance_amount>0
   AND NOT EXISTS (
       SELECT 1 FROM public.installment_payments p
        WHERE p.booking_id=b.id AND p.entry_type='DOWN_PAYMENT'
   );

CREATE UNIQUE INDEX IF NOT EXISTS uq_installment_down_payment_booking
    ON public.installment_payments(booking_id)
 WHERE entry_type='DOWN_PAYMENT' AND booking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_installment_payments_booking_date
    ON public.installment_payments(booking_id, payment_date DESC, id DESC);

-- Every installment-type payment is attached to a schedule; every down-payment
-- transaction is attached to a booking and intentionally has no installment row.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname='ck_installment_payment_entry_relationship'
    ) THEN
        ALTER TABLE public.installment_payments
            ADD CONSTRAINT ck_installment_payment_entry_relationship CHECK (
                (entry_type='INSTALLMENT' AND installment_id IS NOT NULL AND booking_id IS NOT NULL)
                OR
                (entry_type='DOWN_PAYMENT' AND installment_id IS NULL AND booking_id IS NOT NULL)
            );
    END IF;
END $$;
