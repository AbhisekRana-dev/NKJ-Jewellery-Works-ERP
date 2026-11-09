package com.nkj.billing.controller;

import java.math.BigDecimal;
import java.util.List;
import java.time.LocalDate;
import java.time.ZoneId;
import java.sql.Date;
import java.util.Locale;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.RequestHeader;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.nkj.billing.model.Invoice;
import com.nkj.billing.repo.InvoiceRepository;
import com.nkj.billing.service.AuthService;

@RestController
@RequestMapping("/api/invoices")
public class InvoiceController {

    private final InvoiceRepository repo;
    private final ObjectMapper mapper;
    private final AuthService auth;
    private final JdbcTemplate jdbc;

    public InvoiceController(InvoiceRepository repo, ObjectMapper mapper, AuthService auth,
                             JdbcTemplate jdbc) {
        this.repo = repo;
        this.mapper = mapper;
        this.auth = auth;
        this.jdbc = jdbc;
    }

    /**
     * Save the full invoice request in payload_json and return both the
     * summary columns and the full line-item payload.
     *
     * Invoice numbers restart at 001 for each calendar day (Asia/Kolkata).
     * The PostgreSQL daily counter is incremented atomically inside this
     * transaction, preventing duplicate numbers during concurrent saves.
     */
    @PostMapping
    @Transactional
    public Map<String, Object> create(@RequestBody Map<String, Object> body,
                                      @RequestHeader("Idempotency-Key") String idempotencyKey,
                                      jakarta.servlet.http.HttpServletRequest servletRequest) throws Exception {
        String requestKey = clean(idempotencyKey);
        if (!requestKey.matches("[A-Za-z0-9._:-]{1,120}")) {
            throw new IllegalArgumentException("A valid Idempotency-Key is required to save an invoice.");
        }

        validateInvoiceBody(body);
        LocalDate invoiceDate = requestedInvoiceDate(body);

        // Serialize requests carrying the same key so retries return the first
        // committed invoice instead of creating a second invoice.
        jdbc.query(
                "SELECT pg_advisory_xact_lock(hashtextextended(?, 0))",
                rs -> {
                    if (rs.next()) {
                        // Reading the result ensures PostgreSQL executes and acquires the lock.
                    }
                    return null;
                },
                requestKey
        );
        Invoice existingInvoice = repo.findByIdempotencyKey(requestKey).orElse(null);
        if (existingInvoice != null) {
            if (existingInvoice.getInvoiceDate() == null
                    || !existingInvoice.getInvoiceDate().equals(invoiceDate)) {
                // A legacy draft may have reached the database before the
                // business-date field was supported. Repair that same invoice
                // only when every other saved field matches this exact retry.
                if (!sameInvoicePayloadExceptDate(existingInvoice.getPayloadJson(), body)) {
                    throw new IllegalArgumentException(
                            "This save request key already belongs to invoice " + existingInvoice.getInvoiceNo()
                            + " with different invoice details. Open Invoice History and verify the earlier save before creating another invoice."
                    );
                }

                String previousInvoiceNo = existingInvoice.getInvoiceNo();
                LocalDate previousInvoiceDate = existingInvoice.getInvoiceDate();
                String datePart = invoiceDate.format(DateTimeFormatter.ofPattern("ddMMyy"));
                long dailySequence = nextDailyInvoiceSequence(invoiceDate, datePart);
                String correctedInvoiceNo = "NKJ-" + datePart + "-"
                        + String.format(Locale.ROOT, "%03d", dailySequence);

                existingInvoice.setInvoiceDate(invoiceDate);
                existingInvoice.setShowGstin(booleanValue(body.get("showGstin"), true));
                existingInvoice.setInvoiceNo(correctedInvoiceNo);
                existingInvoice.setPayloadJson(mapper.writeValueAsString(body));
                repo.saveAndFlush(existingInvoice);

                // Keep denormalized invoice-number references consistent.
                jdbc.update("UPDATE payments SET invoice_no=? WHERE invoice_id=?",
                        correctedInvoiceNo, existingInvoice.getId());
                jdbc.update("UPDATE pre_booking_bills SET invoice_no=? WHERE invoice_no=?",
                        correctedInvoiceNo, previousInvoiceNo);
                // Invoice number corrections update the EMI's denormalized reference
                // directly by invoice_id, never through a Pre-Booking record.
                jdbc.update("UPDATE installment_accounts SET invoice_no=? WHERE invoice_id=?",
                        correctedInvoiceNo, existingInvoice.getId());

                jdbc.update("INSERT INTO audit_logs(actor_identity,action,module,record_id,previous_value,new_value,ip_address) "
                                + "VALUES ('PUBLIC','INVOICE_BUSINESS_DATE_CORRECTED','INVOICES',?,CAST(? AS JSONB),CAST(? AS JSONB),?)",
                        String.valueOf(existingInvoice.getId()),
                        mapper.writeValueAsString(Map.of(
                                "invoiceNo", previousInvoiceNo,
                                "invoiceDate", previousInvoiceDate == null ? "" : previousInvoiceDate.toString()
                        )),
                        mapper.writeValueAsString(Map.of(
                                "invoiceNo", correctedInvoiceNo,
                                "invoiceDate", invoiceDate.toString(),
                                "createdAt", existingInvoice.getCreatedAt().toString()
                        )),
                        servletRequest.getRemoteAddr());
            }
            return view(existingInvoice);
        }

        validateMobileNumber(body);
        String customerName = clean(body.get("customerName"));
        if (customerName.isEmpty()) {
            throw new IllegalArgumentException("Customer name is required.");
        }

        Invoice invoice = new Invoice();
        invoice.setInvoiceNo("PENDING-" + UUID.randomUUID());
        invoice.setIdempotencyKey(requestKey);
        invoice.setInvoiceDate(invoiceDate);
        invoice.setShowGstin(booleanValue(body.get("showGstin"), true));

        invoice.setCustomerName(customerName);
        invoice.setMobile(clean(body.get("mobile")));
        invoice.setAddress(clean(body.get("address")));
        invoice.setPaymentMode(defaultValue(clean(body.get("paymentMode")), "Cash"));
        invoice.setReferenceNo(clean(body.get("referenceNo")));
        invoice.setPayloadJson(mapper.writeValueAsString(body));

        invoice.setNewTotal(number(body, "newTotal"));
        invoice.setOldTotal(number(body, "oldTotal"));
        invoice.setMakingCharge(number(body, "makingCharge"));
        invoice.setExtraCharge(number(body, "extraCharge"));
        invoice.setDiscount(number(body, "discount"));
        invoice.setSubTotal(number(body, "subTotal"));
        invoice.setGstPercent(number(body, "gstPercent"));
        invoice.setGstAmount(number(body, "gstAmount"));
        invoice.setOtherCharge(number(body, "otherCharge"));
        invoice.setGrandTotal(number(body, "grandTotal"));

        // First flush assigns the database ID and triggers Invoice.@PrePersist,
        // which records createdAt in the Asia/Kolkata timezone.
        repo.saveAndFlush(invoice);

        String datePart = invoiceDate.format(DateTimeFormatter.ofPattern("ddMMyy"));
        long dailySequence = nextDailyInvoiceSequence(invoiceDate, datePart);

        invoice.setInvoiceNo("NKJ-" + datePart + "-" + String.format(Locale.ROOT, "%03d", dailySequence));
        repo.saveAndFlush(invoice);
        persistInvoiceItems(invoice.getId(), body.get("newItems"), "NEW");
        persistInvoiceItems(invoice.getId(), body.get("oldItems"), "OLD_EXCHANGE");
        Object paymentAmount = body.get("paymentAmount");
        if (paymentAmount != null && decimalValue(paymentAmount).compareTo(BigDecimal.ZERO) > 0) {
            jdbc.update("INSERT INTO payments(invoice_id, invoice_no, customer_name, payment_date, amount, payment_method, reference_no, notes) VALUES (?, ?, ?, CURRENT_DATE, ?, ?, ?, ?)",
                    invoice.getId(), invoice.getInvoiceNo(), invoice.getCustomerName(), decimalValue(paymentAmount), invoice.getPaymentMode(), invoice.getReferenceNo(), "Initial invoice payment");
        }
        jdbc.update("INSERT INTO audit_logs(actor_identity,action,module,record_id,new_value,ip_address) VALUES ('PUBLIC','INVOICE_CREATED','INVOICES',?,CAST(? AS JSONB),?)",
                String.valueOf(invoice.getId()),
                mapper.writeValueAsString(Map.of(
                        "invoiceNo", invoice.getInvoiceNo(),
                        "invoiceDate", invoice.getInvoiceDate().toString(),
                        "createdAt", invoice.getCreatedAt().toString(),
                        "grandTotal", invoice.getGrandTotal()
                )),
                servletRequest.getRemoteAddr());

        return view(invoice);
    }

