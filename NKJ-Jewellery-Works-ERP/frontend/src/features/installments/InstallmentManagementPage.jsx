import "./InstallmentManagementPage.css";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays, CheckCircle2, Clock3, CreditCard, Plus, RefreshCw,
  Search, Wallet, Printer, UserRound, ReceiptText, Eye, Pencil,
  RotateCcw, History, AlertCircle,
} from "lucide-react";
import { Page } from "../../shared/layouts/OwnerShell";
import { money } from "../../shared/utils/formatters";
import { request } from "../../core/api/client";

const today = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

const newIdempotencyKey = () => (
  window.crypto?.randomUUID?.()
  || `nkj-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
);

const fmtDate = (value) => {
  if (!value) return "—";
  const raw = String(value).slice(0, 10);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return raw;
  return new Date(`${raw}T00:00:00+05:30`).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const asCents = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
};

const addMonths = (dateValue, count, dueDay) => {
  const [year, month] = String(dateValue).slice(0, 10).split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1 + count, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(Math.max(1, Number(dueDay) || 1), lastDay);
  return `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const previewDueDate = (plan, index) => {
  if (index === 0) return plan.firstDueDate;
  if (plan.paymentFrequency === "WEEKLY") {
    const base = new Date(`${plan.firstDueDate}T00:00:00Z`);
    base.setUTCDate(base.getUTCDate() + index * 7);
    return base.toISOString().slice(0, 10);
  }
  return addMonths(plan.firstDueDate, index, plan.dueDay);
};

const statusLabel = (status) => ({
  PENDING: "Pending",
  DUE: "Due Today",
  PARTIAL: "Partially Paid",
  PARTIALLY_PAID: "Partially Paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
}[status] || status || "Pending");

const statusClass = (status) => ({
  PENDING: "pending",
  DUE: "pending",
  PARTIAL: "partial",
  PARTIALLY_PAID: "partial",
  PAID: "paid",
  OVERDUE: "overdue",
}[status] || "pending");

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const emptyPlan = () => ({
  downPayment: "0.00",
  installmentCount: "",
  paymentFrequency: "MONTHLY",
  firstDueDate: today(),
  downPaymentDate: today(),
  downPaymentMethod: "Cash",
  downPaymentReferenceNo: "",
  dueDay: String(Number(today().slice(8, 10))),
});

const emptyReceipt = () => ({
  installmentId: "",
  paymentDate: today(),
  amount: "",
  paymentMethod: "Cash",
  referenceNo: "",
});

export default function InstallmentManagementPage() {
  const [tab, setTab] = useState("new");
  const [eligibleInvoices, setEligibleInvoices] = useState([]);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [bookings, setBookings] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [plan, setPlan] = useState(emptyPlan);
  const [planIdempotencyKey, setPlanIdempotencyKey] = useState(newIdempotencyKey);
  const [receiptForm, setReceiptForm] = useState(emptyReceipt);
  const [paymentIdempotencyKey, setPaymentIdempotencyKey] = useState(newIdempotencyKey);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [accountDetails, setAccountDetails] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [inv, bk, sch, pay] = await Promise.all([
        request("/admin/installments/eligible-invoices"),
        request("/admin/modules/bookings"),
        request("/admin/modules/installments"),
        request("/admin/modules/installment-payments"),
      ]);
      setEligibleInvoices(Array.isArray(inv) ? inv : []);
      setBookings(Array.isArray(bk) ? bk : []);
      setSchedules(Array.isArray(sch) ? sch : []);
      setReceipts(Array.isArray(pay) ? pay : []);
    } catch (e) {
      setError(e.message || "Could not load installment data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectedInvoice = eligibleInvoices.find((invoice) => String(invoice.id) === String(invoiceId));

  const remainingBalance = selectedInvoice
    ? Math.max(0, (asCents(selectedInvoice.grandTotal) - asCents(plan.downPayment)) / 100)
    : 0;

  const schedulePreview = useMemo(() => {
    const count = Number(plan.installmentCount);
    const totalCents = selectedInvoice ? asCents(selectedInvoice.grandTotal) : 0;
    const downCents = asCents(plan.downPayment);
    const balanceCents = totalCents - downCents;
    if (!selectedInvoice || !Number.isInteger(count) || count < 1 || count > 12
      || balanceCents <= 0 || downCents < 0 || downCents > totalCents
      || !plan.firstDueDate) return [];
    const baseCents = Math.round(balanceCents / count);
    let allocatedCents = 0;
    return Array.from({ length: count }, (_, index) => {
      const amountCents = index === count - 1
        ? balanceCents - allocatedCents
        : baseCents;
      allocatedCents += amountCents;
      return {
        installmentNo: index + 1,
        amount: amountCents / 100,
        dueDate: previewDueDate(plan, index),
      };
    });
  }, [selectedInvoice, plan]);

  const accounts = useMemo(() => bookings
    .filter((booking) => booking.isInstallmentPlan && booking.invoiceNo)
    .map((booking) => {
      const rows = schedules
        .filter((schedule) => Number(schedule.bookingId) === Number(booking.id))
        .sort((a, b) => Number(a.installmentNo) - Number(b.installmentNo));
      const total = Number(booking.estimatedValue || 0) + Number(booking.makingEstimate || 0);
      const outstanding = Math.max(0, Number(
        booking.remainingAmount ?? rows.reduce((sum, row) => sum + Number(row.remainingAmount || 0), 0),
      ));
      const paid = Math.max(0, total - outstanding);
      return {
        ...booking,
        schedules: rows,
        total,
        outstanding,
        paid,
        paidCount: rows.filter((row) => row.paymentStatus === "PAID").length,
        count: Number(booking.totalInstallments || rows.length),
      };
    })
    .sort((a, b) => String(b.bookingDate || "").localeCompare(String(a.bookingDate || ""))),
  [bookings, schedules]);

  const filteredAccounts = accounts.filter((account) =>
    `${account.invoiceNo} ${account.customerName} ${account.mobile || ""}`
      .toLowerCase().includes(search.toLowerCase()),
  );

  const dueRows = schedules
    .filter((schedule) => Number(schedule.remainingAmount || 0) > 0)
    .sort((a, b) => String(a.dueDate || "").localeCompare(String(b.dueDate || "")));

  const totalOutstanding = accounts.reduce((sum, account) => sum + account.outstanding, 0);
  const totalCollected = accounts.reduce((sum, account) => sum + account.paid, 0);

  const openAccountDetails = async (account) => {
    setSelectedAccount(account);
    setAccountDetails(null);
    setDetailLoading(true);
    setError("");
    try {
      const details = await request(`/admin/installments/plans/${account.id}`);
      setAccountDetails(details);
    } catch (e) {
      setError(e.message || "Could not load the installment account details.");
    } finally {
      setDetailLoading(false);
    }
  };

  const searchEligibleInvoices = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (invoiceSearch.trim()) params.set("search", invoiceSearch.trim());
      const result = await request(`/admin/installments/eligible-invoices${params.toString() ? `?${params.toString()}` : ""}`);
      setEligibleInvoices(Array.isArray(result) ? result : []);
      setInvoiceId("");
    } catch (e) {
      setError(e.message || "Could not search eligible invoices.");
    } finally {
      setLoading(false);
    }
  };

  const createPlan = async (event) => {
    event.preventDefault();
    if (saving) return;
    setError("");
    setMessage("");
    if (!selectedInvoice) {
      setError("Select an existing saved invoice first.");
      return;
    }
    const count = Number(plan.installmentCount);
    const downCents = asCents(plan.downPayment);
    const invoiceCents = asCents(selectedInvoice.grandTotal);
    if (!Number.isInteger(count) || count < 1 || count > 12) {
      setError("Select a total installment count between 1 and 12.");
      return;
    }
    if (downCents < 0 || downCents > invoiceCents) {
      setError("Down payment cannot be negative or exceed the original invoice amount.");
      return;
    }
    if (!plan.firstDueDate || !plan.downPaymentDate) {
      setError("Select the first due date and actual down payment date.");
      return;
    }
    if (downCents < invoiceCents && (invoiceCents - downCents) < count) {
      setError("The remaining balance is too small to create this many positive two-decimal installments.");
      return;
    }

    setSaving(true);
    try {
      const result = await request("/admin/installments/plans", {
        method: "POST",
        headers: { "Idempotency-Key": planIdempotencyKey },
        body: JSON.stringify({
          invoiceId: Number(selectedInvoice.id),
          downPayment: downCents / 100,
          installmentCount: count,
          paymentFrequency: plan.paymentFrequency,
          firstDueDate: plan.firstDueDate,
          downPaymentDate: plan.downPaymentDate,
          dueDay: Number(plan.dueDay || 1),
          downPaymentMethod: plan.downPaymentMethod,
          downPaymentReferenceNo: plan.downPaymentReferenceNo,
        }),
      });
      setMessage(result.message || `Installment account created for invoice ${selectedInvoice.invoiceNo}.`);
      setInvoiceId("");
      setPlan(emptyPlan());
      setPlanIdempotencyKey(newIdempotencyKey());
      setInvoiceSearch("");
      await load();
      setTab("accounts");
      window.alert(`Installment Plan Saved Successfully!\nInvoice: ${selectedInvoice.invoiceNo}\nAccount: ${result.bookingNo || result.bookingId}\nInstallments: ${result.scheduleCount || 0}`);
    } catch (e) {
      setError(e.message || "Could not create the installment plan.");
      await load();
    } finally {
      setSaving(false);
    }
  };

  const postReceipt = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    const schedule = schedules.find((row) => String(row.id) === String(receiptForm.installmentId));
    const amountCents = asCents(receiptForm.amount);
    if (!schedule || amountCents <= 0 || amountCents > asCents(schedule.remainingAmount)) {
      setError("Choose an installment and enter an amount no greater than its remaining balance.");
      setSaving(false);
      return;
    }
    if (!receiptForm.paymentDate || receiptForm.paymentDate > today()) {
      setError("Enter a valid payment date that is not in the future.");
      setSaving(false);
      return;
    }
    try {
      const result = await request("/admin/installments/payments", {
        method: "POST",
        headers: { "Idempotency-Key": paymentIdempotencyKey },
        body: JSON.stringify({
          installmentId: Number(receiptForm.installmentId),
          paymentDate: receiptForm.paymentDate,
          amount: amountCents / 100,
          paymentMethod: receiptForm.paymentMethod,
          referenceNo: receiptForm.referenceNo,
        }),
      });
      setMessage(`₹ ${money(result.amount || amountCents / 100)} receipt saved against invoice ${schedule.invoiceNo}.`);
      setReceiptForm(emptyReceipt());
      setPaymentIdempotencyKey(newIdempotencyKey());
      await load();
      setTab("receipts");
      if (selectedAccount) await openAccountDetails(selectedAccount);
      window.alert(
        `Installment Payment Received Successfully!\nTransaction ID: ${result.transactionId || result.paymentId}\nInvoice: ${result.invoiceNo || schedule.invoiceNo}\nAmount: ₹ ${money(result.amount || amountCents / 100)}\nPayment Date: ${fmtDate(result.paymentDate || receiptForm.paymentDate)}\nRemaining Account Balance: ₹ ${money(result.accountRemainingBalance ?? result.remainingAmount ?? 0)}`
      );
    } catch (e) {
      setError(e.message || "Could not post receipt.");
    } finally {
      setSaving(false);
    }
  };

  const startReceipt = (schedule) => {
    setReceiptForm({
      installmentId: String(schedule.id),
      paymentDate: today(),
      amount: String(schedule.remainingAmount || ""),
      paymentMethod: "Cash",
      referenceNo: `Invoice ${schedule.invoiceNo} / Installment ${schedule.installmentNo}`,
    });
    setPaymentIdempotencyKey(newIdempotencyKey());
    setTab("receipts");
  };

  const updateDueDate = async (schedule) => {
    const dueDate = window.prompt(
      `Enter new due date for installment ${schedule.installmentNo} (YYYY-MM-DD)`,
      String(schedule.dueDate || today()).slice(0, 10),
    );
    if (!dueDate) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      setError("Enter the due date in YYYY-MM-DD format.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await request(`/admin/installments/schedules/${schedule.id}/due-date`, {
        method: "PUT",
        body: JSON.stringify({ dueDate }),
      });
      setMessage(`Due date updated for installment ${schedule.installmentNo}.`);
      await load();
      if (selectedAccount) await openAccountDetails(selectedAccount);
    } catch (e) {
      setError(e.message || "Could not update the installment due date.");
    } finally {
      setSaving(false);
    }
  };

  const reversePayment = async (payment) => {
    if (payment.entryType !== "INSTALLMENT_PAYMENT" || payment.reversedAmount) return;
    const reason = window.prompt(
      `Why are you reversing payment #${payment.id}? The original payment will remain in history.`,
    );
    if (!reason) return;
    if (reason.trim().length < 5) {
      setError("Enter a clear reversal reason of at least 5 characters.");
      return;
    }
    if (!window.confirm(`Reverse ₹ ${money(payment.amount)} for invoice ${payment.invoiceNo}?`)) return;
    setSaving(true);
    setError("");
    try {
      await request(`/admin/installments/payments/${payment.id}/reverse`, {
        method: "POST",
        headers: { "Idempotency-Key": newIdempotencyKey() },
        body: JSON.stringify({ reason: reason.trim(), reversalDate: today() }),
      });
      setMessage("Payment reversal recorded. The original receipt remains available in history.");
      await load();
      if (selectedAccount) await openAccountDetails(selectedAccount);
    } catch (e) {
      setError(e.message || "Could not reverse payment.");
    } finally {
      setSaving(false);
    }
  };

  const printAccount = (account) => {
    const rows = account.schedules.map((schedule) => `
      <tr>
        <td>${escapeHtml(schedule.installmentNo)}/${escapeHtml(account.count)}</td>
        <td>${escapeHtml(fmtDate(schedule.dueDate))}</td>
        <td>₹ ${escapeHtml(money(schedule.amountDue))}</td>
        <td>₹ ${escapeHtml(money(schedule.amountPaid))}</td>
        <td>₹ ${escapeHtml(money(schedule.remainingAmount))}</td>
        <td>${escapeHtml(statusLabel(schedule.paymentStatus))}</td>
      </tr>`).join("");
    const html = `<!doctype html><html><head><title>Installment ${escapeHtml(account.invoiceNo)}</title>
      <style>body{font:14px Arial;padding:28px;color:#241b1b}h1{color:#850d2d}
      table{border-collapse:collapse;width:100%;margin-top:20px}th,td{border:1px solid #ddd;padding:9px;text-align:left}
      th{background:#8c0b2e;color:#fff}.sum{margin-top:18px;line-height:1.8}</style></head><body>
      <h1>Nandikishor Jewellery Works</h1><h2>Installment Account Statement</h2>
      <p><b>Invoice:</b> ${escapeHtml(account.invoiceNo)}<br><b>Customer:</b> ${escapeHtml(account.customerName)}
      <br><b>Mobile:</b> ${escapeHtml(account.mobile || "—")}</p>
      <table><thead><tr><th>No.</th><th>Due date</th><th>Scheduled</th><th>Paid</th><th>Remaining</th><th>Status</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6">No future instalments required.</td></tr>'}</tbody></table>
      <div class="sum"><b>Original invoice:</b> ₹ ${escapeHtml(money(account.total))}
      <br><b>Down payment:</b> ₹ ${escapeHtml(money(account.advanceAmount))}
      <br><b>Collected:</b> ₹ ${escapeHtml(money(account.paid))}
      <br><b>Outstanding:</b> ₹ ${escapeHtml(money(account.outstanding))}</div>
      <script>window.onload=()=>window.print()</script></body></html>`;
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) {
      setError("Your browser blocked the print popup. Allow popups for this site and retry.");
      return;
    }
    win.document.write(html);
    win.document.close();
  };

  const renderScheduleTable = (rows, accountCount) => (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Installment</th><th>Due Date</th><th>Scheduled (₹)</th><th>Paid (₹)</th><th>Remaining (₹)</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>
          {rows.map((schedule) => (
            <tr key={schedule.id}>
              <td><b>{schedule.installmentNo}/{schedule.totalInstallments || accountCount}</b></td>
              <td>{fmtDate(schedule.dueDate)}</td>
              <td>{money(schedule.amountDue)}</td>
              <td>{money(schedule.amountPaid)}</td>
              <td className="nkj-outstanding">{money(schedule.remainingAmount)}</td>
              <td><span className={`nkj-installment-status ${statusClass(schedule.paymentStatus)}`}>{statusLabel(schedule.paymentStatus)}</span></td>
              <td className="nkj-installment-row-actions">
                {Number(schedule.remainingAmount) > 0 && <button type="button" className="small-action" onClick={() => startReceipt(schedule)}><CreditCard size={13}/> Collect</button>}
                <button type="button" className="small-action" onClick={() => updateDueDate(schedule)} disabled={saving}><Pencil size={13}/> Due date</button>
              </td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan="7" className="empty">No installment collection is required. The down payment covers the invoice.</td></tr>}
        </tbody>
      </table>
    </div>
  );

  const renderPaymentHistory = (rows) => (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Transaction ID</th><th>Customer</th><th>Invoice Number</th><th>Installment</th><th>Payment Date</th><th>Amount (₹)</th><th>Method</th><th>Reference</th><th>Recorded By</th><th>Status / Action</th></tr></thead>
        <tbody>
          {rows.map((payment) => (
            <tr key={payment.id}>
              <td>{payment.id}</td>
              <td>{payment.customerName || "—"}</td>
              <td>{payment.invoiceNo || "—"}</td>
              <td>{payment.installmentNo ? `${payment.installmentNo}` : payment.entryType === "DOWN_PAYMENT" ? "Down payment" : "—"}</td>
              <td>{fmtDate(payment.paymentDate)}</td>
              <td>{money(payment.amount)}</td>
              <td>{payment.paymentMethod || "—"}</td>
              <td>{payment.referenceNo || "—"}</td>
              <td>{payment.recordedBy || "—"}</td>
              <td>
                {payment.entryType === "DOWN_PAYMENT" ? (
                  <span className="nkj-downpayment-tag">Down payment</span>
                ) : payment.reversedAmount ? (
                  <span className="nkj-installment-status overdue">Reversed · {fmtDate(payment.reversalDate)}</span>
                ) : (
                  <button type="button" className="small-action" disabled={saving} onClick={() => reversePayment(payment)}>
                    <RotateCcw size={13}/> Reverse
                  </button>
                )}
              </td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan="10" className="empty">No payment transactions recorded yet.</td></tr>
        </tbody>
      </table>
    </div>
  );

  return (
    <Page active="installments">
      <section className="nkj-module-page nkj-installment-page">
        <div className="nkj-module-heading">
          <div>
            <span className="eyebrow">OWNER WORKSPACE</span>
            <h2>Installment / EMI Management</h2>
            <p>Convert saved invoices into server-calculated installment plans and track every actual receipt.</p>
          </div>
          <div className="nkj-module-actions">
            <button className="secondary" onClick={load} disabled={loading}><RefreshCw size={16}/> Refresh</button>
            <button className="primary" onClick={() => setTab("new")}><Plus size={16}/> New Installment</button>
          </div>
        </div>

        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}

        <div className="nkj-installment-kpis">
          <div><UserRound/><span>Active Accounts</span><strong>{accounts.filter((account) => account.outstanding > 0).length}</strong></div>
          <div><Wallet/><span>Total Outstanding</span><strong>₹ {money(totalOutstanding)}</strong></div>
          <div><CheckCircle2/><span>Total Collected</span><strong>₹ {money(totalCollected)}</strong></div>
          <div><Clock3/><span>Pending / Overdue</span><strong>{dueRows.length}</strong></div>
        </div>

        <div className="nkj-installment-tabs">
          {[["new", "New Installment"], ["accounts", "Installment Accounts"], ["receipts", "Payments / Receipts"], ["due", "Due & Reminder"]].map(([key, label]) => (
            <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>
          ))}
        </div>

        {tab === "new" && (
          <form className="nkj-module-form nkj-installment-form" onSubmit={createPlan}>
            <div className="nkj-module-form-head"><h3><ReceiptText size={18}/> Convert Invoice to Installment Plan</h3></div>
            <div className="nkj-installment-form-grid">
              <section>
                <h4>Customer / Invoice Details</h4>
                <label>
                  <span>Search older or recent invoices</span>
                  <input
                    type="search"
                    value={invoiceSearch}
                    onChange={(event) => setInvoiceSearch(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); searchEligibleInvoices(); } }}
                    placeholder="Invoice number, customer name or mobile"
                  />
                </label>
                <div className="nkj-module-form-actions">
                  <button type="button" className="secondary" onClick={searchEligibleInvoices} disabled={loading}>
                    <Search size={15}/> Search invoices
                  </button>
                  <small>Default list shows the last 3 calendar days. Search includes older eligible invoices.</small>
                </div>
                <label>
                  <span>Select eligible saved invoice *</span>
                  <select value={invoiceId} onChange={(event) => setInvoiceId(event.target.value)} required>
                    <option value="">Choose saved invoice ({eligibleInvoices.length} found)</option>
                    {eligibleInvoices.map((invoice) => (
                      <option key={invoice.id} value={invoice.id}>
                        {invoice.invoiceNo} · {invoice.customerName} · {invoice.mobile || "—"} · ₹ {money(invoice.grandTotal)}
                      </option>
                    ))}
                  </select>
                </label>
                {selectedInvoice && (
                  <div className="nkj-installment-selected">
                    <b>{selectedInvoice.customerName}</b>
                    <span>{selectedInvoice.mobile || "No mobile"}</span>
                    <span>Invoice: {selectedInvoice.invoiceNo}</span>
                    <span>Invoice date: {fmtDate(selectedInvoice.invoiceDate)}</span>
                    <strong>Original invoice amount: ₹ {money(selectedInvoice.grandTotal)}</strong>
                  </div>
                )}
                {!eligibleInvoices.length && (
                  <p className="nkj-module-footnote">No eligible invoices are available. Each invoice can be converted only once.</p>
                )}
              </section>
              <section>
                <h4>Installment Plan</h4>
                <div className="nkj-installment-input-grid">
                  <label>
                    <span>Original invoice amount (₹)</span>
                    <input type="text" value={selectedInvoice ? money(selectedInvoice.grandTotal) : ""} readOnly placeholder="Select an invoice"/>
                  </label>
                  <label>
                    <span>Down payment (₹) *</span>
                    <input type="number" min="0" step="0.01" value={plan.downPayment} onChange={(event) => setPlan({ ...plan, downPayment: event.target.value })} required/>
                  </label>
                  <label>
                    <span>Total Number of Installments *</span>
                    <select value={plan.installmentCount} onChange={(event) => setPlan({ ...plan, installmentCount: event.target.value })} required>
                      <option value="">Select installment count</option>
                      {Array.from({ length: 12 }, (_, index) => index + 1).map((count) => (
                        <option key={count} value={count}>{count}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Payment frequency *</span>
                    <select value={plan.paymentFrequency} onChange={(event) => setPlan({ ...plan, paymentFrequency: event.target.value })}>
                      <option value="MONTHLY">Monthly</option>
                      <option value="WEEKLY">Weekly</option>
                    </select>
                  </label>
                  <label>
                    <span>First installment due date *</span>
                    <input type="date" value={plan.firstDueDate} onChange={(event) => setPlan({ ...plan, firstDueDate: event.target.value })} required/>
                  </label>
                  <label>
                    <span>Actual down payment date *</span>
                    <input type="date" max={today()} value={plan.downPaymentDate} onChange={(event) => setPlan({ ...plan, downPaymentDate: event.target.value })} required/>
                  </label>
                  <label>
                    <span>Down payment method *</span>
                    <select value={plan.downPaymentMethod} onChange={(event) => setPlan({ ...plan, downPaymentMethod: event.target.value })}>
                      <option>Cash</option><option>UPI</option><option>Bank Transfer</option><option>Card</option><option>Cheque</option><option>NEFT</option><option>RTGS</option>
                    </select>
                  </label>
                  <label>
                    <span>Down payment reference</span>
                    <input type="text" maxLength="100" value={plan.downPaymentReferenceNo} onChange={(event) => setPlan({ ...plan, downPaymentReferenceNo: event.target.value })} placeholder="Optional transaction reference"/>
                  </label>
                  {plan.paymentFrequency === "MONTHLY" && (
                    <label>
                      <span>Due day for following months</span>
                      <input type="number" min="1" max="31" value={plan.dueDay} onChange={(event) => setPlan({ ...plan, dueDay: event.target.value })}/>
                    </label>
                  )}
                </div>
                <div className="nkj-installment-calculation">
                  <div><span>Remaining balance</span><strong>₹ {money(remainingBalance)}</strong></div>
                  <div><span>Selected installments</span><strong>{plan.installmentCount || "—"}</strong></div>
                </div>
                {selectedInvoice && Number(plan.installmentCount) > 0 && remainingBalance === 0 && (
                  <p className="nkj-module-footnote">The down payment covers the complete invoice. The plan will be saved without creating unnecessary zero-value installment rows.</p>
                )}
              </section>
            </div>

            {schedulePreview.length > 0 && (
              <section className="nkj-installment-preview">
                <div className="nkj-panel-head">
                  <h3>Automatic installment schedule preview</h3>
                  <span>Backend recalculates and verifies these amounts before saving.</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Installment Number</th><th>Due Date</th><th>Scheduled Amount (₹)</th></tr></thead>
                    <tbody>
                      {schedulePreview.map((row) => (
                        <tr key={row.installmentNo}>
                          <td>{row.installmentNo}/{plan.installmentCount}</td>
                          <td>{fmtDate(row.dueDate)}</td>
                          <td>{money(row.amount)}</td>
                        </tr>
                      ))}
                      <tr><th colSpan="2">Total scheduled</th><th>₹ {money(schedulePreview.reduce((sum, row) => sum + row.amount, 0))}</th></tr>
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <div className="nkj-module-form-actions">
              <button type="submit" className="primary" disabled={saving || loading || !selectedInvoice}>
                {saving ? "Creating…" : "Save Installment Plan"}
              </button>
            </div>
          </form>
        )}

        {tab === "accounts" && (
          <>
            <section className="panel nkj-module-table">
              <div className="nkj-installment-toolbar">
                <div className="nkj-module-toolbar"><Search size={17}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search invoice, customer or mobile"/></div>
                <span>{filteredAccounts.length} accounts</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Invoice Number</th><th>Customer</th><th>Installments</th><th>Original Amount (₹)</th><th>Amount Paid (₹)</th><th>Remaining (₹)</th><th>Progress</th><th>Next Due</th><th>Action</th></tr></thead>
                  <tbody>
                    {filteredAccounts.map((account) => {
                      const next = account.schedules.find((schedule) => Number(schedule.remainingAmount) > 0);
                      const progress = account.total > 0 ? Math.min(100, account.paid / account.total * 100) : 0;
                      return (
                        <tr key={account.id}>
                          <td><b>{account.invoiceNo}</b><small className="nkj-table-sub">{account.bookingNo}</small></td>
                          <td>{account.customerName}<small className="nkj-table-sub">{account.mobile || "—"}</small></td>
                          <td>{account.paidCount}/{account.count}<small className="nkj-table-sub">{account.count} selected</small></td>
                          <td>{money(account.total)}</td>
                          <td>{money(account.paid)}</td>
                          <td className="nkj-outstanding">{money(account.outstanding)}</td>
                          <td><div className="nkj-installment-progress"><i style={{ width: `${progress}%` }}/></div><small>{progress.toFixed(0)}%</small></td>
                          <td>{next ? fmtDate(next.dueDate) : "Completed"}</td>
                          <td className="nkj-installment-row-actions">
                            <button type="button" className="small-action" onClick={() => openAccountDetails(account)}><Eye size={14}/> View</button>
                            <button type="button" className="small-action" onClick={() => printAccount(account)}><Printer size={14}/> Print</button>
                            {next && <button type="button" className="small-action" onClick={() => startReceipt(next)}><CreditCard size={14}/> Collect</button>}
                          </td>
                        </tr>
                      );
                    })}
                    {!filteredAccounts.length && <tr><td colSpan="9" className="empty">No installment accounts found. Create one from an eligible saved invoice.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            {selectedAccount && (
              <section className="panel nkj-installment-detail-panel">
                <div className="nkj-panel-head">
                  <div><h3><Eye size={18}/> Installment Details · {selectedAccount.invoiceNo}</h3><span>{selectedAccount.customerName}</span></div>
                  <button type="button" className="secondary" onClick={() => { setSelectedAccount(null); setAccountDetails(null); }}>Close</button>
                </div>
                {detailLoading && <p>Loading installment details…</p>}
                {accountDetails && (
                  <>
                    <div className="nkj-installment-detail-summary">
                      <div><span>Original invoice</span><b>₹ {money(accountDetails.plan.originalInvoiceAmount)}</b><small>{fmtDate(accountDetails.plan.invoiceDate)}</small></div>
                      <div><span>Down payment</span><b>₹ {money(accountDetails.plan.downPayment)}</b><small>{fmtDate(accountDetails.plan.downPaymentDate)} · {accountDetails.plan.downPaymentMethod || "Method not recorded"}</small></div>
                      <div><span>Remaining balance</span><b>₹ {money(accountDetails.plan.remainingBalance)}</b></div>
                      <div><span>Total installments</span><b>{accountDetails.plan.totalInstallments}</b><small>{accountDetails.plan.paymentFrequency}</small></div>
                    </div>
                    <div className="nkj-installment-customer-invoice">
                      <div><span>Customer</span><b>{accountDetails.plan.customerName}</b></div>
                      <div><span>Mobile</span><b>{accountDetails.plan.mobile || "—"}</b></div>
                      <div><span>Address</span><b>{accountDetails.plan.customerAddress || "—"}</b></div>
                      <div><span>Invoice Number</span><b>{accountDetails.plan.invoiceNo}</b></div>
                      <div><span>Invoice Date</span><b>{fmtDate(accountDetails.plan.invoiceDate)}</b></div>
                      <div><span>Payment Frequency</span><b>{accountDetails.plan.paymentFrequency}</b></div>
                      <div><span>Next Due Date</span><b>{fmtDate((accountDetails.schedule || []).find((row) => Number(row.remainingAmount) > 0)?.dueDate)}</b></div>
                      <div><span>Plan Status</span><b>{accountDetails.plan.status || "OPEN"}</b></div>
                    </div>
                    <h4>Installment Schedule</h4>
                    {renderScheduleTable(accountDetails.schedule || [], accountDetails.plan.totalInstallments)}
                    <h4>Payment History</h4>
                    {renderPaymentHistory(accountDetails.payments || [])}
                  </>
                )}
              </section>
            )}
          </>
        )}

        {tab === "receipts" && (
          <div className="nkj-installment-receipt-layout">
            <form className="nkj-module-form" onSubmit={postReceipt}>
              <h3><Wallet size={18}/> Collect Installment Payment</h3>
              <label>
                <span>Installment / invoice *</span>
                <select value={receiptForm.installmentId} onChange={(event) => setReceiptForm({ ...receiptForm, installmentId: event.target.value })} required>
                  <option value="">Select any outstanding installment</option>
                  {dueRows.map((schedule) => (
                    <option key={schedule.id} value={schedule.id}>
                      {schedule.invoiceNo} · {schedule.customerName} · {schedule.installmentNo}/{schedule.totalInstallments} · remaining ₹{money(schedule.remainingAmount)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="nkj-installment-input-grid">
                <label><span>Payment date *</span><input type="date" max={today()} value={receiptForm.paymentDate} onChange={(event) => setReceiptForm({ ...receiptForm, paymentDate: event.target.value })} required/></label>
                <label><span>Amount received (₹) *</span><input type="number" min="0.01" step="0.01" value={receiptForm.amount} onChange={(event) => setReceiptForm({ ...receiptForm, amount: event.target.value })} required/></label>
                <label><span>Payment method *</span><select value={receiptForm.paymentMethod} onChange={(event) => setReceiptForm({ ...receiptForm, paymentMethod: event.target.value })}><option>Cash</option><option>UPI</option><option>Bank Transfer</option><option>Card</option><option>Cheque</option></select></label>
                <label><span>Transaction reference</span><input type="text" maxLength="100" value={receiptForm.referenceNo} onChange={(event) => setReceiptForm({ ...receiptForm, referenceNo: event.target.value })} placeholder="UPI / bank reference"/></label>
              </div>
              <p className="nkj-module-footnote">Partial and early payments are supported. The backend locks the installment row, checks the outstanding balance and prevents duplicate submissions.</p>
              <div className="nkj-module-form-actions"><button className="primary" disabled={saving || loading}>{saving ? "Saving receipt…" : "Save Receipt"}</button></div>
            </form>

            <section className="panel nkj-notebook-ledger">
              <h3><ReceiptText size={18}/> Payment Notebook</h3>
              {renderPaymentHistory(receipts)}
            </section>
          </div>
        )}

        {tab === "due" && (
          <section className="panel nkj-module-table">
            <div className="nkj-panel-head"><h3><CalendarDays size={18}/> Due &amp; Reminder Register</h3><span>{dueRows.length} outstanding installments</span></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Invoice Number</th><th>Customer</th><th>Installment</th><th>Due Date</th><th>Scheduled (₹)</th><th>Amount Paid (₹)</th><th>Remaining (₹)</th><th>Payment Status</th><th>Action</th></tr></thead>
                <tbody>
                  {dueRows.map((schedule) => (
                    <tr key={schedule.id}>
                      <td><b>{schedule.invoiceNo}</b></td>
                      <td>{schedule.customerName}</td>
                      <td>{schedule.installmentNo}/{schedule.totalInstallments}</td>
                      <td>{fmtDate(schedule.dueDate)}</td>
                      <td>{money(schedule.amountDue)}</td>
                      <td>{money(schedule.amountPaid)}</td>
                      <td className="nkj-outstanding">{money(schedule.remainingAmount)}</td>
                      <td><span className={`nkj-installment-status ${statusClass(schedule.paymentStatus)}`}>{statusLabel(schedule.paymentStatus)}</span></td>
                      <td className="nkj-installment-row-actions">
                        <button type="button" className="small-action" onClick={() => startReceipt(schedule)}><Plus size={13}/> Receive</button>
                        <button type="button" className="small-action" onClick={() => updateDueDate(schedule)}><Pencil size={13}/> Reschedule</button>
                      </td>
                    </tr>
                  ))}
                  {!dueRows.length && <tr><td colSpan="9" className="empty">No outstanding installments.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </section>
    </Page>
  );
}
