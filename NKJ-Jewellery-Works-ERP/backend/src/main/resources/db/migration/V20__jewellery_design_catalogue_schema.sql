-- V20: dedicated Indian jewellery design catalogue; additive only, preserving existing ERP data.
CREATE TABLE IF NOT EXISTS jewellery_design_categories (
  category_code VARCHAR(20) PRIMARY KEY,
  display_name VARCHAR(40) NOT NULL UNIQUE,
  display_order SMALLINT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO jewellery_design_categories(category_code,display_name,display_order) VALUES
 ('GOLD','Gold',1),('SILVER','Silver',2),('DIAMOND','Diamond',3)
ON CONFLICT (category_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS jewellery_design_subcategories (
  id BIGSERIAL PRIMARY KEY,
  category_code VARCHAR(20) NOT NULL REFERENCES jewellery_design_categories(category_code),
  subcategory_code VARCHAR(60) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  display_order INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(category_code,subcategory_code),
  UNIQUE(id,category_code)
);
INSERT INTO jewellery_design_subcategories(category_code,subcategory_code,display_name,display_order,active) VALUES
('GOLD','NECKLACES','Necklaces',1,TRUE),
('GOLD','NECKLACE_SETS','Necklace Sets',2,TRUE),
('GOLD','CHAINS','Chains',3,TRUE),
('GOLD','HARAMS','Harams',4,TRUE),
('GOLD','BRIDAL_SETS','Bridal Sets',5,TRUE),
('GOLD','EARRINGS','Earrings',6,TRUE),
('GOLD','JHUMKAS','Jhumkas',7,TRUE),
('GOLD','STUDS','Studs',8,TRUE),
('GOLD','TOPS','Tops',9,TRUE),
('GOLD','DROP_EARRINGS','Drop Earrings',10,TRUE),
('GOLD','CHAND_BALI','Chandbalis',11,TRUE),
('GOLD','RINGS','Rings',12,TRUE),
('GOLD','BANGLES','Bangles',13,TRUE),
('GOLD','BRACELETS','Bracelets',14,TRUE),
('GOLD','KADA','Kada',15,TRUE),
('GOLD','PENDANTS','Pendants',16,TRUE),
('GOLD','MANGALSUTRA','Mangalsutra',17,TRUE),
('GOLD','NOSE_PINS','Nose Pins',18,TRUE),
('GOLD','NATH','Nath',19,TRUE),
('GOLD','ANKLETS','Anklets',20,TRUE),
('GOLD','WAIST_BELTS','Waist Belts',21,TRUE),
('GOLD','ARMLETS','Armlets',22,TRUE),
('GOLD','MAANG_TIKKA','Maang Tikka',23,TRUE),
('GOLD','HAIR_ACCESSORIES','Hair Accessories',24,TRUE),
('GOLD','TOE_RINGS','Toe Rings',25,TRUE),
('GOLD','GOLD_COINS','Gold Coins',26,TRUE),
('GOLD','BABY_JEWELLERY','Baby Jewellery',27,TRUE),
('GOLD','MENS_JEWELLERY','Men''s Jewellery',28,TRUE),
('GOLD','LOCKETS','Lockets',29,TRUE),
('SILVER','ANKLETS_PAYAL','Anklets & Payal',1,TRUE),
('SILVER','TOE_RINGS_BICHIYA','Toe Rings & Bichiya',2,TRUE),
('SILVER','RINGS','Rings',3,TRUE),
('SILVER','CHAINS','Chains',4,TRUE),
('SILVER','NECKLACES','Necklaces',5,TRUE),
('SILVER','PENDANTS','Pendants',6,TRUE),
('SILVER','EARRINGS','Earrings',7,TRUE),
('SILVER','JHUMKAS','Jhumkas',8,TRUE),
('SILVER','STUDS','Studs',9,TRUE),
('SILVER','BANGLES','Bangles',10,TRUE),
('SILVER','BRACELETS','Bracelets',11,TRUE),
('SILVER','KADA','Kada',12,TRUE),
('SILVER','BABY_JEWELLERY','Baby Jewellery',13,TRUE),
('SILVER','NAZARIYA','Nazariya',14,TRUE),
('SILVER','WAIST_CHAINS','Waist Chains',15,TRUE),
('SILVER','HAIR_ACCESSORIES','Hair Accessories',16,TRUE),
('SILVER','NOSE_PINS','Nose Pins',17,TRUE),
('SILVER','IDOLS_MURTIS','Idols & Murtis',18,TRUE),
('SILVER','POOJA_THALIS','Pooja Thalis',19,TRUE),
('SILVER','DIYAS','Diyas',20,TRUE),
('SILVER','BOWLS_SERVEWARE','Bowls & Serveware',21,TRUE),
('SILVER','GLASS_SETS','Glass Sets',22,TRUE),
('SILVER','SILVER_COINS','Silver Coins',23,TRUE),
('SILVER','KEYCHAINS','Keychains',24,TRUE),
('SILVER','GIFT_ARTICLES','Gift Articles',25,TRUE),
('SILVER','SILVER_UTENSILS','Silver Utensils',26,TRUE),
('DIAMOND','RINGS','Rings',1,TRUE),
('DIAMOND','SOLITAIRE_RINGS','Solitaire Rings',2,TRUE),
('DIAMOND','ENGAGEMENT_RINGS','Engagement Rings',3,TRUE),
('DIAMOND','WEDDING_BANDS','Wedding Bands',4,TRUE),
('DIAMOND','NECKLACES','Necklaces',5,TRUE),
('DIAMOND','NECKLACE_SETS','Necklace Sets',6,TRUE),
('DIAMOND','PENDANTS','Pendants',7,TRUE),
('DIAMOND','EARRINGS','Earrings',8,TRUE),
('DIAMOND','STUDS','Studs',9,TRUE),
('DIAMOND','DROP_EARRINGS','Drop Earrings',10,TRUE),
('DIAMOND','JHUMKAS','Jhumkas',11,TRUE),
('DIAMOND','BRACELETS','Bracelets',12,TRUE),
('DIAMOND','TENNIS_BRACELETS','Tennis Bracelets',13,TRUE),
('DIAMOND','BANGLES','Bangles',14,TRUE),
('DIAMOND','KADA','Kada',15,TRUE),
('DIAMOND','MANGALSUTRA','Mangalsutra',16,TRUE),
('DIAMOND','NOSE_PINS','Nose Pins',17,TRUE),
('DIAMOND','NATH','Nath',18,TRUE),
('DIAMOND','MAANG_TIKKA','Maang Tikka',19,TRUE),
('DIAMOND','BRIDAL_SETS','Bridal Sets',20,TRUE),
('DIAMOND','MENS_RINGS','Men''s Rings',21,TRUE),
('DIAMOND','MENS_BRACELETS','Men''s Bracelets',22,TRUE)
ON CONFLICT (category_code,subcategory_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS jewellery_designs (
  id BIGSERIAL PRIMARY KEY,
  design_code VARCHAR(100) NOT NULL UNIQUE,
  design_name VARCHAR(220) NOT NULL,
  category_code VARCHAR(20) NOT NULL,
  subcategory_id BIGINT NOT NULL,
  description TEXT NOT NULL,
  jewellery_type VARCHAR(100) NOT NULL,
  design_style VARCHAR(80) NOT NULL,
  regional_inspiration VARCHAR(80),
  purity_material VARCHAR(120) NOT NULL,
  image_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (image_status IN ('PENDING','READY')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY(subcategory_id,category_code)
    REFERENCES jewellery_design_subcategories(id,category_code)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_jewellery_design_name_subcategory
  ON jewellery_designs(subcategory_id,LOWER(design_name));
CREATE INDEX IF NOT EXISTS idx_jewellery_designs_category_subcategory
  ON jewellery_designs(category_code,subcategory_id,active,design_name);
CREATE INDEX IF NOT EXISTS idx_jewellery_designs_search
  ON jewellery_designs USING GIN (to_tsvector('simple',design_code || ' ' || design_name));

CREATE TABLE IF NOT EXISTS jewellery_design_images (
  id BIGSERIAL PRIMARY KEY,
  design_id BIGINT NOT NULL REFERENCES jewellery_designs(id) ON DELETE CASCADE,
  storage_key VARCHAR(100) NOT NULL UNIQUE,
  thumbnail_key VARCHAR(100) NOT NULL UNIQUE,
  original_name VARCHAR(255) NOT NULL,
  content_type VARCHAR(80) NOT NULL,
  size_bytes BIGINT NOT NULL CHECK(size_bytes > 0),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_jewellery_design_one_primary_image
  ON jewellery_design_images(design_id) WHERE is_primary=TRUE;
CREATE INDEX IF NOT EXISTS idx_jewellery_design_images_design
  ON jewellery_design_images(design_id,sort_order,id);

CREATE TABLE IF NOT EXISTS jewellery_design_sequences (
  subcategory_id BIGINT PRIMARY KEY REFERENCES jewellery_design_subcategories(id) ON DELETE CASCADE,
  next_number INTEGER NOT NULL DEFAULT 1 CHECK(next_number > 0)
);

INSERT INTO jewellery_design_sequences(subcategory_id,next_number)
SELECT id,1 FROM jewellery_design_subcategories
ON CONFLICT (subcategory_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS jewellery_design_seed_batches (
  batch_code VARCHAR(20) PRIMARY KEY,
  expected_count INTEGER NOT NULL,
  seeded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK(batch_code IN ('GOLD','SILVER','DIAMOND'))
);