    /**
     * Update an existing saved invoice without changing its invoice number,
     * business date, creation timestamp, or recorded payments.
     */
    @PutMapping("/{id}")
    @Transactional
    public Map<String, Object> update(@PathVariable Long id,
                                      @RequestBody Map<String, Object> body,
                                      HttpServletRequest servletRequest) throws Exception {
        validateInvoiceBody(body);
        validateMobileNumber(body);

        Invoice invoice = repo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Invoice not found."));
        boolean previousShowGstin = invoice.isShowGstin();
        LocalDate requestedDate = requestedInvoiceDate(body);
        if (invoice.getInvoiceDate() == null || !invoice.getInvoiceDate().equals(requestedDate)) {
            throw new IllegalArgumentException(
                    "The invoice date cannot be changed while editing a saved invoice. Its invoice number and history date must remain unchanged."
            );
        }

        String customerName = clean(body.get("customerName"));
        if (customerName.isEmpty()) {
            throw new IllegalArgumentException("Customer name is required.");
        }

        invoice.setShowGstin(booleanValue(body.get("showGstin"), true));
        invoice.setCustomerName(customerName);
        invoice.setMobile(clean(body.get("mobile")));
        invoice.setAddress(clean(body.get("address")));
        invoice.setPaymentMode(defaultValue(clean(body.get("paymentMode")), "Cash"));
        invoice.setReferenceNo(clean(body.get("referenceNo")));
        invoice.setPayloadJson(mapper.writeValueAsString(body));

        invoice.setNewTotal(number(body, "newTotal"));
        invoice.setOldTotal(number(body, "oldTotal"));
        invoice.setMakingCharge(number(body, "makingCharge"));
        invoice.setExtraCharge(number(body, "extraCharge"));
        invoice.setDiscount(number(body, "discount"));
        invoice.setSubTotal(number(body, "subTotal"));
        invoice.setGstPercent(number(body, "gstPercent"));
        invoice.setGstAmount(number(body, "gstAmount"));
        invoice.setOtherCharge(number(body, "otherCharge"));
        invoice.setGrandTotal(number(body, "grandTotal"));

        repo.saveAndFlush(invoice);

        // Replace the saved line-item snapshots atomically with the edited form.
        jdbc.update("DELETE FROM invoice_items WHERE invoice_id = ?", invoice.getId());
        persistInvoiceItems(invoice.getId(), body.get("newItems"), "NEW");
        persistInvoiceItems(invoice.getId(), body.get("oldItems"), "OLD_EXCHANGE");

        jdbc.update(
                "INSERT INTO audit_logs(actor_identity,action,module,record_id,previous_value,new_value,ip_address) "
                        + "VALUES ('OWNER','INVOICE_UPDATED','INVOICES',?,CAST(? AS JSONB),CAST(? AS JSONB),?)",
                String.valueOf(invoice.getId()),
                mapper.writeValueAsString(Map.of("showGstin", previousShowGstin)),
                mapper.writeValueAsString(Map.of(
                        "invoiceNo", invoice.getInvoiceNo(),
                        "showGstin", invoice.isShowGstin(),
                        "grandTotal", invoice.getGrandTotal()
                )),
                servletRequest.getRemoteAddr()
        );

        return view(invoice);
    }

