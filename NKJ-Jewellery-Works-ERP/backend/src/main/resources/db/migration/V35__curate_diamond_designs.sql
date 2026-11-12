-- V35: curate 25 category-specific Indian Diamond concepts across all 22 approved Diamond subcategories.
-- Existing IDs, codes, images and owner-managed records remain unchanged.
WITH category_designs(subcategory_slug, design_names) AS (
    VALUES
      ('rings', ARRAY['Round Brilliant Solitaire Ring', 'Oval Halo Diamond Ring', 'Princess Cut Pavé Ring', 'Emerald Cut Three-Stone Ring', 'Pear Shape Diamond Cocktail Ring', 'Cushion Halo Diamond Ring', 'Marquise Floral Cluster Ring', 'Radiant Cut Split Shank Ring', 'Pear Halo Engagement Ring', 'Baguette Side Stone Band', 'Vintage Milgrain Diamond Ring', 'Floral Cluster Diamond Ring', 'Hidden Halo Diamond Ring', 'Bezel Set Minimal Diamond Ring', 'Twisted Pavé Band Ring', 'East-West Oval Diamond Ring', 'Five Stone Anniversary Ring', 'Toi et Moi Diamond Ring', 'Cathedral Setting Diamond Ring', 'Petal Basket Diamond Ring', 'Channel Set Diamond Band', 'Geometric Modern Diamond Ring', 'Men''s Signet Diamond Ring', 'Contemporary Sculpted Diamond Ring', 'Heirloom Bridal Diamond Ring']::TEXT[]),
      ('solitaire-rings', ARRAY['Classic Round Solitaire Ring', 'Oval Brilliant Solitaire Ring', 'Princess Cut Solitaire Ring', 'Emerald Cut Solitaire Ring', 'Pear Shape Solitaire Ring', 'Marquise Solitaire Ring', 'Cushion Cut Solitaire Ring', 'Radiant Cut Solitaire Ring', 'Asscher Cut Solitaire Ring', 'Heart Shape Solitaire Ring', 'Old Mine Cut Solitaire Ring', 'Bezel Set Solitaire Ring', 'Six Prong Solitaire Ring', 'Four Prong Basket Solitaire Ring', 'Cathedral Solitaire Ring', 'East-West Solitaire Ring', 'Hidden Halo Solitaire Ring', 'Knife Edge Solitaire Ring', 'Tapered Baguette Solitaire Ring', 'Petite Solitaire Ring', 'Low Profile Solitaire Ring', 'Twist Shank Solitaire Ring', 'Vintage Milgrain Solitaire Ring', 'Three Prong Pear Solitaire Ring', 'Contemporary Minimal Solitaire Ring']::TEXT[]),
      ('engagement-rings', ARRAY['Classic Round Engagement Ring', 'Oval Halo Engagement Ring', 'Princess Cut Engagement Ring', 'Emerald Cut Solitaire Engagement Ring', 'Pear Shape Bridal Ring', 'Cushion Halo Engagement Ring', 'Marquise Floral Engagement Ring', 'Radiant Cut Split Shank Ring', 'East-West Oval Engagement Ring', 'Toi et Moi Engagement Ring', 'Hidden Halo Proposal Ring', 'Three Stone Past Present Future Ring', 'Cathedral Bridal Setting Ring', 'Vintage Milgrain Engagement Ring', 'Petal Basket Diamond Ring', 'Bezel Set Minimal Engagement Ring', 'Twisted Pavé Engagement Ring', 'Baguette Side Stone Engagement Ring', 'Cluster Halo Engagement Ring', 'Open Gallery Engagement Ring', 'Double Halo Bridal Ring', 'Knife Edge Solitaire Engagement Ring', 'Contemporary Sculpted Engagement Ring', 'Heirloom Inspired Engagement Ring', 'Low Profile Everyday Engagement Ring']::TEXT[]),
      ('wedding-bands', ARRAY['Classic Round Diamond Wedding Band', 'Half Eternity Pavé Band', 'Full Eternity Diamond Band', 'Channel Set Princess Band', 'Baguette Alternating Wedding Band', 'Curved Shadow Wedding Band', 'Contour Nesting Diamond Band', 'Milgrain Vintage Wedding Band', 'Twisted Rope Diamond Band', 'Shared Prong Eternity Band', 'Bezel Set Diamond Wedding Band', 'Chevron V Shape Diamond Band', 'Scalloped Pavé Wedding Band', 'Five Stone Anniversary Band', 'East-West Baguette Band', 'Geometric Modern Wedding Band', 'Petite Micro Pavé Band', 'Double Row Diamond Band', 'Matte Finish Diamond Accent Band', 'Men''s Brushed Diamond Band', 'Two-Tone Wedding Band', 'Floral Engraved Diamond Band', 'Stackable Diamond Wedding Band', 'Low Profile Comfort Fit Band', 'Heritage Milgrain Wedding Band']::TEXT[]),
      ('necklaces', ARRAY['Classic Diamond Tennis Necklace', 'Floral Cluster Diamond Necklace', 'Graduated Riviera Necklace', 'Pear Shape Drop Diamond Necklace', 'Heart Motif Diamond Necklace', 'Halo Station Diamond Necklace', 'Baguette Line Diamond Necklace', 'Emerald Cut Collar Necklace', 'Pearl and Diamond Necklace', 'Leaf Motif Pavé Necklace', 'Geometric Openwork Diamond Necklace', 'Contemporary Bar Diamond Necklace', 'Vintage Milgrain Diamond Necklace', 'Illusion Set Diamond Necklace', 'Diamond Fringe Statement Necklace', 'Bezel Set Solitaire Station Necklace', 'Marquise Floral Diamond Necklace', 'Double Row Pavé Necklace', 'Rose Motif Diamond Necklace', 'Sapphire Accent Diamond Necklace', 'Minimal Everyday Diamond Necklace', 'South Indian Bridal Diamond Haar', 'Rajasthani Polki Look Diamond Necklace', 'Layered Diamond Lariat Necklace', 'Heirloom Bridal Diamond Necklace']::TEXT[]),
      ('necklace-sets', ARRAY['Diamond Tennis Necklace Set', 'Floral Cluster Bridal Necklace Set', 'Pear Shape Pendant Necklace Set', 'Emerald Cut Collar Necklace Set', 'Halo Station Necklace Set', 'Baguette Line Necklace Set', 'Leaf Motif Pavé Necklace Set', 'Pearl and Diamond Necklace Set', 'Vintage Milgrain Necklace Set', 'Double Row Bridal Necklace Set', 'Riviera Necklace and Stud Set', 'Marquise Floral Necklace Set', 'Heart Motif Pendant Necklace Set', 'Geometric Openwork Necklace Set', 'Rose Motif Diamond Necklace Set', 'Sapphire Accent Necklace Set', 'Minimal Diamond Pendant Set', 'Illusion Set Bridal Necklace Set', 'South Indian Diamond Haar Set', 'Rajasthani Polki Look Set', 'Contemporary Lariat Necklace Set', 'Heirloom Wedding Necklace Set', 'Graduated Diamond Collar Set', 'Pear Drop Evening Necklace Set', 'Signature Diamond Bridal Set']::TEXT[]),
      ('pendants', ARRAY['Round Solitaire Diamond Pendant', 'Heart Shape Diamond Pendant', 'Pear Halo Diamond Pendant', 'Emerald Cut Bezel Pendant', 'Baguette Bar Diamond Pendant', 'Floral Cluster Diamond Pendant', 'Marquise Leaf Diamond Pendant', 'Princess Cut Solitaire Pendant', 'Cushion Halo Diamond Pendant', 'Illusion Set Diamond Pendant', 'Bezel Set Minimal Pendant', 'Open Circle Diamond Pendant', 'Infinity Motif Diamond Pendant', 'Cross Diamond Pendant', 'Starburst Diamond Pendant', 'Initial Letter Diamond Pendant', 'Three Stone Diamond Pendant', 'Pearl Drop Diamond Pendant', 'Geometric Kite Pendant', 'Vintage Milgrain Pendant', 'East-West Oval Pendant', 'Petal Basket Diamond Pendant', 'South Indian Lakshmi Diamond Pendant', 'Contemporary Lariat Pendant', 'Heirloom Solitaire Pendant']::TEXT[]),
      ('earrings', ARRAY['Round Brilliant Halo Earrings', 'Oval Diamond Drop Earrings', 'Princess Cut Cluster Earrings', 'Emerald Cut Line Earrings', 'Pear Shape Diamond Drops', 'Marquise Floral Cluster Earrings', 'Baguette Fan Earrings', 'Cushion Halo Earrings', 'Illusion Set Diamond Earrings', 'Pearl and Diamond Drop Earrings', 'Leaf Motif Pavé Earrings', 'Geometric Openwork Earrings', 'Vintage Milgrain Diamond Earrings', 'Bezel Set Minimal Earrings', 'Double Row Pavé Earrings', 'Rose Motif Diamond Earrings', 'Sapphire Accent Diamond Earrings', 'South Indian Bridal Diamond Earrings', 'Rajasthani Polki Look Earrings', 'Contemporary Sculpted Diamond Earrings', 'Three Stone Diamond Earrings', 'Channel Set Diamond Earrings', 'Starburst Diamond Earrings', 'Petal Basket Diamond Earrings', 'Heirloom Statement Diamond Earrings']::TEXT[]),
      ('studs', ARRAY['Classic Round Diamond Studs', 'Princess Cut Diamond Studs', 'Emerald Cut Bezel Studs', 'Oval Halo Diamond Studs', 'Pear Shape Diamond Studs', 'Cushion Halo Stud Earrings', 'Marquise Cluster Diamond Studs', 'Baguette Frame Diamond Studs', 'Flower Cluster Diamond Studs', 'Four Prong Solitaire Studs', 'Six Prong Solitaire Studs', 'Bezel Set Minimal Studs', 'Illusion Set Diamond Studs', 'Pearl Center Diamond Studs', 'Heart Shape Diamond Studs', 'Starburst Diamond Studs', 'Leaf Motif Pavé Studs', 'Vintage Milgrain Diamond Studs', 'Geometric Kite Diamond Studs', 'South Indian Floral Diamond Studs', 'Sapphire Accent Diamond Studs', 'Petite Daily Wear Diamond Studs', 'Contemporary Bar Diamond Studs', 'Double Halo Diamond Studs', 'Heirloom Cluster Diamond Studs']::TEXT[]),
      ('drop-earrings', ARRAY['Pear Shape Halo Drop Earrings', 'Oval Diamond Line Drops', 'Emerald Cut Drop Earrings', 'Baguette Fan Drop Earrings', 'Marquise Floral Drop Earrings', 'Cushion Halo Drop Earrings', 'Graduated Diamond Teardrops', 'Pearl and Diamond Drops', 'Leaf Motif Pavé Drops', 'Vintage Milgrain Drop Earrings', 'Geometric Openwork Drops', 'Double Row Diamond Drops', 'Illusion Set Drop Earrings', 'Bezel Set Solitaire Drops', 'Floral Cluster Statement Drops', 'South Indian Bridal Diamond Drops', 'Rajasthani Polki Look Drops', 'Sapphire Accent Drop Earrings', 'Long Linear Diamond Drops', 'Contemporary Bar Drop Earrings', 'Rose Motif Diamond Drops', 'Channel Set Diamond Drops', 'Petal Basket Diamond Drops', 'Low Profile Daily Diamond Drops', 'Heirloom Evening Drop Earrings']::TEXT[]),
      ('jhumkas', ARRAY['Diamond Halo Dome Jhumkas', 'Pearl Fringe Diamond Jhumkas', 'Floral Cluster Diamond Jhumkas', 'Baguette Temple Jhumkas', 'South Indian Bridal Diamond Jhumkas', 'Rajasthani Polki Look Diamond Jhumkas', 'Pear Shape Drop Jhumkas', 'Emerald Cut Accent Jhumkas', 'Marquise Peacock Diamond Jhumkas', 'Lotus Motif Pavé Jhumkas', 'Vintage Milgrain Diamond Jhumkas', 'Double Row Halo Jhumkas', 'Openwork Diamond Dome Jhumkas', 'Illusion Set Bridal Jhumkas', 'Pearl and Diamond Ghungroo Jhumkas', 'Leaf Motif Diamond Jhumkas', 'Channel Set Bell Jhumkas', 'Sapphire Accent Diamond Jhumkas', 'Minimal Diamond Bell Jhumkas', 'Contemporary Geometric Jhumkas', 'Grand Wedding Diamond Jhumkas', 'Petal Basket Diamond Jhumkas', 'Graduated Drop Diamond Jhumkas', 'Heirloom Temple Diamond Jhumkas', 'Signature Cluster Diamond Jhumkas']::TEXT[]),
      ('bracelets', ARRAY['Classic Diamond Link Bracelet', 'Floral Cluster Diamond Bracelet', 'Oval Bezel Station Bracelet', 'Baguette Bar Diamond Bracelet', 'Pear Shape Motif Bracelet', 'Marquise Leaf Pavé Bracelet', 'Vintage Milgrain Link Bracelet', 'Geometric Openwork Bracelet', 'Double Row Diamond Bracelet', 'Illusion Set Diamond Bracelet', 'Bezel Set Minimal Bracelet', 'Emerald Cut Station Bracelet', 'Sapphire Accent Diamond Bracelet', 'Pearl and Diamond Bracelet', 'Twisted Pavé Link Bracelet', 'Heart Motif Diamond Bracelet', 'Channel Set Diamond Bracelet', 'South Indian Floral Diamond Bracelet', 'Contemporary Sculpted Bracelet', 'Men''s Brushed Diamond Bracelet', 'East-West Baguette Bracelet', 'Rose Motif Diamond Bracelet', 'Graduated Cluster Bracelet', 'Low Profile Daily Diamond Bracelet', 'Heirloom Bridal Diamond Bracelet']::TEXT[]),
      ('tennis-bracelets', ARRAY['Classic Four Prong Tennis Bracelet', 'Bezel Set Tennis Bracelet', 'Oval Diamond Tennis Bracelet', 'Emerald Cut Tennis Bracelet', 'Baguette Alternating Tennis Bracelet', 'Pear Shape Tennis Bracelet', 'Half Bezel Tennis Bracelet', 'Graduated Diamond Tennis Bracelet', 'Double Row Tennis Bracelet', 'Three Row Pavé Tennis Bracelet', 'Shared Prong Tennis Bracelet', 'Channel Set Tennis Bracelet', 'Scalloped Tennis Bracelet', 'Vintage Milgrain Tennis Bracelet', 'East-West Baguette Tennis Bracelet', 'Sapphire Accent Tennis Bracelet', 'Mixed Cut Diamond Tennis Bracelet', 'Flexible Link Tennis Bracelet', 'Low Profile Daily Tennis Bracelet', 'Bold Statement Tennis Bracelet', 'White Gold Tennis Bracelet Concept', 'Yellow Gold Tennis Bracelet Concept', 'Rose Gold Tennis Bracelet Concept', 'Hidden Clasp Tennis Bracelet', 'Heirloom Diamond Tennis Bracelet']::TEXT[]),
      ('bangles', ARRAY['Classic Diamond Line Bangle', 'Bengal Cut Style Diamond Bangle', 'Floral Cluster Pavé Bangle', 'Baguette Channel Set Bangle', 'Oval Halo Diamond Bangle', 'Emerald Cut Station Bangle', 'Double Row Diamond Bangle', 'Twisted Pavé Gold Bangle', 'Open Cuff Diamond Bangle', 'Bezel Set Minimal Bangle', 'Vintage Milgrain Diamond Bangle', 'Leaf Motif Diamond Bangle', 'Marquise Peacock Diamond Bangle', 'Pear Shape Accent Bangle', 'South Indian Bridal Diamond Bangle', 'Rajasthani Polki Look Bangle', 'Sapphire Accent Diamond Bangle', 'Geometric Openwork Bangle', 'Matte and Diamond Accent Bangle', 'Stackable Petite Diamond Bangle', 'Scalloped Eternity Bangle', 'Heart Motif Diamond Bangle', 'Contemporary Sculpted Bangle', 'Wide Statement Bridal Bangle', 'Heirloom Diamond Bangle']::TEXT[]),
      ('kada', ARRAY['Men''s Diamond Accent Kada', 'Classic Pavé Diamond Kada', 'Baguette Channel Set Kada', 'Bezel Set Diamond Cuff Kada', 'Brushed Gold Diamond Kada', 'Two-Tone Diamond Kada', 'Geometric Openwork Diamond Kada', 'Oval Station Diamond Kada', 'Emerald Cut Accent Kada', 'South Indian Bridal Diamond Kada', 'Rajasthani Polki Look Kada', 'Floral Cluster Diamond Kada', 'Double Row Pavé Kada', 'Matte Finish Diamond Kada', 'Knife Edge Diamond Kada', 'Minimal Sleek Diamond Kada', 'Vintage Milgrain Diamond Kada', 'Sapphire Accent Diamond Kada', 'Open Cuff Diamond Kada', 'Men''s Signet Edge Diamond Kada', 'Contemporary Sculpted Kada', 'Heritage Engraved Diamond Kada', 'Graduated Diamond Line Kada', 'Wide Statement Bridal Kada', 'Heirloom Diamond Kada']::TEXT[]),
      ('mangalsutra', ARRAY['Classic Black Bead Diamond Mangalsutra', 'Solitaire Pendant Diamond Mangalsutra', 'Floral Halo Diamond Mangalsutra', 'Bengali Heritage Diamond Mangalsutra', 'Maharashtrian Vati Diamond Mangalsutra', 'South Indian Temple Diamond Mangalsutra', 'Pear Shape Pendant Mangalsutra', 'Emerald Cut Diamond Mangalsutra', 'Two Row Black Bead Mangalsutra', 'Minimal Daily Wear Diamond Mangalsutra', 'Short Chain Diamond Mangalsutra', 'Long Heritage Diamond Mangalsutra', 'Baguette Bar Pendant Mangalsutra', 'Mango Motif Diamond Mangalsutra', 'Lakshmi Motif Diamond Mangalsutra', 'Illusion Set Diamond Mangalsutra', 'Ruby Accent Diamond Mangalsutra', 'Pearl Drop Diamond Mangalsutra', 'Geometric Minimal Mangalsutra', 'Double Pendant Diamond Mangalsutra', 'Contemporary Lariat Mangalsutra', 'Lightweight Office Wear Mangalsutra', 'Bridal Pavé Mangalsutra', 'Vintage Milgrain Mangalsutra', 'Heirloom Diamond Mangalsutra']::TEXT[]),
      ('nose-pins', ARRAY['Classic Solitaire Diamond Nose Pin', 'Round Halo Diamond Nose Stud', 'Princess Cut Diamond Nose Pin', 'Pear Shape Diamond Nose Pin', 'Bezel Set Minimal Nose Pin', 'Four Prong Diamond Nose Stud', 'Six Prong Solitaire Nose Pin', 'Heart Motif Diamond Nose Pin', 'Flower Cluster Diamond Nose Pin', 'Marquise Leaf Diamond Nose Pin', 'Baguette Accent Nose Pin', 'Illusion Set Diamond Nose Pin', 'Tiny Pavé Diamond Nose Pin', 'Starburst Diamond Nose Stud', 'South Indian Mukkuthi Diamond Pin', 'Maharashtrian Nathni Diamond Pin', 'Bengali Phool Diamond Nose Pin', 'Rajasthani Kundan Look Nose Pin', 'Open Circle Diamond Nose Pin', 'Pearl Accent Diamond Nose Pin', 'Geometric Bar Diamond Nose Pin', 'Low Profile Daily Diamond Nose Pin', 'Sapphire Accent Nose Pin', 'Contemporary Minimal Nose Pin', 'Heirloom Diamond Nose Stud']::TEXT[]),
      ('nath', ARRAY['Maharashtrian Bridal Diamond Nath', 'Bengali Diamond Nath', 'Rajasthani Kundan Look Diamond Nath', 'Punjabi Bridal Diamond Nath', 'South Indian Temple Diamond Nath', 'Pearl Fringe Diamond Nath', 'Ruby Accent Diamond Nath', 'Emerald Cut Diamond Nath', 'Pear Halo Diamond Nath', 'Floral Cluster Pavé Nath', 'Baguette Crescent Diamond Nath', 'Vintage Milgrain Diamond Nath', 'Marquise Peacock Diamond Nath', 'Openwork Diamond Crescent Nath', 'Illusion Set Bridal Nath', 'Double Row Pavé Nath', 'Heart Motif Diamond Nath', 'Minimal Lightweight Diamond Nath', 'Sapphire Accent Diamond Nath', 'Pearl Chain Diamond Nath', 'Temple Motif Diamond Nath', 'Contemporary Sculpted Diamond Nath', 'Heirloom Wedding Diamond Nath', 'Grand Statement Bridal Nath', 'Signature Halo Diamond Nath']::TEXT[]),
      ('maang-tikka', ARRAY['Round Halo Diamond Maang Tikka', 'Pear Shape Diamond Maang Tikka', 'Emerald Cut Bridal Tikka', 'Marquise Floral Diamond Tikka', 'Baguette Fan Maang Tikka', 'Princess Cut Solitaire Tikka', 'Vintage Milgrain Diamond Tikka', 'South Indian Temple Diamond Tikka', 'Rajasthani Polki Look Diamond Tikka', 'Punjabi Matha Patti Diamond Tikka', 'Bengali Tikli Diamond Tikka', 'Pearl Fringe Diamond Tikka', 'Double Row Pavé Tikka', 'Lotus Motif Diamond Tikka', 'Peacock Motif Diamond Tikka', 'Illusion Set Bridal Tikka', 'Sapphire Accent Maang Tikka', 'Geometric Modern Tikka', 'Minimal Petite Diamond Tikka', 'Openwork Crescent Tikka', 'Heart Motif Diamond Tikka', 'Channel Set Bridal Tikka', 'Heirloom Wedding Maang Tikka', 'Grand Bridal Matha Patti', 'Signature Cluster Diamond Tikka']::TEXT[]),
      ('bridal-sets', ARRAY['South Indian Diamond Bridal Set', 'Rajasthani Polki Look Diamond Set', 'Bengali Heirloom Diamond Bridal Set', 'Punjabi Bridal Diamond Necklace Set', 'Maharashtrian Peshwai Diamond Set', 'Emerald Cut Bridal Necklace Set', 'Pear Shape Halo Bridal Set', 'Floral Cluster Pavé Bridal Set', 'Baguette Line Bridal Necklace Set', 'Ruby Accent Diamond Bridal Set', 'Sapphire Accent Wedding Set', 'Pearl and Diamond Bridal Set', 'Vintage Milgrain Bridal Set', 'Double Row Riviera Bridal Set', 'Temple Motif Diamond Bridal Set', 'Marquise Peacock Bridal Set', 'Illusion Set Bridal Necklace Set', 'Contemporary Minimal Wedding Set', 'Grand Diamond Choker Bridal Set', 'Layered Diamond Lariat Bridal Set', 'Halo Pendant Bridal Set', 'Geometric Openwork Bridal Set', 'Heirloom Wedding Diamond Set', 'Signature Solitaire Bridal Set', 'Classic Riviera Bridal Collection']::TEXT[]),
      ('men-s-rings', ARRAY['Classic Men''s Solitaire Diamond Ring', 'Brushed Gold Diamond Signet Ring', 'Black Onyx Diamond Men''s Ring', 'Princess Cut Men''s Diamond Ring', 'Baguette Channel Men''s Band', 'Geometric Pavé Men''s Ring', 'Two-Tone Diamond Signet Ring', 'Matte Finish Diamond Band', 'Emerald Cut Men''s Statement Ring', 'Cushion Halo Men''s Ring', 'Bezel Set Minimal Men''s Ring', 'Men''s Three Stone Diamond Ring', 'Bengal Heritage Engraved Ring', 'South Indian Temple Motif Men''s Ring', 'Rajasthani Polki Look Men''s Ring', 'Sapphire Accent Men''s Ring', 'Black Enamel Diamond Signet Ring', 'Openwork Geometric Men''s Ring', 'Knife Edge Diamond Men''s Band', 'Men''s Square Cluster Ring', 'Vintage Milgrain Men''s Ring', 'Contemporary Sculpted Men''s Ring', 'Low Profile Daily Diamond Ring', 'Heirloom Wedding Men''s Ring', 'Bold Statement Diamond Signet']::TEXT[]),
      ('men-s-bracelets', ARRAY['Classic Men''s Diamond Link Bracelet', 'Brushed Gold Diamond Bar Bracelet', 'Black Onyx Diamond Men''s Bracelet', 'Baguette Channel Men''s Bracelet', 'Geometric Pavé Men''s Cuff', 'Two-Tone Diamond Link Bracelet', 'Matte Finish Diamond Kada Bracelet', 'Bezel Set Men''s Station Bracelet', 'Emerald Cut Men''s Bracelet', 'Cuban Link Diamond Accent Bracelet', 'Minimal ID Plate Diamond Bracelet', 'Men''s Signet Charm Bracelet', 'South Indian Heritage Link Bracelet', 'Rajasthani Engraved Diamond Bracelet', 'Bengal Engraved Men''s Bracelet', 'Sapphire Accent Men''s Bracelet', 'Openwork Geometric Men''s Cuff', 'Knife Edge Diamond Link Bracelet', 'Vintage Milgrain Men''s Bracelet', 'Contemporary Sculpted Men''s Bracelet', 'Low Profile Daily Diamond Bracelet', 'Bold Pavé Men''s Bracelet', 'Men''s Tennis Link Bracelet', 'Heirloom Wedding Men''s Bracelet', 'Signature Diamond Cuff Bracelet']::TEXT[])
),
concepts AS (
    SELECT c.id AS category_id,
           c.metal_type,
           c.subcategory_name,
           x.design_name,
           x.sequence_no
      FROM category_designs cd
      JOIN public.jewellery_design_categories c
        ON c.metal_type = 'DIAMOND' AND c.slug = cd.subcategory_slug
      CROSS JOIN LATERAL UNNEST(cd.design_names)
           WITH ORDINALITY AS x(design_name, sequence_no)
),
classified AS (
    SELECT *,
       CASE
         WHEN design_name ILIKE '%Bengali%' THEN 'Bengali'
         WHEN design_name ILIKE '%South Indian%' OR design_name ILIKE '%Temple%' THEN 'South Indian'
         WHEN design_name ILIKE '%Rajasthani%' OR design_name ILIKE '%Polki%' THEN 'Rajasthani'
         WHEN design_name ILIKE '%Maharashtrian%' OR design_name ILIKE '%Peshwai%' THEN 'Maharashtrian'
         WHEN design_name ILIKE '%Punjabi%' THEN 'Punjabi'
         ELSE 'Pan-Indian'
       END AS regional,
       CASE
         WHEN design_name ILIKE '%Solitaire%' THEN 'Solitaire'
         WHEN design_name ILIKE '%Halo%' OR design_name ILIKE '%Hidden Halo%' THEN 'Halo'
         WHEN design_name ILIKE '%Pavé%' OR design_name ILIKE '%Pave%' THEN 'Pavé & micro-setting'
         WHEN design_name ILIKE '%Baguette%' OR design_name ILIKE '%Channel Set%' THEN 'Baguette & channel setting'
         WHEN design_name ILIKE '%Cluster%' OR design_name ILIKE '%Floral%' OR design_name ILIKE '%Petal%' THEN 'Cluster & floral'
         WHEN design_name ILIKE '%Tennis%' OR design_name ILIKE '%Eternity%' THEN 'Tennis & eternity'
         WHEN design_name ILIKE '%Bridal%' OR design_name ILIKE '%Wedding%' OR design_name ILIKE '%Grand%' THEN 'Bridal & occasion'
         WHEN design_name ILIKE '%Minimal%' OR design_name ILIKE '%Daily%' OR design_name ILIKE '%Low Profile%' THEN 'Minimal & daily wear'
         WHEN design_name ILIKE '%Polki%' OR design_name ILIKE '%Temple%' OR design_name ILIKE '%Heritage%' THEN 'Traditional & heritage'
         WHEN design_name ILIKE '%Geometric%' OR design_name ILIKE '%Contemporary%' OR design_name ILIKE '%Sculpted%' THEN 'Contemporary'
         WHEN design_name ILIKE '%Vintage%' OR design_name ILIKE '%Milgrain%' THEN 'Vintage & milgrain'
         ELSE 'Classic diamond setting'
       END AS style
      FROM concepts
)
UPDATE public.jewellery_designs d
   SET design_name = x.design_name,
       description = 'Catalogue inspiration concept: ' || x.design_name || '. ' ||
           x.subcategory_name || ' in the Diamond collection, drawing on ' ||
           x.style || ' design language. Reference concept only; natural or lab-grown origin, stone count, carat weight, colour, clarity, cut, certification, setting metal and availability must be verified for a finished piece.',
       style_label = x.style,
       regional_inspiration = x.regional,
       material_label = 'Diamond concept · natural/lab-grown origin and grading not specified',
       keywords = CONCAT_WS(', ', 'DIAMOND', x.subcategory_name, x.design_name, x.style, x.regional,
                            'Indian diamond jewellery design inspiration'),
       image_status = CASE WHEN EXISTS (
           SELECT 1 FROM public.jewellery_design_images i
            WHERE i.design_id = d.id
              AND (
                  i.original_url LIKE '/api/uploads/designs/%'
                  OR i.display_url LIKE '/api/uploads/designs/%'
                  OR i.thumbnail_url LIKE '/api/uploads/designs/%'
              )
       ) THEN 'READY' ELSE 'PENDING' END,
       updated_at = NOW()
  FROM classified x
 WHERE d.category_id = x.category_id
   AND d.is_sample = TRUE
   AND d.is_deleted = FALSE
   AND substring(d.design_id FROM '([0-9]+)$')::INTEGER = x.sequence_no;

