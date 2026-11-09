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
            SELECT i.invoice_date, i.grand_total
              FROM invoices i
             WHERE NOT EXISTS (
                 SELECT 1
                   FROM installment_accounts a
                  WHERE a.invoice_id=i.id OR a.invoice_no=i.invoice_no
             )
            UNION ALL
            SELECT p.payment_date, p.amount
              FROM installment_transactions p
              JOIN installment_accounts a ON a.id=p.account_id
             WHERE p.entry_type = 'DOWN_PAYMENT'
            UNION ALL
            SELECT p.payment_date, p.amount
              FROM installment_transactions p
              JOIN installment_accounts a ON a.id=p.account_id
             WHERE p.entry_type = 'INSTALLMENT'
            UNION ALL
            SELECT r.reversal_date, -r.amount
              FROM installment_transaction_reversals r
              JOIN installment_transactions p ON p.id=r.transaction_id
              JOIN installment_accounts a ON a.id=p.account_id
             WHERE p.entry_type = 'INSTALLMENT'
        )


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
