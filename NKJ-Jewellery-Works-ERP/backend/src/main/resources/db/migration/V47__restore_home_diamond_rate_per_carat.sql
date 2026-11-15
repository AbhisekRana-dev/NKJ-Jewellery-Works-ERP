-- Restore the Home-page owner-managed Diamond rate after the earlier
-- compensating rollback. Keep Diamond quoted per carat.
ALTER TABLE metal_rates
    ADD COLUMN IF NOT EXISTS diamond_rate NUMERIC(14,2) NOT NULL DEFAULT 0.00;

ALTER TABLE metal_rate_history
    ADD COLUMN IF NOT EXISTS previous_diamond_rate NUMERIC(14,2);

ALTER TABLE metal_rate_history
    ADD COLUMN IF NOT EXISTS new_diamond_rate NUMERIC(14,2);
