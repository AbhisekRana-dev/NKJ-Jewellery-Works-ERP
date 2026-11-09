-- V22: invoice customers are synchronized into the existing customer master
-- using normalized phone number only. Existing customer rows are never deleted.
ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS normalized_phone VARCHAR(30);

ALTER TABLE public.invoices
    ADD COLUMN IF NOT EXISTS customer_email VARCHAR(200);

CREATE OR REPLACE FUNCTION public.normalize_customer_phone(raw_phone TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
AS $$
    WITH digits AS (
        SELECT regexp_replace(COALESCE(raw_phone, ''), '[^0-9]', '', 'g') AS value
    )
    SELECT CASE
        WHEN value = '' THEN NULL
        WHEN length(value) = 12 AND left(value, 2) = '91' THEN right(value, 10)
        WHEN length(value) = 11 AND left(value, 1) = '0' THEN right(value, 10)
        ELSE value
    END
    FROM digits;
$$;

-- Preserve pre-existing duplicate customer records. For every normalized
-- phone, the oldest row remains the canonical lookup target; duplicate rows
-- retain their original id/name/phone/email/address but have no normalized key.
WITH candidates AS (
    SELECT id,
           public.normalize_customer_phone(phone) AS normalized,
           ROW_NUMBER() OVER (
               PARTITION BY public.normalize_customer_phone(phone)
               ORDER BY id
           ) AS duplicate_rank
      FROM public.customers
     WHERE public.normalize_customer_phone(phone) IS NOT NULL
)
UPDATE public.customers c
   SET normalized_phone = CASE
       WHEN candidate.duplicate_rank = 1 THEN candidate.normalized
       ELSE NULL
   END
  FROM candidates candidate
 WHERE c.id = candidate.id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_normalized_phone
    ON public.customers(normalized_phone)
    WHERE normalized_phone IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_customer_code_nonnull
    ON public.customers(customer_code)
    WHERE customer_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_customer_id
    ON public.invoices(customer_id);

CREATE OR REPLACE FUNCTION public.set_customer_normalized_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.normalized_phone := public.normalize_customer_phone(NEW.phone);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customers_normalize_phone ON public.customers;
CREATE TRIGGER trg_customers_normalize_phone
BEFORE INSERT OR UPDATE OF phone ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.set_customer_normalized_phone();

-- Link older invoices where an unambiguous canonical customer already exists.
-- Existing explicit customer_id relationships are preserved.
UPDATE public.invoices i
   SET customer_id = c.id
  FROM public.customers c
 WHERE i.customer_id IS NULL
   AND public.normalize_customer_phone(i.mobile) IS NOT NULL
   AND c.normalized_phone = public.normalize_customer_phone(i.mobile);
