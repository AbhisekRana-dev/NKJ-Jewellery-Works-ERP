package com.nkj.billing.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nkj.billing.controller.MetalRateController.NewspaperImportRequest;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.client.SimpleClientHttpRequestFactory;

/**
 * Daily Kolkata rate importer.
 *
 * Priority:
 * 1) authorized Anandabazar Patrika adapter, when configured;
 * 2) the published All India Bullion Kolkata city snapshot.
 *
 * The job never fabricates a price, never labels fallback data as newspaper
 * data, and keeps the last verified values when both sources are unavailable.
 */
@Component
public class DailyAnandabazarRateJob {
    private static final Logger log = LoggerFactory.getLogger(DailyAnandabazarRateJob.class);
    private static final ZoneId SHOP_ZONE = ZoneId.of("Asia/Kolkata");
    private static final String AIB_SOURCE = "All India Bullion · Kolkata";
    private static final String AIB_REFERENCE = "https://allindiabullion.com/gold-rate/west-bengal/kolkata";

    private static final Pattern GOLD_24K = Pattern.compile(
            "\\b24K\\s+Gold\\s*₹\\s*([0-9,]+(?:\\.[0-9]{1,2})?)\\s*per\\s*10\\s*g\\b",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern GOLD_22K = Pattern.compile(
            "\\b22K\\s+Gold\\s*₹\\s*([0-9,]+(?:\\.[0-9]{1,2})?)\\s*per\\s*10\\s*g\\b",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern SILVER_999 = Pattern.compile(
            "\\bSilver\\s*₹\\s*([0-9,]+(?:\\.[0-9]{1,2})?)\\s*per\\s*kg\\b",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern UPDATED_AT = Pattern.compile(
            "\\bUpdated\\s+(\\d{1,2}\\s+[A-Za-z]+\\s+\\d{4}),\\s*(\\d{1,2}:\\d{2})(?::\\d{2})?\\s+IST\\b",
            Pattern.CASE_INSENSITIVE);

    private static final DateTimeFormatter SOURCE_DATE_FORMAT =
            DateTimeFormatter.ofPattern("d MMMM yyyy", Locale.ENGLISH);
    private static final DateTimeFormatter SOURCE_TIME_FORMAT =
            DateTimeFormatter.ofPattern("H:mm", Locale.ENGLISH);

    private final MetalRateService rates;
    private final ObjectMapper mapper;
    private final RestTemplate http;
    private final boolean anandabazarEnabled;
    private final String anandabazarFeedUrl;
    private final String anandabazarApiKey;
    private final String kolkataFallbackUrl;

    public DailyAnandabazarRateJob(
            MetalRateService rates,
            ObjectMapper mapper,
            @Value("${nkj.rates.newspaper.enabled:false}") boolean anandabazarEnabled,
            @Value("${nkj.rates.newspaper.url:}") String anandabazarFeedUrl,
            @Value("${nkj.rates.newspaper.api-key:}") String anandabazarApiKey,
            @Value("${nkj.rates.kolkata-fallback.url:https://allindiabullion.com/gold-rate/west-bengal/kolkata}") String kolkataFallbackUrl) {
        this.rates = rates;
        this.mapper = mapper;
        this.anandabazarEnabled = anandabazarEnabled;
        this.anandabazarFeedUrl = anandabazarFeedUrl == null ? "" : anandabazarFeedUrl.trim();
        this.anandabazarApiKey = anandabazarApiKey == null ? "" : anandabazarApiKey.trim();
        this.kolkataFallbackUrl = kolkataFallbackUrl == null ? "" : kolkataFallbackUrl.trim();

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(8_000);
        requestFactory.setReadTimeout(15_000);
        this.http = new RestTemplate(requestFactory);
    }

    @Scheduled(cron = "0 15 6 * * *", zone = "Asia/Kolkata")
    public void fetchDailyPublishedRates() {
        if (!rates.isAutoMode()) {
            rates.markFetchResult("SKIPPED_MANUAL_MODE");
            return;
        }

        boolean newspaperConfigured = anandabazarEnabled && !anandabazarFeedUrl.isBlank();
        if (newspaperConfigured) {
            try {
                NewspaperImportRequest newspaper = fetchAnandabazarAdapter();
                Map<String, Object> result = rates.importNewspaperRates(newspaper);
                if ("IMPORTED".equals(result.get("lastAutoFetchStatus"))) {
                    log.info("Imported Kolkata rates from Anandabazar Patrika for {}.", newspaper.publicationDate());
                    return;
                }
                log.info("Anandabazar adapter had no newer publication; trying the Kolkata city fallback.");
            } catch (Exception ex) {
                log.warn("Anandabazar rate feed unavailable or invalid; trying Kolkata city fallback. {}", ex.getMessage());
            }
        }

        if (kolkataFallbackUrl.isBlank()) {
            rates.markFetchResult(newspaperConfigured ? "ALL_SOURCES_FAILED" : "NO_SOURCE_CONFIGURED");
            return;
        }

        try {
            NewspaperImportRequest fallback = fetchAllIndiaBullionKolkata();
            Map<String, Object> result = rates.importNewspaperRates(fallback);
            if ("IMPORTED".equals(result.get("lastAutoFetchStatus"))) {
                log.info("Imported Kolkata rates from All India Bullion for {}.", fallback.publicationDate());
            } else {
                rates.markFetchResult("NO_NEWER_KOLKATA_SNAPSHOT");
                log.info("No newer Kolkata publication snapshot was available; previous verified rates remain active.");
            }
        } catch (Exception ex) {
            rates.markFetchResult(newspaperConfigured ? "ALL_SOURCES_FAILED" : "KOLKATA_FALLBACK_FAILED");
            log.warn("Kolkata automatic rate sources failed; retaining the last verified rates. {}", ex.getMessage());
        }
    }

    private NewspaperImportRequest fetchAnandabazarAdapter() throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Accept", "application/json");
        if (!anandabazarApiKey.isBlank()) headers.set("x-api-key", anandabazarApiKey);
        ResponseEntity<String> response = http.exchange(anandabazarFeedUrl, HttpMethod.GET,
                new HttpEntity<>(headers), String.class);
        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            throw new IllegalStateException("Anandabazar adapter returned no usable response.");
        }

        JsonNode body = mapper.readTree(response.getBody());
        LocalDate publicationDate = LocalDate.parse(requiredText(body, "publicationDate"));
        LocalDateTime publishedAt = parsePublishedAt(requiredText(body, "publishedAt"));
        return new NewspaperImportRequest(
                requiredDecimal(body, "gold24k"),
                requiredDecimal(body, "gold22k"),
                requiredDecimal(body, "silver999"),
                requiredText(body, "unit"),
                publicationDate,
                publishedAt,
                requiredText(body, "sourceReference"),
                "Anandabazar Patrika"
        );
    }

    /**
     * Reads the public Kolkata rate snapshot. The source labels 24K and 22K
     * per 10g and 999 silver per kg. No national benchmark is substituted.
     */
    private NewspaperImportRequest fetchAllIndiaBullionKolkata() throws Exception {
        Document page = Jsoup.connect(kolkataFallbackUrl)
                .userAgent("NKJ-Jewellery-Works-ERP/1.0 (daily Kolkata bullion rate refresh)")
                .timeout(15_000)
                .followRedirects(true)
                .get();

        String title = page.title() == null ? "" : page.title();
        String text = page.text();
        if (!title.toLowerCase(Locale.ROOT).contains("kolkata")
                || !text.toLowerCase(Locale.ROOT).contains("kolkata")
                || !text.toLowerCase(Locale.ROOT).contains("999 silver")) {
            throw new IllegalArgumentException("Fallback page is not an explicitly Kolkata/999 source.");
        }

        BigDecimal gold24Per10g = extractMoney(GOLD_24K, text, "Kolkata 24K gold");
        BigDecimal gold22Per10g = extractMoney(GOLD_22K, text, "Kolkata 22K gold");
        BigDecimal silverPerKg = extractMoney(SILVER_999, text, "Kolkata 999 silver");

        Matcher timestamp = UPDATED_AT.matcher(text);
        if (!timestamp.find()) {
            throw new IllegalArgumentException("Kolkata fallback page has no verifiable publication timestamp.");
        }
        LocalDate publicationDate = LocalDate.parse(timestamp.group(1), SOURCE_DATE_FORMAT);
        LocalDateTime publishedAt = LocalDateTime.of(
                publicationDate,
                java.time.LocalTime.parse(timestamp.group(2), SOURCE_TIME_FORMAT)
        );

        // Silver source is per kilogram. Convert to the ERP's per-10-gram
        // display/import unit; MetalRateService then stores all three per gram.
        BigDecimal silverPer10g = silverPerKg.divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);

        return new NewspaperImportRequest(
                gold24Per10g,
                gold22Per10g,
                silverPer10g,
                "PER_10_GRAMS",
                publicationDate,
                publishedAt,
                AIB_REFERENCE,
                AIB_SOURCE
        );
    }

    private BigDecimal extractMoney(Pattern pattern, String text, String label) {
        Matcher matcher = pattern.matcher(text);
        if (!matcher.find()) throw new IllegalArgumentException("Missing " + label + " value on fallback page.");
        return new BigDecimal(matcher.group(1).replace(",", ""));
    }

    private LocalDateTime parsePublishedAt(String value) {
        try {
            return OffsetDateTime.parse(value).atZoneSameInstant(SHOP_ZONE).toLocalDateTime();
        } catch (java.time.format.DateTimeParseException ignored) {
            return LocalDateTime.parse(value);
        }
    }

    private String requiredText(JsonNode body, String field) {
        JsonNode value = body.get(field);
        if (value == null || value.isNull() || value.asText().isBlank())
            throw new IllegalArgumentException("Missing feed field: " + field);
        return value.asText().trim();
    }

    private BigDecimal requiredDecimal(JsonNode body, String field) {
        JsonNode value = body.get(field);
        if (value == null || !value.isNumber())
            throw new IllegalArgumentException("Missing or non-numeric feed field: " + field);
        return value.decimalValue();
    }
}
