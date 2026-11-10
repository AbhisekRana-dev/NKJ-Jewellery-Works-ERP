-- V30: attach original generated sample photographs to the ten Gold designs
-- visible in the catalogue screenshot. These remain inspiration samples, not stock.
-- The migration is idempotent by design_code and image digest.

WITH photo_targets(design_code, image_path, alt_text, image_sha256) AS (
    VALUES
      ('NKJ-GOLD-00721', '/nkj-design-samples/gold-locket-00721.jpg',
       'AI-generated gold locket sample inspiration; not confirmed shop inventory.',
       'dc29e92bbc3d07f9ef590e1847d8e033f88c32b8'),
      ('NKJ-GOLD-00722', '/nkj-design-samples/gold-locket-00722.jpg',
       'AI-generated gold locket sample inspiration; not confirmed shop inventory.',
       '083eb62db42bbbb19c65c7633fb90868e845f84d1a68334c5019a6c8068f91c6'),
      ('NKJ-GOLD-00723', '/nkj-design-samples/gold-locket-00723.jpg',
       'AI-generated gold locket sample inspiration; not confirmed shop inventory.',
       '4bf36732dde9f6a5398bce0ecf7aabdc419c8522193a6bdfbda7d873aedb1c09'),
      ('NKJ-GOLD-00724', '/nkj-design-samples/gold-locket-00724.jpg',
       'AI-generated gold locket sample inspiration; not confirmed shop inventory.',
       'acbef65d4fd17db08f7137a1f664dff4b74cb0cf5b74a7a36b352b8d4e6749cb'),
      ('NKJ-GOLD-00725', '/nkj-design-samples/gold-locket-00725.jpg',
       'AI-generated gold locket sample inspiration; not confirmed shop inventory.',
       '34a463fc1fa7510bb17b79d45911ce62a89dafc43f5be9a5da45c7f3cda65868'),
      ('NKJ-GOLD-00716', '/nkj-design-samples/gold-mens-jewellery-00716.jpg',
       'AI-generated gold mens jewellery sample inspiration; not confirmed shop inventory.',
       'cad8d06f8fed7a41876fb3b233ab5c9a9465ebd25560213f10694893054d9a49'),
      ('NKJ-GOLD-00717', '/nkj-design-samples/gold-mens-jewellery-00717.jpg',
       'AI-generated gold mens jewellery sample inspiration; not confirmed shop inventory.',
       'b4fe49059b4d2a0cdccb021fc3061b9fd11fd30b6ec9436b962ca8ebd31b9979'),
      ('NKJ-GOLD-00718', '/nkj-design-samples/gold-mens-jewellery-00718.jpg',
       'AI-generated gold mens jewellery sample inspiration; not confirmed shop inventory.',
       '0a539bb95eee983bdb554ec9782db0aa437823c740809d96f9cc5429ce8c133c'),
      ('NKJ-GOLD-00719', '/nkj-design-samples/gold-mens-jewellery-00719.jpg',
       'AI-generated gold mens jewellery sample inspiration; not confirmed shop inventory.',
       '1cb002a72407436c100ffe4bfddee68eff8324a4298a333bd7d19aee7ff1e737'),
      ('NKJ-GOLD-00720', '/nkj-design-samples/gold-mens-jewellery-00720.jpg',
       'AI-generated gold mens jewellery sample inspiration; not confirmed shop inventory.',
       '1b7367b47c1a19e84fa7b7ec3d1c59898f5688f4d9de42349691180ec6ff9b80')
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
