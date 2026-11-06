
package com.nkj.billing.model;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.ZoneId;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "invoices", schema = "public")
public class Invoice {

    // ==========================================
    // PRIMARY KEY
    // ==========================================

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // ==========================================
    // INVOICE INFORMATION
    // ==========================================

    @Column(name = "invoice_no", nullable = false, unique = true, length = 100)
    private String invoiceNo;

    @Column(name = "idempotency_key", unique = true, length = 120)
    private String idempotencyKey;

    @Column(name = "customer_name")
    private String customerName;

    @Column(name = "mobile", length = 30)
    private String mobile;

    @Column(name = "address", length = 1000)
    private String address;

    @Column(name = "payment_mode", length = 50)
    private String paymentMode;

    @Column(name = "reference_no", length = 100)
    private String referenceNo;

    // PostgreSQL TEXT for complete invoice JSON details
    @Column(name = "payload_json", columnDefinition = "TEXT")
    private String payloadJson;

    // ==========================================
    // AMOUNT INFORMATION
    // ==========================================

    @Column(name = "new_total", nullable = false, precision = 16, scale = 2)
    private BigDecimal newTotal = BigDecimal.ZERO;

    @Column(name = "old_total", nullable = false, precision = 16, scale = 2)
    private BigDecimal oldTotal = BigDecimal.ZERO;

    @Column(name = "making_charge", nullable = false, precision = 16, scale = 2)
    private BigDecimal makingCharge = BigDecimal.ZERO;

    @Column(name = "extra_charge", nullable = false, precision = 16, scale = 2)
    private BigDecimal extraCharge = BigDecimal.ZERO;

    @Column(name = "discount", nullable = false, precision = 16, scale = 2)
    private BigDecimal discount = BigDecimal.ZERO;

    @Column(name = "sub_total", nullable = false, precision = 16, scale = 2)
    private BigDecimal subTotal = BigDecimal.ZERO;

    @Column(name = "gst_percent", nullable = false, precision = 7, scale = 3)
    private BigDecimal gstPercent = BigDecimal.ZERO;

    @Column(name = "gst_amount", nullable = false, precision = 16, scale = 2)
    private BigDecimal gstAmount = BigDecimal.ZERO;

    @Column(name = "other_charge", nullable = false, precision = 16, scale = 2)
    private BigDecimal otherCharge = BigDecimal.ZERO;

    @Column(name = "grand_total", nullable = false, precision = 16, scale = 2)
    private BigDecimal grandTotal = BigDecimal.ZERO;

    // ==========================================
    // DATE AND TIME
    // ==========================================

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    // ==========================================
    // CONSTRUCTOR
    // ==========================================

    public Invoice() {
    }

    // Automatically generate invoice creation date
    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now(ZoneId.of("Asia/Kolkata"));
        }
    }

    // ==========================================
    // GETTERS AND SETTERS
    // ==========================================

    public Long getId() {
        return id;
    }

    public String getInvoiceNo() {
        return invoiceNo;
    }

    public void setInvoiceNo(String invoiceNo) {
        this.invoiceNo = invoiceNo;
    }

    public String getIdempotencyKey() {
        return idempotencyKey;
    }

    public void setIdempotencyKey(String idempotencyKey) {
        this.idempotencyKey = idempotencyKey;
    }

    public String getCustomerName() {
        return customerName;
    }

    public void setCustomerName(String customerName) {
        this.customerName = customerName;
    }

    public String getMobile() {
        return mobile;
    }

    public void setMobile(String mobile) {
        this.mobile = mobile;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public String getPaymentMode() {
        return paymentMode;
    }

    public void setPaymentMode(String paymentMode) {
        this.paymentMode = paymentMode;
    }

    public String getReferenceNo() {
        return referenceNo;
    }

    public void setReferenceNo(String referenceNo) {
        this.referenceNo = referenceNo;
    }

    public String getPayloadJson() {
        return payloadJson;
    }

    public void setPayloadJson(String payloadJson) {
        this.payloadJson = payloadJson;
    }

    public BigDecimal getNewTotal() {
        return newTotal;
    }

    public void setNewTotal(BigDecimal newTotal) {
        this.newTotal = newTotal == null ? BigDecimal.ZERO : newTotal;
    }

    public BigDecimal getOldTotal() {
        return oldTotal;
    }

    public void setOldTotal(BigDecimal oldTotal) {
        this.oldTotal = oldTotal == null ? BigDecimal.ZERO : oldTotal;
    }

    public BigDecimal getMakingCharge() {
        return makingCharge;
    }

    public void setMakingCharge(BigDecimal makingCharge) {
        this.makingCharge = makingCharge == null ? BigDecimal.ZERO : makingCharge;
    }

    public BigDecimal getExtraCharge() {
        return extraCharge;
    }

    public void setExtraCharge(BigDecimal extraCharge) {
        this.extraCharge = extraCharge == null ? BigDecimal.ZERO : extraCharge;
    }

    public BigDecimal getDiscount() {
        return discount;
    }

    public void setDiscount(BigDecimal discount) {
        this.discount = discount == null ? BigDecimal.ZERO : discount;
    }

    public BigDecimal getSubTotal() {
        return subTotal;
    }

    public void setSubTotal(BigDecimal subTotal) {
        this.subTotal = subTotal == null ? BigDecimal.ZERO : subTotal;
    }

    public BigDecimal getGstPercent() {
        return gstPercent;
    }

    public void setGstPercent(BigDecimal gstPercent) {
        this.gstPercent = gstPercent == null ? BigDecimal.ZERO : gstPercent;
    }

    public BigDecimal getGstAmount() {
        return gstAmount;
    }

    public void setGstAmount(BigDecimal gstAmount) {
        this.gstAmount = gstAmount == null ? BigDecimal.ZERO : gstAmount;
    }

    public BigDecimal getOtherCharge() {
        return otherCharge;
    }

    public void setOtherCharge(BigDecimal otherCharge) {
        this.otherCharge = otherCharge == null ? BigDecimal.ZERO : otherCharge;
    }

    public BigDecimal getGrandTotal() {
        return grandTotal;
    }

    public void setGrandTotal(BigDecimal grandTotal) {
        this.grandTotal = grandTotal == null ? BigDecimal.ZERO : grandTotal;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
