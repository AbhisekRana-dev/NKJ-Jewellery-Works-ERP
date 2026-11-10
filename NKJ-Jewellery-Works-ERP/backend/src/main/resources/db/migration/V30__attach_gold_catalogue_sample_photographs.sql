-- V30: attach original generated sample photographs to the ten Gold designs
-- visible in the catalogue screenshot. These remain inspiration samples, not stock.
-- The migration is idempotent by design_code and image digest.

WITH photo_targets(design_code, image_path, alt_text, image_sha256) AS (
    VALUES
      ('NKJ-GOLD-00721', '/nkj-design-samples/gold-locket-00721.jpg',
       'AI-generated gold locket sample inspiration; not confirmed shop inventory.',
       '5efad578d10971bc9b078fe454b73bf76e00ac8669b163284cd2eb65cbab1b1c'),
      ('NKJ-GOLD-00722', '/nkj-design-samples/gold-locket-00722.jpg',
       'AI-generated gold locket sample inspiration; not confirmed shop inventory.',
       '083eb62db42bbbb19c65c7633fb90868e845f84d1a68334c5019a6c8068f91c6'),
      ('NKJ-GOLD-00723', '/nkj-design-samples/gold-locket-00723.jpg',
       'AI-generated gold locket sample inspiration; not confirmed shop inventory.',
       '19b6dab51930ccdb202e5be24846fdf40396b251c09edd53a99c2df1be50c114'),
      ('NKJ-GOLD-00724', '/nkj-design-samples/gold-locket-00724.jpg',
       'AI-generated gold locket sample inspiration; not confirmed shop inventory.',
       '8348c0bcb6b8fd0575a5ca1de4597b0b1bcf6385e9a777df992c17a001db3210'),
      ('NKJ-GOLD-00725', '/nkj-design-samples/gold-locket-00725.jpg',
       'AI-generated gold locket sample inspiration; not confirmed shop inventory.',
       '2ad485464b96516b4221600747bd1689c4248d29de8841bb47bda88d4a6c6e73'),
      ('NKJ-GOLD-00716', '/nkj-design-samples/gold-mens-jewellery-00716.jpg',
       'AI-generated gold mens jewellery sample inspiration; not confirmed shop inventory.',
       '54866c0e08fd7cccab8ee2fd739964fe3a3f6c5c65cb216da369183e9312e7e8'),
      ('NKJ-GOLD-00717', '/nkj-design-samples/gold-mens-jewellery-00717.jpg',
       'AI-generated gold mens jewellery sample inspiration; not confirmed shop inventory.',
       '1a6e3a0f3a46805642c4455bf6d8b4175e8a7c734c570dd7ca5003235725f857'),
      ('NKJ-GOLD-00718', '/nkj-design-samples/gold-mens-jewellery-00718.jpg',
       'AI-generated gold mens jewellery sample inspiration; not confirmed shop inventory.',
       '637b5f895040330b02294b9861384a79ed2d25262ac7ba602599bec83d8bcd8d'),
      ('NKJ-GOLD-00719', '/nkj-design-samples/gold-mens-jewellery-00719.jpg',
       'AI-generated gold mens jewellery sample inspiration; not confirmed shop inventory.',
       '4728dd63ac0984fc97349549461da8138fd0da350a00cf0d829c6a4bf4db959b'),
      ('NKJ-GOLD-00720', '/nkj-design-samples/gold-mens-jewellery-00720.jpg',
       'AI-generated gold mens jewellery sample inspiration; not confirmed shop inventory.',
       '17822d3f03a43558d68d4f8794af870684d788bad45751ecdbd91ebb7ded7995')
),
targets AS (
    SELECT d.id AS design_id,
           p.image_path,
           p.alt_text,
           p.image_sha256
      FROM photo_targets p
      JOIN public.jewellery_designs d ON d.design_code = p.design_code
)
INSERT INTO public.jewellery_design_images
    (design_id, original_url, thumbnail_url, alt_text, content_sha256, display_order, created_at)
SELECT t.design_id,
       t.image_path,
       t.image_path,
       t.alt_text,
       t.image_sha256,
       0,
       NOW()
  FROM targets t
 WHERE NOT EXISTS (
       SELECT 1
         FROM public.jewellery_design_images existing_image
        WHERE existing_image.design_id = t.design_id
 )
ON CONFLICT (content_sha256) DO NOTHING;
