-- Add business-facing IDs while retaining BIGSERIAL primary keys for safe relational links.
-- These codes are for display/search; staff_id and other foreign keys remain numeric internally.
ALTER TABLE karigars ADD COLUMN IF NOT EXISTS karigar_code VARCHAR(40);
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS supplier_code VARCHAR(40);

UPDATE staff
SET staff_code = 'NKJ-STF-' || LPAD(id::text, 5, '0')
WHERE staff_code IS NULL OR BTRIM(staff_code) = '';

UPDATE customers
SET customer_code = 'NKJ-CUS-' || LPAD(id::text, 6, '0')
WHERE customer_code IS NULL OR BTRIM(customer_code) = '';

UPDATE products
SET item_code = 'NKJ-ITM-' || LPAD(id::text, 6, '0')
WHERE item_code IS NULL OR BTRIM(item_code) = '';

UPDATE karigars
SET karigar_code = 'NKJ-KRG-' || LPAD(id::text, 6, '0')
WHERE karigar_code IS NULL OR BTRIM(karigar_code) = '';

UPDATE suppliers
SET supplier_code = 'NKJ-SUP-' || LPAD(id::text, 6, '0')
WHERE supplier_code IS NULL OR BTRIM(supplier_code) = '';

-- Existing repair numbers are retained. Only blank legacy values are assigned a code.
UPDATE repair_orders
SET order_no = 'NKJ-RPR-LEGACY-' || LPAD(id::text, 6, '0')
WHERE order_no IS NULL OR BTRIM(order_no) = '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_suppliers_supplier_code
    ON suppliers(supplier_code)
    WHERE supplier_code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_karigars_karigar_code
    ON karigars(karigar_code)
    WHERE karigar_code IS NOT NULL;
