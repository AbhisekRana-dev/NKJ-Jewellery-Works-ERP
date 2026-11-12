-- DIAMOND catalogue batch: 22 subcategories x 20 distinct motif/construction combinations.
WITH patterns(subcategory_code,item_noun,motifs,forms) AS (
  VALUES
('RINGS','Diamond Ring',ARRAY['Round Brilliant','Princess-Cut','Oval Halo','Pear Solitaire','Emerald-Cut' ]::TEXT[],ARRAY['Four-Prong Solitaire Mount','Pavé Split-Shank Mount','Bezel Minimal Mount','Vintage Milgrain Mount' ]::TEXT[]),
('SOLITAIRE_RINGS','Solitaire Ring',ARRAY['Round Brilliant','Oval Brilliant','Pear Brilliant','Emerald Step-Cut','Cushion Brilliant' ]::TEXT[],ARRAY['Classic Four-Prong Solitaire','Six-Prong Cathedral Solitaire','Bezel-Set Solitaire','Hidden-Halo Solitaire' ]::TEXT[]),
('ENGAGEMENT_RINGS','Engagement Ring',ARRAY['Oval Centre Stone','Round Centre Stone','Pear Centre Stone','Radiant Centre Stone','Cushion Centre Stone' ]::TEXT[],ARRAY['Hidden-Halo Bridal Mount','Twisted Pavé Shank','Six-Prong Cathedral Mount','Tapered Baguette Side-Stone Mount' ]::TEXT[]),
('WEDDING_BANDS','Wedding Band',ARRAY['Shared-Prong Eternity','Channel-Set Baguette','Alternating Round-and-Baguette','Contour Diamond','Milgrain Edge' ]::TEXT[],ARRAY['Full-Eternity Band','Half-Eternity Band','Curved Nesting Band','Flat Comfort-Fit Band' ]::TEXT[]),
('NECKLACES','Diamond Necklace',ARRAY['Graduated Round','Pear Drop Line','Floral Cluster','Baguette Chevron','Geometric Halo' ]::TEXT[],ARRAY['Pavé Collar Necklace','Openwork Floral Necklace','Station Diamond Necklace','Graduated Riviera Necklace' ]::TEXT[]),
('NECKLACE_SETS','Diamond Necklace Set',ARRAY['Floral Cluster','Pear Halo','Round Brilliant','Baguette Fan','Emerald-Cut Line' ]::TEXT[],ARRAY['Pavé Collar-and-Stud Set','Riviera Necklace-and-Drop Set','Openwork Bridal Set','Layered Station Set' ]::TEXT[]),
('PENDANTS','Diamond Pendant',ARRAY['Solitaire Round','Pear Halo','Heart Brilliant','Lotus Cluster','Baguette Bar' ]::TEXT[],ARRAY['Four-Prong Solitaire Drop','Pavé Halo Medallion','Bezel Minimal Pendant','Openwork Floral Frame' ]::TEXT[]),
('EARRINGS','Diamond Earring',ARRAY['Round Brilliant','Pear Cluster','Baguette Fan','Floral Halo','Princess-Cut' ]::TEXT[],ARRAY['Pavé Drop Earring','Claw-Set Cluster Earring','Bezel Station Earring','Milgrain Openwork Earring' ]::TEXT[]),
('STUDS','Diamond Stud',ARRAY['Round Brilliant','Princess-Cut','Oval Brilliant','Heart Brilliant','Floral Cluster' ]::TEXT[],ARRAY['Four-Prong Martini Stud','Three-Prong Martini Stud','Bezel-Set Stud','Halo Cluster Stud' ]::TEXT[]),
('DROP_EARRINGS','Diamond Drop Earring',ARRAY['Pear Brilliant','Baguette Line','Floral Cluster','Oval Halo','Marquise Leaf' ]::TEXT[],ARRAY['Articulated Riviera Drop','Pavé Linear Drop','Openwork Floral Drop','Halo Teardrop Drop' ]::TEXT[]),
('JHUMKAS','Diamond Jhumka',ARRAY['Floral Crown','Pear Halo','Round Cluster','Baguette Petal','Marquise Leaf' ]::TEXT[],ARRAY['Pavé Dome Jhumka','Openwork Diamond Jhumka','Graduated Bell Jhumka','Halo Fringe Jhumka' ]::TEXT[]),
('BRACELETS','Diamond Bracelet',ARRAY['Round Station','Baguette Link','Floral Cluster','Oval Halo','Geometric Bar' ]::TEXT[],ARRAY['Pavé Link Bracelet','Bezel Station Bracelet','Openwork Floral Bracelet','Flexible Prong-Set Bracelet' ]::TEXT[]),
('TENNIS_BRACELETS','Tennis Bracelet',ARRAY['Round Brilliant Line','Oval Brilliant Line','Princess-Cut Line','Baguette-and-Round Line','Alternating Pear Line' ]::TEXT[],ARRAY['Four-Prong Tennis Bracelet','Bezel Tennis Bracelet','Channel Tennis Bracelet','Graduated Tennis Bracelet' ]::TEXT[]),
('BANGLES','Diamond Bangle',ARRAY['Floral Cluster','Baguette Chevron','Round Brilliant Row','Marquise Leaf','Geometric Halo' ]::TEXT[],ARRAY['Pavé Hinged Bangle','Channel-Set Bangle','Open Floral Bangle','Flexible Diamond Bangle' ]::TEXT[]),
('KADA','Diamond Kada',ARRAY['Round Brilliant Crest','Baguette Shield','Floral Halo','Emerald-Cut Bar','Marquise Vine' ]::TEXT[],ARRAY['Pavé Cuff Kada','Channel-Set Hinged Kada','Openwork Diamond Kada','Bezel-Station Kada' ]::TEXT[]),
('MANGALSUTRA','Diamond Mangalsutra',ARRAY['Solitaire Vati','Twin-Diamond Drop','Lotus Cluster','Baguette Bar','Infinity Pendant' ]::TEXT[],ARRAY['Black-Bead Diamond Station Chain','Pavé Vati Pendant','Minimal Bezel Mangalsutra','Layered Bridal Mangalsutra' ]::TEXT[]),
('NOSE_PINS','Diamond Nose Pin',ARRAY['Round Brilliant','Princess-Cut','Tiny Heart','Four-Petal Flower','Pear Drop' ]::TEXT[],ARRAY['Three-Prong Bezel Nose Pin','Four-Claw Solitaire Nose Pin','Micro-Pavé Flower Pin','Minimal Flush-Set Pin' ]::TEXT[]),
('NATH','Diamond Nath',ARRAY['Pear Halo Crescent','Round Cluster Crescent','Baguette Arc','Floral Diamond Arc','Marquise Leaf Arc' ]::TEXT[],ARRAY['Pavé Bridal Nath','Openwork Diamond Nath','Pear-Set Crescent Nath','Milgrain Halo Nath' ]::TEXT[]),
('MAANG_TIKKA','Diamond Maang Tikka',ARRAY['Round Halo','Pear Drop','Floral Cluster','Baguette Fan','Marquise Leaf' ]::TEXT[],ARRAY['Pavé Centre Tikka','Openwork Diamond Tikka','Bezel Halo Tikka','Graduated Drop Tikka' ]::TEXT[]),
('BRIDAL_SETS','Diamond Bridal Set',ARRAY['Oval Halo Centre','Pear Cluster Centre','Round Brilliant Line','Emerald-Cut Centre','Floral Cluster Centre' ]::TEXT[],ARRAY['Riviera Bridal Necklace Set','Pavé Collar Bridal Set','Openwork Royal Bridal Set','Layered Halo Bridal Set' ]::TEXT[]),
('MENS_RINGS','Men's Diamond Ring',ARRAY['Princess-Cut Centre','Black Diamond Centre','Round Brilliant Crest','Baguette Shield','Geometric Halo' ]::TEXT[],ARRAY['Bezel Signet Ring','Channel-Set Band Ring','Pavé Crest Ring','Matte Gold Diamond Ring' ]::TEXT[]),
('MENS_BRACELETS','Men's Diamond Bracelet',ARRAY['Black Diamond Link','Baguette Bar','Round Station','Geometric Shield','Onyx-and-Diamond' ]::TEXT[],ARRAY['Pavé Link Bracelet','Bezel Bar Bracelet','Channel-Set Cuff Bracelet','Matte Two-Tone Bracelet' ]::TEXT[])
), expanded AS (
  SELECT s.id AS subcategory_id,s.category_code,s.subcategory_code,s.display_name,
         p.item_noun,p.motifs[(n-1)/4+1] AS motif,p.forms[((n-1)%4)+1] AS form,n AS ordinal
    FROM patterns p
    JOIN jewellery_design_subcategories s
      ON s.category_code='DIAMOND' AND s.subcategory_code=p.subcategory_code
    CROSS JOIN generate_series(1,20) AS n
), enriched AS (
  SELECT e.*,
         ARRAY['Classic','Solitaire','Bridal','Daily Wear','Halo','Cluster','Pavé','Contemporary','Minimalist','Premium Designer']::TEXT[][(e.ordinal-1)%10+1] AS style,
         ARRAY['North Indian','South Indian','Punjabi','Rajasthani','Bengali',NULL,NULL,NULL]::TEXT[][(e.ordinal-1)%8+1] AS region,
         ARRAY['18K Gold + Natural Diamonds','18K Gold + Lab-Grown Diamonds','14K Gold + Natural Diamonds','Platinum + Natural Diamonds']::TEXT[][(e.ordinal-1)%4+1] AS material
    FROM expanded e
)
INSERT INTO jewellery_designs(
  design_code,design_name,category_code,subcategory_id,description,
  jewellery_type,design_style,regional_inspiration,purity_material,image_status,active
)
SELECT
  'NKJ_DIAMOND_' || e.subcategory_code || '_' || LPAD(e.ordinal::TEXT,4,'0'),
  e.motif || ' ' || e.form || ' ' || e.item_noun,
  e.category_code,e.subcategory_id,
  FORMAT('%s design with a %s silhouette, %s detailing and carefully balanced surface texture. This concept is intended for Indian retail collections with a %s character.',
    e.motif,e.form,LOWER(e.style),LOWER(e.style)),
  e.display_name,e.style,e.region,e.material,'PENDING',TRUE
FROM enriched e
ON CONFLICT (design_code) DO NOTHING;

INSERT INTO jewellery_design_sequences(subcategory_id,next_number)
SELECT id,21 FROM jewellery_design_subcategories WHERE category_code='DIAMOND'
ON CONFLICT (subcategory_id) DO UPDATE SET next_number=GREATEST(jewellery_design_sequences.next_number,21);

INSERT INTO jewellery_design_seed_batches(batch_code,expected_count)
VALUES('DIAMOND',440)
ON CONFLICT (batch_code) DO NOTHING;
