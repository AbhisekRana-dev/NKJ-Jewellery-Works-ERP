-- V26: raise the seeded inspiration target to 25 designs for every approved
-- jewellery subcategory. These records are design concepts, not available stock.
-- Every entry remains is_sample=TRUE and receives a unique metal-scoped code.
WITH variant_numbers(variant_order) AS (
    VALUES (21), (22), (23), (24), (25)
),
category_counts AS MATERIALIZED (
    SELECT c.id AS category_id,
           c.metal_type,
           c.subcategory_name,
           c.slug,
           c.display_order,
           COUNT(d.id)::INTEGER AS existing_count
      FROM public.jewellery_design_categories c
      LEFT JOIN public.jewellery_designs d ON d.category_id = c.id
     WHERE c.is_active = TRUE
     GROUP BY c.id
),
needed_rows AS MATERIALIZED (
    SELECT c.category_id,
           c.metal_type,
           c.subcategory_name,
           c.slug,
           c.display_order,
           v.variant_order,
           CASE
             WHEN c.metal_type = 'GOLD'
              AND c.slug IN ('necklaces','necklace-sets','chains','harams','bridal-sets','lockets') THEN
               CASE v.variant_order
                 WHEN 21 THEN 'Bengali Nakshi Collar'
                 WHEN 22 THEN 'South Indian Temple Layer'
                 WHEN 23 THEN 'Meenakari Peacock Motif'
                 WHEN 24 THEN 'Antique Filigree Heritage'
                 ELSE 'Contemporary Rani Haar'
               END
             WHEN c.metal_type = 'GOLD'
              AND c.slug IN ('earrings','jhumkas','studs','tops','drop-earrings','chandbalis') THEN
               CASE v.variant_order
                 WHEN 21 THEN 'Bengali Nakshi Detail'
                 WHEN 22 THEN 'Temple Floral Cluster'
                 WHEN 23 THEN 'Peacock Filigree Drop'
                 WHEN 24 THEN 'Meenakari Celebration'
                 ELSE 'Lightweight Daily Elegance'
               END
             WHEN c.metal_type = 'GOLD'
              AND c.slug IN ('rings','bangles','bracelets','kada','toe-rings','nose-pins','nath') THEN
               CASE v.variant_order
                 WHEN 21 THEN 'Kundan Floral Accent'
                 WHEN 22 THEN 'Matte Geometric Craft'
                 WHEN 23 THEN 'Antique Hand-Textured'
                 WHEN 24 THEN 'Heritage Openwork'
                 ELSE 'Modern Sculpted Signature'
               END
             WHEN c.metal_type = 'GOLD' THEN
               CASE v.variant_order
                 WHEN 21 THEN 'Regional Artisan Motif'
                 WHEN 22 THEN 'Temple Engraved Detail'
                 WHEN 23 THEN 'Floral Heirloom Craft'
                 WHEN 24 THEN 'Festive Signature Finish'
                 ELSE 'Contemporary Heritage Form'
               END
             WHEN c.metal_type = 'SILVER'
              AND c.slug = 'anklets-and-payal' THEN
               CASE v.variant_order
                 WHEN 21 THEN 'Bengali Ghungroo Payal'
                 WHEN 22 THEN 'Rajasthani Oxidised Payal'
                 WHEN 23 THEN 'Peacock Charm Payal'
                 WHEN 24 THEN 'Handmade Filigree Payal'
                 ELSE 'Lightweight Daily Payal'
               END
             WHEN c.metal_type = 'SILVER'
              AND c.slug IN ('idols-and-murtis','pooja-thalis','diyas','bowls-and-serveware','glass-sets','silver-utensils','silver-coins','gift-articles') THEN
               CASE v.variant_order
                 WHEN 21 THEN 'Temple Repoussé Craft'
                 WHEN 22 THEN 'Hand-Engraved Heritage'
                 WHEN 23 THEN 'Floral Chased Detail'
                 WHEN 24 THEN 'Festive Gifting Signature'
                 ELSE 'Contemporary Table Elegance'
               END
             WHEN c.metal_type = 'SILVER' THEN
               CASE v.variant_order
                 WHEN 21 THEN 'Traditional Bengali Craft'
                 WHEN 22 THEN 'Oxidised Artisan Finish'
                 WHEN 23 THEN 'Filigree Floral Motif'
                 WHEN 24 THEN 'Peacock Heritage Detail'
                 ELSE 'Modern Lightweight Form'
               END
             WHEN c.metal_type = 'DIAMOND'
              AND c.slug IN ('rings','solitaire-rings','engagement-rings','wedding-bands','men-s-rings') THEN
               CASE v.variant_order
                 WHEN 21 THEN 'Round-Cut Halo'
                 WHEN 22 THEN 'Oval Solitaire'
                 WHEN 23 THEN 'Princess-Cut Pavé'
                 WHEN 24 THEN 'Emerald-Cut Three-Stone'
                 ELSE 'Heart-Shaped Diamond Accent'
               END
             WHEN c.metal_type = 'DIAMOND'
              AND c.slug IN ('earrings','studs','drop-earrings','jhumkas') THEN
               CASE v.variant_order
                 WHEN 21 THEN 'Brilliant Halo Stud'
                 WHEN 22 THEN 'Pear-Cut Drop'
                 WHEN 23 THEN 'Floral Pavé Cluster'
                 WHEN 24 THEN 'Diamond Jhumka Detail'
                 ELSE 'Minimal Diamond Line'
               END
             WHEN c.metal_type = 'DIAMOND' THEN
               CASE v.variant_order
                 WHEN 21 THEN 'Graduated Diamond Line'
                 WHEN 22 THEN 'Floral Cluster Signature'
                 WHEN 23 THEN 'Modern Pavé Detail'
                 WHEN 24 THEN 'Bridal Diamond Statement'
                 ELSE 'Classic Diamond Accent'
               END
           END AS style_label
      FROM category_counts c
      CROSS JOIN variant_numbers v
     WHERE v.variant_order <= 20 + GREATEST(0, 25 - c.existing_count)
),
counter_bumps AS MATERIALIZED (
    SELECT metal_type, COUNT(*)::BIGINT AS added_count
      FROM needed_rows
     GROUP BY metal_type
),
counter_base AS MATERIALIZED (
    SELECT metal_type, last_value
      FROM public.jewellery_design_code_counters
     FOR UPDATE
),
counter_updated AS (
    UPDATE public.jewellery_design_code_counters current_counter
       SET last_value = counter_base.last_value + counter_bumps.added_count
      FROM counter_base
      JOIN counter_bumps USING (metal_type)
     WHERE current_counter.metal_type = counter_base.metal_type
     RETURNING current_counter.metal_type
),
ranked_rows AS MATERIALIZED (
    SELECT n.*,
           ROW_NUMBER() OVER (
               PARTITION BY n.metal_type
               ORDER BY n.display_order, n.subcategory_name, n.variant_order
           ) AS metal_sequence
      FROM needed_rows n
)
INSERT INTO public.jewellery_designs (
    design_code,
    category_id,
    design_name,
    description,
    style_label,
    keywords,
    is_sample,
    is_featured,
    is_active,
    popularity_count,
    created_at,
    updated_at
)
SELECT 'NKJ-' ||
       CASE r.metal_type
         WHEN 'GOLD' THEN 'GOLD-'
         WHEN 'SILVER' THEN 'SILVER-'
         ELSE 'DIA-'
       END ||
       LPAD((base.last_value + r.metal_sequence)::TEXT, 5, '0'),
       r.category_id,
       r.style_label || ' ' || r.subcategory_name,
       'Sample ' || LOWER(r.metal_type) || ' ' || LOWER(r.subcategory_name) ||
       ' inspiration featuring ' || LOWER(r.style_label) ||
       '. This is a style concept only, not a confirmed shop product or available stock.',
       r.style_label,
       r.metal_type || ', ' || r.subcategory_name || ', ' || r.style_label,
       TRUE,
       r.variant_order IN (21, 25),
       TRUE,
       0,
       NOW() - INTERVAL '30 days',
       NOW()
  FROM ranked_rows r
  JOIN counter_base base ON base.metal_type = r.metal_type
  JOIN counter_updated updated ON updated.metal_type = r.metal_type
ON CONFLICT (design_code) DO NOTHING;

DO $$
DECLARE
    category_total INTEGER;
    under_target INTEGER;
BEGIN
    SELECT COUNT(*) INTO category_total
      FROM public.jewellery_design_categories
     WHERE is_active = TRUE;

    IF category_total <> 77 THEN
        RAISE EXCEPTION 'Jewellery catalogue must contain 77 active approved subcategories; found %', category_total;
    END IF;

    SELECT COUNT(*) INTO under_target
      FROM (
        SELECT c.id
          FROM public.jewellery_design_categories c
          LEFT JOIN public.jewellery_designs d ON d.category_id = c.id
         WHERE c.is_active = TRUE
         GROUP BY c.id
        HAVING COUNT(d.id) < 25
      ) incomplete;

    IF under_target > 0 THEN
        RAISE EXCEPTION 'Jewellery catalogue seed incomplete: % subcategories have fewer than 25 designs', under_target;
    END IF;
END $$;
