-- Keep the existing invoice-delete endpoint working when an invoice has an initial payment.
-- Payment rows are part of the invoice transaction and should not block removal of that invoice.
DO $$
DECLARE
    payment_invoice_fk RECORD;
BEGIN
    FOR payment_invoice_fk IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.payments'::regclass
          AND confrelid = 'public.invoices'::regclass
          AND contype = 'f'
    LOOP
        EXECUTE format('ALTER TABLE public.payments DROP CONSTRAINT %I', payment_invoice_fk.conname);
    END LOOP;
END $$;

ALTER TABLE public.payments
    ADD CONSTRAINT fk_payments_invoice_id
    FOREIGN KEY (invoice_id)
    REFERENCES public.invoices(id)
    ON DELETE CASCADE;
