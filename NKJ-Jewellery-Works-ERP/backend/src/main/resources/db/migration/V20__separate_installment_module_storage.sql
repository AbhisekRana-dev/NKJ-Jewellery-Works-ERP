-- V20: physically separate invoice-linked EMI data from the Pre-Booking module.
-- Legacy bookings/installments/installment_payments rows are NOT deleted or detached.
-- A temporary migration-only map copies their EMI history into independent tables
-- and is discarded when this migration commits. No active EMI table references bookings.

CREATE TABLE IF NOT EXISTS public.installment_accounts (
    id BIGSERIAL PRIMARY KEY,
    account_no VARCHAR(100) NOT NULL UNIQUE,
    invoice_id BIGINT REFERENCES public.invoices(id) ON DELETE RESTRICT,
    invoice_no VARCHAR(100),
    customer_name VARCHAR(180) NOT NULL,
    mobile VARCHAR(30),
    customer_address TEXT,
    original_invoice_amount NUMERIC(16,2) NOT NULL DEFAULT 0,
    down_payment NUMERIC(16,2) NOT NULL DEFAULT 0,
    down_payment_date DATE,
    down_payment_method VARCHAR(40),
    down_payment_reference_no VARCHAR(100),
    down_payment_recorded_by VARCHAR(100),
    remaining_balance NUMERIC(16,2) NOT NULL DEFAULT 0,
    total_installments INTEGER NOT NULL DEFAULT 0,
    payment_frequency VARCHAR(20) NOT NULL DEFAULT 'MONTHLY',
    plan_idempotency_key VARCHAR(120),
    plan_request_json TEXT,
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
    installment_no INTEGER NOT NULL,
    due_date DATE,
    amount_due NUMERIC(16,2) NOT NULL DEFAULT 0,
    amount_paid NUMERIC(16,2) NOT NULL DEFAULT 0,
    remaining_amount NUMERIC(16,2) NOT NULL DEFAULT 0,
    payment_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_installment_schedules_account_no UNIQUE(account_id, installment_no)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_installment_schedules_id_account
    ON public.installment_schedules(id, account_id);

CREATE INDEX IF NOT EXISTS idx_installment_schedules_due
    ON public.installment_schedules(due_date, account_id, installment_no);

CREATE TABLE IF NOT EXISTS public.installment_transactions (
    id BIGSERIAL PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES public.installment_accounts(id) ON DELETE RESTRICT,
    schedule_id BIGINT,
    entry_type VARCHAR(30) NOT NULL,
    payment_date DATE NOT NULL,
    amount NUMERIC(16,2) NOT NULL DEFAULT 0,
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
        ),
    CONSTRAINT fk_installment_transactions_schedule_account
        FOREIGN KEY (schedule_id, account_id)
        REFERENCES public.installment_schedules(id, account_id)
        ON DELETE RESTRICT
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

-- Copy legacy invoice-to-installment accounts. Ordinary pre-bookings with
-- schedules but no invoice conversion are deliberately left in the legacy
-- booking tables and are not imported into Installment Management.
INSERT INTO public.installment_accounts (
    account_no, invoice_id, invoice_no, customer_name, mobile, customer_address,
    original_invoice_amount, down_payment, down_payment_date, down_payment_method,
    down_payment_reference_no, down_payment_recorded_by, remaining_balance,
    total_installments, payment_frequency, plan_idempotency_key, plan_request_json,
    status, plan_created_date, converted_at, created_at, updated_at
)
SELECT COALESCE(NULLIF(BTRIM(b.booking_no), ''), 'LEGACY-EMI-' || b.id::TEXT),
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
       );

-- Temporary bridge used only inside this one migration. It is not persisted as
-- a relationship and is automatically dropped at transaction commit.
CREATE TEMPORARY TABLE installment_legacy_account_map (
    legacy_booking_id BIGINT PRIMARY KEY,
    account_id BIGINT NOT NULL UNIQUE
) ON COMMIT DROP;

INSERT INTO installment_legacy_account_map(legacy_booking_id, account_id)
SELECT b.id, a.id
  FROM public.bookings b
  JOIN public.installment_accounts a
    ON a.account_no = COALESCE(NULLIF(BTRIM(b.booking_no), ''), 'LEGACY-EMI-' || b.id::TEXT)
 WHERE b.is_installment_plan IS TRUE
    OR (
         EXISTS (SELECT 1 FROM public.installments s WHERE s.booking_id = b.id)
         AND (
              b.invoice_id IS NOT NULL
              OR EXISTS (SELECT 1 FROM public.invoices by_number WHERE by_number.invoice_no = b.invoice_no)
         )
       );

-- Mark only historical EMI-shaped booking rows as legacy so the Pre-Booking
-- endpoint does not expose those old artifact rows after the split.
UPDATE public.bookings b
   SET is_installment_plan = TRUE
 WHERE EXISTS (
       SELECT 1 FROM installment_legacy_account_map m
        WHERE m.legacy_booking_id = b.id
 );

-- Copy the old schedule IDs unchanged. The old table remains untouched as
-- historical compatibility data; active EMI operations use only the new table.
INSERT INTO public.installment_schedules (
    id, account_id, installment_no, due_date, amount_due, amount_paid,
    remaining_amount, payment_status, created_at, updated_at
)
SELECT old_i.id, m.account_id, old_i.installment_no, old_i.due_date,
       old_i.amount_due, old_i.amount_paid, old_i.remaining_amount,
       old_i.payment_status, old_i.created_at, old_i.updated_at
  FROM public.installments old_i
  JOIN installment_legacy_account_map m ON m.legacy_booking_id = old_i.booking_id
ON CONFLICT (id) DO NOTHING;

-- Copy EMI payment transactions with their original transaction IDs,
-- idempotency keys, dates, methods and references.
INSERT INTO public.installment_transactions (
    id, account_id, schedule_id, entry_type, payment_date, amount,
    payment_method, reference_no, idempotency_key, recorded_by, created_at
)
SELECT old_p.id,
       m.account_id,
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
  JOIN installment_legacy_account_map m
    ON m.legacy_booking_id = COALESCE(old_p.booking_id, old_i.booking_id)
 WHERE COALESCE(old_p.entry_type, 'INSTALLMENT')
       IN ('INSTALLMENT','DOWN_PAYMENT','LEGACY_RECONCILIATION')
ON CONFLICT (id) DO NOTHING;

-- Preserve reversal history in a ledger that references the new EMI ledger.
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

-- Realign identity sequences after copying legacy IDs. Use is_called=false for
-- empty tables so their first generated key remains 1.
SELECT setval(
    pg_get_serial_sequence('public.installment_accounts','id'),
    GREATEST(COALESCE((SELECT MAX(id) FROM public.installment_accounts), 1), 1),
    EXISTS (SELECT 1 FROM public.installment_accounts)
);
SELECT setval(
    pg_get_serial_sequence('public.installment_schedules','id'),
    GREATEST(COALESCE((SELECT MAX(id) FROM public.installment_schedules), 1), 1),
    EXISTS (SELECT 1 FROM public.installment_schedules)
);
SELECT setval(
    pg_get_serial_sequence('public.installment_transactions','id'),
    GREATEST(COALESCE((SELECT MAX(id) FROM public.installment_transactions), 1), 1),
    EXISTS (SELECT 1 FROM public.installment_transactions)
);
SELECT setval(
    pg_get_serial_sequence('public.installment_transaction_reversals','id'),
    GREATEST(COALESCE((SELECT MAX(id) FROM public.installment_transaction_reversals), 1), 1),
    EXISTS (SELECT 1 FROM public.installment_transaction_reversals)
);
