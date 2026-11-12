-- V24: link full-payment invoice saves to the cash-flow ledger and reconcile
-- invoices that were saved before the invoice form sent paymentAmount.
--
-- This ERP invoice form has a payment-mode field but no separate amount-received
-- field. A saved normal invoice is therefore treated as paid in full. Invoices
-- with explicit payment rows are left alone so partial collections are not
-- overstated. Installment-converted invoices are excluded and their old invoice
-- receipts are voided below; the installment down payment is the cash receipt.

-- First remove the original invoice collection from cash flow for invoices
-- already converted to installment plans. The down payment/installment entries
-- remain as the actual receipts for those accounts.
UPDATE public.cash_transactions c
   SET status = 'VOIDED',
       void_reason = 'Original invoice collection reclassified when invoice was converted to an installment plan.',
       voided_by = 'MIGRATION',
       voided_at = NOW()
  FROM public.payments p
  JOIN public.installment_accounts a
    ON a.invoice_id = p.invoice_id
 WHERE c.source_event_key = 'PAYMENT:' || p.id::TEXT
   AND c.status = 'POSTED';

UPDATE public.cash_transactions c
   SET status = 'VOIDED',
       void_reason = 'Original invoice collection reclassified when invoice was converted to an installment plan.',
       voided_by = 'MIGRATION',
       voided_at = NOW()
  FROM public.installment_accounts a
  JOIN public.invoices i
    ON i.id = a.invoice_id
 WHERE c.source_event_key = 'INVOICE-SAVED:' || i.id::TEXT
   AND c.status = 'POSTED';

-- Existing ordinary invoices with no payment rows were treated as full
-- payments at save time by the invoice UI. Use the invoice creation date as the
-- receipt date (not a potentially backdated invoice business date).
INSERT INTO public.cash_transactions (
    transaction_date,
    direction,
    amount,
    source_module,
    source_operation,
    source_record_id,
    source_event_key,
    source_reference,
    party_name,
    description,
    payment_method,
    reference_no,
    created_by
)
SELECT COALESCE(i.created_at::DATE, i.invoice_date, CURRENT_DATE),
       'INCOMING',
       i.grand_total,
       'INVOICE',
       'INITIAL_COLLECTION',
       i.id,
       'INVOICE-SAVED:' || i.id::TEXT,
       i.invoice_no,
       i.customer_name,
       'Invoice collection',
       COALESCE(NULLIF(BTRIM(i.payment_mode), ''), 'Cash'),
       i.reference_no,
       'MIGRATION'
  FROM public.invoices i
 WHERE COALESCE(i.grand_total, 0) > 0
   AND NOT EXISTS (
       SELECT 1
         FROM public.installment_accounts a
        WHERE a.invoice_id = i.id
           OR a.invoice_no = i.invoice_no
   )
   AND NOT EXISTS (
       SELECT 1
         FROM public.payments p
        WHERE p.invoice_id = i.id
          AND p.amount > 0
   )
   AND NOT EXISTS (
       SELECT 1
         FROM public.cash_transactions c
        WHERE c.source_reference = i.invoice_no
          AND c.status = 'POSTED'
   )
ON CONFLICT (source_event_key) DO NOTHING;
