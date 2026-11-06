package com.nkj.billing.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Date;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Provides the single database-backed definition of sales for the ERP.
 *
 * Normal invoices contribute their full invoice total on the invoice date.
 * An invoice linked to an installment booking is excluded from that total;
 * its down payment contributes on the booking date and each installment
 * receipt contributes on the receipt's payment date.
 */
@Service
public class SalesSummaryService {
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Kolkata");

    private static final String SALES_ROWS = """
            SELECT
                i.created_at::date AS sales_date,
                i.grand_total AS amount
            FROM public.invoices i
            WHERE NOT EXISTS (
                SELECT 1
                FROM public.bookings b
                WHERE b.invoice_no = i.invoice_no
                  AND b.is_installment_plan = TRUE
            )

            UNION ALL

            SELECT
                b.booking_date AS sales_date,
                b.advance_amount AS amount
            FROM public.bookings b
            WHERE b.invoice_no IS NOT NULL
              AND b.is_installment_plan = TRUE
              AND b.advance_amount > 0

            UNION ALL

            SELECT
                p.payment_date AS sales_date,
                p.amount AS amount
            FROM public.installment_payments p
            INNER JOIN public.installments ins ON ins.id = p.installment_id
            INNER JOIN public.bookings b ON b.id = ins.booking_id
            WHERE b.invoice_no IS NOT NULL
              AND b.is_installment_plan = TRUE
              AND p.amount > 0
            """;

    private final JdbcTemplate jdbc;

    public SalesSummaryService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Map<String, Object> summary() {
        LocalDate today = LocalDate.now(BUSINESS_ZONE);
        LocalDate monthStart = today.withDayOfMonth(1);

        return jdbc.queryForMap("""
                SELECT
                    COALESCE(SUM(amount) FILTER (WHERE sales_date = ?), 0) AS "todaySales",
                    COALESCE(SUM(amount) FILTER (WHERE sales_date >= ? AND sales_date <= ?), 0) AS "monthSales",
                    COALESCE(SUM(amount), 0) AS "totalSales"
                FROM (
                """ + SALES_ROWS + """
                ) AS sales
                """,
                Date.valueOf(today),
                Date.valueOf(monthStart),
                Date.valueOf(today));
    }

    public Map<String, Object> dashboardTotals() {
        Map<String, Object> summary = summary();
        Map<String, Object> totals = new LinkedHashMap<>();
        totals.put("totalAmount", summary.get("totalSales"));
        totals.put("todayAmount", summary.get("todaySales"));
        return totals;
    }
}
