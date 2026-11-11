-- V34: curate 25 category-specific Indian Silver concepts across all 26 approved Silver subcategories.
-- Existing IDs, codes, images and owner-managed records remain unchanged.
WITH category_designs(subcategory_slug, design_names) AS (
    VALUES
      ('anklets-and-payal', ARRAY['Bengali Ghungroo Silver Payal', 'Rajasthani Oxidised Chain Payal', 'South Indian Kolusu Silver Anklets', 'Tribal Coin Charm Payal', '925 Sterling Filigree Payal', 'Peacock Charm Silver Anklets', 'Mango Motif Traditional Payal', 'Lightweight Daily Wear Payal', 'Double Row Ghungroo Payal', 'Antique Bell Cluster Payal', 'Kerala Palakka Silver Anklets', 'Gujarati Bead Work Payal', 'Maharashtrian Traditional Payal', 'Punjabi Broad Link Payal', 'Openwork Floral Silver Payal', 'Matte Oxidised Foot Chain', 'Classic Fine Cable Payal', 'Adjustable Minimal Silver Anklets', 'Temple Motif Silver Payal', 'Handcrafted Chain Link Payal', 'Leaf Motif Filigree Anklets', 'Tribal Geometric Silver Payal', 'Pearl Drop Silver Anklets', 'Bridal Layered Silver Payal', 'Contemporary Sleek Silver Payal']::TEXT[]),
      ('toe-rings-and-bichiya', ARRAY['Bengali Nakshi Bichiya Pair', 'Rajasthani Oxidised Toe Rings', 'South Indian Mettelu Silver Pair', '925 Sterling Floral Bichiya', 'Tribal Engraved Toe Rings', 'Adjustable Daily Wear Bichiya', 'Peacock Motif Silver Toe Rings', 'Mango Motif Toe Ring Pair', 'Filigree Leaf Bichiya', 'Antique Dome Silver Toe Rings', 'Gujarati Mirror Detail Bichiya', 'Maharashtrian Traditional Toe Rings', 'Punjabi Broad Band Bichiya', 'Openwork Flower Toe Rings', 'Matte Oxidised Bichiya Pair', 'Minimal Sleek Silver Toe Rings', 'Ghungroo Accent Bichiya', 'Double Band Silver Toe Rings', 'Ruby Glass Accent Bichiya', 'Wave Pattern Toe Rings', 'Geometric Sterling Toe Rings', 'Classic Plain Silver Bichiya', 'Heritage Engraved Toe Rings', 'Bridal Adjustable Bichiya', 'Contemporary Sculpted Toe Rings']::TEXT[]),
      ('rings', ARRAY['Bengali Filigree Silver Ring', 'Rajasthani Oxidised Statement Ring', 'South Indian Temple Silver Ring', 'Tribal Engraved Silver Ring', '925 Sterling Solitaire Look Ring', 'Peacock Motif Silver Ring', 'Mango Motif Silver Ring', 'Antique Coin Silver Ring', 'Openwork Floral Silver Ring', 'Gujarati Meenakari Silver Ring', 'Maharashtrian Peshwai Silver Ring', 'Kashmiri Filigree Silver Ring', 'Turquoise Accent Silver Ring', 'Onyx Bezel Silver Ring', 'Adjustable Daily Wear Ring', 'Minimal Geometric Silver Band', 'Wide Oxidised Heritage Ring', 'Twin Leaf Silver Ring', 'Lotus Motif Silver Ring', 'Hammered Texture Silver Ring', 'Twisted Rope Silver Ring', 'Classic Sterling Signet Ring', 'Tribal Spiral Silver Ring', 'Pearl Accent Silver Ring', 'Contemporary Sculpted Silver Ring']::TEXT[]),
      ('chains', ARRAY['925 Sterling Box Link Chain', 'Silver Rope Twist Chain', 'Singapore Silver Chain', 'Figaro Sterling Chain', 'Curb Link Silver Chain', 'Wheat Link Silver Chain', 'Snake Link Sterling Chain', 'Foxtail Silver Chain', 'Anchor Link Silver Chain', 'Paperclip Sterling Chain', 'Ball Bead Silver Chain', 'Flat Cable Silver Chain', 'Herringbone Silver Chain', 'Mariner Link Chain', 'Byzantine Sterling Chain', 'Oxidised Tribal Link Chain', 'Handmade Filigree Chain', 'Matte Finish Silver Chain', 'Double Layer Silver Chain', 'Minimal Daily Wear Chain', 'Kerala Coin Link Chain', 'Bengali Heritage Silver Chain', 'Heavy Statement Curb Chain', 'Lightweight Fine Cable Chain', 'Contemporary Geometric Chain']::TEXT[]),
      ('necklaces', ARRAY['Bengali Hasuli Silver Necklace', 'Rajasthani Aad Silver Necklace', 'South Indian Temple Silver Necklace', 'Tribal Oxidised Collar Necklace', '925 Sterling Filigree Necklace', 'Peacock Motif Silver Necklace', 'Mango Motif Heritage Necklace', 'Antique Coin Statement Necklace', 'Gujarati Mirror Work Necklace', 'Maharashtrian Thushi Silver Necklace', 'Kerala Palakka Necklace', 'Kashmiri Chinar Leaf Necklace', 'Afghani Inspired Tribal Necklace', 'Lotus Engraved Silver Necklace', 'Ghungroo Fringe Necklace', 'Openwork Floral Collar Necklace', 'Matte Oxidised Choker Necklace', 'Lightweight Daily Silver Necklace', 'Layered Bead Silver Necklace', 'Pearl Drop Sterling Necklace', 'Geometric Minimal Necklace', 'Handcrafted Nakshi Necklace', 'Coin Cascade Heritage Necklace', 'Bridal Oxidised Silver Necklace', 'Contemporary Sculpted Necklace']::TEXT[]),
      ('pendants', ARRAY['Om Sterling Silver Pendant', 'Ganesh Silver Pendant', 'Lakshmi Silver Pendant', 'Bengali Nakshi Pendant', 'South Indian Temple Pendant', 'Rajasthani Kundan Look Pendant', 'Meenakari Peacock Silver Pendant', 'Mango Motif Silver Pendant', 'Filigree Floral Pendant', 'Peacock Feather Pendant', 'Lotus Motif Silver Pendant', 'Antique Coin Pendant', 'Tribal Engraved Pendant', 'Tree of Life Silver Pendant', 'Heart Shape Sterling Pendant', 'Photo Frame Silver Pendant', 'Initial Letter Silver Pendant', 'Minimal Geometric Pendant', 'Turquoise Accent Silver Pendant', 'Onyx Bezel Pendant', 'Ghungroo Charm Pendant', 'Gujarati Enamel Pendant', 'Maharashtrian Peshwai Pendant', 'Openwork Leaf Pendant', 'Contemporary Bar Pendant']::TEXT[]),
      ('earrings', ARRAY['Bengali Dokra Style Silver Earrings', 'Rajasthani Oxidised Jhumar Earrings', 'South Indian Temple Silver Earrings', 'Tribal Bell Silver Earrings', '925 Sterling Filigree Earrings', 'Peacock Motif Silver Earrings', 'Mango Motif Silver Earrings', 'Gujarati Mirror Detail Earrings', 'Maharashtrian Peshwai Earrings', 'Kashmiri Chinar Earrings', 'Kerala Palakka Silver Earrings', 'Afghani Coin Drop Earrings', 'Lotus Motif Silver Earrings', 'Turquoise Accent Earrings', 'Onyx Bezel Silver Earrings', 'Ghungroo Cluster Earrings', 'Matte Oxidised Floral Earrings', 'Minimal Geometric Silver Earrings', 'Openwork Leaf Earrings', 'Handcrafted Wirework Earrings', 'Pearl Drop Sterling Earrings', 'Antique Coin Disc Earrings', 'Tribal Spiral Earrings', 'Contemporary Sculpted Earrings', 'Festive Statement Silver Earrings']::TEXT[]),
      ('jhumkas', ARRAY['Bengali Filigree Jhumkas', 'Rajasthani Oxidised Dome Jhumkas', 'South Indian Temple Jhumkas', 'Tribal Ghungroo Jhumkas', '925 Sterling Bell Jhumkas', 'Peacock Motif Silver Jhumkas', 'Mango Motif Jhumkas', 'Gujarati Mirror Work Jhumkas', 'Maharashtrian Peshwai Jhumkas', 'Kashmiri Chinar Jhumkas', 'Kerala Palakka Jhumkas', 'Afghani Coin Cluster Jhumkas', 'Lotus Motif Jhumkas', 'Turquoise Accent Jhumkas', 'Onyx Bead Silver Jhumkas', 'Matte Oxidised Daily Jhumkas', 'Lightweight Office Wear Jhumkas', 'Openwork Filigree Dome Jhumkas', 'Antique Tribal Bell Jhumkas', 'Pearl Fringe Silver Jhumkas', 'Layered Ghungroo Jhumkas', 'Handcrafted Wirework Jhumkas', 'Geometric Modern Jhumkas', 'Heritage Nakshi Jhumkas', 'Grand Festive Silver Jhumkas']::TEXT[]),
      ('studs', ARRAY['925 Sterling Ball Studs', 'Bengali Nakshi Silver Studs', 'Rajasthani Oxidised Studs', 'South Indian Temple Studs', 'Tribal Spiral Silver Studs', 'Peacock Motif Stud Earrings', 'Mango Motif Silver Studs', 'Lotus Flower Silver Studs', 'Filigree Disc Silver Studs', 'Gujarati Enamel Silver Studs', 'Maharashtrian Peshwai Studs', 'Kashmiri Chinar Leaf Studs', 'Turquoise Bezel Studs', 'Onyx Square Silver Studs', 'Pearl Halo Silver Studs', 'Minimal Geometric Studs', 'Matte Oxidised Button Studs', 'Tiny Daily Wear Sterling Studs', 'Openwork Floral Studs', 'Ghungroo Dot Silver Studs', 'Antique Coin Studs', 'Leaf Motif Sterling Studs', 'Heart Shape Silver Studs', 'Contemporary Bar Studs', 'Classic Heritage Silver Studs']::TEXT[]),
      ('bangles', ARRAY['Bengali Filigree Silver Bangles', 'Rajasthani Oxidised Bangle Pair', 'South Indian Temple Silver Bangles', 'Tribal Engraved Silver Bangles', '925 Sterling Cable Bangles', 'Peacock Motif Silver Bangles', 'Mango Motif Heritage Bangles', 'Gujarati Mirror Work Bangles', 'Maharashtrian Peshwai Bangles', 'Kashmiri Chinar Bangles', 'Kerala Palakka Bangles', 'Antique Coin Cluster Bangles', 'Openwork Floral Silver Bangles', 'Matte Oxidised Daily Bangles', 'Twisted Rope Sterling Bangles', 'Geometric Cuff Silver Bangles', 'Ghungroo Accent Bangles', 'Turquoise Inlay Silver Bangles', 'Onyx Bead Silver Bangles', 'Lightweight Stackable Bangles', 'Hammered Texture Bangles', 'Tribal Spiral Bangles', 'Broad Bridal Oxidised Bangles', 'Classic Plain Sterling Bangles', 'Contemporary Sculpted Bangles']::TEXT[]),
      ('bracelets', ARRAY['925 Sterling Box Link Bracelet', 'Bengali Nakshi Silver Bracelet', 'Rajasthani Oxidised Cuff Bracelet', 'South Indian Temple Link Bracelet', 'Tribal Engraved Silver Bracelet', 'Peacock Motif Bracelet', 'Mango Motif Silver Bracelet', 'Filigree Floral Bracelet', 'Gujarati Mirror Work Bracelet', 'Maharashtrian Peshwai Bracelet', 'Kashmiri Chinar Bracelet', 'Turquoise Accent Silver Bracelet', 'Onyx Bead Sterling Bracelet', 'Pearl Station Silver Bracelet', 'Twisted Rope Silver Bracelet', 'Paperclip Link Bracelet', 'Matte Curb Silver Bracelet', 'Minimal Daily Wear Bracelet', 'Openwork Leaf Bracelet', 'Ghungroo Charm Bracelet', 'Antique Coin Cascade Bracelet', 'Geometric Bar Bracelet', 'Hammered Texture Cuff', 'Men''s Tribal Silver Bracelet', 'Contemporary Sculpted Bracelet']::TEXT[]),
      ('kada', ARRAY['Punjabi Oxidised Silver Kada', 'Rajasthani Engraved Kada', 'South Indian Temple Silver Kada', 'Bengali Nakshi Kada', 'Tribal Broad Silver Kada', '925 Sterling Plain Kada', 'Peacock Motif Silver Kada', 'Mango Motif Heritage Kada', 'Gujarati Mirror Detail Kada', 'Maharashtrian Peshwai Kada', 'Kashmiri Chinar Kada', 'Turquoise Inlay Kada', 'Onyx Bead Silver Kada', 'Filigree Openwork Kada', 'Matte Oxidised Daily Kada', 'Twisted Rope Sterling Kada', 'Geometric Cuff Kada', 'Hammered Texture Silver Kada', 'Ghungroo Accent Kada', 'Coin Motif Silver Kada', 'Men''s Heavy Sterling Kada', 'Lightweight Sleek Kada', 'Bridal Oxidised Statement Kada', 'Heritage Engraved Kada', 'Contemporary Sculpted Kada']::TEXT[]),
      ('baby-jewellery', ARRAY['Baby Silver Nazariya Bracelet', 'Infant Black Bead Silver Kada', 'Baby Ghungroo Anklet', 'Tiny Sterling Ear Studs', 'Baby Om Silver Pendant', 'Child Nameplate Pendant', 'Baby Lakshmi Pendant', 'Adjustable Silver Kada', 'Soft Edge Baby Bangle', 'Lightweight Infant Anklet', 'Baby Peacock Charm', 'Tiny Star Silver Studs', 'Baby Safety Chain', 'Infant Toe Ring Pair', 'Child Heart Pendant', 'Silver Baby Spoon Gift', 'Baby Floral Bracelet', 'Traditional Bengali Baby Kada', 'South Indian Child Anklet', 'Maharashtrian Baby Nazariya', 'Engraved Initial Pendant', 'Soft Bead Silver Bracelet', 'Keepsake Birth Gift Locket', 'Child Elephant Charm', 'Ceremony Gift Baby Set']::TEXT[]),
      ('nazariya', ARRAY['Black Bead Silver Nazariya', 'Bengali Baby Nazar Bracelet', 'Rajasthani Silver Nazar Kada', 'South Indian Infant Nazariya', '925 Sterling Nazar Chain', 'Tiny Ghungroo Nazariya', 'Peacock Charm Nazariya', 'Om Symbol Silver Nazariya', 'Ganesh Nazar Pendant Bracelet', 'Evil Eye Silver Nazariya', 'Turquoise Bead Nazar Bracelet', 'Onyx Bead Baby Nazariya', 'Adjustable Infant Nazar Chain', 'Soft Silver Ball Nazariya', 'Filigree Baby Nazariya', 'Antique Coin Nazar Bracelet', 'Minimal Daily Nazariya', 'Double Row Black Bead Chain', 'Silver Bell Baby Nazariya', 'Lotus Charm Nazariya', 'Heart Charm Nazar Bracelet', 'Child Nameplate Nazariya', 'Traditional Thread Silver Nazariya', 'Keepsake Baby Nazar Kada', 'Contemporary Safety Bracelet']::TEXT[]),
      ('waist-chains', ARRAY['Traditional Silver Kamarbandh', 'Bengali Filigree Waist Chain', 'Rajasthani Oxidised Kamar Chain', 'South Indian Vaddanam Silver Chain', 'Tribal Coin Waist Chain', '925 Sterling Layered Waist Chain', 'Peacock Charm Kamarbandh', 'Mango Motif Silver Waist Chain', 'Ghungroo Fringe Waist Chain', 'Antique Coin Kamar Chain', 'Gujarati Bead Waist Chain', 'Maharashtrian Peshwai Kamarbandh', 'Kashmiri Filigree Waist Chain', 'Openwork Floral Kamarbandh', 'Matte Oxidised Waist Chain', 'Lightweight Daily Waist Chain', 'Double Row Silver Kamarbandh', 'Pearl Drop Waist Chain', 'Lotus Motif Waist Belt', 'Tribal Geometric Waist Chain', 'Temple Motif Kamarbandh', 'Bridal Statement Silver Waist Chain', 'Adjustable Link Waist Chain', 'Classic Fine Chain Kamarbandh', 'Contemporary Minimal Waist Chain']::TEXT[]),
      ('hair-accessories', ARRAY['Silver Filigree Juda Pin', 'Bengali Nakshi Hair Pin', 'South Indian Jadai Billai', 'Rajasthani Oxidised Hair Comb', 'Peacock Motif Silver Hair Pin', 'Lotus Motif Juda Ornament', 'Mango Motif Hair Veni', 'Pearl Fringe Hair Accessory', 'Turquoise Accent Hair Pin', 'Antique Coin Hair Comb', 'Floral Cluster Silver Hair Pin', 'Temple Gopuram Jada Pin', 'Openwork Leaf Hair Clip', 'Traditional Silver Hair Chain', 'Maharashtrian Peshwai Hair Ornament', 'Gujarati Mirror Work Hair Pin', 'Punjabi Bridal Kalgi', 'Matte Oxidised Hair Barrette', 'Lightweight Daily Silver Clip', 'Chinar Leaf Hair Ornament', 'Ghungroo Hair Chain', 'Tribal Spiral Hair Pin', 'Geometric Silver Hair Clip', 'Heritage Filigree Jadai Ornament', 'Festive Silver Hair Set']::TEXT[]),
      ('nose-pins', ARRAY['Bengali Phool Silver Nose Pin', 'South Indian Mukkuthi Silver Pin', 'Rajasthani Oxidised Nose Pin', 'Maharashtrian Nathni Silver Pin', 'Gujarati Nathadi Silver Pin', 'Tribal Spiral Nose Stud', '925 Sterling Ball Nose Pin', 'Peacock Motif Nose Pin', 'Lotus Motif Silver Nose Pin', 'Filigree Leaf Nose Pin', 'Turquoise Accent Nose Pin', 'Onyx Bezel Nose Stud', 'Antique Nakshi Nose Pin', 'Minimal Daily Silver Nose Pin', 'Tiny Star Silver Nose Stud', 'Geometric Silver Nose Pin', 'Openwork Flower Nose Pin', 'Ghungroo Accent Nose Pin', 'Kashmiri Chinar Nose Pin', 'Matte Oxidised Nose Stud', 'Pearl Dot Silver Nose Pin', 'Temple Motif Nose Pin', 'Adjustable Silver Nath Pin', 'Contemporary Bar Nose Pin', 'Heritage Floral Nose Pin']::TEXT[]),
      ('idols-and-murtis', ARRAY['Lakshmi Ashtalakshmi Silver Murti', 'Ganesh Seated Silver Idol', 'Saraswati Veena Silver Murti', 'Balaji Silver Temple Idol', 'Krishna Flute Silver Murti', 'Radha Krishna Silver Idol', 'Durga Mahishasura Mardini Murti', 'Shiva Parivar Silver Idol', 'Nandi Silver Sculpture', 'Hanuman Silver Idol', 'Sai Baba Silver Murti', 'Buddha Meditation Silver Statue', 'Jain Tirthankara Silver Idol', 'Navagraha Silver Idol Set', 'Shree Yantra Silver Plate Idol', 'Gajalakshmi Silver Murti', 'Annapurna Silver Idol', 'Kuber Silver Murti', 'Ram Darbar Silver Idol', 'Vishnu Sheshashayi Silver Murti', 'Murugan Vel Silver Idol', 'Jagannath Balabhadra Subhadra Set', 'Dancing Ganesha Silver Sculpture', 'Temple Bell Silver Figurine', 'Miniature Silver Pooja Idol Set']::TEXT[]),
      ('pooja-thalis', ARRAY['Traditional Round Silver Pooja Thali', 'Bengali Puja Filigree Thali', 'South Indian Temple Pooja Plate', 'Rajasthani Engraved Pooja Thali', 'Lakshmi Motif Silver Thali', 'Ganesh Motif Aarti Thali', 'Peacock Border Pooja Thali', 'Lotus Repousse Silver Thali', '925 Sterling Minimal Thali', 'Antique Oxidised Puja Plate', 'Gujarati Mirror Detail Thali', 'Maharashtrian Peshwai Puja Thali', 'Navratri Aarti Silver Thali', 'Diwali Lakshmi Pooja Thali', 'Wedding Ritual Silver Thali', 'Kumkum Haldi Compartment Thali', 'Panchapatra Set Serving Thali', 'Filigree Floral Pooja Thali', 'Temple Gopuram Border Thali', 'Hand-Engraved Heritage Thali', 'Matte Finish Daily Puja Thali', 'Compartmented Silver Puja Tray', 'Decorative Charan Paduka Thali', 'Gift Edition Silver Thali', 'Contemporary Oval Pooja Thali']::TEXT[]),
      ('diyas', ARRAY['Traditional Single Wick Silver Diya', 'Lakshmi Lotus Silver Diya', 'Ganesh Motif Silver Diya', 'Peacock Handle Silver Diya', 'South Indian Kuthu Vilakku', 'Bengali Puja Silver Pradeep', 'Rajasthani Repousse Diya', '925 Sterling Minimal Diya', 'Antique Oxidised Temple Diya', 'Five Wick Panchmukhi Diya', 'Brass-Style Silver Finish Diya', 'Lotus Petal Floating Diya', 'Elephant Handle Silver Diya', 'Filigree Floral Silver Diya', 'Mango Motif Festive Diya', 'Hand-Engraved Heritage Diya', 'Pair of Daily Puja Diyas', 'Wedding Gift Silver Diya', 'Diwali Lakshmi Diya', 'Temple Bell Shape Diya', 'Matte Finish Modern Diya', 'Hanging Silver Oil Lamp', 'Traditional Deepam Silver Lamp', 'Decorative Peacock Deepam', 'Contemporary Geometric Diya']::TEXT[]),
      ('bowls-and-serveware', ARRAY['925 Sterling Katori Bowl Set', 'Bengali Nakshi Sweet Bowl', 'South Indian Temple Prasadam Bowl', 'Rajasthani Engraved Dry Fruit Bowl', 'Lotus Repousse Serving Bowl', 'Peacock Handle Silver Bowl', 'Floral Filigree Snack Bowl', 'Antique Oxidised Fruit Bowl', 'Hammered Silver Serving Bowl', 'Geometric Minimal Bowl', 'Silver Lidded Dessert Bowl', 'Mango Motif Serving Tray', 'Temple Border Serving Platter', 'Gujarati Engraved Dry Fruit Tray', 'Maharashtrian Peshwai Bowl Set', 'Kashmiri Chinar Fruit Bowl', 'Silver Spoon and Bowl Set', 'Compartmented Silver Snack Tray', '925 Sterling Serving Tongs Set', 'Peacock Handle Serving Spoon', 'Heritage Engraved Platter', 'Matte Finish Table Bowl', 'Stackable Silver Katori Set', 'Wedding Sweet Presentation Bowl', 'Contemporary Oval Serveware']::TEXT[]),
      ('glass-sets', ARRAY['925 Sterling Rim Glass Set', 'Silver Engraved Water Tumblers', 'Bengali Nakshi Glass Pair', 'South Indian Temple Border Glasses', 'Rajasthani Repousse Glass Set', 'Peacock Motif Silver Tumblers', 'Lotus Engraved Glass Pair', 'Floral Filigree Glass Set', 'Antique Oxidised Drinking Glasses', 'Hammered Silver Water Glasses', 'Geometric Minimal Tumbler Set', 'Mango Motif Silver Glasses', 'Gujarati Heritage Glass Pair', 'Maharashtrian Peshwai Glass Set', 'Kashmiri Chinar Silver Tumblers', 'Silver Lined Juice Glasses', 'Lidded Silver Drinking Cup Set', 'Traditional Panchapatra Glass Pair', 'Wedding Gift Silver Glass Set', 'Decorative Handle Silver Goblets', 'Matte Finish Daily Glass Set', 'Stackable Sterling Tumblers', 'Heritage Engraved Goblet Pair', 'Contemporary Tall Silver Glasses', 'Premium Table Silver Glass Set']::TEXT[]),
      ('silver-coins', ARRAY['Lakshmi Silver Coin', 'Ganesh Silver Coin', 'Saraswati Silver Coin', 'Kuber Silver Coin', 'Om Silver Coin', 'Shree Yantra Silver Coin', 'Balaji Silver Coin', 'Bengali Durga Silver Coin', 'South Indian Temple Silver Coin', 'Peacock Motif Silver Coin', 'Lotus Engraved Silver Coin', 'Antique Portrait Silver Coin', 'Diwali Gift Silver Coin', 'Dhanteras Lakshmi Coin', 'Wedding Keepsake Silver Coin', 'Baby Naming Silver Coin', 'Anniversary Commemorative Coin', 'Navratna Border Silver Coin', 'Heritage Script Silver Coin', 'Two-Sided Devotional Coin', 'Geometric Edge Silver Coin', 'Matte Finish Collectible Coin', 'Classic Round Sterling Coin', 'Festive Gift Silver Coin', 'Keepsake Silver Medallion']::TEXT[]),
      ('keychains', ARRAY['Ganesh Silver Keychain', 'Om Symbol Sterling Keychain', 'Lakshmi Motif Keychain', 'Bengali Nakshi Keychain', 'South Indian Temple Keychain', 'Rajasthani Oxidised Keychain', 'Peacock Charm Silver Keychain', 'Mango Motif Keychain', 'Lotus Filigree Keychain', 'Initial Letter Silver Keychain', 'Nameplate Sterling Keychain', 'Heart Shape Silver Keychain', 'Photo Frame Silver Keychain', 'Baby Footprint Keychain', 'Elephant Charm Keychain', 'Tribal Coin Keychain', 'Turquoise Accent Keychain', 'Minimal Geometric Keychain', 'Antique Engraved Keychain', 'Car Mirror Silver Charm', 'Housewarming Gift Keychain', 'Wedding Return Gift Keychain', 'Travel Souvenir Silver Keychain', 'Heritage Script Keychain', 'Contemporary Bar Keychain']::TEXT[]),
      ('gift-articles', ARRAY['Silver Lakshmi Diwali Gift', 'Ganesh Silver Gift Figurine', 'Bengali Filigree Gift Box', 'South Indian Temple Keepsake', 'Rajasthani Engraved Dry Fruit Box', 'Peacock Motif Silver Photo Frame', 'Lotus Silver Candle Holder', '925 Sterling Baby Gift Set', 'Silver Nameplate Gift Article', 'Wedding Couple Silver Keepsake', 'Anniversary Silver Memento', 'Silver Bookmark Gift Set', 'Antique Coin Gift Envelope', 'Silver Kumkum Box', 'Decorative Silver Bell', 'Silver Agarbatti Stand Gift', 'Silver Charan Paduka Keepsake', 'Engraved Silver Key Holder', 'Silver Pen and Card Holder', 'Silver Table Clock Accent', 'Festive Silver Bowl Gift', 'Corporate Silver Memento', 'Silver Jewellery Trinket Box', 'Traditional Pooja Gift Set', 'Contemporary Silver Desk Article']::TEXT[]),
      ('silver-utensils', ARRAY['925 Sterling Dinner Spoon Set', 'Bengali Nakshi Serving Spoon', 'South Indian Silver Panchapatra', 'Rajasthani Engraved Dinner Plate', 'Silver Katori and Spoon Set', 'Temple Border Dinner Thali', 'Peacock Handle Serving Ladle', 'Lotus Engraved Dessert Spoon', 'Antique Oxidised Betel Nut Box', 'Silver Rice Serving Spoon', 'Mango Motif Serving Tray', 'Gujarati Heritage Water Pot', 'Maharashtrian Peshwai Tambya', 'Kashmiri Chinar Tea Spoon', 'Silver Lidded Sugar Bowl', 'Hand-Engraved Milk Pot', 'Sterling Salt and Pepper Set', 'Silver Baby Feeding Spoon', 'Traditional Silver Glass and Bowl Set', 'Silver Cutlery Place Setting', 'Matte Finish Daily Utensil Set', 'Silver Lassi Serving Cup', 'Temple Motif Water Jug', 'Heritage Engraved Serving Platter', 'Contemporary Silver Tableware Set']::TEXT[])
),
concepts AS (
    SELECT c.id AS category_id,
           c.metal_type,
           c.subcategory_name,
           x.design_name,
           x.sequence_no
      FROM category_designs cd
      JOIN public.jewellery_design_categories c
        ON c.metal_type = 'SILVER' AND c.slug = cd.subcategory_slug
      CROSS JOIN LATERAL UNNEST(cd.design_names)
           WITH ORDINALITY AS x(design_name, sequence_no)
),
classified AS (
    SELECT *,
       CASE
         WHEN design_name ILIKE '%Bengali%' THEN 'Bengali'
         WHEN design_name ILIKE '%South Indian%' OR design_name ILIKE '%Temple%' OR design_name ILIKE '%Kolusu%' OR design_name ILIKE '%Mettelu%' THEN 'South Indian'
         WHEN design_name ILIKE '%Rajasthani%' OR design_name ILIKE '%Oxidised%' THEN 'Rajasthani'
         WHEN design_name ILIKE '%Gujarati%' THEN 'Gujarati'
         WHEN design_name ILIKE '%Maharashtrian%' OR design_name ILIKE '%Peshwai%' THEN 'Maharashtrian'
         WHEN design_name ILIKE '%Punjabi%' THEN 'Punjabi'
         WHEN design_name ILIKE '%Kerala%' THEN 'Kerala'
         WHEN design_name ILIKE '%Kashmiri%' OR design_name ILIKE '%Chinar%' THEN 'Kashmiri'
         WHEN design_name ILIKE '%Odisha%' THEN 'Odisha'
         WHEN design_name ILIKE '%Tribal%' OR design_name ILIKE '%Afghani%' THEN 'Tribal'
         ELSE 'Pan-Indian'
       END AS regional,
       CASE
         WHEN design_name ILIKE '%Temple%' OR design_name ILIKE '%Lakshmi%' OR design_name ILIKE '%Ganesh%' OR design_name ILIKE '%Pooja%' THEN 'Temple & devotional'
         WHEN design_name ILIKE '%Nakshi%' OR design_name ILIKE '%Engraved%' OR design_name ILIKE '%Repousse%' THEN 'Nakshi & engraving'
         WHEN design_name ILIKE '%Oxidised%' OR design_name ILIKE '%Antique%' OR design_name ILIKE '%Matte%' THEN 'Antique & oxidised'
         WHEN design_name ILIKE '%Filigree%' OR design_name ILIKE '%Openwork%' OR design_name ILIKE '%Wirework%' THEN 'Filigree & openwork'
         WHEN design_name ILIKE '%Tribal%' OR design_name ILIKE '%Afghani%' THEN 'Tribal craft'
         WHEN design_name ILIKE '%Meenakari%' OR design_name ILIKE '%Enamel%' THEN 'Meenakari & enamel'
         WHEN design_name ILIKE '%Minimal%' OR design_name ILIKE '%Daily%' OR design_name ILIKE '%Sleek%' THEN 'Minimal & daily wear'
         WHEN design_name ILIKE '%Bridal%' OR design_name ILIKE '%Wedding%' OR design_name ILIKE '%Gift%' THEN 'Festive & gifting'
         WHEN design_name ILIKE '%Floral%' OR design_name ILIKE '%Peacock%' OR design_name ILIKE '%Mango%' OR design_name ILIKE '%Lotus%' THEN 'Motif & floral'
         WHEN design_name ILIKE '%Geometric%' OR design_name ILIKE '%Contemporary%' OR design_name ILIKE '%Modern%' THEN 'Contemporary'
         WHEN design_name ILIKE '%Coin%' OR design_name ILIKE '%Kasu%' THEN 'Coin & heritage'
         ELSE 'Traditional Indian'
       END AS style
      FROM concepts
)
UPDATE public.jewellery_designs d
   SET design_name = x.design_name,
       description = 'Catalogue inspiration concept: ' || x.design_name || '. ' ||
           x.subcategory_name || ' in the Silver collection, drawing on ' ||
           x.style || ' design language. Reference concept only; actual silver fineness, plating, dimensions, weight, craftsmanship and availability must be verified against a finished piece.',
       style_label = x.style,
       regional_inspiration = x.regional,
       material_label = 'Silver concept · fineness and plating not specified',
       keywords = CONCAT_WS(', ', 'SILVER', x.subcategory_name, x.design_name, x.style, x.regional,
                            'Indian silver design inspiration'),
       image_status = CASE WHEN EXISTS (
           SELECT 1 FROM public.jewellery_design_images i
            WHERE i.design_id = d.id
              AND COALESCE(NULLIF(BTRIM(i.thumbnail_url), ''),
                           NULLIF(BTRIM(i.display_url), ''),
                           NULLIF(BTRIM(i.original_url), '')) IS NOT NULL
       ) THEN 'READY' ELSE 'PENDING' END,
       updated_at = NOW()
  FROM classified x
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
     WHERE metal_type = 'SILVER' AND is_active = TRUE;
    IF category_count <> 26 THEN
        RAISE EXCEPTION 'Silver catalogue expected 26 active subcategories; found %', category_count;
    END IF;

    SELECT COUNT(*) INTO incomplete_count
      FROM (
        SELECT c.id
          FROM public.jewellery_design_categories c
          LEFT JOIN public.jewellery_designs d
            ON d.category_id = c.id AND d.is_sample = TRUE AND d.is_deleted = FALSE
         WHERE c.metal_type = 'SILVER' AND c.is_active = TRUE
         GROUP BY c.id
        HAVING COUNT(d.id) < 20
      ) q;
    IF incomplete_count > 0 THEN
        RAISE EXCEPTION 'Silver catalogue incomplete: % subcategories have fewer than 20 sample designs', incomplete_count;
    END IF;

    SELECT COUNT(*) INTO duplicate_names
      FROM (
        SELECT d.category_id, LOWER(BTRIM(d.design_name))
          FROM public.jewellery_designs d
          JOIN public.jewellery_design_categories c ON c.id=d.category_id
         WHERE c.metal_type='SILVER' AND d.is_sample=TRUE AND d.is_deleted=FALSE
         GROUP BY d.category_id, LOWER(BTRIM(d.design_name))
        HAVING COUNT(*) > 1
      ) q;
    IF duplicate_names > 0 THEN
        RAISE EXCEPTION 'Silver catalogue contains % duplicated design-name groups', duplicate_names;
    END IF;
END $$;
