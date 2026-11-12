-- V30: attach original generated sample photographs to the ten Gold designs
-- visible in the catalogue screenshot. These remain inspiration samples, not stock.
-- The migration is idempotent by design_code and image digest.

WITH photo_targets(design_code, image_path, alt_text, image_sha256) AS (
    VALUES
      ('NKJ-GOLD-00721', '/nkj-design-samples/gold-locket-00721.jpg',
       'AI-generated gold locket sample inspiration; not confirmed shop inventory.',
       '81465ac021ebb8d352310e9eb2d0a50cc3d2f0b7e1f809f36b56893b7d8c7710'),
      ('NKJ-GOLD-00722', '/nkj-design-samples/gold-locket-00722.jpg',
       'AI-generated gold locket sample inspiration; not confirmed shop inventory.',
       'cdac0fbfa9b39ce347cd4861591eb4fd79f5d1269338a34e746d8d7024e9c8bf'),
      ('NKJ-GOLD-00723', '/nkj-design-samples/gold-locket-00723.jpg',
       'AI-generated gold locket sample inspiration; not confirmed shop inventory.',
       'e0bcf603713d8926c3f1ceb574bf744377b1b68e2520614760f7c503a6997c90'),
      ('NKJ-GOLD-00724', '/nkj-design-samples/gold-locket-00724.jpg',
       'AI-generated gold locket sample inspiration; not confirmed shop inventory.',
       '7a657a473471455ec0a9a4370476ceb28601d7fb36f3483c6b1d4e51b01f945d'),
      ('NKJ-GOLD-00725', '/nkj-design-samples/gold-locket-00725.jpg',
       'AI-generated gold locket sample inspiration; not confirmed shop inventory.',
       '880ab61df5d279b53af5ac6fcdefebb65ed870b09cb5b03dd4267ecf1b9977e5'),
      ('NKJ-GOLD-00716', '/nkj-design-samples/gold-mens-jewellery-00716.jpg',
       'AI-generated gold mens jewellery sample inspiration; not confirmed shop inventory.',
       'dc9816308213144a50a75c6907e8ebe8a17728cf43fe2563281b847c97480a91'),
      ('NKJ-GOLD-00717', '/nkj-design-samples/gold-mens-jewellery-00717.jpg',
       'AI-generated gold mens jewellery sample inspiration; not confirmed shop inventory.',
       '185b6272b9feb7ffb23bd6331bab72758cfdd67e1652d70efdac94e1ca49d4aa'),
      ('NKJ-GOLD-00718', '/nkj-design-samples/gold-mens-jewellery-00718.jpg',
       'AI-generated gold mens jewellery sample inspiration; not confirmed shop inventory.',
       'e3713e34d1112c997155f7666a17489cc3f52de62082b22ad7a43d19a714d663'),
      ('NKJ-GOLD-00719', '/nkj-design-samples/gold-mens-jewellery-00719.jpg',
       'AI-generated gold mens jewellery sample inspiration; not confirmed shop inventory.',
       'e0d10414195c36aa48d2fa1243b143df2bed3c698e7cca349a72b00ca4701f50'),
      ('NKJ-GOLD-00720', '/nkj-design-samples/gold-mens-jewellery-00720.jpg',
       'AI-generated gold mens jewellery sample inspiration; not confirmed shop inventory.',
       'e0055dae552f10b66ea73c955d0739d85a4c935154f50ab0c1b78d789d540263')
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
