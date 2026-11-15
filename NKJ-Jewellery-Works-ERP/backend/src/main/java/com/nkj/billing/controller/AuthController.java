package com.nkj.billing.controller;

import java.util.Map;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.jdbc.core.JdbcTemplate;

import com.nkj.billing.service.AuthService;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService auth;
    private final JdbcTemplate jdbc;
    public AuthController(AuthService auth, JdbcTemplate jdbc) {
        this.auth = auth;
        this.jdbc = jdbc;
    }

    record Login(String username, String password) {}
    record Verify(String challengeId, String code) {}
    record SessionManagerUnlock(String password) {}
    record SetupEmailStart(String username, String password) {}
    record SetupEmailVerify(String challengeId, String code) {}

    @PostMapping("/login")
    public Map<String,Object> login(@RequestBody Login x) {
        return Map.of("challengeId", auth.login(x.username(), x.password()), "requiresTotp", true);
    }
    @PostMapping("/verify")
    public Map<String,Object> verify(@RequestBody Verify x, HttpServletRequest request) {
        return Map.of("token", auth.verify(x.challengeId(), x.code(),
                request.getHeader("User-Agent"), clientIp(request)), "username", auth.getUsername());
    }
    @PostMapping("/activity")
    public Map<String,Object> activity(@RequestHeader(value="Authorization", required=false) String header) {
        if (!auth.recordActivity(ownerToken(header))) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Administrator session expired. Please sign in again.");
        }
        return Map.of("success", true);
    }

    @PostMapping("/logout")
    public Map<String,Object> logout(
            @RequestHeader(value="Authorization", required=false) String h,
            @RequestHeader(value="X-Logout-Reason", required=false) String reason) {
        if (h != null && h.startsWith("Bearer ")) {
            String token = h.substring(7);
            if (auth.valid(token)) {
                // A QR capability must not remain usable after the owner explicitly
                // signs out. In-flight mobile pages immediately become revoked.
                jdbc.update("""
                    UPDATE public.jewellery_design_upload_sessions
                       SET revoked_at=NOW()
                     WHERE created_by=?
                       AND consumed_at IS NULL
                       AND revoked_at IS NULL
                       AND expires_at > NOW()
                    """, auth.getUsername());
            }
            auth.logout(token, reason == null ? "MANUAL_LOGOUT" : reason);
        }
        return Map.of("success", true);
    }

    @GetMapping("/sessions/summary")
    public Map<String,Object> sessionSummary(@RequestHeader(value="Authorization", required=false) String header) {
        return auth.sessionSummary(ownerToken(header));
    }

    @PostMapping("/sessions/unlock")
    public Map<String,Object> unlockSessionManagement(
            @RequestHeader(value="Authorization", required=false) String header,
            @RequestBody SessionManagerUnlock body,
            HttpServletRequest request) {
        // The direct peer address is used for the attempt limiter; the forwarded header is only metadata.
        String managerToken = auth.unlockSessionManager(ownerToken(header), body.password(), request.getRemoteAddr());
        return Map.of("managerToken", managerToken, "expiresInSeconds", 300);
    }

    @GetMapping("/sessions")
    public Map<String,Object> loginHistory(
            @RequestHeader(value="Authorization", required=false) String header,
            @RequestHeader(value="X-Owner-Session-Manager", required=false) String managerToken) {
        return Map.of("sessions", auth.listLoginHistory(ownerToken(header), managerToken));
    }

    @PostMapping("/sessions/{sessionId}/logout")
    public Map<String,Object> logoutLoginSession(
            @RequestHeader(value="Authorization", required=false) String header,
            @RequestHeader(value="X-Owner-Session-Manager", required=false) String managerToken,
            @PathVariable String sessionId) {
        boolean current = auth.logoutLoginSession(ownerToken(header), managerToken, sessionId);
        revokePendingQrUploads();
        if (current) return Map.of("success", true, "currentSession", true);
        return Map.of("success", true, "currentSession", false);
    }

    @PostMapping("/sessions/logout-others")
    public Map<String,Object> logoutOtherSessions(
            @RequestHeader(value="Authorization", required=false) String header,
            @RequestHeader(value="X-Owner-Session-Manager", required=false) String managerToken) {
        int loggedOut = auth.logoutOtherLoginSessions(ownerToken(header), managerToken);
        revokePendingQrUploads();
        return Map.of("success", true, "loggedOutCount", loggedOut);
    }

    private String ownerToken(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) return "";
        return authorization.substring(7);
    }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) return forwarded.split(",")[0].trim();
        return request.getRemoteAddr();
    }

    private void revokePendingQrUploads() {
        jdbc.update("""
            UPDATE public.jewellery_design_upload_sessions
               SET revoked_at=NOW()
             WHERE created_by=?
               AND consumed_at IS NULL
               AND revoked_at IS NULL
               AND expires_at > NOW()
            """, auth.getUsername());
    }

    /** Password verification only starts the email OTP challenge; it does not create a session. */
    @GetMapping("/session")
    public Map<String,String> session(@RequestHeader(value="Authorization", required=false) String header) {
        String token = header != null && header.startsWith("Bearer ") ? header.substring(7) : "";
        if (!auth.valid(token)) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Administrator session is not valid.");
        return Map.of("username", auth.getUsername());
    }

    @PostMapping("/setup-email/start")
    public Map<String,String> startSetupEmail(@RequestBody SetupEmailStart x) {
        return auth.sendSetupEmailOtp(x.username(), x.password());
    }
    @PostMapping("/setup-email/verify")
    public Map<String,String> verifySetupEmail(@RequestBody SetupEmailVerify x) {
        return Map.of("setupToken", auth.verifySetupEmailOtp(x.challengeId(), x.code()));
    }
    @GetMapping("/setup-uri")
    public Map<String,String> setup(@RequestHeader(value="X-Setup-Token", required=false) String token) {
        return Map.of("otpauthUri", auth.setupUri(token));
    }
}
