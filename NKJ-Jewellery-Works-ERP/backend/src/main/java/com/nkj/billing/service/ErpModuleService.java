package com.nkj.billing.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.nkj.billing.model.Customer;

import java.math.BigDecimal;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.*;

@Service
public class ErpModuleService {
    public record Field(String key, String column, String type, String label) {}
    public record Definition(String table, List<Field> fields, List<String> required, boolean writable) {}

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final AuthService auth;
    private final CustomerService customerService;
    private final CashFlowService cashFlow;
    private final Map<String, Definition> definitions = new LinkedHashMap<>();
    private static final Set<String> APPEND_ONLY_MODULES = Set.of(
            "stock-movements", "installment-payments", "salary-payments", "payments");
    private static final Set<String> CASH_CREATE_MODULES = Set.of(
            "payments", "pre-bookings", "expenses", "purchases", "salary", "salary-payments");

    public ErpModuleService(JdbcTemplate jdbc, ObjectMapper mapper, AuthService auth,
                            CustomerService customerService, CashFlowService cashFlow) {
        this.jdbc = jdbc; this.mapper = mapper; this.auth = auth;
        this.customerService = customerService;
        this.cashFlow = cashFlow;
        register("staff", "staff", true, List.of(
            f("fullName","full_name","text","Full name"), f("photoUrl","photo_url","text","Photo URL"),
            f("mobile","mobile","text","Mobile"), f("email","email","text","Email"), f("aadhaarNumber","aadhaar_number","text","Aadhaar number"), f("panNumber","pan_number","text","PAN number"), f("address","address","text","Address"),
            f("dob","dob","date","Date of birth"), f("joiningDate","joining_date","date","Joining date"),
            f("designation","designation","text","Designation"), f("department","department","text","Department"),
            f("monthlySalary","monthly_salary","number","Monthly salary"), f("salaryMethod","salary_method","text","Salary method"),
            f("emergencyContact","emergency_contact","text","Emergency contact"), f("status","status","text","Status"), f("notes","notes","text","Notes")
        ), "fullName");
        register("staff-notes", "staff_notes", true, List.of(
            f("staffId","staff_id","number","Staff ID"), f("noteDate","note_date","date","Note date"),
            f("noteType","note_type","text","Note type"), f("description","description","text","Description"), f("createdBy","created_by","text","Created by")
        ), "staffId", "description");
        register("attendance", "staff_attendance", true, List.of(
            f("staffId","staff_id","number","Staff ID"), f("attendanceDate","attendance_date","date","Attendance date"),
            f("status","status","text","Status"), f("checkIn","check_in","time","Check-in"), f("checkOut","check_out","time","Check-out"),
            f("workingHours","working_hours","number","Working hours"), f("remarks","remarks","text","Remarks")
        ), "staffId", "attendanceDate", "status");
        register("salary", "staff_salary", true, List.of(
            f("staffId","staff_id","number","Staff ID"), f("payrollMonth","payroll_month","text","Payroll month (YYYY-MM)"),
            f("basicSalary","basic_salary","number","Basic salary"), f("allowances","allowances","number","Allowances"),
            f("overtime","overtime","number","Overtime"), f("bonus","bonus","number","Bonus"), f("deductions","deductions","number","Deductions"),
            f("advanceSalary","advance_salary","number","Advance salary"), f("absentDeduction","absent_deduction","number","Unpaid absence deduction"),
            f("netSalary","net_salary","number","Net salary"), f("amountPaid","amount_paid","number","Amount paid"),
            f("remainingSalary","remaining_salary","number","Remaining salary"), f("paymentDate","payment_date","date","Payment date"),
            f("paymentMethod","payment_method","text","Payment method"), f("paymentStatus","payment_status","text","Payment status")
        ), "staffId", "payrollMonth");
        register("expenses", "expenses", true, List.of(
            f("expenseDate","expense_date","date","Expense date"), f("category","category","text","Category"),
            f("description","description","text","Description"), f("amount","amount","number","Amount"),
            f("paidAmount","paid_amount","number","Paid amount"),
            f("paymentStatus","payment_status","text","Payment status"),
            f("paymentMethod","payment_method","text","Payment method"), f("referenceNo","reference_no","text","Reference no.")
        ), "category", "amount");
        register("inventory", "products", true, List.of(
            f("itemCode","item_code","text","Item code"), f("barcode","barcode","text","Barcode"), f("name","name","text","Item name"),
            f("designNo","design_no","text","Design number"), f("category","category","text","Category"), f("metalType","metal_type","text","Metal type"), f("purity","purity","text","Purity"), f("itemType","item_type","text","Item type"), f("hallmarkStatus","hallmark_status","text","Hallmark status"),
            f("grossWeight","gross_weight","number","Gross weight (g)"), f("stoneWeight","stone_weight","number","Stone weight (g)"),
            f("otherDeductions","other_deductions","number","Other deductions (g)"), f("netWeight","net_weight","number","Net weight (g)"),
            f("makingCharge","making_charge","number","Making charge"), f("wastage","wastage","number","Wastage (g)"),
            f("huid","huid","text","HUID"), f("photoUrl","photo_url","text","Item photo"), f("purchaseDate","purchase_date","date","Purchase date"),
            f("purchaseType","purchase_type","text","Purchase type"), f("supplierName","supplier_name","text","Supplier name"), f("supplierInvoiceNo","supplier_invoice_no","text","Supplier invoice no."), f("supplierMobile","supplier_mobile","text","Supplier mobile"), f("purchaseBill","purchase_bill","text","Purchase bill"),
            f("purchasePrice","purchase_price","number","Purchase price"), f("stockQuantity","stock_quantity","number","Stock quantity"), f("reservedQty","reserved_qty","number","Reserved quantity"), f("storeLocation","store_location","text","Store location"), f("lowStockAlert","low_stock_alert","number","Low stock alert"), f("status","status","text","Stock status")
        ), "name");
        register("stock-movements", "inventory_transactions", true, List.of(
            f("productId","product_id","number","Product ID"), f("transactionType","transaction_type","text","Movement type"),
            f("quantity","quantity","number","Quantity"), f("weight","weight","number","Weight"),
            f("referenceType","reference_type","text","Reference type"), f("referenceId","reference_id","number","Reference ID"), f("remarks","remarks","text","Remarks")
        ), "productId", "transactionType", "quantity");
        register("pre-bookings", "pre_booking_bills", true, List.of(
            f("bookingNo","booking_no","text","Booking number"), f("customerName","customer_name","text","Customer name"),
            f("mobile","mobile","text","Mobile"), f("bookingDate","booking_date","date","Booking date"), f("description","description","text","Ornament description"),
            f("metalType","metal_type","text","Metal type"), f("purity","purity","text","Purity"), f("estimatedWeight","estimated_weight","number","Estimated weight"),
            f("estimatedRate","estimated_rate","number","Estimated rate"), f("estimatedValue","estimated_value","number","Estimated value"),
            f("makingEstimate","making_estimate","number","Making estimate"), f("advanceAmount","advance_amount","number","Advance amount"),
            f("remainingAmount","remaining_amount","number","Remaining amount"), f("deliveryDate","delivery_date","date","Expected delivery"), f("status","status","text","Status")
        ), "bookingNo", "customerName");
        register("installments", "installment_schedules", false, List.of(
            f("accountId","account_id","number","Installment Account ID"), f("installmentNo","installment_no","number","Installment no."),
            f("dueDate","due_date","date","Due date"), f("amountDue","amount_due","number","Amount due"),
            f("amountPaid","amount_paid","number","Amount paid"), f("remainingAmount","remaining_amount","number","Remaining amount"),
            f("paymentStatus","payment_status","text","Payment status")
        ), "accountId", "installmentNo", "amountDue");
        register("installment-payments", "installment_transactions", false, List.of(
            f("scheduleId","schedule_id","number","Installment Schedule ID"), f("paymentDate","payment_date","date","Payment date"),
            f("amount","amount","number","Amount"), f("paymentMethod","payment_method","text","Payment method"), f("referenceNo","reference_no","text","Reference no.")
        ), "scheduleId", "amount", "paymentMethod");
        register("suppliers", "suppliers", true, List.of(
            f("supplierCode","supplier_code","text","Supplier ID"), f("name","name","text","Supplier name"), f("phone","phone","text","Phone"), f("email","email","text","Email"),
            f("address","address","text","Address"), f("gstNumber","gst_number","text","GST number"),
            f("openingBalance","opening_balance","number","Opening balance"), f("status","status","text","Status")
        ), "name");
        register("purchases", "purchases", true, List.of(
            f("supplierId","supplier_id","number","Supplier ID"), f("supplierName","supplier_name","text","Supplier name"),
            f("purchaseDate","purchase_date","date","Purchase date"), f("invoiceNo","invoice_no","text","Supplier invoice no."),
            f("totalAmount","total_amount","number","Total amount"), f("paidAmount","paid_amount","number","Paid amount"),
            f("balance","balance","number","Balance"), f("status","status","text","Status")
        ), "supplierName", "purchaseDate", "totalAmount");
        register("payments", "payments", true, List.of(
            f("invoiceId","invoice_id","number","Invoice ID"), f("invoiceNo","invoice_no","text","Invoice no."),
            f("customerName","customer_name","text","Customer name"), f("paymentDate","payment_date","date","Payment date"),
            f("amount","amount","number","Amount"), f("paymentMethod","payment_method","text","Payment method"), f("referenceNo","reference_no","text","Reference no."), f("notes","notes","text","Notes")
        ), "amount", "paymentMethod");
        register("old-gold", "old_gold_exchanges", true, List.of(
            f("invoiceId","invoice_id","number","Invoice ID"), f("customerName","customer_name","text","Customer name"),
            f("description","description","text","Description"), f("purity","purity","text","Purity"), f("weight","weight","number","Weight (g)"),
            f("rate","rate","number","Rate / g"), f("amount","amount","number","Amount"), f("exchangeDate","exchange_date","date","Exchange date")
        ), "customerName", "weight", "rate", "amount");
        register("customers", "customers", true, List.of(
            f("customerCode","customer_code","text","Customer ID"), f("name","name","text","Customer name"), f("phone","phone","text","Phone"),
            f("address","address","text","Address"), f("notes","notes","text","Notes")
        ), "name");
        register("karigars", "karigars", true, List.of(
            f("karigarCode","karigar_code","text","Karigar ID"), f("name","name","text","Karigar name"), f("mobile","mobile","text","Mobile"), f("aadhaarNumber","aadhaar_number","text","Aadhaar number"), f("speciality","speciality","text","Speciality"),
            f("address","address","text","Address"), f("photoUrl","photo_url","text","Photo"), f("rateType","rate_type","text","Rate type"), f("rateValue","rate_value","number","Rate value"), f("status","status","text","Status"), f("notes","notes","text","Notes")
        ), "name");
        register("repairs", "repair_orders", true, List.of(
            f("orderNo","order_no","text","Repair order no."), f("customerName","customer_name","text","Customer name"),
            f("mobile","mobile","text","Mobile"), f("description","description","text","Repair description"),
            f("receivedDate","received_date","date","Received date"), f("deliveryDate","delivery_date","date","Delivery date"),
            f("estimatedCost","estimated_cost","number","Estimated cost"), f("status","status","text","Status")
        ), "description");
        register("audit-logs", "audit_logs", false, List.of(f("actor","actor_identity","text","Actor")), "");
        register("leaves", "staff_leaves", true, List.of(
            f("staffId","staff_id","number","Staff ID"), f("fromDate","from_date","date","From date"), f("toDate","to_date","date","To date"),
            f("leaveType","leave_type","text","Leave type"), f("reason","reason","text","Reason"), f("status","status","text","Approval status")
        ), "staffId", "fromDate", "toDate", "leaveType");
        register("salary-payments", "staff_salary_payments", true, List.of(
            f("salaryId","salary_id","number","Salary record ID"), f("paymentDate","payment_date","date","Payment date"),
            f("amount","amount","number","Amount"), f("paymentMethod","payment_method","text","Payment method"), f("referenceNo","reference_no","text","Reference no.")
        ), "salaryId", "amount", "paymentMethod");
    }

    private Field f(String key, String col, String type, String label) { return new Field(key,col,type,label); }
    private void register(String key, String table, boolean writable, List<Field> fields, String... required) {
        definitions.put(key, new Definition(table, fields, List.of(required), writable));
    }
    public Set<String> moduleNames() { return Collections.unmodifiableSet(definitions.keySet()); }

