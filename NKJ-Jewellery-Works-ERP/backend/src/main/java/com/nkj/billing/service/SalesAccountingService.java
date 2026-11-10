package com.nkj.billing.service;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.time.ZoneId;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * One sales definition shared by the dashboard and sales reports.
 *
 * Normal invoices count once at invoice date. Converted invoices are excluded
 * from that total and instead count their down payment and net installment
 * receipts on their actual receipt dates. Reversals are negative entries on
 * the reversal date.
 */
@Service
public class SalesAccountingService {
    private static final ZoneId SHOP_ZONE = ZoneId.of("Asia/Kolkata");

    private static final String SALES_ENTRIES_CTE = """
        WITH sales_entries(entry_date, amount) AS (
            -- A normal invoice is recognized once at its business invoice date.
            -- An invoice converted to EMI is excluded here and recognized only
            -- through its actual down-payment and installment receipt dates.
            SELECT i.invoice_date, i.grand_total
              FROM public.invoices i
             WHERE NOT EXISTS (
                 SELECT 1
                   FROM public.installment_accounts a
                  WHERE a.invoice_id = i.id
                     OR a.invoice_no = i.invoice_no
             )
            UNION ALL
            -- Count actual cash received for EMI plans. Do not use account
            -- balances or migrated reconciliation entries as new sales.
            SELECT p.payment_date, p.amount
              FROM public.installment_transactions p
             WHERE p.entry_type IN ('DOWN_PAYMENT', 'INSTALLMENT')
               AND p.amount > 0
            UNION ALL
            -- A posted installment receipt reversed later reduces sales on
            -- the reversal date, preserving the historical report timeline.
            SELECT r.reversal_date, -r.amount
              FROM public.installment_transaction_reversals r
              JOIN public.installment_transactions p
                ON p.id = r.transaction_id
             WHERE p.entry_type = 'INSTALLMENT'
               AND r.amount > 0
        )
        """;

    private final JdbcTemplate jdbc;

    public SalesAccountingService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public BigDecimal todaySales() {
        LocalDate today = LocalDate.now(SHOP_ZONE);
        return sum(SALES_ENTRIES_CTE
                + "SELECT COALESCE(SUM(amount),0) FROM sales_entries WHERE entry_date = ?",
                today);
    }

    public BigDecimal monthSales() {
        LocalDate today = LocalDate.now(SHOP_ZONE);
        LocalDate start = today.withDayOfMonth(1);
        LocalDate nextMonth = start.plusMonths(1);
        return jdbc.queryForObject(
                SALES_ENTRIES_CTE
                        + "SELECT COALESCE(SUM(amount),0) FROM sales_entries WHERE entry_date >= ? AND entry_date < ?",
                BigDecimal.class, Date.valueOf(start), Date.valueOf(nextMonth));
    }

    public BigDecimal totalSales() {
        return jdbc.queryForObject(
                SALES_ENTRIES_CTE + "SELECT COALESCE(SUM(amount),0) FROM sales_entries",
                BigDecimal.class);
    }

    private BigDecimal sum(String sql, LocalDate date) {
        BigDecimal amount = jdbc.queryForObject(sql, BigDecimal.class, Date.valueOf(date));
        return amount == null ? BigDecimal.ZERO : amount;
    }
}
