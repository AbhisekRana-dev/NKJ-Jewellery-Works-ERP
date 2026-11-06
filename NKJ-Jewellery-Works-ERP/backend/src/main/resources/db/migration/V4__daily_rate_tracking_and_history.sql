-- V3: daily precious-metal publication tracking and complete before/after history.
-- All rates remain stored per gram so existing invoice calculations are unchanged.
ALTER TABLE metal_rates ADD COLUMN IF NOT EXISTS rate_date DATE;
ALTER TABLE metal_rates ADD COLUMN IF NOT EXISTS last_auto_fetch_at TIMESTAMP;
ALTER TABLE metal_rates ADD COLUMN IF NOT EXISTS last_auto_fetch_date DATE;
ALTER TABLE metal_rates ADD COLUMN IF NOT EXISTS last_auto_fetch_status VARCHAR(40) NOT NULL DEFAULT 'NOT_CONFIGURED';

UPDATE metal_rates
   SET rate_date = COALESCE(rate_date, source_published_at::date, updated_at::date, CURRENT_DATE)
 WHERE rate_date IS NULL;
ALTER TABLE metal_rates ALTER COLUMN rate_date SET DEFAULT CURRENT_DATE;
ALTER TABLE metal_rates ALTER COLUMN rate_date SET NOT NULL;

ALTER TABLE metal_rate_history ADD COLUMN IF NOT EXISTS previous_gold_24k_rate NUMERIC(14,2);
ALTER TABLE metal_rate_history ADD COLUMN IF NOT EXISTS previous_gold_22k_rate NUMERIC(14,2);
ALTER TABLE metal_rate_history ADD COLUMN IF NOT EXISTS previous_silver_rate NUMERIC(14,2);
ALTER TABLE metal_rate_history ADD COLUMN IF NOT EXISTS new_gold_24k_rate NUMERIC(14,2);
ALTER TABLE metal_rate_history ADD COLUMN IF NOT EXISTS new_gold_22k_rate NUMERIC(14,2);
ALTER TABLE metal_rate_history ADD COLUMN IF NOT EXISTS new_silver_rate NUMERIC(14,2);
ALTER TABLE metal_rate_history ADD COLUMN IF NOT EXISTS change_type VARCHAR(40) NOT NULL DEFAULT 'LEGACY_SNAPSHOT';
ALTER TABLE metal_rate_history ADD COLUMN IF NOT EXISTS change_note TEXT;
ALTER TABLE metal_rate_history ADD COLUMN IF NOT EXISTS new_rate_source VARCHAR(160);
ALTER TABLE metal_rate_history ADD COLUMN IF NOT EXISTS new_source_reference TEXT;
ALTER TABLE metal_rate_history ADD COLUMN IF NOT EXISTS previous_rate_date DATE;
ALTER TABLE metal_rate_history ADD COLUMN IF NOT EXISTS new_rate_date DATE;
ALTER TABLE metal_rate_history ADD COLUMN IF NOT EXISTS previous_source_published_at TIMESTAMP;
ALTER TABLE metal_rate_history ADD COLUMN IF NOT EXISTS new_source_published_at TIMESTAMP;

-- Old history rows were snapshots only. Backfill them as unchanged historical values;
-- never fabricate a new value or a publication date for those legacy rows.
UPDATE metal_rate_history
   SET previous_gold_24k_rate = COALESCE(previous_gold_24k_rate, gold_24k_rate),
       previous_gold_22k_rate = COALESCE(previous_gold_22k_rate, gold_22k_rate),
       previous_silver_rate = COALESCE(previous_silver_rate, silver_rate),
       new_gold_24k_rate = COALESCE(new_gold_24k_rate, gold_24k_rate),
       new_gold_22k_rate = COALESCE(new_gold_22k_rate, gold_22k_rate),
       new_silver_rate = COALESCE(new_silver_rate, silver_rate);
CREATE INDEX IF NOT EXISTS idx_metal_rates_rate_date ON metal_rates(rate_date);