    public List<Map<String,Object>> list(String module) {
        Definition d = definition(module);
        String select = "id" + d.fields().stream().map(x -> ", " + x.column() + " AS \"" + x.key() + "\"").reduce("", String::concat);
        if (module.equals("customers")) {
            // Customer Management must show the complete customer master.
            return jdbc.queryForList("""
                SELECT id, customer_code AS "customerCode", name, phone,
                       address, notes, created_at AS "createdAt", updated_at AS "updatedAt"
                  FROM customers
                 ORDER BY id DESC
                """);
        }
        if (module.equals("staff")) {
            return jdbc.queryForList("SELECT id, staff_code AS \"staffCode\", full_name AS \"fullName\", photo_url AS \"photoUrl\", mobile, email, aadhaar_number AS \"aadhaarNumber\", pan_number AS \"panNumber\", address, dob, joining_date AS \"joiningDate\", designation, department, monthly_salary AS \"monthlySalary\", salary_method AS \"salaryMethod\", emergency_contact AS \"emergencyContact\", status, notes FROM staff ORDER BY id DESC LIMIT 500");
        }
        if (module.equals("staff-notes")) {
            return jdbc.queryForList("SELECT n.id, n.staff_id AS \"staffId\", s.full_name AS \"staffName\", n.note_date AS \"noteDate\", n.note_type AS \"noteType\", n.description, n.created_by AS \"createdBy\", n.created_at AS \"createdAt\" FROM staff_notes n JOIN staff s ON s.id=n.staff_id ORDER BY n.note_date DESC,n.created_at DESC LIMIT 1000");
        }
        if (module.equals("pre-bookings")) {
            return jdbc.queryForList("""
                SELECT b.id, b.booking_no AS "bookingNo",
                       b.customer_name AS "customerName", b.mobile,
                       b.booking_date AS "bookingDate", b.description,
                       b.metal_type AS "metalType", b.purity,
                       b.estimated_weight AS "estimatedWeight", b.estimated_rate AS "estimatedRate",
                       b.estimated_value AS "estimatedValue", b.making_estimate AS "makingEstimate",
                       b.advance_amount AS "advanceAmount", b.remaining_amount AS "remainingAmount",
                       b.delivery_date AS "deliveryDate", b.status, b.created_at AS "createdAt"
                  FROM pre_booking_bills b
                 ORDER BY b.booking_date DESC,b.id DESC
                 LIMIT 1000
                """);
        }
        if (module.equals("installments")) {
            return jdbc.queryForList("""
                SELECT s.id, s.account_id AS "accountId", a.invoice_id AS "invoiceId",
                       a.invoice_no AS "invoiceNo", a.account_no AS "accountNo",
                       a.customer_name AS "customerName", a.mobile,
                       s.installment_no AS "installmentNo", a.total_installments AS "totalInstallments",
                       s.due_date AS "dueDate", s.amount_due AS "amountDue",
                       s.amount_paid AS "amountPaid", s.remaining_amount AS "remainingAmount",
                       CASE
                         WHEN s.remaining_amount <= 0 THEN 'PAID'
                         WHEN s.amount_paid > 0 AND s.due_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE THEN 'OVERDUE'
                         WHEN s.amount_paid > 0 THEN 'PARTIAL'
                         WHEN s.due_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE THEN 'OVERDUE'
                         WHEN s.due_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE THEN 'DUE'
                         ELSE 'PENDING'
                       END AS "paymentStatus",
                       s.created_at AS "createdAt", s.updated_at AS "updatedAt"
                  FROM installment_schedules s
                  JOIN installment_accounts a ON a.id=s.account_id
                 ORDER BY s.due_date ASC,s.installment_no ASC
                """);
        }
        if (module.equals("installment-payments")) {
            return jdbc.queryForList("""
                SELECT p.id, ('NKJ-EMI-TXN-' || LPAD(p.id::TEXT, 8, '0')) AS "transactionId",
                       p.schedule_id AS "installmentId", a.id AS "accountId",
                       a.invoice_no AS "invoiceNo", a.customer_name AS "customerName",
                       s.installment_no AS "installmentNo", p.entry_type AS "entryType",
                       p.payment_date AS "paymentDate", p.created_at AS "paidAt", p.amount,
                       p.payment_method AS "paymentMethod", p.reference_no AS "referenceNo",
                       p.recorded_by AS "recordedBy", r.amount AS "reversedAmount",
                       r.reversal_date AS "reversalDate", r.reason AS "reversalReason",
                       r.recorded_by AS "reversedBy"
                  FROM installment_transactions p
                  JOIN installment_accounts a ON a.id=p.account_id
                  LEFT JOIN installment_schedules s ON s.id=p.schedule_id
                  LEFT JOIN installment_transaction_reversals r ON r.transaction_id=p.id
                 WHERE p.entry_type IN ('INSTALLMENT','DOWN_PAYMENT')
                 ORDER BY p.payment_date DESC,p.created_at DESC,p.id DESC
                """);
        }
        if (module.equals("attendance")) {
            return jdbc.queryForList("""
                SELECT a.id, a.staff_id AS "staffId", s.staff_code AS "staffCode",
                       s.full_name AS "staffName", a.attendance_date AS "attendanceDate",
                       a.status, a.check_in AS "checkIn", a.check_out AS "checkOut",
                       a.working_hours AS "workingHours", a.remarks,
                       a.attendance_source AS "attendanceSource", a.leave_id AS "leaveId",
                       a.is_system_generated AS "systemGenerated", a.is_locked AS locked,
                       l.leave_type AS "leaveType", l.from_date AS "leaveFromDate",
                       l.to_date AS "leaveToDate"
                  FROM staff_attendance a
                  JOIN staff s ON s.id=a.staff_id
                  LEFT JOIN staff_leaves l ON l.id=a.leave_id
                 ORDER BY a.attendance_date DESC, a.id DESC
                 LIMIT 5000
                """);
        }
        if (module.equals("salary")) {
            return jdbc.queryForList("SELECT a.id, a.staff_id AS \"staffId\", s.staff_code AS \"staffCode\", s.full_name AS \"staffName\", a.payroll_month AS \"payrollMonth\", a.basic_salary AS \"basicSalary\", a.allowances, a.overtime, a.bonus, a.deductions, a.advance_salary AS \"advanceSalary\", a.absent_deduction AS \"absentDeduction\", a.net_salary AS \"netSalary\", a.amount_paid AS \"amountPaid\", a.remaining_salary AS \"remainingSalary\", a.payment_date AS \"paymentDate\", a.payment_method AS \"paymentMethod\", a.payment_status AS \"paymentStatus\" FROM staff_salary a JOIN staff s ON s.id=a.staff_id ORDER BY a.payroll_month DESC LIMIT 500");
        }
        if (module.equals("leaves")) {
            return jdbc.queryForList("""
                SELECT l.id, l.staff_id AS "staffId", s.staff_code AS "staffCode",
                       s.full_name AS "staffName", l.from_date AS "fromDate",
                       l.to_date AS "toDate", l.leave_type AS "leaveType",
                       l.reason, l.status, l.approved_by AS "approvedBy",
                       l.approved_at AS "approvedAt"
                  FROM staff_leaves l
                  JOIN staff s ON s.id=l.staff_id
                 ORDER BY l.from_date DESC, l.id DESC
                 LIMIT 1000
                """);
        }
        if (module.equals("salary-payments")) {
            return jdbc.queryForList("""
                SELECT p.id, p.salary_id AS "salaryId", ss.staff_id AS "staffId",
                       st.staff_code AS "staffCode", st.full_name AS "staffName",
                       ss.payroll_month AS "payrollMonth", ss.net_salary AS "netSalary",
                       ss.amount_paid AS "amountPaid", ss.remaining_salary AS "remainingSalary",
                       p.payment_date AS "paymentDate", p.amount,
                       p.payment_method AS "paymentMethod", p.reference_no AS "referenceNo"
                  FROM staff_salary_payments p
                  JOIN staff_salary ss ON ss.id = p.salary_id
                  JOIN staff st ON st.id = ss.staff_id
                 ORDER BY p.payment_date DESC, p.id DESC
                 LIMIT 500
                """);
        }
        if (module.equals("audit-logs")) return jdbc.queryForList("SELECT id, actor_identity AS \"actor\", action, module, record_id AS \"recordId\", ip_address AS \"ipAddress\", occurred_at AS \"occurredAt\" FROM audit_logs ORDER BY occurred_at DESC LIMIT 500");
        return jdbc.queryForList("SELECT " + select + " FROM " + d.table() + " ORDER BY id DESC LIMIT 500");
    }

    @Transactional(readOnly = true)
    public Map<String,Object> attendanceDashboard(int year, int month) {
        final java.time.YearMonth requestedMonth;
        try {
            requestedMonth = java.time.YearMonth.of(year, month);
        } catch (java.time.DateTimeException ex) {
            throw new IllegalArgumentException("Select a valid attendance month and year.");
        }
        java.time.LocalDate start = requestedMonth.atDay(1);
        java.time.LocalDate end = requestedMonth.atEndOfMonth();
        java.time.LocalDate today = shopToday();

        List<Map<String,Object>> staffRows = jdbc.queryForList("""
            SELECT id, staff_code AS "staffCode", full_name AS "fullName",
                   designation, department, photo_url AS "photoUrl", status
              FROM staff WHERE UPPER(status)='ACTIVE'
             ORDER BY full_name, id
            """);
        List<Map<String,Object>> attendanceRows = jdbc.queryForList("""
            SELECT a.id, a.staff_id AS "staffId", s.staff_code AS "staffCode",
                   s.full_name AS "staffName", a.attendance_date AS "attendanceDate",
                   a.status, a.check_in AS "checkIn", a.check_out AS "checkOut",
                   a.working_hours AS "workingHours", a.remarks,
                   a.attendance_source AS "attendanceSource", a.leave_id AS "leaveId",
                   a.is_system_generated AS "systemGenerated", a.is_locked AS locked,
                   l.leave_type AS "leaveType", l.from_date AS "leaveFromDate",
                   l.to_date AS "leaveToDate"
              FROM staff_attendance a
              JOIN staff s ON s.id=a.staff_id
              LEFT JOIN staff_leaves l ON l.id=a.leave_id
             WHERE UPPER(s.status)='ACTIVE'
               AND a.attendance_date BETWEEN ? AND ?
             ORDER BY s.full_name, a.attendance_date
            """, java.sql.Date.valueOf(start), java.sql.Date.valueOf(end));
        Map<String,Object> todayCounts = jdbc.queryForMap("""
            SELECT COUNT(*) FILTER (WHERE a.status='PRESENT') AS "todayPresent",
                   COUNT(*) FILTER (WHERE a.status='ABSENT') AS "todayAbsent",
                   COUNT(*) FILTER (WHERE a.status='HALF_DAY') AS "todayHalfDay"
              FROM staff s
              LEFT JOIN staff_attendance a
                ON a.staff_id=s.id AND a.attendance_date=?
             WHERE UPPER(s.status)='ACTIVE'
            """, java.sql.Date.valueOf(today));

        Map<String,Object> summary = new LinkedHashMap<>();
        summary.put("totalStaff", staffRows.size());
        summary.put("todayPresent", todayCounts.getOrDefault("todayPresent", 0));
        summary.put("todayAbsent", todayCounts.getOrDefault("todayAbsent", 0));
        summary.put("todayHalfDay", todayCounts.getOrDefault("todayHalfDay", 0));

        Map<String,Object> response = new LinkedHashMap<>();
        response.put("year", year);
        response.put("month", month);
        response.put("monthStart", start.toString());
        response.put("monthEnd", end.toString());
        response.put("today", today.toString());
        response.put("staff", staffRows);
        response.put("records", attendanceRows);
        response.put("summary", summary);
        return response;
    }

    @Transactional(readOnly = true)
    public Map<String,Object> checkAttendanceLeave(long staffId, String dateValue) {
        java.time.LocalDate day = parseDate(dateValue, "Attendance date");
        Map<String,Object> person = jdbc.queryForMap(
                "SELECT id, full_name AS \"staffName\", staff_code AS \"staffCode\", status FROM staff WHERE id=?",
                staffId);
        Map<String,Object> result = new LinkedHashMap<>();
        result.put("staffId", staffId);
        result.put("date", day.toString());
        result.put("allowed", true);
        if (!"ACTIVE".equalsIgnoreCase(String.valueOf(person.get("status")))) {
            result.put("allowed", false);
            result.put("message", "Attendance cannot be added for an inactive staff member.");
            return result;
        }
        List<Map<String,Object>> approved = jdbc.queryForList("""
            SELECT id, leave_type AS "leaveType", from_date AS "fromDate",
                   to_date AS "toDate", reason
              FROM staff_leaves
             WHERE staff_id=? AND UPPER(status)='APPROVED'
               AND from_date<=? AND to_date>=?
             ORDER BY id LIMIT 1
            """, staffId, java.sql.Date.valueOf(day), java.sql.Date.valueOf(day));
        if (!approved.isEmpty()) {
            result.put("allowed", false);
            result.put("message", "Attendance cannot be modified because this employee has an approved leave for the selected date.");
            result.put("leave", approved.get(0));
        }
        return result;
    }

