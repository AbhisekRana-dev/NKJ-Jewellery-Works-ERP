-- V29: immutable public-facing Design IDs, scoped by metal and subcategory.
-- Existing rows receive stable IDs ordered by their legacy database ID.
-- Counter rows are intentionally not linked to design rows, so deleting a design
-- never removes or resets a sequence and a previously used ID is never reused.

ALTER TABLE public.jewellery_designs
    ADD COLUMN IF NOT EXISTS design_id VARCHAR(180);

CREATE TABLE IF NOT EXISTS public.jewellery_design_id_counters (
    metal_type VARCHAR(16) NOT NULL
        CHECK (metal_type IN ('GOLD', 'SILVER', 'DIAMOND')),
    category_key VARCHAR(120) NOT NULL,
    last_value BIGINT NOT NULL DEFAULT 0 CHECK (last_value >= 0),
    PRIMARY KEY (metal_type, category_key)
);

WITH normalized AS (
    SELECT d.id AS design_pk,
           c.metal_type,
           COALESCE(
               NULLIF(
                   TRIM(BOTH '_' FROM REGEXP_REPLACE(
                       UPPER(REPLACE(c.subcategory_name, '''', '')),
                       '[^A-Z0-9]+', '_', 'g'
                   )),
                   ''
               ),
               'DESIGN'
           ) AS category_key
      FROM public.jewellery_designs d
      JOIN public.jewellery_design_categories c ON c.id = d.category_id
),
numbered AS (
    SELECT design_pk,
           metal_type,
           category_key,
           ROW_NUMBER() OVER (
               PARTITION BY metal_type, category_key
               ORDER BY design_pk
           ) AS sequence_no
      FROM normalized
)
UPDATE public.jewellery_designs d
   SET design_id = 'NKJ_' || n.metal_type || '_' || n.category_key || '_' ||
                   LPAD(n.sequence_no::TEXT, GREATEST(4, LENGTH(n.sequence_no::TEXT)), '0')
  FROM numbered n
 WHERE d.id = n.design_pk
   AND d.design_id IS NULL;

WITH normalized AS (
    SELECT d.id AS design_pk,
           c.metal_type,
           COALESCE(
               NULLIF(
                   TRIM(BOTH '_' FROM REGEXP_REPLACE(
                       UPPER(REPLACE(c.subcategory_name, '''', '')),
                       '[^A-Z0-9]+', '_', 'g'
                   )),
                   ''
               ),
               'DESIGN'
           ) AS category_key
      FROM public.jewellery_designs d
      JOIN public.jewellery_design_categories c ON c.id = d.category_id
),
numbered AS (
    SELECT metal_type,
           category_key,
           ROW_NUMBER() OVER (
               PARTITION BY metal_type, category_key
               ORDER BY design_pk
           ) AS sequence_no
      FROM normalized
)
INSERT INTO public.jewellery_design_id_counters(metal_type, category_key, last_value)
SELECT metal_type, category_key, MAX(sequence_no)
  FROM numbered
 GROUP BY metal_type, category_key
ON CONFLICT (metal_type, category_key)
DO UPDATE SET last_value = GREATEST(
    public.jewellery_design_id_counters.last_value,
    EXCLUDED.last_value
);

ALTER TABLE public.jewellery_designs
    ALTER COLUMN design_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_jewellery_designs_design_id
    ON public.jewellery_designs(design_id);

CREATE INDEX IF NOT EXISTS idx_jewellery_designs_design_id
    ON public.jewellery_designs(design_id);
