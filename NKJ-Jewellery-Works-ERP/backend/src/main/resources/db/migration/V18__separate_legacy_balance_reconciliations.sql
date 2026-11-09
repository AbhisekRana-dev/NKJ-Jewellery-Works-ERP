-- V18: keep migrated cached payment totals for outstanding-balance integrity,
-- but do not misrepresent them as actual cash/UPI/etc. receipts.
-- They remain in the installment ledger as non-receipt reconciliation entries.

ALTER TABLE public.installment_payments
    DROP CONSTRAINT IF EXISTS ck_installment_payment_entry_relationship;

UPDATE public.installment_payments
   SET entry_type = 'LEGACY_RECONCILIATION',
       payment_method = 'Not recorded',
       reference_no = 'Legacy paid balance; original receipt date/method not recorded'
 WHERE reference_no = 'LEGACY BALANCE MIGRATION - ORIGINAL PAYMENT DATE NOT RETAINED';

ALTER TABLE public.installment_payments
    ADD CONSTRAINT ck_installment_payment_entry_relationship CHECK (
        (entry_type='INSTALLMENT' AND installment_id IS NOT NULL AND booking_id IS NOT NULL)
        OR
        (entry_type='DOWN_PAYMENT' AND installment_id IS NULL AND booking_id IS NOT NULL)
        OR
        (entry_type='LEGACY_RECONCILIATION' AND installment_id IS NOT NULL AND booking_id IS NOT NULL)
    );
