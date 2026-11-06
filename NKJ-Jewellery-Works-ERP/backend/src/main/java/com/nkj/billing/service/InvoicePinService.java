package com.nkj.billing.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class InvoicePinService {
    private static final int MAX_ATTEMPTS = 5;
    private static final long WINDOW_MS = 15 * 60 * 1000L;
    private static final long TICKET_TTL_MS = 90 * 1000L;

    @Value("${nkj.invoice.pin-salt}") private String configuredSalt;
    @Value("${nkj.invoice.pin-hash}") private String configuredPinHash;
    private final JdbcTemplate jdbc;
    private final SecureRandom random = new SecureRandom();
    private final Map<String, AttemptState> attempts = new ConcurrentHashMap<>();
    private final Map<String, Ticket> tickets = new ConcurrentHashMap<>();

    public InvoicePinService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public synchronized String verify(String pin, String ip, Long invoiceId) {
        requireSavedInvoice(invoiceId);
        String key = (ip == null || ip.isBlank()) ? "unknown" : ip;
        long now = System.currentTimeMillis();
        AttemptState state = attempts.getOrDefault(key, new AttemptState(0, now, 0));
        if (state.blockedUntil() > now) {
            audit("PIN_LOCKED", null, key, Map.of("blockedUntil", state.blockedUntil()));
            throw new IllegalArgumentException("Too many incorrect PIN attempts. Try again later.");
        }
        if (now - state.windowStart() > WINDOW_MS) state = new AttemptState(0, now, 0);
        boolean valid = false;
        try {
            if (pin != null && pin.matches("\\d{6}") && configuredSalt != null && configuredPinHash != null) {
                byte[] providedHash = derivePinHash(pin, Base64.getDecoder().decode(configuredSalt));
                byte[] expectedHash = Base64.getDecoder().decode(configuredPinHash);
                valid = MessageDigest.isEqual(providedHash, expectedHash);
            }
        } catch (Exception ignored) {
            valid = false;
        }
        if (!valid) {
            int count = state.count() + 1;
            long blocked = count >= MAX_ATTEMPTS ? now + WINDOW_MS : 0;
            attempts.put(key, new AttemptState(count, state.windowStart(), blocked));
            audit("PIN_FAILED", null, key, Map.of("attempt", count));
            throw new IllegalArgumentException("Incorrect invoice security PIN. " + Math.max(0, MAX_ATTEMPTS - count) + " attempts remaining.");
        }
        attempts.remove(key);
        byte[] bytes = new byte[32]; random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        tickets.put(token, new Ticket(key, now + TICKET_TTL_MS, invoiceId));
        audit("PIN_VERIFIED", invoiceId, key, Map.of("expiresAt", Instant.ofEpochMilli(now + TICKET_TTL_MS).toString()));
        return token;
    }

    public void consume(String token, String ip, Long invoiceId) {
        if (token == null || token.isBlank()) {
            throw new IllegalArgumentException("Verify the invoice security PIN before printing a saved invoice.");
        }
        Ticket ticket = tickets.remove(token);
        String key = (ip == null || ip.isBlank()) ? "unknown" : ip;
        if (ticket == null || ticket.expiresAt() < System.currentTimeMillis() ||
                !ticket.ip().equals(key) || invoiceId == null || !ticket.invoiceId().equals(invoiceId)) {
            throw new IllegalArgumentException("Invoice PIN verification expired or does not match this saved invoice. Verify the PIN again.");
        }
        requireSavedInvoice(invoiceId);
    }

    private void requireSavedInvoice(Long invoiceId) {
        if (invoiceId == null) {
            throw new IllegalArgumentException("A saved invoice is required before printing or downloading a PDF.");
        }
        Boolean exists = jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM public.invoices WHERE id = ?)",
                Boolean.class,
                invoiceId
        );
        if (!Boolean.TRUE.equals(exists)) {
            throw new IllegalArgumentException("The requested invoice is not saved or no longer exists.");
        }
    }

    private byte[] derivePinHash(String pin, byte[] salt) throws Exception {
        PBEKeySpec spec = new PBEKeySpec(pin.toCharArray(), salt, 210_000, 256);
        try {
            return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
        } finally {
            spec.clearPassword();
        }
    }

    private void audit(String action, Long recordId, String ip, Object payload) {
        try {
            jdbc.update("INSERT INTO audit_logs(actor_identity,action,module,record_id,new_value,ip_address) VALUES ('PUBLIC', ?, 'INVOICE_SECURITY', ?, CAST(? AS JSONB), ?)",
                action, recordId == null ? null : String.valueOf(recordId), new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(payload), ip);
        } catch (Exception e) {
            throw new IllegalStateException("Could not record invoice security audit event.", e);
        }
    }
    private record AttemptState(int count, long windowStart, long blockedUntil) {}
    private record Ticket(String ip, long expiresAt, Long invoiceId) {}
}