    @Transactional(readOnly = true)
    public List<Map<String,Object>> listStaffNotes(long staffId) {
        return jdbc.queryForList("""
            SELECT n.id, n.staff_id AS "staffId", s.staff_code AS "staffCode",
                   s.full_name AS "staffName", n.note_date AS "noteDate",
                   n.note_type AS "noteType", n.description,
                   n.created_by AS "createdBy", n.created_at AS "createdAt"
              FROM staff_notes n
              JOIN staff s ON s.id = n.staff_id
             WHERE n.staff_id = ?
             ORDER BY n.note_date DESC, n.created_at DESC, n.id DESC
            """, staffId);
    }

    @Transactional
    public Map<String,Object> create(String module, Map<String,Object> body, String ip, String idempotencyKey) {
        Definition d = writableDefinition(module);
        String requestKey = idempotencyKey == null || idempotencyKey.isBlank()
                ? null : requiredIdempotencyKey(idempotencyKey, "cash entry");
        if (CASH_CREATE_MODULES.contains(module) && requestKey == null) {
            throw new IllegalArgumentException("An Idempotency-Key is required to save this financial record safely.");
        }
        if (requestKey != null && CASH_CREATE_MODULES.contains(module)) {
            lockIdempotencyKey("cash-create:" + requestKey);
            List<Map<String,Object>> prior = jdbc.queryForList(
                    "SELECT id, source_record_id, source_module FROM cash_transactions WHERE idempotency_key=?",
                    requestKey);
            if (!prior.isEmpty()) {
                Map<String,Object> saved = prior.get(0);
                String expectedSource = switch (module) {
                    case "payments" -> "PAYMENTS";
                    case "pre-bookings" -> "PRE_BOOKINGS";
                    case "expenses" -> "EXPENSES";
                    case "purchases" -> "PURCHASES";
                    case "salary" -> "SALARY";
                    case "salary-payments" -> "SALARY_PAYMENTS";
                    default -> "";
                };
                if (!expectedSource.equals(String.valueOf(saved.get("source_module")))) {
                    throw new IllegalArgumentException("This Idempotency-Key was already used by another financial module.");
                }
                return Map.of("success", true, "duplicate", true,
                        "id", saved.get("source_record_id"),
                        "transactionId", saved.get("id"),
                        "message", "This cash transaction was already recorded.");
            }
        }
        Map<String,Object> data = new LinkedHashMap<>(body);
        // Browser forms submit empty strings for optional inputs. Convert them to null
        // so empty date/time values do not reach PostgreSQL CAST operations.
        data.replaceAll((key, value) -> value instanceof String text && text.isBlank() ? null : value);
        if (module.equals("staff-notes")) data.putIfAbsent("createdBy", auth.getUsername());
        if (module.equals("pre-bookings") && data.get("bookingNo") == null) data.put("bookingNo", "PENDING-" + UUID.randomUUID());
        if (module.equals("repairs") && data.get("orderNo") == null) data.put("orderNo", "PENDING-" + UUID.randomUUID());
        validate(d, data);
        if (module.equals("payments")
                && nonNegative(data.get("amount"), "Amount received").signum() <= 0) {
            throw new IllegalArgumentException("A customer receipt must contain an amount greater than zero.");
        }
        if (module.equals("customers") && data.get("phone") != null
                && !String.valueOf(data.get("phone")).isBlank()) {
            Customer customer = customerService.registerOrReuseFromInvoice(
                    String.valueOf(data.get("name")),
                    String.valueOf(data.get("phone")),
                    null,
                    data.get("address") == null ? null : String.valueOf(data.get("address")));
            Map<String,Object> auditData = new LinkedHashMap<>(data);
            auditData.put("customerCode", customer.getCustomerCode());
            auditData.put("phoneMatchedExistingCustomer", true);
            audit("CUSTOMER_PHONE_UPSERT", "customers", customer.getId(), null, auditData, ip);
            return Map.of("success", true, "id", customer.getId(),
                    "customerCode", customer.getCustomerCode(),
                    "message", "Customer saved. Existing customers with this phone number are reused.");
        }
        if (module.equals("salary")) {
            if (data.get("basicSalary") == null && data.get("staffId") != null) {
                data.put("basicSalary", jdbc.queryForObject("SELECT monthly_salary FROM staff WHERE id=?", BigDecimal.class, requiredId(data.get("staffId"), "Staff ID")));
            }
            data.putIfAbsent("amountPaid", BigDecimal.ZERO);
            calculateSalary(data);
        }
        if (module.equals("pre-bookings")) calculateBooking(data);
        if (module.equals("purchases")) calculatePurchase(data);
        if (module.equals("expenses")) prepareExpensePayment(data);
        List<Field> included = d.fields().stream().filter(x -> data.containsKey(x.key()) && data.get(x.key()) != null).toList();
        if (included.isEmpty()) throw new IllegalArgumentException("Enter at least one field.");
        String columns = included.stream().map(Field::column).reduce((a,b)->a+", "+b).orElseThrow();
        String placeholders = included.stream().map(x -> x.type().equals("date") ? "CAST(? AS DATE)" : x.type().equals("time") ? "CAST(? AS TIME)" : "?").reduce((a,b)->a+", "+b).orElseThrow();
        Object[] values = included.stream().map(x -> jdbcValue(x, data.get(x.key()))).toArray();
        Long id = jdbc.queryForObject("INSERT INTO " + d.table() + " (" + columns + ") VALUES (" + placeholders + ") RETURNING id", Long.class, values);

        if (module.equals("staff")) {
            String staffCode = "NKJ-STF-" + String.format("%05d", id);
            jdbc.update("UPDATE staff SET staff_code=? WHERE id=?", staffCode, id);
            data.put("staffCode", staffCode);
            String initialNote = data.get("notes") == null ? "" : String.valueOf(data.get("notes")).trim();
            jdbc.update("INSERT INTO staff_notes(staff_id,note_date,note_type,description,created_by) VALUES (?,CURRENT_DATE,'PROFILE CREATED',?,?)",
                    id, initialNote.isBlank() ? "Staff profile created." : initialNote, auth.getUsername());
        }
        if (module.equals("customers") && (data.get("customerCode") == null || String.valueOf(data.get("customerCode")).isBlank())) {
            String customerCode = "NKJ-CUS-" + String.format("%06d", id);
            jdbc.update("UPDATE customers SET customer_code=? WHERE id=?", customerCode, id);
            data.put("customerCode", customerCode);
        }
        if (module.equals("karigars")) {
            String karigarCode = "NKJ-KRG-" + String.format("%06d", id);
            jdbc.update("UPDATE karigars SET karigar_code=? WHERE id=?", karigarCode, id);
            data.put("karigarCode", karigarCode);
        }
        if (module.equals("suppliers") && (data.get("supplierCode") == null || String.valueOf(data.get("supplierCode")).isBlank())) {
            String supplierCode = "NKJ-SUP-" + String.format("%06d", id);
            jdbc.update("UPDATE suppliers SET supplier_code=? WHERE id=?", supplierCode, id);
            data.put("supplierCode", supplierCode);
        }
        if (module.equals("repairs") && String.valueOf(data.get("orderNo")).startsWith("PENDING-")) {
            String datePart = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Kolkata")).format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE);
            String orderNo = "NKJ-RPR-" + datePart + "-" + String.format("%06d", id);
            jdbc.update("UPDATE repair_orders SET order_no=? WHERE id=?", orderNo, id);
            data.put("orderNo", orderNo);
        }
        if (module.equals("inventory") && (data.get("itemCode") == null || String.valueOf(data.get("itemCode")).isBlank())) {
            String itemCode = "NKJ-ITM-" + String.format("%06d", id);
            jdbc.update("UPDATE products SET item_code=? WHERE id=?", itemCode, id);
            data.put("itemCode", itemCode);
        }
        if (module.equals("pre-bookings")) {
            String bookingNo = "NKJ-BKG-" + java.time.LocalDate.now(java.time.ZoneId.of("Asia/Kolkata")).format(java.time.format.DateTimeFormatter.ofPattern("ddMMyy")) + "-" + String.format("%04d", id);
            if (String.valueOf(data.get("bookingNo")).startsWith("PENDING-")) {
                jdbc.update("UPDATE pre_booking_bills SET booking_no=? WHERE id=?", bookingNo, id);
                data.put("bookingNo", bookingNo);
            }
            BigDecimal advance = nonNegative(data.get("advanceAmount"), "Advance amount");
            if (advance.signum() > 0) {
                jdbc.update("INSERT INTO customer_ledger(entry_type,reference_type,reference_id,credit,notes) VALUES ('BOOKING_ADVANCE','BOOKING',?,?,?)",
                    id, advance, "Advance received for " + data.get("bookingNo") + " / " + data.get("customerName"));
                cashFlow.recordMovement("PRE_BOOKINGS", "ADVANCE_RECEIPT", id,
                        "PREBOOK-ADVANCE:" + id,
                        shopToday(), advance, String.valueOf(data.get("customerName")),
                        "Pre-Booking advance received", null, null,
                        String.valueOf(data.get("bookingNo")), requestKey, null);
            }
        }
        if (module.equals("payments")) {
            BigDecimal received = nonNegative(data.get("amount"), "Payment amount");
            if (received.signum() > 0) {
                cashFlow.recordMovement("PAYMENTS", "CUSTOMER_RECEIPT", id,
                        "PAYMENT:" + id,
                        data.get("paymentDate") == null ? shopToday() : parseDate(data.get("paymentDate"), "Payment date"),
                        received,
                        data.get("customerName") == null ? "Customer" : String.valueOf(data.get("customerName")),
                        data.get("invoiceId") == null ? "Customer advance / receipt" : "Invoice collection",
                        data.get("paymentMethod") == null ? "Cash" : String.valueOf(data.get("paymentMethod")),
                        data.get("referenceNo") == null ? null : String.valueOf(data.get("referenceNo")),
                        data.get("invoiceNo") == null ? "PAY-" + id : String.valueOf(data.get("invoiceNo")),
                        requestKey, null);
            }
        }
        if (module.equals("expenses")) {
            BigDecimal paid = nonNegative(data.get("paidAmount"), "Paid expense amount");
            if (paid.signum() > 0) {
                cashFlow.recordMovement("EXPENSES", "EXPENSE_PAYMENT", id,
                        expenseEventKey(id, paid),
                        shopToday(), paid, null,
                        data.get("description") == null ? String.valueOf(data.get("category")) : String.valueOf(data.get("description")),
                        data.get("paymentMethod") == null ? null : String.valueOf(data.get("paymentMethod")),
                        data.get("referenceNo") == null ? null : String.valueOf(data.get("referenceNo")),
                        String.valueOf(data.get("category")), requestKey, null);
            }
        }
        if (module.equals("purchases")) {
            BigDecimal paid = nonNegative(data.get("paidAmount"), "Paid supplier amount");
            if (paid.signum() > 0) {
                cashFlow.recordMovement("PURCHASES", "SUPPLIER_PAYMENT", id,
                        "PURCHASE-INITIAL:" + id,
                        shopToday(), paid, String.valueOf(data.get("supplierName")), "Supplier purchase payment",
                        null, null,
                        data.get("invoiceNo") == null ? "PURCHASE-" + id : String.valueOf(data.get("invoiceNo")),
                        requestKey, null);
            }
        }
        if (module.equals("salary")) {
            BigDecimal paid = nonNegative(data.get("amountPaid"), "Amount paid");
            if (paid.signum() > 0) {
                String staffName = jdbc.queryForObject("SELECT full_name FROM staff WHERE id=?",
                        String.class, requiredId(data.get("staffId"), "Staff ID"));
                cashFlow.recordMovement("SALARY", "INITIAL_SALARY_PAYMENT", id,
                        "SALARY-INITIAL:" + id,
                        data.get("paymentDate") == null ? shopToday() : parseDate(data.get("paymentDate"), "Payment date"),
                        paid, staffName, "Initial salary payment",
                        data.get("paymentMethod") == null ? null : String.valueOf(data.get("paymentMethod")),
                        null, "SALARY-" + id, requestKey, null);
            }
        }
        if (module.equals("installment-payments")) {
            throw new IllegalArgumentException("Installment receipts must be posted through the protected idempotent payment endpoint.");
        }
        if (module.equals("salary-payments")) {
            applySalaryReceipt(data);
            BigDecimal paid = nonNegative(data.get("amount"), "Salary payment amount");
            if (paid.signum() > 0) {
                long salaryId = requiredId(data.get("salaryId"), "Salary record ID");
                String staffName = jdbc.queryForObject("""
                    SELECT s.full_name FROM staff_salary ss
                    JOIN staff s ON s.id=ss.staff_id WHERE ss.id=?
                    """, String.class, salaryId);
                cashFlow.recordMovement("SALARY_PAYMENTS", "SALARY_PAYMENT", id,
                        "SALARY-PAYMENT:" + id,
                        data.get("paymentDate") == null ? shopToday() : parseDate(data.get("paymentDate"), "Payment date"),
                        paid, staffName, "Staff salary payment",
                        data.get("paymentMethod") == null ? null : String.valueOf(data.get("paymentMethod")),
                        data.get("referenceNo") == null ? null : String.valueOf(data.get("referenceNo")),
                        "SALARY-" + salaryId, requestKey, null);
            }
        }
        if (module.equals("stock-movements")) applyStockMovement(data);
        audit("CREATE", module, id, null, data, ip);
        return Map.of("success", true, "id", id, "message", "Record created successfully.");
    }

