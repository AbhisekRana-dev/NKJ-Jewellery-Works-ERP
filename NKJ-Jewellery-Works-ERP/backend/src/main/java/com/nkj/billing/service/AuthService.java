package com.nkj.billing.service;

import com.warrenstrange.googleauth.GoogleAuthenticator;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.jdbc.core.JdbcTemplate;

@Service
public class AuthService {
    private static final long CHALLENGE_TTL_MILLIS = 2 * 60 * 1000L;
    private static final long SESSION_TTL_MILLIS = 8 * 60 * 60 * 1000L;
    private static final long SETUP_OTP_TTL_MILLIS = 5 * 60 * 1000L;
    private static final long SETUP_TOKEN_TTL_MILLIS = 10 * 60 * 1000L;
    private static final long SESSION_MANAGER_GRANT_TTL_MILLIS = 5 * 60 * 1000L;
    private static final long SESSION_ACTIVITY_WRITE_INTERVAL_MILLIS = 30 * 1000L;
    private static final long IDLE_EXPIRY_REASON_TTL_MILLIS = 60 * 1000L;
    private static final long SESSION_MANAGER_LOCK_MILLIS = 15 * 60 * 1000L;
    private static final int MAX_SESSION_MANAGER_ATTEMPTS = 5;

    @Value("${nkj.admin.username:admin2026}") private String username;
    @Value("${nkj.auth.session-idle-timeout-ms:600000}") private long sessionIdleTimeoutMillis = 600_000L;
    @Value("${nkj.admin.password:}") private String password;
    @Value("${nkj.admin.session-manager-password:}") private String sessionManagerPassword;
    @Value("${nkj.totp.secret:}") private String secret;
    @Value("${nkj.setup.email:rabhisek2030@gmail.com}") private String setupEmail;
    @Value("${nkj.setup.mail-from:}") private String mailFrom;
    @Value("${spring.mail.username:}") private String smtpUsername;
    @Value("${nkj.setup.emailjs.public-key:}") private String emailJsPublicKey;
    @Value("${nkj.setup.emailjs.private-key:}") private String emailJsPrivateKey;
    @Value("${nkj.setup.emailjs.service-id:}") private String emailJsServiceId;
    @Value("${nkj.setup.emailjs.template-id:}") private String emailJsTemplateId;

