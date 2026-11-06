-- V15: retain the original idempotent plan request and identify the down-payment recorder.
ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS plan_request_json TEXT,
    ADD COLUMN IF NOT EXISTS down_payment_recorded_by VARCHAR(100);

UPDATE public.bookings
   SET down_payment_recorded_by = COALESCE(down_payment_recorded_by, 'SYSTEM MIGRATION')
 WHERE is_installment_plan = TRUE
   AND advance_amount > 0
   AND down_payment_recorded_by IS NULL;