    @Transactional(readOnly = true)
    public List<Map<String,Object>> installmentAccounts() {
        return jdbc.queryForList("""
            SELECT a.id, a.account_no AS "accountNo", a.invoice_id AS "invoiceId",
                   a.invoice_no AS "invoiceNo",
                   COALESCE(inv.customer_name,a.customer_name) AS "customerName",
                   COALESCE(inv.mobile,a.mobile) AS mobile,
                   COALESCE(inv.address,a.customer_address) AS address,
                   inv.invoice_date AS "invoiceDate",
                   a.original_invoice_amount AS "originalInvoiceAmount",
                                      a.down_payment AS "advanceAmount",
                   a.down_payment_date AS "downPaymentDate",
                   a.down_payment_method AS "downPaymentMethod",
                   a.down_payment_reference_no AS "downPaymentReferenceNo",
                   a.down_payment_recorded_by AS "downPaymentRecordedBy",
                   a.remaining_balance AS "remainingAmount",
                   a.total_installments AS "totalInstallments",
                   a.payment_frequency AS "paymentFrequency",
                   a.plan_created_date AS "planCreatedDate",
                   a.status, a.created_at AS "createdAt"
              FROM installment_accounts a
              LEFT JOIN invoices inv ON inv.id=a.invoice_id
             ORDER BY a.plan_created_date DESC,a.id DESC
            """);
    }

    /**
     * Invoice selector: default to the last three Kolkata calendar dates.
     * A non-empty search explicitly includes older saved invoices.
     * Converted invoices are excluded only by their dedicated EMI account row;
     * Pre-Booking records are not consulted or modified by this workflow.
     */
    @Transactional(readOnly = true)
    public List<Map<String,Object>> eligibleInstallmentInvoices(String search) {
        String query = search == null ? "" : search.trim();
        String pattern = "%" + query.toLowerCase(Locale.ROOT) + "%";
        return jdbc.queryForList("""
            SELECT i.id, i.invoice_no AS "invoiceNo",
                   i.invoice_date AS "invoiceDate",
                   i.customer_name AS "customerName", i.mobile,
                   i.address, i.grand_total AS "grandTotal"
              FROM invoices i
             WHERE BTRIM(COALESCE(i.invoice_no,'')) <> ''
               AND UPPER(COALESCE(
                    NULLIF(i.payload_json,'')::jsonb->>'status',
                    NULLIF(i.payload_json,'')::jsonb->>'invoiceStatus',
                    'SAVED'
               )) NOT IN ('DRAFT','CANCELLED','CANCELED','VOID','DELETED')
               AND LOWER(COALESCE(
                    NULLIF(i.payload_json,'')::jsonb->>'cancelled',
                    NULLIF(i.payload_json,'')::jsonb->>'isCancelled',
                    NULLIF(i.payload_json,'')::jsonb->>'is_cancelled',
                    NULLIF(i.payload_json,'')::jsonb->>'deleted',
                    NULLIF(i.payload_json,'')::jsonb->>'isDeleted',
                    NULLIF(i.payload_json,'')::jsonb->>'isDraft',
                    NULLIF(i.payload_json,'')::jsonb->>'draft',
                    'false'
               )) <> 'true'
               AND NOT EXISTS (
                   SELECT 1
                     FROM installment_accounts a
                    WHERE a.invoice_id=i.id
                       OR a.invoice_no=i.invoice_no
               )
               AND (
                    ( ? = '' AND i.invoice_date >=
                        (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE - INTERVAL '2 days'
                        AND i.invoice_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE
                    )
                    OR
                    ( ? <> '' AND i.invoice_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE
                        AND (
                            LOWER(COALESCE(i.invoice_no,'')) LIKE ?
                            OR LOWER(COALESCE(i.customer_name,'')) LIKE ?
                            OR LOWER(COALESCE(i.mobile,'')) LIKE ?
                        )
                    )
               )
             ORDER BY i.invoice_date DESC, i.created_at DESC, i.id DESC
             LIMIT 500
            """, query, query, pattern, pattern, pattern);
    }

    /**
     * Convert a saved invoice into an EMI account. This workflow writes only to
     * installment_accounts, installment_schedules and installment_transactions.
     * It never creates or updates a Pre-Booking (bookings) record.
     */
    @Transactional(rollbackFor = Exception.class)
    public Map<String,Object> createInstallmentPlan(
            Map<String,Object> request, String idempotencyKey, String ip) throws JsonProcessingException {
        if (request == null) throw new IllegalArgumentException("Installment plan details are required.");
        String key = requiredIdempotencyKey(idempotencyKey, "plan");
        lockIdempotencyKey("installment-plan:" + key);

        List<Map<String,Object>> existingByKey = jdbc.queryForList("""
            SELECT id, account_no AS "accountNo", invoice_no AS "invoiceNo",
                   total_installments AS "totalInstallments", plan_request_json AS "planRequestJson"
              FROM installment_accounts
             WHERE plan_idempotency_key=?
             LIMIT 1
            """, key);
        if (!existingByKey.isEmpty()) {
            Map<String,Object> existing = existingByKey.get(0);
            JsonNode priorRequest = mapper.readTree(String.valueOf(existing.get("planRequestJson")));
            JsonNode retryRequest = mapper.valueToTree(request);
            if (!priorRequest.equals(retryRequest)) {
                throw new IllegalArgumentException("This installment plan idempotency key was already used for different invoice or schedule details.");
            }
            long existingId = ((Number) existing.get("id")).longValue();
            long scheduleCount = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM installment_schedules WHERE account_id=?",
                    Long.class, existingId);
            return Map.of("success", true, "accountId", existingId,
                    "accountNo", String.valueOf(existing.get("accountNo")),
                    "invoiceNo", String.valueOf(existing.get("invoiceNo")),
                    "totalInstallments", existing.get("totalInstallments") == null ? 0 : existing.get("totalInstallments"),
                    "scheduleCount", scheduleCount, "duplicate", true,
                    "message", "This installment plan was already created.");
        }

        long invoiceId = requiredId(request.get("invoiceId"), "Invoice ID");
        Map<String,Object> invoice = jdbc.queryForMap("""
            SELECT id, invoice_no, customer_name, mobile, address, grand_total
              FROM invoices
             WHERE id=?
             FOR UPDATE
            """, invoiceId);
        String invoiceNo = String.valueOf(invoice.get("invoice_no"));
        BigDecimal invoiceTotal = decimal(invoice.get("grand_total"))
                .setScale(2, java.math.RoundingMode.HALF_UP);
        if (invoiceTotal.signum() <= 0) {
            throw new IllegalArgumentException("The selected invoice has no payable amount.");
        }

        Long duplicate = jdbc.queryForObject("""
            SELECT COUNT(*)
              FROM installment_accounts
             WHERE invoice_id=? OR invoice_no=?
            """, Long.class, invoiceId, invoiceNo);
        if (duplicate != null && duplicate > 0) {
            throw new IllegalArgumentException("Invoice " + invoiceNo + " has already been converted into an installment plan.");
        }

        int count;
        try {
            count = decimal(request.get("installmentCount")).intValueExact();
        } catch (ArithmeticException | NumberFormatException ex) {
            throw new IllegalArgumentException("Select a whole number of installments from 1 to 12.");
        }
        if (count < 1 || count > 12) {
            throw new IllegalArgumentException("The total number of installments must be between 1 and 12.");
        }

        BigDecimal downPayment = nonNegative(request.get("downPayment"), "Down payment")
                .setScale(2, java.math.RoundingMode.HALF_UP);
        if (downPayment.compareTo(invoiceTotal) > 0) {
            throw new IllegalArgumentException("Down payment cannot exceed the original invoice amount.");
        }
        BigDecimal remainingBalance = invoiceTotal.subtract(downPayment)
                .setScale(2, java.math.RoundingMode.UNNECESSARY);
        String frequency = request.get("paymentFrequency") == null
                ? "MONTHLY" : String.valueOf(request.get("paymentFrequency")).trim().toUpperCase(Locale.ROOT);
        if (!"MONTHLY".equals(frequency) && !"WEEKLY".equals(frequency)) {
            throw new IllegalArgumentException("Payment frequency must be MONTHLY or WEEKLY.");
        }
        java.time.LocalDate firstDueDate = parseDate(request.get("firstDueDate"), "First due date");
        java.time.LocalDate downPaymentDate = request.get("downPaymentDate") == null
                ? java.time.LocalDate.now(java.time.ZoneId.of("Asia/Kolkata"))
                : parseDate(request.get("downPaymentDate"), "Down payment date");
        java.time.LocalDate today = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Kolkata"));
        if (downPaymentDate.isAfter(today)) {
            throw new IllegalArgumentException("Down payment date cannot be in the future.");
        }
        int dueDay;
        try {
            dueDay = request.get("dueDay") == null
                    ? firstDueDate.getDayOfMonth()
                    : decimal(request.get("dueDay")).intValueExact();
        } catch (ArithmeticException ex) {
            throw new IllegalArgumentException("Monthly due day must be a whole number from 1 to 31.");
        }
        if (dueDay < 1 || dueDay > 31) {
            throw new IllegalArgumentException("Monthly due day must be between 1 and 31.");
        }

        String downPaymentMethod = String.valueOf(request.getOrDefault("downPaymentMethod", "Cash")).trim();
        if (!Set.of("Cash", "UPI", "Bank Transfer", "Card", "Cheque", "NEFT", "RTGS").contains(downPaymentMethod)) {
            throw new IllegalArgumentException("Select a valid down payment method.");
        }
        String downPaymentReference = request.get("downPaymentReferenceNo") == null
                ? "" : String.valueOf(request.get("downPaymentReferenceNo")).trim();
        if (downPaymentReference.length() > 100) {
            throw new IllegalArgumentException("Down payment reference cannot exceed 100 characters.");
        }

        List<BigDecimal> amounts = new ArrayList<>();
        if (remainingBalance.signum() > 0) {
            long availablePaise = remainingBalance.movePointRight(2).longValueExact();
            if (availablePaise < count) {
                throw new IllegalArgumentException("The remaining balance is too small to create " + count + " positive two-decimal installments.");
            }
            BigDecimal base = remainingBalance.divide(BigDecimal.valueOf(count), 2, java.math.RoundingMode.HALF_UP);
            BigDecimal allocated = BigDecimal.ZERO.setScale(2);
            for (int number = 1; number <= count; number++) {
                BigDecimal amount = number == count ? remainingBalance.subtract(allocated) : base;
                if (amount.signum() <= 0) {
                    throw new IllegalArgumentException("The selected installment count would create a zero or negative final installment. Select fewer installments.");
                }
                amounts.add(amount.setScale(2, java.math.RoundingMode.UNNECESSARY));
                allocated = allocated.add(amount).setScale(2, java.math.RoundingMode.UNNECESSARY);
            }
            if (allocated.compareTo(remainingBalance) != 0) {
                throw new IllegalStateException("The calculated installment schedule does not equal the remaining invoice balance.");
            }
        }

        String accountNoSeed = "PENDING-EMI-" + UUID.randomUUID();
        Long accountId = jdbc.queryForObject("""
            INSERT INTO installment_accounts(
                account_no, invoice_id, invoice_no, customer_name, mobile, customer_address,
                original_invoice_amount, down_payment, down_payment_date, down_payment_method,
                down_payment_reference_no, down_payment_recorded_by, remaining_balance,
                total_installments, payment_frequency, plan_idempotency_key, plan_request_json,
                status, plan_created_date, converted_at, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())
            RETURNING id
            """, Long.class,
            accountNoSeed, invoiceId, invoiceNo, invoice.get("customer_name"), invoice.get("mobile"),
            invoice.get("address"), invoiceTotal, downPayment, downPaymentDate,
            downPayment.signum() > 0 ? downPaymentMethod : null,
            downPaymentReference.isBlank() ? null : downPaymentReference,
            downPayment.signum() > 0 ? auth.getUsername() : null,
            remainingBalance, count, frequency, key, mapper.writeValueAsString(request),
            remainingBalance.signum() == 0 ? "COMPLETED" : "OPEN", today);

