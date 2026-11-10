-- V21: move genuine Pre-Booking data into its own storage and retire the
-- old shared booking/installment tables from all active application workflows.
--
-- V20 has already copied invoice-linked legacy EMI accounts, schedules,
-- payments and reversals into the independent installment_* tables.
-- This migration preserves every old row by renaming the old tables to
-- legacy_* archives; it does not delete or detach any historical row.

CREATE TABLE public.pre_booking_bills (
    id BIGSERIAL PRIMARY KEY,
    booking_no VARCHAR(100) NOT NULL UNIQUE,
    customer_id BIGINT REFERENCES public.customers(id),
    customer_name VARCHAR(180) NOT NULL,
    mobile VARCHAR(30),
    booking_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    metal_type VARCHAR(30),
    purity VARCHAR(30),
    estimated_weight NUMERIC(14,3) NOT NULL DEFAULT 0,
    estimated_rate NUMERIC(16,2) NOT NULL DEFAULT 0,
    estimated_value NUMERIC(16,2) NOT NULL DEFAULT 0,
    making_estimate NUMERIC(16,2) NOT NULL DEFAULT 0,
    advance_amount NUMERIC(16,2) NOT NULL DEFAULT 0,
    remaining_amount NUMERIC(16,2) NOT NULL DEFAULT 0,
    delivery_date DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    invoice_no VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_pre_booking_bills_invoice_no_nonnull
    ON public.pre_booking_bills(invoice_no)
    WHERE invoice_no IS NOT NULL;
CREATE INDEX idx_pre_booking_bills_delivery_date
    ON public.pre_booking_bills(delivery_date);
CREATE INDEX idx_pre_booking_bills_customer_id
    ON public.pre_booking_bills(customer_id);
CREATE INDEX idx_pre_booking_bills_date_id
    ON public.pre_booking_bills(booking_date DESC, id DESC);

-- Only rows left after V20's EMI migration are genuine Pre-Bookings.
-- EMI-specific columns such as is_installment_plan, plan keys, down-payment
-- metadata and invoice_id are intentionally not copied into this table.
INSERT INTO public.pre_booking_bills (
    id, booking_no, customer_id, customer_name, mobile, booking_date,
    description, metal_type, purity, estimated_weight, estimated_rate,
    estimated_value, making_estimate, advance_amount, remaining_amount,
    delivery_date, status, invoice_no, created_at, updated_at
)
SELECT b.id, b.booking_no, b.customer_id, b.customer_name, b.mobile,
       b.booking_date, b.description, b.metal_type, b.purity,
       b.estimated_weight, b.estimated_rate, b.estimated_value,
       b.making_estimate, b.advance_amount, b.remaining_amount,
       b.delivery_date, b.status, b.invoice_no, b.created_at, b.updated_at
  FROM public.bookings b
 WHERE b.is_installment_plan IS NOT TRUE
ON CONFLICT (id) DO NOTHING;

-- The old booking_items table is preserved as a legacy archive. Genuine
-- Pre-Booking line items are copied to a dedicated table with the same IDs.
CREATE TABLE public.pre_booking_items (
    id BIGSERIAL PRIMARY KEY,
    pre_booking_id BIGINT NOT NULL
        REFERENCES public.pre_booking_bills(id) ON DELETE CASCADE,
    description TEXT,
    metal_type VARCHAR(30),
    purity VARCHAR(30),
    estimated_weight NUMERIC(14,3) DEFAULT 0,
    estimated_rate NUMERIC(16,2) DEFAULT 0,
    estimated_value NUMERIC(16,2) DEFAULT 0
);

INSERT INTO public.pre_booking_items (
    id, pre_booking_id, description, metal_type, purity,
    estimated_weight, estimated_rate, estimated_value
)
SELECT bi.id, bi.booking_id, bi.description, bi.metal_type, bi.purity,
       bi.estimated_weight, bi.estimated_rate, bi.estimated_value
  FROM public.booking_items bi
  JOIN public.pre_booking_bills pb ON pb.id=bi.booking_id
ON CONFLICT (id) DO NOTHING;

SELECT setval(
    pg_get_serial_sequence('public.pre_booking_bills','id'),
    GREATEST(COALESCE((SELECT MAX(id) FROM public.pre_booking_bills), 1), 1),
    EXISTS (SELECT 1 FROM public.pre_booking_bills)
);
SELECT setval(
    pg_get_serial_sequence('public.pre_booking_items','id'),
    GREATEST(COALESCE((SELECT MAX(id) FROM public.pre_booking_items), 1), 1),
    EXISTS (SELECT 1 FROM public.pre_booking_items)
);

-- Keep every old row and its historical foreign keys, but remove the shared
-- table names from the active application schema. PostgreSQL automatically
-- rewrites the archived tables' internal foreign-key targets on rename.
ALTER TABLE public.booking_items RENAME TO legacy_booking_items;
ALTER TABLE public.installment_payment_reversals RENAME TO legacy_installment_payment_reversals;
ALTER TABLE public.installment_payments RENAME TO legacy_installment_payments;
ALTER TABLE public.installments RENAME TO legacy_installments;
ALTER TABLE public.bookings RENAME TO legacy_booking_records;

-- Record archive counts for a verifiable deployment/audit trail.
CREATE TABLE public.module_separation_migration_audit (
    migration_version VARCHAR(20) PRIMARY KEY,
    pre_booking_rows_migrated BIGINT NOT NULL,
    pre_booking_items_migrated BIGINT NOT NULL,
    legacy_booking_rows_archived BIGINT NOT NULL,
    legacy_schedule_rows_archived BIGINT NOT NULL,
    legacy_payment_rows_archived BIGINT NOT NULL,
    legacy_reversal_rows_archived BIGINT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.module_separation_migration_audit (
    migration_version, pre_booking_rows_migrated, pre_booking_items_migrated,
    legacy_booking_rows_archived, legacy_schedule_rows_archived,
    legacy_payment_rows_archived, legacy_reversal_rows_archived
)
SELECT
    '21',
    (SELECT COUNT(*) FROM public.pre_booking_bills),
    (SELECT COUNT(*) FROM public.pre_booking_items),
    (SELECT COUNT(*) FROM public.legacy_booking_records),
    (SELECT COUNT(*) FROM public.legacy_installments),
    (SELECT COUNT(*) FROM public.legacy_installment_payments),
    (SELECT COUNT(*) FROM public.legacy_installment_payment_reversals);
