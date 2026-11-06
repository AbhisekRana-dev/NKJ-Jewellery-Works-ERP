package com.nkj.billing.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.nkj.billing.controller.MetalRateController.NewspaperImportRequest;
import com.nkj.billing.controller.MetalRateController.RateUpdateRequest;
import com.nkj.billing.model.MetalRate;
import com.nkj.billing.repo.MetalRateRepository;

@Service
public class MetalRateService {
    private static final long RATE_ROW_ID = 1L;
    private static final ZoneId SHOP_ZONE = ZoneId.of("Asia/Kolkata");
    private static final BigDecimal TEN = BigDecimal.TEN;
    private final MetalRateRepository repository;
    private final JdbcTemplate jdbc;
    private final AuthService auth;

    public MetalRateService(MetalRateRepository repository, JdbcTemplate jdbc, AuthService auth) {
        this.repository = repository;
        this.jdbc = jdbc;
        this.auth = auth;
    }

    @Transactional
    public Map<String, Object> getPublicRates() {
        return toResponse(getOrCreate());
    }

    public List<Map<String, Object>> getHistory() {
        return jdbc.queryForList("""
            SELECT id,
                   previous_gold_24k_rate AS "previousGold24kRate",
                   previous_gold_22k_rate AS "previousGold22kRate",
                   previous_silver_rate AS "previousSilverRate",
                   new_gold_24k_rate AS "newGold24kRate",
                   new_gold_22k_rate AS "newGold22kRate",
                   new_silver_rate AS "newSilverRate",
                   change_type AS "changeType",
                   change_note AS "changeNote",
                   COALESCE(new_rate_source, rate_source) AS "rateSource",
                   COALESCE(new_source_reference, source_reference) AS "sourceReference",
                   new_rate_date AS "newRateDate",
                   new_source_published_at AS "sourcePublishedAt",
                   changed_by AS "changedBy",
                   changed_at AS "changedAt"
              FROM metal_rate_history
             ORDER BY changed_at DESC
            """);
    }

    @Transactional
    public Map<String, Object> updateManualRates(RateUpdateRequest request) {
        if (request == null) throw new IllegalArgumentException("Rate values are required.");
        BigDecimal gold24 = normalize(request.gold24kRate(), "24K gold");
        BigDecimal gold22 = normalize(request.gold22kRate(), "22K gold");
        BigDecimal silver = normalize(request.silverRate(), "999 silver");
        lockRateRow();
        MetalRate current = getOrCreate();
        RateSnapshot before = snapshotOf(current);

        current.setGold24kRate(gold24);
        current.setGold22kRate(gold22);
        current.setSilverRate(silver);
        current.setRateMode("MANUAL");
        current.setOwnerVerified(true);
        current.setRateSource("Manual Admin Entry");
        current.setSourceReference(null);
        current.setSourcePublishedAt(null);
        current.setRateDate(LocalDate.now(SHOP_ZONE));
        MetalRate saved = repository.save(current);

        appendHistory(before, snapshotOf(saved), "MANUAL_RATE_UPDATE", "Manual rate update by administrator", auth.getUsername());
        return toResponse(saved);
    }

