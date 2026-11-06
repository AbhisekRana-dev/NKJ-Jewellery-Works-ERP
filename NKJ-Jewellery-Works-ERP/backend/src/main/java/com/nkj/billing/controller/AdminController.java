package com.nkj.billing.controller;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.HashSet;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.nkj.billing.model.Invoice;
import com.nkj.billing.repo.InvoiceRepository;
import com.nkj.billing.service.SalesSummaryService;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final InvoiceRepository repo;
    private final SalesSummaryService salesSummary;

    public AdminController(InvoiceRepository repo, SalesSummaryService salesSummary) {
        this.repo = repo;
        this.salesSummary = salesSummary;
    }

    @GetMapping("/dashboard")
    public Map<String, Object> dashboard() {
        List<Invoice> all = repo.findAllByOrderByCreatedAtDesc();

        Map<String, Object> sales = salesSummary.summary();
        BigDecimal totalAmount = (BigDecimal) sales.get("totalSales");
        BigDecimal todayAmount = (BigDecimal) sales.get("todaySales");
        java.time.LocalDate today = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Kolkata"));

        List<Invoice> todays = all.stream()
                .filter(invoice -> invoice.getCreatedAt() != null
                        && invoice.getCreatedAt().toLocalDate().equals(today))
                .toList();

        Set<String> customers = new HashSet<>();
        all.forEach(invoice -> {
            String name = Objects.toString(invoice.getCustomerName(), "").trim();
            if (!name.isEmpty()) {
                String mobile = Objects.toString(invoice.getMobile(), "").trim();
                customers.add(name.toLowerCase(Locale.ROOT) + "|" + mobile);
            }
        });

        List<Map<String, Object>> recent = all.stream().limit(8).map(invoice -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", invoice.getId());
            row.put("invoiceNo", invoice.getInvoiceNo());
            row.put("customerName", Objects.toString(invoice.getCustomerName(), ""));
            row.put("invoiceDate", invoice.getCreatedAt() == null
                    ? ""
                    : invoice.getCreatedAt().toLocalDate().toString());
            row.put("grandTotal", invoice.getGrandTotal());
            row.put("paymentMode", Objects.toString(invoice.getPaymentMode(), ""));
            return row;
        }).toList();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalInvoices", all.size());
        result.put("totalAmount", totalAmount);
        result.put("totalCustomers", customers.size());
        result.put("todayInvoices", todays.size());
        result.put("todayAmount", todayAmount);
        result.put("recent", recent);
        return result;
    }

    private BigDecimal sumGrandTotals(List<Invoice> invoices) {
        return invoices.stream()
                .map(Invoice::getGrandTotal)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    @GetMapping("/customers")
    public List<Map<String, Object>> customers() {
        Map<String, List<Invoice>> grouped = new LinkedHashMap<>();

        repo.findAllByOrderByCreatedAtDesc().forEach(invoice -> {
            String name = Objects.toString(invoice.getCustomerName(), "").trim();
            String mobile = Objects.toString(invoice.getMobile(), "").trim();
            String key = name.toLowerCase(Locale.ROOT) + "|" + mobile;
            grouped.computeIfAbsent(key, ignored -> new ArrayList<>()).add(invoice);
        });

        return grouped.values().stream().map(group -> {
            Invoice first = group.get(0);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("name", Objects.toString(first.getCustomerName(), ""));
            row.put("mobile", Objects.toString(first.getMobile(), ""));
            row.put("address", Objects.toString(first.getAddress(), ""));
            row.put("invoiceCount", group.size());
            row.put("totalAmount", sumGrandTotals(group));
            return row;
        }).toList();
    }
}
