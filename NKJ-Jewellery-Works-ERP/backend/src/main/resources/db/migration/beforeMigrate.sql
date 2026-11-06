-- Compatibility repair for installations that already had singleton tables
-- created by the earlier invoice-only application. This callback runs before
-- every Flyway migrate operation and intentionally does not modify existing
-- non-null business values.

DO $nkj_legacy_repair$
DECLARE
    sequence_name TEXT;
BEGIN
    -- Legacy shop_details may have been created without a serial sequence.
    -- V1 uses ON CONFLICT(id) and advances this sequence after seeding row 1.
    IF to_regclass('public.shop_details') IS NOT NULL THEN
        ALTER TABLE public.shop_details ADD COLUMN IF NOT EXISTS id BIGINT;
        ALTER TABLE public.shop_details ADD COLUMN IF NOT EXISTS shop_name VARCHAR(200);
        ALTER TABLE public.shop_details ADD COLUMN IF NOT EXISTS owner_name VARCHAR(150);
        ALTER TABLE public.shop_details ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
        ALTER TABLE public.shop_details ADD COLUMN IF NOT EXISTS email VARCHAR(200);
        ALTER TABLE public.shop_details ADD COLUMN IF NOT EXISTS address TEXT;
        ALTER TABLE public.shop_details ADD COLUMN IF NOT EXISTS gstin VARCHAR(40);
        ALTER TABLE public.shop_details ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

        WITH missing_ids AS (
            SELECT ctid,
                   COALESCE((SELECT MAX(id) FROM public.shop_details), 0)
                   + ROW_NUMBER() OVER (ORDER BY ctid) AS assigned_id
              FROM public.shop_details
             WHERE id IS NULL
        )
        UPDATE public.shop_details AS target
           SET id = missing_ids.assigned_id
          FROM missing_ids
         WHERE target.ctid = missing_ids.ctid;

        UPDATE public.shop_details
           SET shop_name = COALESCE(NULLIF(BTRIM(shop_name), ''), 'Nandikishor Jewellery Works'),
               updated_at = COALESCE(updated_at, NOW())
         WHERE shop_name IS NULL OR BTRIM(shop_name) = '' OR updated_at IS NULL;

        ALTER TABLE public.shop_details ALTER COLUMN id SET NOT NULL;
        ALTER TABLE public.shop_details ALTER COLUMN shop_name SET DEFAULT 'Nandikishor Jewellery Works';
        ALTER TABLE public.shop_details ALTER COLUMN shop_name SET NOT NULL;
        ALTER TABLE public.shop_details ALTER COLUMN updated_at SET DEFAULT NOW();
        ALTER TABLE public.shop_details ALTER COLUMN updated_at SET NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS ux_shop_details_legacy_id ON public.shop_details(id);

        sequence_name := pg_get_serial_sequence('public.shop_details', 'id');
        IF sequence_name IS NULL THEN
            CREATE SEQUENCE IF NOT EXISTS public.shop_details_id_seq;
            ALTER SEQUENCE public.shop_details_id_seq OWNED BY public.shop_details.id;
            ALTER TABLE public.shop_details ALTER COLUMN id SET DEFAULT nextval('public.shop_details_id_seq'::regclass);
            sequence_name := 'public.shop_details_id_seq';
        END IF;
        EXECUTE format(
            'SELECT setval(%L::regclass, GREATEST(COALESCE((SELECT MAX(id) FROM public.shop_details), 1), 1), true)',
            sequence_name
        );
    END IF;

    -- The old metal_rates table may contain a row with NULL values and no
    -- defaults. V1 inserts only id=1, so restore safe defaults first.
    IF to_regclass('public.metal_rates') IS NOT NULL THEN
        ALTER TABLE public.metal_rates ADD COLUMN IF NOT EXISTS id BIGINT;
        ALTER TABLE public.metal_rates ADD COLUMN IF NOT EXISTS gold_22k_rate NUMERIC(14,2);
        ALTER TABLE public.metal_rates ADD COLUMN IF NOT EXISTS silver_rate NUMERIC(14,2);
        ALTER TABLE public.metal_rates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

        WITH missing_ids AS (
            SELECT ctid,
                   COALESCE((SELECT MAX(id) FROM public.metal_rates), 0)
                   + ROW_NUMBER() OVER (ORDER BY ctid) AS assigned_id
              FROM public.metal_rates
             WHERE id IS NULL
        )
        UPDATE public.metal_rates AS target
           SET id = missing_ids.assigned_id
          FROM missing_ids
         WHERE target.ctid = missing_ids.ctid;

        UPDATE public.metal_rates
           SET gold_22k_rate = COALESCE(gold_22k_rate, 11045.00),
               silver_rate = COALESCE(silver_rate, 134.00),
               updated_at = COALESCE(updated_at, LOCALTIMESTAMP)
         WHERE gold_22k_rate IS NULL OR silver_rate IS NULL OR updated_at IS NULL;

        ALTER TABLE public.metal_rates ALTER COLUMN id SET NOT NULL;
        ALTER TABLE public.metal_rates ALTER COLUMN gold_22k_rate SET DEFAULT 11045.00;
        ALTER TABLE public.metal_rates ALTER COLUMN gold_22k_rate SET NOT NULL;
        ALTER TABLE public.metal_rates ALTER COLUMN silver_rate SET DEFAULT 134.00;
        ALTER TABLE public.metal_rates ALTER COLUMN silver_rate SET NOT NULL;
        ALTER TABLE public.metal_rates ALTER COLUMN updated_at SET DEFAULT LOCALTIMESTAMP;
        ALTER TABLE public.metal_rates ALTER COLUMN updated_at SET NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS ux_metal_rates_legacy_id ON public.metal_rates(id);
    END IF;

    -- The existing profile is a singleton as well. Add missing optional
    -- columns and backfill the required fields without overwriting valid data.
    IF to_regclass('public.admin_profile') IS NOT NULL THEN
        ALTER TABLE public.admin_profile ADD COLUMN IF NOT EXISTS id BIGINT;
        ALTER TABLE public.admin_profile ADD COLUMN IF NOT EXISTS full_name VARCHAR(150);
        ALTER TABLE public.admin_profile ADD COLUMN IF NOT EXISTS username VARCHAR(100);
        ALTER TABLE public.admin_profile ADD COLUMN IF NOT EXISTS email VARCHAR(200);
        ALTER TABLE public.admin_profile ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
        ALTER TABLE public.admin_profile ADD COLUMN IF NOT EXISTS designation VARCHAR(100);
        ALTER TABLE public.admin_profile ADD COLUMN IF NOT EXISTS company VARCHAR(200);
        ALTER TABLE public.admin_profile ADD COLUMN IF NOT EXISTS address VARCHAR(1000);
        ALTER TABLE public.admin_profile ADD COLUMN IF NOT EXISTS about TEXT;
        ALTER TABLE public.admin_profile ADD COLUMN IF NOT EXISTS photo_data_url TEXT;
        ALTER TABLE public.admin_profile ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

        WITH missing_ids AS (
            SELECT ctid,
                   COALESCE((SELECT MAX(id) FROM public.admin_profile), 0)
                   + ROW_NUMBER() OVER (ORDER BY ctid) AS assigned_id
              FROM public.admin_profile
             WHERE id IS NULL
        )
        UPDATE public.admin_profile AS target
           SET id = missing_ids.assigned_id
          FROM missing_ids
         WHERE target.ctid = missing_ids.ctid;

        UPDATE public.admin_profile
           SET full_name = COALESCE(NULLIF(BTRIM(full_name), ''), 'Owner'),
               username = COALESCE(NULLIF(BTRIM(username), ''), 'admin2026'),
               designation = COALESCE(designation, 'Administrator'),
               company = COALESCE(company, 'Nandikishor Jewellery Works'),
               address = COALESCE(address, ''),
               about = COALESCE(about, ''),
               photo_data_url = COALESCE(photo_data_url, ''),
               updated_at = COALESCE(updated_at, LOCALTIMESTAMP)
         WHERE full_name IS NULL OR BTRIM(full_name) = ''
            OR username IS NULL OR BTRIM(username) = '' OR designation IS NULL
            OR company IS NULL OR address IS NULL OR about IS NULL
            OR photo_data_url IS NULL OR updated_at IS NULL;

        ALTER TABLE public.admin_profile ALTER COLUMN id SET NOT NULL;
        ALTER TABLE public.admin_profile ALTER COLUMN full_name SET DEFAULT 'Owner';
        ALTER TABLE public.admin_profile ALTER COLUMN full_name SET NOT NULL;
        ALTER TABLE public.admin_profile ALTER COLUMN username SET DEFAULT 'admin2026';
        ALTER TABLE public.admin_profile ALTER COLUMN username SET NOT NULL;
        ALTER TABLE public.admin_profile ALTER COLUMN updated_at SET DEFAULT LOCALTIMESTAMP;
        ALTER TABLE public.admin_profile ALTER COLUMN updated_at SET NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS ux_admin_profile_legacy_id ON public.admin_profile(id);
    END IF;
END
$nkj_legacy_repair$;