        String accountNo = "NKJ-EMI-" + today.format(java.time.format.DateTimeFormatter.ofPattern("ddMMyy"))
                + "-" + String.format(Locale.ROOT, "%04d", accountId);
        jdbc.update("UPDATE installment_accounts SET account_no=? WHERE id=?", accountNo, accountId);

        // Reclassify any receipt posted when this invoice was originally saved.
        // The installment plan's actual down payment is recorded below; keeping
        // the original full invoice receipt would double-count cash received.
        String conversionReason = "Original invoice collection reclassified when invoice was converted to an installment plan.";
        cashFlow.voidMovement("INVOICE-SAVED:" + invoiceId, conversionReason);
        List<Long> originalPaymentIds = jdbc.queryForList(
                "SELECT id FROM payments WHERE invoice_id=? AND amount>0 ORDER BY id",
                Long.class, invoiceId);
        for (Long originalPaymentId : originalPaymentIds) {
            cashFlow.voidMovement("PAYMENT:" + originalPaymentId, conversionReason);
        }

        if (downPayment.signum() > 0) {
            Long downPaymentId = jdbc.queryForObject("""
                INSERT INTO installment_transactions(
                    account_id, schedule_id, entry_type, payment_date, amount,
                    payment_method, reference_no, idempotency_key, recorded_by, created_at
                )
                VALUES (?, NULL, 'DOWN_PAYMENT', ?, ?, ?, ?, ?, ?, NOW())
                RETURNING id
                """, Long.class, accountId, java.sql.Date.valueOf(downPaymentDate), downPayment,
                    downPaymentMethod, downPaymentReference.isBlank() ? "DOWN PAYMENT" : downPaymentReference,
                    "PLAN-DOWNPAY-" + accountId, auth.getUsername());
            cashFlow.recordMovement("INSTALLMENTS", "DOWN_PAYMENT", downPaymentId,
                    "INSTALLMENT:" + downPaymentId, downPaymentDate, downPayment,
                    String.valueOf(invoice.get("customer_name")), "Installment plan down payment",
                    downPaymentMethod, downPaymentReference,
                    invoiceNo, null, null);
        }

        List<Map<String,Object>> createdSchedule = new ArrayList<>();
        for (int index = 0; index < amounts.size(); index++) {
            int number = index + 1;
            java.time.LocalDate dueDate;
            if ("WEEKLY".equals(frequency)) {
                dueDate = firstDueDate.plusWeeks(index);
            } else if (index == 0) {
                dueDate = firstDueDate;
            } else {
                java.time.YearMonth month = java.time.YearMonth.from(firstDueDate).plusMonths(index);
                dueDate = month.atDay(Math.min(dueDay, month.lengthOfMonth()));
            }
            BigDecimal amount = amounts.get(index);
            String initialStatus = dueDate.isBefore(today) ? "OVERDUE"
                    : dueDate.isEqual(today) ? "DUE" : "PENDING";
            Long scheduleId = jdbc.queryForObject("""
                INSERT INTO installment_schedules(
                    account_id, installment_no, due_date, amount_due, amount_paid,
                    remaining_amount, payment_status, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, 0, ?, ?, NOW(), NOW())
                RETURNING id
                """, Long.class, accountId, number, java.sql.Date.valueOf(dueDate),
                    amount, amount, initialStatus);
            Map<String,Object> scheduleRow = new LinkedHashMap<>();
            scheduleRow.put("id", scheduleId);
            scheduleRow.put("accountId", accountId);
            scheduleRow.put("installmentNo", number);
            scheduleRow.put("totalInstallments", count);
            scheduleRow.put("dueDate", dueDate.toString());
            scheduleRow.put("amountDue", amount);
            scheduleRow.put("amountPaid", BigDecimal.ZERO.setScale(2));
            scheduleRow.put("remainingAmount", amount);
            scheduleRow.put("paymentStatus", initialStatus);
            createdSchedule.add(scheduleRow);
        }

        Map<String,Object> auditValues = new LinkedHashMap<>();
        auditValues.put("invoiceId", invoiceId);
        auditValues.put("invoiceNo", invoiceNo);
        auditValues.put("accountId", accountId);
        auditValues.put("accountNo", accountNo);
        auditValues.put("originalInvoiceAmount", invoiceTotal);
        auditValues.put("downPayment", downPayment);
        auditValues.put("downPaymentDate", downPaymentDate);
        auditValues.put("remainingBalance", remainingBalance);
        auditValues.put("totalInstallments", count);
        auditValues.put("paymentFrequency", frequency);
        auditValues.put("scheduledCount", amounts.size());
        audit("INSTALLMENT_PLAN_CREATED", "installment-accounts", accountId, null, auditValues, ip);
        audit("INVOICE_SALES_REVERSED_FOR_INSTALLMENT", "invoices", invoiceId,
                Map.of("invoiceNo", invoiceNo, "salesAmount", invoiceTotal),
                Map.of("installmentAccountId", accountId, "downPayment", downPayment,
                        "downPaymentDate", downPaymentDate, "futureReceiptsCountAsSalesOnReceiptDate", true), ip);