    @Transactional
    public Map<String, Object> enableAutoMode() {
        lockRateRow();
        MetalRate current = getOrCreate();
        RateSnapshot before = snapshotOf(current);
        current.setRateMode("AUTO");

        // When leaving Manual Override, restore the most recently stored
        // automatic snapshot before attempting to fetch a newer publication.
        restoreLatestAutomaticSnapshot(current);

        // Mode selection alone is not a rate change, so it does not create
        // a duplicate daily price row in Rate Change History.
        MetalRate saved = repository.save(current);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public boolean isAutoMode() {
        return repository.findById(RATE_ROW_ID)
                .map(rate -> "AUTO".equalsIgnoreCase(rate.getRateMode()))
                .orElse(false);
    }

    private void restoreLatestAutomaticSnapshot(MetalRate current) {
        List<Map<String, Object>> snapshots = jdbc.queryForList("""
            SELECT new_gold_24k_rate, new_gold_22k_rate, new_silver_rate,
                   COALESCE(new_rate_source, rate_source) AS rate_source,
                   COALESCE(new_source_reference, source_reference) AS source_reference,
                   new_rate_date, new_source_published_at
              FROM metal_rate_history
             WHERE change_type IN ('NEWSPAPER_DAILY_IMPORT', 'KOLKATA_CITY_DAILY_IMPORT')
               AND new_rate_date IS NOT NULL
             ORDER BY changed_at DESC
             LIMIT 1
            """);
        if (snapshots.isEmpty()) return;

        Map<String, Object> latest = snapshots.get(0);
        current.setGold24kRate(asBigDecimal(latest.get("new_gold_24k_rate")));
        current.setGold22kRate(asBigDecimal(latest.get("new_gold_22k_rate")));
        current.setSilverRate(asBigDecimal(latest.get("new_silver_rate")));
        current.setRateSource(String.valueOf(latest.get("rate_source")));
        current.setSourceReference((String) latest.get("source_reference"));
        current.setRateDate(asLocalDate(latest.get("new_rate_date")));
        current.setSourcePublishedAt(asLocalDateTime(latest.get("new_source_published_at")));
        current.setLastAutoSourceDate(current.getRateDate());
        current.setOwnerVerified(true);
    }

    private BigDecimal asBigDecimal(Object value) {
        return value == null ? BigDecimal.ZERO : new BigDecimal(String.valueOf(value));
    }

    private LocalDate asLocalDate(Object value) {
        if (value instanceof LocalDate date) return date;
        if (value instanceof java.sql.Date date) return date.toLocalDate();
        return value == null ? null : LocalDate.parse(value.toString());
    }

    private LocalDateTime asLocalDateTime(Object value) {
        if (value instanceof LocalDateTime dateTime) return dateTime;
        if (value instanceof java.sql.Timestamp timestamp) return timestamp.toLocalDateTime();
        return value == null ? null : LocalDateTime.parse(value.toString().replace(' ', 'T'));
    }

    /**
     * Import a verified Kolkata snapshot. The publication may be today or the
     * latest prior business day (weekends/holidays), but never future-dated
     * or older than the last successfully imported automatic publication.
     */
    @Transactional
    public Map<String, Object> importNewspaperRates(NewspaperImportRequest request) {
        if (request == null) throw new IllegalArgumentException("Kolkata rate payload is required.");
        LocalDate today = LocalDate.now(SHOP_ZONE);
        LocalDate publicationDate = request.publicationDate();
        if (publicationDate == null || publicationDate.isAfter(today)) {
            throw new IllegalArgumentException("Kolkata rate publication date cannot be missing or in the future.");
        }
        // Permit the previous business-day snapshot over weekends/short
        // holidays, but never accept a feed older than three calendar days.
        if (publicationDate.isBefore(today.minusDays(3))) {
            throw new IllegalArgumentException("Kolkata rate source publication is stale; the last verified active rates will be retained.");
        }
        if (request.publishedAt() == null || !request.publishedAt().toLocalDate().equals(publicationDate)) {
            throw new IllegalArgumentException("The source publication timestamp must match the stated publication date.");
        }
        if (request.sourceReference() == null || request.sourceReference().isBlank()) {
            throw new IllegalArgumentException("A source reference is required for an automatic rate import.");
        }

        String sourceName = request.sourceName() == null ? "" : request.sourceName().trim();
        if (!List.of("Anandabazar Patrika", "All India Bullion · Kolkata").contains(sourceName)) {
            throw new IllegalArgumentException("The Kolkata rate source is not on the approved source list.");
        }

        BigDecimal gold24 = normalize(request.gold24kRate(), "24K gold");
        BigDecimal gold22 = normalize(request.gold22kRate(), "22K gold");
        BigDecimal silver = normalize(request.silverRate(), "999 silver");
        String unit = request.unit() == null ? "PER_GRAM" : request.unit().trim().toUpperCase();
        if ("PER_10_GRAMS".equals(unit)) {
            gold24 = gold24.divide(TEN, 2, RoundingMode.HALF_UP);
            gold22 = gold22.divide(TEN, 2, RoundingMode.HALF_UP);
            silver = silver.divide(TEN, 2, RoundingMode.HALF_UP);
        } else if (!"PER_GRAM".equals(unit)) {
            throw new IllegalArgumentException("Feed unit must be PER_GRAM or PER_10_GRAMS.");
        }

        lockRateRow();
        MetalRate current = getOrCreate();
        if (!"AUTO".equalsIgnoreCase(current.getRateMode())) {
            markFetchResult("SKIPPED_MANUAL_MODE");
            Map<String, Object> response = toResponse(current);
            response.put("lastAutoFetchStatus", "SKIPPED_MANUAL_MODE");
            return response;
        }
        if (current.getLastAutoSourceDate() != null
                && !publicationDate.isAfter(current.getLastAutoSourceDate())) {
            markFetchResult("ALREADY_IMPORTED_PUBLICATION_DATE");
            Map<String, Object> response = toResponse(current);
            response.put("lastAutoFetchStatus", "ALREADY_IMPORTED_PUBLICATION_DATE");
            return response;
        }

        RateSnapshot before = snapshotOf(current);
        current.setGold24kRate(gold24);
        current.setGold22kRate(gold22);
        current.setSilverRate(silver);
        current.setRateMode("AUTO");
        current.setOwnerVerified(true);
        current.setRateSource(sourceName);
        current.setSourceReference(request.sourceReference().trim());
        current.setSourcePublishedAt(request.publishedAt());
        current.setRateDate(publicationDate);
        current.setLastAutoSourceDate(publicationDate);
        current.setLastAutoFetchAt(LocalDateTime.now(SHOP_ZONE));
        current.setLastAutoFetchDate(today);
        current.setLastAutoFetchStatus("IMPORTED");
        MetalRate saved = repository.save(current);
        String changeType = "Anandabazar Patrika".equals(sourceName)
                ? "NEWSPAPER_DAILY_IMPORT"
                : "KOLKATA_CITY_DAILY_IMPORT";
        appendHistory(before, snapshotOf(saved), changeType,
                "Verified Kolkata rate snapshot imported from " + sourceName,
                "SYSTEM · DAILY IMPORT");
        return toResponse(saved);
    }

    @Transactional
    public void markFetchResult(String status) {
        LocalDateTime attemptedAt = LocalDateTime.now(SHOP_ZONE);
        LocalDate attemptedDate = attemptedAt.toLocalDate();
        // Update fetch telemetry only. Keep updated_at and rate_date untouched so the
        // displayed publication date and last-rate-change timestamp remain accurate.
        jdbc.update("UPDATE metal_rates SET last_auto_fetch_at = ?, last_auto_fetch_date = ?, last_auto_fetch_status = ? WHERE id = ?",
                attemptedAt, attemptedDate, status, RATE_ROW_ID);
    }

    /** Serialize manual edits and the daily import across concurrent backend instances. */
    private void lockRateRow() {
        jdbc.queryForObject("SELECT id FROM metal_rates WHERE id = ? FOR UPDATE", Long.class, RATE_ROW_ID);
    }

    private MetalRate getOrCreate() {
        return repository.findById(RATE_ROW_ID).orElseGet(() -> repository.save(new MetalRate()));
    }

    private BigDecimal normalize(BigDecimal value, String label) {
        if (value == null || value.signum() <= 0 || value.compareTo(new BigDecimal("100000000")) > 0)
            throw new IllegalArgumentException(label + " rate must be greater than 0 and within the supported limit.");
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private RateSnapshot snapshotOf(MetalRate rate) {
        return new RateSnapshot(rate.getGold24kRate(), rate.getGold22kRate(), rate.getSilverRate(),
                rate.getRateMode(), rate.getRateSource(), rate.getSourceReference(),
                rate.getRateDate(), rate.getSourcePublishedAt());
    }

    private void appendHistory(RateSnapshot before, RateSnapshot after, String type, String note, String changedBy) {
        jdbc.update("""
            INSERT INTO metal_rate_history(
                gold_24k_rate, gold_22k_rate, silver_rate, rate_mode, rate_source, source_reference, changed_by,
                previous_gold_24k_rate, previous_gold_22k_rate, previous_silver_rate,
                new_gold_24k_rate, new_gold_22k_rate, new_silver_rate,
                change_type, change_note, previous_rate_date, new_rate_date,
                previous_source_published_at, new_source_published_at, new_rate_source, new_source_reference)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            before.gold24(), before.gold22(), before.silver(), before.mode(), before.source(), before.reference(), changedBy,
            before.gold24(), before.gold22(), before.silver(), after.gold24(), after.gold22(), after.silver(),
            type, note, before.rateDate(), after.rateDate(), before.publishedAt(), after.publishedAt(), after.source(), after.reference());
    }

    private Map<String, Object> toResponse(MetalRate rate) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("gold24kRate", rate.getGold24kRate());
        out.put("gold22kRate", rate.getGold22kRate());
        out.put("silverRate", rate.getSilverRate());
        out.put("rateMode", rate.getRateMode());
        out.put("rateSource", rate.getRateSource());
        out.put("ownerVerified", rate.isOwnerVerified());
        out.put("sourceReference", rate.getSourceReference());
        out.put("sourcePublishedAt", rate.getSourcePublishedAt());
        out.put("rateDate", rate.getRateDate());
        out.put("lastAutoFetchAt", rate.getLastAutoFetchAt());
        out.put("lastAutoFetchDate", rate.getLastAutoFetchDate());
        out.put("lastAutoSourceDate", rate.getLastAutoSourceDate());
        out.put("lastAutoFetchStatus", rate.getLastAutoFetchStatus());
        out.put("updatedAt", rate.getUpdatedAt());
        LocalDate today = LocalDate.now(SHOP_ZONE);
        boolean rateFreshToday = "AUTO".equalsIgnoreCase(rate.getRateMode())
                && rate.getSourcePublishedAt() != null
                && today.equals(rate.getRateDate());
        out.put("rateFreshToday", rateFreshToday);
        // Backward-compatible alias for older frontend bundles.
        out.put("newspaperVerified", "Anandabazar Patrika".equals(rate.getRateSource())
                && rate.getSourcePublishedAt() != null && today.equals(rate.getRateDate()));
        return out;
    }

    private record RateSnapshot(BigDecimal gold24, BigDecimal gold22, BigDecimal silver,
                                String mode, String source, String reference,
                                LocalDate rateDate, LocalDateTime publishedAt) {}
}
