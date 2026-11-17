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

    /**
     * Issue a one-time ticket for either saving/updating or printing an invoice.
     * SAVE tickets may be unbound for a new invoice or bound to an existing
     * invoice ID for an edit. PRINT tickets must always target a saved invoice.
     */
    public synchronized String verify(String pin, String ip, Long invoiceId) {
        return verify(pin, ip, invoiceId, "PRINT");
    }

    public synchronized String verify(String pin, String ip, Long invoiceId, String requestedPurpose) {
        return verify(pin, ip, invoiceId, requestedPurpose, null);
    }

    public synchronized String verify(String pin, String ip, Long invoiceId,
                                      String requestedPurpose, String idempotencyKey) {
        String purpose = requestedPurpose == null || requestedPurpose.isBlank()
                ? "PRINT" : requestedPurpose.trim().toUpperCase(java.util.Locale.ROOT);
        if (!"PRINT".equals(purpose) && !"SAVE".equals(purpose)) {
            throw new IllegalArgumentException("Unsupported invoice PIN purpose.");
        }
        if ("PRINT".equals(purpose) && invoiceId == null) {
            throw new IllegalArgumentException("A saved invoice is required before printing or downloading a PDF.");
        }
        if (invoiceId != null) requireSavedInvoice(invoiceId);

        final String binding;
        if ("SAVE".equals(purpose) && invoiceId == null) {
            String key = idempotencyKey == null ? "" : idempotencyKey.trim();
            if (!key.matches("[A-Za-z0-9._:-]{1,120}")) {
                throw new IllegalArgumentException("A valid invoice save request key is required for PIN verification.");
            }
            binding = "IDEMPOTENCY:" + key;
        } else if (invoiceId != null) {
            binding = "INVOICE:" + invoiceId;
        } else {
            binding = "";
        }
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
        tickets.put(token, new Ticket(key, now + TICKET_TTL_MS, invoiceId, purpose, binding));
        audit("PIN_VERIFIED", invoiceId, key, Map.of(
                "purpose", purpose,
                "expiresAt", Instant.ofEpochMilli(now + TICKET_TTL_MS).toString()
        ));
        return token;
    }

    public void consume(String token, String ip, Long invoiceId) {
        if (token == null || token.isBlank()) {
            throw new IllegalArgumentException("Verify the invoice security PIN before printing a saved invoice.");
        }
        Ticket ticket = tickets.remove(token);
        String key = (ip == null || ip.isBlank()) ? "unknown" : ip;
        if (ticket == null || ticket.expiresAt() < System.currentTimeMillis() ||
                !"PRINT".equals(ticket.purpose()) || !ticket.ip().equals(key) ||
                invoiceId == null || !invoiceId.equals(ticket.invoiceId()) ||
                !("INVOICE:" + invoiceId).equals(ticket.binding())) {
            throw new IllegalArgumentException("Invoice PIN verification expired or does not match this saved invoice. Verify the PIN again.");
        }
        requireSavedInvoice(invoiceId);
    }

    /**
     * Consume the one-time PIN ticket immediately before a new invoice is
     * inserted or a saved invoice is updated. The ticket is bound to the
     * intended existing invoice ID for edits, or null for a new invoice.
     */
    public void consumeForSave(String token, String ip, Long invoiceId, String idempotencyKey) {
        if (token == null || token.isBlank()) {
            throw new IllegalArgumentException("Verify the invoice security PIN before saving this invoice.");
        }
        Ticket ticket = tickets.remove(token);
        String key = (ip == null || ip.isBlank()) ? "unknown" : ip;
        String expectedBinding;
        if (invoiceId == null) {
            String requestKey = idempotencyKey == null ? "" : idempotencyKey.trim();
            expectedBinding = "IDEMPOTENCY:" + requestKey;
        } else {
            expectedBinding = "INVOICE:" + invoiceId;
        }
        if (ticket == null || ticket.expiresAt() < System.currentTimeMillis() ||
                !"SAVE".equals(ticket.purpose()) || !ticket.ip().equals(key) ||
                !java.util.Objects.equals(ticket.invoiceId(), invoiceId) ||
                !expectedBinding.equals(ticket.binding())) {
            throw new IllegalArgumentException("Invoice PIN verification expired or does not match this save request. Verify the PIN again.");
        }
        if (invoiceId != null) requireSavedInvoice(invoiceId);
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
    private record Ticket(String ip, long expiresAt, Long invoiceId, String purpose, String binding) {}
}