    /**
     * Frontend preflight: do not submit invoices to an older backend that
     * ignores invoiceDate and silently uses createdAt for numbering.
     */
    @GetMapping("/date-support")
    public Map<String, Object> dateSupport() {
        Boolean invoiceDateColumn = jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM information_schema.columns "
                        + "WHERE table_schema='public' AND table_name='invoices' AND column_name='invoice_date')",
                Boolean.class
        );
        Boolean dailySequenceTable = jdbc.queryForObject(
                "SELECT to_regclass('public.invoice_daily_sequences') IS NOT NULL",
                Boolean.class
        );
        Boolean showGstinColumn = jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM information_schema.columns "
                        + "WHERE table_schema='public' AND table_name='invoices' AND column_name='show_gstin')",
                Boolean.class
        );
        boolean supported = Boolean.TRUE.equals(invoiceDateColumn)
                && Boolean.TRUE.equals(dailySequenceTable);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("invoiceDateSupported", supported);
        response.put("apiVersion", "backdated-invoice-date-v1");
        response.put("invoiceDateColumn", Boolean.TRUE.equals(invoiceDateColumn));
        response.put("dailySequenceTable", Boolean.TRUE.equals(dailySequenceTable));
        response.put("invoiceGstinVisibilitySupported", Boolean.TRUE.equals(showGstinColumn));
        return response;
    }

    @GetMapping
    public java.util.List<Map<String, Object>> all() {
        return repo.findAllByOrderByInvoiceDateDescCreatedAtDesc().stream().map(this::summary).toList();
    }

    @GetMapping("/{id}")
    public Map<String, Object> one(@PathVariable Long id) {
        return repo.findById(id)
                .map(this::view)
                .orElseThrow(() -> new IllegalArgumentException("Invoice not found."));
    }

    public record DeleteRequest(String password) {
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@PathVariable Long id, @RequestBody DeleteRequest request,
                                     jakarta.servlet.http.HttpServletRequest servletRequest) throws Exception {
        if (request == null || request.password() == null || request.password().isBlank()) {
            throw new IllegalArgumentException("Administrator password is required.");
        }

        if (!auth.credentials(auth.getUsername(), request.password())) {
            throw new IllegalArgumentException("Incorrect administrator password.");
        }

        Invoice invoice = repo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Invoice not found."));
        jdbc.update("INSERT INTO audit_logs(actor_identity,action,module,record_id,previous_value,ip_address) VALUES (?, 'INVOICE_DELETED', 'INVOICES', ?, CAST(? AS JSONB), ?)",
                auth.getUsername(), String.valueOf(invoice.getId()), mapper.writeValueAsString(Map.of("invoiceNo", invoice.getInvoiceNo(), "grandTotal", invoice.getGrandTotal())), servletRequest.getRemoteAddr());
        repo.delete(invoice);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("message", "Invoice deleted successfully.");
        return response;
    }

    /**
     * Allocates the next sequence for one invoice date.
     *
     * On the first use of a date, the counter is initialized from the highest
     * existing NKJ invoice suffix for that date. This protects invoices that
     * were created before the daily-counter table was installed.
     *
     * PostgreSQL ON CONFLICT serializes concurrent updates to the same date
     * row. Because this method runs inside create()'s transaction, a failed
     * invoice save also rolls back the counter increment.
     */

    private LocalDate requestedInvoiceDate(Map<String, Object> body) {
        String rawDate = clean(body.get("invoiceDate"));
        if (rawDate.isBlank()) {
            throw new IllegalArgumentException("Invoice date is required. Select the invoice date before saving.");
        }

        LocalDate selectedDate;
        try {
            selectedDate = LocalDate.parse(rawDate, DateTimeFormatter.ISO_LOCAL_DATE);
        } catch (Exception ex) {
            throw new IllegalArgumentException("Invoice date must be a valid date in YYYY-MM-DD format.");
        }

        LocalDate today = LocalDate.now(ZoneId.of("Asia/Kolkata"));
        if (selectedDate.isAfter(today)) {
            throw new IllegalArgumentException("Invoice date cannot be in the future.");
        }
        return selectedDate;
    }


    private boolean sameInvoicePayloadExceptDate(String storedPayload, Map<String, Object> requestBody) {
        if (storedPayload == null || storedPayload.isBlank() || requestBody == null) return false;
        try {
            JsonNode stored = mapper.readTree(storedPayload);
            JsonNode requested = mapper.valueToTree(requestBody);
            if (!stored.isObject() || !requested.isObject()) return false;
            ((ObjectNode) stored).remove("invoiceDate");
            ((ObjectNode) requested).remove("invoiceDate");
            // paymentAmount was removed from the current invoice form; ignore
            // this legacy-only field when recovering an older saved draft.
            ((ObjectNode) stored).remove("paymentAmount");
            ((ObjectNode) requested).remove("paymentAmount");
            // Older invoice drafts predate the per-invoice GSTIN flag. Their
            // historical behavior displayed GSTIN, so treat a missing flag as true.
            if (!stored.has("showGstin") || stored.get("showGstin").isNull()) {
                ((ObjectNode) stored).put("showGstin", true);
            }
            if (!requested.has("showGstin") || requested.get("showGstin").isNull()) {
                ((ObjectNode) requested).put("showGstin", true);
            }
            return stored.equals(requested);
        } catch (Exception ex) {
            return false;
        }
    }

    private long nextDailyInvoiceSequence(LocalDate invoiceDate, String datePart) {
        String sql = """
                INSERT INTO public.invoice_daily_sequences (invoice_date, last_number, updated_at)
                VALUES (
                    ?,
                    GREATEST(
                        1,
                        COALESCE(
                            (
                                SELECT MAX(
                                    CASE
                                        WHEN SPLIT_PART(i.invoice_no, '-', 3) ~ '^[0-9]{1,18}$'
                                        THEN SPLIT_PART(i.invoice_no, '-', 3)::BIGINT
                                        ELSE NULL
                                    END
                                )
                                FROM public.invoices i
                                WHERE i.invoice_no LIKE 'NKJ-' || ? || '-%'
                            ),
                            0
                        ) + 1
                    ),
                    CURRENT_TIMESTAMP
                )
                ON CONFLICT (invoice_date)
                DO UPDATE SET
                    last_number = GREATEST(
                        public.invoice_daily_sequences.last_number + 1,
                        EXCLUDED.last_number
                    ),
                    updated_at = CURRENT_TIMESTAMP
                RETURNING last_number
                """;

        Long nextNumber = jdbc.queryForObject(
                sql,
                Long.class,
                Date.valueOf(invoiceDate),
                datePart
        );

        if (nextNumber == null || nextNumber < 1) {
            throw new IllegalStateException("Could not generate the daily invoice number.");
        }
        return nextNumber;
    }

    private void persistInvoiceItems(Long invoiceId, Object rawItems, String itemType) throws Exception {
        if (!(rawItems instanceof List<?> rows)) return;
        for (Object raw : rows) {
            if (!(raw instanceof Map<?, ?> rawMap)) continue;
            Map<String, Object> row = new LinkedHashMap<>();
            rawMap.forEach((key, value) -> row.put(String.valueOf(key), value));
            if (!hasInvoiceItemDetails(row, itemType)) continue;
            BigDecimal netWeight = decimalValue(row.get(itemType.equals("OLD_EXCHANGE") ? "pureWeight" : "netWeight"));
            BigDecimal rate = decimalValue(row.get("rate"));
            BigDecimal making = decimalValue(row.get("makingCharge"));
            BigDecimal stamp = decimalValue(row.get("stampCharge"));
            BigDecimal extra = decimalValue(row.get("extraCharge"));
            BigDecimal amount = row.containsKey("amount") && row.get("amount") != null
                    ? decimalValue(row.get("amount"))
                    : netWeight.multiply(rate).add(making).add(stamp).add(extra);
            jdbc.update("""
                    INSERT INTO invoice_items(invoice_id,item_type,description,purity,gross_weight,stone_weight,net_weight,
                        rate,making_charge,stamp_charge,extra_charge,amount,row_snapshot)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?, ?, CAST(? AS JSONB))
                    """,
                    invoiceId,
                    itemType,
                    clean(row.get("description")),
                    clean(row.get("purity")),
                    decimalValue(row.get("grossWeight")),
                    decimalValue(row.get("stoneWeight")),
                    netWeight,
                    rate,
                    making,
                    stamp,
                    extra,
                    amount,
                    mapper.writeValueAsString(row));
        }
    }

    /**
     * Validate the request before writing any invoice rows. The controller
     * transaction then commits the invoice, line items, and any initial
     * payment together or rolls all of them back on failure.
     */
    private void validateInvoiceBody(Map<String, Object> body) {
        if (body == null) {
            throw new IllegalArgumentException("Invoice details are required.");
        }
        if (clean(body.get("customerName")).isEmpty()) {
            throw new IllegalArgumentException("Customer name is required.");
        }

        boolean hasNewItems = validateInvoiceItemRows(body.get("newItems"), "NEW");
        boolean hasOldItems = validateInvoiceItemRows(body.get("oldItems"), "OLD_EXCHANGE");
        if (!hasNewItems && !hasOldItems) {
            throw new IllegalArgumentException("At least one new or old ornament detail is required.");
        }

        for (String field : List.of(
                "newTotal", "oldTotal", "makingCharge", "extraCharge", "discount",
                "subTotal", "gstPercent", "gstAmount", "otherCharge", "grandTotal", "paymentAmount")) {
            validateNonNegativeDecimal(body.get(field), field);
        }
    }

    private boolean validateInvoiceItemRows(Object rawItems, String itemType) {
        if (rawItems == null) return false;
        if (!(rawItems instanceof List<?> rows)) {
            throw new IllegalArgumentException("Invoice " + itemType + " items must be a list.");
        }

        boolean hasDetails = false;
        for (Object raw : rows) {
            if (!(raw instanceof Map<?, ?> rawMap)) {
                throw new IllegalArgumentException("Each invoice item must be an object.");
            }
            Map<String, Object> row = new LinkedHashMap<>();
            rawMap.forEach((key, value) -> row.put(String.valueOf(key), value));
            if (!hasInvoiceItemDetails(row, itemType)) continue;
            hasDetails = true;

            List<String> numericFields = itemType.equals("OLD_EXCHANGE")
                    ? List.of("pureWeight", "rate")
                    : List.of("netWeight", "rate", "makingCharge", "stampCharge", "extraCharge");
            for (String field : numericFields) {
                validateNonNegativeDecimal(row.get(field), itemType + " item " + field);
            }
        }
        return hasDetails;
    }

    private boolean hasInvoiceItemDetails(Map<String, Object> row, String itemType) {
        List<String> fields = itemType.equals("OLD_EXCHANGE")
                ? List.of("description", "purity", "pureWeight", "rate")
                : List.of("description", "purity", "netWeight", "rate", "makingCharge", "stampCharge", "extraCharge");
        return fields.stream().anyMatch(field -> !clean(row.get(field)).isEmpty());
    }


    private void validateMobileNumber(Map<String, Object> body) {
        String mobile = clean(body.get("mobile"));
        if (!mobile.isEmpty() && !mobile.matches("[0-9]{10}")) {
            throw new IllegalArgumentException("Mobile number must contain exactly 10 digits (0-9 only).");
        }
    }

    private void validateNonNegativeDecimal(Object value, String field) {
        if (value == null || String.valueOf(value).isBlank()) return;
        final BigDecimal parsed;
        try {
            parsed = new BigDecimal(String.valueOf(value));
        } catch (NumberFormatException error) {
            throw new IllegalArgumentException(field + " must be a valid number.");
        }
        if (parsed.signum() < 0) {
            throw new IllegalArgumentException(field + " cannot be negative.");
        }
    }

    private boolean booleanValue(Object value, boolean fallback) {
        if (value == null) return fallback;
        if (value instanceof Boolean bool) return bool;
        String normalized = String.valueOf(value).trim();
        if ("true".equalsIgnoreCase(normalized)) return true;
        if ("false".equalsIgnoreCase(normalized)) return false;
        throw new IllegalArgumentException("showGstin must be either true or false.");
    }

    private BigDecimal decimalValue(Object value) {
        if (value == null || String.valueOf(value).isBlank()) return BigDecimal.ZERO;
        try {
            BigDecimal parsed = new BigDecimal(String.valueOf(value));
            return parsed.signum() < 0 ? BigDecimal.ZERO : parsed;
        } catch (NumberFormatException ignored) {
            return BigDecimal.ZERO;
        }
    }

    private BigDecimal number(Map<String, Object> values, String key) {
        return decimalValue(values.get(key));
    }

    private String clean(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private String defaultValue(String value, String fallback) {
        return value.isBlank() ? fallback : value;
    }

    /**
     * `details` retains the exact original request for older clients.
     * The line-item fields are also copied to the top level so the saved
     * invoice list and detail UI can read newItems/oldItems directly.
     */
    private Map<String, Object> summary(Invoice invoice) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", invoice.getId());
        response.put("invoiceNo", invoice.getInvoiceNo());
        response.put("customerName", invoice.getCustomerName());
        response.put("mobile", invoice.getMobile());
        response.put("address", invoice.getAddress());
        response.put("paymentMode", invoice.getPaymentMode());
        response.put("referenceNo", invoice.getReferenceNo());
        response.put("invoiceDate", invoice.getInvoiceDate() == null
                ? ""
                : invoice.getInvoiceDate().toString());
        response.put("showGstin", invoice.isShowGstin());
        // createdAt remains the real server-side creation timestamp for audit purposes.
        response.put("createdAt", invoice.getCreatedAt());
        response.put("invoiceTime", invoice.getCreatedAt() == null
                ? ""
                : invoice.getCreatedAt().toLocalTime().withNano(0).toString());
        response.put("newTotal", invoice.getNewTotal());
        response.put("oldTotal", invoice.getOldTotal());
        response.put("makingCharge", invoice.getMakingCharge());
        response.put("extraCharge", invoice.getExtraCharge());
        response.put("discount", invoice.getDiscount());
        response.put("subTotal", invoice.getSubTotal());
        response.put("gstPercent", invoice.getGstPercent());
        response.put("gstAmount", invoice.getGstAmount());
        response.put("otherCharge", invoice.getOtherCharge());
        response.put("grandTotal", invoice.getGrandTotal());
        return response;
    }

    /**
     * Full invoice detail endpoint. The saved-invoice list uses summary()
     * to avoid transferring every customer's line items until requested.
     */
    private Map<String, Object> view(Invoice invoice) {
        Map<String, Object> details = Collections.emptyMap();
        try {
            if (invoice.getPayloadJson() != null && !invoice.getPayloadJson().isBlank()) {
                details = mapper.readValue(
                        invoice.getPayloadJson(),
                        new TypeReference<Map<String, Object>>() {}
                );
            }
        } catch (Exception ignored) {
            details = Collections.emptyMap();
        }

        Map<String, Object> response = new LinkedHashMap<>(details);
        response.putAll(summary(invoice));
        response.put("details", details);
        return response;
    }
}
