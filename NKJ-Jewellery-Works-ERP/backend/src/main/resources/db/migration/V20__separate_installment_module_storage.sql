-- V20: physically separate invoice-linked EMI data from the Pre-Booking module.
-- The old bookings/installments/installment_payments rows are NOT deleted or
-- detached: they remain as immutable legacy history for compatibility and audit.
-- Active EMI APIs/services move to the new account/schedule/transaction tables.

CREATE TABLE IF NOT EXISTS public.installment_accounts (
    id BIGSERIAL PRIMARY KEY,
    account_no VARCHAR(100) NOT NULL UNIQUE,
    invoice_id BIGINT REFERENCES public.invoices(id) ON DELETE RESTRICT,
    invoice_no VARCHAR(100),
    customer_name VARCHAR(180) NOT NULL,
    mobile VARCHAR(30),
    customer_address TEXT,
    original_invoice_amount NUMERIC(16,2) NOT NULL DEFAULT 0 CHECK (original_invoice_amount >= 0),
    down_payment NUMERIC(16,2) NOT NULL DEFAULT 0 CHECK (down_payment >= 0),
    down_payment_date DATE,
    down_payment_method VARCHAR(40),
    down_payment_reference_no VARCHAR(100),
    down_payment_recorded_by VARCHAR(100),
    remaining_balance NUMERIC(16,2) NOT NULL DEFAULT 0 CHECK (remaining_balance >= 0),
    total_installments INTEGER NOT NULL DEFAULT 0 CHECK (total_installments >= 0),
    payment_frequency VARCHAR(20) NOT NULL DEFAULT 'MONTHLY',
    plan_idempotency_key VARCHAR(120),
    plan_request_json TEXT,
    legacy_booking_id BIGINT UNIQUE,
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    plan_created_date DATE NOT NULL DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE),
    converted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_installment_accounts_invoice_id
    ON public.installment_accounts(invoice_id)
    WHERE invoice_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_installment_accounts_plan_key
    ON public.installment_accounts(plan_idempotency_key)
    WHERE plan_idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_installment_accounts_created
    ON public.installment_accounts(plan_created_date DESC, id DESC);

