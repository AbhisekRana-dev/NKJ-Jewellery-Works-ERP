package com.nkj.billing.service;

import com.warrenstrange.googleauth.GoogleAuthenticator;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AuthService {
    private static final long CHALLENGE_TTL_MILLIS = 2 * 60 * 1000L;
    private static final long SESSION_TTL_MILLIS = 8 * 60 * 60 * 1000L;
    private static final long SETUP_OTP_TTL_MILLIS = 5 * 60 * 1000L;
    private static final long SETUP_TOKEN_TTL_MILLIS = 10 * 60 * 1000L;

    @Value("${nkj.admin.username:admin2026}") private String username;
    @Value("${nkj.admin.password:}") private String password;
    @Value("${nkj.totp.secret:}") private String secret;
    @Value("${nkj.setup.email:rabhisek2030@gmail.com}") private String setupEmail;
    @Value("${nkj.setup.mail-from:}") private String mailFrom;
    @Value("${spring.mail.username:}") private String smtpUsername;

    private final GoogleAuthenticator authenticator = new GoogleAuthenticator();
    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final Map<String, Long> challenges = new ConcurrentHashMap<>();
    private final Map<String, Long> sessions = new ConcurrentHashMap<>();
    private final Map<String, SetupOtp> setupOtps = new ConcurrentHashMap<>();
    private final Map<String, Long> setupTokens = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();

    private record SetupOtp(String codeHash, long expiresAt) {}

    public AuthService(ObjectProvider<JavaMailSender> mailSenderProvider) {
        this.mailSenderProvider = mailSenderProvider;
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
        requireConfigured();
        if (challengeId == null || challengeId.isBlank()) throw new IllegalArgumentException("Your login challenge is missing. Please sign in again.");
        Long expiresAt = challenges.remove(challengeId);
        if (expiresAt == null || expiresAt < System.currentTimeMillis()) throw new IllegalArgumentException("Login challenge expired. Please sign in again.");
        if (code == null || !code.matches("\\d{6}")) throw new IllegalArgumentException("Enter a valid 6-digit authenticator code.");
        final int otp;
        try { otp = Integer.parseInt(code); }
        catch (NumberFormatException ex) { throw new IllegalArgumentException("Enter a valid 6-digit authenticator code."); }
        if (!authenticator.authorize(secret, otp)) throw new IllegalArgumentException("Incorrect or expired authenticator code.");
        String token = randomToken();
        sessions.put(token, System.currentTimeMillis() + SESSION_TTL_MILLIS);
        return token;
    }

    /** First-time authenticator setup is gated by an email OTP to the fixed owner mailbox. */
    public Map<String,String> sendSetupEmailOtp(String suppliedUsername, String suppliedPassword) {
        validateCredentials(suppliedUsername, suppliedPassword);
        requireTotpSecret();
        JavaMailSender sender = mailSenderProvider.getIfAvailable();
        if (sender == null || smtpUsername == null || smtpUsername.isBlank()) {
            throw new IllegalStateException("Email OTP is not configured. Add SMTP_HOST, SMTP_USERNAME and SMTP_PASSWORD to backend/.env, then restart the backend.");
        }
        String code = String.format("%06d", random.nextInt(1_000_000));
        String challengeId = randomToken();
        long expiresAt = System.currentTimeMillis() + SETUP_OTP_TTL_MILLIS;
        setupOtps.put(challengeId, new SetupOtp(sha256(code), expiresAt));
        setupOtps.entrySet().removeIf(entry -> entry.getValue().expiresAt() < System.currentTimeMillis());
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(mailFrom == null || mailFrom.isBlank() ? smtpUsername : mailFrom);
            message.setTo(setupEmail);
            message.setSubject("Nandikishor Jewellery Works - First-time security setup OTP");
            message.setText("Your first-time security setup OTP is " + code + ". It expires in 5 minutes. If you did not request this, ignore this email.");
            sender.send(message);
        } catch (Exception ex) {
            setupOtps.remove(challengeId);
            throw new IllegalStateException("Could not send the setup OTP. Check SMTP settings and try again.", ex);
        }
        return Map.of("challengeId", challengeId, "destination", maskEmail(setupEmail), "expiresInSeconds", "300");
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

    public boolean valid(String token) {
        if (token == null || token.isBlank()) return false;
        Long expiresAt = sessions.get(token);
        if (expiresAt == null) return false;
        if (expiresAt < System.currentTimeMillis()) { sessions.remove(token, expiresAt); return false; }
        return true;
    }
    public void logout(String token) { if (token != null && !token.isBlank()) sessions.remove(token); }
    public String getUsername() { return username; }
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
