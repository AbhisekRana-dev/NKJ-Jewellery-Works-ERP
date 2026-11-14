-- Revert the standalone Home-page diamond-rate storage addition.
-- Keep V45 unchanged for databases where Flyway has already recorded it.
ALTER TABLE metal_rates
    DROP COLUMN IF EXISTS diamond_rate;

ALTER TABLE metal_rate_history
    DROP COLUMN IF EXISTS previous_diamond_rate;

ALTER TABLE metal_rate_history
    DROP COLUMN IF EXISTS new_diamond_rate;
