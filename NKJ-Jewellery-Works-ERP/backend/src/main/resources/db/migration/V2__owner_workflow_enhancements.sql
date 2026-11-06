-- V2: additive schema changes only; existing invoice and print fields remain intact.
ALTER TABLE metal_rates ADD COLUMN IF NOT EXISTS gold_24k_rate NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE metal_rates ADD COLUMN IF NOT EXISTS rate_mode VARCHAR(20) NOT NULL DEFAULT 'MANUAL';
ALTER TABLE metal_rates ADD COLUMN IF NOT EXISTS rate_source VARCHAR(160) NOT NULL DEFAULT 'Manual Admin Entry';
ALTER TABLE metal_rates ADD COLUMN IF NOT EXISTS source_reference TEXT;
ALTER TABLE metal_rates ADD COLUMN IF NOT EXISTS source_published_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS metal_rate_history (
  id BIGSERIAL PRIMARY KEY,
  gold_24k_rate NUMERIC(14,2) NOT NULL DEFAULT 0,
  gold_22k_rate NUMERIC(14,2) NOT NULL,
  silver_rate NUMERIC(14,2) NOT NULL,
  rate_mode VARCHAR(20) NOT NULL,
  rate_source VARCHAR(160),
  source_reference TEXT,
  changed_by VARCHAR(100),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_metal_rate_history_changed_at ON metal_rate_history(changed_at DESC);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS invoice_no VARCHAR(100);
CREATE UNIQUE INDEX IF NOT EXISTS uq_bookings_invoice_no_nonnull ON bookings(invoice_no) WHERE invoice_no IS NOT NULL;
ALTER TABLE installment_payments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE staff ADD COLUMN IF NOT EXISTS aadhaar_number VARCHAR(20);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS pan_number VARCHAR(20);
CREATE TABLE IF NOT EXISTS staff_notes (
  id BIGSERIAL PRIMARY KEY,
  staff_id BIGINT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  note_date DATE NOT NULL DEFAULT CURRENT_DATE,
  note_type VARCHAR(60) NOT NULL DEFAULT 'GENERAL',
  description TEXT NOT NULL,
  created_by VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_staff_notes_staff_date ON staff_notes(staff_id, note_date DESC, created_at DESC);

ALTER TABLE karigars ADD COLUMN IF NOT EXISTS aadhaar_number VARCHAR(20);
ALTER TABLE karigars ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE karigars ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE products ADD COLUMN IF NOT EXISTS design_no VARCHAR(80);
ALTER TABLE products ADD COLUMN IF NOT EXISTS hallmark_status VARCHAR(40);
ALTER TABLE products ADD COLUMN IF NOT EXISTS item_type VARCHAR(60);
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(180);
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_invoice_no VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_type VARCHAR(30);
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_mobile VARCHAR(30);
ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_bill TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS reserved_qty NUMERIC(14,3) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS store_location VARCHAR(120);
ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_alert NUMERIC(14,3) NOT NULL DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS photo_url TEXT;
