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
            @RequestParam(defaultValue = "24") int size) {
        return listDesigns(metal, subcategory, search, sort, page, size, false);
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
            @RequestParam(defaultValue = "30") int size) {
        return listDesigns(metal, subcategory, search, sort, page, size, true);
    }

    @GetMapping("/api/admin/designs/{id}")
    public Map<String, Object> adminDesignDetails(@PathVariable long id) {
        return designDetails(id, true);
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
        String metal = categoryMetal(categoryId);

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
                    (design_code, category_id, design_name, description, style_label, keywords,
                     is_sample, is_featured, is_active, popularity_count, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, TRUE, ?, ?, 0, NOW(), NOW())
                RETURNING id
                """, Long.class,
                designCode, categoryId, name, description, style, keywords,
                bool(body.get("isFeatured"), false), bool(body.get("isActive"), true));
        return designDetails(id, true);
    }

    @PutMapping("/api/admin/designs/{id}")
    @CacheEvict(cacheNames = {"jewelleryPublicCategories", "jewelleryAdminCategories"}, allEntries = true)
    @Transactional
    public Map<String, Object> updateDesign(@PathVariable long id, @RequestBody Map<String, Object> body) {
        String existingMetal = jdbc.queryForObject(
                "SELECT c.metal_type FROM public.jewellery_designs d JOIN public.jewellery_design_categories c ON c.id=d.category_id WHERE d.id=?",
                String.class, id);
        if (existingMetal == null) {
            throw new IllegalArgumentException("Design not found.");
        }

        long categoryId = number(body.get("categoryId"), "Choose a subcategory.");
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
                "SELECT original_url FROM public.jewellery_design_images WHERE design_id=?",
                (rs, rowNum) -> rs.getString(1), id);
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
            int nextOrder = jdbc.queryForObject(
                    "SELECT COALESCE(MAX(display_order), -1) + 1 FROM public.jewellery_design_images WHERE design_id=?",
                    Integer.class, id);
            for (MultipartFile file : files) {
                StoredImage stored = imageStorage.store(id, file);
                createdFiles.add(stored.originalUrl());
                createdFiles.add(stored.thumbnailUrl());
                jdbc.update("""
                        INSERT INTO public.jewellery_design_images
                            (design_id, original_url, thumbnail_url, alt_text, display_order, created_at)
                        VALUES (?, ?, ?, ?, ?, NOW())
                        """, id, stored.originalUrl(), stored.thumbnailUrl(), stored.fileName(), nextOrder++);
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

    @DeleteMapping("/api/admin/designs/{id}/images/{imageId}")
    @CacheEvict(cacheNames = {"jewelleryPublicCategories", "jewelleryAdminCategories"}, allEntries = true)
    @Transactional
    public Map<String, Object> deleteImage(@PathVariable long id, @PathVariable long imageId) {
        List<String> urls = jdbc.query(
                "SELECT original_url, thumbnail_url FROM public.jewellery_design_images WHERE id=? AND design_id=?",
                (rs, rowNum) -> List.of(rs.getString(1), rs.getString(2)), imageId, id);
        if (urls.isEmpty()) {
            throw new IllegalArgumentException("Design image not found.");
        }
        jdbc.update("DELETE FROM public.jewellery_design_images WHERE id=? AND design_id=?", imageId, id);
        urls.get(0).forEach(imageStorage::deleteStoredPath);
        Integer remaining = jdbc.queryForObject(
                "SELECT COUNT(*) FROM public.jewellery_design_images WHERE design_id=?", Integer.class, id);
        if (remaining != null && remaining == 0) {
            jdbc.update("UPDATE public.jewellery_designs SET is_sample=TRUE, updated_at=NOW() WHERE id=?", id);
        }
        return designDetails(id, true);
    }

    private List<Map<String, Object>> categoryList(boolean includeInactive) {
        String sql = """
                SELECT c.id, c.metal_type AS "metalType",
                       c.subcategory_name AS "subcategoryName", c.slug,
                       c.display_order AS "displayOrder", c.is_active AS "isActive",
                       COUNT(d.id) FILTER (WHERE d.is_active = TRUE) AS "activeDesignCount",
                       COUNT(d.id) AS "totalDesignCount"
                  FROM public.jewellery_design_categories c
                  LEFT JOIN public.jewellery_designs d ON d.category_id = c.id
                 WHERE (? = TRUE OR c.is_active = TRUE)
                 GROUP BY c.id
                 ORDER BY CASE c.metal_type WHEN 'GOLD' THEN 1 WHEN 'SILVER' THEN 2 ELSE 3 END,
                          c.display_order, c.subcategory_name
                """;
        return jdbc.queryForList(sql, includeInactive);
    }

    private Map<String, Object> listDesigns(
            String metal, String subcategory, String search, String sort,
            int requestedPage, int requestedSize, boolean includeInactive) {
        int page = Math.max(0, requestedPage);
        int size = Math.max(1, Math.min(requestedSize, 60));
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
            filter.append(" AND (d.design_code ILIKE ? OR to_tsvector('simple', d.design_name || ' ' || d.keywords || ' ' || d.style_label) @@ plainto_tsquery('simple', ?))");
            String q = "%" + search.trim() + "%";
            parameters.add(q);
            parameters.add(search.trim());
        }

        String categoryJoin = " FROM public.jewellery_designs d JOIN public.jewellery_design_categories c ON c.id = d.category_id";
        Long total = jdbc.queryForObject("SELECT COUNT(*) " + categoryJoin + filter, Long.class, parameters.toArray());
        String orderBy = "popular".equalsIgnoreCase(sort)
                ? "d.popularity_count DESC, d.created_at DESC, d.id DESC"
                : "d.created_at DESC, d.id DESC";
        String sql = """
                SELECT d.id, d.design_code AS "designCode", d.design_name AS "designName",
                       d.description, d.style_label AS "styleLabel", d.keywords,
                       d.is_sample AS "isSample", d.is_featured AS "isFeatured",
                       d.is_active AS "isActive", d.popularity_count AS "popularityCount",
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

    private Map<String, Object> designDetails(long id, boolean includeInactive) {
        List<Map<String, Object>> results = jdbc.queryForList("""
                SELECT d.id, d.design_code AS "designCode", d.design_name AS "designName",
                       d.description, d.style_label AS "styleLabel", d.keywords,
                       d.is_sample AS "isSample", d.is_featured AS "isFeatured",
                       d.is_active AS "isActive", d.popularity_count AS "popularityCount",
                       d.created_at AS "createdAt", d.updated_at AS "updatedAt",
                       c.id AS "categoryId", c.metal_type AS "metalType",
                       c.subcategory_name AS "subcategoryName", c.slug AS "subcategorySlug"
                  FROM public.jewellery_designs d
                  JOIN public.jewellery_design_categories c ON c.id=d.category_id
                 WHERE d.id=? AND (? = TRUE OR d.is_active=TRUE)
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
}
