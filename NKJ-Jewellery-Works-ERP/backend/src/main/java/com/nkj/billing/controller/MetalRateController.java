package com.nkj.billing.controller;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.nkj.billing.service.MetalRateService;

@RestController
@RequestMapping("/api")
public class MetalRateController {
    private final MetalRateService service;
    private final com.nkj.billing.service.DailyAnandabazarRateJob dailyRateJob;

    public MetalRateController(
            MetalRateService service,
            com.nkj.billing.service.DailyAnandabazarRateJob dailyRateJob) {
        this.service = service;
        this.dailyRateJob = dailyRateJob;
    }

    /** Legacy contract: values are per gram to preserve existing invoice calculations. */
    public record RateUpdateRequest(BigDecimal gold24kRate, BigDecimal gold22kRate, BigDecimal silverRate) {}

    /** Internal ingestion contract from an authorized Kolkata rate-feed adapter. */
    public record KolkataRateImportRequest(
            BigDecimal gold24kRate,
            BigDecimal gold22kRate,
            BigDecimal silverRate,
            String unit,
            LocalDate publicationDate,
            LocalDateTime publishedAt,
            String sourceReference,
            String sourceName) {}

    @GetMapping("/rates")
    public Map<String, Object> getPublicRates() {
        return service.getPublicRates();
    }

    @GetMapping("/admin/rates/history")
    public List<Map<String, Object>> history() {
        return service.getHistory();
    }

    @PutMapping("/admin/rates")
    public Map<String, Object> updateRates(@RequestBody RateUpdateRequest request) {
        return service.updateManualRates(request);
    }

    @PutMapping("/admin/rates/auto")
    public Map<String, Object> enableAutoMode() {
        service.enableAutoMode();
        // Switching back to AUTO immediately checks the latest verified
        // Kolkata sources; the same protected job also runs every morning.
        dailyRateJob.fetchDailyPublishedRates();
        return service.getPublicRates();
    }

}
