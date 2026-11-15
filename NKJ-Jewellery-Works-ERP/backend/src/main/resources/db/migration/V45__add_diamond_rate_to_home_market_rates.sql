-- Add the owner-managed diamond rate (stored per carat) without changing
-- the per-gram storage or calculation contracts for gold and silver.
ALTER TABLE metal_rates
    ADD COLUMN IF NOT EXISTS diamond_rate NUMERIC(14,2) NOT NULL DEFAULT 0.00;

-- Historical diamond values are nullable because they were not tracked before
-- this migration. New rate changes record before/after values from this point on.
ALTER TABLE metal_rate_history
    ADD COLUMN IF NOT EXISTS previous_diamond_rate NUMERIC(14,2);

ALTER TABLE metal_rate_history
    ADD COLUMN IF NOT EXISTS new_diamond_rate NUMERIC(14,2);
