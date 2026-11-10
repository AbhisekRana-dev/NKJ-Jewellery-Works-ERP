-- V25: searchable jewellery design catalogue, 77 approved subcategories,
-- owner-managed image records, and 20 inspiration concepts for every subcategory.
CREATE TABLE IF NOT EXISTS public.jewellery_design_categories (
    id BIGSERIAL PRIMARY KEY,
    metal_type VARCHAR(16) NOT NULL CHECK (metal_type IN ('GOLD','SILVER','DIAMOND')),
    subcategory_name VARCHAR(80) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_jewellery_design_category UNIQUE (metal_type, slug)
);

CREATE TABLE IF NOT EXISTS public.jewellery_designs (
    id BIGSERIAL PRIMARY KEY,
    design_code VARCHAR(32) NOT NULL UNIQUE,
    category_id BIGINT NOT NULL REFERENCES public.jewellery_design_categories(id),
    design_name VARCHAR(160) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    style_label VARCHAR(80) NOT NULL DEFAULT '',
    keywords TEXT NOT NULL DEFAULT '',
    is_sample BOOLEAN NOT NULL DEFAULT TRUE,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    popularity_count BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.jewellery_design_images (
    id BIGSERIAL PRIMARY KEY,
    design_id BIGINT NOT NULL REFERENCES public.jewellery_designs(id) ON DELETE CASCADE,
    original_url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500) NOT NULL,
    alt_text VARCHAR(240) NOT NULL DEFAULT '',
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.jewellery_design_code_counters (
    metal_type VARCHAR(16) PRIMARY KEY CHECK (metal_type IN ('GOLD','SILVER','DIAMOND')),
    last_value BIGINT NOT NULL DEFAULT 0
);

INSERT INTO public.jewellery_design_categories
    (metal_type, subcategory_name, slug, display_order)
VALUES
    ('GOLD', 'Necklaces', 'necklaces', 1),
    ('GOLD', 'Necklace Sets', 'necklace-sets', 2),
    ('GOLD', 'Chains', 'chains', 3),
    ('GOLD', 'Harams', 'harams', 4),
    ('GOLD', 'Bridal Sets', 'bridal-sets', 5),
    ('GOLD', 'Earrings', 'earrings', 6),
    ('GOLD', 'Jhumkas', 'jhumkas', 7),
    ('GOLD', 'Studs', 'studs', 8),
    ('GOLD', 'Tops', 'tops', 9),
    ('GOLD', 'Drop Earrings', 'drop-earrings', 10),
    ('GOLD', 'Chandbalis', 'chandbalis', 11),
    ('GOLD', 'Rings', 'rings', 12),
    ('GOLD', 'Bangles', 'bangles', 13),
    ('GOLD', 'Bracelets', 'bracelets', 14),
    ('GOLD', 'Kada', 'kada', 15),
    ('GOLD', 'Pendants', 'pendants', 16),
    ('GOLD', 'Mangalsutra', 'mangalsutra', 17),
    ('GOLD', 'Nose Pins', 'nose-pins', 18),
    ('GOLD', 'Nath', 'nath', 19),
    ('GOLD', 'Anklets', 'anklets', 20),
    ('GOLD', 'Waist Belts', 'waist-belts', 21),
    ('GOLD', 'Armlets', 'armlets', 22),
    ('GOLD', 'Maang Tikka', 'maang-tikka', 23),
    ('GOLD', 'Hair Accessories', 'hair-accessories', 24),
    ('GOLD', 'Toe Rings', 'toe-rings', 25),
    ('GOLD', 'Gold Coins', 'gold-coins', 26),
    ('GOLD', 'Baby Jewellery', 'baby-jewellery', 27),
    ('GOLD', 'Men''s Jewellery', 'men-s-jewellery', 28),
    ('GOLD', 'Lockets', 'lockets', 29),
    ('SILVER', 'Anklets & Payal', 'anklets-and-payal', 1),
    ('SILVER', 'Toe Rings & Bichiya', 'toe-rings-and-bichiya', 2),
    ('SILVER', 'Rings', 'rings', 3),
    ('SILVER', 'Chains', 'chains', 4),
    ('SILVER', 'Necklaces', 'necklaces', 5),
    ('SILVER', 'Pendants', 'pendants', 6),
    ('SILVER', 'Earrings', 'earrings', 7),
    ('SILVER', 'Jhumkas', 'jhumkas', 8),
    ('SILVER', 'Studs', 'studs', 9),
    ('SILVER', 'Bangles', 'bangles', 10),
    ('SILVER', 'Bracelets', 'bracelets', 11),
    ('SILVER', 'Kada', 'kada', 12),
    ('SILVER', 'Baby Jewellery', 'baby-jewellery', 13),
    ('SILVER', 'Nazariya', 'nazariya', 14),
    ('SILVER', 'Waist Chains', 'waist-chains', 15),
    ('SILVER', 'Hair Accessories', 'hair-accessories', 16),
    ('SILVER', 'Nose Pins', 'nose-pins', 17),
    ('SILVER', 'Idols & Murtis', 'idols-and-murtis', 18),
    ('SILVER', 'Pooja Thalis', 'pooja-thalis', 19),
    ('SILVER', 'Diyas', 'diyas', 20),
    ('SILVER', 'Bowls & Serveware', 'bowls-and-serveware', 21),
    ('SILVER', 'Glass Sets', 'glass-sets', 22),
    ('SILVER', 'Silver Coins', 'silver-coins', 23),
    ('SILVER', 'Keychains', 'keychains', 24),
    ('SILVER', 'Gift Articles', 'gift-articles', 25),
    ('SILVER', 'Silver Utensils', 'silver-utensils', 26),
    ('DIAMOND', 'Rings', 'rings', 1),
    ('DIAMOND', 'Solitaire Rings', 'solitaire-rings', 2),
    ('DIAMOND', 'Engagement Rings', 'engagement-rings', 3),
    ('DIAMOND', 'Wedding Bands', 'wedding-bands', 4),
    ('DIAMOND', 'Necklaces', 'necklaces', 5),
    ('DIAMOND', 'Necklace Sets', 'necklace-sets', 6),
    ('DIAMOND', 'Pendants', 'pendants', 7),
    ('DIAMOND', 'Earrings', 'earrings', 8),
    ('DIAMOND', 'Studs', 'studs', 9),
    ('DIAMOND', 'Drop Earrings', 'drop-earrings', 10),
    ('DIAMOND', 'Jhumkas', 'jhumkas', 11),
    ('DIAMOND', 'Bracelets', 'bracelets', 12),
    ('DIAMOND', 'Tennis Bracelets', 'tennis-bracelets', 13),
    ('DIAMOND', 'Bangles', 'bangles', 14),
    ('DIAMOND', 'Kada', 'kada', 15),
    ('DIAMOND', 'Mangalsutra', 'mangalsutra', 16),
    ('DIAMOND', 'Nose Pins', 'nose-pins', 17),
    ('DIAMOND', 'Nath', 'nath', 18),
    ('DIAMOND', 'Maang Tikka', 'maang-tikka', 19),
    ('DIAMOND', 'Bridal Sets', 'bridal-sets', 20),
    ('DIAMOND', 'Men''s Rings', 'men-s-rings', 21),
    ('DIAMOND', 'Men''s Bracelets', 'men-s-bracelets', 22)
ON CONFLICT (metal_type, slug) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_jewellery_designs_category_active
    ON public.jewellery_designs(category_id, is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jewellery_designs_active_featured
    ON public.jewellery_designs(is_active, is_featured, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jewellery_designs_code
    ON public.jewellery_designs(design_code);
CREATE INDEX IF NOT EXISTS idx_jewellery_designs_popularity
    ON public.jewellery_designs(is_active, popularity_count DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jewellery_designs_name_search
    ON public.jewellery_designs USING GIN (to_tsvector('simple', design_name || ' ' || keywords || ' ' || style_label));
CREATE INDEX IF NOT EXISTS idx_jewellery_design_images_design_order
    ON public.jewellery_design_images(design_id, display_order, id);

-- Seed 20 distinct style-led inspiration entries for every subcategory.
-- These are explicitly marked is_sample=true and have no product-photo URL.
WITH style_variants(variant_order, style_label, style_description) AS (
    VALUES
       (1, 'Bengali Heritage', 'Inspired by traditional Bengali craftsmanship and heirloom detailing.'),
       (2, 'South Indian Temple', 'A temple-inspired concept with traditional sculptural accents.'),
       (3, 'Antique Nakshi', 'An antique-finish concept with detailed nakshi-style surface work.'),
       (4, 'Kundan Accent', 'A design concept featuring kundan-inspired stone settings.'),
       (5, 'Meenakari Floral', 'A colourful floral concept inspired by meenakari workmanship.'),
       (6, 'Bridal Statement', 'A bold occasion-wear concept for wedding and celebration styling.'),
       (7, 'Lightweight Daily Wear', 'A light, versatile concept intended for everyday styling inspiration.'),
       (8, 'Floral Motif', 'A floral-inspired concept with balanced decorative detailing.'),
       (9, 'Peacock Motif', 'A peacock-inspired concept with flowing ornamental forms.'),
       (10, 'Lakshmi Motif', 'A traditional Lakshmi-inspired devotional and festive concept.'),
       (11, 'Filigree Craft', 'An openwork concept inspired by delicate filigree craftsmanship.'),
       (12, 'Contemporary Minimal', 'A clean contemporary concept with understated detailing.'),
       (13, 'Layered Heritage', 'A layered traditional concept with multiple visual elements.'),
       (14, 'Handcrafted Classic', 'A handcrafted-style concept with timeless proportions.'),
       (15, 'Rajasthani Folk', 'A folk-inspired concept with expressive traditional patterns.'),
       (16, 'Mughal Inspired', 'A Mughal-inspired concept with symmetrical ornamental detail.'),
       (17, 'Geometric Modern', 'A modern concept built around geometric shapes and clean lines.'),
       (18, 'Matte Finish', 'A soft matte-finish concept with restrained highlights.'),
       (19, 'Textured Artisan', 'An artisan concept combining varied textures and surface patterns.'),
       (20, 'Heirloom Signature', 'A signature heirloom concept intended as a starting point for custom design.')
),
seed_rows AS (
    SELECT c.id AS category_id,
           c.metal_type,
           c.subcategory_name,
           c.display_order,
           v.variant_order,
           v.style_label,
           v.style_description,
           ROW_NUMBER() OVER (
               PARTITION BY c.metal_type
               ORDER BY c.display_order, v.variant_order
           ) AS metal_sequence
      FROM public.jewellery_design_categories c
      CROSS JOIN style_variants v
     WHERE c.is_active = TRUE
),
numbered AS (
    SELECT category_id,
           metal_type,
           subcategory_name,
           style_label,
           style_description,
           metal_sequence
      FROM seed_rows
)
INSERT INTO public.jewellery_designs (
    design_code, category_id, design_name, description,
    style_label, keywords, is_sample, is_featured, is_active,
    popularity_count, created_at, updated_at
)
SELECT 'NKJ-' ||
       CASE metal_type WHEN 'GOLD' THEN 'GOLD-' WHEN 'SILVER' THEN 'SILVER-' ELSE 'DIA-' END ||
       LPAD(metal_sequence::TEXT, 5, '0'),
       category_id,
       style_label || ' ' || subcategory_name,
       style_description || ' Sample ' || LOWER(subcategory_name) ||
       ' inspiration for ' || LOWER(metal_type) ||
       ' jewellery. Inspiration artwork only; not a confirmed shop product or available stock.',
       style_label,
       metal_type || ', ' || subcategory_name || ', ' || style_label,
       TRUE,
       (metal_sequence % 20 = 1),
       TRUE,
       0,
       NOW() - INTERVAL '30 days',
       NOW()
  FROM numbered
ON CONFLICT (design_code) DO NOTHING;

INSERT INTO public.jewellery_design_code_counters(metal_type, last_value)
SELECT 'GOLD', COALESCE(MAX(SUBSTRING(design_code FROM 10)::BIGINT), 0)
  FROM public.jewellery_designs WHERE design_code LIKE 'NKJ-GOLD-%'
ON CONFLICT (metal_type) DO UPDATE SET last_value = GREATEST(
    public.jewellery_design_code_counters.last_value, EXCLUDED.last_value
);
INSERT INTO public.jewellery_design_code_counters(metal_type, last_value)
SELECT 'SILVER', COALESCE(MAX(SUBSTRING(design_code FROM 12)::BIGINT), 0)
  FROM public.jewellery_designs WHERE design_code LIKE 'NKJ-SILVER-%'
ON CONFLICT (metal_type) DO UPDATE SET last_value = GREATEST(
    public.jewellery_design_code_counters.last_value, EXCLUDED.last_value
);
INSERT INTO public.jewellery_design_code_counters(metal_type, last_value)
SELECT 'DIAMOND', COALESCE(MAX(SUBSTRING(design_code FROM 9)::BIGINT), 0)
  FROM public.jewellery_designs WHERE design_code LIKE 'NKJ-DIA-%'
ON CONFLICT (metal_type) DO UPDATE SET last_value = GREATEST(
    public.jewellery_design_code_counters.last_value, EXCLUDED.last_value
);
