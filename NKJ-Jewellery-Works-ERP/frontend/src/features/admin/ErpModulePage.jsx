import "./ErpModulePage.css";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, Pencil, Trash2, X, Save, Printer, Package, Gem, Users, ShieldCheck, Clock3, Hammer, CalendarCheck, ClipboardList } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Page } from "../../shared/layouts/OwnerShell";
import { money } from "../../shared/utils/formatters";
import { request } from "../../core/api/client";
import { useRealtimeRefresh } from "../../core/realtime/realtime";
import { moduleConfig } from "./moduleConfig";

const emptyForm = (fields) => Object.fromEntries(fields.map((field) => [field[0], ""]));
const businessCodeFields = new Set(["staffCode", "customerCode", "itemCode", "supplierCode", "bookingNo", "orderNo"]);
const cashCreateModules = new Set(["payments", "bookings", "pre-bookings", "expenses", "purchases", "salary", "salary-payments"]);
const newIdempotencyKey = (module) => "ERP-" + module + "-" + (globalThis.crypto?.randomUUID?.() || Date.now() + "-" + Math.random().toString(36).slice(2));
const currencyFields = new Set([
  "monthlySalary", "openingBalance", "amount", "totalAmount", "paidAmount", "balance",
  "purchasePrice", "makingCharge", "estimatedRate", "estimatedValue", "makingEstimate",
  "advanceAmount", "remainingAmount", "amountDue", "basicSalary", "allowances", "overtime",
  "bonus", "deductions", "advanceSalary", "absentDeduction", "netSalary", "amountPaid", "remainingSalary",
  "estimatedCost", "rate", "rateValue"
]);
const display = (key, value) => {
  if (value == null || value === "") return "—";
  if (typeof value === "number" && Number.isFinite(value)) {
    return currencyFields.has(key)
      ? money(value)
      : value.toLocaleString("en-IN", { maximumFractionDigits: 3 });
  }
  return String(value);
};

