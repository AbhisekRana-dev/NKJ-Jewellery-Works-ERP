package com.nkj.billing.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nkj.billing.controller.MetalRateController.NewspaperImportRequest;
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
 * Polls a configured, authorized Anandabazar Patrika data adapter once each morning.
 * It deliberately does not scrape subscriber pages or guess prices. The adapter must
 * return the documented JSON contract in RATE_SOURCE_SETUP.md.
 */
@Component
public class DailyAnandabazarRateJob {
    private static final Logger log = LoggerFactory.getLogger(DailyAnandabazarRateJob.class);
    private static final ZoneId SHOP_ZONE = ZoneId.of("Asia/Kolkata");

    private final MetalRateService rates;
    private final ObjectMapper mapper;
    private final RestTemplate http;
    private final boolean enabled;
    private final String feedUrl;
    private final String apiKey;

    public DailyAnandabazarRateJob(
            MetalRateService rates,
            ObjectMapper mapper,
            @Value("${nkj.rates.newspaper.enabled:false}") boolean enabled,
            @Value("${nkj.rates.newspaper.url:}") String feedUrl,
            @Value("${nkj.rates.newspaper.api-key:}") String apiKey) {
        this.rates = rates;
        this.mapper = mapper;
        this.enabled = enabled;
        this.feedUrl = feedUrl == null ? "" : feedUrl.trim();
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(5_000);
        requestFactory.setReadTimeout(10_000);
        this.http = new RestTemplate(requestFactory);
    }

    @Scheduled(cron = "0 15 6 * * *", zone = "Asia/Kolkata")
    public void fetchDailyPublishedRates() {
        if (!enabled || feedUrl.isBlank()) {
            rates.markFetchResult("NOT_CONFIGURED");
            log.info("Daily newspaper rates not fetched: authorized feed is not configured.");
            return;
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("Accept", "application/json");
            if (!apiKey.isBlank()) headers.set("x-api-key", apiKey);
            ResponseEntity<String> response = http.exchange(feedUrl, HttpMethod.GET,
                    new HttpEntity<>(headers), String.class);
            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                rates.markFetchResult("FEED_UNAVAILABLE");
                return;
            }

            JsonNode body = mapper.readTree(response.getBody());
            LocalDate publicationDate = LocalDate.parse(requiredText(body, "publicationDate"));
            LocalDateTime publishedAt = parsePublishedAt(requiredText(body, "publishedAt"));
            String unit = requiredText(body, "unit");
            String reference = requiredText(body, "sourceReference");
            BigDecimal gold24 = requiredDecimal(body, "gold24k");
            BigDecimal gold22 = requiredDecimal(body, "gold22k");
            BigDecimal silver = requiredDecimal(body, "silver999");

            if (!publicationDate.equals(LocalDate.now(SHOP_ZONE))) {
                rates.markFetchResult("NO_TODAYS_ISSUE");
                log.info("No current-day Anandabazar issue in configured feed; previous published rates remain active.");
                return;
            }

            rates.importNewspaperRates(new NewspaperImportRequest(
                    gold24, gold22, silver, unit, publicationDate, publishedAt, reference));
        } catch (Exception ex) {
            rates.markFetchResult("FEED_ERROR");
            log.warn("Daily newspaper rate fetch failed; retaining the last verified rates. {}", ex.getMessage());
        }
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
