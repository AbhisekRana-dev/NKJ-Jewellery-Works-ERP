-- V30: attach original generated sample photographs to the ten Gold designs
-- visible in the catalogue screenshot. These remain inspiration samples, not stock.
-- The migration is idempotent by design_code and image digest.

WITH photo_targets(design_code, image_path, alt_text, image_sha256) AS (
    VALUES
      ('NKJ-GOLD-00721', '/nkj-design-samples/gold-locket-00721.jpg',
       'AI-generated gold locket sample inspiration; not confirmed shop inventory.',
       '3467479f5c3d182f2aa40b4d413b7cfa4cafd0d82dc0219d95c54dce9ff7a3d4'),
      ('NKJ-GOLD-00722', '/nkj-design-samples/gold-locket-00722.jpg',
       'AI-generated gold locket sample inspiration; not confirmed shop inventory.',
       'e60b081b5597d23790f9154f74ca1de6f3d2b7694ea09ab6147fe1e727579479'),
      ('NKJ-GOLD-00723', '/nkj-design-samples/gold-locket-00723.jpg',
       'AI-generated gold locket sample inspiration; not confirmed shop inventory.',
       '18d4e8e62a6982a77fa571ded07d5bde5ec8eda726f623f0aa212ec493b88452'),
      ('NKJ-GOLD-00724', '/nkj-design-samples/gold-locket-00724.jpg',
       'AI-generated gold locket sample inspiration; not confirmed shop inventory.',
       'b80e4ec1347d7a1b1c4a0ac77b14dd93b654efba48f97f6f9ef8ba435829346d'),
      ('NKJ-GOLD-00725', '/nkj-design-samples/gold-locket-00725.jpg',
       'AI-generated gold locket sample inspiration; not confirmed shop inventory.',
       'b6c2a6b10bb29b6f621c199bf3cdca77f0f9bdd492043b313f576f5f4f151577'),
      ('NKJ-GOLD-00716', '/nkj-design-samples/gold-mens-jewellery-00716.jpg',
       'AI-generated gold mens jewellery sample inspiration; not confirmed shop inventory.',
       '48c9735e233457c01819184526d2f6d108af72cb35839cc4b1bf9c94b21644fb'),
      ('NKJ-GOLD-00717', '/nkj-design-samples/gold-mens-jewellery-00717.jpg',
       'AI-generated gold mens jewellery sample inspiration; not confirmed shop inventory.',
       '2731031d7d9c7e7dcf785abb38b95f0c317b8e4a3d5e31519c5d85931d68597c'),
      ('NKJ-GOLD-00718', '/nkj-design-samples/gold-mens-jewellery-00718.jpg',
       'AI-generated gold mens jewellery sample inspiration; not confirmed shop inventory.',
       'ea6d2505006046b25630d71942306f2d47d38dccd1419411750beb5a5c356015'),
      ('NKJ-GOLD-00719', '/nkj-design-samples/gold-mens-jewellery-00719.jpg',
       'AI-generated gold mens jewellery sample inspiration; not confirmed shop inventory.',
       '54954bd84c73155f619f27f049505f18b31bd50b5209440bdf4200eaf2f8ed29'),
      ('NKJ-GOLD-00720', '/nkj-design-samples/gold-mens-jewellery-00720.jpg',
       'AI-generated gold mens jewellery sample inspiration; not confirmed shop inventory.',
       'd3310fc727ddb430debc37f9347c0e2579a753a27e5cf025189bb8962ed269fc')
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