DO $$
DECLARE
    category_count INTEGER;
    incomplete_count INTEGER;
    duplicate_names INTEGER;
BEGIN
    SELECT COUNT(*) INTO category_count
      FROM public.jewellery_design_categories
     WHERE metal_type = 'DIAMOND';
    IF category_count <> 22 THEN
        RAISE EXCEPTION 'Diamond catalogue expected 22 active subcategories; found %', category_count;
    END IF;

    SELECT COUNT(*) INTO incomplete_count
      FROM (
        SELECT c.id
          FROM public.jewellery_design_categories c
          LEFT JOIN public.jewellery_designs d
            ON d.category_id = c.id
           AND d.is_sample = TRUE
           AND d.is_deleted = FALSE
           AND substring(d.design_id FROM '([0-9]+)$')::INTEGER BETWEEN 1 AND 25
         WHERE c.metal_type = 'DIAMOND'
         GROUP BY c.id
        HAVING COUNT(d.id) < 25
      ) q;
    IF incomplete_count > 0 THEN
        RAISE EXCEPTION 'Diamond catalogue incomplete: % subcategories have fewer than 25 curated sample designs', incomplete_count;
    END IF;

    SELECT COUNT(*) INTO duplicate_names
      FROM (
        SELECT d.category_id, LOWER(BTRIM(d.design_name))
          FROM public.jewellery_designs d
          JOIN public.jewellery_design_categories c ON c.id = d.category_id
         WHERE c.metal_type = 'DIAMOND'
           AND d.is_sample = TRUE
           AND d.is_deleted = FALSE
           AND substring(d.design_id FROM '([0-9]+)$')::INTEGER BETWEEN 1 AND 25
         GROUP BY d.category_id, LOWER(BTRIM(d.design_name))
        HAVING COUNT(*) > 1
      ) q;
    IF duplicate_names > 0 THEN
        RAISE EXCEPTION 'Diamond catalogue contains % duplicated design-name groups among curated sample IDs', duplicate_names;
    END IF;
END $$;