export default function ErpModulePage({ module }) {
  const config = moduleConfig[module];
  const [rows, setRows] = useState([]);
  const [staffOptions, setStaffOptions] = useState([]);
  const [salaryOptions, setSalaryOptions] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const staffFilter = searchParams.get("staffId") || "";
  const staffLinkedModule = ["attendance", "leaves", "salary", "salary-payments"].includes(module);
  const [form, setForm] = useState(() => emptyForm(config.fields));
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const createRequestKeyRef = useRef("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const needsStaffLookup = ["attendance", "salary", "leaves", "salary-payments"].includes(module);
      const needsSalaryLookup = module === "salary-payments";
      const [data, staffData, salaryData] = await Promise.all([
        request(`/admin/modules/${config.api}`),
        needsStaffLookup ? request("/admin/modules/staff") : Promise.resolve([]),
        needsSalaryLookup ? request("/admin/modules/salary") : Promise.resolve([]),
      ]);
      setRows(Array.isArray(data) ? data : []);
      if (needsStaffLookup) setStaffOptions(Array.isArray(staffData) ? staffData : []);
      if (needsSalaryLookup) setSalaryOptions(Array.isArray(salaryData) ? salaryData : []);
    } catch (e) {
      setError(e.message || "Could not load records.");
    } finally {
      setLoading(false);
    }
  }, [config.api, module]);

  useEffect(() => { load(); }, [load]);
  useRealtimeRefresh(load, [config.api, "dashboard", "reports", "transactions", "cashbook"]);
  useEffect(() => {
    if (module !== "customers") return undefined;
    const refreshCustomers = () => { load(); };
    window.addEventListener("nkj:customers-updated", refreshCustomers);
    return () => window.removeEventListener("nkj:customers-updated", refreshCustomers);
  }, [module, load]);
  useEffect(() => {
    setRows([]);
    setStaffOptions([]);
    setSalaryOptions([]);
    setForm(emptyForm(config.fields));
    setEditingId(null);
    setShowForm(false);
    setSearch("");
    setMessage("");
    setError("");
  }, [module]);

  const needsActiveStaff = ["attendance", "salary", "leaves"].includes(module);
  const hasActiveStaff = staffOptions.some((person) => String(person.status || "").toUpperCase() === "ACTIVE");
  const staffSelectionBlocked = needsActiveStaff && !hasActiveStaff && !editingId;
  const salarySelectionBlocked = module === "salary-payments" && !salaryOptions.some((record) => Number(record.remainingSalary || 0) > 0) && !editingId;
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => {
      const matchesSearch = Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(query));
      const matchesStaff = !staffLinkedModule || !staffFilter || String(row.staffId || "") === String(staffFilter);
      return matchesSearch && matchesStaff;
    });
  }, [rows, search, staffLinkedModule, staffFilter]);

  const startCreate = () => {
    createRequestKeyRef.current = "";
    setEditingId(null);
    setForm(emptyForm(config.fields));
    setMessage("");
    setError("");
    if (["attendance", "salary", "leaves"].includes(module) && !hasActiveStaff) {
      setError("No active staff profiles are available. Add or activate a staff member in Staff Details first.");
    }
    if (module === "salary-payments" && !salaryOptions.some((record) => Number(record.remainingSalary || 0) > 0)) {
      setError("No salary record has an outstanding balance. Create a Salary Management record first.");
    }
    setShowForm(true);
  };

  const startEdit = (row) => {
    setEditingId(row.id);
    const nextForm = {};
    config.fields.forEach((field) => {
      const value = row[field[0]];
      nextForm[field[0]] = value == null ? "" : String(value).slice(0, field[2] === "date" ? 10 : undefined);
    });
    setForm(nextForm);
    setMessage("");
    setError("");
    setShowForm(true);
  };

  const save = async (event) => {
    event.preventDefault();
    if (module === "leaves" && form.fromDate && form.toDate && form.fromDate > form.toDate) {
      setError("Leave From Date cannot be after To Date.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    const payload = { ...form };
    for (const field of config.fields) {
      if (field[2] === "number" || field[2] === "staff-select" || field[2] === "salary-select") {
        payload[field[0]] = payload[field[0]] === "" ? null : Number(payload[field[0]]);
      }
      if (payload[field[0]] === "") payload[field[0]] = null;
    }
    try {
      const headers = !editingId && cashCreateModules.has(module)
        ? { "Idempotency-Key": createRequestKeyRef.current || newIdempotencyKey(module) }
        : undefined;
      if (!editingId && cashCreateModules.has(module) && !createRequestKeyRef.current) {
        createRequestKeyRef.current = headers["Idempotency-Key"];
      }
      await request(editingId ? `/admin/modules/${config.api}/${editingId}` : `/admin/modules/${config.api}`, {
        method: editingId ? "PUT" : "POST",
        headers,
        body: JSON.stringify(payload),
      });
      createRequestKeyRef.current = "";
      setShowForm(false);
      setMessage(editingId ? "Record updated." : "Record created.");
      await load();
    } catch (e) {
      setError(e.message || "Could not save this record.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete this ${config.title.toLowerCase()} record?`)) return;
    setError("");
    setMessage("");
    try {
      if (module === "audit-logs") {
        await request(`/admin/audit-logs/${row.id}`, { method: "DELETE" });
        setMessage("Audit entry deleted. A separate deletion event was recorded.");
      } else {
        await request(`/admin/modules/${config.api}/${row.id}`, { method: "DELETE" });
        setMessage("Record deleted.");
      }
      await load();
    } catch (e) {
      setError(e.message || "Could not delete record.");
    }
  };

  const updateLeaveStatus = async (row, status) => {
    const confirmation = status === "APPROVED"
      ? "Approve this leave? All covered dates will automatically become locked ABSENT attendance."
      : status === "CANCELLED"
        ? "Cancel this leave? System-generated attendance will be removed and previous manual attendance restored."
        : "Reject this leave request?";
    if (!window.confirm(confirmation)) return;
    setError("");
    setMessage("");
    try {
      await request(`/admin/modules/leaves/${row.id}`, {
        method: "PUT",
        body: JSON.stringify({ status })
      });
      setMessage(status === "APPROVED"
        ? "Leave approved. Covered attendance dates are now locked ABSENT."
        : status === "CANCELLED"
          ? "Leave cancelled and attendance reconciled."
          : "Leave request rejected.");
      await load();
    } catch (statusError) {
      setError(statusError.message || "Could not update leave status.");
    }
  };

  const auditDeleteOnly = module === "audit-logs";
  const showActions = auditDeleteOnly || (!config.readOnly && !config.appendOnly) || module === "bookings";
  const columnCount = config.columns.length + (showActions ? 1 : 0);
  const stats = module === "inventory" ? [
    ["Total Items", rows.length, Package], ["Gold Items", rows.filter(x=>String(x.metalType).toUpperCase()==="GOLD").length, Gem],
    ["Silver Items", rows.filter(x=>String(x.metalType).toUpperCase()==="SILVER").length, Gem], ["In Stock", rows.filter(x=>String(x.status).toUpperCase()==="IN_STOCK").length, ShieldCheck]
  ] : module === "karigars" ? [
    ["Total Karigars", rows.length, Users], ["Active", rows.filter(x=>String(x.status).toUpperCase()==="ACTIVE").length, ShieldCheck],
    ["On Hold", rows.filter(x=>String(x.status).toUpperCase()==="ON_HOLD").length, Clock3], ["Specialities", new Set(rows.map(x=>x.speciality).filter(Boolean)).size, Hammer]
  ] : [];
  const printBooking = (row) => {
    const safe = (v) => String(v ?? "—").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
    const content = `<h1>Nandikishor Jewellery Works</h1><h2>Pre-Booking Bill</h2><p><b>Booking No:</b> ${safe(row.bookingNo)}<br><b>Customer:</b> ${safe(row.customerName)}<br><b>Mobile:</b> ${safe(row.mobile)}<br><b>Date:</b> ${safe(row.bookingDate)}</p><hr><p><b>Description:</b> ${safe(row.description)}</p><p><b>Estimated value:</b> ₹ ${safe(row.estimatedValue)}<br><b>Advance received:</b> ₹ ${safe(row.advanceAmount)}<br><b>Balance:</b> ₹ ${safe(row.remainingAmount)}<br><b>Expected delivery:</b> ${safe(row.deliveryDate)}</p><p><b>Status:</b> ${safe(row.status)}</p><p>Thank you.</p>`;
    const w=window.open("","_blank","width=850,height=700"); if(!w){setError("Allow popups to print this pre-booking bill.");return;} w.document.write(`<!doctype html><html><head><title>Pre-Booking ${safe(row.bookingNo)}</title><style>body{font:14px Arial;padding:32px;color:#241b1b}h1{color:#850d2d}hr{border:0;border-top:1px solid #ddd;margin:24px 0}</style></head><body>${content}<script>window.onload=()=>window.print()</script></body></html>`);w.document.close();
  };

  return (
    <Page active={module}>
      <section className="nkj-module-page">
        <div className="nkj-module-heading">
          <div>
            <span className="eyebrow">OWNER WORKSPACE</span>
            <h2>{config.title}</h2>
            <p>{config.description}</p>
          </div>
          <div className="nkj-module-actions">
            
            {!config.readOnly && !config.singleRecord && <button className="primary" onClick={startCreate}><Plus size={17} /> Add Record</button>}
          </div>
        </div>

        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}

        {stats.length > 0 && <div className="nkj-module-kpis">{stats.map(([label,value,Icon])=><div key={label}><Icon size={20}/><span>{label}</span><strong>{value}</strong></div>)}</div>}
        <div className={`nkj-module-toolbar ${staffLinkedModule ? "has-staff-filter" : ""}`}>
          {staffLinkedModule && (
            <label className="nkj-module-staff-filter">
              <span>Staff member</span>
              <select value={staffFilter} onChange={(event) => {
                const next = new URLSearchParams(searchParams);
                if (event.target.value) next.set("staffId", event.target.value);
                else next.delete("staffId");
                setSearchParams(next, { replace: true });
              }}>
                <option value="">All staff</option>
                {staffOptions.map((person) => <option key={person.id} value={String(person.id)}>{person.staffCode || `NKJ-STF-${String(person.id).padStart(5, "0")}`} — {person.fullName}</option>)}
              </select>
            </label>
          )}
          <Search size={18} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${config.title.toLowerCase()}...`} />
          <span>{filtered.length} records</span>
        </div>

        {showForm && !config.readOnly && !auditDeleteOnly && (
          <form className="nkj-module-form" onSubmit={save}>
            <div className="nkj-module-form-head">
              <h3>{editingId ? "Edit record" : "New record"}</h3>
              <button type="button" className="icon-btn" onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>
            <div className="nkj-module-fields">
              {config.fields.map((field) => (
                <label key={field[0]}>
                  <span>{field[1]}{field[3] ? " *" : ""}</span>
                  {field[2] === "file" ? (
                    <>
                      <input type="file" accept={field[0] === "purchaseBill" ? "image/*,.pdf" : "image/*"} onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        const maxSize = field[0] === "purchaseBill" ? 5 * 1024 * 1024 : 2 * 1024 * 1024;
                        if (file.size > maxSize) { setError(field[0] === "purchaseBill" ? "Purchase bill must be 5 MB or smaller." : "Photo must be 2 MB or smaller."); event.target.value = ""; return; }
                        const reader = new FileReader();
                        reader.onload = () => setForm(current => ({ ...current, [field[0]]: String(reader.result || "") }));
                        reader.readAsDataURL(file);
                      }} />
                      {form[field[0]] && (String(form[field[0]]).startsWith("data:image/") ? <img className="nkj-staff-photo-preview" src={form[field[0]]} alt="File preview" /> : <a className="nkj-file-preview-link" href={form[field[0]]} download={field[0] === "purchaseBill" ? "purchase-bill" : "uploaded-file"}>Attached file</a>)}
                    </>
                  ) : field[2] === "textarea" ? (
                    <textarea required={!!field[3]} rows={2} value={form[field[0]]} onChange={(event) => setForm({ ...form, [field[0]]: event.target.value })} />
                  ) : field[2] === "salary-select" ? (
                    <>
                      <select required value={form[field[0]]} onChange={(event) => setForm((current) => ({ ...current, [field[0]]: event.target.value }))} disabled={!salaryOptions.some((record) => Number(record.remainingSalary || 0) > 0)}>
                        <option value="">Select staff payroll record</option>
                        {salaryOptions.filter((record) => Number(record.remainingSalary || 0) > 0 || String(record.id) === String(form[field[0]])).map((record) => (
                          <option key={record.id} value={String(record.id)}>
                            {record.staffCode || `NKJ-STF-${String(record.staffId).padStart(5, "0")}`} — {record.staffName} · {record.payrollMonth} · Due ₹{money(record.remainingSalary)}
                          </option>
                        ))}
                      </select>
                      <small className="nkj-field-hint">Select an existing payroll record. The receipt is linked to that staff member and updates the remaining salary automatically.</small>
                    </>
                  ) : field[2] === "staff-select" ? (
                    <>
                      <select
                        required={!!field[3]}
                        value={form[field[0]]}
                        disabled={!hasActiveStaff && !editingId}
                        onChange={(event) => {
                          const selectedId = event.target.value;
                          const selectedStaff = staffOptions.find((person) => String(person.id) === selectedId);
                          setForm((current) => {
                            const next = { ...current, [field[0]]: selectedId };
                            if (module === "salary" && selectedStaff && !next.basicSalary) {
                              next.basicSalary = String(selectedStaff.monthlySalary ?? "");
                            }
                            return next;
                          });
                        }}
                      >
                        <option value="">Select active staff member</option>
                        {staffOptions
                          .filter((person) => String(person.status || "").toUpperCase() === "ACTIVE" || (editingId && String(person.id) === String(form[field[0]])))
                          .map((person) => {
                            const inactive = String(person.status || "").toUpperCase() !== "ACTIVE";
                            const staffCode = person.staffCode || `NKJ-STF-${String(person.id).padStart(5, "0")}`;
                            return <option key={person.id} value={String(person.id)}>{staffCode} — {person.fullName || "Staff member"}{inactive ? " (Inactive · existing record)" : ""}</option>;
                          })}
                      </select>
                      <small className="nkj-field-hint">Only active staff can be selected for a new record. The staff ID is saved as a secure database link.</small>
                    </>
                  ) : field[2] === "select" ? (
                    <select required={!!field[3]} value={form[field[0]]} onChange={(event) => setForm({ ...form, [field[0]]: event.target.value })}>
                      <option value="">Select</option>
                      {(field[4] || []).map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
                    </select>
                  ) : (
                    <input required={!!field[3]} type={field[2]}
                      min={field[2] === "number" ? "0" : module === "leaves" && field[0] === "toDate" ? (form.fromDate || undefined) : undefined}
                      max={module === "leaves" && field[0] === "fromDate" ? (form.toDate || undefined) : undefined}
                      step={field[2] === "number" ? "0.001" : undefined}
                      value={form[field[0]]}
                      onChange={(event) => setForm((current) => ({ ...current, [field[0]]: event.target.value }))} />
                  )}
                </label>
              ))}
            </div>
            {module === "salary" && form.staffId && form.payrollMonth && (
              <div className="nkj-payroll-linked-review">
                <div><b>Linked staff records</b><small>Review attendance and approved leave for this staff member and payroll month before entering the unpaid absence deduction. No deduction is assumed automatically.</small></div>
                <Link to={`/attendance?staffId=${form.staffId}`}><CalendarCheck size={14} /> Review Attendance</Link>
                <Link to={`/leaves?staffId=${form.staffId}`}><ClipboardList size={14} /> Review Leave</Link>
              </div>
            )}
            <div className="nkj-module-form-actions">
              <button type="button" className="secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="primary" disabled={saving || staffSelectionBlocked || salarySelectionBlocked}><Save size={16} />{saving ? "Saving…" : "Save Record"}</button>
            </div>
          </form>
        )}

        <div className="panel nkj-module-table">
          <div className="table-wrap">
            <table>
              <thead><tr>{config.columns.map(([key, label]) => <th key={key}>{label}</th>)}{showActions && <th>Actions</th>}</tr></thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    {config.columns.map(([key]) => <td key={key}>
                      {key === "staffName" && row.staffId
                        ? <Link className="nkj-module-staff-link" to={`/staff?staffId=${row.staffId}`}>{row[key] || "Staff member"}</Link>
                        : module === "leaves" && key === "status"
                          ? <span className={`nkj-status-pill ${String(row.status || "").toLowerCase()}`}>{String(row.status || "PENDING").replaceAll("_", " ")}</span>
                          : businessCodeFields.has(key) && row[key] ? <span className="nkj-business-code">{row[key]}</span> : display(key, row[key])}
                    </td>)}
                    {showActions && <td><div className="nkj-row-actions">
                      {!auditDeleteOnly && !config.readOnly && !config.appendOnly && <button className="small-action" onClick={() => startEdit(row)}><Pencil size={14} /> Edit</button>}
                      {module === "leaves" && String(row.status).toUpperCase() === "PENDING" && <>
                        <button className="small-action nkj-leave-approve-action" onClick={() => updateLeaveStatus(row, "APPROVED")}>Approve</button>
                        <button className="small-action nkj-leave-reject-action" onClick={() => updateLeaveStatus(row, "REJECTED")}>Reject</button>
                      </>}
                      {module === "leaves" && String(row.status).toUpperCase() === "APPROVED" && <button className="small-action nkj-leave-reject-action" onClick={() => updateLeaveStatus(row, "CANCELLED")}>Cancel Leave</button>}
                      {module === "bookings" && <button className="small-action" onClick={() => printBooking(row)}><Printer size={14}/> Print</button>}
                      {(auditDeleteOnly || (!config.readOnly && !config.appendOnly)) && <button className="small-action nkj-delete-action" onClick={() => remove(row)}><Trash2 size={14} /> Delete</button>}
                    </div></td>}
                  </tr>
                ))}
                {!loading && !filtered.length && <tr><td colSpan={columnCount} className="empty">No records found.</td></tr>}
                {loading && <tr><td colSpan={columnCount} className="empty">Loading records…</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <p className="nkj-module-footnote">{auditDeleteOnly ? "Audit log deletion is restricted to the owner and the deletion itself is recorded as a new audit event." : config.readOnly ? "This register is read-only." : config.appendOnly ? "Posted transactions are append-only so linked balances and stock quantities cannot drift. Record a correcting transaction rather than editing or deleting a posted entry." : "Changes are saved to PostgreSQL and recorded in the owner audit log. Use the dedicated payment and stock workflows for reconciled financial and inventory transactions."}</p>
      </section>
    </Page>
  );
}
