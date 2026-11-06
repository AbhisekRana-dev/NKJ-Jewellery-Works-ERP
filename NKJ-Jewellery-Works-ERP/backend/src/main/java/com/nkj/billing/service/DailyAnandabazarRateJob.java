package com.nkj.billing.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nkj.billing.controller.MetalRateController.KolkataRateImportRequest;
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
 * Daily Kolkata rate importer. It reads only authorized JSON feed adapters.
 *
 * Source priority:
 * 1) Anandabazar Patrika Kolkata feed, when the owner has authorized access;
 * 2) All India Bullion Kolkata feed, when the owner has written permission.
 *
 * The job does not scrape publisher/vendor websites, bypass subscriptions, or
 * treat an embed widget as a backend API. Unconfigured or failed feeds leave
 * the last verified rates untouched.
 */
@Component
public class DailyAnandabazarRateJob {
    private static final Logger log = LoggerFactory.getLogger(DailyAnandabazarRateJob.class);
    private static final ZoneId SHOP_ZONE = ZoneId.of("Asia/Kolkata");
    private static final String ANANDABAZAR_SOURCE = "Anandabazar Patrika";
    private static final String AIB_SOURCE = "All India Bullion · Kolkata";

    private final MetalRateService rates;
    private final ObjectMapper mapper;
    private final RestTemplate http;
    private final boolean anandabazarEnabled;
    private final String anandabazarFeedUrl;
    private final String anandabazarApiKey;
    private final boolean kolkataFallbackEnabled;
    private final String kolkataFallbackFeedUrl;
    private final String kolkataFallbackApiKey;

    public DailyAnandabazarRateJob(
            MetalRateService rates,
            ObjectMapper mapper,
            @Value("${nkj.rates.newspaper.enabled:false}") boolean anandabazarEnabled,
            @Value("${nkj.rates.newspaper.url:}") String anandabazarFeedUrl,
            @Value("${nkj.rates.newspaper.api-key:}") String anandabazarApiKey,
            @Value("${nkj.rates.kolkata-fallback.enabled:false}") boolean kolkataFallbackEnabled,
            @Value("${nkj.rates.kolkata-fallback.url:}") String kolkataFallbackFeedUrl,
            @Value("${nkj.rates.kolkata-fallback.api-key:}") String kolkataFallbackApiKey) {
        this.rates = rates;
        this.mapper = mapper;
        this.anandabazarEnabled = anandabazarEnabled;
        this.anandabazarFeedUrl = anandabazarFeedUrl == null ? "" : anandabazarFeedUrl.trim();
        this.anandabazarApiKey = anandabazarApiKey == null ? "" : anandabazarApiKey.trim();
        this.kolkataFallbackEnabled = kolkataFallbackEnabled;
        this.kolkataFallbackFeedUrl = kolkataFallbackFeedUrl == null ? "" : kolkataFallbackFeedUrl.trim();
        this.kolkataFallbackApiKey = kolkataFallbackApiKey == null ? "" : kolkataFallbackApiKey.trim();

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

        boolean anandabazarConfigured = anandabazarEnabled && !anandabazarFeedUrl.isBlank();
        if (anandabazarConfigured) {
            try {
                KolkataRateImportRequest newspaper = fetchAuthorizedFeed(
                        anandabazarFeedUrl, anandabazarApiKey, ANANDABAZAR_SOURCE,
                        "anandabazar.com");
                Map<String, Object> result = rates.importNewspaperRates(newspaper);
                if ("IMPORTED".equals(result.get("lastAutoFetchStatus"))) {
                    log.info("Imported Kolkata rates from Anandabazar Patrika for {}.", newspaper.publicationDate());
                    return;
                }
                log.info("Anandabazar feed has no newer Kolkata publication; checking the authorized fallback feed.");
            } catch (Exception ex) {
                log.warn("Anandabazar Kolkata feed unavailable or invalid; checking authorized fallback. {}", ex.getMessage());
            }
        }

        boolean fallbackConfigured = kolkataFallbackEnabled && !kolkataFallbackFeedUrl.isBlank();
        if (!fallbackConfigured) {
            rates.markFetchResult(anandabazarConfigured ? "FALLBACK_FEED_NOT_CONFIGURED" : "NO_AUTHORIZED_KOLKATA_SOURCE");
            log.warn("No authorized Kolkata rate feed is configured. Last verified rates remain active.");
            return;
        }

        try {
            KolkataRateImportRequest fallback = fetchAuthorizedFeed(
                    kolkataFallbackFeedUrl, kolkataFallbackApiKey, AIB_SOURCE,
                    "allindiabullion.com");
            Map<String, Object> result = rates.importNewspaperRates(fallback);
            if ("IMPORTED".equals(result.get("lastAutoFetchStatus"))) {
                log.info("Imported Kolkata rates from authorized All India Bullion feed for {}.", fallback.publicationDate());
            } else {
                rates.markFetchResult("NO_NEWER_KOLKATA_SNAPSHOT");
                log.info("No newer authorized Kolkata snapshot is available; previous verified rates remain active.");
            }
        } catch (Exception ex) {
            rates.markFetchResult(anandabazarConfigured ? "ALL_AUTHORIZED_FEEDS_FAILED" : "KOLKATA_FEED_FAILED");
            log.warn("Authorized Kolkata rate feeds failed; retaining last verified values. {}", ex.getMessage());
        }
    }

    private KolkataRateImportRequest fetchAuthorizedFeed(
            String feedUrl,
            String apiKey,
            String sourceName,
            String requiredSourceHost) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Accept", "application/json");
        if (!apiKey.isBlank()) headers.set("x-api-key", apiKey);

        ResponseEntity<String> response = http.exchange(
                feedUrl, HttpMethod.GET, new HttpEntity<>(headers), String.class);
        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            throw new IllegalStateException(sourceName + " feed returned no usable response.");
        }

        JsonNode body = mapper.readTree(response.getBody());
        String city = requiredText(body, "city");
        if (!"Kolkata".equalsIgnoreCase(city.trim())) {
            throw new IllegalArgumentException(sourceName + " feed city must be Kolkata; received: " + city);
        }

        LocalDate publicationDate = LocalDate.parse(requiredText(body, "publicationDate"));
        LocalDateTime publishedAt = parsePublishedAt(requiredText(body, "publishedAt"));
        String sourceReference = requiredText(body, "sourceReference");
        if (!sourceReference.toLowerCase(java.util.Locale.ROOT).contains(requiredSourceHost)) {
            throw new IllegalArgumentException(sourceName + " source reference must point to " + requiredSourceHost);
        }

        return new KolkataRateImportRequest(
                requiredDecimal(body, "gold24k"),
                requiredDecimal(body, "gold22k"),
                requiredDecimal(body, "silver999"),
                requiredText(body, "unit"),
                publicationDate,
                publishedAt,
                sourceReference,
                sourceName
        );
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
        if (value == null || value.isNull() || value.asText().isBlank()) {
            throw new IllegalArgumentException("Missing feed field: " + field);
        }
        return value.asText().trim();
    }

    private java.math.BigDecimal requiredDecimal(JsonNode body, String field) {
        JsonNode value = body.get(field);
        if (value == null || !value.isNumber()) {
            throw new IllegalArgumentException("Missing or non-numeric feed field: " + field);
        }
        return value.decimalValue();
    }
}
