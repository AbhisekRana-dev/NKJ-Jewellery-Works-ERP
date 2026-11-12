-- SILVER catalogue batch: 26 subcategories x 20 distinct motif/construction combinations.
WITH patterns(subcategory_code,item_noun,motifs,forms) AS (
  VALUES
('ANKLETS_PAYAL','Payal',ARRAY['Ghungroo Cluster','Peacock Bell','Lotus Bell','Tribal Coin','Leaf Charm' ]::TEXT[],ARRAY['Double-Chain Payal','Handcrafted Rod Payal','Oxidised Knotwork Payal','Adjustable Kada Payal' ]::TEXT[]),
('TOE_RINGS_BICHIYA','Bichiya',ARRAY['Floral Petal','Twin Leaf','Peacock Eye','Sunburst','Paisley' ]::TEXT[],ARRAY['Open Adjustable Bichiya','Closed Engraved Bichiya','Twin-Toe Linked Bichiya','Oxidised Tribal Band' ]::TEXT[]),
('RINGS','Silver Ring',ARRAY['Lotus Bloom','Tribal Sun','Peacock Eye','Geometric Hexagon','Turquoise Cabochon' ]::TEXT[],ARRAY['Oxidised Openwork Ring','925 Bezel Solitaire Ring','Filigree Dome Ring','Hammered Signet Ring' ]::TEXT[]),
('CHAINS','Silver Chain',ARRAY['Cable Link','Box Link','Rope Twist','Curb Link','Wheat Grain' ]::TEXT[],ARRAY['Fine Cable Weave','Square Box Weave','Braided Rope Weave','Flat Herringbone Weave' ]::TEXT[]),
('NECKLACES','Silver Necklace',ARRAY['Tribal Coin','Bengal Lotus','Peacock Medallion','Mango Jaal','Turquoise Flower' ]::TEXT[],ARRAY['Oxidised Hasli Collar','Bengali Filigree Bib','Rajasthani Hansli','South Indian Temple Haar' ]::TEXT[]),
('PENDANTS','Silver Pendant',ARRAY['Om Emblem','Lotus Bloom','Ganesha Relief','Peacock Feather','Tribal Sun' ]::TEXT[],ARRAY['925 Bezel Cabochon','Oxidised Relief Drop','Filigree Open Frame','Enamel Colour Plate' ]::TEXT[]),
('EARRINGS','Silver Earring',ARRAY['Lotus Petal','Tribal Bell','Peacock Feather','Turquoise Drop','Floral Jaal' ]::TEXT[],ARRAY['Oxidised Dangle Drop','925 Filigree Hook','Hammered Disc Drop','Enamel Accent Drop' ]::TEXT[]),
('JHUMKAS','Silver Jhumka',ARRAY['Ghungroo Dome','Peacock Bell','Lotus Dome','Tribal Coin','Mango Bud' ]::TEXT[],ARRAY['Oxidised Dome Jhumka','Filigree Bell Jhumka','Kutch Bead-Fringe Jhumka','Temple Tiered Jhumka' ]::TEXT[]),
('STUDS','Silver Stud',ARRAY['Tiny Lotus','Turquoise Dot','Sunburst','Peacock Eye','Daisy Bloom' ]::TEXT[],ARRAY['925 Bezel Stud','Oxidised Button Stud','Filigree Cluster Stud','Hammered Disc Stud' ]::TEXT[]),
('BANGLES','Silver Bangle',ARRAY['Mango Vine','Peacock Pair','Lotus Jali','Tribal Geometry','Floral Stem' ]::TEXT[],ARRAY['Oxidised Cuff Bangle','925 Smooth Round Bangle','Hammered Open Bangle','Filigree Kada Bangle' ]::TEXT[]),
('BRACELETS','Silver Bracelet',ARRAY['Infinity Knot','Lotus Link','Peacock Link','Anchor Link','Turquoise Station' ]::TEXT[],ARRAY['925 Cable Bracelet','Oxidised Charm Bracelet','Filigree Open Bracelet','Hammered Cuff Bracelet' ]::TEXT[]),
('KADA','Silver Kada',ARRAY['Lion Head','Peacock Crest','Tribal Sun','Lotus Medallion','Geometric Shield' ]::TEXT[],ARRAY['Heavy Oxidised Kada','Hand-Hammered Kada','Filigree Open Kada','Engraved Heritage Kada' ]::TEXT[]),
('BABY_JEWELLERY','Baby Silver Ornament',ARRAY['Tiny Ghungroo','Moon-and-Star','Little Lotus','Mini Elephant','Protective Nazar' ]::TEXT[],ARRAY['Soft-Edge Kada','Lightweight Black-Bead Chain','Rounded Bracelet','Comfort-Fit Anklet' ]::TEXT[]),
('NAZARIYA','Nazariya',ARRAY['Black Bead','Silver Nazar','Tiny Moon','Little Elephant','Protective Sun' ]::TEXT[],ARRAY['925 Black-Thread Bracelet','Adjustable Baby Anklet','Soft-Knot Wrist Band','Silver Bead Waist Thread' ]::TEXT[]),
('WAIST_CHAINS','Silver Waist Chain',ARRAY['Lotus Charm','Peacock Bell','Tribal Coin','Leaf Cluster','Ghungroo Row' ]::TEXT[],ARRAY['Oxidised Kamarband','925 Linked Waist Chain','Tribal Bead Kamar Chain','Adjustable Charm Waist Chain' ]::TEXT[]),
('HAIR_ACCESSORIES','Silver Hair Ornament',ARRAY['Lotus Hair Pin','Peacock Juda','Floral Bun Cover','Moon Comb','Tribal Hair Chain' ]::TEXT[],ARRAY['Oxidised Juda Pin','925 Filigree Hair Comb','Kutch Hair Chain','Hammered Bun Cover' ]::TEXT[]),
('NOSE_PINS','Silver Nose Pin',ARRAY['Tiny Lotus','Single Pearl','Starburst','Peacock Eye','Turquoise Dot' ]::TEXT[],ARRAY['925 Bezel Stud','Oxidised Floral Screw','Filigree Flower Pin','Minimal Four-Claw Pin' ]::TEXT[]),
('IDOLS_MURTIS','Silver Idol',ARRAY['Lakshmi Lotus','Ganesha Modak','Balgopal Flute','Durga Trident','Saraswati Veena' ]::TEXT[],ARRAY['Hand-Cast Seated Idol','Fine-Relief Standing Idol','Temple Arch Murti','Miniature Desk Murti' ]::TEXT[]),
('POOJA_THALIS','Pooja Thali',ARRAY['Ashtadal Lotus','Shubh-Labh','Kalash and Swastik','Peacock Border','Ganesha Centre' ]::TEXT[],ARRAY['Raised-Rim Aarti Thali','Repousse Floral Thali','Engraved Temple Thali','Filigree Pooja Plate' ]::TEXT[]),
('DIYAS','Silver Diya',ARRAY['Lotus Bowl','Peacock Spout','Ganesha Base','Five-Wick Star','Leaf Cup' ]::TEXT[],ARRAY['Single-Wick Aarti Diya','Panchmukhi Diya','Hanging Temple Diya','Engraved Deepak Cup' ]::TEXT[]),
('BOWLS_SERVEWARE','Silver Bowl',ARRAY['Lotus Rim','Peacock Handle','Mango Border','Hammered Ripple','Floral Repousse' ]::TEXT[],ARRAY['Nesting Katori Set','Pedestal Prasad Bowl','Handled Serving Bowl','Engraved Dry-Fruit Bowl' ]::TEXT[]),
('GLASS_SETS','Silver Glass',ARRAY['Lotus Band','Peacock Panel','Geometric Flute','Hammered Ripple','Floral Vine' ]::TEXT[],ARRAY['Straight Tumbler Set','Petal-Rim Glass Set','Engraved Kansa-Style Cup','Filigree Presentation Glass' ]::TEXT[]),
('SILVER_COINS','Silver Coin',ARRAY['Lakshmi Blessing','Ganesha Blessing','Peacock Crest','Lotus Seal','Heritage Emblem' ]::TEXT[],ARRAY['999 Fine Silver Coin','Antique Relief Coin','Temple Embossed Coin','Matte Collectible Coin' ]::TEXT[]),
('KEYCHAINS','Silver Keychain',ARRAY['Ganesha Charm','Om Token','Peacock Tag','Initial Disc','Lotus Medallion' ]::TEXT[],ARRAY['925 Polished Key Fob','Oxidised Relief Keyring','Filigree Charm Keychain','Engraved Photo Keychain' ]::TEXT[]),
('GIFT_ARTICLES','Silver Gift',ARRAY['Elephant Pair','Tree of Life','Lotus Keepsake','Peacock Figurine','Ganesha Blessing' ]::TEXT[],ARRAY['925 Filigree Keepsake','Oxidised Desk Accent','Engraved Anniversary Token','Hand-Cast Collectible' ]::TEXT[]),
('SILVER_UTENSILS','Silver Utensil',ARRAY['Lotus Handle','Peacock Handle','Floral Repousse','Geometric Hammered','Temple Border' ]::TEXT[],ARRAY['Engraved Serving Spoon','Repousse Dessert Plate','Filigree Ladle Set','Hammered Utility Bowl' ]::TEXT[])
), expanded AS (
  SELECT s.id AS subcategory_id,s.category_code,s.subcategory_code,s.display_name,
         p.item_noun,p.motifs[(n-1)/4+1] AS motif,p.forms[((n-1)%4)+1] AS form,n AS ordinal
    FROM patterns p
    JOIN jewellery_design_subcategories s
      ON s.category_code='SILVER' AND s.subcategory_code=p.subcategory_code
    CROSS JOIN generate_series(1,20) AS n
), enriched AS (
  SELECT e.*,
         ARRAY['Traditional','Oxidised','Tribal','Daily Wear','Festive','Temple','Heritage','Contemporary','Minimalist','Handcrafted']::TEXT[][(e.ordinal-1)%10+1] AS style,
         ARRAY['Bengali','South Indian','Rajasthani','Tribal','Gujarati','Maharashtrian','North Indian',NULL]::TEXT[][(e.ordinal-1)%8+1] AS region,
         ARRAY['925 Sterling Silver','Oxidised 925 Sterling Silver','Fine Silver (999)','Antique-Finish 925 Sterling Silver']::TEXT[][(e.ordinal-1)%4+1] AS material
    FROM expanded e
)
INSERT INTO jewellery_designs(
  design_code,design_name,category_code,subcategory_id,description,
  jewellery_type,design_style,regional_inspiration,purity_material,image_status,active
)
SELECT
  'NKJ_SILVER_' || e.subcategory_code || '_' || LPAD(e.ordinal::TEXT,4,'0'),
  e.motif || ' ' || e.form || ' ' || e.item_noun,
  e.category_code,e.subcategory_id,
  FORMAT('%s design with a %s silhouette, %s detailing and carefully balanced surface texture. This concept is intended for Indian retail collections with a %s character.',
    e.motif,e.form,LOWER(e.style),LOWER(e.style)),
  e.display_name,e.style,e.region,e.material,'PENDING',TRUE
FROM enriched e
ON CONFLICT (design_code) DO NOTHING;

INSERT INTO jewellery_design_sequences(subcategory_id,next_number)
SELECT id,21 FROM jewellery_design_subcategories WHERE category_code='SILVER'
ON CONFLICT (subcategory_id) DO UPDATE SET next_number=GREATEST(jewellery_design_sequences.next_number,21);

INSERT INTO jewellery_design_seed_batches(batch_code,expected_count)
VALUES('SILVER',520)
ON CONFLICT (batch_code) DO NOTHING;
