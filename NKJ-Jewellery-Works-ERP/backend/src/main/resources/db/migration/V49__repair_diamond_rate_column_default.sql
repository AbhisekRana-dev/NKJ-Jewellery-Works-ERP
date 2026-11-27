-- Repair the owner-managed diamond-rate column when Hibernate's legacy
-- ddl-auto=update creates it before Flyway can apply the original default.
-- Backfill only missing values; never overwrite an existing diamond quote.
ALTER TABLE public.metal_rates
    ADD COLUMN IF NOT EXISTS diamond_rate NUMERIC(14,2);

UPDATE public.metal_rates
   SET diamond_rate = 0.00
 WHERE diamond_rate IS NULL;

ALTER TABLE public.metal_rates
    ALTER COLUMN diamond_rate SET DEFAULT 0.00;

ALTER TABLE public.metal_rates
    ALTER COLUMN diamond_rate SET NOT NULL;
