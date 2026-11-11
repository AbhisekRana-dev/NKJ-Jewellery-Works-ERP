
-- V33: enriched Indian Gold catalogue concepts + truthful image-status tracking.
-- Existing design IDs, legacy codes, photographs, prices, weights, and owner-uploaded
-- records are preserved. This migration enriches only the 25 preloaded sample concepts
-- (NKJ_GOLD_<CATEGORY>_0001 .. _0025) in each existing Gold subcategory.

ALTER TABLE public.jewellery_designs
    ADD COLUMN IF NOT EXISTS regional_inspiration VARCHAR(80) NOT NULL DEFAULT 'Pan-Indian',
    ADD COLUMN IF NOT EXISTS material_label VARCHAR(120) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS image_status VARCHAR(16) NOT NULL DEFAULT 'PENDING';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'public.jewellery_designs'::regclass
           AND conname = 'chk_jewellery_design_image_status'
    ) THEN
        ALTER TABLE public.jewellery_designs
            ADD CONSTRAINT chk_jewellery_design_image_status
            CHECK (image_status IN ('PENDING', 'READY'));
    END IF;
END $$;

UPDATE public.jewellery_designs d
   SET image_status = CASE WHEN EXISTS (
       SELECT 1 FROM public.jewellery_design_images i
        WHERE i.design_id = d.id
          AND COALESCE(NULLIF(BTRIM(i.thumbnail_url), ''),
                       NULLIF(BTRIM(i.display_url), ''),
                       NULLIF(BTRIM(i.original_url), '')) IS NOT NULL
   ) THEN 'READY' ELSE 'PENDING' END,
       material_label = CASE
           WHEN c.metal_type = 'GOLD' THEN 'Gold concept · actual karat not specified'
           WHEN c.metal_type = 'SILVER' THEN 'Silver concept · fineness not specified'
           ELSE 'Diamond concept · origin and grading not specified'
       END
  FROM public.jewellery_design_categories c
 WHERE c.id = d.category_id
   AND d.is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_jewellery_designs_regional_inspiration
    ON public.jewellery_designs (LOWER(regional_inspiration));
CREATE INDEX IF NOT EXISTS idx_jewellery_designs_material_label
    ON public.jewellery_designs (LOWER(material_label));
CREATE INDEX IF NOT EXISTS idx_jewellery_designs_style
    ON public.jewellery_designs (LOWER(style_label));

CREATE OR REPLACE FUNCTION public.refresh_jewellery_design_image_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    affected_design_id BIGINT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        affected_design_id := OLD.design_id;
    ELSE
        affected_design_id := NEW.design_id;
    END IF;

    UPDATE public.jewellery_designs d
       SET image_status = CASE WHEN EXISTS (
           SELECT 1 FROM public.jewellery_design_images i
            WHERE i.design_id = affected_design_id
              AND COALESCE(NULLIF(BTRIM(i.thumbnail_url), ''),
                           NULLIF(BTRIM(i.display_url), ''),
                           NULLIF(BTRIM(i.original_url), '')) IS NOT NULL
       ) THEN 'READY' ELSE 'PENDING' END,
           updated_at = NOW()
     WHERE d.id = affected_design_id;

    IF TG_OP = 'UPDATE' AND OLD.design_id <> NEW.design_id THEN
        UPDATE public.jewellery_designs d
           SET image_status = CASE WHEN EXISTS (
               SELECT 1 FROM public.jewellery_design_images i
                WHERE i.design_id = OLD.design_id
                  AND COALESCE(NULLIF(BTRIM(i.thumbnail_url), ''),
                               NULLIF(BTRIM(i.display_url), ''),
                               NULLIF(BTRIM(i.original_url), '')) IS NOT NULL
           ) THEN 'READY' ELSE 'PENDING' END,
               updated_at = NOW()
         WHERE d.id = OLD.design_id;
    END IF;

    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_jewellery_design_image_status
    ON public.jewellery_design_images;
CREATE TRIGGER trg_jewellery_design_image_status
AFTER INSERT OR UPDATE OR DELETE ON public.jewellery_design_images
FOR EACH ROW EXECUTE FUNCTION public.refresh_jewellery_design_image_status();

