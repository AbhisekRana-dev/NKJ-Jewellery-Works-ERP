package com.nkj.billing.controller;

import com.nkj.billing.service.ErpModuleService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import javax.sql.DataSource;
import java.sql.Connection;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class ErpModuleController {
    private final ErpModuleService modules;
    private final JdbcTemplate jdbc;
    private final DataSource dataSource;
    private final com.nkj.billing.service.SalesAccountingService salesAccounting;
    private final com.nkj.billing.service.CashFlowService cashFlow;

    public ErpModuleController(
            ErpModuleService modules,
            JdbcTemplate jdbc,
            DataSource dataSource,
            com.nkj.billing.service.SalesAccountingService salesAccounting,
            com.nkj.billing.service.CashFlowService cashFlow) {
        this.modules = modules;
        this.jdbc = jdbc;
        this.dataSource = dataSource;
        this.salesAccounting = salesAccounting;
        this.cashFlow = cashFlow;
    }

    @GetMapping("/modules/{module}")
    public Object list(@PathVariable String module) { return modules.list(module); }

    @GetMapping("/installments/accounts")
    public Object installmentAccounts() {
        return modules.installmentAccounts();
    }

    @GetMapping("/installments/eligible-invoices")
    public Object eligibleInstallmentInvoices(
            @RequestParam(name = "search", required = false) String search) {
        return modules.eligibleInstallmentInvoices(search);
    }

    @PostMapping("/installments/plans")
    public Map<String,Object> createInstallmentPlan(
            @RequestBody Map<String,Object> body,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            jakarta.servlet.http.HttpServletRequest request) throws Exception {
        return modules.createInstallmentPlan(body, idempotencyKey, request.getRemoteAddr());
    }

    @GetMapping("/installments/plans/{accountId}")
    public Map<String,Object> installmentPlanDetails(@PathVariable long accountId) {
        return modules.getInstallmentPlanDetails(accountId);
    }

    @PostMapping("/installments/payments")
    public Map<String,Object> collectInstallmentPayment(
            @RequestBody Map<String,Object> body,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestHeader("X-Admin-Password") String adminPassword,
            jakarta.servlet.http.HttpServletRequest request) throws Exception {
        return modules.collectInstallmentPayment(body, idempotencyKey, adminPassword, request.getRemoteAddr());
    }

    @PutMapping("/installments/schedules/{installmentId}/due-date")
    public Map<String,Object> updateInstallmentDueDate(
            @PathVariable long installmentId,
            @RequestBody Map<String,Object> body,
            jakarta.servlet.http.HttpServletRequest request) {
        return modules.updateInstallmentDueDate(installmentId, body.get("dueDate"), request.getRemoteAddr());
    }

    @PostMapping("/installments/payments/{paymentId}/reverse")
    public Map<String,Object> reverseInstallmentPayment(
            @PathVariable long paymentId,
            @RequestBody Map<String,Object> body,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            jakarta.servlet.http.HttpServletRequest request) throws Exception {
        return modules.reverseInstallmentPayment(paymentId, body, idempotencyKey, request.getRemoteAddr());
    }

    @GetMapping("/transactions")
    public Object transactions(
            @RequestParam(name = "direction", required = false) String direction,
            @RequestParam(name = "search", required = false) String search) {
        return cashFlow.list(direction, search);
    }

    @GetMapping("/transactions/summary")
    public Map<String,Object> transactionSummary() {
        return cashFlow.summary();
    }

    @GetMapping("/transactions/refundable")
    public Object refundableTransactions() {
        return cashFlow.refundableTransactions();
    }

    @PostMapping("/transactions/refunds")
    public Map<String,Object> createRefund(
            @RequestBody Map<String,Object> body,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            jakarta.servlet.http.HttpServletRequest request) {
        return cashFlow.createRefund(body, idempotencyKey, request.getRemoteAddr());
    }

    @PostMapping("/modules/{module}")
    public Map<String,Object> create(@PathVariable String module, @RequestBody Map<String,Object> body,
                                     @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
                                     jakarta.servlet.http.HttpServletRequest request) {
        return modules.create(module, body, request.getRemoteAddr(), idempotencyKey);
    }

    @PutMapping("/modules/{module}/{id}")
    public Map<String,Object> update(@PathVariable String module, @PathVariable long id, @RequestBody Map<String,Object> body,
                                     jakarta.servlet.http.HttpServletRequest request) {
        return modules.update(module, id, body, request.getRemoteAddr());
    }

    @DeleteMapping("/modules/{module}/{id}")
    public Map<String,Object> delete(@PathVariable String module, @PathVariable long id,
                                     jakarta.servlet.http.HttpServletRequest request) {
        return modules.delete(module, id, request.getRemoteAddr());
    }

    @DeleteMapping("/audit-logs/{id}")
    public Map<String,Object> deleteAuditLog(@PathVariable long id, jakarta.servlet.http.HttpServletRequest request) {
        return modules.deleteAuditLog(id, request.getRemoteAddr());
    }

    @GetMapping("/reports/summary")
    public Map<String,Object> reportSummary() {
        Map<String,Object> result = new LinkedHashMap<>();
        result.put("todaySales", salesAccounting.todaySales());
        result.put("monthSales", salesAccounting.monthSales());
        result.put("totalSales", salesAccounting.totalSales());
        result.put("todayExpenses", jdbc.queryForObject("SELECT COALESCE(SUM(amount),0) FROM expenses WHERE expense_date=CURRENT_DATE", BigDecimal.class));
        result.put("monthExpenses", jdbc.queryForObject("SELECT COALESCE(SUM(amount),0) FROM expenses WHERE date_trunc('month', expense_date)=date_trunc('month', CURRENT_DATE)", BigDecimal.class));
        result.put("totalExpenses", jdbc.queryForObject("SELECT COALESCE(SUM(amount),0) FROM expenses", BigDecimal.class));
        result.put("invoiceCount", jdbc.queryForObject("SELECT COUNT(*) FROM invoices", Long.class));
        result.put("customerCount", jdbc.queryForObject("SELECT COUNT(*) FROM customers", Long.class));
        result.put("staffCount", jdbc.queryForObject("SELECT COUNT(*) FROM staff WHERE status='ACTIVE'", Long.class));
        result.put("presentToday", jdbc.queryForObject("SELECT COUNT(*) FROM staff_attendance WHERE attendance_date=CURRENT_DATE AND status='PRESENT'", Long.class));
        result.put("absentToday", jdbc.queryForObject("SELECT COUNT(*) FROM staff_attendance WHERE attendance_date=CURRENT_DATE AND status='ABSENT'", Long.class));
        result.put("openBookings", jdbc.queryForObject("""
            SELECT COUNT(*) FROM pre_booking_bills b
             WHERE b.status IN ('OPEN','IN_PROGRESS')
            """, Long.class));
        result.put("monthlySalaryExpense", jdbc.queryForObject("SELECT COALESCE(SUM(net_salary),0) FROM staff_salary WHERE payroll_month=to_char(CURRENT_DATE,'YYYY-MM')", BigDecimal.class));
        result.put("pendingSalary", jdbc.queryForObject("SELECT COALESCE(SUM(remaining_salary),0) FROM staff_salary WHERE payment_status<>'PAID'", BigDecimal.class));
        result.put("goldStockQuantity", jdbc.queryForObject("SELECT COALESCE(SUM(stock_quantity),0) FROM products WHERE UPPER(COALESCE(metal_type,''))='GOLD'", BigDecimal.class));
        result.put("silverStockQuantity", jdbc.queryForObject("SELECT COALESCE(SUM(stock_quantity),0) FROM products WHERE UPPER(COALESCE(metal_type,''))='SILVER'", BigDecimal.class));
        result.put("lowStockCount", jdbc.queryForObject("SELECT COUNT(*) FROM products WHERE stock_quantity>0 AND stock_quantity<=2 AND status='IN_STOCK'", Long.class));
        result.put("supplierOutstanding", jdbc.queryForObject("SELECT COALESCE(SUM(balance),0) FROM purchases", BigDecimal.class));
        result.put("bookingOutstanding", jdbc.queryForObject("""
            SELECT COALESCE(SUM(b.remaining_amount),0) FROM pre_booking_bills b
             WHERE b.status IN ('OPEN','IN_PROGRESS')
            """, BigDecimal.class));
        // This is deliberately labelled operating result, not net profit: purchases/COGS are not yet reconciled.
        result.put("operatingResultBeforeCogs", ((BigDecimal) result.get("monthSales")).subtract((BigDecimal) result.get("monthExpenses")));
        return result;
    }

    @GetMapping("/database/status")
    public Map<String,Object> databaseStatus() throws Exception {
        try (Connection c = dataSource.getConnection()) {
            var md = c.getMetaData();
            Map<String,Object> result = new LinkedHashMap<>();
            result.put("connected", true); result.put("database", c.getCatalog()); result.put("product", md.getDatabaseProductName());
            result.put("version", md.getDatabaseProductVersion());
            result.put("tableCount", jdbc.queryForObject("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'", Long.class));
            result.put("size", jdbc.queryForObject("SELECT pg_size_pretty(pg_database_size(current_database()))", String.class));
            result.put("lastBackup", "Not configured");
            return result;
        }
    }
}
