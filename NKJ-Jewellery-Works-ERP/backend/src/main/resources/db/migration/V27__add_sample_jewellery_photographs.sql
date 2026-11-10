-- V27: attach four original AI-generated sample inspiration photographs to
-- matching seeded design concepts. These are not shop stock photographs.
-- The records remain is_sample=TRUE until an owner uploads an actual shop image.

WITH photo_targets(metal_type, category_slug, image_path, alt_text, image_sha256) AS (
    VALUES
      ('GOLD', 'necklaces',
       '/nkj-design-samples/gold-temple-necklace.jpg',
       'AI-generated gold temple necklace sample inspiration; not shop inventory.',
       'fb1325c413c5c134e05b9dba653af4861cbf47d6a3db9042019388b180b558ee'),
      ('GOLD', 'jhumkas',
       '/nkj-design-samples/gold-jhumka-earrings.jpg',
       'AI-generated gold jhumka earrings sample inspiration; not shop inventory.',
       'f495981ac868c8dd5c64afb5b34755149bcb8da1ecdae3ee1e0fc703c8628ae5'),
      ('SILVER', 'anklets-and-payal',
       '/nkj-design-samples/silver-payal-anklets.jpg',
       'AI-generated silver payal sample inspiration; not shop inventory.',
       '044bd82ad92cbc5bce4f8b3ef89756f1894d88e9f0517ebbde3c4d087281c22d'),
      ('DIAMOND', 'men-s-rings',
       '/nkj-design-samples/diamond-halo-ring.jpg',
       'AI-generated diamond halo ring sample inspiration; not shop inventory.',
       '5aaaa7c9a1678dbd359eb9b46ad0702b08dac331e76b2eb874afa432465c5784')
),
target_designs AS (
    SELECT
        d.id AS design_id,
        p.image_path,
        p.alt_text,
        p.image_sha256
    FROM photo_targets p
    JOIN public.jewellery_design_categories c
      ON c.metal_type = p.metal_type
     AND c.slug = p.category_slug
     AND c.is_active = TRUE
    JOIN LATERAL (
        SELECT d.id
        FROM public.jewellery_designs d
        WHERE d.category_id = c.id
          AND d.is_active = TRUE
          AND d.is_sample = TRUE
        ORDER BY d.id DESC
        LIMIT 1
    ) d ON TRUE
)
INSERT INTO public.jewellery_design_images (
    design_id,
    original_url,
    thumbnail_url,
    alt_text,
    content_sha256,
    display_order,
    created_at
)
SELECT
    t.design_id,
    t.image_path,
    t.image_path,
    t.alt_text,
    t.image_sha256,
    0,
    NOW()
FROM target_designs t
WHERE NOT EXISTS (
    SELECT 1
    FROM public.jewellery_design_images existing_image
    WHERE existing_image.design_id = t.design_id
)
ON CONFLICT (content_sha256) DO NOTHING;
