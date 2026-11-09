package com.nkj.billing.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Date;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Source-aware cash ledger. Direction is derived from the source module and
 * the operation being recorded; callers cannot infer it from a display name.
 * Amounts are always stored as positive values. Direction supplies the sign.
 */
@Service
public class CashFlowService {
    private static final ZoneId SHOP_ZONE = ZoneId.of("Asia/Kolkata");
    private static final Set<String> PAYMENT_METHODS =
            Set.of("Cash", "UPI", "Bank Transfer", "Card", "Cheque", "NEFT", "RTGS", "Other");

    private final JdbcTemplate jdbc;
    private final AuthService auth;

    public CashFlowService(JdbcTemplate jdbc, AuthService auth) {
        this.jdbc = jdbc;
        this.auth = auth;
    }

    private String directionFor(String sourceModule, String operation) {
        String key = sourceModule.toUpperCase(Locale.ROOT) + ":" + operation.toUpperCase(Locale.ROOT);
        return switch (key) {
            case "INVOICE:INITIAL_COLLECTION",
                 "PAYMENTS:CUSTOMER_RECEIPT",
                 "PRE_BOOKINGS:ADVANCE_RECEIPT",
                 "INSTALLMENTS:DOWN_PAYMENT",
                 "INSTALLMENTS:INSTALLMENT_RECEIPT" -> "INCOMING";
            case "EXPENSES:EXPENSE_PAYMENT",
                 "PURCHASES:SUPPLIER_PAYMENT",
                 "SALARY:INITIAL_SALARY_PAYMENT",
                 "SALARY_PAYMENTS:SALARY_PAYMENT",
                 "REFUNDS:CUSTOMER_REFUND" -> "OUTGOING";
            default -> throw new IllegalArgumentException(
                    "Unsupported cash operation: " + sourceModule + " / " + operation);
        };
    }

    @Transactional
    public Long recordMovement(
            String sourceModule,
            String operation,
            long sourceRecordId,
            String sourceEventKey,
            LocalDate transactionDate,
            BigDecimal rawAmount,
            String partyName,
            String description,
            String paymentMethod,
            String referenceNo,
            String sourceReference,
            String idempotencyKey,
            Long originalTransactionId) {

        BigDecimal amount = rawAmount == null ? BigDecimal.ZERO
                : rawAmount.setScale(2, RoundingMode.HALF_UP);
        if (amount.signum() <= 0) return null;

        String direction = directionFor(sourceModule, operation);
        String eventKey = sourceEventKey == null ? "" : sourceEventKey.trim();
        if (eventKey.isBlank() || eventKey.length() > 220) {
            throw new IllegalArgumentException("A valid cash transaction source key is required.");
        }
        String method = paymentMethod == null || paymentMethod.isBlank()
                ? null : paymentMethod.trim();
        if (method != null && !PAYMENT_METHODS.contains(method)) {
            throw new IllegalArgumentException("Select a valid payment method for the cash transaction.");
        }

        jdbc.update("""
            INSERT INTO cash_transactions(
                transaction_date, direction, amount, source_module, source_operation,
                source_record_id, source_event_key, source_reference, party_name,
                description, payment_method, reference_no, original_transaction_id,
                idempotency_key, created_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (source_event_key) DO NOTHING
            """,
                Date.valueOf(transactionDate == null ? LocalDate.now(SHOP_ZONE) : transactionDate),
                direction, amount, sourceModule.toUpperCase(Locale.ROOT),
                operation.toUpperCase(Locale.ROOT), sourceRecordId, eventKey,
                clean(sourceReference, 180), clean(partyName, 200),
                defaultText(description, "Cash movement"), method,
                nullIfBlank(clean(referenceNo, 120)), originalTransactionId,
                nullIfBlank(clean(idempotencyKey, 120)), auth.getUsername());

        return jdbc.queryForObject(
                "SELECT id FROM cash_transactions WHERE source_event_key=?",
                Long.class, eventKey);
    }