WITH category_designs(subcategory_slug, design_names) AS (
    VALUES
      ('necklaces', ARRAY['Bengali Sita Haar Necklace', 'South Indian Kasu Mala Necklace', 'Lakshmi Coin Long Necklace', 'Temple Nakshi Collar Necklace', 'Rajasthani Kundan Choker Necklace', 'Meenakari Peacock Choker Necklace', 'Mango Motif Addigai Necklace', 'Antique Jadau Necklace', 'Filigree Floral Necklace', 'Pearl Drop Heritage Necklace', 'Emerald Accent Heirloom Necklace', 'Ruby Bead Traditional Necklace', 'Layered Rani Haar Necklace', 'Satlada Inspired Necklace', 'Hasli Gold Torque Necklace', 'Openwork Leaf Necklace', 'Geometric Minimal Necklace', 'Matte Finish Bridal Necklace', 'Engraved Coin Necklace', 'Bengali Paati Haar Necklace', 'Gujarati Borla Motif Necklace', 'Punjabi Polki Choker Necklace', 'Floral Cluster Statement Necklace', 'Contemporary Collar Necklace', 'Heirloom Gold Statement Necklace']::TEXT[]),
      ('necklace-sets', ARRAY['Temple Lakshmi Necklace Set', 'Bengali Nakshi Necklace Set', 'Rajasthani Kundan Necklace Set', 'Meenakari Peacock Necklace Set', 'Ruby Emerald Bridal Necklace Set', 'Mango Mala Necklace Set', 'Pearl Fringe Necklace Set', 'Antique Coin Necklace Set', 'South Indian Addigai Set', 'Polki Choker Necklace Set', 'Filigree Pendant Necklace Set', 'Floral Collar Necklace Set', 'Layered Rani Haar Set', 'Gujarati Kundan Necklace Set', 'Maharashtrian Thushi Set', 'Punjabi Bridal Necklace Set', 'Lightweight Daily Necklace Set', 'Matte Gold Festive Necklace Set', 'Traditional Kasu Necklace Set', 'Geometric Modern Necklace Set', 'Heritage Bead Necklace Set', 'Nakshi Bridal Necklace Set', 'Temple Pendant Necklace Set', 'Contemporary Minimal Necklace Set', 'Heirloom Wedding Necklace Set']::TEXT[]),
      ('chains', ARRAY['Rope Twist Gold Chain', 'Singapore Link Gold Chain', 'Figaro Link Gold Chain', 'Box Link Gold Chain', 'Wheat Link Gold Chain', 'Curb Link Gold Chain', 'Herringbone Gold Chain', 'Snake Link Gold Chain', 'Foxtail Gold Chain', 'Anchor Link Gold Chain', 'Byzantine Gold Chain', 'Paperclip Gold Chain', 'Bead Station Gold Chain', 'Ball Link Gold Chain', 'Spiga Gold Chain', 'Mariner Link Gold Chain', 'Flat Cable Gold Chain', 'Twisted Singapore Chain', 'Two-Tone Link Gold Chain', 'Matte Finish Curb Chain', 'Openwork Geometric Chain', 'Lightweight Daily Chain', 'Classic Cable Gold Chain', 'Heavy Rope Statement Chain', 'Contemporary Link Gold Chain']::TEXT[]),
      ('harams', ARRAY['South Indian Lakshmi Haram', 'Kasu Coin Haram', 'Mango Mala Haram', 'Temple Gopuram Haram', 'Bengali Jor Haar', 'Nakshi Peacock Haram', 'Rajasthani Kundan Haram', 'Meenakari Floral Haram', 'Ruby Emerald Bridal Haram', 'Antique Nagas Haram', 'Pearl Drop Long Haram', 'Satlada Heritage Haram', 'Peshwai Pearl Haram', 'Gujarati Coin Haram', 'Kerala Palakka Haram', 'Maharashtrian Thushi Haram', 'Filigree Leaf Haram', 'Matte Gold Bridal Haram', 'Layered Lakshmi Haram', 'Traditional Bead Haram', 'Peacock Pendant Haram', 'Openwork Temple Haram', 'Lightweight Festive Haram', 'Heritage Long Gold Haram', 'Contemporary Layered Haram']::TEXT[]),
      ('bridal-sets', ARRAY['South Indian Temple Bridal Set', 'Bengali Shakha Pola Bridal Gold Set', 'Rajasthani Kundan Bridal Set', 'Polki Choker Bridal Set', 'Meenakari Rajwada Bridal Set', 'Lakshmi Coin Bridal Set', 'Nakshi Peacock Bridal Set', 'Ruby Emerald Rani Haar Set', 'Maharashtrian Peshwai Bridal Set', 'Punjabi Heritage Bridal Set', 'Gujarati Antique Bridal Set', 'Kerala Kasu Bridal Set', 'Odisha Filigree Bridal Set', 'Mughal Jadau Bridal Set', 'Pearl Fringe Wedding Set', 'Matte Gold Heavy Bridal Set', 'Layered Satlada Bridal Set', 'Floral Nakshi Bridal Set', 'Temple Mango Motif Bridal Set', 'Antique Heirloom Bridal Set', 'Contemporary Collar Bridal Set', 'Classic Gold Wedding Set', 'Grand Heritage Bridal Set', 'Lightweight Wedding Ceremony Set', 'Signature Heirloom Bridal Set']::TEXT[]),
      ('earrings', ARRAY['Bengali Jhumar Drop Earrings', 'South Indian Temple Bell Earrings', 'Rajasthani Kundan Chand Earrings', 'Meenakari Peacock Earrings', 'Antique Nakshi Floral Earrings', 'Gujarati Kutch Work Earrings', 'Maharashtrian Bugadi Earrings', 'Punjabi Polki Drop Earrings', 'Kerala Kasu Stud Earrings', 'Odisha Filigree Earrings', 'Lakshmi Motif Earrings', 'Ruby Halo Gold Earrings', 'Emerald Leaf Earrings', 'Pearl Tassel Earrings', 'Mango Motif Gold Earrings', 'Geometric Minimal Earrings', 'Textured Matte Gold Earrings', 'Openwork Filigree Earrings', 'Floral Cluster Earrings', 'Traditional Coin Drop Earrings', 'Temple Gopuram Earrings', 'Lightweight Daily Gold Earrings', 'Contemporary Sculpted Earrings', 'Heritage Bead Earrings', 'Statement Bridal Gold Earrings']::TEXT[]),
      ('jhumkas', ARRAY['Bengali Kanbala Jhumkas', 'South Indian Temple Jhumkas', 'Rajasthani Kundan Jhumkas', 'Meenakari Peacock Jhumkas', 'Nakshi Dome Jhumkas', 'Lakshmi Coin Jhumkas', 'Pearl Ghungroo Jhumkas', 'Ruby Emerald Bridal Jhumkas', 'Gujarati Enamel Jhumkas', 'Maharashtrian Thushi Jhumkas', 'Kerala Palakka Jhumkas', 'Odisha Filigree Jhumkas', 'Antique Bell Dome Jhumkas', 'Floral Bead Jhumkas', 'Mango Motif Jhumkas', 'Openwork Filigree Jhumkas', 'Matte Gold Daily Jhumkas', 'Lightweight Office Wear Jhumkas', 'Temple Gopuram Jhumkas', 'Chand Drop Jhumkas', 'Layered Ghungroo Jhumkas', 'Pearl Fringe Jhumkas', 'Geometric Modern Jhumkas', 'Heritage Nakshi Jhumkas', 'Grand Bridal Dome Jhumkas']::TEXT[]),
      ('studs', ARRAY['Lakshmi Motif Gold Studs', 'Temple Floral Gold Studs', 'Bengali Nakshi Gold Studs', 'Kundan Polki Gold Studs', 'Meenakari Peacock Studs', 'Ruby Bezel Gold Studs', 'Emerald Halo Gold Studs', 'Pearl Cluster Gold Studs', 'Mango Motif Gold Studs', 'Filigree Flower Gold Studs', 'Geometric Square Gold Studs', 'Textured Matte Gold Studs', 'Minimal Ball Gold Studs', 'Twisted Rope Gold Studs', 'Leaf Motif Gold Studs', 'Antique Coin Gold Studs', 'South Indian Kempu Studs', 'Rajasthani Jadau Studs', 'Gujarati Enamel Gold Studs', 'Tiny Daily Wear Gold Studs', 'Heart Motif Gold Studs', 'Starburst Gold Studs', 'Openwork Dome Gold Studs', 'Contemporary Bar Gold Studs', 'Heritage Cluster Gold Studs']::TEXT[]),
      ('tops', ARRAY['Classic Gold Button Tops', 'Bengali Paan Motif Tops', 'South Indian Temple Tops', 'Rajasthani Kundan Tops', 'Meenakari Floral Tops', 'Lakshmi Coin Tops', 'Ruby Dot Gold Tops', 'Emerald Leaf Tops', 'Pearl Halo Gold Tops', 'Mango Motif Gold Tops', 'Filigree Disc Tops', 'Matte Finish Gold Tops', 'Twisted Knot Gold Tops', 'Geometric Square Tops', 'Petal Cluster Gold Tops', 'Antique Nakshi Tops', 'Gujarati Enamel Tops', 'Maharashtrian Nathni Style Tops', 'Tiny Daily Wear Tops', 'Openwork Dome Tops', 'Peacock Feather Tops', 'Rose Bud Gold Tops', 'Contemporary Minimal Tops', 'Heritage Coin Tops', 'Bridal Accent Gold Tops']::TEXT[]),
      ('drop-earrings', ARRAY['Bengali Jhumar Drop Earrings', 'South Indian Temple Chain Drops', 'Rajasthani Kundan Drop Earrings', 'Meenakari Peacock Drops', 'Nakshi Leaf Drop Earrings', 'Ruby Teardrop Gold Earrings', 'Emerald Chand Drop Earrings', 'Pearl Cascade Gold Drops', 'Mango Motif Drop Earrings', 'Filigree Bell Drop Earrings', 'Lakshmi Pendant Drops', 'Antique Coin Drop Earrings', 'Gujarati Enamel Drops', 'Maharashtrian Peshwai Drops', 'Kerala Palakka Drops', 'Odisha Silver-Filigree Style Gold Drops', 'Floral Cluster Drop Earrings', 'Geometric Bar Drop Earrings', 'Matte Gold Long Drops', 'Openwork Dome Drops', 'Lightweight Daily Drop Earrings', 'Temple Gopuram Drops', 'Chand Fringe Drop Earrings', 'Contemporary Sculpted Drops', 'Grand Bridal Gold Drops']::TEXT[]),
      ('chandbalis', ARRAY['Rajasthani Kundan Chandbalis', 'Bengali Nakshi Chandbalis', 'South Indian Temple Chandbalis', 'Meenakari Peacock Chandbalis', 'Mughal Jadau Chandbalis', 'Pearl Fringe Chandbalis', 'Ruby Emerald Chandbalis', 'Lakshmi Motif Chandbalis', 'Gujarati Enamel Chandbalis', 'Maharashtrian Peshwai Chandbalis', 'Kerala Palakka Chandbalis', 'Odisha Filigree Chandbalis', 'Antique Crescent Chandbalis', 'Floral Cluster Chandbalis', 'Mango Motif Chandbalis', 'Openwork Filigree Chandbalis', 'Matte Gold Festive Chandbalis', 'Lightweight Daily Chandbalis', 'Temple Bell Chandbalis', 'Coin Drop Chandbalis', 'Peacock Feather Chandbalis', 'Pearl Bead Chandbalis', 'Geometric Modern Chandbalis', 'Heritage Nakshi Chandbalis', 'Grand Bridal Chandbalis']::TEXT[]),
      ('rings', ARRAY['Bengali Nakshi Cocktail Ring', 'South Indian Temple Motif Ring', 'Rajasthani Kundan Statement Ring', 'Meenakari Peacock Ring', 'Polki Floral Cluster Ring', 'Ruby Bezel Gold Ring', 'Emerald Halo Gold Ring', 'Navratna Heritage Ring', 'Maharashtrian Nath Motif Ring', 'Gujarati Engraved Signet Ring', 'Antique Filigree Dome Ring', 'Mango Motif Gold Ring', 'Lakshmi Coin Signet Ring', 'Openwork Leaf Gold Ring', 'Matte Finish Band Ring', 'Twisted Rope Gold Ring', 'Geometric Stack Gold Ring', 'Floral Cluster Daily Ring', 'Pearl Accent Gold Ring', 'Traditional Gents Signet Ring', 'Contemporary Minimal Gold Ring', 'Two-Tone Sculpted Ring', 'Heritage Engraved Gold Ring', 'Temple Gopuram Ring', 'Bridal Cocktail Gold Ring']::TEXT[]),
      ('bangles', ARRAY['Bengali Nakshi Gold Bangles', 'South Indian Temple Kada Bangles', 'Rajasthani Kundan Bangle Pair', 'Meenakari Peacock Bangles', 'Maharashtrian Patlya Bangles', 'Gujarati Jadtar Bangles', 'Lakshmi Coin Bangles', 'Mango Motif Gold Bangles', 'Antique Filigree Bangles', 'Ruby Emerald Bridal Bangles', 'Temple Gopuram Bangles', 'Openwork Leaf Bangles', 'Matte Finish Daily Bangles', 'Twisted Rope Gold Bangles', 'Geometric Cuff Bangles', 'Floral Cluster Bangles', 'Pearl Accent Gold Bangles', 'Kasu Coin Bangles', 'Punjabi Heritage Bangles', 'Kerala Palakka Bangles', 'Lightweight Stackable Bangles', 'Engraved Heirloom Bangles', 'Two-Tone Gold Bangles', 'Grand Bridal Nakshi Bangles', 'Contemporary Sculpted Bangles']::TEXT[]),
      ('bracelets', ARRAY['Bengali Nakshi Gold Bracelet', 'South Indian Temple Link Bracelet', 'Rajasthani Kundan Bracelet', 'Meenakari Floral Bracelet', 'Mango Motif Gold Bracelet', 'Lakshmi Coin Bracelet', 'Filigree Leaf Gold Bracelet', 'Ruby Emerald Tennis-Style Gold Bracelet', 'Pearl Station Gold Bracelet', 'Twisted Rope Gold Bracelet', 'Paperclip Link Gold Bracelet', 'Geometric Bar Gold Bracelet', 'Matte Curb Gold Bracelet', 'Openwork Peacock Bracelet', 'Antique Coin Gold Bracelet', 'Gujarati Enamel Link Bracelet', 'Maharashtrian Peshwai Bracelet', 'Lightweight Daily Gold Bracelet', 'Classic Cable Gold Bracelet', 'Two-Tone Link Bracelet', 'Floral Cluster Gold Bracelet', 'Engraved Heritage Bracelet', 'Contemporary Minimal Bracelet', 'Bold Gents Gold Bracelet', 'Bridal Statement Gold Bracelet']::TEXT[]),
      ('kada', ARRAY['Punjabi Heritage Gold Kada', 'South Indian Temple Kada', 'Bengali Nakshi Kada', 'Rajasthani Kundan Kada', 'Meenakari Peacock Kada', 'Maharashtrian Patlya Kada', 'Gujarati Jadtar Kada', 'Lakshmi Coin Kada', 'Mango Motif Gold Kada', 'Antique Engraved Kada', 'Filigree Openwork Kada', 'Matte Finish Daily Kada', 'Twisted Rope Gold Kada', 'Geometric Cuff Kada', 'Ruby Emerald Bridal Kada', 'Pearl Accent Gold Kada', 'Temple Gopuram Kada', 'Floral Cluster Kada', 'Two-Tone Gold Kada', 'Broad Nakshi Kada', 'Lightweight Sleek Kada', 'Men''s Textured Gold Kada', 'Men''s Signet Edge Kada', 'Heritage Heirloom Kada', 'Contemporary Sculpted Kada']::TEXT[]),
      ('pendants', ARRAY['Lakshmi Gold Pendant', 'Ganesh Gold Pendant', 'Om Gold Pendant', 'Bengali Nakshi Pendant', 'South Indian Temple Pendant', 'Rajasthani Kundan Pendant', 'Meenakari Peacock Pendant', 'Mango Motif Gold Pendant', 'Ruby Teardrop Pendant', 'Emerald Leaf Pendant', 'Pearl Halo Gold Pendant', 'Filigree Floral Pendant', 'Antique Coin Pendant', 'Navratna Gold Pendant', 'Maharashtrian Peshwai Pendant', 'Gujarati Enamel Pendant', 'Openwork Heart Pendant', 'Geometric Bar Pendant', 'Minimal Daily Gold Pendant', 'Photo Frame Gold Pendant', 'Traditional Zodiac Pendant', 'Temple Gopuram Pendant', 'Floral Cluster Pendant', 'Two-Tone Sculpted Pendant', 'Heirloom Bridal Pendant']::TEXT[]),
      ('mangalsutra', ARRAY['Traditional Black Bead Mangalsutra', 'Bengali Gold Locket Mangalsutra', 'Maharashtrian Vati Mangalsutra', 'South Indian Lakshmi Mangalsutra', 'Rajasthani Kundan Mangalsutra', 'Meenakari Pendant Mangalsutra', 'Diamond Accent Gold Mangalsutra', 'Double Chain Vati Mangalsutra', 'Short Daily Wear Mangalsutra', 'Long Heritage Mangalsutra', 'Temple Coin Mangalsutra', 'Peacock Motif Mangalsutra', 'Mango Motif Mangalsutra', 'Filigree Floral Mangalsutra', 'Geometric Minimal Mangalsutra', 'Ruby Emerald Mangalsutra', 'Pearl Drop Mangalsutra', 'Antique Matte Mangalsutra', 'Gujarati Bead Mangalsutra', 'Punjabi Bridal Mangalsutra', 'Two-Tone Chain Mangalsutra', 'Lightweight Office Wear Mangalsutra', 'Broad Bridal Mangalsutra', 'Contemporary Bar Mangalsutra', 'Heirloom Gold Mangalsutra']::TEXT[]),
      ('nose-pins', ARRAY['Bengali Phool Nose Pin', 'South Indian Mukkuthi Nose Pin', 'Rajasthani Kundan Nose Pin', 'Maharashtrian Nathni Nose Pin', 'Gujarati Nathadi Nose Pin', 'Meenakari Floral Nose Pin', 'Lakshmi Motif Nose Pin', 'Peacock Feather Nose Pin', 'Ruby Bezel Gold Nose Pin', 'Emerald Dot Gold Nose Pin', 'Pearl Halo Nose Pin', 'Filigree Leaf Nose Pin', 'Antique Nakshi Nose Pin', 'Minimal Ball Gold Nose Pin', 'Tiny Daily Wear Nose Pin', 'Geometric Star Nose Pin', 'Twisted Rope Nose Pin', 'Openwork Flower Nose Pin', 'Diamond-Accent Gold Nose Pin', 'Temple Bell Nose Pin', 'Punjabi Bridal Nose Pin', 'Kerala Palakka Nose Pin', 'Matte Finish Gold Nose Pin', 'Contemporary Bar Nose Pin', 'Heirloom Floral Nose Pin']::TEXT[]),
      ('nath', ARRAY['Maharashtrian Peshwai Nath', 'Bengali Bridal Nath', 'Rajasthani Borla Nath', 'Punjabi Bridal Nath', 'South Indian Temple Nath', 'Gujarati Kundan Nath', 'Meenakari Peacock Nath', 'Pearl Fringe Nath', 'Ruby Emerald Bridal Nath', 'Antique Nakshi Nath', 'Lakshmi Motif Nath', 'Mango Motif Gold Nath', 'Filigree Floral Nath', 'Openwork Crescent Nath', 'Coin Drop Traditional Nath', 'Pearl Chain Nath', 'Matte Gold Festive Nath', 'Lightweight Wedding Nath', 'Temple Gopuram Nath', 'Kundan Polki Crescent Nath', 'Gujarati Enamel Nath', 'Bengali Laung Nath', 'Contemporary Minimal Nath', 'Heirloom Gold Nath', 'Grand Bridal Statement Nath']::TEXT[]),
      ('anklets', ARRAY['Classic Gold Payal Anklets', 'Bengali Nakshi Gold Anklets', 'South Indian Temple Anklets', 'Rajasthani Ghungroo Gold Anklets', 'Maharashtrian Kolhapuri Anklets', 'Meenakari Charm Anklets', 'Peacock Motif Gold Anklets', 'Mango Motif Anklets', 'Lakshmi Coin Anklets', 'Filigree Chain Anklets', 'Lightweight Daily Gold Anklets', 'Layered Gold Anklets', 'Bell Cluster Anklets', 'Openwork Floral Anklets', 'Matte Finish Gold Anklets', 'Twisted Rope Anklets', 'Geometric Link Anklets', 'Pearl Drop Gold Anklets', 'Antique Coin Anklets', 'Gujarati Bead Anklets', 'Temple Ghungroo Anklets', 'Minimal Sleek Gold Anklets', 'Bridal Foot Chain Anklets', 'Heritage Nakshi Anklets', 'Contemporary Gold Anklets']::TEXT[]),
      ('waist-belts', ARRAY['South Indian Vaddanam Waist Belt', 'Lakshmi Temple Gold Vaddanam', 'Bengali Kamarbandh', 'Rajasthani Kundan Kamarbandh', 'Maharashtrian Peshwai Waist Belt', 'Meenakari Peacock Waist Belt', 'Mango Motif Bridal Vaddanam', 'Ruby Emerald Bridal Kamarbandh', 'Coin Cluster Gold Waist Belt', 'Nakshi Floral Waist Belt', 'Pearl Fringe Waist Belt', 'Temple Gopuram Vaddanam', 'Antique Filigree Kamarbandh', 'Gujarati Jadtar Waist Belt', 'Punjabi Bridal Kamarbandh', 'Openwork Leaf Waist Belt', 'Matte Gold Festive Waist Belt', 'Layered Chain Kamarbandh', 'Lightweight Gold Waist Chain', 'Lakshmi Coin Bridal Belt', 'Peacock Motif Vaddanam', 'Floral Cluster Kamarbandh', 'Heritage Engraved Waist Belt', 'Contemporary Minimal Waist Belt', 'Grand Heirloom Vaddanam']::TEXT[]),
      ('armlets', ARRAY['South Indian Vanki Armlet', 'Temple Lakshmi Bajubandh', 'Bengali Nakshi Armlet', 'Rajasthani Kundan Bajubandh', 'Meenakari Peacock Armlet', 'Maharashtrian Peshwai Bajubandh', 'Gujarati Jadtar Armlet', 'Mango Motif Gold Armlet', 'Ruby Emerald Bridal Armlet', 'Pearl Fringe Bajubandh', 'Antique Filigree Armlet', 'Floral Cluster Armlet', 'Openwork Leaf Armlet', 'Matte Finish Gold Armlet', 'Twisted Rope Armlet', 'Geometric Cuff Armlet', 'Temple Gopuram Bajubandh', 'Lakshmi Coin Armlet', 'Lightweight Festive Armlet', 'Bridal Upper Arm Chain', 'Peacock Feather Armlet', 'Heritage Engraved Bajubandh', 'Two-Tone Sculpted Armlet', 'Contemporary Minimal Armlet', 'Grand Bridal Vanki']::TEXT[]),
      ('maang-tikka', ARRAY['Rajasthani Borla Maang Tikka', 'Punjabi Matha Patti Tikka', 'Bengali Tikli Maang Tikka', 'South Indian Temple Maang Tikka', 'Meenakari Peacock Tikka', 'Kundan Polki Maang Tikka', 'Mughal Jadau Tikka', 'Lakshmi Motif Maang Tikka', 'Mango Motif Maang Tikka', 'Pearl Fringe Maang Tikka', 'Ruby Emerald Bridal Tikka', 'Antique Nakshi Tikka', 'Filigree Floral Maang Tikka', 'Gujarati Kundan Tikka', 'Maharashtrian Peshwai Tikka', 'Chand Crescent Maang Tikka', 'Temple Gopuram Tikka', 'Openwork Leaf Maang Tikka', 'Matte Gold Festive Tikka', 'Lightweight Daily Maang Tikka', 'Floral Cluster Maang Tikka', 'Two-Tone Gold Tikka', 'Heritage Coin Maang Tikka', 'Contemporary Minimal Tikka', 'Grand Bridal Matha Patti']::TEXT[]),
      ('hair-accessories', ARRAY['Gold Temple Juda Pin', 'Bengali Nakshi Hair Pin', 'South Indian Jadai Billai', 'Rajasthani Kundan Hair Comb', 'Meenakari Peacock Hair Pin', 'Lakshmi Motif Juda Ornament', 'Mango Motif Hair Veni', 'Pearl Fringe Hair Accessory', 'Ruby Emerald Bridal Hair Pin', 'Antique Filigree Hair Comb', 'Floral Cluster Gold Hair Pin', 'Temple Gopuram Jada Pin', 'Openwork Leaf Hair Clip', 'Gold Floral Bun Cover', 'Traditional Gold Hair Chain', 'Maharashtrian Peshwai Hair Ornament', 'Gujarati Enamel Hair Pin', 'Punjabi Bridal Kalgi', 'Matte Gold Hair Barrette', 'Lightweight Daily Gold Clip', 'Peacock Feather Hair Ornament', 'Coin Motif Hair Veni', 'Geometric Gold Hair Clip', 'Heritage Jadai Ornament', 'Grand Bridal Gold Hair Set']::TEXT[]),
      ('toe-rings', ARRAY['Classic Gold Toe Ring Pair', 'Bengali Nakshi Toe Rings', 'South Indian Mettelu Gold Rings', 'Rajasthani Kundan Toe Rings', 'Meenakari Floral Toe Rings', 'Maharashtrian Peshwai Toe Rings', 'Gujarati Engraved Toe Rings', 'Mango Motif Gold Toe Rings', 'Lakshmi Coin Toe Rings', 'Filigree Leaf Toe Rings', 'Openwork Flower Toe Rings', 'Matte Finish Daily Toe Rings', 'Twisted Rope Toe Rings', 'Geometric Band Toe Rings', 'Ruby Accent Gold Toe Rings', 'Pearl Dot Toe Rings', 'Antique Nakshi Toe Rings', 'Lightweight Sleek Toe Rings', 'Adjustable Floral Toe Rings', 'Double Band Gold Toe Rings', 'Temple Motif Toe Rings', 'Peacock Motif Toe Rings', 'Contemporary Minimal Toe Rings', 'Heritage Engraved Toe Rings', 'Bridal Gold Toe Ring Pair']::TEXT[]),
      ('gold-coins', ARRAY['Lakshmi Gold Coin', 'Ganesh Gold Coin', 'Kuber Gold Coin', 'Om Gold Coin', 'Saraswati Gold Coin', 'Durga Gold Coin', 'Balaji Gold Coin', 'Shree Yantra Gold Coin', 'Bengali Traditional Gold Mohur', 'South Indian Temple Gold Coin', 'Antique Portrait Gold Coin', 'Floral Engraved Gold Coin', 'Peacock Motif Gold Coin', 'Lotus Motif Gold Coin', 'Wedding Gift Gold Coin', 'Baby Naming Gold Coin', 'Diwali Lakshmi Gold Coin', 'Dhanteras Gold Coin', 'Navratna Border Gold Coin', 'Heritage Script Gold Coin', 'Geometric Edge Gold Coin', 'Matte Finish Gold Coin', 'Two-Sided Engraved Gold Coin', 'Classic Round Gold Coin', 'Keepsake Gold Coin']::TEXT[]),
      ('baby-jewellery', ARRAY['Baby Gold Nazariya Bracelet', 'Infant Black Bead Gold Kada', 'Baby Floral Gold Pendant', 'Tiny Gold Ear Studs', 'Baby Om Pendant', 'Child Nameplate Gold Pendant', 'Baby Lakshmi Pendant', 'Lightweight Gold Anklet', 'Baby Ghungroo Anklet', 'Adjustable Gold Kada', 'Child Heart Pendant', 'Tiny Star Gold Studs', 'Baby Safety Chain Bracelet', 'Infant Gold Toe Ring', 'Baby Peacock Pendant', 'Soft Edge Gold Bangle', 'Traditional Bengali Baby Kada', 'South Indian Baby Kasu Chain', 'Maharashtrian Baby Nazariya', 'Engraved Initial Pendant', 'Tiny Pearl Gold Studs', 'Baby Floral Bracelet', 'Child Krishna Gold Pendant', 'Keepsake Baby Gold Locket', 'Ceremony Gift Gold Set']::TEXT[]),
      ('men-s-jewellery', ARRAY['Classic Gold Cuban Link Chain', 'Men''s Rope Twist Gold Chain', 'Men''s Figaro Gold Chain', 'Men''s Box Link Chain', 'Men''s Curb Gold Bracelet', 'Punjabi Kada Gold Bracelet', 'South Indian Temple Signet Ring', 'Bengali Engraved Signet Ring', 'Matte Finish Men''s Band', 'Geometric Men''s Gold Ring', 'Tiger Eye Accent Gold Ring', 'Onyx Signet Gold Ring', 'Textured Men''s Kada', 'Two-Tone Men''s Bracelet', 'Heavy Rope Gold Bracelet', 'Minimal Gold ID Bracelet', 'Men''s Om Gold Pendant', 'Men''s Rudraksha Gold Pendant', 'Heritage Coin Men''s Pendant', 'Men''s Chain Link Kada', 'Peacock Crest Signet Ring', 'Contemporary Square Signet Ring', 'Men''s Gold Cuff Bracelet', 'Traditional Wedding Gold Chain', 'Heirloom Men''s Gold Kada']::TEXT[]),
      ('lockets', ARRAY['Lakshmi Motif Gold Locket', 'Ganesh Gold Locket', 'Om Gold Locket', 'Bengali Nakshi Photo Locket', 'South Indian Temple Locket', 'Rajasthani Kundan Locket', 'Meenakari Peacock Locket', 'Mango Motif Gold Locket', 'Ruby Emerald Gold Locket', 'Pearl Halo Locket', 'Filigree Floral Locket', 'Antique Coin Gold Locket', 'Openable Photo Gold Locket', 'Double-Sided Keepsake Locket', 'Heart Shape Gold Locket', 'Oval Engraved Gold Locket', 'Round Minimal Gold Locket', 'Baby Name Gold Locket', 'Religious Symbol Gold Locket', 'Navratna Gold Locket', 'Temple Gopuram Locket', 'Floral Cluster Gold Locket', 'Matte Finish Gold Locket', 'Two-Tone Sculpted Locket', 'Heritage Heirloom Gold Locket']::TEXT[])
),
concepts AS (
    SELECT c.id AS category_id,
           c.metal_type,
           c.subcategory_name,
           x.design_name,
           x.sequence_no
      FROM category_designs cd
      JOIN public.jewellery_design_categories c
        ON c.metal_type = 'GOLD'
       AND c.slug = cd.subcategory_slug
      CROSS JOIN LATERAL UNNEST(cd.design_names)
           WITH ORDINALITY AS x(design_name, sequence_no)
),
classified AS (
    SELECT *,
       CASE
         WHEN design_name ILIKE '%Bengali%' THEN 'Bengali'
         WHEN design_name ILIKE '%South Indian%' OR design_name ILIKE '%Temple%' OR design_name ILIKE '%Kasu%' THEN 'South Indian'
         WHEN design_name ILIKE '%Rajasthani%' OR design_name ILIKE '%Kundan%' OR design_name ILIKE '%Polki%' OR design_name ILIKE '%Jadau%' THEN 'Rajasthani'
         WHEN design_name ILIKE '%Gujarati%' THEN 'Gujarati'
         WHEN design_name ILIKE '%Maharashtrian%' OR design_name ILIKE '%Peshwai%' OR design_name ILIKE '%Kolhapuri%' THEN 'Maharashtrian'
         WHEN design_name ILIKE '%Punjabi%' THEN 'Punjabi'
         WHEN design_name ILIKE '%Kerala%' THEN 'Kerala'
         WHEN design_name ILIKE '%Odisha%' THEN 'Odisha'
         ELSE 'Pan-Indian'
       END AS regional,
       CASE
         WHEN design_name ILIKE '%Temple%' OR design_name ILIKE '%Lakshmi%' OR design_name ILIKE '%Ganesh%' THEN 'Temple & devotional'
         WHEN design_name ILIKE '%Nakshi%' OR design_name ILIKE '%Engraved%' THEN 'Nakshi & engraving'
         WHEN design_name ILIKE '%Kundan%' OR design_name ILIKE '%Polki%' OR design_name ILIKE '%Jadau%' THEN 'Kundan & Polki'
         WHEN design_name ILIKE '%Meenakari%' OR design_name ILIKE '%Enamel%' THEN 'Meenakari'
         WHEN design_name ILIKE '%Filigree%' OR design_name ILIKE '%Openwork%' THEN 'Filigree & openwork'
         WHEN design_name ILIKE '%Matte%' OR design_name ILIKE '%Antique%' THEN 'Antique & matte finish'
         WHEN design_name ILIKE '%Minimal%' OR design_name ILIKE '%Daily%' OR design_name ILIKE '%Sleek%' THEN 'Minimal & daily wear'
         WHEN design_name ILIKE '%Bridal%' OR design_name ILIKE '%Wedding%' OR design_name ILIKE '%Grand%' THEN 'Bridal & occasion'
         WHEN design_name ILIKE '%Floral%' OR design_name ILIKE '%Peacock%' OR design_name ILIKE '%Mango%' THEN 'Motif & floral'
         WHEN design_name ILIKE '%Geometric%' OR design_name ILIKE '%Contemporary%' OR design_name ILIKE '%Modern%' THEN 'Contemporary'
         WHEN design_name ILIKE '%Coin%' OR design_name ILIKE '%Kasu%' THEN 'Coin & heritage'
         ELSE 'Traditional Indian'
       END AS style
      FROM concepts
)
UPDATE public.jewellery_designs d
   SET design_name = x.design_name,
       description = 'Catalogue inspiration concept: ' || x.design_name || '. ' ||
           x.subcategory_name || ' in the Gold collection, drawing on ' ||
           x.style || ' design language. Reference concept only; actual metal purity, dimensions, weight, craftsmanship and availability must be verified against a finished piece.',
       style_label = x.style,
       regional_inspiration = x.regional,
       material_label = 'Gold concept · actual karat not specified',
       keywords = CONCAT_WS(', ', 'GOLD', x.subcategory_name, x.design_name, x.style, x.regional,
                            'Indian jewellery design inspiration'),
       image_status = CASE WHEN EXISTS (
           SELECT 1 FROM public.jewellery_design_images i
            WHERE i.design_id = d.id
              AND COALESCE(NULLIF(BTRIM(i.thumbnail_url), ''),
                           NULLIF(BTRIM(i.display_url), ''),
                           NULLIF(BTRIM(i.original_url), '')) IS NOT NULL
       ) THEN 'READY' ELSE 'PENDING' END,
       updated_at = NOW()
  FROM classified x
  JOIN public.jewellery_design_categories c ON c.id = x.category_id
 WHERE d.category_id = x.category_id
   AND d.is_sample = TRUE
   AND d.is_deleted = FALSE
   AND substring(d.design_id FROM '([0-9]+)$')::INTEGER = x.sequence_no;

