package com.nkj.billing.model;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

/** Singleton active metal rates. Stored internally per gram to preserve invoice calculations. */
@Entity
@Table(name = "metal_rates", schema = "public")
public class MetalRate {
    @Id private Long id = 1L;

    @Column(name = "gold_24k_rate", nullable = false, precision = 14, scale = 2)
    private BigDecimal gold24kRate = BigDecimal.ZERO;
    @Column(name = "gold_22k_rate", nullable = false, precision = 14, scale = 2)
    private BigDecimal gold22kRate = new BigDecimal("11045.00");
    @Column(name = "silver_rate", nullable = false, precision = 14, scale = 2)
    private BigDecimal silverRate = new BigDecimal("134.00");
    @Column(name = "rate_mode", nullable = false, length = 20)
    private String rateMode = "MANUAL";
    @Column(name = "rate_source", nullable = false, length = 160)
    private String rateSource = "Legacy rate - verify before use";
    @Column(name = "owner_verified", nullable = false)
    private boolean ownerVerified = false;
    @Column(name = "source_reference")
    private String sourceReference;
    @Column(name = "source_published_at")
    private LocalDateTime sourcePublishedAt;
    @Column(name = "rate_date")
    private LocalDate rateDate = LocalDate.now(ZoneId.of("Asia/Kolkata"));
    @Column(name = "last_auto_fetch_at")
    private LocalDateTime lastAutoFetchAt;
    @Column(name = "last_auto_fetch_date")
    private LocalDate lastAutoFetchDate;
    @Column(name = "last_auto_fetch_status", length = 40)
    private String lastAutoFetchStatus = "NOT_CONFIGURED";
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist @PreUpdate
    protected void updateTimestamp() { updatedAt = LocalDateTime.now(ZoneId.of("Asia/Kolkata")); }

    public Long getId() { return id; }
    public BigDecimal getGold24kRate() { return gold24kRate; }
    public void setGold24kRate(BigDecimal value) { gold24kRate = value; }
    public BigDecimal getGold22kRate() { return gold22kRate; }
    public void setGold22kRate(BigDecimal value) { gold22kRate = value; }
    public BigDecimal getSilverRate() { return silverRate; }
    public void setSilverRate(BigDecimal value) { silverRate = value; }
    public String getRateMode() { return rateMode; }
    public void setRateMode(String value) { rateMode = value; }
    public String getRateSource() { return rateSource; }
    public void setRateSource(String value) { rateSource = value; }
    public boolean isOwnerVerified() { return ownerVerified; }
    public void setOwnerVerified(boolean value) { ownerVerified = value; }
    public String getSourceReference() { return sourceReference; }
    public void setSourceReference(String value) { sourceReference = value; }
    public LocalDateTime getSourcePublishedAt() { return sourcePublishedAt; }
    public void setSourcePublishedAt(LocalDateTime value) { sourcePublishedAt = value; }
    public LocalDate getRateDate() { return rateDate; }
    public void setRateDate(LocalDate value) { rateDate = value; }
    public LocalDateTime getLastAutoFetchAt() { return lastAutoFetchAt; }
    public void setLastAutoFetchAt(LocalDateTime value) { lastAutoFetchAt = value; }
    public LocalDate getLastAutoFetchDate() { return lastAutoFetchDate; }
    public void setLastAutoFetchDate(LocalDate value) { lastAutoFetchDate = value; }
    public String getLastAutoFetchStatus() { return lastAutoFetchStatus; }
    public void setLastAutoFetchStatus(String value) { lastAutoFetchStatus = value; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
