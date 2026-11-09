-- V19: preserve legacy booking advances without presenting reconstructed rows
-- as actual payment transactions. The authoritative amount/date remain on bookings.
ALTER TABLE public.installment_payments
    DROP CONSTRAINT IF EXISTS ck_installment_payment_entry_relationship;

UPDATE public.installment_payments
   SET entry_type = 'LEGACY_RECONCILIATION',
       payment_method = 'Not recorded',
       reference_no = 'Legacy down payment; original receipt transaction details not retained'
 WHERE idempotency_key LIKE 'LEGACY-DOWNPAY-%'
   AND entry_type = 'DOWN_PAYMENT';

ALTER TABLE public.installment_payments
    ADD CONSTRAINT ck_installment_payment_entry_relationship CHECK (
        (entry_type='INSTALLMENT' AND installment_id IS NOT NULL AND booking_id IS NOT NULL)
        OR
        (entry_type='DOWN_PAYMENT' AND installment_id IS NULL AND booking_id IS NOT NULL)
        OR
        (entry_type='LEGACY_RECONCILIATION' AND booking_id IS NOT NULL)
    );
