-- Distinguish legacy seed values from prices explicitly confirmed by the owner
-- or accepted through the protected publisher-import endpoint.
ALTER TABLE metal_rates
  ADD COLUMN IF NOT EXISTS owner_verified BOOLEAN NOT NULL DEFAULT FALSE;
