package com.nkj.billing.controller;

import com.nkj.billing.service.JewelleryDesignImageStorageService;
import com.nkj.billing.service.JewelleryDesignImageStorageService.StoredImage;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@RestController
public class JewelleryDesignController {
    private final JdbcTemplate jdbc;
    private final JewelleryDesignImageStorageService imageStorage;

    public JewelleryDesignController(JdbcTemplate jdbc, JewelleryDesignImageStorageService imageStorage) {
        this.jdbc = jdbc;
        this.imageStorage = imageStorage;
    }

    @GetMapping("/api/designs/categories")
    @Cacheable("jewelleryPublicCategories")
    public List<Map<String, Object>> publicCategories() {
        return categoryList(false);
    }

    @GetMapping("/api/designs")
    public Map<String, Object> publicDesigns(
            @RequestParam(required = false) String metal,
            @RequestParam(required = false) String subcategory,
            @RequestParam(required = false, name = "q") String search,
            @RequestParam(defaultValue = "latest") String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "24") int size,
            @RequestParam(required = false) String purity,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) BigDecimal minWeight,
            @RequestParam(required = false) BigDecimal maxWeight,
            @RequestParam(defaultValue = "false") boolean featured) {
        return listDesigns(metal, subcategory, search, sort, page, size, false,
                purity, minPrice, maxPrice, minWeight, maxWeight, featured);
    }

    @GetMapping("/api/designs/{id}")
    public Map<String, Object> publicDesignDetails(@PathVariable long id) {
        jdbc.update("UPDATE public.jewellery_designs SET popularity_count = popularity_count + 1 WHERE id = ? AND is_active = TRUE", id);
        return designDetails(id, false);
    }

    @GetMapping("/api/admin/designs/categories")
    @Cacheable("jewelleryAdminCategories")
    public List<Map<String, Object>> adminCategories() {
        return categoryList(true);
    }

    @GetMapping("/api/admin/designs")
    public Map<String, Object> adminDesigns(
            @RequestParam(required = false) String metal,
            @RequestParam(required = false) String subcategory,
            @RequestParam(required = false, name = "q") String search,
            @RequestParam(defaultValue = "latest") String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size,
            @RequestParam(required = false) String purity,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) BigDecimal minWeight,
            @RequestParam(required = false) BigDecimal maxWeight,
            @RequestParam(defaultValue = "false") boolean featured) {
        return listDesigns(metal, subcategory, search, sort, page, size, true,
                purity, minPrice, maxPrice, minWeight, maxWeight, featured);
    }

    @GetMapping("/api/admin/designs/{id}")
    public Map<String, Object> adminDesignDetails(@PathVariable long id) {
        return designDetails(id, true);
    }

    @PostMapping("/api/admin/designs/categories")
    @CacheEvict(cacheNames = {"jewelleryPublicCategories", "jewelleryAdminCategories"}, allEntries = true)
    @Transactional
    public Map<String, Object> createCategory(@RequestBody Map<String, Object> body) {
        String metal = requiredText(body.get("metalType"), "Choose Gold, Silver or Diamond.", 16).toUpperCase(Locale.ROOT);
        if (!List.of("GOLD", "SILVER", "DIAMOND").contains(metal)) {
            throw new IllegalArgumentException("Only Gold, Silver and Diamond main categories are allowed.");
        }
        String name = requiredText(body.get("subcategoryName"), "Subcategory name is required.", 80);
        String slug = slugify(name);
        int order = nonNegativeInt(body.get("displayOrder"), 0, "Display order");
        Long id = jdbc.queryForObject("""
                INSERT INTO public.jewellery_design_categories
                    (metal_type, subcategory_name, slug, display_order, is_active, created_at)
                VALUES (?, ?, ?, ?, TRUE, NOW())
                RETURNING id
                """, Long.class, metal, name, slug, order);
        return categoryDetails(id);
    }

    @PutMapping("/api/admin/designs/categories/{id}")
    @CacheEvict(cacheNames = {"jewelleryPublicCategories", "jewelleryAdminCategories"}, allEntries = true)
    @Transactional
    public Map<String, Object> updateCategory(@PathVariable long id, @RequestBody Map<String, Object> body) {
        Map<String, Object> existing = categoryDetails(id);
        String name = body.get("subcategoryName") == null
                ? String.valueOf(existing.get("subcategoryName"))
                : requiredText(body.get("subcategoryName"), "Subcategory name is required.", 80);
        String slug = slugify(name);
        boolean active = bool(body.get("isActive"), Boolean.TRUE.equals(existing.get("isActive")));
        int order = nonNegativeInt(body.get("displayOrder"), ((Number) existing.get("displayOrder")).intValue(), "Display order");
        jdbc.update("""
                UPDATE public.jewellery_design_categories
                   SET subcategory_name = ?, slug = ?, is_active = ?, display_order = ?
                 WHERE id = ?
                """, name, slug, active, order, id);
        return categoryDetails(id);
    }

    @PostMapping("/api/admin/designs")
    @CacheEvict(cacheNames = {"jewelleryPublicCategories", "jewelleryAdminCategories"}, allEntries = true)
    @Transactional
    public Map<String, Object> createDesign(@RequestBody Map<String, Object> body) {
        long categoryId = number(body.get("categoryId"), "Choose a subcategory.");
        String name = requiredText(body.get("designName"), "Design name is required.", 160);
        String description = text(body.get("description"), 5000);
        String style = text(body.get("styleLabel"), 80);
        String keywords = text(body.get("keywords"), 800);
        String purity = text(body.get("purity"), 40);
        BigDecimal weightGrams = decimal(body.get("weightGrams"), "Weight");
        BigDecimal priceInr = decimal(body.get("priceInr"), "Price");
        String metal = categoryMetal(categoryId);
        String designId = nextDesignId(categoryId, metal);

        Long next = jdbc.queryForObject(
                "UPDATE public.jewellery_design_code_counters SET last_value = last_value + 1 WHERE metal_type = ? RETURNING last_value",
                Long.class, metal);
        if (next == null) {
            throw new IllegalStateException("Design code counter is not initialized for " + metal + ".");
        }
        String prefix = switch (metal) {
            case "GOLD" -> "NKJ-GOLD-";
            case "SILVER" -> "NKJ-SILVER-";
            default -> "NKJ-DIA-";
        };
        String designCode = prefix + String.format(Locale.ROOT, "%05d", next);

        Long id = jdbc.queryForObject("""
                INSERT INTO public.jewellery_designs
                    (design_code, design_id, category_id, design_name, description, style_label, keywords,
                     purity, weight_grams, price_inr,
                     is_sample, is_featured, is_active, popularity_count, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?, 0, NOW(), NOW())
                RETURNING id
                """, Long.class,
                designCode, designId, categoryId, name, description, style, keywords,
                purity, weightGrams, priceInr,
                bool(body.get("isFeatured"), false), bool(body.get("isActive"), true));
        return designDetails(id, true);
    }

    @PutMapping("/api/admin/designs/{id}")
    @CacheEvict(cacheNames = {"jewelleryPublicCategories", "jewelleryAdminCategories"}, allEntries = true)
    @Transactional
    public Map<String, Object> updateDesign(@PathVariable long id, @RequestBody Map<String, Object> body) {
        ensureDesignExists(id);
        Map<String, Object> existingDesign = jdbc.queryForMap(
                "SELECT d.category_id AS \"categoryId\", c.metal_type AS \"metalType\" FROM public.jewellery_designs d JOIN public.jewellery_design_categories c ON c.id=d.category_id WHERE d.id=?",
                id);
        String existingMetal = String.valueOf(existingDesign.get("metalType"));
        long existingCategoryId = ((Number) existingDesign.get("categoryId")).longValue();

        long categoryId = number(body.get("categoryId"), "Choose a subcategory.");
        if (categoryId != existingCategoryId) {
            throw new IllegalArgumentException("A design's subcategory cannot be changed after its Design ID is generated. Create a new design in the new subcategory instead.");
        }
        String newMetal = categoryMetal(categoryId);
        if (!existingMetal.equals(newMetal)) {
            throw new IllegalArgumentException("A design can be moved between subcategories of the same metal only. Create a new design code to change its metal.");
        }

        jdbc.update("""
                UPDATE public.jewellery_designs
                   SET category_id = ?,
                       design_name = ?,
                       description = ?,
                       style_label = ?,
                       keywords = ?,
                       purity = ?,
                       weight_grams = ?,
                       price_inr = ?,
                       is_featured = ?,
                       is_active = ?,
                       updated_at = NOW()
                 WHERE id = ?
                """,
                categoryId,
                requiredText(body.get("designName"), "Design name is required.", 160),
                text(body.get("description"), 5000),
                text(body.get("styleLabel"), 80),
                text(body.get("keywords"), 800),
                text(body.get("purity"), 40),
                decimal(body.get("weightGrams"), "Weight"),
                decimal(body.get("priceInr"), "Price"),
                bool(body.get("isFeatured"), false),
                bool(body.get("isActive"), true),
                id);
        return designDetails(id, true);
    }

    @DeleteMapping("/api/admin/designs/{id}")
    @CacheEvict(cacheNames = {"jewelleryPublicCategories", "jewelleryAdminCategories"}, allEntries = true)
    @Transactional
    public Map<String, Object> deleteDesign(@PathVariable long id) {
        List<String> storedUrls = jdbc.query(
                """
                SELECT original_url FROM public.jewellery_design_images WHERE design_id=?
                UNION ALL
                SELECT thumbnail_url FROM public.jewellery_design_images WHERE design_id=?
                """,
                (rs, rowNum) -> rs.getString(1), id, id);
        int deleted = jdbc.update("DELETE FROM public.jewellery_designs WHERE id=?", id);
        if (deleted == 0) {
            throw new IllegalArgumentException("Design not found.");
        }
        storedUrls.forEach(imageStorage::deleteStoredPath);
        return Map.of("deleted", true, "id", id);
    }

    @PostMapping(value = "/api/admin/designs/{id}/images", consumes = "multipart/form-data")
    @CacheEvict(cacheNames = {"jewelleryPublicCategories", "jewelleryAdminCategories"}, allEntries = true)
    @Transactional
    public Map<String, Object> uploadImages(
            @PathVariable long id,
            @RequestParam("files") List<MultipartFile> files) throws IOException {
        ensureDesignExists(id);
        if (files == null || files.isEmpty()) {
            throw new IllegalArgumentException("Choose at least one image.");
        }
        if (files.size() > 20) {
            throw new IllegalArgumentException("Upload at most 20 images per batch.");
        }

        List<String> createdFiles = new ArrayList<>();
        try {
            // Once the owner uploads a real shop photograph, remove any bundled
            // sample inspiration image so the verified shop photo becomes primary.
            jdbc.update(
                    "DELETE FROM public.jewellery_design_images WHERE design_id=? AND original_url LIKE '/nkj-design-samples/%'",
                    id);
            int nextOrder = jdbc.queryForObject(
                    "SELECT COALESCE(MAX(display_order), -1) + 1 FROM public.jewellery_design_images WHERE design_id=?",
                    Integer.class, id);
            for (MultipartFile file : files) {
                StoredImage stored = imageStorage.store(id, file);
                createdFiles.add(stored.originalUrl());
                createdFiles.add(stored.thumbnailUrl());
                jdbc.update("""
                        INSERT INTO public.jewellery_design_images
                            (design_id, original_url, thumbnail_url, alt_text, content_sha256, display_order, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, NOW())
                        """, id, stored.originalUrl(), stored.thumbnailUrl(), stored.fileName(), stored.sha256(), nextOrder++);
            }
            jdbc.update("""
                    UPDATE public.jewellery_designs
                       SET is_sample = FALSE, updated_at = NOW()
                     WHERE id = ?
                    """, id);
        } catch (RuntimeException | IOException error) {
            createdFiles.forEach(imageStorage::deleteStoredPath);
            throw error;
        }
        return designDetails(id, true);
    }

    @PutMapping("/api/admin/designs/{id}/images/{imageId}/primary")
    @CacheEvict(cacheNames = {"jewelleryPublicCategories", "jewelleryAdminCategories"}, allEntries = true)
    @Transactional
    public Map<String, Object> setPrimaryImage(@PathVariable long id, @PathVariable long imageId) {
        ensureDesignExists(id);
        Integer found = jdbc.queryForObject(
                "SELECT COUNT(*) FROM public.jewellery_design_images WHERE id=? AND design_id=?",
                Integer.class, imageId, id);
        if (found == null || found == 0) throw new IllegalArgumentException("Design image not found.");
        jdbc.update("UPDATE public.jewellery_design_images SET display_order = display_order + 1 WHERE design_id=? AND id<>?", id, imageId);
        jdbc.update("UPDATE public.jewellery_design_images SET display_order=0 WHERE id=? AND design_id=?", imageId, id);
        return designDetails(id, true);
    }

    @DeleteMapping("/api/admin/designs/{id}/images/{imageId}")
    @CacheEvict(cacheNames = {"jewelleryPublicCategories", "jewelleryAdminCategories"}, allEntries = true)
    @Transactional
    public Map<String, Object> deleteImage(@PathVariable long id, @PathVariable long imageId) {
        List<List<String>> urls = jdbc.query(
                "SELECT original_url, thumbnail_url FROM public.jewellery_design_images WHERE id=? AND design_id=?",
                (rs, rowNum) -> List.of(rs.getString(1), rs.getString(2)), imageId, id);
        if (urls.isEmpty()) {
            throw new IllegalArgumentException("Design image not found.");
        }
        jdbc.update("DELETE FROM public.jewellery_design_images WHERE id=? AND design_id=?", imageId, id);
        urls.get(0).forEach(imageStorage::deleteStoredPath);
        List<Long> remainingImageIds = jdbc.query(
                "SELECT id FROM public.jewellery_design_images WHERE design_id=? ORDER BY display_order, id",
                (rs, rowNum) -> rs.getLong(1), id);
        for (int index = 0; index < remainingImageIds.size(); index++) {
            jdbc.update("UPDATE public.jewellery_design_images SET display_order=? WHERE id=? AND design_id=?",
                    index, remainingImageIds.get(index), id);
        }
        if (remainingImageIds.isEmpty()) {
            jdbc.update("UPDATE public.jewellery_designs SET is_sample=TRUE, updated_at=NOW() WHERE id=?", id);
        }
        return designDetails(id, true);
    }

    private List<Map<String, Object>> categoryList(boolean includeInactive) {
        String sql = """
                SELECT c.id, c.metal_type AS "metalType",
                       c.subcategory_name AS "subcategoryName", c.slug,
                       c.display_order AS "displayOrder", c.is_active AS "isActive",
                       COUNT(d.id) FILTER (WHERE d.is_active = TRUE AND (? = TRUE OR EXISTS (SELECT 1 FROM public.jewellery_design_images visible_image WHERE visible_image.design_id = d.id))) AS "activeDesignCount",
                       COUNT(d.id) AS "totalDesignCount"
                  FROM public.jewellery_design_categories c
                  LEFT JOIN public.jewellery_designs d ON d.category_id = c.id
                 WHERE (? = TRUE OR c.is_active = TRUE)
                 GROUP BY c.id
                 ORDER BY CASE c.metal_type WHEN 'GOLD' THEN 1 WHEN 'SILVER' THEN 2 ELSE 3 END,
                          c.display_order, c.subcategory_name
                """;
        return jdbc.queryForList(sql, includeInactive, includeInactive);
    }

    private Map<String, Object> listDesigns(
            String metal, String subcategory, String search, String sort,
            int requestedPage, int requestedSize, boolean includeInactive,
            String purity, BigDecimal minPrice, BigDecimal maxPrice,
            BigDecimal minWeight, BigDecimal maxWeight, boolean featuredOnly) {
        int page = Math.max(0, requestedPage);
        int size = Math.max(1, Math.min(requestedSize, 60));
        if (minPrice != null && maxPrice != null && minPrice.compareTo(maxPrice) > 0) {
            throw new IllegalArgumentException("Minimum price cannot exceed maximum price.");
        }
        if (minWeight != null && maxWeight != null && minWeight.compareTo(maxWeight) > 0) {
            throw new IllegalArgumentException("Minimum weight cannot exceed maximum weight.");
        }
        StringBuilder filter = new StringBuilder(" WHERE (? = TRUE OR d.is_active = TRUE)");
        List<Object> parameters = new ArrayList<>();
        parameters.add(includeInactive);

        if (metal != null && !metal.isBlank()) {
            filter.append(" AND c.metal_type = ?");
            parameters.add(metal.trim().toUpperCase(Locale.ROOT));
        }
        if (subcategory != null && !subcategory.isBlank()) {
            filter.append(" AND c.slug = ?");
            parameters.add(subcategory.trim().toLowerCase(Locale.ROOT));
        }
        if (search != null && !search.isBlank()) {
            filter.append(" AND (d.design_id ILIKE ? OR d.design_code ILIKE ? OR to_tsvector('simple', d.design_name || ' ' || d.keywords || ' ' || d.style_label) @@ plainto_tsquery('simple', ?))");
            String q = "%" + search.trim() + "%";
            parameters.add(q);
            parameters.add(q);
            parameters.add(search.trim());
        }
        if (purity != null && !purity.isBlank()) {
            filter.append(" AND LOWER(d.purity) = LOWER(?)");
            parameters.add(purity.trim());
        }
        if (minPrice != null) { filter.append(" AND d.price_inr >= ?"); parameters.add(minPrice); }
        if (maxPrice != null) { filter.append(" AND d.price_inr <= ?"); parameters.add(maxPrice); }
        if (minWeight != null) { filter.append(" AND d.weight_grams >= ?"); parameters.add(minWeight); }
        if (maxWeight != null) { filter.append(" AND d.weight_grams <= ?"); parameters.add(maxWeight); }
        if (featuredOnly) filter.append(" AND d.is_featured = TRUE");
        if (!includeInactive) {
            filter.append(" AND EXISTS (SELECT 1 FROM public.jewellery_design_images visible_image WHERE visible_image.design_id = d.id)");
        }

        String categoryJoin = " FROM public.jewellery_designs d JOIN public.jewellery_design_categories c ON c.id = d.category_id\n";
        Long total = jdbc.queryForObject("SELECT COUNT(*) " + categoryJoin + filter, Long.class, parameters.toArray());
        String orderBy = switch (sort == null ? "latest" : sort.toLowerCase(Locale.ROOT)) {
            case "popular" -> "d.popularity_count DESC, d.created_at DESC, d.id DESC";
            case "oldest" -> "d.created_at ASC, d.id ASC";
            case "name" -> "LOWER(d.design_name) ASC, d.id ASC";
            default -> "d.created_at DESC, d.id DESC";
        };
        String sql = """
                SELECT d.id, d.design_id AS "designId", d.design_code AS "designCode", d.design_name AS "designName",
                       d.description, d.style_label AS "styleLabel", d.keywords,
                       d.is_sample AS "isSample", d.is_featured AS "isFeatured",
                       d.is_active AS "isActive", d.popularity_count AS "popularityCount",
                       d.purity, d.weight_grams AS "weightGrams", d.price_inr AS "priceInr",
                       d.created_at AS "createdAt", d.updated_at AS "updatedAt",
                       c.metal_type AS "metalType", c.subcategory_name AS "subcategoryName",
                       c.slug AS "subcategorySlug",
                       img.thumbnail_url AS "thumbnailUrl", img.original_url AS "originalUrl",
                       COALESCE(img.image_count, 0) AS "imageCount"
                """ + categoryJoin + """
                LEFT JOIN LATERAL (
                    SELECT di.thumbnail_url, di.original_url,
                           (SELECT COUNT(*) FROM public.jewellery_design_images all_images WHERE all_images.design_id=d.id) AS image_count
                      FROM public.jewellery_design_images di
                     WHERE di.design_id = d.id
                     ORDER BY di.display_order, di.id
                     LIMIT 1
                ) img ON TRUE
                """ + filter + " ORDER BY " + orderBy + " LIMIT ? OFFSET ?";
        List<Object> dataParameters = new ArrayList<>(parameters);
        dataParameters.add(size);
        dataParameters.add((long) page * size);
        List<Map<String, Object>> items = jdbc.queryForList(sql, dataParameters.toArray());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", items);
        result.put("page", page);
        result.put("size", size);
        result.put("total", total == null ? 0L : total);
        result.put("totalPages", total == null ? 0 : (int) Math.ceil((double) total / size));
        return result;
    }

    private Map<String, Object> categoryDetails(long id) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT c.id, c.metal_type AS "metalType", c.subcategory_name AS "subcategoryName",
                       c.slug, c.display_order AS "displayOrder", c.is_active AS "isActive",
                       COUNT(d.id) FILTER (WHERE d.is_active = TRUE) AS "activeDesignCount",
                       COUNT(d.id) AS "totalDesignCount"
                  FROM public.jewellery_design_categories c
                  LEFT JOIN public.jewellery_designs d ON d.category_id = c.id
                 WHERE c.id = ?
                 GROUP BY c.id
                """, id);
        if (rows.isEmpty()) throw new IllegalArgumentException("Jewellery subcategory not found.");
        return rows.get(0);
    }

    private Map<String, Object> designDetails(long id, boolean includeInactive) {
        List<Map<String, Object>> results = jdbc.queryForList("""
                SELECT d.id, d.design_id AS "designId", d.design_code AS "designCode", d.design_name AS "designName",
                       d.description, d.style_label AS "styleLabel", d.keywords,
                       d.is_sample AS "isSample", d.is_featured AS "isFeatured",
                       d.is_active AS "isActive", d.popularity_count AS "popularityCount",
                       d.purity, d.weight_grams AS "weightGrams", d.price_inr AS "priceInr",
                       d.created_at AS "createdAt", d.updated_at AS "updatedAt",
                       c.id AS "categoryId", c.metal_type AS "metalType",
                       c.subcategory_name AS "subcategoryName", c.slug AS "subcategorySlug"
                  FROM public.jewellery_designs d
                  JOIN public.jewellery_design_categories c ON c.id=d.category_id
                 WHERE d.id=? AND (? = TRUE OR (d.is_active=TRUE AND EXISTS (SELECT 1 FROM public.jewellery_design_images visible_image WHERE visible_image.design_id=d.id)))
                """, id, includeInactive);
        if (results.isEmpty()) {
            throw new IllegalArgumentException("Jewellery design not found.");
        }
        Map<String, Object> result = new LinkedHashMap<>(results.get(0));
        result.put("images", jdbc.queryForList("""
                SELECT id, original_url AS "originalUrl", thumbnail_url AS "thumbnailUrl",
                       alt_text AS "altText", display_order AS "displayOrder"
                  FROM public.jewellery_design_images
                 WHERE design_id=?
                 ORDER BY display_order, id
                """, id));
        return result;
    }

    private String nextDesignId(long categoryId, String metal) {
        String categoryName = jdbc.queryForObject(
                "SELECT subcategory_name FROM public.jewellery_design_categories WHERE id=? AND is_active=TRUE",
                String.class, categoryId);
        if (categoryName == null) throw new IllegalArgumentException("The selected jewellery subcategory is unavailable.");
        String categoryKey = categoryIdentifier(categoryName);
        Long sequence = jdbc.queryForObject("""
                INSERT INTO public.jewellery_design_id_counters(metal_type, category_key, last_value)
                VALUES (?, ?, 1)
                ON CONFLICT (metal_type, category_key)
                DO UPDATE SET last_value = public.jewellery_design_id_counters.last_value + 1
                RETURNING last_value
                """, Long.class, metal, categoryKey);
        if (sequence == null) throw new IllegalStateException("Could not allocate a unique jewellery Design ID.");
        return "NKJ_" + metal + "_" + categoryKey + "_" + String.format(Locale.ROOT, "%04d", sequence);
    }

    private static String categoryIdentifier(String categoryName) {
        String key = categoryName.toUpperCase(Locale.ROOT)
                .replace("'", "")
                .replaceAll("[^A-Z0-9]+", "_")
                .replaceAll("^_+|_+$", "");
        return key.isBlank() ? "DESIGN" : key;
    }

    private void ensureDesignExists(long id) {
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM public.jewellery_designs WHERE id=?", Integer.class, id);
        if (count == null || count == 0) {
            throw new IllegalArgumentException("Jewellery design not found.");
        }
    }

    private String categoryMetal(long categoryId) {
        List<String> values = jdbc.query(
                "SELECT metal_type FROM public.jewellery_design_categories WHERE id=? AND is_active=TRUE",
                (rs, rowNum) -> rs.getString(1), categoryId);
        if (values.isEmpty()) {
            throw new IllegalArgumentException("The selected jewellery subcategory is unavailable.");
        }
        return values.get(0);
    }

    private static long number(Object value, String errorMessage) {
        try {
            long result = Long.parseLong(String.valueOf(value));
            if (result <= 0) throw new NumberFormatException();
            return result;
        } catch (Exception error) {
            throw new IllegalArgumentException(errorMessage);
        }
    }

    private static String requiredText(Object value, String errorMessage, int maxLength) {
        String text = text(value, maxLength);
        if (text.isBlank()) throw new IllegalArgumentException(errorMessage);
        return text;
    }

    private static String text(Object value, int maxLength) {
        String result = value == null ? "" : String.valueOf(value).trim();
        if (result.length() > maxLength) throw new IllegalArgumentException("Text must be " + maxLength + " characters or fewer.");
        return result;
    }

    private static boolean bool(Object value, boolean fallback) {
        return value == null ? fallback : Boolean.parseBoolean(String.valueOf(value));
    }

    private static int nonNegativeInt(Object value, int fallback, String label) {
        if (value == null || String.valueOf(value).isBlank()) return fallback;
        try {
            int parsed = Integer.parseInt(String.valueOf(value).trim());
            if (parsed < 0) throw new NumberFormatException();
            return parsed;
        } catch (NumberFormatException error) {
            throw new IllegalArgumentException(label + " must be zero or a positive whole number.");
        }
    }

    private static String slugify(String value) {
        String slug = value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        if (slug.isBlank()) throw new IllegalArgumentException("Subcategory name must contain letters or numbers.");
        return slug;
    }

    private static BigDecimal decimal(Object value, String label) {
        if (value == null || String.valueOf(value).isBlank()) return null;
        try {
            BigDecimal parsed = new BigDecimal(String.valueOf(value).trim());
            if (parsed.signum() < 0) throw new IllegalArgumentException(label + " cannot be negative.");
            return parsed;
        } catch (NumberFormatException error) {
            throw new IllegalArgumentException(label + " must be a valid number.");
        }
    }
}
