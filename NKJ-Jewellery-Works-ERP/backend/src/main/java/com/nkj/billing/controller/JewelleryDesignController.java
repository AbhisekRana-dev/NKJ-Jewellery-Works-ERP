package com.nkj.billing.controller;

import com.nkj.billing.service.JewelleryDesignImageStorageService;
import com.nkj.billing.service.JewelleryDesignImageStorageService.StoredImage;
import com.nkj.billing.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HexFormat;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@RestController
public class JewelleryDesignController {
    private static final SecureRandom QR_TOKEN_RANDOM = new SecureRandom();
    private static final long QR_SESSION_TTL_MILLIS = 5 * 60 * 1000L;

    private final JdbcTemplate jdbc;
    private final JewelleryDesignImageStorageService imageStorage;
    private final AuthService auth;
    private final String mobileUploadBaseUrl;

    public JewelleryDesignController(
            JdbcTemplate jdbc,
            JewelleryDesignImageStorageService imageStorage,
            AuthService auth,
            @Value("${nkj.designs.mobile-upload-base-url:http://localhost:5173}") String mobileUploadBaseUrl) {
        this.jdbc = jdbc;
        this.imageStorage = imageStorage;
        this.auth = auth;
        this.mobileUploadBaseUrl = mobileUploadBaseUrl;
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
            @RequestParam(required = false) String style,
            @RequestParam(required = false) String material,
            @RequestParam(required = false) String region,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) BigDecimal minWeight,
            @RequestParam(required = false) BigDecimal maxWeight,
            @RequestParam(defaultValue = "false") boolean featured) {
        return listDesigns(metal, subcategory, search, sort, page, size, false,
                purity, style, material, region, minPrice, maxPrice, minWeight, maxWeight, featured);
    }

    @GetMapping("/api/designs/filters")
    public Map<String, Object> publicDesignFilters(@RequestParam(required = false) String metal) {
        String normalizedMetal = metal == null || metal.isBlank() ? null : metal.trim().toUpperCase(Locale.ROOT);
        if (normalizedMetal != null && !List.of("GOLD", "SILVER", "DIAMOND").contains(normalizedMetal)) {
            throw new IllegalArgumentException("Choose Gold, Silver or Diamond.");
        }
        String metalClause = normalizedMetal == null ? "" : " AND c.metal_type = ?";
        Object[] args = normalizedMetal == null ? new Object[0] : new Object[]{normalizedMetal};
        String from = " FROM public.jewellery_designs d JOIN public.jewellery_design_categories c ON c.id=d.category_id " +
                "WHERE d.is_deleted=FALSE AND d.is_active=TRUE";
        Map<String, Object> facets = new LinkedHashMap<>();
        facets.put("styles", jdbc.queryForList("SELECT DISTINCT d.style_label" + from +
                " AND BTRIM(d.style_label)<>''" + metalClause + " ORDER BY 1", String.class, args));
        facets.put("materials", jdbc.queryForList("SELECT DISTINCT d.material_label" + from +
                " AND BTRIM(d.material_label)<>''" + metalClause + " ORDER BY 1", String.class, args));
        facets.put("regions", jdbc.queryForList("SELECT DISTINCT d.regional_inspiration" + from +
                " AND BTRIM(d.regional_inspiration)<>''" + metalClause + " ORDER BY 1", String.class, args));
        facets.put("purities", jdbc.queryForList("SELECT DISTINCT d.purity" + from +
                " AND BTRIM(d.purity)<>''" + metalClause + " ORDER BY 1", String.class, args));
        return facets;
    }

    @GetMapping("/api/designs/{id}")
    public Map<String, Object> publicDesignDetails(@PathVariable long id) {
        jdbc.update("UPDATE public.jewellery_designs SET popularity_count = popularity_count + 1 WHERE id = ? AND is_active = TRUE AND is_deleted = FALSE", id);
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
            @RequestParam(required = false) String style,
            @RequestParam(required = false) String material,
            @RequestParam(required = false) String region,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) BigDecimal minWeight,
            @RequestParam(required = false) BigDecimal maxWeight,
            @RequestParam(defaultValue = "false") boolean featured) {
        return listDesigns(metal, subcategory, search, sort, page, size, true,
                purity, style, material, region, minPrice, maxPrice, minWeight, maxWeight, featured);
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

    @PostMapping("/api/admin/design-upload-sessions")
    @Transactional
    public Map<String, Object> createMobileUploadSession(HttpServletRequest request) {
        String owner = auth.getUsername();
        if (owner == null || owner.isBlank()) throw new IllegalStateException("An authenticated owner session is required.");

        // Regeneration invalidates every still-live QR issued by this owner.
        jdbc.update("""
                UPDATE public.jewellery_design_upload_sessions
                   SET revoked_at=NOW()
                 WHERE created_by=? AND consumed_at IS NULL
                   AND revoked_at IS NULL AND expires_at > NOW()
                """, owner);

        byte[] randomBytes = new byte[32];
        QR_TOKEN_RANDOM.nextBytes(randomBytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);
        UUID sessionId = UUID.randomUUID();
        Timestamp expiresAt = new Timestamp(System.currentTimeMillis() + QR_SESSION_TTL_MILLIS);

        jdbc.update("""
                INSERT INTO public.jewellery_design_upload_sessions
                    (session_id, token_hash, created_by, expires_at, created_ip)
                VALUES (?, ?, ?, ?, ?)
                """, sessionId, sha256Hex(token), owner, expiresAt, request.getRemoteAddr());

        // Prefer an explicit deployment URL; otherwise derive the website origin
        // from the authenticated browser request so QR links work on the current host.
        String configuredBase = mobileUploadBaseUrl == null ? "" : mobileUploadBaseUrl.trim();
        String baseCandidate = configuredBase.isBlank() ? request.getHeader("Origin") : configuredBase;
        if (baseCandidate == null || baseCandidate.isBlank()) {
            throw new IllegalStateException("Open the owner catalogue from the public website origin or set DESIGNS_MOBILE_UPLOAD_BASE_URL.");
        }
        URI baseUri;
        try {
            baseUri = URI.create(baseCandidate.trim());
        } catch (IllegalArgumentException error) {
            throw new IllegalStateException("The mobile upload base URL is invalid.");
        }
        String scheme = baseUri.getScheme();
        if (baseUri.getHost() == null || baseUri.getRawUserInfo() != null || baseUri.getFragment() != null
                || !("https".equalsIgnoreCase(scheme)
                || "http".equalsIgnoreCase(scheme) && ("localhost".equalsIgnoreCase(baseUri.getHost())
                || "127.0.0.1".equals(baseUri.getHost())))) {
            throw new IllegalStateException("The mobile upload base URL must be HTTPS (HTTP is allowed only for localhost).");
        }
        String base = baseCandidate.trim().replaceAll("/+$", "");
        return Map.of("sessionId", sessionId.toString(),
                "uploadUrl", base + "/mobile-design-upload/" + token,
                "expiresAt", expiresAt.toInstant().toString(),
                "expiresInSeconds", 300, "status", "WAITING");
    }

    @GetMapping("/api/admin/design-upload-sessions/{sessionId}")
    public Map<String, Object> mobileUploadSessionStatus(@PathVariable UUID sessionId) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT session_id AS "sessionId",
                       CASE
                         WHEN consumed_at IS NOT NULL THEN 'UPLOADED'
                         WHEN revoked_at IS NOT NULL THEN 'REVOKED'
                         WHEN expires_at <= NOW() THEN 'EXPIRED'
                         ELSE 'WAITING'
                       END AS status,
                       expires_at AS "expiresAt",
                       uploaded_design_id AS "designId",
                       created_at AS "createdAt",
                       consumed_at AS "uploadedAt"
                  FROM public.jewellery_design_upload_sessions
                 WHERE session_id=? AND created_by=?
                """, sessionId, auth.getUsername());
        if (rows.isEmpty()) throw new IllegalArgumentException("QR upload session not found.");
        Map<String, Object> result = new LinkedHashMap<>(rows.get(0));
        Object designId = result.get("designId");
        if (designId instanceof Number number) {
            List<Map<String, Object>> design = jdbc.queryForList("""
                    SELECT design_id AS "generatedDesignId", design_name AS "designName"
                      FROM public.jewellery_designs WHERE id=?
                    """, number.longValue());
            if (!design.isEmpty()) result.putAll(design.get(0));
        }
        return result;
    }

    @DeleteMapping("/api/admin/design-upload-sessions/{sessionId}")
    @Transactional
    public Map<String, Object> revokeMobileUploadSession(@PathVariable UUID sessionId) {
        int changed = jdbc.update("""
                UPDATE public.jewellery_design_upload_sessions
                   SET revoked_at=NOW()
                 WHERE session_id=? AND created_by=?
                   AND consumed_at IS NULL AND revoked_at IS NULL
                """, sessionId, auth.getUsername());
        return Map.of("revoked", changed > 0, "sessionId", sessionId.toString());
    }

    @GetMapping("/api/mobile-design-upload/{token}")
    public Map<String, Object> mobileUploadSessionInfo(@PathVariable String token) {
        if (token == null || token.length() < 40 || token.length() > 100
                || !token.matches("[A-Za-z0-9_-]+")) {
            throw new IllegalArgumentException("This QR upload link is invalid.");
        }
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT CASE
                         WHEN consumed_at IS NOT NULL THEN 'UPLOADED'
                         WHEN revoked_at IS NOT NULL THEN 'REVOKED'
                         WHEN expires_at <= NOW() THEN 'EXPIRED'
                         ELSE 'WAITING'
                       END AS status,
                       expires_at AS "expiresAt",
                       GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (expires_at - NOW()))))::BIGINT AS "secondsRemaining"
                  FROM public.jewellery_design_upload_sessions
                 WHERE token_hash=?
                """, sha256Hex(token));
        if (rows.isEmpty()) throw new IllegalArgumentException("This QR upload link is invalid.");
        return rows.get(0);
    }

    @PostMapping(value = "/api/mobile-design-upload/{token}/design", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @CacheEvict(cacheNames = {"jewelleryPublicCategories", "jewelleryAdminCategories"}, allEntries = true)
    @Transactional
    public Map<String, Object> uploadDesignFromMobileQr(
            @PathVariable String token,
            @RequestParam("categoryId") String categoryId,
            @RequestParam("designName") String designName,
            @RequestParam(value = "description", required = false) String description,
            @RequestParam(value = "styleLabel", required = false) String styleLabel,
            @RequestParam(value = "keywords", required = false) String keywords,
            @RequestParam(value = "purity", required = false) String purity,
            @RequestParam(value = "weightGrams", required = false) String weightGrams,
            @RequestParam(value = "isActive", defaultValue = "true") boolean isActive,
            @RequestParam(value = "isFeatured", defaultValue = "false") boolean isFeatured,
            @RequestParam(value = "rotations", required = false) List<Integer> rotations,
            @RequestParam(value = "cropZooms", required = false) List<Double> cropZooms,
            @RequestParam("files") List<MultipartFile> files,
            HttpServletRequest request) throws IOException {
        if (token == null || token.length() < 40 || token.length() > 100
                || !token.matches("[A-Za-z0-9_-]+")) {
            throw new IllegalArgumentException("This QR upload link is invalid. Ask the owner to generate a new QR code.");
        }

        List<Map<String, Object>> sessions = jdbc.queryForList("""
                SELECT session_id, created_by,
                       (expires_at > NOW()) AS "notExpired",
                       (consumed_at IS NOT NULL) AS consumed,
                       (revoked_at IS NOT NULL) AS revoked
                  FROM public.jewellery_design_upload_sessions
                 WHERE token_hash=?
                 FOR UPDATE
                """, sha256Hex(token));
        if (sessions.isEmpty()) throw new IllegalArgumentException("This QR upload link is invalid or has expired.");
        Map<String, Object> session = sessions.get(0);
        if (Boolean.TRUE.equals(session.get("revoked"))) {
            throw new IllegalArgumentException("This QR upload link was revoked. Ask the owner to generate a new QR code.");
        }
        if (Boolean.TRUE.equals(session.get("consumed"))) {
            throw new IllegalArgumentException("This QR upload link has already been used. Ask the owner to generate a new QR code.");
        }
        if (!Boolean.TRUE.equals(session.get("notExpired"))) {
            throw new IllegalArgumentException("This QR upload link has expired. Ask the owner to generate a new QR code.");
        }
        if (files == null || files.isEmpty() || files.size() > 20) {
            throw new IllegalArgumentException("Select between 1 and 20 jewellery photographs.");
        }

        Map<String, Object> body = new HashMap<>();
        body.put("categoryId", categoryId);
        body.put("designName", designName);
        body.put("description", description == null ? "" : description);
        body.put("styleLabel", styleLabel == null ? "Shop photograph" : styleLabel);
        body.put("keywords", keywords == null ? "" : keywords);
        body.put("purity", purity == null ? "" : purity);
        body.put("weightGrams", weightGrams == null ? "" : weightGrams);
        body.put("isActive", isActive);
        body.put("isFeatured", isFeatured);

        // Use the same backend-generated ID and image-storage methods as desktop.
        // The locked session row guarantees only one mobile design submission.
        Map<String, Object> saved = createDesign(body);
        long designPk = ((Number) saved.get("id")).longValue();
        Map<String, Object> withImages = storeDesignImages(designPk, files, rotations, cropZooms);

        jdbc.update("""
                UPDATE public.jewellery_design_upload_sessions
                   SET consumed_at=NOW(), uploaded_design_id=?, uploaded_ip=?
                 WHERE session_id=? AND consumed_at IS NULL AND revoked_at IS NULL
                """, designPk, request.getRemoteAddr(), session.get("session_id"));

        Map<String, Object> response = new LinkedHashMap<>(withImages);
        response.put("uploadStatus", "UPLOADED");
        return response;
    }

    private static String sha256Hex(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException("SHA-256 is not available.", error);
        }
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
        String regional = text(body.get("regionalInspiration"), 80);
        String material = text(body.get("materialLabel"), 120);
        BigDecimal weightGrams = decimal(body.get("weightGrams"), "Weight");
        BigDecimal priceInr = decimal(body.get("priceInr"), "Price");
        String metal = categoryMetal(categoryId);
        ensureUniqueDesignName(categoryId, name, null);
        if (material.isBlank()) material = defaultMaterialLabel(metal);
        if (regional.isBlank()) regional = "Pan-Indian";
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
                     purity, regional_inspiration, material_label, weight_grams, price_inr,
                     is_sample, is_featured, is_active, popularity_count, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?, 0, NOW(), NOW())
                RETURNING id
                """, Long.class,
                designCode, designId, categoryId, name, description, style, keywords,
                purity, regional, material, weightGrams, priceInr,
                bool(body.get("isFeatured"), false), bool(body.get("isActive"), true));
        return designDetails(id, true);
    }

    @PutMapping("/api/admin/designs/{id}")
    @CacheEvict(cacheNames = {"jewelleryPublicCategories", "jewelleryAdminCategories"}, allEntries = true)
    @Transactional
    public Map<String, Object> updateDesign(@PathVariable long id, @RequestBody Map<String, Object> body) {
        ensureDesignExists(id);
        Map<String, Object> existingDesign = jdbc.queryForMap(
                "SELECT d.category_id AS \"categoryId\", c.metal_type AS \"metalType\", d.regional_inspiration AS \"regionalInspiration\", d.material_label AS \"materialLabel\" FROM public.jewellery_designs d JOIN public.jewellery_design_categories c ON c.id=d.category_id WHERE d.id=?",
                id);
        String existingMetal = String.valueOf(existingDesign.get("metalType"));
        long existingCategoryId = ((Number) existingDesign.get("categoryId")).longValue();
        String regionalValue = body.get("regionalInspiration") == null
                ? String.valueOf(existingDesign.getOrDefault("regionalInspiration", "Pan-Indian"))
                : text(body.get("regionalInspiration"), 80);
        String materialValue = body.get("materialLabel") == null
                ? String.valueOf(existingDesign.getOrDefault("materialLabel", defaultMaterialLabel(existingMetal)))
                : text(body.get("materialLabel"), 120);

        long categoryId = number(body.get("categoryId"), "Choose a subcategory.");
        String updatedName = requiredText(body.get("designName"), "Design name is required.", 160);
        ensureUniqueDesignName(categoryId, updatedName, id);
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
                       regional_inspiration = ?,
                       material_label = ?,
                       weight_grams = ?,
                       price_inr = ?,
                       is_featured = ?,
                       is_active = ?,
                       updated_at = NOW()
                 WHERE id = ?
                """,
                categoryId,
                updatedName,
                text(body.get("description"), 5000),
                text(body.get("styleLabel"), 80),
                text(body.get("keywords"), 800),
                text(body.get("purity"), 40),
                regionalValue,
                materialValue,
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
    public Map<String, Object> deleteDesign(@PathVariable long id, HttpServletRequest request) {
        Map<String, Object> before = jdbc.queryForMap("""
                SELECT design_id, design_name, is_active, is_featured
                  FROM public.jewellery_designs
                 WHERE id=? AND is_deleted=FALSE
                 FOR UPDATE
                """, id);
        int changed = jdbc.update("""
                UPDATE public.jewellery_designs
                   SET is_deleted=TRUE, deleted_at=NOW(), deleted_by=?,
                       is_active=FALSE, is_featured=FALSE, updated_at=NOW()
                 WHERE id=? AND is_deleted=FALSE
                """, auth.getUsername(), id);
        if (changed == 0) throw new IllegalArgumentException("Design not found or already archived.");

        jdbc.update("""
                INSERT INTO public.audit_logs(
                    actor_identity, action, module, record_id,
                    previous_value, new_value, ip_address
                )
                VALUES (?, 'DESIGN_ARCHIVED', 'JEWELLERY_DESIGNS', ?,
                        jsonb_build_object('designId', ?, 'designName', ?, 'isActive', ?, 'isFeatured', ?),
                        jsonb_build_object('isDeleted', TRUE, 'isActive', FALSE), ?)
                """,
                auth.getUsername(), String.valueOf(id), before.get("design_id"),
                before.get("design_name"), before.get("is_active"), before.get("is_featured"),
                request.getRemoteAddr());

        // Retain photo objects and history. Sequence rows are deliberately untouched.
        return Map.of("deleted", true, "archived", true, "id", id,
                "designId", String.valueOf(before.get("design_id")),
                "designName", String.valueOf(before.get("design_name")));
    }

    @PostMapping(value = "/api/admin/designs/{id}/images", consumes = "multipart/form-data")
    @CacheEvict(cacheNames = {"jewelleryPublicCategories", "jewelleryAdminCategories"}, allEntries = true)
    @Transactional
    public Map<String, Object> uploadImages(
            @PathVariable long id,
            @RequestParam("files") List<MultipartFile> files) throws IOException {
        return storeDesignImages(id, files, null, null);
    }

    private Map<String, Object> storeDesignImages(
            long id,
            List<MultipartFile> files,
            List<Integer> rotations,
            List<Double> cropZooms) throws IOException {
        ensureDesignExists(id);
        if (files == null || files.isEmpty()) {
            throw new IllegalArgumentException("Choose at least one image.");
        }
        if (files.size() > 20) {
            throw new IllegalArgumentException("Upload at most 20 images per batch.");
        }
        if (rotations != null && !rotations.isEmpty() && rotations.size() != files.size()) {
            throw new IllegalArgumentException("Image rotation settings do not match the selected photographs.");
        }
        if (cropZooms != null && !cropZooms.isEmpty() && cropZooms.size() != files.size()) {
            throw new IllegalArgumentException("Image crop settings do not match the selected photographs.");
        }

        List<String> createdFiles = new ArrayList<>();
        try {
            jdbc.update(
                    "DELETE FROM public.jewellery_design_images WHERE design_id=? AND original_url LIKE '/nkj-design-samples/%'",
                    id);
            int nextOrder = jdbc.queryForObject(
                    "SELECT COALESCE(MAX(display_order), -1) + 1 FROM public.jewellery_design_images WHERE design_id=?",
                    Integer.class, id);
            for (int index = 0; index < files.size(); index++) {
                int rotation = rotations == null || rotations.isEmpty() ? 0 : rotations.get(index);
                double cropZoom = cropZooms == null || cropZooms.isEmpty() ? 1.0d : cropZooms.get(index);
                StoredImage stored = imageStorage.store(id, files.get(index), rotation, cropZoom);
                List<Long> existingImageOwners = jdbc.queryForList(
                        "SELECT design_id FROM public.jewellery_design_images WHERE content_sha256=? LIMIT 1",
                        Long.class, stored.sha256());
                if (!existingImageOwners.isEmpty()) {
                    imageStorage.deleteStoredPath(stored.originalUrl());
                    imageStorage.deleteStoredPath(stored.displayUrl());
                    imageStorage.deleteStoredPath(stored.thumbnailUrl());
                    if (existingImageOwners.get(0).longValue() == id) {
                        continue; // Safe retry after a partial multi-batch desktop upload.
                    }
                    throw new IllegalArgumentException("This photograph is already attached to another jewellery design.");
                }
                createdFiles.add(stored.originalUrl());
                createdFiles.add(stored.displayUrl());
                createdFiles.add(stored.thumbnailUrl());
                jdbc.update("""
                        INSERT INTO public.jewellery_design_images
                            (design_id, original_url, display_url, thumbnail_url, alt_text, content_sha256, display_order, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
                        """, id, stored.originalUrl(), stored.displayUrl(), stored.thumbnailUrl(),
                        stored.fileName(), stored.sha256(), nextOrder++);
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
                "SELECT original_url, display_url, thumbnail_url FROM public.jewellery_design_images WHERE id=? AND design_id=?",
                (rs, rowNum) -> List.of(rs.getString(1), rs.getString(2), rs.getString(3)), imageId, id);
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
                       COUNT(d.id) FILTER (WHERE d.is_active = TRUE) AS "activeDesignCount",
                       COUNT(d.id) AS "totalDesignCount"
                  FROM public.jewellery_design_categories c
                  LEFT JOIN public.jewellery_designs d ON d.category_id = c.id AND d.is_deleted = FALSE
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
            String purity, String style, String material, String region,
            BigDecimal minPrice, BigDecimal maxPrice,
            BigDecimal minWeight, BigDecimal maxWeight, boolean featuredOnly) {
        int page = Math.max(0, requestedPage);
        int size = Math.max(1, Math.min(requestedSize, 60));
        if (minPrice != null && maxPrice != null && minPrice.compareTo(maxPrice) > 0) {
            throw new IllegalArgumentException("Minimum price cannot exceed maximum price.");
        }
        if (minWeight != null && maxWeight != null && minWeight.compareTo(maxWeight) > 0) {
            throw new IllegalArgumentException("Minimum weight cannot exceed maximum weight.");
        }
        StringBuilder filter = new StringBuilder(" WHERE d.is_deleted = FALSE AND (? = TRUE OR d.is_active = TRUE)");
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
            filter.append(" AND (d.design_id ILIKE ? OR d.design_code ILIKE ? OR to_tsvector('simple', d.design_name || ' ' || d.keywords || ' ' || d.style_label || ' ' || d.regional_inspiration || ' ' || d.material_label) @@ plainto_tsquery('simple', ?))");
            String q = "%" + search.trim() + "%";
            parameters.add(q);
            parameters.add(q);
            parameters.add(search.trim());
        }
        if (purity != null && !purity.isBlank()) {
            filter.append(" AND LOWER(d.purity) = LOWER(?)");
            parameters.add(purity.trim());
        }
        if (style != null && !style.isBlank()) {
            filter.append(" AND LOWER(d.style_label) = LOWER(?)");
            parameters.add(style.trim());
        }
        if (material != null && !material.isBlank()) {
            filter.append(" AND LOWER(d.material_label) = LOWER(?)");
            parameters.add(material.trim());
        }
        if (region != null && !region.isBlank()) {
            filter.append(" AND LOWER(d.regional_inspiration) = LOWER(?)");
            parameters.add(region.trim());
        }
        if (minPrice != null) { filter.append(" AND d.price_inr >= ?"); parameters.add(minPrice); }
        if (maxPrice != null) { filter.append(" AND d.price_inr <= ?"); parameters.add(maxPrice); }
        if (minWeight != null) { filter.append(" AND d.weight_grams >= ?"); parameters.add(minWeight); }
        if (maxWeight != null) { filter.append(" AND d.weight_grams <= ?"); parameters.add(maxWeight); }
        if (featuredOnly) filter.append(" AND d.is_featured = TRUE");
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
                       d.purity, d.regional_inspiration AS "regionalInspiration",
                       d.material_label AS "materialLabel", d.image_status AS "imageStatus",
                       d.weight_grams AS "weightGrams", d.price_inr AS "priceInr",
                       d.created_at AS "createdAt", d.updated_at AS "updatedAt",
                       c.metal_type AS "metalType", c.subcategory_name AS "subcategoryName",
                       c.subcategory_name AS "jewelleryType", c.slug AS "subcategorySlug",
                       img.thumbnail_url AS "thumbnailUrl", img.original_url AS "originalUrl",
                       COALESCE(img.image_count, 0) AS "imageCount"
                """ + categoryJoin + """
                LEFT JOIN LATERAL (
                    SELECT COALESCE(NULLIF(BTRIM(di.thumbnail_url), ''), NULLIF(BTRIM(di.original_url), '')) AS thumbnail_url,
                           COALESCE(NULLIF(BTRIM(di.original_url), ''), NULLIF(BTRIM(di.thumbnail_url), '')) AS original_url,
                           (SELECT COUNT(*) FROM public.jewellery_design_images all_images
                             WHERE all_images.design_id=d.id
                               AND COALESCE(NULLIF(BTRIM(all_images.thumbnail_url), ''), NULLIF(BTRIM(all_images.original_url), '')) IS NOT NULL) AS image_count
                      FROM public.jewellery_design_images di
                     WHERE di.design_id = d.id
                       AND COALESCE(NULLIF(BTRIM(di.thumbnail_url), ''), NULLIF(BTRIM(di.original_url), '')) IS NOT NULL
                     ORDER BY di.display_order, di.id
                     LIMIT 1
                ) img ON TRUE
                """ + filter + " ORDER BY " + orderBy + " LIMIT ? OFFSET ?";
        List<Object> dataParameters = new ArrayList<>(parameters);
        dataParameters.add(size);
        dataParameters.add((long) page * size);
        List<Map<String, Object>> items = jdbc.queryForList(sql, dataParameters.toArray());
        if (!includeInactive) items.forEach(item -> item.remove("priceInr"));

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
                  LEFT JOIN public.jewellery_designs d ON d.category_id = c.id AND d.is_deleted = FALSE
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
                       d.purity, d.regional_inspiration AS "regionalInspiration",
                       d.material_label AS "materialLabel", d.image_status AS "imageStatus",
                       d.weight_grams AS "weightGrams", d.price_inr AS "priceInr",
                       d.created_at AS "createdAt", d.updated_at AS "updatedAt",
                       c.id AS "categoryId", c.metal_type AS "metalType",
                       c.subcategory_name AS "subcategoryName", c.subcategory_name AS "jewelleryType", c.slug AS "subcategorySlug"
                  FROM public.jewellery_designs d
                  JOIN public.jewellery_design_categories c ON c.id=d.category_id
                 WHERE d.id=? AND d.is_deleted=FALSE AND (? = TRUE OR d.is_active=TRUE)
                """, id, includeInactive);
        if (results.isEmpty()) {
            throw new IllegalArgumentException("Jewellery design not found.");
        }
        Map<String, Object> result = new LinkedHashMap<>(results.get(0));
        if (!includeInactive) result.remove("priceInr");
        result.put("images", jdbc.queryForList("""
                SELECT id,
                       COALESCE(NULLIF(BTRIM(original_url), ''), NULLIF(BTRIM(thumbnail_url), '')) AS "originalUrl",
                       COALESCE(NULLIF(BTRIM(thumbnail_url), ''), NULLIF(BTRIM(original_url), '')) AS "thumbnailUrl",
                       display_url AS "displayUrl",
                       alt_text AS "altText", display_order AS "displayOrder"
                  FROM public.jewellery_design_images
                 WHERE design_id=?
                   AND COALESCE(NULLIF(BTRIM(thumbnail_url), ''), NULLIF(BTRIM(original_url), '')) IS NOT NULL
                 ORDER BY display_order, id
                """, id));
        return result;
    }

    private void ensureUniqueDesignName(long categoryId, String name, Long excludeId) {
        Integer matches;
        if (excludeId == null) {
            matches = jdbc.queryForObject("""
                    SELECT COUNT(*) FROM public.jewellery_designs
                     WHERE category_id=? AND is_deleted=FALSE
                       AND LOWER(BTRIM(design_name))=LOWER(BTRIM(?))
                    """, Integer.class, categoryId, name);
        } else {
            matches = jdbc.queryForObject("""
                    SELECT COUNT(*) FROM public.jewellery_designs
                     WHERE category_id=? AND is_deleted=FALSE AND id<>?
                       AND LOWER(BTRIM(design_name))=LOWER(BTRIM(?))
                    """, Integer.class, categoryId, excludeId, name);
        }
        if (matches != null && matches > 0) {
            throw new IllegalArgumentException("A design with this name already exists in the selected subcategory. Choose a genuinely distinct design name.");
        }
    }

    private static String defaultMaterialLabel(String metal) {
        return switch (metal) {
            case "GOLD" -> "Gold concept · actual karat not specified";
            case "SILVER" -> "Silver concept · fineness and plating not specified";
            default -> "Diamond concept · natural/lab-grown origin and grading not specified";
        };
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
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM public.jewellery_designs WHERE id=? AND is_deleted=FALSE", Integer.class, id);
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