        Map<String,Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("accountId", accountId);
        response.put("accountNo", accountNo);
        response.put("invoiceId", invoiceId);
        response.put("invoiceNo", invoiceNo);
        response.put("originalInvoiceAmount", invoiceTotal);
        response.put("downPayment", downPayment);
        response.put("remainingBalance", remainingBalance);
        response.put("totalInstallments", count);
        response.put("scheduleCount", amounts.size());
        response.put("schedule", createdSchedule);
        response.put("message", remainingBalance.signum() == 0
                ? "Invoice fully paid by down payment; no installment schedule was necessary."
                : "Installment plan and server-calculated schedule created.");
        return response;
    }

    @Transactional(readOnly = true)
    public Map<String,Object> getInstallmentPlanDetails(long accountId) {
        Map<String,Object> account = jdbc.queryForMap("""
            SELECT a.id AS "accountId", a.account_no AS "accountNo",
                   a.invoice_id AS "invoiceId", a.invoice_no AS "invoiceNo",
                   COALESCE(inv.customer_name,a.customer_name) AS "customerName",
                   COALESCE(inv.mobile,a.mobile) AS mobile,
                   COALESCE(inv.address,a.customer_address) AS "customerAddress",
                   inv.invoice_date AS "invoiceDate",
                   inv.payment_mode AS "originalPaymentMode",
                   a.original_invoice_amount AS "originalInvoiceAmount",
                   GREATEST(a.original_invoice_amount-a.remaining_balance,0) AS "paidAmount",
                   a.down_payment AS "downPayment", a.down_payment_date AS "downPaymentDate",
                   a.down_payment_method AS "downPaymentMethod",
                   a.down_payment_reference_no AS "downPaymentReferenceNo",
                   a.down_payment_recorded_by AS "downPaymentRecordedBy",
                   a.remaining_balance AS "remainingBalance",
                   a.total_installments AS "totalInstallments",
                   a.payment_frequency AS "paymentFrequency",
                   a.plan_created_date AS "planCreatedDate", a.status
              FROM installment_accounts a
              LEFT JOIN invoices inv ON inv.id=a.invoice_id
             WHERE a.id=?
            """, accountId);

        List<Map<String,Object>> schedule = jdbc.queryForList("""
            SELECT s.id, s.account_id AS "accountId", a.account_no AS "accountNo", a.invoice_no AS "invoiceNo",
                   a.customer_name AS "customerName", a.mobile,
                   s.installment_no AS "installmentNo",
                   a.total_installments AS "totalInstallments",
                   s.due_date AS "dueDate", s.amount_due AS "amountDue",
                   s.amount_paid AS "amountPaid", s.remaining_amount AS "remainingAmount",
                   s.payment_status AS "paymentStatus"
              FROM installment_schedules s
              JOIN installment_accounts a ON a.id=s.account_id
             WHERE s.account_id=?
             ORDER BY s.installment_no
            """, accountId);

        Object linkedInvoiceId = account.get("invoiceId");
        List<Map<String,Object>> invoiceItems = linkedInvoiceId == null ? List.of() : jdbc.queryForList("""
            SELECT item_type AS "itemType", description, purity,
                   gross_weight AS "grossWeight", stone_weight AS "stoneWeight",
                   net_weight AS "netWeight", rate, making_charge AS "makingCharge",
                   stamp_charge AS "stampCharge", extra_charge AS "extraCharge", amount
              FROM invoice_items
             WHERE invoice_id=?
             ORDER BY id ASC
            """, linkedInvoiceId);

        List<Map<String,Object>> payments = jdbc.queryForList("""
            SELECT p.id, ('NKJ-EMI-TXN-' || LPAD(p.id::TEXT, 8, '0')) AS "transactionId",
                   p.schedule_id AS "installmentId",
                   s.installment_no AS "installmentNo",
                   p.entry_type AS "entryType",
                   p.payment_date AS "paymentDate", p.amount,
                   p.payment_method AS "paymentMethod", p.reference_no AS "referenceNo",
                   p.recorded_by AS "recordedBy", p.created_at AS "createdAt",
                   r.id AS "reversalId", r.reversal_date AS "reversalDate",
                   r.amount AS "reversedAmount", r.reason AS "reversalReason",
                   r.recorded_by AS "reversedBy"
              FROM installment_transactions p
              LEFT JOIN installment_schedules s ON s.id=p.schedule_id
              LEFT JOIN installment_transaction_reversals r ON r.transaction_id=p.id
             WHERE p.account_id=?
               AND p.entry_type IN ('INSTALLMENT','DOWN_PAYMENT')
             ORDER BY p.payment_date DESC,p.created_at DESC,p.id DESC
            """, accountId);

        BigDecimal legacyBalanceReconciliation = jdbc.queryForObject("""
            SELECT COALESCE(SUM(amount),0)
              FROM installment_transactions
             WHERE account_id=? AND entry_type='LEGACY_RECONCILIATION'
            """, BigDecimal.class, accountId);

        Map<String,Object> response = new LinkedHashMap<>();
        response.put("plan", account);
        response.put("legacyBalanceReconciliation",
                legacyBalanceReconciliation == null ? BigDecimal.ZERO : legacyBalanceReconciliation);
        response.put("invoiceItems", invoiceItems);
        response.put("schedule", schedule);
        response.put("payments", payments);
        return response;
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String,Object> collectInstallmentPayment(
            Map<String,Object> body, String idempotencyKey, String adminPassword, String ip) throws JsonProcessingException {
        if (body == null) throw new IllegalArgumentException("Payment details are required.");
        // Re-authenticate before any idempotency lock, ledger insert, or balance
        // mutation. A rejected password therefore cannot post a receipt.
        auth.verifyAdminPassword(adminPassword);
        String key = requiredIdempotencyKey(idempotencyKey, "payment");
        lockIdempotencyKey("installment-payment:" + key);

        List<Map<String,Object>> existing = jdbc.queryForList("""
            SELECT p.id, p.schedule_id, p.account_id, p.payment_date, p.amount,
                   p.payment_method, p.reference_no, s.amount_due, a.invoice_no
              FROM installment_transactions p
              JOIN installment_schedules s ON s.id=p.schedule_id
              JOIN installment_accounts a ON a.id=p.account_id
             WHERE p.idempotency_key=?
            """, key);
        if (!existing.isEmpty()) {
            Map<String,Object> saved = existing.get(0);
            boolean same = Objects.equals(((Number) saved.get("schedule_id")).longValue(),
                    requiredId(body.get("installmentId"), "Installment ID"))
                    && Objects.equals(String.valueOf(saved.get("payment_date")), String.valueOf(body.get("paymentDate")))
                    && decimal(saved.get("amount")).compareTo(decimal(body.get("amount"))) == 0
                    && Objects.equals(String.valueOf(saved.get("payment_method")), String.valueOf(body.get("paymentMethod")))
                    && Objects.equals(saved.get("reference_no") == null ? "" : String.valueOf(saved.get("reference_no")),
                            body.get("referenceNo") == null ? "" : String.valueOf(body.get("referenceNo")));
            if (!same) {
                throw new IllegalArgumentException("This payment idempotency key was already used for different payment details.");
            }
            long savedScheduleId = ((Number) saved.get("schedule_id")).longValue();
            long savedAccountId = ((Number) saved.get("account_id")).longValue();
            BigDecimal scheduleRemaining = decimal(saved.get("amount_due"))
                    .subtract(netPaidForInstallment(savedScheduleId)).max(BigDecimal.ZERO);
            BigDecimal accountRemaining = jdbc.queryForObject(
                    "SELECT remaining_balance FROM installment_accounts WHERE id=?",
                    BigDecimal.class, savedAccountId);
            Map<String,Object> duplicateResponse = new LinkedHashMap<>();
            duplicateResponse.put("success", true);
            duplicateResponse.put("paymentId", saved.get("id"));
            duplicateResponse.put("transactionId", installmentTransactionId(saved.get("id")));
            duplicateResponse.put("duplicate", true);
            duplicateResponse.put("invoiceNo", saved.get("invoice_no"));
            duplicateResponse.put("amount", saved.get("amount"));
            duplicateResponse.put("paymentDate", saved.get("payment_date"));
            duplicateResponse.put("remainingAmount", scheduleRemaining);
            duplicateResponse.put("accountRemainingBalance", accountRemaining == null ? BigDecimal.ZERO : accountRemaining);
            duplicateResponse.put("message", "This payment was already recorded.");
            return duplicateResponse;
        }

        long scheduleId = requiredId(body.get("installmentId"), "Installment ID");
        Long accountIdForPayment = jdbc.queryForObject(
                "SELECT account_id FROM installment_schedules WHERE id=?",
                Long.class, scheduleId);
        if (accountIdForPayment == null) {
            throw new IllegalArgumentException("Installment schedule was not found.");
        }
        // Lock account first, then schedule. This serializes receipts across
        // schedules belonging to one account without touching Pre-Booking rows.
        jdbc.queryForObject("SELECT id FROM installment_accounts WHERE id=? FOR UPDATE",
                Long.class, accountIdForPayment);
        Map<String,Object> installment = jdbc.queryForMap("""
            SELECT s.id, s.account_id, s.amount_due, a.invoice_no, a.customer_name
              FROM installment_schedules s
              JOIN installment_accounts a ON a.id=s.account_id
             WHERE s.id=?
             FOR UPDATE OF s
            """, scheduleId);
        if (((Number) installment.get("account_id")).longValue() != accountIdForPayment.longValue()) {
            throw new IllegalArgumentException("This schedule row is not linked to the selected installment account.");
        }

        BigDecimal due = decimal(installment.get("amount_due")).setScale(2, java.math.RoundingMode.HALF_UP);
        BigDecimal paid = netPaidForInstallment(scheduleId);
        BigDecimal remaining = due.subtract(paid).setScale(2, java.math.RoundingMode.HALF_UP);
        BigDecimal amount = nonNegative(body.get("amount"), "Payment amount")
                .setScale(2, java.math.RoundingMode.HALF_UP);
        if (amount.signum() <= 0 || amount.compareTo(remaining) > 0) {
            throw new IllegalArgumentException("Payment must be positive and cannot exceed this installment's outstanding balance of ₹ " + remaining + ".");
        }

        java.time.LocalDate paymentDate = parseDate(body.get("paymentDate"), "Payment date");
        java.time.LocalDate today = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Kolkata"));
        if (paymentDate.isAfter(today)) throw new IllegalArgumentException("Payment date cannot be in the future.");
        String paymentMethod = String.valueOf(body.getOrDefault("paymentMethod", "Cash")).trim();
        if (!Set.of("Cash", "UPI", "Bank Transfer", "Card", "Cheque", "NEFT", "RTGS").contains(paymentMethod)) {
            throw new IllegalArgumentException("Select a valid payment method.");
        }
        String referenceNo = body.get("referenceNo") == null ? "" : String.valueOf(body.get("referenceNo")).trim();
        if (referenceNo.length() > 100) {
            throw new IllegalArgumentException("Transaction reference cannot exceed 100 characters.");
        }

        Long paymentId = jdbc.queryForObject("""
            INSERT INTO installment_transactions(
                account_id, schedule_id, entry_type, payment_date, amount,
                payment_method, reference_no, idempotency_key, recorded_by, created_at
            )
            VALUES (?, ?, 'INSTALLMENT', ?, ?, ?, ?, ?, ?, NOW())
            RETURNING id
            """, Long.class,
            accountIdForPayment, scheduleId, java.sql.Date.valueOf(paymentDate),
            amount, paymentMethod, referenceNo.isBlank() ? null : referenceNo,
            key, auth.getUsername());

        cashFlow.recordMovement("INSTALLMENTS", "INSTALLMENT_RECEIPT", paymentId,
                "INSTALLMENT:" + paymentId, paymentDate, amount,
                String.valueOf(installment.get("customer_name")), "Installment receipt",
                paymentMethod, referenceNo,
                String.valueOf(installment.get("invoice_no")), key, null);
        recalculateInstallment(scheduleId, accountIdForPayment);
        Map<String,Object> auditValues = new LinkedHashMap<>();
        auditValues.put("invoiceNo", installment.get("invoice_no"));
        auditValues.put("accountId", accountIdForPayment);
        auditValues.put("installmentId", scheduleId);
        auditValues.put("amount", amount);
        auditValues.put("paymentDate", paymentDate);
        auditValues.put("paymentMethod", paymentMethod);
        auditValues.put("referenceNo", referenceNo);
        audit("INSTALLMENT_PAYMENT_POSTED", "installment-transactions", paymentId, null, auditValues, ip);

        Map<String,Object> response = new LinkedHashMap<>();
        response.put("success", true);
        BigDecimal scheduleRemaining = due.subtract(netPaidForInstallment(scheduleId)).max(BigDecimal.ZERO);
        BigDecimal accountRemaining = jdbc.queryForObject(
                "SELECT remaining_balance FROM installment_accounts WHERE id=?",
                BigDecimal.class, accountIdForPayment);
        response.put("paymentId", paymentId);
        response.put("transactionId", installmentTransactionId(paymentId));
        response.put("invoiceNo", installment.get("invoice_no"));
        response.put("amount", amount);
        response.put("paymentDate", paymentDate);
        response.put("remainingAmount", scheduleRemaining);
        response.put("accountRemainingBalance", accountRemaining == null ? BigDecimal.ZERO : accountRemaining);
        response.put("message", "Installment payment recorded successfully.");
        return response;
    }

    @Transactional
    public Map<String,Object> updateInstallmentDueDate(long installmentId, Object dueDateValue, String ip) {
        java.time.LocalDate newDueDate = parseDate(dueDateValue, "Due date");
        Map<String,Object> before = jdbc.queryForMap(
                "SELECT id, account_id, installment_no, due_date FROM installment_schedules WHERE id=? FOR UPDATE",
                installmentId);
        if (before.get("due_date") != null
                && before.get("due_date").toString().equals(newDueDate.toString())) {
            return Map.of("success", true, "message", "Due date is unchanged.");
        }
        jdbc.update("UPDATE installment_schedules SET due_date=?, updated_at=NOW() WHERE id=?",
                java.sql.Date.valueOf(newDueDate), installmentId);
        long accountId = ((Number) before.get("account_id")).longValue();
        recalculateInstallment(installmentId, accountId);
        Map<String,Object> after = new LinkedHashMap<>();
        after.put("installmentId", installmentId);
        after.put("accountId", accountId);
        after.put("installmentNo", before.get("installment_no"));
        after.put("dueDate", newDueDate);
        audit("INSTALLMENT_DUE_DATE_UPDATED", "installment-schedules", installmentId, before, after, ip);
        return Map.of("success", true, "message", "Installment due date updated.");
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String,Object> reverseInstallmentPayment(
            long paymentId, Map<String,Object> body, String idempotencyKey, String ip) throws JsonProcessingException {
        if (body == null) throw new IllegalArgumentException("A reversal reason is required.");
        String key = requiredIdempotencyKey(idempotencyKey, "reversal");
        lockIdempotencyKey("installment-reversal:" + key);

        List<Map<String,Object>> existingByKey = jdbc.queryForList(
                "SELECT id, transaction_id FROM installment_transaction_reversals WHERE idempotency_key=?",
                key);
        if (!existingByKey.isEmpty()) {
            Map<String,Object> existing = existingByKey.get(0);
            if (((Number) existing.get("transaction_id")).longValue() != paymentId) {
                throw new IllegalArgumentException("This reversal idempotency key belongs to another payment.");
            }
            return Map.of("success", true, "reversalId", existing.get("id"), "duplicate", true,
                    "message", "This payment reversal was already recorded.");
        }

        Long accountIdForReversal = jdbc.queryForObject(
                "SELECT account_id FROM installment_transactions WHERE id=?",
                Long.class, paymentId);
        if (accountIdForReversal == null) {
            throw new IllegalArgumentException("Payment account was not found.");
        }
        jdbc.queryForObject("SELECT id FROM installment_accounts WHERE id=? FOR UPDATE",
                Long.class, accountIdForReversal);
        Map<String,Object> payment = jdbc.queryForMap("""
            SELECT p.id, p.schedule_id, p.amount, p.payment_date, p.entry_type,
                   p.account_id, a.invoice_no
              FROM installment_transactions p
              JOIN installment_accounts a ON a.id=p.account_id
             WHERE p.id=?
             FOR UPDATE OF p
            """, paymentId);
        if (!"INSTALLMENT".equals(String.valueOf(payment.get("entry_type")))) {
            throw new IllegalArgumentException("Down payments and reconciliation entries cannot be reversed from the installment schedule action.");
        }
        Long existingReversal = jdbc.query(
                "SELECT id FROM installment_transaction_reversals WHERE transaction_id=?",
                rs -> rs.next() ? rs.getLong(1) : null, paymentId);
        if (existingReversal != null) {
            throw new IllegalArgumentException("This payment has already been reversed.");
        }
        String reason = body.get("reason") == null ? "" : String.valueOf(body.get("reason")).trim();
        if (reason.length() < 5 || reason.length() > 500) {
            throw new IllegalArgumentException("Enter a reversal reason between 5 and 500 characters.");
        }
        java.time.LocalDate reversalDate = body.get("reversalDate") == null
                ? java.time.LocalDate.now(java.time.ZoneId.of("Asia/Kolkata"))
                : parseDate(body.get("reversalDate"), "Reversal date");
        if (reversalDate.isAfter(java.time.LocalDate.now(java.time.ZoneId.of("Asia/Kolkata")))) {
            throw new IllegalArgumentException("Reversal date cannot be in the future.");
        }
        Long reversalId = jdbc.queryForObject("""
            INSERT INTO installment_transaction_reversals(
                transaction_id, reversal_date, amount, reason, idempotency_key, recorded_by
            )
            VALUES (?, ?, ?, ?, ?, ?)
            RETURNING id
            """, Long.class, paymentId, java.sql.Date.valueOf(reversalDate),
            decimal(payment.get("amount")), reason, key, auth.getUsername());

        long scheduleId = ((Number) payment.get("schedule_id")).longValue();
        long accountId = ((Number) payment.get("account_id")).longValue();
        recalculateInstallment(scheduleId, accountId);
        Map<String,Object> auditValues = new LinkedHashMap<>();
        auditValues.put("transactionId", paymentId);
        auditValues.put("invoiceNo", payment.get("invoice_no"));
        auditValues.put("amount", payment.get("amount"));
        auditValues.put("reversalDate", reversalDate);
        auditValues.put("reason", reason);
        cashFlow.voidMovement("INSTALLMENT:" + paymentId, reason);
        audit("INSTALLMENT_PAYMENT_REVERSED", "installment-transaction-reversals", reversalId, payment, auditValues, ip);
        return Map.of("success", true, "reversalId", reversalId,
                "message", "Payment reversed. The original receipt remains in history.");
    }

    private void recalculateInstallment(long installmentId, long accountId) {
        BigDecimal paid = netPaidForInstallment(installmentId);
        Map<String,Object> row = jdbc.queryForMap(
                "SELECT amount_due, due_date FROM installment_schedules WHERE id=?", installmentId);
        BigDecimal due = decimal(row.get("amount_due")).setScale(2, java.math.RoundingMode.HALF_UP);
        BigDecimal remaining = due.subtract(paid).max(BigDecimal.ZERO).setScale(2, java.math.RoundingMode.HALF_UP);
        Object rawDueDate = row.get("due_date");
        java.time.LocalDate dueDate = null;
        if (rawDueDate instanceof java.sql.Date sqlDate) {
            dueDate = sqlDate.toLocalDate();
        } else if (rawDueDate instanceof java.time.LocalDate localDate) {
            dueDate = localDate;
        } else if (rawDueDate != null && !String.valueOf(rawDueDate).isBlank()) {
            dueDate = java.time.LocalDate.parse(String.valueOf(rawDueDate));
        }
        java.time.LocalDate today = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Kolkata"));
        String status = remaining.signum() == 0 ? "PAID"
                : dueDate != null && dueDate.isBefore(today) ? "OVERDUE"
                : paid.signum() > 0 ? "PARTIAL"
                : dueDate != null && dueDate.isEqual(today) ? "DUE" : "PENDING";
        jdbc.update("""
            UPDATE installment_schedules
               SET amount_paid=?, remaining_amount=?, payment_status=?, updated_at=NOW()
             WHERE id=?
            """, paid, remaining, status, installmentId);
        jdbc.update("""
            UPDATE installment_accounts
               SET remaining_balance=COALESCE((
                       SELECT SUM(remaining_amount)
                         FROM installment_schedules
                        WHERE account_id=?
                   ),0),
                   status=CASE WHEN COALESCE((
                       SELECT SUM(remaining_amount)
                         FROM installment_schedules
                        WHERE account_id=?
                   ),0)<=0 THEN 'COMPLETED' ELSE 'OPEN' END,
                   updated_at=NOW()
             WHERE id=?
            """, accountId, accountId, accountId);
    }

    /**
     * Public, stable receipt identifier derived from the immutable payment
     * primary key. The database sequence guarantees uniqueness; this label is
     * shared by the notebook, account statement and save confirmation.
     */
    private String installmentTransactionId(Object id) {
        return "NKJ-EMI-TXN-" + String.format(Locale.ROOT, "%08d", requiredId(id, "Transaction ID"));
    }

    private BigDecimal netPaidForInstallment(long installmentId) {
        BigDecimal paid = jdbc.queryForObject("""
            SELECT COALESCE(SUM(p.amount),0) - COALESCE((
                SELECT SUM(r.amount)
                  FROM installment_transaction_reversals r
                 WHERE r.transaction_id IN (
                       SELECT p2.id
                         FROM installment_transactions p2
                        WHERE p2.schedule_id=?
                 )
            ),0)
              FROM installment_transactions p
             WHERE p.schedule_id=?
            """, BigDecimal.class, installmentId, installmentId);
        return (paid == null ? BigDecimal.ZERO : paid)
                .max(BigDecimal.ZERO).setScale(2, java.math.RoundingMode.HALF_UP);
    }

    private void lockIdempotencyKey(String key) {
        jdbc.query("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", rs -> {
            if (rs.next()) return null;
            return null;
        }, key);
    }

    private String requiredIdempotencyKey(String value, String label) {
        String key = value == null ? "" : value.trim();
        if (!key.matches("[A-Za-z0-9._:-]{1,120}")) {
            throw new IllegalArgumentException("A valid Idempotency-Key is required for this " + label + ".");
        }
        return key;
    }

    private java.time.LocalDate parseDate(Object value, String label) {
        try {
            if (value == null || String.valueOf(value).isBlank()) throw new IllegalArgumentException();
            return java.time.LocalDate.parse(String.valueOf(value).substring(0, 10));
        } catch (RuntimeException ex) {
            throw new IllegalArgumentException(label + " must be a valid YYYY-MM-DD date.");
        }
    }


    private java.time.LocalDate shopToday() {
        return java.time.LocalDate.now(java.time.ZoneId.of("Asia/Kolkata"));
    }

    private String moneyKey(BigDecimal amount) {
        return amount.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();
    }

    private String expenseEventKey(long id, BigDecimal cumulativePaid) {
        return "EXPENSE:" + id + ":PAID_TO:" + moneyKey(cumulativePaid);
    }

    private String purchaseEventKey(long id, BigDecimal cumulativePaid) {
        return "PURCHASE-PAYMENT:" + id + ":PAID_TO:" + moneyKey(cumulativePaid);
    }

    private void prepareExpensePayment(Map<String,Object> data) {
        BigDecimal total = nonNegative(data.get("amount"), "Expense amount");
        String status = data.get("paymentStatus") == null
                ? "PENDING" : String.valueOf(data.get("paymentStatus")).trim().toUpperCase(Locale.ROOT);
        if (!Set.of("PAID", "PARTIAL", "PENDING").contains(status)) {
            throw new IllegalArgumentException("Expense payment status must be PAID, PARTIAL or PENDING.");
        }
        if ("PARTIAL".equals(status) && data.get("paidAmount") == null) {
            throw new IllegalArgumentException("Enter the actual Amount paid for a partially paid expense.");
        }
        BigDecimal paid = data.get("paidAmount") == null
                ? ("PAID".equals(status) ? total : BigDecimal.ZERO)
                : nonNegative(data.get("paidAmount"), "Paid expense amount");
        if (paid.compareTo(total) > 0) {
            throw new IllegalArgumentException("Paid expense amount cannot exceed the expense amount.");
        }
        String calculatedStatus = paid.signum() == 0 ? "PENDING"
                : paid.compareTo(total) >= 0 ? "PAID" : "PARTIAL";
        data.put("paidAmount", paid);
        data.put("paymentStatus", calculatedStatus);
    }

    private void calculateSalary(Map<String,Object> data) {
        BigDecimal basic = nonNegative(data.get("basicSalary"), "Basic salary");
        BigDecimal allowances = nonNegative(data.get("allowances"), "Allowances");
        BigDecimal overtime = nonNegative(data.get("overtime"), "Overtime");
        BigDecimal bonus = nonNegative(data.get("bonus"), "Bonus");
        BigDecimal deductions = nonNegative(data.get("deductions"), "Deductions");
        BigDecimal advance = nonNegative(data.get("advanceSalary"), "Advance salary");
        BigDecimal absence = nonNegative(data.get("absentDeduction"), "Absence deduction");

        BigDecimal net = basic.add(allowances).add(overtime).add(bonus)
                .subtract(deductions).subtract(advance).subtract(absence)
                .max(BigDecimal.ZERO);
        if (data.get("netSalary") == null) data.put("netSalary", net);

        BigDecimal paid = nonNegative(data.get("amountPaid"), "Amount paid");
        BigDecimal finalNet = nonNegative(data.get("netSalary"), "Net salary");
        if (paid.compareTo(finalNet) > 0) {
            throw new IllegalArgumentException("Amount paid cannot exceed net salary.");
        }
        if (data.get("remainingSalary") == null) {
            data.put("remainingSalary", finalNet.subtract(paid).max(BigDecimal.ZERO));
        }
        if (data.get("paymentStatus") == null) {
            data.put("paymentStatus", paid.signum() == 0 ? "PENDING"
                    : paid.compareTo(finalNet) >= 0 ? "PAID" : "PARTIAL");
        }
    }

    private void calculateBooking(Map<String,Object> data) {
        BigDecimal estimate = nonNegative(data.get("estimatedValue"), "Estimated value")
                .add(nonNegative(data.get("makingEstimate"), "Making estimate"));
        BigDecimal advance = nonNegative(data.get("advanceAmount"), "Advance amount");
        if (advance.compareTo(estimate) > 0) {
            throw new IllegalArgumentException("Booking advance cannot exceed the estimated booking value.");
        }
        if (data.get("remainingAmount") == null) {
            data.put("remainingAmount", estimate.subtract(advance).max(BigDecimal.ZERO));
        }
    }

    private void calculatePurchase(Map<String,Object> data) {
        BigDecimal total = nonNegative(data.get("totalAmount"), "Purchase total");
        BigDecimal paid = nonNegative(data.get("paidAmount"), "Paid amount");
        if (paid.compareTo(total) > 0) throw new IllegalArgumentException("Paid amount cannot exceed purchase total.");
        data.put("balance", total.subtract(paid).max(BigDecimal.ZERO));
        data.put("status", paid.signum() == 0 ? "PENDING" : paid.compareTo(total) >= 0 ? "PAID" : "PARTIAL");
    }

    private void applySalaryReceipt(Map<String,Object> data) {
        long salaryId = requiredId(data.get("salaryId"), "Salary record ID");
        BigDecimal receipt = nonNegative(data.get("amount"), "Payment amount");
        Map<String,Object> salary = jdbc.queryForMap(
                "SELECT id, net_salary, amount_paid FROM staff_salary WHERE id=? FOR UPDATE",
                salaryId);
        BigDecimal total = decimal(salary.get("net_salary"));
        BigDecimal paid = decimal(salary.get("amount_paid")).add(receipt);
        if (receipt.signum() <= 0 || paid.compareTo(total) > 0) {
            throw new IllegalArgumentException("Salary payment must be positive and cannot exceed remaining salary.");
        }
        BigDecimal remaining = total.subtract(paid).max(BigDecimal.ZERO);
        jdbc.update("UPDATE staff_salary SET amount_paid=?, remaining_salary=?, payment_status=? WHERE id=?",
                paid, remaining, remaining.signum() == 0 ? "PAID" : "PARTIAL", salaryId);
    }

    private void applyStockMovement(Map<String,Object> data) {
        long productId = requiredId(data.get("productId"), "Product ID");
        BigDecimal quantity = nonNegative(data.get("quantity"), "Movement quantity");
        if (quantity.signum() <= 0) throw new IllegalArgumentException("Movement quantity must be greater than zero.");
        Map<String,Object> product = jdbc.queryForMap(
                "SELECT id, stock_quantity FROM products WHERE id=? FOR UPDATE", productId);
        BigDecimal current = decimal(product.get("stock_quantity"));
        String movement = String.valueOf(data.get("transactionType"));
        BigDecimal next;
        if ("PURCHASE".equals(movement) || "RETURN".equals(movement)) next = current.add(quantity);
        else if ("SALE".equals(movement) || "DAMAGE".equals(movement)) {
            next = current.subtract(quantity);
            if (next.signum() < 0) throw new IllegalArgumentException("This movement exceeds available stock.");
        } else if ("ADJUSTMENT".equals(movement)) next = quantity;
        else throw new IllegalArgumentException("Unsupported stock movement type.");
        jdbc.update("UPDATE products SET stock_quantity=?, status=CASE WHEN ?<=0 THEN 'OUT_OF_STOCK' ELSE 'IN_STOCK' END, updated_at=NOW() WHERE id=?",
                next, next, productId);
    }

    private Object jdbcValue(Field field, Object value) {
        if (value == null) return null;
        if ("number".equals(field.type())) {
            final BigDecimal amount;
            try {
                amount = new BigDecimal(String.valueOf(value).trim());
            } catch (NumberFormatException ex) {
                throw new IllegalArgumentException(field.label() + " must be a valid number.");
            }
            if (amount.signum() < 0) {
                throw new IllegalArgumentException(field.label() + " cannot be negative.");
            }
            return amount;
        }
        return value;
    }

    private BigDecimal decimal(Object value) {
        if (value == null || String.valueOf(value).isBlank()) return BigDecimal.ZERO;
        try {
            return value instanceof BigDecimal amount ? amount : new BigDecimal(String.valueOf(value).trim());
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException("A monetary or quantity value is not a valid number.");
        }
    }

    private BigDecimal nonNegative(Object value, String label) {
        BigDecimal amount = decimal(value);
        if (amount.signum() < 0) throw new IllegalArgumentException(label + " cannot be negative.");
        return amount;
    }

    private long requiredId(Object value, String label) {
        try {
            long id = decimal(value).longValueExact();
            if (id <= 0) throw new ArithmeticException("not positive");
            return id;
        } catch (ArithmeticException ex) {
            throw new IllegalArgumentException(label + " must be a positive whole number.");
        }
    }

    @Transactional
    public Map<String,Object> update(String module, long id, Map<String,Object> body, String ip) {
        if (APPEND_ONLY_MODULES.contains(module)) {
            throw new IllegalArgumentException("Posted stock and payment transactions cannot be edited. Record a correcting transaction instead.");
        }
        Definition d = writableDefinition(module);
        if (body == null || body.isEmpty()) throw new IllegalArgumentException("Update data is required.");
        Map<String,Object> before = jdbc.queryForMap("SELECT * FROM " + d.table() + " WHERE id=? FOR UPDATE", id);
        // Pre-Bookings are loaded and updated only from pre_booking_bills.
        Map<String,Object> normalized = new LinkedHashMap<>(body);
        normalized.replaceAll((key, value) -> value instanceof String text && text.isBlank() ? null : value);
        // A paid amount is a cumulative cash figure. It may only increase here;
        // decreases/refunds must be recorded as separate cash operations.
        if ("purchases".equals(module)
                && (normalized.containsKey("paidAmount") || normalized.containsKey("totalAmount")
                    || normalized.containsKey("status"))) {
            BigDecimal oldPaid = decimal(before.get("paid_amount"));
            BigDecimal newPaid = normalized.containsKey("paidAmount")
                    ? nonNegative(normalized.get("paidAmount"), "Paid supplier amount") : oldPaid;
            BigDecimal total = normalized.containsKey("totalAmount")
                    ? nonNegative(normalized.get("totalAmount"), "Purchase total")
                    : decimal(before.get("total_amount"));
            if (newPaid.compareTo(oldPaid) < 0) {
                throw new IllegalArgumentException("Paid supplier amount cannot be reduced. Record a refund or correction as a separate transaction.");
            }
            if (newPaid.compareTo(total) > 0) {
                throw new IllegalArgumentException("Paid supplier amount cannot exceed the supplier purchase total.");
            }
            normalized.put("paidAmount", newPaid);
            normalized.put("balance", total.subtract(newPaid).max(BigDecimal.ZERO));
            normalized.put("status", newPaid.signum() == 0 ? "PENDING"
                    : newPaid.compareTo(total) >= 0 ? "PAID" : "PARTIAL");
        }
        if ("expenses".equals(module)
                && (normalized.containsKey("paidAmount") || normalized.containsKey("amount")
                    || normalized.containsKey("paymentStatus"))) {
            BigDecimal oldPaid = decimal(before.get("paid_amount"));
            BigDecimal total = normalized.containsKey("amount")
                    ? nonNegative(normalized.get("amount"), "Expense amount")
                    : decimal(before.get("amount"));
            BigDecimal newPaid = normalized.containsKey("paidAmount")
                    ? nonNegative(normalized.get("paidAmount"), "Paid expense amount")
                    : oldPaid;
            if (newPaid.compareTo(oldPaid) < 0) {
                throw new IllegalArgumentException("Paid expense amount cannot be reduced. Record an actual refund separately.");
            }
            if (newPaid.compareTo(total) > 0) {
                throw new IllegalArgumentException("Paid expense amount cannot exceed the expense amount.");
            }
            if (total.compareTo(oldPaid) < 0) {
                throw new IllegalArgumentException("Expense amount cannot be reduced below the amount already paid.");
            }
            normalized.put("paidAmount", newPaid);
            normalized.put("paymentStatus", newPaid.signum() == 0 ? "PENDING"
                    : newPaid.compareTo(total) >= 0 ? "PAID" : "PARTIAL");
        }
        if ("pre-bookings".equals(module) && normalized.containsKey("advanceAmount")) {
            BigDecimal oldAdvance = decimal(before.get("advance_amount"));
            BigDecimal newAdvance = nonNegative(normalized.get("advanceAmount"), "Booking advance");
            if (newAdvance.compareTo(oldAdvance) < 0) {
                throw new IllegalArgumentException("A recorded Pre-Booking advance cannot be reduced. Record a refund separately.");
            }
        }
        if ("salary".equals(module) && normalized.containsKey("amountPaid")
                && nonNegative(normalized.get("amountPaid"), "Amount paid")
                        .compareTo(decimal(before.get("amount_paid"))) != 0) {
            throw new IllegalArgumentException("Do not edit paid salary directly. Use Salary Payments to record each actual payment.");
        }

        if ("customers".equals(module) && normalized.containsKey("phone")
                && normalized.get("phone") != null) {
            String normalizedPhone = customerService.normalizePhone(String.valueOf(normalized.get("phone")));
            if (customerService.phoneBelongsToAnotherCustomer(normalizedPhone, id)) {
                throw new IllegalArgumentException("This phone number already belongs to another customer. Use that existing Customer ID instead of creating a duplicate.");
            }
            normalized.put("phone", normalizedPhone);
        }
        // Business identifiers are generated once and must not be accidentally
        // erased when an edit form is submitted with an empty optional code field.
        for (String codeField : List.of("bookingNo", "orderNo", "customerCode", "itemCode", "supplierCode", "karigarCode")) {
            if (normalized.containsKey(codeField) && normalized.get(codeField) == null) normalized.remove(codeField);
        }
        for (String required : d.required()) {
            if (normalized.containsKey(required) && normalized.get(required) == null) {
                throw new IllegalArgumentException("Required field: " + required);
            }
        }
        // Empty numeric/date/time controls are common in browser forms. Do not
        // overwrite a previously saved non-null database value with SQL NULL.
        List<Field> included = d.fields().stream()
                .filter(x -> normalized.containsKey(x.key()))
                .filter(x -> normalized.get(x.key()) != null ||
                        !("number".equals(x.type()) || "date".equals(x.type()) || "time".equals(x.type())))
                .toList();
        if (included.isEmpty()) throw new IllegalArgumentException("No editable fields were supplied.");
        String assignments = included.stream().map(x -> x.column() + "=" + (x.type().equals("date") ? "CAST(? AS DATE)" : x.type().equals("time") ? "CAST(? AS TIME)" : "?")).reduce((a,b)->a+", "+b).orElseThrow();
        List<Object> values = new ArrayList<>();
        Map<String,Object> applied = new LinkedHashMap<>();
        included.forEach(x -> {
            Object value = jdbcValue(x, normalized.get(x.key()));
            values.add(value);
            applied.put(x.key(), value);
        });
        values.add(id);
        boolean hasUpdatedAt = Set.of("staff", "expenses", "products", "pre_booking_bills", "suppliers", "customers", "shop_details").contains(d.table());
        String sql = "UPDATE " + d.table() + " SET " + assignments + (hasUpdatedAt ? ", updated_at=NOW()" : "") + " WHERE id=?";
        int changed = jdbc.update(sql, values.toArray());
        if (changed == 0) throw new IllegalArgumentException("Record not found.");

        if ("pre-bookings".equals(module) && normalized.containsKey("advanceAmount")) {
            BigDecimal oldAdvance = decimal(before.get("advance_amount"));
            BigDecimal newAdvance = nonNegative(normalized.get("advanceAmount"), "Booking advance");
            BigDecimal delta = newAdvance.subtract(oldAdvance).max(BigDecimal.ZERO);
            if (delta.signum() > 0) {
                jdbc.update("INSERT INTO customer_ledger(entry_type,reference_type,reference_id,credit,notes) VALUES ('BOOKING_ADVANCE','BOOKING',?,?,?)",
                        id, delta, "Additional Pre-Booking advance received");
                cashFlow.recordMovement("PRE_BOOKINGS", "ADVANCE_RECEIPT", id,
                        "PREBOOK-ADVANCE:" + id + ":ADVANCE_TO:" + moneyKey(newAdvance),
                        shopToday(), delta, String.valueOf(before.get("customer_name")),
                        "Additional Pre-Booking advance received", null, null,
                        String.valueOf(before.get("booking_no")), null, null);
            }
        }
        if ("purchases".equals(module) && normalized.containsKey("paidAmount")) {
            BigDecimal oldPaid = decimal(before.get("paid_amount"));
            BigDecimal newPaid = nonNegative(normalized.get("paidAmount"), "Paid supplier amount");
            BigDecimal delta = newPaid.subtract(oldPaid).max(BigDecimal.ZERO);
            if (delta.signum() > 0) {
                cashFlow.recordMovement("PURCHASES", "SUPPLIER_PAYMENT", id,
                        purchaseEventKey(id, newPaid), shopToday(), delta,
                        String.valueOf(before.get("supplier_name")), "Additional supplier payment",
                        null, null, before.get("invoice_no") == null ? "PURCHASE-" + id : String.valueOf(before.get("invoice_no")),
                        null, null);
            }
        }
        if ("expenses".equals(module)
                && (normalized.containsKey("paidAmount") || normalized.containsKey("amount"))) {
            BigDecimal oldPaid = decimal(before.get("paid_amount"));
            BigDecimal newPaid = nonNegative(normalized.get("paidAmount"), "Paid expense amount");
            BigDecimal delta = newPaid.subtract(oldPaid).max(BigDecimal.ZERO);
            if (delta.signum() > 0) {
                cashFlow.recordMovement("EXPENSES", "EXPENSE_PAYMENT", id,
                        expenseEventKey(id, newPaid), shopToday(), delta, null,
                        before.get("description") == null ? String.valueOf(before.get("category")) : String.valueOf(before.get("description")),
                        before.get("payment_method") == null ? null : String.valueOf(before.get("payment_method")),
                        before.get("reference_no") == null ? null : String.valueOf(before.get("reference_no")),
                        String.valueOf(before.get("category")), null, null);
            }
        }

        if (module.equals("staff") && normalized.containsKey("notes") && normalized.get("notes") != null) {
            String latestNote = String.valueOf(normalized.get("notes")).trim();
            Object previousNote = before.get("notes");
            if (!latestNote.isBlank() && !latestNote.equals(previousNote == null ? "" : String.valueOf(previousNote).trim())) {
                jdbc.update("INSERT INTO staff_notes(staff_id,note_date,note_type,description,created_by) VALUES (?,CURRENT_DATE,'PROFILE NOTE',?,?)",
                        id, latestNote, auth.getUsername());
            }
        }
        audit("UPDATE", module, id, before, applied, ip);
        return Map.of("success", true, "message", "Record updated successfully.");
    }

    @Transactional
    public Map<String,Object> deleteStaffNote(long staffId, long noteId, String ip) {
        List<Map<String,Object>> matches = jdbc.queryForList("""
            SELECT id, staff_id AS "staffId", note_date AS "noteDate",
                   note_type AS "noteType", description,
                   created_by AS "createdBy", created_at AS "createdAt"
              FROM staff_notes
             WHERE id = ? AND staff_id = ?
             FOR UPDATE
            """, noteId, staffId);
        if (matches.isEmpty()) {
            throw new IllegalArgumentException("This note does not belong to the selected staff member or no longer exists.");
        }
        Map<String,Object> before = matches.get(0);
        int removed = jdbc.update("DELETE FROM staff_notes WHERE id = ? AND staff_id = ?", noteId, staffId);
        if (removed != 1) {
            throw new IllegalStateException("The selected staff note could not be deleted.");
        }
        audit("DELETE", "staff-notes", noteId, before, null, ip);
        return Map.of("success", true, "message", "Staff note deleted successfully.", "noteId", noteId, "staffId", staffId);
    }

    @Transactional
    public Map<String,Object> delete(String module, long id, String ip) {
        if (APPEND_ONLY_MODULES.contains(module)) {
            throw new IllegalArgumentException("Posted stock and payment transactions cannot be deleted. Record a correcting transaction instead.");
        }
        Definition d = writableDefinition(module);
        Map<String,Object> before = jdbc.queryForMap("SELECT * FROM " + d.table() + " WHERE id=? FOR UPDATE", id);
        String cashSourceModule = switch (module) {
            case "payments" -> "PAYMENTS";
            case "pre-bookings" -> "PRE_BOOKINGS";
            case "expenses" -> "EXPENSES";
            case "purchases" -> "PURCHASES";
            case "salary" -> "SALARY";
            default -> null;
        };
        if (cashSourceModule != null && Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT EXISTS(SELECT 1 FROM cash_transactions WHERE source_module=? AND source_record_id=? AND status='POSTED')",
                Boolean.class, cashSourceModule, id))) {
            throw new IllegalArgumentException("This record has posted cash history and cannot be deleted. Keep the source reference and record a separate refund/correction if money was returned.");
        }
        // Preserve the Pre-Booking's own received advance. This check does not
        // read or depend on any Installment/EMI table.
        if ("pre-bookings".equals(module)
                && decimal(before.get("advance_amount")).signum() > 0) {
            throw new IllegalArgumentException("This Pre-Booking has a recorded advance and cannot be deleted. Change its status to CANCELLED to preserve the financial history.");
        }
        jdbc.update("DELETE FROM " + d.table() + " WHERE id=?", id);
        audit("DELETE", module, id, before, null, ip);
        return Map.of("success", true, "message", "Record deleted successfully.");
    }

    @Transactional
    public Map<String,Object> deleteAuditLog(long id, String ip) {
        Map<String,Object> before = jdbc.queryForMap("SELECT * FROM audit_logs WHERE id=?", id);
        jdbc.update("DELETE FROM audit_logs WHERE id=?", id);
        // Keep an audit trail of the deletion itself so clearing an entry is visible.
        audit("DELETE_AUDIT_ENTRY", "audit-logs", id, before, Map.of("deleted", true), ip);
        return Map.of("success", true, "message", "Audit entry deleted and deletion recorded.");
    }

    public Definition getDefinition(String module) { return definition(module); }
    private Definition definition(String module) {
        Definition d = definitions.get(module);
        if (d == null) throw new IllegalArgumentException("Unknown ERP module: " + module);
        return d;
    }
    private Definition writableDefinition(String module) {
        Definition d = definition(module);
        if (!d.writable()) throw new IllegalArgumentException("This module is read-only.");
        return d;
    }
    private void validate(Definition d, Map<String,Object> body) {
        for (String required : d.required()) {
            Object value = body.get(required);
            if (value == null || String.valueOf(value).isBlank()) throw new IllegalArgumentException("Required field: " + required);
        }
    }
    private void audit(String action, String module, Long id, Object oldValue, Object newValue, String ip) {
        try {
            jdbc.update("INSERT INTO audit_logs(actor_identity, action, module, record_id, previous_value, new_value, ip_address) VALUES (?, ?, ?, ?, CAST(? AS JSONB), CAST(? AS JSONB), ?)",
                auth.getUsername(), action, module, String.valueOf(id), jsonOrNull(oldValue), jsonOrNull(newValue), ip);
        } catch (Exception ignored) {
            // Audit failure should roll back the business transaction; rethrow so writes cannot proceed unaudited.
            throw new IllegalStateException("Could not write audit log; the change was rolled back.", ignored);
        }
    }
    private String jsonOrNull(Object value) throws JsonProcessingException { return value == null ? null : mapper.writeValueAsString(value); }
}
