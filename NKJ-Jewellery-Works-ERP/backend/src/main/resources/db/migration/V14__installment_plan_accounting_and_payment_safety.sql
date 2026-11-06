-- V14: complete invoice-linked installment plan, idempotent payment and reversal support.
-- Existing booking, installment and payment records are retained.

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS invoice_id BIGINT REFERENCES public.invoices(id),
    ADD COLUMN IF NOT EXISTS is_installment_plan BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS total_installments INTEGER,
    ADD COLUMN IF NOT EXISTS payment_frequency VARCHAR(20) NOT NULL DEFAULT 'MONTHLY',
    ADD COLUMN IF NOT EXISTS down_payment_date DATE,
    ADD COLUMN IF NOT EXISTS plan_idempotency_key VARCHAR(120),
    ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;

-- Re-link legacy invoice bookings using the invoice number already stored by the old workflow.
UPDATE public.bookings b
   SET invoice_id = i.id
  FROM public.invoices i
 WHERE b.invoice_id IS NULL
   AND b.invoice_no IS NOT NULL
   AND b.invoice_no = i.invoice_no;

-- Reconstruct legacy installment conversions without changing their existing schedules.
UPDATE public.bookings b
   SET is_installment_plan = TRUE,
       total_installments = COALESCE(
           (SELECT COUNT(*)::INTEGER FROM public.installments s WHERE s.booking_id = b.id),
           0
       ),
       down_payment_date = COALESCE(b.down_payment_date, b.booking_date),
       converted_at = COALESCE(b.converted_at, b.created_at)
 WHERE b.invoice_id IS NOT NULL
   AND EXISTS (SELECT 1 FROM public.installments s WHERE s.booking_id = b.id);

UPDATE public.bookings
   SET down_payment_date = COALESCE(down_payment_date, booking_date)
 WHERE down_payment_date IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_bookings_installment_invoice_id
    ON public.bookings(invoice_id)
 WHERE is_installment_plan = TRUE AND invoice_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_bookings_plan_idempotency_key
    ON public.bookings(plan_idempotency_key)
 WHERE plan_idempotency_key IS NOT NULL;

ALTER TABLE public.installments
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.installment_payments
    ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(120),
    ADD COLUMN IF NOT EXISTS recorded_by VARCHAR(100);

CREATE UNIQUE INDEX IF NOT EXISTS uq_installment_payments_idempotency_key
    ON public.installment_payments(idempotency_key)
 WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_installment_payments_payment_date
    ON public.installment_payments(payment_date);

CREATE INDEX IF NOT EXISTS idx_installments_booking_due
    ON public.installments(booking_id, due_date, installment_no);

-- Posted payments remain immutable. A correction is represented by a separate,
-- one-time reversal row and the original receipt remains available for audit.
CREATE TABLE IF NOT EXISTS public.installment_payment_reversals (
    id BIGSERIAL PRIMARY KEY,
    payment_id BIGINT NOT NULL REFERENCES public.installment_payments(id) ON DELETE RESTRICT,
    reversal_date DATE NOT NULL,
    amount NUMERIC(16,2) NOT NULL CHECK (amount > 0),
    reason TEXT NOT NULL,
    idempotency_key VARCHAR(120),
    recorded_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_installment_payment_reversal_payment UNIQUE(payment_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_installment_payment_reversal_idempotency
    ON public.installment_payment_reversals(idempotency_key)
 WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_installment_payment_reversals_date
    ON public.installment_payment_reversals(reversal_date);

-- Older deployments may have schedule-level amount_paid values without a
-- matching transaction row. Preserve the amount as a clearly-labelled legacy
-- receipt; the reference makes the reconstructed nature explicit.
WITH paid_rows AS (
    SELECT i.id AS installment_id,
           i.amount_paid,
           COALESCE(SUM(p.amount), 0) AS transaction_total,
           b.booking_date
      FROM public.installments i
      JOIN public.bookings b ON b.id = i.booking_id
      LEFT JOIN public.installment_payments p ON p.installment_id = i.id
     GROUP BY i.id, i.amount_paid, b.booking_date
)
INSERT INTO public.installment_payments(
    installment_id, payment_date, amount, payment_method, reference_no, recorded_by
)
SELECT installment_id,
       COALESCE(booking_date, CURRENT_DATE),
       amount_paid - transaction_total,
       'Cash',
       'LEGACY BALANCE MIGRATION - ORIGINAL PAYMENT DATE NOT RETAINED',
       'SYSTEM MIGRATION'
  FROM paid_rows
 WHERE amount_paid > transaction_total;

-- Reconcile cached balances from immutable transactions, while preserving the
-- previous aggregate as a migrated receipt when the transaction list was incomplete.
UPDATE public.installments i
   SET amount_paid = COALESCE((
           SELECT SUM(p.amount) - COALESCE((
               SELECT SUM(r.amount)
                 FROM public.installment_payment_reversals r
                 JOIN public.installment_payments rp ON rp.id = r.payment_id
                WHERE rp.installment_id = i.id
           ), 0)
             FROM public.installment_payments p
            WHERE p.installment_id = i.id
       ), 0),
       remaining_amount = GREATEST(i.amount_due - COALESCE((
           SELECT SUM(p.amount) - COALESCE((
               SELECT SUM(r.amount)
                 FROM public.installment_payment_reversals r
                 JOIN public.installment_payments rp ON rp.id = r.payment_id
                WHERE rp.installment_id = i.id
           ), 0)
             FROM public.installment_payments p
            WHERE p.installment_id = i.id
       ), 0), 0),
       updated_at = NOW();

UPDATE public.installments i
   SET payment_status = CASE
       WHEN i.remaining_amount <= 0 THEN 'PAID'
       WHEN i.amount_paid > 0 AND i.due_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE THEN 'OVERDUE'
       WHEN i.amount_paid > 0 THEN 'PARTIAL'
       WHEN i.due_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE THEN 'OVERDUE'
       ELSE 'PENDING'
   END;

UPDATE public.bookings b
   SET remaining_amount = COALESCE((
           SELECT SUM(i.remaining_amount) FROM public.installments i WHERE i.booking_id = b.id
       ), 0),
       updated_at = NOW()
 WHERE b.is_installment_plan = TRUE;
