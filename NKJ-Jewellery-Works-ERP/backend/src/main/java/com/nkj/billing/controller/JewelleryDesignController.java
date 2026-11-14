package com.nkj.billing.controller;

import com.nkj.billing.service.JewelleryDesignImageStorageService;
import com.nkj.billing.service.JewelleryDesignImageStorageService.StoredImage;
import com.nkj.billing.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.BinaryBitmap;
import com.google.zxing.DecodeHintType;
import com.google.zxing.MultiFormatReader;
import com.google.zxing.LuminanceSource;
import com.google.zxing.NotFoundException;
import com.google.zxing.Result;
import com.google.zxing.client.j2se.BufferedImageLuminanceSource;
import com.google.zxing.common.HybridBinarizer;
import java.net.URI;
import java.net.NetworkInterface;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.SocketException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Base64;
import java.util.HexFormat;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Iterator;
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
    private final boolean allowPrivateHttpMobileUploads;

    public JewelleryDesignController(
            JdbcTemplate jdbc,
            JewelleryDesignImageStorageService imageStorage,
            AuthService auth,
            @Value("${nkj.designs.mobile-upload-base-url:}") String mobileUploadBaseUrl,
            @Value("${nkj.designs.mobile-upload-allow-private-http:false}") boolean allowPrivateHttpMobileUploads) {
        this.jdbc = jdbc;
        this.imageStorage = imageStorage;
        this.auth = auth;
        this.mobileUploadBaseUrl = mobileUploadBaseUrl;
        this.allowPrivateHttpMobileUploads = allowPrivateHttpMobileUploads;
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
        // Return a controlled list for the selected metal. Do not derive this
        // dropdown from old rows, which can contain unrelated/legacy values.
        facets.put("purities", purityOptionsForMetal(normalizedMetal));
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
    public Map<String, Object> createMobileUploadSession(
            HttpServletRequest request,
            HttpServletResponse response,
            @RequestParam(value = "designId", required = false) Long targetDesignId) {
        String owner = auth.getUsername();
        if (owner == null || owner.isBlank()) {
            throw new IllegalArgumentException("Your owner session is not available. Sign in again and reopen the QR upload window.");
        }

        // Detect an unapplied QR schema migration before attempting INSERT/UPDATE.
        // The browser receives a safe setup instruction instead of a generic 500.
        Map<String, Object> schema = jdbc.queryForMap("""
                SELECT
                    to_regclass('public.jewellery_design_upload_sessions') IS NOT NULL AS "tableExists",
                    COALESCE((
                        SELECT STRING_AGG(expected.column_name, ', ' ORDER BY expected.column_name)
                          FROM UNNEST(ARRAY[
                              'session_id', 'token_hash', 'created_by', 'created_at',
                              'expires_at', 'consumed_at', 'revoked_at', 'uploaded_design_id',
                              'created_ip', 'uploaded_ip', 'first_scanned_at',
                              'reserved_design_id', 'reserved_category_id', 'target_design_id'
                          ]::TEXT[]) AS expected(column_name)
                         WHERE NOT EXISTS (
                             SELECT 1
                               FROM information_schema.columns actual
                              WHERE actual.table_schema = 'public'
                                AND actual.table_name = 'jewellery_design_upload_sessions'
                                AND actual.column_name = expected.column_name
                         )
                    ), '') AS "missingColumns"
                """);
        if (!Boolean.TRUE.equals(schema.get("tableExists"))) {
            response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
            return Map.of("message",
                    "The QR upload database table is missing. Restart the backend and confirm Flyway migration V32 has completed successfully.");
        }
        String missingColumns = String.valueOf(schema.get("missingColumns"));
        if (!missingColumns.isBlank()) {
            response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
            return Map.of("message",
                    "The QR upload database schema is incomplete. Missing columns: " + missingColumns
                    + ". Restart the backend and confirm Flyway migrations V32, V37 and V38 have completed successfully.");
        }

        Map<String,Object> targetDesign = null;
        if (targetDesignId != null) {
            ensureDesignExists(targetDesignId);
            targetDesign = jdbc.queryForMap("""
                SELECT id, design_id AS "designId", design_name AS "designName"
                  FROM public.jewellery_designs
                 WHERE id=? AND is_deleted=FALSE
                """, targetDesignId);
        }

        // Resolve and validate the website URL before revoking or creating sessions.
        String configuredBase = mobileUploadBaseUrl == null ? "" : mobileUploadBaseUrl.trim();
        String baseCandidate = configuredBase.isBlank() ? request.getHeader("Origin") : configuredBase;
        if (baseCandidate == null || baseCandidate.isBlank()) {
            throw new IllegalArgumentException(
                    "The website origin was not received. Open the owner catalogue in your browser, or set DESIGNS_MOBILE_UPLOAD_BASE_URL to the frontend address.");
        }

        URI baseUri;
        try {
            baseUri = URI.create(baseCandidate.trim());
        } catch (IllegalArgumentException error) {
            throw new IllegalArgumentException("The mobile upload website URL is invalid. Check DESIGNS_MOBILE_UPLOAD_BASE_URL.");
        }
        String scheme = baseUri.getScheme();
        String baseHost = baseUri.getHost();
        if (isLoopbackHost(baseHost)) {
            if (!allowPrivateHttpMobileUploads) {
                throw new IllegalArgumentException(
                        "The ERP was opened on localhost. For local phone uploads, set NKJ_DESIGNS_MOBILE_UPLOAD_ALLOW_PRIVATE_HTTP=true in backend/.env and restart the backend. The QR generator will then automatically use your PC's Wi-Fi IP.");
            }
            String lanAddress = discoverPrivateLanIpv4();
            if (lanAddress == null) {
                throw new IllegalArgumentException(
                        "Could not detect your PC's private Wi-Fi IPv4 address. Connect your PC to Wi-Fi, run ipconfig, and open the ERP using that IPv4 address.");
            }
            try {
                baseUri = new URI(scheme, null, lanAddress, baseUri.getPort(),
                        baseUri.getPath(), baseUri.getQuery(), null);
                baseHost = baseUri.getHost();
            } catch (java.net.URISyntaxException invalidLanUrl) {
                throw new IllegalArgumentException("Could not build the mobile upload URL from your PC's Wi-Fi address.");
            }
        }
        boolean secureHttps = "https".equalsIgnoreCase(scheme);
        boolean permittedPrivateLanHttp = allowPrivateHttpMobileUploads
                && "http".equalsIgnoreCase(scheme)
                && isPrivateIpv4Host(baseHost);
        if (baseHost == null || baseUri.getRawUserInfo() != null || baseUri.getFragment() != null
                || !(secureHttps || permittedPrivateLanHttp)) {
            throw new IllegalArgumentException(
                    "Mobile upload requires HTTPS, or HTTP on a private Wi-Fi IPv4 address when NKJ_DESIGNS_MOBILE_UPLOAD_ALLOW_PRIVATE_HTTP=true. Open the ERP using your PC's Wi-Fi IPv4 address.");
        }
        String base = baseCandidate.trim().replaceAll("/+$", "");

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
                    (session_id, token_hash, created_by, expires_at, created_ip, target_design_id)
                VALUES (?, ?, ?, ?, ?, ?)
                """, sessionId, sha256Hex(token), owner, expiresAt, request.getRemoteAddr(), targetDesignId);

        Map<String,Object> result = new LinkedHashMap<>();
        result.put("sessionId", sessionId.toString());
        result.put("uploadUrl", base + "/mobile-design-upload/" + token);
        result.put("expiresAt", expiresAt.toInstant().toString());
        result.put("expiresInSeconds", 300);
        result.put("status", "WAITING");
        result.put("uploadMode", targetDesignId == null ? "CREATE_DESIGN" : "UPDATE_DESIGN_IMAGES");
        result.put("targetDesignId", targetDesignId);
        if (targetDesign != null) {
            result.put("designId", targetDesign.get("designId"));
            result.put("designName", targetDesign.get("designName"));
        }
        return result;
    }

    private static boolean isLoopbackHost(String host) {
        return host != null && ("localhost".equalsIgnoreCase(host)
                || "127.0.0.1".equals(host) || "::1".equals(host));
    }

    /**
     * When the owner has opened Vite on localhost, build the QR URL with the
     * computer's reachable private IPv4 address instead. The phone can then
     * open the Vite page over the same trusted Wi-Fi network.
     */
    private static String discoverPrivateLanIpv4() {
        List<String> candidates = new ArrayList<>();
        try {
            var interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces != null && interfaces.hasMoreElements()) {
                NetworkInterface network = interfaces.nextElement();
                try {
                    if (!network.isUp() || network.isLoopback()) continue;
                    var addresses = network.getInetAddresses();
                    while (addresses.hasMoreElements()) {
                        InetAddress address = addresses.nextElement();
                        if (address instanceof Inet4Address
                                && !address.isLoopbackAddress()
                                && !address.isLinkLocalAddress()
                                && isPrivateIpv4Host(address.getHostAddress())) {
                            candidates.add(address.getHostAddress());
                        }
                    }
                } catch (SocketException ignored) {
                    // Ignore an adapter that disappears while interfaces are enumerated.
                }
            }
        } catch (SocketException ignored) {
            return null;
        }
        return candidates.stream()
                .distinct()
                .sorted(Comparator.comparingInt(JewelleryDesignController::lanAddressPriority))
                .findFirst()
                .orElse(null);
    }

    private static int lanAddressPriority(String address) {
        try {
            NetworkInterface network = NetworkInterface.getByInetAddress(InetAddress.getByName(address));
            if (network != null) {
                String label = (network.getDisplayName() + " " + network.getName()).toLowerCase(Locale.ROOT);
                if (label.contains("wi-fi") || label.contains("wifi")
                        || label.contains("wlan") || label.contains("wireless")) return 0;
                if (label.contains("ethernet") || label.matches(".*\\beth[0-9]+\\b.*")) return 1;
                if (!network.isVirtual()) return 2;
            }
        } catch (Exception ignored) {
            // Fall back to a stable address-family preference.
        }
        if (address.startsWith("192.168.")) return 3;
        if (address.startsWith("10.")) return 4;
        return 5;
    }

    private static boolean isPrivateIpv4Host(String host) {
        if (host == null) return false;
        String[] octets = host.split("\\.", -1);
        if (octets.length != 4) return false;
        int[] values = new int[4];
        try {
            for (int i = 0; i < 4; i++) {
                if (octets[i].isEmpty() || (octets[i].length() > 1 && octets[i].startsWith("0"))) return false;
                values[i] = Integer.parseInt(octets[i]);
                if (values[i] < 0 || values[i] > 255) return false;
            }
        } catch (NumberFormatException invalidAddress) {
            return false;
        }
        return values[0] == 10
                || (values[0] == 192 && values[1] == 168)
                || (values[0] == 172 && values[1] >= 16 && values[1] <= 31);
    }

    @GetMapping("/api/admin/design-upload-sessions/{sessionId}")
    public Map<String, Object> mobileUploadSessionStatus(
            @PathVariable UUID sessionId,
            HttpServletResponse response) {
        preventMobileUploadCaching(response);
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT s.session_id AS "sessionId",
                       CASE
                         WHEN s.consumed_at IS NOT NULL THEN 'UPLOADED'
                         WHEN s.revoked_at IS NOT NULL THEN 'REVOKED'
                         WHEN s.expires_at <= NOW() THEN 'EXPIRED'
                         WHEN s.first_scanned_at IS NOT NULL THEN 'SCANNED'
                         ELSE 'WAITING'
                       END AS status,
                       s.expires_at AS "expiresAt",
                       s.uploaded_design_id AS "designRecordId",
                       s.target_design_id AS "targetDesignId",
                       CASE WHEN s.target_design_id IS NULL THEN 'CREATE_DESIGN' ELSE 'UPDATE_DESIGN_IMAGES' END AS "uploadMode",
                       s.created_at AS "createdAt",
                       s.first_scanned_at AS "scannedAt",
                       s.consumed_at AS "uploadedAt",
                       d.design_id AS "generatedDesignId",
                       d.design_name AS "designName",
                       c.metal_type AS "metalType",
                       c.slug AS "subcategorySlug"
                  FROM public.jewellery_design_upload_sessions s
                  LEFT JOIN public.jewellery_designs d ON d.id=COALESCE(s.target_design_id, s.uploaded_design_id)
                  LEFT JOIN public.jewellery_design_categories c ON c.id=d.category_id
                 WHERE s.session_id=? AND s.created_by=?
                """, sessionId, auth.getUsername());
        if (rows.isEmpty()) throw new IllegalArgumentException("QR upload session not found.");
        return new LinkedHashMap<>(rows.get(0));
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

    @PostMapping(value = "/api/mobile-design-upload/{token}/scan-qr", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> scanQrFromMobileImage(
            @PathVariable String token,
            @RequestParam("file") MultipartFile file,
            HttpServletResponse response) throws IOException {
        preventMobileUploadCaching(response);
        if (token == null || token.length() < 40 || token.length() > 100
                || !token.matches("[A-Za-z0-9_-]+")) {
            throw new IllegalArgumentException("This QR upload link is invalid.");
        }
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Choose an image that contains a QR code.");
        }
        if (file.getSize() > 10L * 1024L * 1024L) {
            throw new IllegalArgumentException("QR images must be 10 MB or smaller.");
        }

        List<Map<String, Object>> activeSessions = jdbc.queryForList("""
                SELECT session_id
                  FROM public.jewellery_design_upload_sessions
                 WHERE token_hash=? AND consumed_at IS NULL
                   AND revoked_at IS NULL AND expires_at > NOW()
                """, sha256Hex(token));
        if (activeSessions.isEmpty()) {
            throw new IllegalArgumentException("This mobile upload link has expired, was revoked, or has already been used.");
        }

        BufferedImage image;
        try (var input = file.getInputStream();
             ImageInputStream imageInput = ImageIO.createImageInputStream(input)) {
            if (imageInput == null) {
                throw new IllegalArgumentException("The selected file is not a readable JPG, PNG or WebP image.");
            }
            Iterator<ImageReader> readers = ImageIO.getImageReaders(imageInput);
            if (!readers.hasNext()) {
                throw new IllegalArgumentException("The selected file is not a readable JPG, PNG or WebP image.");
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(imageInput, true, true);
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                if (width < 1 || height < 1 || width > 8000 || height > 8000
                        || (long) width * height > 24_000_000L) {
                    throw new IllegalArgumentException("QR image dimensions must not exceed 8000 × 8000 pixels or 24 megapixels.");
                }
                image = reader.read(0);
            } finally {
                reader.dispose();
            }
        }
        if (image == null) {
            throw new IllegalArgumentException("The selected file is not a readable JPG, PNG or WebP image.");
        }

        String decodedText = decodeQrText(image);
        if (decodedText == null || decodedText.isBlank()) {
            throw new IllegalArgumentException("No readable QR code was found in this image. Try a sharper, well-lit image with the full QR code visible.");
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("format", "QR_CODE");
        result.put("decodedText", decodedText);
        result.put("decodedAt", java.time.Instant.now().toString());
        return result;
    }

    static String decodeQrText(BufferedImage source) {
        Map<DecodeHintType, Object> hints = new HashMap<>();
        hints.put(DecodeHintType.POSSIBLE_FORMATS, List.of(BarcodeFormat.QR_CODE));
        hints.put(DecodeHintType.TRY_HARDER, Boolean.TRUE);
        hints.put(DecodeHintType.CHARACTER_SET, StandardCharsets.UTF_8.name());

        for (int rotation : new int[] {0, 90, 180, 270}) {
            BufferedImage candidate = rotation == 0 ? source : rotateForQr(source, rotation);
            for (boolean inverted : new boolean[] {false, true}) {
                try {
                    LuminanceSource luminance = new BufferedImageLuminanceSource(candidate);
                    if (inverted) luminance = luminance.invert();
                    BinaryBitmap bitmap = new BinaryBitmap(new HybridBinarizer(luminance));
                    Result result = new MultiFormatReader().decode(bitmap, hints);
                    if (result != null && result.getText() != null && !result.getText().isBlank()) {
                        return result.getText().trim();
                    }
                } catch (NotFoundException ignored) {
                    // Try the next orientation and contrast polarity.
                }
            }
        }
        return null;
    }

    private static BufferedImage rotateForQr(BufferedImage source, int degrees) {
        int width = source.getWidth();
        int height = source.getHeight();
        boolean quarterTurn = degrees == 90 || degrees == 270;
        BufferedImage rotated = new BufferedImage(
                quarterTurn ? height : width,
                quarterTurn ? width : height,
                BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = rotated.createGraphics();
        try {
            if (degrees == 90) {
                graphics.translate(height, 0);
                graphics.rotate(Math.PI / 2);
            } else if (degrees == 180) {
                graphics.translate(width, height);
                graphics.rotate(Math.PI);
            } else if (degrees == 270) {
                graphics.translate(0, width);
                graphics.rotate(-Math.PI / 2);
            }
            graphics.drawImage(source, 0, 0, null);
        } finally {
            graphics.dispose();
        }
        return rotated;
    }

    @GetMapping("/api/mobile-design-upload/{token}")
    public Map<String, Object> mobileUploadSessionInfo(
            @PathVariable String token,
            HttpServletResponse response) {
        preventMobileUploadCaching(response);
        if (token == null || token.length() < 40 || token.length() > 100
                || !token.matches("[A-Za-z0-9_-]+")) {
            throw new IllegalArgumentException("This QR upload link is invalid.");
        }

        String tokenHash = sha256Hex(token);
        // The first successful mobile open changes the desktop connection state
        // to SCANNED. Expired, revoked and already-used tokens remain read-only.
        jdbc.update("""
                UPDATE public.jewellery_design_upload_sessions
                   SET first_scanned_at=COALESCE(first_scanned_at, NOW())
                 WHERE token_hash=?
                   AND consumed_at IS NULL
                   AND revoked_at IS NULL
                   AND expires_at > NOW()
                """, tokenHash);

        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT CASE
                         WHEN s.consumed_at IS NOT NULL THEN 'UPLOADED'
                         WHEN s.revoked_at IS NOT NULL THEN 'REVOKED'
                         WHEN s.expires_at <= NOW() THEN 'EXPIRED'
                         WHEN s.first_scanned_at IS NOT NULL THEN 'SCANNED'
                         ELSE 'WAITING'
                       END AS status,
                       s.expires_at AS "expiresAt",
                       GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (s.expires_at - NOW()))))::BIGINT AS "secondsRemaining",
                       s.consumed_at AS "uploadedAt",
                       s.target_design_id AS "targetDesignId",
                       CASE WHEN s.target_design_id IS NULL THEN 'CREATE_DESIGN' ELSE 'UPDATE_DESIGN_IMAGES' END AS "uploadMode",
                       d.id AS "designRecordId",
                       d.design_id AS "generatedDesignId",
                       d.design_name AS "designName",
                       c.metal_type AS "metalType",
                       c.subcategory_name AS "subcategoryName"
                  FROM public.jewellery_design_upload_sessions s
                  LEFT JOIN public.jewellery_designs d ON d.id=COALESCE(s.target_design_id, s.uploaded_design_id)
                  LEFT JOIN public.jewellery_design_categories c ON c.id=d.category_id
                 WHERE s.token_hash=?
                """, tokenHash);
        if (rows.isEmpty()) throw new IllegalArgumentException("This QR upload link is invalid.");
        return new LinkedHashMap<>(rows.get(0));
    }

    @PostMapping("/api/mobile-design-upload/{token}/design-id")
    @Transactional
    public Map<String, Object> reserveMobileDesignId(
            @PathVariable String token,
            @RequestBody Map<String, Object> body,
            HttpServletResponse response) {
        preventMobileUploadCaching(response);
        if (token == null || token.length() < 40 || token.length() > 100
                || !token.matches("[A-Za-z0-9_-]+")) {
            throw new IllegalArgumentException("This QR upload link is invalid.");
        }

        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT session_id, (expires_at > NOW()) AS "notExpired",
                       (consumed_at IS NOT NULL) AS consumed,
                       (revoked_at IS NOT NULL) AS revoked,
                       target_design_id AS "targetDesignId",
                       reserved_design_id AS "reservedDesignId",
                       reserved_category_id AS "reservedCategoryId"
                  FROM public.jewellery_design_upload_sessions
                 WHERE token_hash=?
                 FOR UPDATE
                """, sha256Hex(token));
        if (rows.isEmpty()) throw new IllegalArgumentException("This QR upload link is invalid or expired.");
        Map<String, Object> session = rows.get(0);
        if (session.get("targetDesignId") != null) {
            throw new IllegalArgumentException("This QR session is linked to an existing design and can only upload photographs.");
        }
        if (Boolean.TRUE.equals(session.get("revoked"))
                || Boolean.TRUE.equals(session.get("consumed"))
                || !Boolean.TRUE.equals(session.get("notExpired"))) {
            throw new IllegalArgumentException("This QR upload session is no longer active. Ask the owner to generate a new QR code.");
        }

        long categoryId = number(body.get("categoryId"), "Choose a jewellery subcategory.");
        String metal = categoryMetal(categoryId);
        Object reservedCategory = session.get("reservedCategoryId");
        String reservedId = (String) session.get("reservedDesignId");
        if (reservedId != null && reservedCategory instanceof Number
                && ((Number) reservedCategory).longValue() == categoryId) {
            return Map.of("designId", reservedId, "categoryId", categoryId, "reserved", true);
        }

        // Locking the session row makes retries/concurrent requests safe.
        // Unused sequence values are never reused when a category is changed.
        String nextId = nextDesignId(categoryId, metal);
        jdbc.update("""
                UPDATE public.jewellery_design_upload_sessions
                   SET reserved_design_id=?, reserved_category_id=?
                 WHERE session_id=? AND consumed_at IS NULL AND revoked_at IS NULL
                """, nextId, categoryId, session.get("session_id"));
        return Map.of("designId", nextId, "categoryId", categoryId, "reserved", true);
    }

    @PostMapping(value = "/api/mobile-design-upload/{token}/design", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @CacheEvict(cacheNames = {"jewelleryPublicCategories", "jewelleryAdminCategories"}, allEntries = true)
    @Transactional
    public Map<String, Object> uploadDesignFromMobileQr(
            @PathVariable String token,
            @RequestParam(value = "categoryId", required = false) String categoryId,
            @RequestParam(value = "designName", required = false) String designName,
            @RequestParam(value = "description", required = false) String description,
            @RequestParam(value = "styleLabel", required = false) String styleLabel,
            @RequestParam(value = "materialLabel", required = false) String materialLabel,
            @RequestParam(value = "keywords", required = false) String keywords,
            @RequestParam(value = "purity", required = false) String purity,
            @RequestParam(value = "weightGrams", required = false) String weightGrams,
            @RequestParam(value = "isActive", defaultValue = "true") boolean isActive,
            @RequestParam(value = "isFeatured", defaultValue = "false") boolean isFeatured,
            @RequestParam(value = "rotations", required = false) List<Integer> rotations,
            @RequestParam(value = "cropZooms", required = false) List<Double> cropZooms,
            @RequestParam("files") List<MultipartFile> files,
            HttpServletRequest request,
            HttpServletResponse response) throws IOException {
        preventMobileUploadCaching(response);
        if (token == null || token.length() < 40 || token.length() > 100
                || !token.matches("[A-Za-z0-9_-]+")) {
            throw new IllegalArgumentException("This QR upload link is invalid. Ask the owner to generate a new QR code.");
        }

        List<Map<String, Object>> sessions = jdbc.queryForList("""
                SELECT session_id, created_by,
                       (expires_at > NOW()) AS "notExpired",
                       (consumed_at IS NOT NULL) AS consumed,
                       (revoked_at IS NOT NULL) AS revoked,
                       target_design_id AS "targetDesignId",
                       reserved_design_id AS "reservedDesignId",
                       reserved_category_id AS "reservedCategoryId"
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

        Object targetDesignValue = session.get("targetDesignId");
        if (targetDesignValue instanceof Number targetNumber) {
            long targetId = targetNumber.longValue();
            ensureDesignExists(targetId);
            Map<String,Object> withImages = storeDesignImages(targetId, files, rotations, cropZooms);
            jdbc.update("""
                    UPDATE public.jewellery_design_upload_sessions
                       SET consumed_at=NOW(), uploaded_design_id=?, uploaded_ip=?
                     WHERE session_id=? AND consumed_at IS NULL AND revoked_at IS NULL
                    """, targetId, request.getRemoteAddr(), session.get("session_id"));
            Map<String,Object> result = new LinkedHashMap<>(withImages);
            result.put("uploadStatus", "UPLOADED");
            result.put("uploadMode", "UPDATE_DESIGN_IMAGES");
            result.put("designRecordId", targetId);
            result.put("designName", withImages.get("designName"));
            return result;
        }

        if (categoryId == null || categoryId.isBlank() || designName == null || designName.isBlank()) {
            throw new IllegalArgumentException("Choose a subcategory and enter a design name.");
        }
        Map<String, Object> body = new HashMap<>();
        body.put("categoryId", categoryId);
        body.put("designName", designName);
        body.put("description", description == null ? "" : description);
        body.put("styleLabel", styleLabel == null ? "Shop photograph" : styleLabel);
        body.put("materialLabel", materialLabel == null ? "" : materialLabel);
        body.put("keywords", keywords == null ? "" : keywords);
        body.put("purity", purity == null ? "" : purity);
        body.put("weightGrams", weightGrams == null ? "" : weightGrams);
        body.put("isActive", isActive);
        body.put("isFeatured", isFeatured);

        // Reuse the backend Design ID already shown on the phone when the selected
        // subcategory matches. Otherwise allocate a fresh category-scoped ID.
        String reservedDesignId = (String) session.get("reservedDesignId");
        Object reservedCategoryId = session.get("reservedCategoryId");
        boolean matchingReservation = reservedDesignId != null
                && reservedCategoryId instanceof Number
                && ((Number) reservedCategoryId).longValue() == Long.parseLong(categoryId);
        Map<String, Object> saved = createDesign(body, matchingReservation ? reservedDesignId : null);
        long designPk = ((Number) saved.get("id")).longValue();
        Map<String, Object> withImages = storeDesignImages(designPk, files, rotations, cropZooms);

        jdbc.update("""
                UPDATE public.jewellery_design_upload_sessions
                   SET consumed_at=NOW(), uploaded_design_id=?, uploaded_ip=?
                 WHERE session_id=? AND consumed_at IS NULL AND revoked_at IS NULL
                """, designPk, request.getRemoteAddr(), session.get("session_id"));

        Map<String, Object> uploadResponse = new LinkedHashMap<>(withImages);
        uploadResponse.put("uploadStatus", "UPLOADED");
        return uploadResponse;
    }

    private static void preventMobileUploadCaching(HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
        response.setHeader("Pragma", "no-cache");
        response.setHeader("Referrer-Policy", "no-referrer");
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
        return createDesign(body, null);
    }

    private Map<String, Object> createDesign(Map<String, Object> body, String reservedDesignId) {
        long categoryId = number(body.get("categoryId"), "Choose a subcategory.");
        String name = requiredText(body.get("designName"), "Design name is required.", 160);
        String description = text(body.get("description"), 5000);
        String style = text(body.get("styleLabel"), 80);
        String keywords = text(body.get("keywords"), 800);
        String regional = text(body.get("regionalInspiration"), 80);
        String material = text(body.get("materialLabel"), 120);
        BigDecimal weightGrams = decimal(body.get("weightGrams"), "Weight");
        BigDecimal priceInr = decimal(body.get("priceInr"), "Price");
        String metal = categoryMetal(categoryId);
        String purity = validatePurityForMetal(metal, text(body.get("purity"), 40), null);
        ensureUniqueDesignName(categoryId, name, null);
        if (material.isBlank()) material = defaultMaterialLabel(metal);
        if (regional.isBlank()) regional = "Pan-Indian";
        String designId;
        if (reservedDesignId == null || reservedDesignId.isBlank()) {
            designId = nextDesignId(categoryId, metal);
        } else {
            String categoryName = jdbc.queryForObject(
                    "SELECT subcategory_name FROM public.jewellery_design_categories WHERE id=? AND is_active=TRUE",
                    String.class, categoryId);
            String expectedPrefix = "NKJ_" + metal + "_" + categoryIdentifier(categoryName) + "_";
            if (!reservedDesignId.startsWith(expectedPrefix)
                    || !reservedDesignId.matches("NKJ_[A-Z0-9_]+_[0-9]{4,}")) {
                throw new IllegalArgumentException("The reserved Design ID does not match the selected category.");
            }
            designId = reservedDesignId;
        }

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
                "SELECT d.category_id AS \"categoryId\", c.metal_type AS \"metalType\", d.purity AS \"purity\", d.regional_inspiration AS \"regionalInspiration\", d.material_label AS \"materialLabel\" FROM public.jewellery_designs d JOIN public.jewellery_design_categories c ON c.id=d.category_id WHERE d.id=?",
                id);
        String existingMetal = String.valueOf(existingDesign.get("metalType"));
        String existingPurity = existingDesign.get("purity") == null ? "" : String.valueOf(existingDesign.get("purity"));
        long existingCategoryId = ((Number) existingDesign.get("categoryId")).longValue();
        String regionalValue = body.get("regionalInspiration") == null
                ? String.valueOf(existingDesign.getOrDefault("regionalInspiration", "Pan-Indian"))
                : text(body.get("regionalInspiration"), 80);
        String materialValue = body.get("materialLabel") == null
                ? String.valueOf(existingDesign.getOrDefault("materialLabel", defaultMaterialLabel(existingMetal)))
                : text(body.get("materialLabel"), 120);
        String requestedPurity = body.containsKey("purity")
                ? text(body.get("purity"), 40) : existingPurity;
        String purity = validatePurityForMetal(existingMetal, requestedPurity, existingPurity);

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
                purity,
                regionalValue,
                materialValue,
                decimal(body.get("weightGrams"), "Weight"),
                decimal(body.get("priceInr"), "Price"),
                bool(body.get("isFeatured"), false),
                bool(body.get("isActive"), true),
                id);
        return designDetails(id, true);
    }

    @PostMapping("/api/admin/designs/{id}/move")
    @CacheEvict(cacheNames = {"jewelleryPublicCategories", "jewelleryAdminCategories"}, allEntries = true)
    @Transactional
    public Map<String, Object> moveDesign(
            @PathVariable long id,
            @RequestBody Map<String, Object> body,
            HttpServletRequest request) {
        Map<String, Object> before = jdbc.queryForMap("""
                SELECT d.design_id AS "designId",
                       d.design_code AS "designCode",
                       d.category_id AS "categoryId",
                       c.metal_type AS "metalType",
                       d.design_name AS "designName",
                       d.description,
                       d.style_label AS "styleLabel",
                       d.keywords,
                       d.purity,
                       d.regional_inspiration AS "regionalInspiration",
                       d.material_label AS "materialLabel",
                       d.weight_grams AS "weightGrams",
                       d.price_inr AS "priceInr",
                       d.is_sample AS "isSample",
                       d.is_featured AS "isFeatured",
                       d.is_active AS "isActive",
                       d.popularity_count AS "popularityCount"
                  FROM public.jewellery_designs d
                  JOIN public.jewellery_design_categories c ON c.id=d.category_id
                 WHERE d.id=? AND d.is_deleted=FALSE
                 FOR UPDATE OF d
                """, id);

        long sourceCategoryId = ((Number) before.get("categoryId")).longValue();
        long targetCategoryId = number(body.get("categoryId"), "Choose a destination subcategory.");
        if (targetCategoryId == sourceCategoryId) {
            throw new IllegalArgumentException("Choose a different destination subcategory.");
        }

        String metal = String.valueOf(before.get("metalType"));
        String targetMetal = categoryMetal(targetCategoryId);
        if (!metal.equals(targetMetal)) {
            throw new IllegalArgumentException("A design can only be moved between subcategories of the same metal. Create a new design for a different metal.");
        }

        String designName = String.valueOf(before.get("designName"));
        String existingPurity = before.get("purity") == null ? "" : String.valueOf(before.get("purity"));
        String purity = validatePurityForMetal(metal, existingPurity, existingPurity);
        ensureUniqueDesignName(targetCategoryId, designName, null);

        // A category is embedded in Design ID, so a move creates a new record and
        // new ID. The old record is archived with its original ID unchanged.
        String newDesignId = nextDesignId(targetCategoryId, metal);
        Long nextCode = jdbc.queryForObject(
                "UPDATE public.jewellery_design_code_counters SET last_value=last_value+1 WHERE metal_type=? RETURNING last_value",
                Long.class, metal);
        if (nextCode == null) {
            throw new IllegalStateException("Design code counter is not initialized for " + metal + ".");
        }
        String codePrefix = switch (metal) {
            case "GOLD" -> "NKJ-GOLD-";
            case "SILVER" -> "NKJ-SILVER-";
            default -> "NKJ-DIA-";
        };
        String newDesignCode = codePrefix + String.format(Locale.ROOT, "%05d", nextCode);

        Long newId = jdbc.queryForObject("""
                INSERT INTO public.jewellery_designs
                    (design_code, design_id, category_id, design_name, description, style_label, keywords,
                     purity, regional_inspiration, material_label, weight_grams, price_inr,
                     is_sample, is_featured, is_active, popularity_count, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                RETURNING id
                """, Long.class,
                newDesignCode, newDesignId, targetCategoryId, designName,
                before.get("description"), before.get("styleLabel"), before.get("keywords"),
                purity, before.get("regionalInspiration"), before.get("materialLabel"),
                before.get("weightGrams"), before.get("priceInr"), before.get("isSample"),
                before.get("isFeatured"), before.get("isActive"), before.get("popularityCount"));

        int movedImages = jdbc.update(
                "UPDATE public.jewellery_design_images SET design_id=? WHERE design_id=?",
                newId, id);

        jdbc.update("""
                UPDATE public.jewellery_designs
                   SET is_deleted=TRUE, deleted_at=NOW(), deleted_by=?,
                       is_active=FALSE, is_featured=FALSE, updated_at=NOW()
                 WHERE id=? AND is_deleted=FALSE
                """, auth.getUsername(), id);

        jdbc.update("""
                INSERT INTO public.audit_logs(
                    actor_identity, action, module, record_id,
                    previous_value, new_value, ip_address
                )
                VALUES (?, 'DESIGN_MOVED', 'JEWELLERY_DESIGNS', ?,
                        jsonb_build_object(
                            'designId', ?, 'designCode', ?, 'categoryId', ?, 'designName', ?
                        ),
                        jsonb_build_object(
                            'designId', ?, 'designCode', ?, 'categoryId', ?, 'designName', ?, 'movedImages', ?
                        ), ?)
                """,
                auth.getUsername(), String.valueOf(id),
                before.get("designId"), before.get("designCode"), sourceCategoryId, designName,
                newDesignId, newDesignCode, targetCategoryId, designName, movedImages,
                request.getRemoteAddr());

        Map<String, Object> result = new LinkedHashMap<>(designDetails(newId, true));
        result.put("movedFromDesignId", before.get("designId"));
        result.put("movedFromRecordId", id);
        result.put("movedImageCount", movedImages);
        return result;
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
            @RequestParam("files") List<MultipartFile> files,
            @RequestParam(value = "rotations", required = false) List<Integer> rotations,
            @RequestParam(value = "cropZooms", required = false) List<Double> cropZooms) throws IOException {
        return storeDesignImages(id, files, rotations, cropZooms);
    }

    /**
     * Replaces only the primary photograph for a design. Other gallery images
     * remain attached and keep their relative order. The design row and Design ID
     * are never recreated.
     */
    @PostMapping(value = "/api/admin/designs/{id}/images/replace-primary", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @CacheEvict(cacheNames = {"jewelleryPublicCategories", "jewelleryAdminCategories"}, allEntries = true)
    @Transactional
    public Map<String, Object> replacePrimaryImage(
            @PathVariable long id,
            @RequestParam("file") MultipartFile file) throws IOException {
        ensureDesignExists(id);
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Choose a replacement jewellery photograph.");
        }

        StoredImage stored = imageStorage.store(id, file);
        List<String> newFileUrls = List.of(stored.originalUrl(), stored.displayUrl(), stored.thumbnailUrl());
        List<String> obsoleteFileUrls = new ArrayList<>();

        try {
            List<Map<String, Object>> duplicateImages = jdbc.queryForList("""
                    SELECT id, design_id AS "designId"
                      FROM public.jewellery_design_images
                     WHERE content_sha256 = ?
                     LIMIT 1
                    """, stored.sha256());

            if (!duplicateImages.isEmpty()) {
                long existingImageId = ((Number) duplicateImages.get(0).get("id")).longValue();
                long existingDesignId = ((Number) duplicateImages.get(0).get("designId")).longValue();
                newFileUrls.forEach(imageStorage::deleteStoredPath);
                if (existingDesignId != id) {
                    throw new IllegalArgumentException(
                            "This photograph is already attached to another jewellery design.");
                }
                jdbc.update("""
                        UPDATE public.jewellery_design_images
                           SET display_order = display_order + 1
                         WHERE design_id = ? AND id <> ?
                        """, id, existingImageId);
                jdbc.update("""
                        UPDATE public.jewellery_design_images
                           SET display_order = 0
                         WHERE id = ? AND design_id = ?
                        """, existingImageId, id);
            } else {
                List<Map<String, Object>> primaryRows = jdbc.queryForList("""
                        SELECT id, original_url AS "originalUrl",
                               display_url AS "displayUrl", thumbnail_url AS "thumbnailUrl"
                          FROM public.jewellery_design_images
                         WHERE design_id = ?
                         ORDER BY display_order, id
                         LIMIT 1
                        """, id);

                if (!primaryRows.isEmpty()) {
                    Map<String, Object> primary = primaryRows.get(0);
                    long primaryId = ((Number) primary.get("id")).longValue();
                    addNonBlankUrl(obsoleteFileUrls, primary.get("originalUrl"));
                    addNonBlankUrl(obsoleteFileUrls, primary.get("displayUrl"));
                    addNonBlankUrl(obsoleteFileUrls, primary.get("thumbnailUrl"));

                    jdbc.update("""
                            UPDATE public.jewellery_design_images
                               SET display_order = display_order + 1
                             WHERE design_id = ? AND id <> ?
                            """, id, primaryId);
                    jdbc.update("""
                            UPDATE public.jewellery_design_images
                               SET original_url = ?, display_url = ?, thumbnail_url = ?,
                                   alt_text = ?, content_sha256 = ?, display_order = 0
                             WHERE id = ? AND design_id = ?
                            """, stored.originalUrl(), stored.displayUrl(), stored.thumbnailUrl(),
                            stored.fileName(), stored.sha256(), primaryId, id);
                } else {
                    jdbc.update("""
                            UPDATE public.jewellery_design_images
                               SET display_order = display_order + 1
                             WHERE design_id = ?
                            """, id);
                    jdbc.update("""
                            INSERT INTO public.jewellery_design_images
                                (design_id, original_url, display_url, thumbnail_url,
                                 alt_text, content_sha256, display_order, created_at)
                            VALUES (?, ?, ?, ?, ?, ?, 0, NOW())
                            """, id, stored.originalUrl(), stored.displayUrl(), stored.thumbnailUrl(),
                            stored.fileName(), stored.sha256());
                }
            }

            jdbc.update("""
                    UPDATE public.jewellery_designs
                       SET is_sample = FALSE, image_status = 'READY', updated_at = NOW()
                     WHERE id = ?
                    """, id);

            if (!obsoleteFileUrls.isEmpty() && TransactionSynchronizationManager.isSynchronizationActive()) {
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        obsoleteFileUrls.forEach(imageStorage::deleteStoredPath);
                    }
                });
            }
        } catch (RuntimeException error) {
            newFileUrls.forEach(imageStorage::deleteStoredPath);
            throw error;
        }

        return designDetails(id, true);
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
            // A stored owner photograph must immediately become visible to both
            // the owner detail view and the public catalogue. The public query
            // intentionally hides image URLs while image_status is PENDING.
            jdbc.update("""
                    UPDATE public.jewellery_designs d
                       SET is_sample = FALSE,
                           image_status = CASE WHEN EXISTS (
                               SELECT 1
                                 FROM public.jewellery_design_images i
                                WHERE i.design_id = d.id
                                  AND (
                                      i.original_url LIKE '/api/uploads/designs/%'
                                      OR i.display_url LIKE '/api/uploads/designs/%'
                                      OR i.thumbnail_url LIKE '/api/uploads/designs/%'
                                  )
                           ) THEN 'READY' ELSE 'PENDING' END,
                           updated_at = NOW()
                     WHERE d.id = ?
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
        jdbc.update("""
                UPDATE public.jewellery_designs d
                   SET image_status = CASE WHEN EXISTS (
                       SELECT 1
                         FROM public.jewellery_design_images i
                        WHERE i.design_id = d.id
                          AND (
                              i.original_url LIKE '/api/uploads/designs/%'
                              OR i.display_url LIKE '/api/uploads/designs/%'
                              OR i.thumbnail_url LIKE '/api/uploads/designs/%'
                          )
                   ) THEN 'READY' ELSE 'PENDING' END,
                       updated_at = NOW()
                 WHERE d.id = ?
                """, id);
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
        jdbc.update("""
                UPDATE public.jewellery_designs d
                   SET image_status = CASE WHEN EXISTS (
                       SELECT 1
                         FROM public.jewellery_design_images i
                        WHERE i.design_id = d.id
                          AND (
                              i.original_url LIKE '/api/uploads/designs/%'
                              OR i.display_url LIKE '/api/uploads/designs/%'
                              OR i.thumbnail_url LIKE '/api/uploads/designs/%'
                          )
                   ) THEN 'READY' ELSE 'PENDING' END,
                       is_sample = NOT EXISTS (
                           SELECT 1
                             FROM public.jewellery_design_images i
                            WHERE i.design_id = d.id
                              AND (
                                  i.original_url LIKE '/api/uploads/designs/%'
                                  OR i.display_url LIKE '/api/uploads/designs/%'
                                  OR i.thumbnail_url LIKE '/api/uploads/designs/%'
                              )
                       ),
                       updated_at = NOW()
                 WHERE d.id = ?
                """, id);
        return designDetails(id, true);
    }

    private List<Map<String, Object>> categoryList(boolean includeInactive) {
        // Read category rows separately from design aggregates. This keeps the
        // category endpoint independent of a grouped category/design join and
        // makes a missing/empty design group harmless (it simply counts as 0).
        List<Map<String, Object>> categories = jdbc.queryForList("""
                SELECT c.id, c.metal_type AS "metalType",
                       c.subcategory_name AS "subcategoryName", c.slug,
                       c.display_order AS "displayOrder", c.is_active AS "isActive"
                  FROM public.jewellery_design_categories c
                 WHERE (? = TRUE OR c.is_active = TRUE)
                 ORDER BY CASE c.metal_type WHEN 'GOLD' THEN 1 WHEN 'SILVER' THEN 2 ELSE 3 END,
                          c.display_order, c.subcategory_name
                """, includeInactive);
        if (categories.isEmpty()) {
            return categories;
        }

        Map<Long, Map<String, Object>> countsByCategory = new HashMap<>();
        List<Map<String, Object>> countRows = jdbc.queryForList("""
                SELECT d.category_id AS "categoryId",
                       COUNT(*) AS "totalDesignCount",
                       SUM(CASE WHEN d.is_active = TRUE THEN 1 ELSE 0 END) AS "activeDesignCount"
                  FROM public.jewellery_designs d
                 WHERE d.is_deleted = FALSE
                 GROUP BY d.category_id
                """);
        for (Map<String, Object> countRow : countRows) {
            Object rawId = countRow.get("categoryId");
            if (rawId instanceof Number number) {
                countsByCategory.put(number.longValue(), countRow);
            }
        }

        for (Map<String, Object> category : categories) {
            Object rawId = category.get("id");
            long categoryId = rawId instanceof Number number ? number.longValue() : -1L;
            Map<String, Object> counts = countsByCategory.get(categoryId);
            category.put("activeDesignCount", counts == null ? 0L : counts.get("activeDesignCount"));
            category.put("totalDesignCount", counts == null ? 0L : counts.get("totalDesignCount"));
        }
        return categories;
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
        if (purity != null && !purity.isBlank()) {
            String normalizedMetal = metal == null ? "" : metal.trim().toUpperCase(Locale.ROOT);
            if (normalizedMetal.isBlank()) {
                throw new IllegalArgumentException("Select Gold, Silver or Diamond before filtering by purity.");
            }
            purity = validatePurityForMetal(normalizedMetal, purity, null);
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
            filter.append(" AND (d.design_id ILIKE ? OR d.design_code ILIKE ? OR to_tsvector('simple', d.design_name || ' ' || d.keywords || ' ' || d.style_label || ' ' || d.regional_inspiration || ' ' || d.material_label || ' ' || COALESCE(d.purity, '')) @@ plainto_tsquery('simple', ?))");
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
                       CASE WHEN d.image_status = 'READY' THEN img.thumbnail_url END AS "thumbnailUrl",
                       CASE WHEN d.image_status = 'READY' THEN img.display_url END AS "displayUrl",
                       CASE WHEN d.image_status = 'READY' THEN img.original_url END AS "originalUrl",
                       CASE WHEN d.image_status = 'READY' THEN COALESCE(img.image_count, 0) ELSE 0 END AS "imageCount"
                """ + categoryJoin + """
                LEFT JOIN LATERAL (
                    SELECT COALESCE(NULLIF(BTRIM(di.thumbnail_url), ''),
                                    NULLIF(BTRIM(di.display_url), ''),
                                    NULLIF(BTRIM(di.original_url), '')) AS thumbnail_url,
                           COALESCE(NULLIF(BTRIM(di.display_url), ''),
                                    NULLIF(BTRIM(di.original_url), ''),
                                    NULLIF(BTRIM(di.thumbnail_url), '')) AS display_url,
                           COALESCE(NULLIF(BTRIM(di.original_url), ''),
                                    NULLIF(BTRIM(di.display_url), ''),
                                    NULLIF(BTRIM(di.thumbnail_url), '')) AS original_url,
                           (SELECT COUNT(*) FROM public.jewellery_design_images all_images
                             WHERE all_images.design_id=d.id
                               AND COALESCE(NULLIF(BTRIM(all_images.thumbnail_url), ''),
                                            NULLIF(BTRIM(all_images.display_url), ''),
                                            NULLIF(BTRIM(all_images.original_url), '')) IS NOT NULL
                               AND (all_images.original_url LIKE '/api/uploads/designs/%'
                                    OR all_images.display_url LIKE '/api/uploads/designs/%'
                                    OR all_images.thumbnail_url LIKE '/api/uploads/designs/%')) AS image_count
                      FROM public.jewellery_design_images di
                     WHERE di.design_id = d.id
                       AND COALESCE(NULLIF(BTRIM(di.thumbnail_url), ''),
                                    NULLIF(BTRIM(di.display_url), ''),
                                    NULLIF(BTRIM(di.original_url), '')) IS NOT NULL
                       AND (di.original_url LIKE '/api/uploads/designs/%'
                            OR di.display_url LIKE '/api/uploads/designs/%'
                            OR di.thumbnail_url LIKE '/api/uploads/designs/%')
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
        String imageSql = """
                SELECT id,
                       COALESCE(NULLIF(BTRIM(original_url), ''), NULLIF(BTRIM(thumbnail_url), '')) AS "originalUrl",
                       COALESCE(NULLIF(BTRIM(thumbnail_url), ''), NULLIF(BTRIM(original_url), '')) AS "thumbnailUrl",
                       display_url AS "displayUrl",
                       alt_text AS "altText", display_order AS "displayOrder"
                  FROM public.jewellery_design_images
                 WHERE design_id=?
                   AND COALESCE(NULLIF(BTRIM(thumbnail_url), ''), NULLIF(BTRIM(original_url), '')) IS NOT NULL
                """ + (includeInactive ? "" : """
                   AND (original_url LIKE '/api/uploads/designs/%'
                        OR display_url LIKE '/api/uploads/designs/%'
                        OR thumbnail_url LIKE '/api/uploads/designs/%')
                """) + " ORDER BY display_order, id";
        result.put("images", jdbc.queryForList(imageSql, id));
        return result;
    }

    private void ensureUniqueDesignName(long categoryId, String name, Long excludeId) {
        // Serialize design-name checks within a subcategory so concurrent owner
        // requests cannot create identical names between validation and save.
        jdbc.queryForObject(
                "SELECT id FROM public.jewellery_design_categories WHERE id=? AND is_active=TRUE FOR UPDATE",
                Long.class, categoryId);
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

    private static void addNonBlankUrl(List<String> target, Object value) {
        if (value instanceof String url && !url.isBlank()) {
            target.add(url);
        }
    }

    private void ensureDesignExists(long id) {
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM public.jewellery_designs WHERE id=? AND is_deleted=FALSE", Integer.class, id);
        if (count == null || count == 0) {
            throw new IllegalArgumentException("Jewellery design not found.");
        }
    }

    private static List<String> purityOptionsForMetal(String metal) {
        if (metal == null || metal.isBlank()) return List.of();
        return switch (metal.trim().toUpperCase(Locale.ROOT)) {
            case "GOLD" -> List.of("24K", "hallmark(916)", "22K");
            case "SILVER" -> List.of("999 Silver", "925 Silver", "900 Silver", "800 Silver");
            case "DIAMOND" -> List.of("Natural Diamond", "Lab-Grown Diamond");
            default -> List.of();
        };
    }

    /**
     * New purity values must belong to the selected metal. An unchanged legacy
     * value may be retained while editing/moving that same existing record so
     * unrelated edits never silently overwrite historical purity data.
     */
    private static String validatePurityForMetal(String metal, String requested, String existingValue) {
        String value = requested == null ? "" : requested.trim();
        if (value.isBlank()) return "";
        for (String option : purityOptionsForMetal(metal)) {
            if (option.equalsIgnoreCase(value)) return option;
        }
        if (existingValue != null && existingValue.equalsIgnoreCase(value)) {
            return existingValue.trim();
        }
        throw new IllegalArgumentException(
                "Purity/type '" + value + "' is not valid for " + metal
                        + ". Choose one of: " + String.join(", ", purityOptionsForMetal(metal)) + ".");
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
