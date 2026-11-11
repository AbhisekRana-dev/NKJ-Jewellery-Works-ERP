-- V36: enforce a truthful, complete catalogue without stretching low-resolution
-- repository sample artwork. The 1,925 curated concepts remain intact and visible;
-- their photo status becomes PENDING until the owner uploads a genuine HD photograph.
--
-- Only generated repository sample-image references are removed. Owner-uploaded
-- images use /api/uploads/designs/... and are deliberately preserved.

DELETE FROM public.jewellery_design_images
 WHERE original_url LIKE '/nkj-design-samples/%'
    OR display_url LIKE '/nkj-design-samples/%'
    OR thumbnail_url LIKE '/nkj-design-samples/%';

UPDATE public.jewellery_designs d
   SET image_status = CASE
       WHEN EXISTS (
           SELECT 1
             FROM public.jewellery_design_images i
            WHERE i.design_id = d.id
              AND COALESCE(
                    NULLIF(BTRIM(i.thumbnail_url), ''),
                    NULLIF(BTRIM(i.display_url), ''),
                    NULLIF(BTRIM(i.original_url), '')
                  ) IS NOT NULL
       ) THEN 'READY'
       ELSE 'PENDING'
   END,
       updated_at = NOW()
 WHERE d.is_deleted = FALSE;

DO $$
DECLARE
    gold_categories INTEGER;
    silver_categories INTEGER;
    diamond_categories INTEGER;
    all_categories INTEGER;
    incomplete_categories INTEGER;
    total_active_designs BIGINT;
    duplicate_names INTEGER;
    missing_silver_subcategories INTEGER;
BEGIN
    SELECT COUNT(*) INTO gold_categories
      FROM public.jewellery_design_categories
     WHERE metal_type = 'GOLD' AND is_active = TRUE;

    SELECT COUNT(*) INTO silver_categories
      FROM public.jewellery_design_categories
     WHERE metal_type = 'SILVER' AND is_active = TRUE;

    SELECT COUNT(*) INTO diamond_categories
      FROM public.jewellery_design_categories
     WHERE metal_type = 'DIAMOND' AND is_active = TRUE;

    SELECT gold_categories + silver_categories + diamond_categories INTO all_categories;

    IF gold_categories <> 29 OR silver_categories <> 26 OR diamond_categories <> 22
       OR all_categories <> 77 THEN
        RAISE EXCEPTION
          'Jewellery catalogue must contain 29 Gold, 26 Silver and 22 Diamond subcategories; found %, %, %',
          gold_categories, silver_categories, diamond_categories;
    END IF;

    SELECT COUNT(*) INTO missing_silver_subcategories
      FROM (VALUES ('hair-accessories'), ('keychains')) required(slug)
     WHERE NOT EXISTS (
         SELECT 1
           FROM public.jewellery_design_categories c
          WHERE c.metal_type = 'SILVER'
            AND c.slug = required.slug
            AND c.is_active = TRUE
     );

    IF missing_silver_subcategories <> 0 THEN
        RAISE EXCEPTION 'Silver Hair Accessories and Keychains must both be active subcategories.';
    END IF;

    SELECT COUNT(*) INTO incomplete_categories
      FROM (
          SELECT c.id
            FROM public.jewellery_design_categories c
            LEFT JOIN public.jewellery_designs d
              ON d.category_id = c.id
             AND d.is_deleted = FALSE
             AND d.is_active = TRUE
           WHERE c.is_active = TRUE
           GROUP BY c.id
          HAVING COUNT(d.id) < 20
      ) incomplete;

    IF incomplete_categories <> 0 THEN
        RAISE EXCEPTION
          'Every active jewellery subcategory must have at least 20 active designs; % subcategories are incomplete',
          incomplete_categories;
    END IF;

    SELECT COUNT(*) INTO total_active_designs
      FROM public.jewellery_designs d
      JOIN public.jewellery_design_categories c ON c.id = d.category_id
     WHERE c.is_active = TRUE
       AND d.is_active = TRUE
       AND d.is_deleted = FALSE;

    IF total_active_designs < 1540 THEN
        RAISE EXCEPTION
          'Jewellery catalogue requires at least 1,540 active designs; found %',
          total_active_designs;
    END IF;

    SELECT COUNT(*) INTO duplicate_names
      FROM (
          SELECT d.category_id, LOWER(BTRIM(d.design_name))
            FROM public.jewellery_designs d
           WHERE d.is_deleted = FALSE
           GROUP BY d.category_id, LOWER(BTRIM(d.design_name))
          HAVING COUNT(*) > 1
      ) duplicate_groups;

    IF duplicate_names <> 0 THEN
        RAISE EXCEPTION
          'Jewellery catalogue contains % duplicate design-name groups within a subcategory',
          duplicate_names;
    END IF;
END $$;