    private final GoogleAuthenticator authenticator = new GoogleAuthenticator();
    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final ObjectMapper objectMapper;
    private final JdbcTemplate jdbc;
    private final HttpClient emailHttpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10)).build();
    private final Map<String, Long> challenges = new ConcurrentHashMap<>();
    private final Map<String, SessionState> sessions = new ConcurrentHashMap<>();
    private final Map<String, Long> idleExpiredTokenHashes = new ConcurrentHashMap<>();
    private final Map<String, SetupOtp> setupOtps = new ConcurrentHashMap<>();
    private final Map<String, Long> setupTokens = new ConcurrentHashMap<>();
    private final Map<String, ManagerGrant> sessionManagerGrants = new ConcurrentHashMap<>();
    private final Map<String, ManagerAttempt> sessionManagerAttempts = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();

    private record SetupOtp(String codeHash, long expiresAt) {}
    private record ManagerGrant(String ownerSessionId, long expiresAt) {}

    private static final class SessionState {
        private final String id;
        private final long expiresAt;
        private volatile long lastActivityAt;
        private volatile long lastActivityPersistedAt;
        private SessionState(String id, long expiresAt, long now) {
            this.id = id;
            this.expiresAt = expiresAt;
            this.lastActivityAt = now;
            this.lastActivityPersistedAt = now;
        }
    }
    private static final class ManagerAttempt {
        private int failures;
        private long lockedUntil;
    }

    public AuthService(ObjectProvider<JavaMailSender> mailSenderProvider, ObjectMapper objectMapper, JdbcTemplate jdbc) {
        this.mailSenderProvider = mailSenderProvider;
        this.objectMapper = objectMapper;
        this.jdbc = jdbc;
    }

    public String login(String suppliedUsername, String suppliedPassword) {
        requireConfigured();
        validateCredentials(suppliedUsername, suppliedPassword);
        long now = System.currentTimeMillis();
        challenges.entrySet().removeIf(entry -> entry.getValue() < now);
        String challengeId = randomToken();
        challenges.put(challengeId, now + CHALLENGE_TTL_MILLIS);
        return challengeId;
    }

    public String verify(String challengeId, String code) {
        return verify(challengeId, code, "", "");
    }

    public String verify(String challengeId, String code, String userAgent, String ipAddress) {
        requireConfigured();
        if (challengeId == null || challengeId.isBlank()) throw new IllegalArgumentException("Your login challenge is missing. Please sign in again.");
        Long challengeExpiresAt = challenges.remove(challengeId);
        long now = System.currentTimeMillis();
        if (challengeExpiresAt == null || challengeExpiresAt < now) throw new IllegalArgumentException("Login challenge expired. Please sign in again.");
        if (code == null || !code.matches("\\d{6}")) throw new IllegalArgumentException("Enter a valid 6-digit authenticator code.");
        final int otp;
        try { otp = Integer.parseInt(code); }
        catch (NumberFormatException ex) { throw new IllegalArgumentException("Enter a valid 6-digit authenticator code."); }
        if (!authenticator.authorize(secret, otp)) throw new IllegalArgumentException("Incorrect or expired authenticator code.");

        String token = randomToken();
        UUID sessionId = UUID.randomUUID();
        long expiresAt = now + SESSION_TTL_MILLIS;
        String safeAgent = limitText(userAgent, 512);
        jdbc.update("""
            INSERT INTO owner_login_sessions
                (id, token_hash, username, device_label, ip_address, user_agent,
                 created_at, last_active_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), ?)
            """,
            sessionId, sha256(token), username, describeDevice(safeAgent),
            nullableText(limitText(ipAddress, 64)), nullableText(safeAgent),
            Timestamp.from(Instant.ofEpochMilli(expiresAt)));
        sessions.put(token, new SessionState(sessionId.toString(), expiresAt, now));
        return token;
    }

    /** First-time authenticator setup is gated by an email OTP to the fixed owner mailbox. */
    public Map<String,String> sendSetupEmailOtp(String suppliedUsername, String suppliedPassword) {
        validateCredentials(suppliedUsername, suppliedPassword);
        requireTotpSecret();
        boolean anyEmailJsSetting = hasText(emailJsPublicKey) || hasText(emailJsPrivateKey)
                || hasText(emailJsServiceId) || hasText(emailJsTemplateId);
        boolean emailJsConfigured = hasText(emailJsPublicKey) && hasText(emailJsPrivateKey)
                && hasText(emailJsServiceId) && hasText(emailJsTemplateId);
        if (anyEmailJsSetting && !emailJsConfigured) {
            throw new IllegalStateException("EmailJS configuration is incomplete. Set EMAILJS_PUBLIC_KEY, EMAILJS_PRIVATE_KEY, EMAILJS_SERVICE_ID and EMAILJS_TEMPLATE_ID.");
        }

        JavaMailSender sender = null;
        if (!emailJsConfigured) {
            sender = mailSenderProvider.getIfAvailable();
            if (sender == null || !hasText(smtpUsername)) {
                throw new IllegalStateException("Email OTP is not configured. Configure EmailJS over HTTPS or SMTP for local development.");
            }
        }

        String code = String.format("%06d", random.nextInt(1_000_000));
        String challengeId = randomToken();
        long expiresAt = System.currentTimeMillis() + SETUP_OTP_TTL_MILLIS;
        setupOtps.put(challengeId, new SetupOtp(sha256(code), expiresAt));
        setupOtps.entrySet().removeIf(entry -> entry.getValue().expiresAt() < System.currentTimeMillis());
        try {
            if (emailJsConfigured) {
                sendSetupOtpWithEmailJs(code);
            } else {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setFrom(hasText(mailFrom) ? mailFrom : smtpUsername);
                message.setTo(setupEmail);
                message.setSubject("Nandikishor Jewellery Works - First-time security setup OTP");
                message.setText("Your first-time security setup OTP is " + code + ". It expires in 5 minutes. If you did not request this, ignore this email.");
                sender.send(message);
            }
        } catch (Exception ex) {
            setupOtps.remove(challengeId);
            throw new IllegalStateException("Could not send the setup OTP. Check the configured email provider and try again.", ex);
        }
        return Map.of("challengeId", challengeId, "destination", maskEmail(setupEmail), "expiresInSeconds", "300");
    }

    private void sendSetupOtpWithEmailJs(String code) throws Exception {
        Map<String, Object> templateParams = Map.of(
                "to_email", setupEmail,
                "otp_code", code,
                "shop_name", "Nandikishor Jewellery Works",
                "expiry_minutes", "5"
        );
        Map<String, Object> payload = Map.of(
                "service_id", emailJsServiceId,
                "template_id", emailJsTemplateId,
                "user_id", emailJsPublicKey,
                "accessToken", emailJsPrivateKey,
                "template_params", templateParams
        );

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("https://api.emailjs.com/api/v1.0/email/send"))
                .timeout(Duration.ofSeconds(20))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
                .build();
        HttpResponse<String> response = emailHttpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException("EmailJS rejected the setup OTP request (HTTP "
                    + response.statusCode() + "). Check the EmailJS service, template and keys.");
        }
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    public String verifySetupEmailOtp(String challengeId, String code) {
        if (challengeId == null || challengeId.isBlank() || code == null || !code.matches("\\d{6}"))
            throw new IllegalArgumentException("Enter the 6-digit email OTP.");
        SetupOtp challenge = setupOtps.remove(challengeId);
        if (challenge == null || challenge.expiresAt() < System.currentTimeMillis())
            throw new IllegalArgumentException("Email OTP expired. Start the setup again.");
        if (!constantTimeEquals(challenge.codeHash(), sha256(code)))
            throw new IllegalArgumentException("Incorrect email OTP.");
        String token = randomToken();
        setupTokens.put(token, System.currentTimeMillis() + SETUP_TOKEN_TTL_MILLIS);
        return token;
    }

    public String setupUri(String setupToken) {
        if (setupToken == null || setupToken.isBlank()) throw new IllegalArgumentException("Verify the owner email OTP before generating the authenticator QR code.");
        Long expires = setupTokens.get(setupToken);
        if (expires == null || expires < System.currentTimeMillis()) {
            setupTokens.remove(setupToken);
            throw new IllegalArgumentException("Setup authorization expired. Verify the email OTP again.");
        }
        requireTotpSecret();
        String issuer = URLEncoder.encode("Nandikishor Jewellery Works", StandardCharsets.UTF_8).replace("+", "%20");
        String account = URLEncoder.encode(username, StandardCharsets.UTF_8).replace("+", "%20");
        return "otpauth://totp/" + issuer + ":" + account + "?secret=" + secret + "&issuer=" + issuer + "&digits=6&period=30";
    }

    /**
     * Validate a bearer session without treating an API request as user activity.
     * Background polling and ordinary protected reads cannot keep a session alive.
     */
    public boolean valid(String token) {
        if (token == null || token.isBlank()) return false;
        SessionState state = sessions.get(token);
        if (state == null) return false;
        long now = System.currentTimeMillis();
        if (now > state.expiresAt) {
            endSession(token, state);
            return false;
        }
        if (now - state.lastActivityAt >= sessionIdleTimeoutMillis) {
            idleExpiredTokenHashes.entrySet().removeIf(entry -> entry.getValue() < now);
            idleExpiredTokenHashes.put(sha256(token), now + IDLE_EXPIRY_REASON_TTL_MILLIS);
            endSession(token, state);
            return false;
        }
        return sessions.get(token) == state;
    }

    /**
     * Extends the idle window only after explicit user-generated activity.
     * The persisted last_active_at field is throttled to avoid excessive writes.
     */
    public boolean recordActivity(String token) {
        if (!valid(token)) return false;
        SessionState state = sessions.get(token);
        if (state == null) return false;
        long now = System.currentTimeMillis();
        if (sessions.get(token) != state || !isSessionActive(state, now)) return false;

        state.lastActivityAt = now;
        if (now - state.lastActivityPersistedAt >= SESSION_ACTIVITY_WRITE_INTERVAL_MILLIS) {
            int updated = jdbc.update(
                    "UPDATE owner_login_sessions SET last_active_at=NOW() WHERE id=? AND logged_out_at IS NULL AND expires_at > NOW()",
                    UUID.fromString(state.id));
            if (updated == 0) {
                endSession(token, state);
                return false;
            }
            state.lastActivityPersistedAt = now;
        }
        return true;
    }

    private boolean isSessionActive(SessionState state, long now) {
        return state != null
                && now <= state.expiresAt
                && now - state.lastActivityAt < sessionIdleTimeoutMillis;
    }

    /**
     * Returns the short-lived inactivity reason for the rejected bearer token.
     * Keep it readable for the full TTL: multiple in-flight requests can all
     * receive 401 after the same idle expiry and must report the same reason.
     */
    public boolean wasIdleExpired(String token) {
        if (token == null || token.isBlank()) return false;
        String tokenHash = sha256(token);
        Long expiresAt = idleExpiredTokenHashes.get(tokenHash);
        if (expiresAt == null) return false;
        if (expiresAt < System.currentTimeMillis()) {
            idleExpiredTokenHashes.remove(tokenHash, expiresAt);
            return false;
        }
        return true;
    }

    public long getLastActivityAt(String token) {
        if (!valid(token)) return 0L;
        SessionState state = sessions.get(token);
        return state == null ? 0L : state.lastActivityAt;
    }

    private void endSession(String token, SessionState state) {
        if (state == null || !sessions.remove(token, state)) return;
        jdbc.update(
                "UPDATE owner_login_sessions SET logged_out_at=COALESCE(logged_out_at,NOW()) WHERE id=?",
                UUID.fromString(state.id));
        sessionManagerGrants.entrySet().removeIf(entry -> entry.getValue().ownerSessionId().equals(state.id));
    }

    public void logout(String token) {
        if (token == null || token.isBlank()) return;
        SessionState state = sessions.remove(token);
        if (state != null) {
            jdbc.update("UPDATE owner_login_sessions SET logged_out_at=COALESCE(logged_out_at,NOW()), last_active_at=NOW() WHERE id=?",
                    UUID.fromString(state.id));
            sessionManagerGrants.entrySet().removeIf(entry -> entry.getValue().ownerSessionId().equals(state.id));
        }
    }

    public String getUsername() { return username; }

    public Map<String, Object> sessionSummary(String ownerToken) {
        requireCurrentSession(ownerToken);
        long now = System.currentTimeMillis();
        int activeCount = (int) sessions.values().stream()
                .filter(state -> isSessionActive(state, now))
                .map(state -> state.id).distinct().count();
        Long historyCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM owner_login_sessions WHERE username=? AND created_at >= NOW() - INTERVAL '30 days'",
                Long.class, username);
        return Map.of("activeCount", activeCount, "historyCount", historyCount == null ? 0L : historyCount, "maxActive", 0);
    }

    public String unlockSessionManager(String ownerToken, String suppliedPassword, String attemptKey) {
        SessionState ownerSession = requireCurrentSession(ownerToken);
        if (sessionManagerPassword == null || sessionManagerPassword.isBlank()) {
            throw new IllegalStateException("Owner session management password is not configured on the backend.");
        }
        String key = username + "|" + (hasText(attemptKey) ? attemptKey : "unknown-client");
        ManagerAttempt attempt = sessionManagerAttempts.computeIfAbsent(key, ignored -> new ManagerAttempt());
        long now = System.currentTimeMillis();
        synchronized (attempt) {
            if (attempt.lockedUntil > now) {
                throw new IllegalArgumentException("Too many incorrect attempts. Try again in 15 minutes.");
            }
            if (!constantTimeEquals(sessionManagerPassword, suppliedPassword)) {
                attempt.failures++;
                if (attempt.failures >= MAX_SESSION_MANAGER_ATTEMPTS) {
                    attempt.failures = 0;
                    attempt.lockedUntil = now + SESSION_MANAGER_LOCK_MILLIS;
                }
                throw new IllegalArgumentException("Incorrect owner login-management password.");
            }
            attempt.failures = 0;
            attempt.lockedUntil = 0;
        }
        sessionManagerGrants.entrySet().removeIf(entry -> entry.getValue().expiresAt() < now);
        String grant = randomToken();
        sessionManagerGrants.put(grant, new ManagerGrant(ownerSession.id, now + SESSION_MANAGER_GRANT_TTL_MILLIS));
        return grant;
    }

    public List<Map<String, Object>> listLoginHistory(String ownerToken, String managerToken) {
        requireSessionManager(ownerToken, managerToken);
        SessionState current = requireCurrentSession(ownerToken);
        List<Map<String, Object>> result = new ArrayList<>();
        List<Map<String, Object>> rows = jdbc.queryForList("""
            SELECT id, username, device_label, ip_address, created_at, last_active_at,
                   expires_at, logged_out_at
              FROM owner_login_sessions
             WHERE username=?
             ORDER BY created_at DESC
             LIMIT 50
            """, username);
        for (Map<String, Object> row : rows) {
            String id = String.valueOf(row.get("id"));
            SessionState activeState = findActiveSessionById(id);
            Object loggedOutAt = row.get("logged_out_at");
            Object expiresAt = row.get("expires_at");
            String status;
            if (loggedOutAt != null) status = "LOGGED_OUT";
            else if (activeState != null) status = "ACTIVE";
            else if (isExpiredTimestamp(expiresAt)) status = "EXPIRED";
            else status = "ENDED";

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("sessionId", id);
            item.put("username", row.get("username"));
            item.put("device", row.get("device_label"));
            item.put("ipAddress", row.get("ip_address"));
            item.put("loginAt", isoTimestamp(row.get("created_at")));
            item.put("lastActiveAt", isoTimestamp(row.get("last_active_at")));
            item.put("expiresAt", isoTimestamp(expiresAt));
            item.put("loggedOutAt", isoTimestamp(loggedOutAt));
            item.put("status", status);
            item.put("current", current.id.equals(id));
            result.add(item);
        }
        return result;
    }

    public boolean logoutLoginSession(String ownerToken, String managerToken, String sessionId) {
        requireSessionManager(ownerToken, managerToken);
        final UUID id;
        try { id = UUID.fromString(sessionId); }
        catch (Exception ex) { throw new IllegalArgumentException("Invalid login session."); }
        Integer exists = jdbc.queryForObject(
                "SELECT COUNT(*) FROM owner_login_sessions WHERE id=? AND username=?",
                Integer.class, id, username);
        if (exists == null || exists == 0) throw new IllegalArgumentException("Login session was not found.");
        SessionState current = requireCurrentSession(ownerToken);
        boolean currentSession = current.id.equals(sessionId);
        sessions.entrySet().removeIf(entry -> entry.getValue().id.equals(sessionId));
        sessionManagerGrants.entrySet().removeIf(entry -> entry.getValue().ownerSessionId().equals(sessionId));
        jdbc.update("UPDATE owner_login_sessions SET logged_out_at=COALESCE(logged_out_at,NOW()), last_active_at=NOW() WHERE id=? AND username=?",
                id, username);
        return currentSession;
    }

    /**
     * Permanently removes an ended login-history row. Active sessions must be
     * signed out first so deleting history can never be used to revoke by accident.
     */
    public void deleteLoginHistoryEntry(String ownerToken, String managerToken, String sessionId) {
        requireSessionManager(ownerToken, managerToken);
        final UUID id;
        try { id = UUID.fromString(sessionId); }
        catch (Exception ex) { throw new IllegalArgumentException("Invalid login session."); }

        SessionState current = requireCurrentSession(ownerToken);
        if (current.id.equals(sessionId)) {
            throw new IllegalArgumentException("You cannot delete the current login session.");
        }

        long now = System.currentTimeMillis();
        sessions.entrySet().removeIf(entry -> !isSessionActive(entry.getValue(), now));
        boolean active = sessions.values().stream()
                .anyMatch(state -> state.id.equals(sessionId) && isSessionActive(state, now));
        if (active) {
            throw new IllegalArgumentException("Log out this device before deleting its login history.");
        }

        // Session activity is authoritative in the in-memory session registry above.
        // A record can be displayed as ENDED after a process restart even when its
        // database logged_out_at is still NULL and expires_at is in the future.
        // Once it is confirmed absent from the active registry, allow its history row
        // to be permanently deleted for this authenticated owner.
        int deleted = jdbc.update("""
            DELETE FROM owner_login_sessions
             WHERE id = ?
               AND username = ?
            """, id, username);
        if (deleted == 0) {
            throw new IllegalArgumentException("Only logged-out or expired login history can be deleted.");
        }
        sessionManagerGrants.entrySet().removeIf(entry -> entry.getValue().ownerSessionId().equals(sessionId));
    }

    public int logoutOtherLoginSessions(String ownerToken, String managerToken) {
        requireSessionManager(ownerToken, managerToken);
        SessionState current = requireCurrentSession(ownerToken);
        int activeBefore = (int) sessions.values().stream()
                .filter(state -> !state.id.equals(current.id) && isSessionActive(state, System.currentTimeMillis()))
                .map(state -> state.id).distinct().count();
        sessions.entrySet().removeIf(entry -> !entry.getValue().id.equals(current.id));
        sessionManagerGrants.entrySet().removeIf(entry -> !entry.getValue().ownerSessionId().equals(current.id));
        jdbc.update("""
            UPDATE owner_login_sessions
               SET logged_out_at=COALESCE(logged_out_at,NOW()), last_active_at=NOW()
             WHERE username=? AND id<>? AND logged_out_at IS NULL
            """, username, UUID.fromString(current.id));
        return activeBefore;
    }

    private SessionState requireCurrentSession(String ownerToken) {
        if (!valid(ownerToken)) throw new IllegalArgumentException("Your owner login has expired. Sign in again.");
        return sessions.get(ownerToken);
    }

    private void requireSessionManager(String ownerToken, String managerToken) {
        SessionState ownerSession = requireCurrentSession(ownerToken);
        ManagerGrant grant = managerToken == null ? null : sessionManagerGrants.get(managerToken);
        if (grant == null || grant.expiresAt() < System.currentTimeMillis()
                || !grant.ownerSessionId().equals(ownerSession.id)) {
            if (managerToken != null) sessionManagerGrants.remove(managerToken);
            throw new IllegalArgumentException("Unlock owner login management again to continue.");
        }
    }

    private SessionState findActiveSessionById(String id) {
        long now = System.currentTimeMillis();
        return sessions.values().stream()
                .filter(state -> state.id.equals(id) && isSessionActive(state, now))
                .findFirst().orElse(null);
    }

    private String describeDevice(String userAgent) {
        if (!hasText(userAgent)) return "Unknown device";
        String ua = userAgent.toLowerCase();
        String browser = ua.contains("edg/") ? "Microsoft Edge"
                : ua.contains("firefox/") ? "Firefox"
                : ua.contains("chrome/") && !ua.contains("chromium") ? "Chrome"
                : ua.contains("safari/") && !ua.contains("chrome/") ? "Safari" : "Browser";
        String os = ua.contains("windows") ? "Windows"
                : ua.contains("android") ? "Android"
                : ua.contains("iphone") || ua.contains("ipad") ? "iOS"
                : ua.contains("mac os") || ua.contains("macintosh") ? "macOS"
                : ua.contains("linux") ? "Linux" : "Unknown OS";
        return browser + " on " + os;
    }

    private boolean isExpiredTimestamp(Object value) {
        if (value instanceof Timestamp timestamp) return timestamp.getTime() < System.currentTimeMillis();
        if (value instanceof OffsetDateTime timestamp) return timestamp.isBefore(OffsetDateTime.now());
        if (value instanceof Instant timestamp) return timestamp.isBefore(Instant.now());
        try { return value != null && OffsetDateTime.parse(String.valueOf(value)).isBefore(OffsetDateTime.now()); }
        catch (Exception ignored) { return false; }
    }

    private String isoTimestamp(Object value) {
        if (value instanceof Timestamp timestamp) return timestamp.toInstant().toString();
        if (value instanceof OffsetDateTime timestamp) return timestamp.toInstant().toString();
        if (value instanceof Instant timestamp) return timestamp.toString();
        return value == null ? null : String.valueOf(value);
    }

    private String nullableText(String value) { return hasText(value) ? value : null; }

    private String limitText(String value, int maxLength) {
        if (value == null) return "";
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }

    /**
     * Re-authenticate the administrator before posting a sensitive financial
     * receipt. The password is compared in constant time and is never stored.
     */
    public void verifyAdminPassword(String suppliedPassword) {
        if (password == null || password.isBlank()) {
            throw new IllegalStateException("Administrator password is not configured. Set ADMIN_PASSWORD in backend/.env.");
        }
        if (suppliedPassword == null || suppliedPassword.isBlank()) {
            throw new IllegalArgumentException("Enter the administrator password to confirm this receipt.");
        }
        if (!constantTimeEquals(password, suppliedPassword)) {
            throw new IllegalArgumentException("Incorrect administrator password. The receipt was not saved.");
        }
    }

    public boolean credentials(String suppliedUsername, String suppliedPassword) {
        try { validateCredentials(suppliedUsername, suppliedPassword); return true; }
        catch (RuntimeException ex) { return false; }
    }

    private void validateCredentials(String suppliedUsername, String suppliedPassword) {
        if (username == null || username.isBlank() || password == null || password.isBlank())
            throw new IllegalStateException("Administrator credentials are not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD in backend/.env.");
        if (!constantTimeEquals(username, suppliedUsername) || !constantTimeEquals(password, suppliedPassword))
            throw new IllegalArgumentException("Invalid username or password.");
    }
    private void requireConfigured() { validateCredentials(username, password); requireTotpSecret(); }
    private void requireTotpSecret() {
        if (secret == null || !secret.matches("[A-Z2-7]{16,64}"))
            throw new IllegalStateException("TOTP_SECRET must be a unique Base32 secret of 16-64 characters in backend/.env.");
    }
    private String randomToken() {
        byte[] bytes = new byte[32]; random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
    private String sha256(String value) {
        try { return Base64.getEncoder().encodeToString(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (Exception ex) { throw new IllegalStateException("SHA-256 unavailable.", ex); }
    }
    private boolean constantTimeEquals(String expected, String supplied) {
        if (expected == null || supplied == null) return false;
        return MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), supplied.getBytes(StandardCharsets.UTF_8));
    }
    private String maskEmail(String email) {
        int at = email.indexOf('@');
        if (at <= 1) return "***" + (at >= 0 ? email.substring(at) : "");
        return email.substring(0, 1) + "***" + email.substring(at);
    }
}