DO $$
DECLARE category_count INTEGER;
DECLARE incomplete_count INTEGER;
DECLARE duplicate_names INTEGER;
BEGIN
    SELECT COUNT(*) INTO category_count
      FROM public.jewellery_design_categories
     WHERE metal_type = 'GOLD' AND is_active = TRUE;
    IF category_count <> 29 THEN
        RAISE EXCEPTION 'Gold catalogue expected 29 active subcategories; found %', category_count;
    END IF;

    SELECT COUNT(*) INTO incomplete_count
      FROM (
        SELECT c.id
          FROM public.jewellery_design_categories c
          LEFT JOIN public.jewellery_designs d
            ON d.category_id = c.id AND d.is_sample = TRUE AND d.is_deleted = FALSE
         WHERE c.metal_type = 'GOLD' AND c.is_active = TRUE
         GROUP BY c.id
        HAVING COUNT(d.id) < 20
      ) q;
    IF incomplete_count > 0 THEN
        RAISE EXCEPTION 'Gold catalogue incomplete: % subcategories have fewer than 20 sample designs', incomplete_count;
    END IF;

    SELECT COUNT(*) INTO duplicate_names
      FROM (
        SELECT d.category_id, LOWER(BTRIM(d.design_name))
          FROM public.jewellery_designs d
          JOIN public.jewellery_design_categories c ON c.id=d.category_id
         WHERE c.metal_type='GOLD' AND d.is_sample=TRUE AND d.is_deleted=FALSE
         GROUP BY d.category_id, LOWER(BTRIM(d.design_name))
        HAVING COUNT(*) > 1
      ) q;
    IF duplicate_names > 0 THEN
        RAISE EXCEPTION 'Gold catalogue contains % duplicated design-name groups', duplicate_names;
    END IF;
END $$;
