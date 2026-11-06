-- NKJ Jewellery ERP core schema. All money/weight values use DECIMAL, never floating point.
CREATE TABLE IF NOT EXISTS roles (
  id BIGSERIAL PRIMARY KEY, role_key VARCHAR(60) NOT NULL UNIQUE, role_name VARCHAR(120) NOT NULL
);
CREATE TABLE IF NOT EXISTS permissions (
  id BIGSERIAL PRIMARY KEY, permission_key VARCHAR(100) NOT NULL UNIQUE, permission_name VARCHAR(150) NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY, username VARCHAR(100) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(200), full_name VARCHAR(150), enabled BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS user_permissions (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE, PRIMARY KEY(user_id, permission_id)
);
CREATE TABLE IF NOT EXISTS authenticator_secrets (
  id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  secret_encrypted TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS recovery_codes (
  id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash VARCHAR(255) NOT NULL, used_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS shop_details (
  id BIGSERIAL PRIMARY KEY, shop_name VARCHAR(200) NOT NULL DEFAULT 'Nandikishor Jewellery Works', owner_name VARCHAR(150),
  phone VARCHAR(50), email VARCHAR(200), address TEXT, gstin VARCHAR(40), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO shop_details(id,shop_name) VALUES(1,'Nandikishor Jewellery Works') ON CONFLICT(id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('shop_details','id')::regclass, GREATEST((SELECT COALESCE(MAX(id),1) FROM shop_details),1), TRUE);
CREATE TABLE IF NOT EXISTS customers (
  id BIGSERIAL PRIMARY KEY, customer_code VARCHAR(40) UNIQUE, name VARCHAR(180) NOT NULL, phone VARCHAR(30), email VARCHAR(200),
  address TEXT, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS suppliers (
  id BIGSERIAL PRIMARY KEY, name VARCHAR(180) NOT NULL, phone VARCHAR(30), email VARCHAR(200), address TEXT, gst_number VARCHAR(40),
  opening_balance NUMERIC(16,2) NOT NULL DEFAULT 0, status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS product_categories (
  id BIGSERIAL PRIMARY KEY, name VARCHAR(120) NOT NULL UNIQUE, description TEXT
);
CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY, item_code VARCHAR(80) UNIQUE, barcode VARCHAR(100) UNIQUE, name VARCHAR(200) NOT NULL,
  category VARCHAR(100), metal_type VARCHAR(30), purity VARCHAR(30), gross_weight NUMERIC(14,3) NOT NULL DEFAULT 0,
  stone_weight NUMERIC(14,3) NOT NULL DEFAULT 0, other_deductions NUMERIC(14,3) NOT NULL DEFAULT 0,
  net_weight NUMERIC(14,3) NOT NULL DEFAULT 0, making_charge NUMERIC(16,2) NOT NULL DEFAULT 0,
  wastage NUMERIC(14,3) NOT NULL DEFAULT 0, huid VARCHAR(30), purchase_date DATE, purchase_price NUMERIC(16,2) NOT NULL DEFAULT 0, stock_quantity NUMERIC(14,3) NOT NULL DEFAULT 1,
  status VARCHAR(30) NOT NULL DEFAULT 'IN_STOCK', supplier_id BIGINT REFERENCES suppliers(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id BIGSERIAL PRIMARY KEY, product_id BIGINT NOT NULL REFERENCES products(id), transaction_type VARCHAR(40) NOT NULL,
  quantity NUMERIC(14,3) NOT NULL DEFAULT 0, weight NUMERIC(14,3) NOT NULL DEFAULT 0, reference_type VARCHAR(50), reference_id BIGINT,
  remarks TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS gold_rates (
  id BIGSERIAL PRIMARY KEY, purity VARCHAR(20) NOT NULL, purchase_rate NUMERIC(16,2) NOT NULL, selling_rate NUMERIC(16,2) NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), reason TEXT
);
CREATE TABLE IF NOT EXISTS silver_rates (
  id BIGSERIAL PRIMARY KEY, purchase_rate NUMERIC(16,2) NOT NULL, selling_rate NUMERIC(16,2) NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), reason TEXT
);
CREATE TABLE IF NOT EXISTS invoices (
  id BIGSERIAL PRIMARY KEY, invoice_no VARCHAR(100) NOT NULL UNIQUE, customer_name VARCHAR(180), mobile VARCHAR(30), address VARCHAR(1000),
  payment_mode VARCHAR(50), reference_no VARCHAR(100), payload_json TEXT,
  new_total NUMERIC(16,2) NOT NULL DEFAULT 0, old_total NUMERIC(16,2) NOT NULL DEFAULT 0,
  making_charge NUMERIC(16,2) NOT NULL DEFAULT 0, extra_charge NUMERIC(16,2) NOT NULL DEFAULT 0,
  discount NUMERIC(16,2) NOT NULL DEFAULT 0, sub_total NUMERIC(16,2) NOT NULL DEFAULT 0,
  gst_percent NUMERIC(7,3) NOT NULL DEFAULT 0, gst_amount NUMERIC(16,2) NOT NULL DEFAULT 0,
  other_charge NUMERIC(16,2) NOT NULL DEFAULT 0, grand_total NUMERIC(16,2) NOT NULL DEFAULT 0,
  customer_id BIGINT REFERENCES customers(id), created_at TIMESTAMP NOT NULL DEFAULT LOCALTIMESTAMP
);
CREATE TABLE IF NOT EXISTS invoice_items (
  id BIGSERIAL PRIMARY KEY, invoice_id BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE, item_type VARCHAR(20) NOT NULL,
  description TEXT, purity VARCHAR(30), gross_weight NUMERIC(14,3) DEFAULT 0, stone_weight NUMERIC(14,3) DEFAULT 0,
  net_weight NUMERIC(14,3) DEFAULT 0, rate NUMERIC(16,2) DEFAULT 0, making_charge NUMERIC(16,2) DEFAULT 0,
  stamp_charge NUMERIC(16,2) DEFAULT 0, extra_charge NUMERIC(16,2) DEFAULT 0, amount NUMERIC(16,2) DEFAULT 0,
  row_snapshot JSONB
);
CREATE TABLE IF NOT EXISTS payments (
  id BIGSERIAL PRIMARY KEY, invoice_id BIGINT REFERENCES invoices(id), invoice_no VARCHAR(100), customer_name VARCHAR(180),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE, amount NUMERIC(16,2) NOT NULL, payment_method VARCHAR(40) NOT NULL,
  reference_no VARCHAR(100), notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS purchases (
  id BIGSERIAL PRIMARY KEY, supplier_id BIGINT REFERENCES suppliers(id), supplier_name VARCHAR(180), purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  invoice_no VARCHAR(100), total_amount NUMERIC(16,2) NOT NULL DEFAULT 0, paid_amount NUMERIC(16,2) NOT NULL DEFAULT 0,
  balance NUMERIC(16,2) NOT NULL DEFAULT 0, status VARCHAR(30) NOT NULL DEFAULT 'PENDING', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS purchase_items (
  id BIGSERIAL PRIMARY KEY, purchase_id BIGINT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE, product_id BIGINT REFERENCES products(id),
  description TEXT, metal_type VARCHAR(30), purity VARCHAR(30), weight NUMERIC(14,3) DEFAULT 0, rate NUMERIC(16,2) DEFAULT 0, amount NUMERIC(16,2) DEFAULT 0
);
CREATE TABLE IF NOT EXISTS old_gold_exchanges (
  id BIGSERIAL PRIMARY KEY, invoice_id BIGINT REFERENCES invoices(id), customer_name VARCHAR(180), description TEXT, purity VARCHAR(30),
  weight NUMERIC(14,3) NOT NULL DEFAULT 0, rate NUMERIC(16,2) NOT NULL DEFAULT 0, amount NUMERIC(16,2) NOT NULL DEFAULT 0,
  exchange_date DATE NOT NULL DEFAULT CURRENT_DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS customer_ledger (
  id BIGSERIAL PRIMARY KEY, customer_id BIGINT REFERENCES customers(id), entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  entry_type VARCHAR(40) NOT NULL, reference_type VARCHAR(40), reference_id BIGINT, debit NUMERIC(16,2) NOT NULL DEFAULT 0,
  credit NUMERIC(16,2) NOT NULL DEFAULT 0, notes TEXT
);
CREATE TABLE IF NOT EXISTS supplier_ledger (
  id BIGSERIAL PRIMARY KEY, supplier_id BIGINT REFERENCES suppliers(id), entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  entry_type VARCHAR(40) NOT NULL, reference_type VARCHAR(40), reference_id BIGINT, debit NUMERIC(16,2) NOT NULL DEFAULT 0,
  credit NUMERIC(16,2) NOT NULL DEFAULT 0, notes TEXT
);
CREATE TABLE IF NOT EXISTS expenses (
  id BIGSERIAL PRIMARY KEY, expense_date DATE NOT NULL DEFAULT CURRENT_DATE, category VARCHAR(100) NOT NULL,
  description TEXT, amount NUMERIC(16,2) NOT NULL CHECK(amount >= 0), payment_method VARCHAR(40) NOT NULL DEFAULT 'Cash',
  reference_no VARCHAR(100), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS bookings (
  id BIGSERIAL PRIMARY KEY, booking_no VARCHAR(100) NOT NULL UNIQUE, customer_id BIGINT REFERENCES customers(id), customer_name VARCHAR(180) NOT NULL,
  mobile VARCHAR(30), booking_date DATE NOT NULL DEFAULT CURRENT_DATE, description TEXT, metal_type VARCHAR(30), purity VARCHAR(30),
  estimated_weight NUMERIC(14,3) NOT NULL DEFAULT 0, estimated_rate NUMERIC(16,2) NOT NULL DEFAULT 0,
  estimated_value NUMERIC(16,2) NOT NULL DEFAULT 0, making_estimate NUMERIC(16,2) NOT NULL DEFAULT 0,
  advance_amount NUMERIC(16,2) NOT NULL DEFAULT 0, remaining_amount NUMERIC(16,2) NOT NULL DEFAULT 0,
  delivery_date DATE, status VARCHAR(30) NOT NULL DEFAULT 'OPEN', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS booking_items (
  id BIGSERIAL PRIMARY KEY, booking_id BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE, description TEXT,
  metal_type VARCHAR(30), purity VARCHAR(30), estimated_weight NUMERIC(14,3) DEFAULT 0, estimated_rate NUMERIC(16,2) DEFAULT 0, estimated_value NUMERIC(16,2) DEFAULT 0
);
CREATE TABLE IF NOT EXISTS installments (
  id BIGSERIAL PRIMARY KEY, booking_id BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE, installment_no INTEGER NOT NULL,
  due_date DATE, amount_due NUMERIC(16,2) NOT NULL DEFAULT 0, amount_paid NUMERIC(16,2) NOT NULL DEFAULT 0,
  remaining_amount NUMERIC(16,2) NOT NULL DEFAULT 0, payment_status VARCHAR(30) NOT NULL DEFAULT 'DUE', UNIQUE(booking_id, installment_no)
);
CREATE TABLE IF NOT EXISTS installment_payments (
  id BIGSERIAL PRIMARY KEY, installment_id BIGINT NOT NULL REFERENCES installments(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE, amount NUMERIC(16,2) NOT NULL, payment_method VARCHAR(40) NOT NULL DEFAULT 'Cash', reference_no VARCHAR(100)
);
CREATE TABLE IF NOT EXISTS hallmark_records (
  id BIGSERIAL PRIMARY KEY, product_id BIGINT REFERENCES products(id), huid VARCHAR(30) NOT NULL, purity VARCHAR(30), hallmark_date DATE,
  verification_status VARCHAR(30) NOT NULL DEFAULT 'PENDING', invoice_id BIGINT REFERENCES invoices(id), notes TEXT
);
CREATE TABLE IF NOT EXISTS staff (
  id BIGSERIAL PRIMARY KEY, staff_code VARCHAR(40) UNIQUE, full_name VARCHAR(180) NOT NULL, photo_url TEXT, mobile VARCHAR(30), email VARCHAR(200),
  address TEXT, dob DATE, joining_date DATE, designation VARCHAR(100), department VARCHAR(100), monthly_salary NUMERIC(16,2) NOT NULL DEFAULT 0,
  salary_method VARCHAR(40) DEFAULT 'Cash', emergency_contact VARCHAR(60), status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS staff_attendance (
  id BIGSERIAL PRIMARY KEY, staff_id BIGINT NOT NULL REFERENCES staff(id), attendance_date DATE NOT NULL,
  status VARCHAR(30) NOT NULL, check_in TIME, check_out TIME, working_hours NUMERIC(6,2) NOT NULL DEFAULT 0, remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(staff_id, attendance_date)
);
CREATE TABLE IF NOT EXISTS staff_leaves (
  id BIGSERIAL PRIMARY KEY, staff_id BIGINT NOT NULL REFERENCES staff(id), from_date DATE NOT NULL, to_date DATE NOT NULL,
  leave_type VARCHAR(30) NOT NULL, reason TEXT, status VARCHAR(30) NOT NULL DEFAULT 'PENDING', approved_by VARCHAR(100), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS staff_salary (
  id BIGSERIAL PRIMARY KEY, staff_id BIGINT NOT NULL REFERENCES staff(id), payroll_month CHAR(7) NOT NULL,
  basic_salary NUMERIC(16,2) NOT NULL DEFAULT 0, allowances NUMERIC(16,2) NOT NULL DEFAULT 0, overtime NUMERIC(16,2) NOT NULL DEFAULT 0,
  bonus NUMERIC(16,2) NOT NULL DEFAULT 0, deductions NUMERIC(16,2) NOT NULL DEFAULT 0, advance_salary NUMERIC(16,2) NOT NULL DEFAULT 0,
  absent_deduction NUMERIC(16,2) NOT NULL DEFAULT 0, net_salary NUMERIC(16,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(16,2) NOT NULL DEFAULT 0, remaining_salary NUMERIC(16,2) NOT NULL DEFAULT 0,
  payment_date DATE, payment_method VARCHAR(40), payment_status VARCHAR(30) NOT NULL DEFAULT 'PENDING', UNIQUE(staff_id, payroll_month)
);
CREATE TABLE IF NOT EXISTS staff_salary_payments (
  id BIGSERIAL PRIMARY KEY, salary_id BIGINT NOT NULL REFERENCES staff_salary(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE, amount NUMERIC(16,2) NOT NULL, payment_method VARCHAR(40) NOT NULL, reference_no VARCHAR(100)
);
CREATE TABLE IF NOT EXISTS staff_advance_payments (
  id BIGSERIAL PRIMARY KEY, staff_id BIGINT NOT NULL REFERENCES staff(id), payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(16,2) NOT NULL, payment_method VARCHAR(40) NOT NULL DEFAULT 'Cash', reason TEXT, adjusted BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE TABLE IF NOT EXISTS karigars (
  id BIGSERIAL PRIMARY KEY, name VARCHAR(180) NOT NULL, mobile VARCHAR(30), speciality VARCHAR(100), address TEXT,
  rate_type VARCHAR(30), rate_value NUMERIC(16,2) DEFAULT 0, status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
);
CREATE TABLE IF NOT EXISTS repair_orders (
  id BIGSERIAL PRIMARY KEY, order_no VARCHAR(100) UNIQUE, customer_name VARCHAR(180), mobile VARCHAR(30), description TEXT,
  received_date DATE NOT NULL DEFAULT CURRENT_DATE, delivery_date DATE, estimated_cost NUMERIC(16,2) DEFAULT 0, status VARCHAR(30) NOT NULL DEFAULT 'RECEIVED'
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY, actor_identity VARCHAR(150) NOT NULL, action VARCHAR(80) NOT NULL, module VARCHAR(80) NOT NULL,
  record_id VARCHAR(100), previous_value JSONB, new_value JSONB, ip_address VARCHAR(80), occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS backup_history (
  id BIGSERIAL PRIMARY KEY, backup_type VARCHAR(30) NOT NULL, file_name VARCHAR(255), storage_location TEXT,
  checksum VARCHAR(128), size_bytes BIGINT, status VARCHAR(30) NOT NULL, verified_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), notes TEXT
);
CREATE TABLE IF NOT EXISTS app_settings (
  id BIGSERIAL PRIMARY KEY, setting_key VARCHAR(120) NOT NULL UNIQUE, setting_value TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS metal_rates (
  id BIGINT PRIMARY KEY DEFAULT 1, gold_22k_rate NUMERIC(14,2) NOT NULL DEFAULT 11045.00,
  silver_rate NUMERIC(14,2) NOT NULL DEFAULT 134.00, updated_at TIMESTAMP NOT NULL DEFAULT LOCALTIMESTAMP
);
INSERT INTO metal_rates(id) VALUES(1) ON CONFLICT(id) DO NOTHING;
CREATE TABLE IF NOT EXISTS admin_profile (
  id BIGINT PRIMARY KEY DEFAULT 1, full_name VARCHAR(150) NOT NULL DEFAULT 'Owner', username VARCHAR(100) NOT NULL DEFAULT 'admin2026',
  email VARCHAR(200), phone VARCHAR(50), designation VARCHAR(100), company VARCHAR(200), address VARCHAR(1000), about TEXT, photo_data_url TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT LOCALTIMESTAMP
);
INSERT INTO admin_profile(id) VALUES(1) ON CONFLICT(id) DO NOTHING;
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_mobile ON invoices(mobile);
CREATE INDEX IF NOT EXISTS idx_products_metal_status ON products(metal_type, status);
CREATE INDEX IF NOT EXISTS idx_inventory_product_date ON inventory_transactions(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_delivery_date ON bookings(delivery_date);
CREATE INDEX IF NOT EXISTS idx_installments_due_date ON installments(due_date);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_date ON staff_attendance(attendance_date DESC);
CREATE INDEX IF NOT EXISTS idx_salary_month ON staff_salary(payroll_month);
CREATE INDEX IF NOT EXISTS idx_audit_occurred_at ON audit_logs(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_ledger_customer ON customer_ledger(customer_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_ledger_supplier ON supplier_ledger(supplier_id, entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_staff_salary_staff_month ON staff_salary(staff_id, payroll_month DESC);
