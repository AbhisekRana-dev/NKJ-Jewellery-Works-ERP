-- GOLD catalogue batch: 29 subcategories x 20 distinct motif/construction combinations.
WITH patterns(subcategory_code,item_noun,motifs,forms) AS (
  VALUES
('NECKLACES','Necklace',ARRAY['Lotus Petal','Peacock Feather','Lakshmi Kasu','Mango Paisley','Navratna Bloom' ]::TEXT[],ARRAY['Temple Nakshi Collar','Bengali Filigree Bib','Jadau Polki Layer','Meenakari Rava' ]::TEXT[]),
('NECKLACE_SETS','Necklace Set',ARRAY['Lakshmi Medallion','Lotus Jali','Peacock Vanki','Mango Butti','Navratna Blossom' ]::TEXT[],ARRAY['Temple Pendant-and-Earring','Kundan Choker-and-Drop','Antique Layered Bridal','Meenakari Collar-and-Stud' ]::TEXT[]),
('CHAINS','Gold Chain',ARRAY['Cable Link','Box Link','Rope Twist','Foxtail Link','Wheat Grain' ]::TEXT[],ARRAY['Rounded Cable Weave','Square Box Weave','Braided Rope Weave','Flat Herringbone Weave' ]::TEXT[]),
('HARAMS','Haram',ARRAY['Lakshmi Coin','Mango Leaf','Peacock Pair','Rudraksha Bead','Lotus Medallion' ]::TEXT[],ARRAY['Long Temple Kasu','Multi-Layer Kasu','Nakshi Mango Drop','Bead-and-Coin Cascade' ]::TEXT[]),
('BRIDAL_SETS','Bridal Set',ARRAY['Lakshmi Bridal Motif','Peacock Jadau Motif','Lotus Kundan Motif','Mango Meenakari Motif','Navratna Floral Motif' ]::TEXT[],ARRAY['Royal Temple Choker','Polki Layered Haar','Antique Nakshi Collar','Meenakari Rani Haar' ]::TEXT[]),
('EARRINGS','Earring',ARRAY['Lotus Petal','Peacock Feather','Mango Paisley','Floral Kundan','Sunburst' ]::TEXT[],ARRAY['Temple Nakshi Drop','Jadau Polki Cluster','Filigree Dangle','Meenakari Chand Drop' ]::TEXT[]),
('JHUMKAS','Jhumka',ARRAY['Lakshmi Coin','Peacock Bell','Lotus Dome','Mango Bud','Ghungroo Cluster' ]::TEXT[],ARRAY['Temple Dome Nakshi','Kundan Bead Fringe','Antique Granulation Bell','Meenakari Tiered Bell' ]::TEXT[]),
('STUDS','Stud',ARRAY['Lotus Bloom','Four-Leaf Clover','Peacock Eye','Starburst','Pearl Halo' ]::TEXT[],ARRAY['Bezel-Set Floral','Kundan Cluster','Filigree Button','Minimal Satin Dome' ]::TEXT[]),
('TOPS','Gold Top',ARRAY['Round Sun','Tiny Lotus','Mini Peacock','Heart Petal','Daisy Bloom' ]::TEXT[],ARRAY['Screw-Back Bezel','Push-Back Nakshi','Micro-Cluster','Enamel Dot' ]::TEXT[]),
('DROP_EARRINGS','Drop Earring',ARRAY['Pear-Shaped Pearl','Lotus Cascade','Peacock Tail','Mango Teardrop','Navratna Petal' ]::TEXT[],ARRAY['Articulated Temple Drop','Polki Linear Drop','Filigree Swing Drop','Meenakari Jali Drop' ]::TEXT[]),
('CHAND_BALI','Chandbali',ARRAY['Moon Crescent','Peacock Pair','Lotus Arch','Mango Jaal','Floral Navratna' ]::TEXT[],ARRAY['Temple Bell Fringe','Jadau Polki Crescent','Bengali Filigree Arc','Meenakari Royal Arc' ]::TEXT[]),
('RINGS','Ring',ARRAY['Lotus Solitaire','Peacock Crest','Mango Signet','Navratna Flower','Twin-Leaf Motif' ]::TEXT[],ARRAY['Kundan Halo Setting','Nakshi Dome Setting','Filigree Openwork Band','Sculpted Cocktail Mount' ]::TEXT[]),
('BANGLES','Bangle',ARRAY['Mango Paisley','Peacock Feather','Lakshmi Coin','Lotus Jali','Floral Vine' ]::TEXT[],ARRAY['Temple Kada Profile','Antique Nakshi Cuff','Meenakari Enamel Edge','Twisted Rope Pair' ]::TEXT[]),
('BRACELETS','Bracelet',ARRAY['Interlocking Heart','Lotus Link','Peacock Link','Mango Station','Infinity Knot' ]::TEXT[],ARRAY['Flexible Cable Bracelet','Open Filigree Bracelet','Polki Station Bracelet','Sculpted Cuff Bracelet' ]::TEXT[]),
('KADA','Kada',ARRAY['Lion Head','Peacock Crest','Lakshmi Face','Lotus Medallion','Geometric Sun' ]::TEXT[],ARRAY['Heavy Temple Kada','Nakshi Hinged Kada','Meenakari Royal Kada','Twisted Heritage Kada' ]::TEXT[]),
('PENDANTS','Pendant',ARRAY['Lakshmi Coin','Lotus Bloom','Peacock Feather','Om Emblem','Mango Paisley' ]::TEXT[],ARRAY['Temple Nakshi Drop','Polki Halo Medallion','Filigree Openwork Frame','Meenakari Enamel Plate' ]::TEXT[]),
('MANGALSUTRA','Mangalsutra',ARRAY['Lakshmi Drop','Lotus Bead','Peacock Wing','Black-Bead Station','Twin-Circle Motif' ]::TEXT[],ARRAY['Traditional Vati Pendant','Minimal Diamond-Style Bar','Temple Gold Bead Link','Contemporary Layered Chain' ]::TEXT[]),
('NOSE_PINS','Nose Pin',ARRAY['Tiny Lotus','Single Pearl','Star Diamond','Peacock Eye','Floral Cluster' ]::TEXT[],ARRAY['Prong-Set Stud','Screw-Back Bezel','Filigree Flower','Minimal Four-Claw' ]::TEXT[]),
('NATH','Nath',ARRAY['Maharashtrian Pearl','Bengali Crescent','Rajasthani Kundan','Punjabi Polki','South Indian Temple' ]::TEXT[],ARRAY['Pearl-Chain Nath','Jadau Crescent Nath','Nakshi Hoop Nath','Meenakari Bridal Nath' ]::TEXT[]),
('ANKLETS','Gold Anklet',ARRAY['Tiny Ghungroo','Lotus Charm','Peacock Bell','Mango Leaf','Coin Charm' ]::TEXT[],ARRAY['Fine Cable Anklet','Twin-Chain Anklet','Articulated Bell Anklet','Filigree Charm Anklet' ]::TEXT[]),
('WAIST_BELTS','Waist Belt',ARRAY['Lakshmi Panel','Peacock Pair','Mango Vine','Lotus Medallion','Coin Row' ]::TEXT[],ARRAY['Temple Vaddanam','Nakshi Bridal Oddiyanam','Meenakari Waist Plate','Kasu Linked Waist Chain' ]::TEXT[]),
('ARMLETS','Armlet',ARRAY['Snake Coil','Peacock Wing','Lotus Cuff','Mango Crest','Floral Jaal' ]::TEXT[],ARRAY['Adjustable Vanki','Temple Nakshi Bajuband','Filigree Open Armlet','Jadau Bridal Armlet' ]::TEXT[]),
('MAANG_TIKKA','Maang Tikka',ARRAY['Lotus Medallion','Peacock Drop','Moon Crescent','Navratna Bloom','Mango Teardrop' ]::TEXT[],ARRAY['Temple Matha Patti Centre','Kundan Polki Tikka','Filigree Jali Tikka','Meenakari Bridal Tikka' ]::TEXT[]),
('HAIR_ACCESSORIES','Gold Hair Ornament',ARRAY['Lotus Hair Pin','Peacock Juda','Mango Jada Billai','Floral Bun Cover','Sunburst Comb' ]::TEXT[],ARRAY['Temple Jada Billai','Nakshi Juda Pin','Filigree Bridal Comb','Meenakari Hair Vanki' ]::TEXT[]),
('TOE_RINGS','Gold Toe Ring',ARRAY['Twin Leaf','Lotus Petal','Peacock Eye','Sunburst','Mango Bud' ]::TEXT[],ARRAY['Open Adjustable Band','Closed Engraved Band','Twin-Toe Link','Filigree Comfort Band' ]::TEXT[]),
('GOLD_COINS','Gold Coin',ARRAY['Lakshmi Ashtalakshmi','Ganesha Blessing','Peacock Crest','Lotus Seal','Heritage Emblem' ]::TEXT[],ARRAY['Antique Relief Coin','Temple Embossed Coin','Fine-Matte Collectible','High-Relief Commemorative' ]::TEXT[]),
('BABY_JEWELLERY','Baby Jewellery',ARRAY['Tiny Ghungroo','Moon-and-Star','Little Lotus','Mini Peacock','Protective Nazar' ]::TEXT[],ARRAY['Soft-Edge Kada','Lightweight Black-Bead Chain','Rounded Bracelet','Comfort-Fit Anklet' ]::TEXT[]),
('MENS_JEWELLERY','Men's Jewellery',ARRAY['Lion Crest','Om Signet','Tiger Eye','Geometric Shield','Royal Initial' ]::TEXT[],ARRAY['Engraved Signet Ring','Matte Curb Chain','Textured Kada','Minimal Bar Pendant' ]::TEXT[]),
('LOCKETS','Locket',ARRAY['Family Photo Oval','Lakshmi Medallion','Om Symbol','Heart Memory','Two-Sided Coin' ]::TEXT[],ARRAY['Hinged Photo Locket','Temple Relief Locket','Filigree Open Locket','Enamel Keepsake Locket' ]::TEXT[])
), expanded AS (
  SELECT s.id AS subcategory_id,s.category_code,s.subcategory_code,s.display_name,
         p.item_noun,p.motifs[(n-1)/4+1] AS motif,p.forms[((n-1)%4)+1] AS form,n AS ordinal
    FROM patterns p
    JOIN jewellery_design_subcategories s
      ON s.category_code='GOLD' AND s.subcategory_code=p.subcategory_code
    CROSS JOIN generate_series(1,20) AS n
), enriched AS (
  SELECT e.*,
         ARRAY['Traditional','Antique','Bridal','Daily Wear','Festive','Temple','Heritage','Contemporary','Lightweight','Premium Designer']::TEXT[][(e.ordinal-1)%10+1] AS style,
         ARRAY['Bengali','South Indian','Rajasthani','Gujarati','Maharashtrian','Punjabi','North Indian',NULL]::TEXT[][(e.ordinal-1)%8+1] AS region,
         ARRAY['22K Gold (916)','22K Gold (916)','18K Gold (750)','14K Gold (585)']::TEXT[][(e.ordinal-1)%4+1] AS material
    FROM expanded e
)
INSERT INTO jewellery_designs(
  design_code,design_name,category_code,subcategory_id,description,
  jewellery_type,design_style,regional_inspiration,purity_material,image_status,active
)
SELECT
  'NKJ_GOLD_' || e.subcategory_code || '_' || LPAD(e.ordinal::TEXT,4,'0'),
  e.motif || ' ' || e.form || ' ' || e.item_noun,
  e.category_code,e.subcategory_id,
  FORMAT('%s design with a %s silhouette, %s detailing and carefully balanced surface texture. This concept is intended for Indian retail collections with a %s character.',
    e.motif,e.form,LOWER(e.style),LOWER(e.style)),
  e.display_name,e.style,e.region,e.material,'PENDING',TRUE
FROM enriched e
ON CONFLICT (design_code) DO NOTHING;

INSERT INTO jewellery_design_sequences(subcategory_id,next_number)
SELECT id,21 FROM jewellery_design_subcategories WHERE category_code='GOLD'
ON CONFLICT (subcategory_id) DO UPDATE SET next_number=GREATEST(jewellery_design_sequences.next_number,21);

INSERT INTO jewellery_design_seed_batches(batch_code,expected_count)
VALUES('GOLD',580)
ON CONFLICT (batch_code) DO NOTHING;
