package com.nkj.billing.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
    private final Map<String, Definition> definitions = new LinkedHashMap<>();
    private static final Set<String> APPEND_ONLY_MODULES = Set.of(
            "stock-movements", "installment-payments", "salary-payments");

    public ErpModuleService(JdbcTemplate jdbc, ObjectMapper mapper, AuthService auth) {
        this.jdbc = jdbc; this.mapper = mapper; this.auth = auth;
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
        register("bookings", "bookings", true, List.of(
            f("bookingNo","booking_no","text","Booking number"), f("invoiceNo","invoice_no","text","Invoice number"), f("customerName","customer_name","text","Customer name"),
            f("mobile","mobile","text","Mobile"), f("bookingDate","booking_date","date","Booking date"), f("description","description","text","Ornament description"),
            f("metalType","metal_type","text","Metal type"), f("purity","purity","text","Purity"), f("estimatedWeight","estimated_weight","number","Estimated weight"),
            f("estimatedRate","estimated_rate","number","Estimated rate"), f("estimatedValue","estimated_value","number","Estimated value"),
            f("makingEstimate","making_estimate","number","Making estimate"), f("advanceAmount","advance_amount","number","Advance amount"),
            f("remainingAmount","remaining_amount","number","Remaining amount"), f("deliveryDate","delivery_date","date","Expected delivery"), f("status","status","text","Status")
        ), "bookingNo", "customerName");
        register("installments", "installments", true, List.of(
            f("bookingId","booking_id","number","Booking ID"), f("installmentNo","installment_no","number","Installment no."),
            f("dueDate","due_date","date","Due date"), f("amountDue","amount_due","number","Amount due"),
            f("amountPaid","amount_paid","number","Amount paid"), f("remainingAmount","remaining_amount","number","Remaining amount"),
            f("paymentStatus","payment_status","text","Payment status")
        ), "bookingId", "installmentNo", "amountDue");
        register("installment-payments", "installment_payments", true, List.of(
            f("installmentId","installment_id","number","Installment ID"), f("paymentDate","payment_date","date","Payment date"),
            f("amount","amount","number","Amount"), f("paymentMethod","payment_method","text","Payment method"), f("referenceNo","reference_no","text","Reference no."),
            f("idempotencyKey","idempotency_key","text","Idempotency key")
        ), "installmentId", "paymentDate", "amount", "paymentMethod");
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
            f("email","email","text","Email"), f("address","address","text","Address"), f("notes","notes","text","Notes")
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
        if (module.equals("staff")) {
            return jdbc.queryForList("SELECT id, staff_code AS \"staffCode\", full_name AS \"fullName\", photo_url AS \"photoUrl\", mobile, email, aadhaar_number AS \"aadhaarNumber\", pan_number AS \"panNumber\", address, dob, joining_date AS \"joiningDate\", designation, department, monthly_salary AS \"monthlySalary\", salary_method AS \"salaryMethod\", emergency_contact AS \"emergencyContact\", status, notes FROM staff ORDER BY id DESC LIMIT 500");
        }
        if (module.equals("staff-notes")) {
            return jdbc.queryForList("SELECT n.id, n.staff_id AS \"staffId\", s.full_name AS \"staffName\", n.note_date AS \"noteDate\", n.note_type AS \"noteType\", n.description, n.created_by AS \"createdBy\", n.created_at AS \"createdAt\" FROM staff_notes n JOIN staff s ON s.id=n.staff_id ORDER BY n.note_date DESC,n.created_at DESC LIMIT 1000");
        }
        if (module.equals("installments")) {
            return jdbc.queryForList("SELECT i.id, i.booking_id AS \"bookingId\", COALESCE(b.invoice_no,b.booking_no) AS \"invoiceNo\", b.customer_name AS \"customerName\", b.mobile, i.installment_no AS \"installmentNo\", i.due_date AS \"dueDate\", i.amount_due AS \"amountDue\", i.amount_paid AS \"amountPaid\", i.remaining_amount AS \"remainingAmount\", i.payment_status AS \"paymentStatus\" FROM installments i JOIN bookings b ON b.id=i.booking_id ORDER BY i.due_date ASC,i.id DESC LIMIT 1000");
        }
        if (module.equals("installment-payments")) {
            return jdbc.queryForList("SELECT * FROM (" +
                "SELECT p.id, i.id AS \"installmentId\", COALESCE(b.invoice_no,b.booking_no) AS \"invoiceNo\", b.customer_name AS \"customerName\", p.payment_date AS \"paymentDate\", p.created_at AS \"paidAt\", p.amount, p.payment_method AS \"paymentMethod\", p.reference_no AS \"referenceNo\" FROM installment_payments p JOIN installments i ON i.id=p.installment_id JOIN bookings b ON b.id=i.booking_id WHERE b.is_installment_plan=TRUE " +
                "UNION ALL " +
                "SELECT -b.id AS id, NULL::BIGINT AS \"installmentId\", b.invoice_no AS \"invoiceNo\", b.customer_name AS \"customerName\", b.booking_date AS \"paymentDate\", b.booking_date::timestamptz AS \"paidAt\", b.advance_amount AS amount, 'Cash'::VARCHAR AS \"paymentMethod\", 'DOWN PAYMENT'::VARCHAR AS \"referenceNo\" FROM bookings b WHERE b.invoice_no IS NOT NULL AND b.is_installment_plan=TRUE AND b.advance_amount>0" +
                ") receipts ORDER BY \"paidAt\" DESC,id DESC LIMIT 1000");
        }
        if (module.equals("attendance")) {
            return jdbc.queryForList("SELECT a.id, a.staff_id AS \"staffId\", s.staff_code AS \"staffCode\", s.full_name AS \"staffName\", a.attendance_date AS \"attendanceDate\", a.status, a.check_in AS \"checkIn\", a.check_out AS \"checkOut\", a.working_hours AS \"workingHours\", a.remarks FROM staff_attendance a JOIN staff s ON s.id=a.staff_id ORDER BY a.attendance_date DESC, a.id DESC LIMIT 500");
        }
        if (module.equals("salary")) {
            return jdbc.queryForList("SELECT a.id, a.staff_id AS \"staffId\", s.staff_code AS \"staffCode\", s.full_name AS \"staffName\", a.payroll_month AS \"payrollMonth\", a.basic_salary AS \"basicSalary\", a.allowances, a.overtime, a.bonus, a.deductions, a.advance_salary AS \"advanceSalary\", a.absent_deduction AS \"absentDeduction\", a.net_salary AS \"netSalary\", a.amount_paid AS \"amountPaid\", a.remaining_salary AS \"remainingSalary\", a.payment_date AS \"paymentDate\", a.payment_method AS \"paymentMethod\", a.payment_status AS \"paymentStatus\" FROM staff_salary a JOIN staff s ON s.id=a.staff_id ORDER BY a.payroll_month DESC LIMIT 500");
        }
        if (module.equals("leaves")) {
            return jdbc.queryForList("SELECT l.id, l.staff_id AS \"staffId\", s.staff_code AS \"staffCode\", s.full_name AS \"staffName\", l.from_date AS \"fromDate\", l.to_date AS \"toDate\", l.leave_type AS \"leaveType\", l.reason, l.status FROM staff_leaves l JOIN staff s ON s.id=l.staff_id ORDER BY l.from_date DESC, l.id DESC LIMIT 500");
        }
        if (module.equals("audit-logs")) return jdbc.queryForList("SELECT id, actor_identity AS \"actor\", action, module, record_id AS \"recordId\", ip_address AS \"ipAddress\", occurred_at AS \"occurredAt\" FROM audit_logs ORDER BY occurred_at DESC LIMIT 500");
        return jdbc.queryForList("SELECT " + select + " FROM " + d.table() + " ORDER BY id DESC LIMIT 500");
    }

    @Transactional
    public Map<String,Object> create(String module, Map<String,Object> body, String ip) {
        Definition d = writableDefinition(module);
        Map<String,Object> data = new LinkedHashMap<>(body);
        // Browser forms submit empty strings for optional inputs. Convert them to null
        // so empty date/time values do not reach PostgreSQL CAST operations.
        data.replaceAll((key, value) -> value instanceof String text && text.isBlank() ? null : value);
        if (module.equals("installment-payments")) {
            String idempotencyKey = String.valueOf(data.getOrDefault("idempotencyKey", "")).trim();
            if (!idempotencyKey.matches("[A-Za-z0-9._:-]{1,120}")) {
                throw new IllegalArgumentException("A valid payment request key is required.");
            }

            // Serialize retries with the same client key. A lost HTTP response
            // can then be retried without recording the receipt or schedule update twice.
            jdbc.query(
                    "SELECT pg_advisory_xact_lock(hashtextextended(?, 0))",
                    rs -> {
                        if (rs.next()) {
                            // Ensure PostgreSQL acquires the transaction-scoped lock.
                        }
                        return null;
                    },
                    "installment-payment:" + idempotencyKey
            );
            Long existingPaymentId = jdbc.queryForObject(
                    "SELECT MAX(id) FROM public.installment_payments WHERE idempotency_key=?",
                    Long.class,
                    idempotencyKey
            );
            if (existingPaymentId != null) {
                return Map.of("success", true, "id", existingPaymentId,
                        "duplicate", true, "message", "This installment payment was already recorded.");
            }
            data.put("idempotencyKey", idempotencyKey);
        }
        if (module.equals("staff-notes")) data.putIfAbsent("createdBy", auth.getUsername());
        if (module.equals("bookings") && data.get("bookingNo") == null) data.put("bookingNo", "PENDING-" + UUID.randomUUID());
        if (module.equals("repairs") && data.get("orderNo") == null) data.put("orderNo", "PENDING-" + UUID.randomUUID());
        validate(d, data);
        if (module.equals("salary")) {
            if (data.get("basicSalary") == null && data.get("staffId") != null) {
                data.put("basicSalary", jdbc.queryForObject("SELECT monthly_salary FROM staff WHERE id=?", BigDecimal.class, requiredId(data.get("staffId"), "Staff ID")));
            }
            calculateSalary(data);
        }
        if (module.equals("bookings")) calculateBooking(data);
        if (module.equals("installments")) calculateInstallment(data);
        if (module.equals("purchases")) calculatePurchase(data);
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
        if (module.equals("bookings")) {
            String bookingNo = "NKJ-BKG-" + java.time.LocalDate.now(java.time.ZoneId.of("Asia/Kolkata")).format(java.time.format.DateTimeFormatter.ofPattern("ddMMyy")) + "-" + String.format("%04d", id);
            if (String.valueOf(data.get("bookingNo")).startsWith("PENDING-")) {
                jdbc.update("UPDATE bookings SET booking_no=? WHERE id=?", bookingNo, id);
                data.put("bookingNo", bookingNo);
            }
            BigDecimal advance = nonNegative(data.get("advanceAmount"), "Advance amount");
            if (advance.signum() > 0) {
                jdbc.update("INSERT INTO customer_ledger(entry_type,reference_type,reference_id,credit,notes) VALUES ('BOOKING_ADVANCE','BOOKING',?,?,?)",
                    id, advance, "Advance received for " + data.get("bookingNo") + " / " + data.get("customerName"));
            }
        }
        if (module.equals("installment-payments")) applyInstallmentReceipt(data);
        if (module.equals("salary-payments")) applySalaryReceipt(data);
        if (module.equals("stock-movements")) applyStockMovement(data);
        audit("CREATE", module, id, null, data, ip);
        return Map.of("success", true, "id", id, "message", "Record created successfully.");
    }

    /** Create the linked invoice/EMI booking and all schedule rows in one database transaction. */
    @Transactional
    public Map<String,Object> createInstallmentPlan(Map<String,Object> request, String ip) {
        if (request == null) throw new IllegalArgumentException("Installment plan details are required.");
        String invoiceNo = String.valueOf(request.getOrDefault("invoiceNo", "")).trim();
        if (invoiceNo.isBlank() || "null".equals(invoiceNo)) throw new IllegalArgumentException("A valid saved invoice number is required.");

        // Lock the source invoice so two simultaneous conversions cannot both
        // pass the duplicate check and create plans for the same invoice.
        Map<String,Object> invoice = jdbc.queryForMap(
                "SELECT invoice_no, customer_name, mobile, grand_total FROM public.invoices WHERE invoice_no=? FOR UPDATE",
                invoiceNo
        );
        Long duplicate = jdbc.queryForObject("SELECT COUNT(*) FROM public.bookings WHERE invoice_no=?", Long.class, invoiceNo);
        if (duplicate != null && duplicate > 0) throw new IllegalArgumentException("An installment plan already exists for this invoice.");
        BigDecimal invoiceTotal = decimal(invoice.get("grand_total"));
        if (invoiceTotal.signum() <= 0) throw new IllegalArgumentException("The selected invoice has no payable amount.");
        Object bookingObject = request.get("booking");
        if (!(bookingObject instanceof Map<?,?> rawBooking)) throw new IllegalArgumentException("Installment booking details are required.");
        Map<String,Object> booking = new LinkedHashMap<>();
        rawBooking.forEach((key, value) -> booking.put(String.valueOf(key), value));
        BigDecimal advance = nonNegative(booking.get("advanceAmount"), "Down payment");
        if (advance.compareTo(invoiceTotal) >= 0) throw new IllegalArgumentException("Down payment must be less than the invoice total.");
        @SuppressWarnings("unchecked") List<Map<String,Object>> schedule = (List<Map<String,Object>>) request.get("schedule");
        if (schedule == null || schedule.isEmpty() || schedule.size() > 60) throw new IllegalArgumentException("Provide between 1 and 60 installment schedule rows.");
        BigDecimal scheduledTotal = BigDecimal.ZERO;
        Set<Integer> sequence = new HashSet<>();
        for (Map<String,Object> row : schedule) {
            int installmentNo = requiredId(row.get("installmentNo"), "Installment number") > Integer.MAX_VALUE
                    ? -1 : decimal(row.get("installmentNo")).intValueExact();
            if (installmentNo < 1 || !sequence.add(installmentNo)) throw new IllegalArgumentException("Installment numbers must be unique positive numbers.");
            BigDecimal amount = nonNegative(row.get("amountDue"), "Installment amount");
            if (amount.signum() <= 0) throw new IllegalArgumentException("Every installment amount must be greater than zero.");
            if (row.get("dueDate") == null || String.valueOf(row.get("dueDate")).isBlank()) throw new IllegalArgumentException("Every installment needs a due date.");
            scheduledTotal = scheduledTotal.add(amount);
        }
        for (int i = 1; i <= schedule.size(); i++) if (!sequence.contains(i)) throw new IllegalArgumentException("Installment numbers must be consecutive starting from 1.");
        BigDecimal expectedSchedule = invoiceTotal.subtract(advance).setScale(2, java.math.RoundingMode.HALF_UP);
        if (scheduledTotal.setScale(2, java.math.RoundingMode.HALF_UP).compareTo(expectedSchedule) != 0)
            throw new IllegalArgumentException("The installment schedule total must equal the invoice total minus down payment.");

        // Invoice master details are authoritative. Do not trust browser-supplied customer or total fields.
        booking.put("invoiceNo", invoiceNo);
        booking.put("bookingNo", "PENDING-" + UUID.randomUUID());
        booking.put("customerName", invoice.get("customer_name"));
        booking.put("mobile", invoice.get("mobile"));
        // Record the down payment against the actual conversion/receipt date
        // using the ERP business timezone, not a browser-supplied date.
        booking.put("bookingDate", java.time.LocalDate.now(java.time.ZoneId.of("Asia/Kolkata")).toString());
        booking.put("estimatedValue", invoiceTotal);
        booking.put("makingEstimate", BigDecimal.ZERO);
        booking.put("advanceAmount", advance);
        booking.put("remainingAmount", expectedSchedule);
        Map<String,Object> createdBooking = create("bookings", booking, ip);
        long bookingId = ((Number) createdBooking.get("id")).longValue();
        jdbc.update("UPDATE public.bookings SET is_installment_plan=TRUE WHERE id=?", bookingId);
        for (Map<String,Object> item : schedule) {
            Map<String,Object> row = new LinkedHashMap<>(item);
            row.put("bookingId", bookingId);
            create("installments", row, ip);
        }
        return Map.of("success", true, "bookingId", bookingId, "invoiceNo", invoiceNo,
                "scheduleCount", schedule.size(), "message", "Installment plan and schedule created.");
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

    private void calculateInstallment(Map<String,Object> data) {
        BigDecimal due = nonNegative(data.get("amountDue"), "Installment amount");
        BigDecimal paid = nonNegative(data.get("amountPaid"), "Paid amount");
        if (due.signum() <= 0) throw new IllegalArgumentException("Installment amount must be greater than zero.");
        if (paid.compareTo(due) > 0) throw new IllegalArgumentException("Paid amount cannot exceed installment amount.");
        if (data.get("remainingAmount") == null) data.put("remainingAmount", due.subtract(paid));
        if (data.get("paymentStatus") == null) {
            data.put("paymentStatus", paid.signum() == 0 ? "DUE" : paid.compareTo(due) >= 0 ? "PAID" : "PARTIAL");
        }
    }

    private void calculatePurchase(Map<String,Object> data) {
        BigDecimal total = nonNegative(data.get("totalAmount"), "Purchase total");
        BigDecimal paid = nonNegative(data.get("paidAmount"), "Paid amount");
        if (paid.compareTo(total) > 0) throw new IllegalArgumentException("Paid amount cannot exceed purchase total.");
        if (data.get("balance") == null) data.put("balance", total.subtract(paid).max(BigDecimal.ZERO));
        if (data.get("status") == null) {
            data.put("status", paid.signum() == 0 ? "PENDING" : paid.compareTo(total) >= 0 ? "PAID" : "PARTIAL");
        }
    }

    private void applyInstallmentReceipt(Map<String,Object> data) {
        long installmentId = requiredId(data.get("installmentId"), "Installment ID");
        BigDecimal receipt = nonNegative(data.get("amount"), "Payment amount");
        java.time.LocalDate paymentDate;
        try {
            paymentDate = java.time.LocalDate.parse(String.valueOf(data.get("paymentDate")));
        } catch (java.time.DateTimeException ex) {
            throw new IllegalArgumentException("A valid installment payment date is required.");
        }
        java.time.LocalDate businessToday = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Kolkata"));
        if (paymentDate.isAfter(businessToday)) {
            throw new IllegalArgumentException("An installment payment date cannot be in the future.");
        }
        Map<String,Object> installment = jdbc.queryForMap(
                "SELECT id, booking_id, amount_due, amount_paid FROM installments WHERE id=? FOR UPDATE",
                installmentId);
        BigDecimal due = decimal(installment.get("amount_due"));
        BigDecimal oldPaid = decimal(installment.get("amount_paid"));
        BigDecimal paid = oldPaid.add(receipt);
        if (receipt.signum() <= 0 || paid.compareTo(due) > 0) {
            throw new IllegalArgumentException("Installment payment must be positive and cannot exceed the remaining due amount.");
        }
        BigDecimal remaining = due.subtract(paid).max(BigDecimal.ZERO);
        jdbc.update("UPDATE installments SET amount_paid=?, remaining_amount=?, payment_status=? WHERE id=?",
                paid, remaining, remaining.signum() == 0 ? "PAID" : "PARTIAL", installmentId);
        jdbc.update("UPDATE bookings SET remaining_amount=GREATEST(0, remaining_amount-?), status=CASE WHEN GREATEST(0, remaining_amount-?)<=0 THEN 'COMPLETED' ELSE status END, updated_at=NOW() WHERE id=?",
                receipt, receipt, installment.get("booking_id"));
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
        Map<String,Object> before = jdbc.queryForMap("SELECT * FROM " + d.table() + " WHERE id=?", id);
        Map<String,Object> normalized = new LinkedHashMap<>(body);
        normalized.replaceAll((key, value) -> value instanceof String text && text.isBlank() ? null : value);
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
        boolean hasUpdatedAt = Set.of("staff", "expenses", "products", "bookings", "suppliers", "customers", "shop_details").contains(d.table());
        String sql = "UPDATE " + d.table() + " SET " + assignments + (hasUpdatedAt ? ", updated_at=NOW()" : "") + " WHERE id=?";
        int changed = jdbc.update(sql, values.toArray());
        if (changed == 0) throw new IllegalArgumentException("Record not found.");
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
    public Map<String,Object> delete(String module, long id, String ip) {
        if (APPEND_ONLY_MODULES.contains(module)) {
            throw new IllegalArgumentException("Posted stock and payment transactions cannot be deleted. Record a correcting transaction instead.");
        }
        Definition d = writableDefinition(module);
        Map<String,Object> before = jdbc.queryForMap("SELECT * FROM " + d.table() + " WHERE id=?", id);
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