CREATE TABLE IF NOT EXISTS public.installment_schedules (
    id BIGSERIAL PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES public.installment_accounts(id) ON DELETE RESTRICT,
    installment_no INTEGER NOT NULL CHECK (installment_no > 0),
    due_date DATE,
    amount_due NUMERIC(16,2) NOT NULL CHECK (amount_due > 0),
    amount_paid NUMERIC(16,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
    remaining_amount NUMERIC(16,2) NOT NULL DEFAULT 0 CHECK (remaining_amount >= 0),
    payment_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_installment_schedules_account_no UNIQUE(account_id, installment_no),
    CONSTRAINT ck_installment_schedules_paid_not_over_due CHECK (amount_paid <= amount_due)
);

CREATE INDEX IF NOT EXISTS idx_installment_schedules_due
    ON public.installment_schedules(due_date, account_id, installment_no);

CREATE TABLE IF NOT EXISTS public.installment_transactions (
    id BIGSERIAL PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES public.installment_accounts(id) ON DELETE RESTRICT,
    schedule_id BIGINT REFERENCES public.installment_schedules(id) ON DELETE RESTRICT,
    entry_type VARCHAR(30) NOT NULL,
    payment_date DATE NOT NULL,
    amount NUMERIC(16,2) NOT NULL CHECK (amount >= 0),
    payment_method VARCHAR(40) NOT NULL DEFAULT 'Not recorded',
    reference_no VARCHAR(100),
    idempotency_key VARCHAR(120),
    recorded_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_installment_transactions_entry_type
        CHECK (entry_type IN ('INSTALLMENT','DOWN_PAYMENT','LEGACY_RECONCILIATION')),
    CONSTRAINT ck_installment_transactions_entry_relationship
        CHECK (
            (entry_type = 'INSTALLMENT' AND schedule_id IS NOT NULL)
            OR (entry_type = 'DOWN_PAYMENT' AND schedule_id IS NULL)
            OR (entry_type = 'LEGACY_RECONCILIATION')
        )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_installment_transactions_idempotency
    ON public.installment_transactions(idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_installment_transactions_down_payment
    ON public.installment_transactions(account_id)
    WHERE entry_type = 'DOWN_PAYMENT';

CREATE INDEX IF NOT EXISTS idx_installment_transactions_account_date
    ON public.installment_transactions(account_id, payment_date DESC, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS public.installment_transaction_reversals (
    id BIGSERIAL PRIMARY KEY,
    transaction_id BIGINT NOT NULL REFERENCES public.installment_transactions(id) ON DELETE RESTRICT,
    reversal_date DATE NOT NULL,
    amount NUMERIC(16,2) NOT NULL CHECK (amount > 0),
    reason TEXT NOT NULL,
    idempotency_key VARCHAR(120),
    recorded_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_installment_transaction_reversal UNIQUE(transaction_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_installment_transaction_reversal_key
    ON public.installment_transaction_reversals(idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- Preserve and migrate legacy invoice-to-installment accounts. An invoice link
-- plus existing schedules is sufficient to identify pre-flag legacy conversions.
-- Ordinary pre-bookings with schedules but no invoice conversion are not moved.
INSERT INTO public.installment_accounts (
    id, account_no, invoice_id, invoice_no, customer_name, mobile, customer_address,
    original_invoice_amount, down_payment, down_payment_date, down_payment_method,
    down_payment_reference_no, down_payment_recorded_by, remaining_balance,
    total_installments, payment_frequency, plan_idempotency_key, plan_request_json,
    legacy_booking_id, status, plan_created_date, converted_at, created_at, updated_at
)
SELECT b.id,
       COALESCE(NULLIF(BTRIM(b.booking_no), ''), 'LEGACY-EMI-' || b.id::TEXT),
       COALESCE(b.invoice_id, inv.id),
       COALESCE(NULLIF(BTRIM(b.invoice_no), ''), inv.invoice_no),
       COALESCE(NULLIF(BTRIM(b.customer_name), ''), inv.customer_name, 'Legacy EMI Customer'),
       COALESCE(b.mobile, inv.mobile),
       inv.address,
       COALESCE(inv.grand_total, b.estimated_value + b.making_estimate, 0),
       COALESCE(b.advance_amount, 0),
       COALESCE(b.down_payment_date, b.booking_date),
       b.down_payment_method,
       b.down_payment_reference_no,
       b.down_payment_recorded_by,
       COALESCE(b.remaining_amount, 0),
       GREATEST(COALESCE(b.total_installments, 0),
                (SELECT COUNT(*)::INTEGER FROM public.installments s WHERE s.booking_id = b.id)),
       COALESCE(NULLIF(BTRIM(b.payment_frequency), ''), 'MONTHLY'),
       b.plan_idempotency_key,
       b.plan_request_json,
       b.id,
       COALESCE(b.status, 'OPEN'),
       COALESCE(b.booking_date, (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE),
       COALESCE(b.converted_at, b.created_at),
       COALESCE(b.created_at, NOW()),
       COALESCE(b.updated_at, NOW())
  FROM public.bookings b
  LEFT JOIN public.invoices inv
    ON inv.id = COALESCE(
         b.invoice_id,
         (SELECT by_number.id FROM public.invoices by_number
           WHERE by_number.invoice_no = b.invoice_no
           LIMIT 1)
       )
 WHERE b.is_installment_plan IS TRUE
    OR (
         EXISTS (SELECT 1 FROM public.installments s WHERE s.booking_id = b.id)
         AND (
              b.invoice_id IS NOT NULL
              OR EXISTS (SELECT 1 FROM public.invoices by_number WHERE by_number.invoice_no = b.invoice_no)
         )
       )
ON CONFLICT (id) DO NOTHING;

-- Mark rows copied from the legacy EMI workflow, so they remain protected from
-- generic Pre-Booking edits/deletes. The active Pre-Booking list uses the new
-- installment_accounts.legacy_booking_id marker, not the old schedule table.
UPDATE public.bookings b
   SET is_installment_plan = TRUE
 WHERE EXISTS (
       SELECT 1 FROM public.installment_accounts a
        WHERE a.legacy_booking_id = b.id
 );

-- Copy schedule IDs unchanged so old receipt references and audit trails remain
-- traceable. New EMI activity only reads/writes installment_schedules.
INSERT INTO public.installment_schedules (
    id, account_id, installment_no, due_date, amount_due, amount_paid,
    remaining_amount, payment_status, created_at, updated_at
)
SELECT old_i.id, a.id, old_i.installment_no, old_i.due_date,
       old_i.amount_due, old_i.amount_paid, old_i.remaining_amount,
       old_i.payment_status, old_i.created_at, old_i.updated_at
  FROM public.installments old_i
  JOIN public.installment_accounts a ON a.legacy_booking_id = old_i.booking_id
ON CONFLICT (id) DO NOTHING;

-- Copy only transactions belonging to the migrated EMI accounts. Keep the
-- original transaction primary keys and idempotency keys.
INSERT INTO public.installment_transactions (
    id, account_id, schedule_id, entry_type, payment_date, amount,
    payment_method, reference_no, idempotency_key, recorded_by, created_at
)
SELECT old_p.id,
       a.id,
       old_p.installment_id,
       COALESCE(old_p.entry_type, 'INSTALLMENT'),
       old_p.payment_date,
       old_p.amount,
       COALESCE(NULLIF(BTRIM(old_p.payment_method), ''), 'Not recorded'),
       old_p.reference_no,
       old_p.idempotency_key,
       old_p.recorded_by,
       COALESCE(old_p.created_at, NOW())
  FROM public.installment_payments old_p
  LEFT JOIN public.installments old_i ON old_i.id = old_p.installment_id
  JOIN public.installment_accounts a
    ON a.legacy_booking_id = COALESCE(old_p.booking_id, old_i.booking_id)
 WHERE COALESCE(old_p.entry_type, 'INSTALLMENT')
       IN ('INSTALLMENT','DOWN_PAYMENT','LEGACY_RECONCILIATION')
ON CONFLICT (id) DO NOTHING;

-- Copy reversals to a ledger that references the new EMI transaction table.
INSERT INTO public.installment_transaction_reversals (
    id, transaction_id, reversal_date, amount, reason,
    idempotency_key, recorded_by, created_at
)
SELECT old_r.id, old_r.payment_id, old_r.reversal_date, old_r.amount,
       old_r.reason, old_r.idempotency_key, old_r.recorded_by,
       COALESCE(old_r.created_at, NOW())
  FROM public.installment_payment_reversals old_r
  JOIN public.installment_transactions p ON p.id = old_r.payment_id
ON CONFLICT (id) DO NOTHING;

-- Realign generated IDs after preserving legacy primary keys.
SELECT setval(
    pg_get_serial_sequence('public.installment_accounts','id'),
    GREATEST(COALESCE((SELECT MAX(id) FROM public.installment_accounts), 1), 1),
    TRUE
);
SELECT setval(
    pg_get_serial_sequence('public.installment_schedules','id'),
    GREATEST(COALESCE((SELECT MAX(id) FROM public.installment_schedules), 1), 1),
    TRUE
);
SELECT setval(
    pg_get_serial_sequence('public.installment_transactions','id'),
    GREATEST(COALESCE((SELECT MAX(id) FROM public.installment_transactions), 1), 1),
    TRUE
);
SELECT setval(
    pg_get_serial_sequence('public.installment_transaction_reversals','id'),
    GREATEST(COALESCE((SELECT MAX(id) FROM public.installment_transaction_reversals), 1), 1),
    TRUE
);