    @Transactional(readOnly = true)
    public List<Map<String,Object>> list(String direction, String search) {
        String selectedDirection = direction == null || direction.isBlank()
                || "ALL".equalsIgnoreCase(direction) ? null : direction.trim().toUpperCase(Locale.ROOT);
        if (selectedDirection != null
                && !Set.of("INCOMING", "OUTGOING").contains(selectedDirection)) {
            throw new IllegalArgumentException("Select All, Incoming or Outgoing.");
        }
        String query = search == null || search.isBlank() ? null : search.trim();
        String pattern = query == null ? null : "%" + query + "%";
        return jdbc.queryForList("""
            SELECT c.id,
                   c.transaction_date AS "transactionDate",
                   c.direction,
                   c.amount,
                   c.source_module AS "sourceModule",
                   c.source_operation AS "sourceOperation",
                   c.source_record_id AS "sourceRecordId",
                   c.source_reference AS "sourceReference",
                   c.party_name AS "partyName",
                   c.description,
                   c.payment_method AS "paymentMethod",
                   c.reference_no AS "referenceNo",
                   c.original_transaction_id AS "originalTransactionId",
                   c.status,
                   c.created_at AS "createdAt"
              FROM cash_transactions c
             WHERE (CAST(? AS VARCHAR) IS NULL OR c.direction=CAST(? AS VARCHAR))
               AND (CAST(? AS VARCHAR) IS NULL OR
                    CONCAT_WS(' ', c.source_reference, c.party_name, c.description,
                                   c.source_module, c.source_operation, c.reference_no,
                                   c.source_record_id::TEXT) ILIKE CAST(? AS VARCHAR))
             ORDER BY c.transaction_date DESC, c.id DESC
             LIMIT 2000
            """, selectedDirection, selectedDirection, query, pattern);
    }

    @Transactional(readOnly = true)
    public Map<String,Object> summary() {
        Map<String,Object> totals = jdbc.queryForMap("""
            SELECT COALESCE(SUM(amount) FILTER (WHERE direction='INCOMING' AND status='POSTED'),0) AS incoming,
                   COALESCE(SUM(amount) FILTER (WHERE direction='OUTGOING' AND status='POSTED'),0) AS outgoing,
                   COUNT(*) FILTER (WHERE direction='INCOMING' AND status='POSTED') AS "incomingCount",
                   COUNT(*) FILTER (WHERE direction='OUTGOING' AND status='POSTED') AS "outgoingCount"
              FROM cash_transactions
            """);
        BigDecimal incoming = decimal(totals.get("incoming"));
        BigDecimal outgoing = decimal(totals.get("outgoing"));
        Map<String,Object> result = new LinkedHashMap<>();
        result.put("totalIncoming", incoming);
        result.put("totalOutgoing", outgoing);
        result.put("netCashFlow", incoming.subtract(outgoing).setScale(2, RoundingMode.HALF_UP));
        result.put("incomingCount", totals.get("incomingCount"));
        result.put("outgoingCount", totals.get("outgoingCount"));
        result.put("transactionCount",
                ((Number) totals.get("incomingCount")).longValue()
                + ((Number) totals.get("outgoingCount")).longValue());
        return result;
    }

