-- V13: remember the last successfully imported automatic publication date.
-- This deduplicates city/newspaper snapshots independently of the fetch-attempt date.
ALTER TABLE public.metal_rates
    ADD COLUMN IF NOT EXISTS last_auto_source_date DATE;

UPDATE public.metal_rates r
   SET last_auto_source_date = (
       SELECT MAX(h.new_rate_date)
         FROM public.metal_rate_history h
        WHERE h.change_type IN ('NEWSPAPER_DAILY_IMPORT', 'KOLKATA_CITY_DAILY_IMPORT')
          AND h.new_rate_date IS NOT NULL
   )
 WHERE r.id = 1
   AND r.last_auto_source_date IS NULL;
