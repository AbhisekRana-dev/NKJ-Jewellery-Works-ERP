-- V23: create an append-only cash movement ledger for actual money received/paid.
-- Existing business tables remain the source of truth; this ledger stores source-linked cash events only.

ALTER TABLE public.expenses
    ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(16,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) NOT NULL DEFAULT 'PAID';

-- Prior expense entries were entered as posted shop expenses and had no pending
-- state. Preserve them as paid history; new entries can explicitly remain pending.
UPDATE public.expenses
   SET paid_amount = COALESCE(amount, 0),
       payment_status = 'PAID'
 WHERE paid_amount = 0
   AND COALESCE(amount, 0) > 0
   AND payment_status = 'PAID';

CREATE TABLE IF NOT EXISTS public.cash_transactions (
    id BIGSERIAL PRIMARY KEY,
    transaction_date DATE NOT NULL,
    direction VARCHAR(10) NOT NULL,
    amount NUMERIC(16,2) NOT NULL,
    source_module VARCHAR(40) NOT NULL,
    source_operation VARCHAR(60) NOT NULL,
    source_record_id BIGINT NOT NULL,
    source_event_key VARCHAR(220) NOT NULL,
    source_reference VARCHAR(180),
    party_name VARCHAR(200),
    description TEXT NOT NULL,
    payment_method VARCHAR(40),
    reference_no VARCHAR(120),
    original_transaction_id BIGINT REFERENCES public.cash_transactions(id) ON DELETE RESTRICT,
    idempotency_key VARCHAR(120),
    status VARCHAR(16) NOT NULL DEFAULT 'POSTED',
    void_reason VARCHAR(500),
    voided_by VARCHAR(100),
    voided_at TIMESTAMPTZ,
    created_by VARCHAR(100) NOT NULL DEFAULT 'SYSTEM',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_cash_transactions_direction CHECK (direction IN ('INCOMING','OUTGOING')),
    CONSTRAINT ck_cash_transactions_amount CHECK (amount > 0),
    CONSTRAINT ck_cash_transactions_status CHECK (status IN ('POSTED','VOIDED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_transactions_source_event
    ON public.cash_transactions(source_event_key);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_transactions_idempotency
    ON public.cash_transactions(idempotency_key)
    WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cash_transactions_date
    ON public.cash_transactions(transaction_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_direction_date
    ON public.cash_transactions(direction, transaction_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_source
    ON public.cash_transactions(source_module, source_record_id);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_reference
    ON public.cash_transactions(source_reference);

CREATE TABLE IF NOT EXISTS public.cash_refunds (
    id BIGSERIAL PRIMARY KEY,
    original_transaction_id BIGINT NOT NULL
        REFERENCES public.cash_transactions(id) ON DELETE RESTRICT,
    refund_date DATE NOT NULL,
    amount NUMERIC(16,2) NOT NULL,
    payment_method VARCHAR(40) NOT NULL,
    reference_no VARCHAR(120),
    notes TEXT,
    idempotency_key VARCHAR(120) NOT NULL,
    recorded_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_cash_refunds_amount CHECK (amount > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_refunds_idempotency
    ON public.cash_refunds(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_cash_refunds_original
    ON public.cash_refunds(original_transaction_id, refund_date DESC);

-- Existing invoice collections and customer receipts. Unpaid invoices have no
-- row in payments and therefore do not enter the cash ledger.
INSERT INTO public.cash_transactions (
    transaction_date, direction, amount, source_module, source_operation,
    source_record_id, source_event_key, source_reference, party_name,
    description, payment_method, reference_no, created_by
)
SELECT p.payment_date,
       'INCOMING',
       p.amount,
       CASE WHEN p.invoice_id IS NOT NULL THEN 'INVOICE' ELSE 'PAYMENTS' END,
       CASE WHEN p.invoice_id IS NOT NULL THEN 'INITIAL_COLLECTION' ELSE 'CUSTOMER_RECEIPT' END,
       p.id,
       'PAYMENT:' || p.id::TEXT,
       COALESCE(NULLIF(BTRIM(p.invoice_no), ''), 'PAY-' || p.id::TEXT),
       p.customer_name,
       COALESCE(NULLIF(BTRIM(p.notes), ''),
                CASE WHEN p.invoice_id IS NOT NULL THEN 'Invoice collection' ELSE 'Customer receipt' END),
       p.payment_method,
       p.reference_no,
       'MIGRATION'
  FROM public.payments p
 WHERE p.amount > 0
ON CONFLICT (source_event_key) DO NOTHING;

-- Pre-Booking advances are customer money already received, not the remaining
-- booking value or the estimated value.
INSERT INTO public.cash_transactions (
    transaction_date, direction, amount, source_module, source_operation,
    source_record_id, source_event_key, source_reference, party_name,
    description, created_by
)
SELECT COALESCE(b.booking_date, CURRENT_DATE),
       'INCOMING',
       b.advance_amount,
       'PRE_BOOKINGS',
       'ADVANCE_RECEIPT',
       b.id,
       'PREBOOK-ADVANCE:' || b.id::TEXT,
       b.booking_no,
       b.customer_name,
       'Pre-Booking advance received',
       'MIGRATION'
  FROM public.pre_booking_bills b
 WHERE b.advance_amount > 0
ON CONFLICT (source_event_key) DO NOTHING;

-- Only actual DOWN_PAYMENT and INSTALLMENT receipt entries are cash movements.
-- Reversed receipt rows remain visible but are voided and excluded from totals.
INSERT INTO public.cash_transactions (
    transaction_date, direction, amount, source_module, source_operation,
    source_record_id, source_event_key, source_reference, party_name,
    description, payment_method, reference_no, status, created_by
)
SELECT p.payment_date,
       'INCOMING',
       p.amount,
       'INSTALLMENTS',
       CASE WHEN p.entry_type = 'DOWN_PAYMENT' THEN 'DOWN_PAYMENT' ELSE 'INSTALLMENT_RECEIPT' END,
       p.id,
       'INSTALLMENT:' || p.id::TEXT,
       a.invoice_no,
       a.customer_name,
       CASE WHEN p.entry_type = 'DOWN_PAYMENT' THEN 'Installment plan down payment' ELSE 'Installment receipt' END,
       p.payment_method,
       p.reference_no,
       CASE WHEN r.id IS NULL THEN 'POSTED' ELSE 'VOIDED' END,
       'MIGRATION'
  FROM public.installment_transactions p
  JOIN public.installment_accounts a ON a.id=p.account_id
  LEFT JOIN public.installment_transaction_reversals r ON r.transaction_id=p.id
 WHERE p.entry_type IN ('DOWN_PAYMENT','INSTALLMENT')
   AND p.amount > 0
ON CONFLICT (source_event_key) DO NOTHING;

-- Expense entries created before the paid/pending control existed are treated
-- as paid entries. New pending expenses have paid_amount=0 and create no event.
INSERT INTO public.cash_transactions (
    transaction_date, direction, amount, source_module, source_operation,
    source_record_id, source_event_key, source_reference, party_name,
    description, payment_method, reference_no, created_by
)
SELECT COALESCE(e.expense_date, CURRENT_DATE),
       'OUTGOING',
       e.paid_amount,
       'EXPENSES',
       'EXPENSE_PAYMENT',
       e.id,
       'EXPENSE:' || e.id::TEXT || ':PAID_TO:' || TO_CHAR(e.paid_amount, 'FM999999999999990.00'),
       COALESCE(NULLIF(BTRIM(e.category), ''), 'Expense'),
       NULL,
       COALESCE(NULLIF(BTRIM(e.description), ''), e.category, 'Shop expense'),
       e.payment_method,
       e.reference_no,
       'MIGRATION'
  FROM public.expenses e
 WHERE e.paid_amount > 0
   AND e.payment_status <> 'PENDING'
ON CONFLICT (source_event_key) DO NOTHING;

-- Supplier purchase payments count only the paid amount, never the unpaid
-- purchase total or supplier balance.
INSERT INTO public.cash_transactions (
    transaction_date, direction, amount, source_module, source_operation,
    source_record_id, source_event_key, source_reference, party_name,
    description, created_by
)
SELECT COALESCE(p.purchase_date, CURRENT_DATE),
       'OUTGOING',
       p.paid_amount,
       'PURCHASES',
       'SUPPLIER_PAYMENT',
       p.id,
       'PURCHASE-INITIAL:' || p.id::TEXT,
       COALESCE(NULLIF(BTRIM(p.invoice_no), ''), 'PURCHASE-' || p.id::TEXT),
       p.supplier_name,
       'Supplier purchase payment',
       'MIGRATION'
  FROM public.purchases p
 WHERE p.paid_amount > 0
ON CONFLICT (source_event_key) DO NOTHING;

-- Salary payment rows are individual actual payments.
INSERT INTO public.cash_transactions (
    transaction_date, direction, amount, source_module, source_operation,
    source_record_id, source_event_key, source_reference, party_name,
    description, payment_method, reference_no, created_by
)
SELECT COALESCE(sp.payment_date, CURRENT_DATE),
       'OUTGOING',
       sp.amount,
       'SALARY_PAYMENTS',
       'SALARY_PAYMENT',
       sp.id,
       'SALARY-PAYMENT:' || sp.id::TEXT,
       'SALARY-' || sp.salary_id::TEXT,
       s.full_name,
       'Staff salary payment',
       sp.payment_method,
       sp.reference_no,
       'MIGRATION'
  FROM public.staff_salary_payments sp
  JOIN public.staff_salary ss ON ss.id=sp.salary_id
  JOIN public.staff s ON s.id=ss.staff_id
 WHERE sp.amount > 0
ON CONFLICT (source_event_key) DO NOTHING;

-- staff_salary.amount_paid is cumulative. Subtract the individual payment rows
-- above to avoid counting the same salary money twice.
INSERT INTO public.cash_transactions (
    transaction_date, direction, amount, source_module, source_operation,
    source_record_id, source_event_key, source_reference, party_name,
    description, payment_method, created_by
)
SELECT COALESCE(ss.payment_date, TO_DATE(ss.payroll_month || '-01', 'YYYY-MM-DD')),
       'OUTGOING',
       GREATEST(ss.amount_paid - COALESCE(SUM(sp.amount), 0), 0),
       'SALARY',
       'INITIAL_SALARY_PAYMENT',
       ss.id,
       'SALARY-INITIAL:' || ss.id::TEXT,
       'SALARY-' || ss.id::TEXT,
       s.full_name,
       'Initial salary payment',
       ss.payment_method,
       'MIGRATION'
  FROM public.staff_salary ss
  JOIN public.staff s ON s.id=ss.staff_id
  LEFT JOIN public.staff_salary_payments sp ON sp.salary_id=ss.id
 GROUP BY ss.id, ss.payment_date, ss.payroll_month, ss.amount_paid,
          ss.payment_method, s.full_name
HAVING GREATEST(ss.amount_paid - COALESCE(SUM(sp.amount), 0), 0) > 0
ON CONFLICT (source_event_key) DO NOTHING;

SELECT setval(
    pg_get_serial_sequence('public.cash_transactions','id'),
    GREATEST(COALESCE((SELECT MAX(id) FROM public.cash_transactions), 1), 1),
    EXISTS (SELECT 1 FROM public.cash_transactions)
);
SELECT setval(
    pg_get_serial_sequence('public.cash_refunds','id'),
    GREATEST(COALESCE((SELECT MAX(id) FROM public.cash_refunds), 1), 1),
    EXISTS (SELECT 1 FROM public.cash_refunds)
);
