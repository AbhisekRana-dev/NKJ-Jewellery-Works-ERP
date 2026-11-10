-- V28: optional catalogue attributes used for public jewellery search and detail views.
ALTER TABLE public.jewellery_designs
    ADD COLUMN IF NOT EXISTS purity VARCHAR(40) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS weight_grams NUMERIC(12,3),
    ADD COLUMN IF NOT EXISTS price_inr NUMERIC(14,2);

CREATE INDEX IF NOT EXISTS idx_jewellery_designs_purity
    ON public.jewellery_designs (LOWER(purity)) WHERE purity <> '';
CREATE INDEX IF NOT EXISTS idx_jewellery_designs_weight
    ON public.jewellery_designs (weight_grams) WHERE weight_grams IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jewellery_designs_price
    ON public.jewellery_designs (price_inr) WHERE price_inr IS NOT NULL;