    @Transactional(readOnly = true)
    public List<Map<String,Object>> refundableTransactions() {
        return jdbc.queryForList("""
            SELECT c.id AS "transactionId",
                   c.transaction_date AS "transactionDate",
                   c.source_module AS "sourceModule",
                   c.source_reference AS "sourceReference",
                   c.party_name AS "partyName",
                   c.description,
                   c.amount AS "receivedAmount",
                   COALESCE(SUM(r.amount),0) AS "alreadyRefunded",
                   c.amount-COALESCE(SUM(r.amount),0) AS "refundableAmount"
              FROM cash_transactions c
              LEFT JOIN cash_refunds r ON r.original_transaction_id=c.id
             WHERE c.direction='INCOMING'
               AND c.status='POSTED'
             GROUP BY c.id
            HAVING c.amount-COALESCE(SUM(r.amount),0)>0
             ORDER BY c.transaction_date DESC, c.id DESC
             LIMIT 500
            """);
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String,Object> createRefund(
            Map<String,Object> body, String idempotencyKey, String requestIp) {
        if (body == null) throw new IllegalArgumentException("Refund details are required.");
        String key = idempotencyKey == null ? "" : idempotencyKey.trim();
        if (!key.matches("[A-Za-z0-9._:-]{1,120}")) {
            throw new IllegalArgumentException("A valid Idempotency-Key is required for a refund.");
        }
        lockKey("cash-refund:" + key);

        List<Map<String,Object>> duplicate = jdbc.queryForList("""
            SELECT id, original_transaction_id, refund_date, amount, payment_method,
                   reference_no, notes
              FROM cash_refunds
             WHERE idempotency_key=?
            """, key);
        if (!duplicate.isEmpty()) {
            Map<String,Object> old = duplicate.get(0);
            boolean same = ((Number) old.get("original_transaction_id")).longValue()
                    == requiredId(body.get("originalTransactionId"), "Original transaction")
                    && decimal(old.get("amount")).compareTo(decimal(body.get("amount"))) == 0
                    && String.valueOf(old.get("refund_date")).equals(String.valueOf(body.get("refundDate")))
                    && String.valueOf(old.get("payment_method")).equals(String.valueOf(body.get("paymentMethod")))
                    && clean(old.get("reference_no"), 120).equals(clean(body.get("referenceNo"), 120))
                    && clean(old.get("notes"), 2000).equals(clean(body.get("notes"), 2000));
            if (!same) {
                throw new IllegalArgumentException("This refund key was already used for different refund details.");
            }
            long refundId = ((Number) old.get("id")).longValue();
            Long transactionId = jdbc.queryForObject(
                    "SELECT id FROM cash_transactions WHERE source_event_key=?",
                    Long.class, "REFUND:" + refundId);
            return Map.of("success", true, "duplicate", true,
                    "refundId", refundId, "transactionId", transactionId,
                    "message", "This refund was already recorded.");
        }

        long originalId = requiredId(body.get("originalTransactionId"), "Original transaction");
        Map<String,Object> original = jdbc.queryForMap("""
            SELECT id, direction, status, amount, source_module, source_reference,
                   party_name, description
              FROM cash_transactions
             WHERE id=?
             FOR UPDATE
            """, originalId);
        if (!"INCOMING".equals(String.valueOf(original.get("direction")))
                || !"POSTED".equals(String.valueOf(original.get("status")))) {
            throw new IllegalArgumentException("Refunds can only be linked to a posted Incoming transaction.");
        }

        BigDecimal originalAmount = decimal(original.get("amount"));
        BigDecimal alreadyRefunded = jdbc.queryForObject("""
            SELECT COALESCE(SUM(amount),0)
              FROM cash_refunds
             WHERE original_transaction_id=?
            """, BigDecimal.class, originalId);
        BigDecimal remaining = originalAmount.subtract(decimal(alreadyRefunded))
                .setScale(2, RoundingMode.HALF_UP);
        BigDecimal amount = decimal(body.get("amount")).setScale(2, RoundingMode.HALF_UP);
        if (amount.signum() <= 0 || amount.compareTo(remaining) > 0) {
            throw new IllegalArgumentException("Refund must be positive and cannot exceed the remaining refundable amount of ₹ " + remaining + ".");
        }

        LocalDate refundDate = parseDate(body.get("refundDate"), "Refund date");
        if (refundDate.isAfter(LocalDate.now(SHOP_ZONE))) {
            throw new IllegalArgumentException("Refund date cannot be in the future.");
        }
        String method = String.valueOf(body.getOrDefault("paymentMethod", "Cash")).trim();
        if (!PAYMENT_METHODS.contains(method)) {
            throw new IllegalArgumentException("Select a valid refund payment method.");
        }
        String referenceNo = clean(body.get("referenceNo"), 120);
        String notes = clean(body.get("notes"), 2000);

        Long refundId = jdbc.queryForObject("""
            INSERT INTO cash_refunds(
                original_transaction_id, refund_date, amount, payment_method,
                reference_no, notes, idempotency_key, recorded_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id
            """, Long.class, originalId, Date.valueOf(refundDate), amount, method,
                nullIfBlank(referenceNo), nullIfBlank(notes), key, auth.getUsername());

        Long transactionId = recordMovement(
                "REFUNDS", "CUSTOMER_REFUND", refundId,
                "REFUND:" + refundId, refundDate, amount,
                clean(original.get("party_name"), 200),
                "Refund against " + defaultText(original.get("source_reference"),
                        String.valueOf(original.get("source_module")) + " transaction " + originalId),
                method, referenceNo,
                "Refund for " + defaultText(original.get("source_reference"), "Transaction " + originalId),
                key, originalId);

        jdbc.update("""
            INSERT INTO audit_logs(actor_identity, action, module, record_id, new_value, ip_address)
            VALUES (?, 'CUSTOMER_REFUND_POSTED', 'cash-transactions', ?,
                    CAST(? AS JSONB), ?)
            """, auth.getUsername(), String.valueOf(transactionId),
                "{\"refundId\":" + refundId + ",\"originalTransactionId\":" + originalId
                        + ",\"amount\":" + amount.toPlainString() + ",\"refundDate\":\"" + refundDate + "\"}",
                requestIp == null ? "" : requestIp);

        return Map.of("success", true, "refundId", refundId,
                "transactionId", transactionId, "amount", amount,
                "message", "Refund recorded as an Outgoing cash transaction.");
    }

    @Transactional
    public void voidMovement(String sourceEventKey, String reason) {
        String key = sourceEventKey == null ? "" : sourceEventKey.trim();
        if (key.isBlank()) return;
        jdbc.update("""
            UPDATE cash_transactions
               SET status='VOIDED', void_reason=?, voided_by=?, voided_at=NOW()
             WHERE source_event_key=? AND status='POSTED'
            """, clean(reason, 500), auth.getUsername(), key);
    }

    private void lockKey(String key) {
        jdbc.query("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", rs -> {
            if (rs.next()) return null;
            return null;
        }, key);
    }

    private long requiredId(Object value, String label) {
        try {
            long id = decimal(value).longValueExact();
            if (id <= 0) throw new ArithmeticException();
            return id;
        } catch (ArithmeticException ex) {
            throw new IllegalArgumentException(label + " must be a positive whole number.");
        }
    }

    private LocalDate parseDate(Object value, String label) {
        try {
            if (value == null || String.valueOf(value).isBlank()) throw new IllegalArgumentException();
            return LocalDate.parse(String.valueOf(value).substring(0, 10));
        } catch (RuntimeException ex) {
            throw new IllegalArgumentException(label + " must be a valid YYYY-MM-DD date.");
        }
    }

    private BigDecimal decimal(Object value) {
        if (value == null || String.valueOf(value).isBlank()) return BigDecimal.ZERO;
        try {
            return value instanceof BigDecimal n ? n : new BigDecimal(String.valueOf(value).trim());
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException("A transaction amount is not a valid number.");
        }
    }

    private String clean(Object value, int maxLength) {
        if (value == null) return "";
        String valueText = String.valueOf(value).trim();
        return valueText.length() > maxLength ? valueText.substring(0, maxLength) : valueText;
    }

    private String defaultText(Object value, String fallback) {
        String cleaned = clean(value, 2000);
        return cleaned.isBlank() ? fallback : cleaned;
    }

    private String nullIfBlank(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
