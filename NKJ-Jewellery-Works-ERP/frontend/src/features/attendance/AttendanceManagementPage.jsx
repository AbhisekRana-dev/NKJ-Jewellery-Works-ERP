import "./AttendanceManagementPage.css";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  CalendarDays, RefreshCw, Plus, Download, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, Users, Check, X, Lock, Pencil, Trash2,
  CalendarCheck2, Clock3, Search, FileSpreadsheet
} from "lucide-react";
import { Page } from "../../shared/layouts/OwnerShell";
import { request } from "../../core/api/client";
import { useRealtimeRefresh } from "../../core/realtime/realtime";

const todayLocal = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const dateKey = (value) => String(value || "").slice(0, 10);
const statusLetter = (status) => ({ PRESENT: "P", ABSENT: "A", HALF_DAY: "H" }[String(status || "").toUpperCase()] || "—");
const statusClass = (status) => ({ PRESENT: "present", ABSENT: "absent", HALF_DAY: "half-day" }[String(status || "").toUpperCase()] || "unmarked");
const statusLabel = (status) => ({ PRESENT: "Present", ABSENT: "Absent", HALF_DAY: "Half Day" }[String(status || "").toUpperCase()] || "Unmarked");
const staffIdLabel = (person) => person.staffCode || `NKJ-STF-${String(person.id).padStart(5, "0")}`;
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const dateLabel = (value) => {
  if (!value) return "—";
  const [year, month, day] = dateKey(value).split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};
const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const saveCsv = (filename, rows) => {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export default function AttendanceManagementPage() {
  const initialToday = todayLocal();
  const [searchParams, setSearchParams] = useSearchParams();
  const staffFilter = searchParams.get("staffId") || "";
  const [year, setYear] = useState(Number(initialToday.slice(0, 4)));
  const [month, setMonth] = useState(Number(initialToday.slice(5, 7)));
  const [today, setToday] = useState(initialToday);
  const [selectedDate, setSelectedDate] = useState(initialToday);
  const [viewMode, setViewMode] = useState("MULTI_DAY");
  const [staff, setStaff] = useState([]);
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState({ totalStaff: 0, todayPresent: 0, todayAbsent: 0, todayHalfDay: 0 });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ staffId: "", attendanceDate: initialToday, status: "PRESENT" });
  const [leaveCheck, setLeaveCheck] = useState({ loading: false, allowed: true, leave: null, message: "" });
  const [editingCell, setEditingCell] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const result = await request(`/admin/attendance/dashboard?year=${year}&month=${month}`);
      setStaff(Array.isArray(result.staff) ? result.staff : []);
      setRecords(Array.isArray(result.records) ? result.records : []);
      setSummary(result.summary || { totalStaff: 0, todayPresent: 0, todayAbsent: 0, todayHalfDay: 0 });
      setToday(dateKey(result.today) || todayLocal());
    } catch (loadError) {
      setError(loadError.message || "Could not load attendance for this month.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);
  useRealtimeRefresh(() => load(true), ["attendance", "leaves", "staff", "dashboard", "reports"]);

  useEffect(() => {
    setSelectedDate((current) => {
      if (current.slice(0, 7) === `${year}-${String(month).padStart(2, "0")}`) return current;
      return `${year}-${String(month).padStart(2, "0")}-01`;
    });
    setPage(1);
    setEditingCell(null);
  }, [year, month]);

  useEffect(() => {
    if (!showAdd || !form.staffId || !form.attendanceDate) {
      setLeaveCheck({ loading: false, allowed: true, leave: null, message: "" });
      return undefined;
    }
    let cancelled = false;
    setLeaveCheck((current) => ({ ...current, loading: true, message: "" }));
    request(`/admin/attendance/leave-check?staffId=${encodeURIComponent(form.staffId)}&date=${encodeURIComponent(form.attendanceDate)}`)
      .then((result) => {
        if (!cancelled) setLeaveCheck({ loading: false, allowed: result.allowed !== false, leave: result.leave || null, message: result.message || "" });
      })
      .catch((checkError) => {
        if (!cancelled) setLeaveCheck({ loading: false, allowed: false, leave: null, message: checkError.message || "Could not validate approved leave." });
      });
    return () => { cancelled = true; };
  }, [showAdd, form.staffId, form.attendanceDate]);

  const recordMap = useMemo(() => {
    const map = new Map();
    records.forEach((record) => map.set(`${record.staffId}|${dateKey(record.attendanceDate)}`, record));
    return map;
  }, [records]);

  const days = useMemo(() => {
    const count = new Date(year, month, 0).getDate();
    return Array.from({ length: count }, (_, index) => {
      const date = new Date(year, month - 1, index + 1);
      const key = `${year}-${String(month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`;
      return { key, day: index + 1, weekday: date.toLocaleDateString("en-IN", { weekday: "short" }) };
    });
  }, [year, month]);

  const filteredStaff = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return staff;
    return staff.filter((person) => {
      const matchesStaff = !staffFilter || String(person.id) === String(staffFilter);
      return matchesStaff && `${person.fullName || ""} ${staffIdLabel(person)}`.toLowerCase().includes(query);
    });
  }, [staff, search, staffFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredStaff.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visibleStaff = filteredStaff.slice((safePage - 1) * pageSize, safePage * pageSize);
  const totalsFor = (staffId) => days.reduce((totals, day) => {
    const record = recordMap.get(`${staffId}|${day.key}`);
    if (record?.status === "PRESENT") totals.present += 1;
    if (record?.status === "ABSENT") totals.absent += 1;
    if (record?.status === "HALF_DAY") totals.half += 1;
    return totals;
  }, { present: 0, absent: 0, half: 0 });

  const navigateMonth = (delta) => {
    const next = new Date(year, month - 1 + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth() + 1);
  };
  const goToday = () => {
    const current = todayLocal();
    setYear(Number(current.slice(0, 4)));
    setMonth(Number(current.slice(5, 7)));
    setSelectedDate(current);
  };
  const startAdd = () => {
    setForm({ staffId: "", attendanceDate: viewMode === "SINGLE_DAY" ? selectedDate : today.slice(0, 7) === `${year}-${String(month).padStart(2, "0")}` ? today : `${year}-${String(month).padStart(2, "0")}-01`, status: "PRESENT" });
    setLeaveCheck({ loading: false, allowed: true, leave: null, message: "" });
    setShowAdd(true);
    setError("");
    setMessage("");
  };

  const saveStatus = async (staffId, date, existing, nextStatus) => {
    if (!nextStatus) return;
    if (existing?.locked || existing?.systemGenerated || existing?.leaveId) {
      setError("Approved-leave attendance is locked and cannot be changed.");
      setEditingCell(null);
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = { staffId: Number(staffId), attendanceDate: date, status: nextStatus };
      if (existing?.id) {
        await request(`/admin/modules/attendance/${existing.id}`, { method: "PUT", body: JSON.stringify({ status: nextStatus }) });
      } else {
        await request("/admin/modules/attendance", { method: "POST", body: JSON.stringify(payload) });
      }
      setEditingCell(null);
      setMessage(`Attendance marked ${statusLabel(nextStatus).toLowerCase()} for ${dateLabel(date)}.`);
      await load(true);
    } catch (saveError) {
      setError(saveError.message || "Could not save attendance.");
    } finally {
      setSaving(false);
    }
  };

  const deleteRecord = async (record) => {
    if (!record?.id || record.locked || record.systemGenerated || record.leaveId) return;
    if (!window.confirm("Delete this attendance record?")) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await request(`/admin/modules/attendance/${record.id}`, { method: "DELETE" });
      setEditingCell(null);
      setMessage("Attendance record deleted.");
      await load(true);
    } catch (deleteError) {
      setError(deleteError.message || "Could not delete attendance.");
    } finally {
      setSaving(false);
    }
  };

  const saveNewRecord = async (event) => {
    event.preventDefault();
    if (saving || !form.staffId || !form.attendanceDate) return;
    if (!leaveCheck.allowed) {
      setError(leaveCheck.message || "Attendance cannot be added during approved leave.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await request("/admin/modules/attendance", {
        method: "POST",
        body: JSON.stringify({ staffId: Number(form.staffId), attendanceDate: form.attendanceDate, status: form.status })
      });
      setShowAdd(false);
      const [nextYear, nextMonth] = form.attendanceDate.split("-").map(Number);
      if (nextYear !== year || nextMonth !== month) {
        setYear(nextYear);
        setMonth(nextMonth);
        setSelectedDate(form.attendanceDate);
      } else if (viewMode === "SINGLE_DAY") setSelectedDate(form.attendanceDate);
      setMessage("Attendance record saved.");
      if (nextYear === year && nextMonth === month) await load(true);
    } catch (saveError) {
      setError(saveError.message || "Could not save attendance.");
    } finally {
      setSaving(false);
    }
  };

  const exportMonth = () => {
    const totals = new Map(staff.map((person) => [String(person.id), totalsFor(person.id)]));
    const rows = [["Staff Name", "Staff ID", "Date", "Attendance Status", "Attendance Source", "Leave Type", "P Total", "A Total", "H Total", "Days Total"]];
    records.forEach((record) => {
      const totalsForStaff = totals.get(String(record.staffId)) || { present: 0, absent: 0, half: 0 };
      rows.push([
        record.staffName, record.staffCode, dateKey(record.attendanceDate), statusLabel(record.status),
        record.attendanceSource || "MANUAL", record.leaveType || "",
        totalsForStaff.present, totalsForStaff.absent, totalsForStaff.half,
        totalsForStaff.present + totalsForStaff.absent + totalsForStaff.half
      ]);
    });
    saveCsv(`NKJ-Attendance-${year}-${String(month).padStart(2, "0")}.csv`, rows);
    setExportOpen(false);
  };
  const exportDay = () => {
    const rows = [["Staff Name", "Staff ID", "Date", "Attendance Status", "Attendance Source", "Leave Type"]];
    staff.forEach((person) => {
      const record = recordMap.get(`${person.id}|${selectedDate}`);
      if (record) rows.push([person.fullName, staffIdLabel(person), selectedDate, statusLabel(record.status), record.attendanceSource || "MANUAL", record.leaveType || ""]);
    });
    saveCsv(`NKJ-Attendance-${selectedDate}.csv`, rows);
    setExportOpen(false);
  };

  const cell = (person, date) => {
    const key = `${person.id}|${date}`;
    const record = recordMap.get(key);
    const editing = editingCell === key;
    if (editing && !record?.locked) {
      return (
        <div className="nkj-attendance-cell-editor">
          <select aria-label={`Attendance for ${person.fullName} on ${date}`} defaultValue={record?.status || ""} disabled={saving} onChange={(event) => saveStatus(person.id, date, record, event.target.value)}>
            <option value="" disabled>Select</option>
            <option value="PRESENT">Present (P)</option>
            <option value="ABSENT">Absent (A)</option>
            <option value="HALF_DAY">Half Day (H)</option>
          </select>
          {record?.id && <button type="button" title="Delete attendance" aria-label="Delete attendance" disabled={saving} onClick={() => deleteRecord(record)}><Trash2 size={12} /></button>}
          <button type="button" title="Close" aria-label="Close editor" disabled={saving} onClick={() => setEditingCell(null)}><X size={12} /></button>
        </div>
      );
    }
    return (
      <button
        type="button"
        className={`nkj-attendance-status ${statusClass(record?.status)} ${record?.locked ? "locked" : ""}`}
        title={record?.locked ? "Automatically marked Absent – Approved Leave" : `${statusLabel(record?.status)} · ${dateLabel(date)}`}
        aria-label={record?.locked ? `Absent due to approved leave for ${person.fullName}` : `Edit attendance for ${person.fullName} on ${date}`}
        disabled={Boolean(record?.locked) || saving}
        onClick={() => setEditingCell(key)}
      >
        {statusLetter(record?.status)}
        {record?.locked && <Lock size={10} />}
      </button>
    );
  };

  const startEditSelectedDate = (person) => {
    const record = recordMap.get(`${person.id}|${selectedDate}`);
    if (record?.locked) {
      setError("Attendance cannot be modified because this employee has an approved leave for the selected date.");
      return;
    }
    setEditingCell(`${person.id}|${selectedDate}`);
  };

  const years = Array.from({ length: 19 }, (_, index) => new Date().getFullYear() - 15 + index);
  const firstRecord = filteredStaff.length ? (safePage - 1) * pageSize + 1 : 0;
  const lastRecord = Math.min(safePage * pageSize, filteredStaff.length);

  return (
    <Page active="attendance">
      <section className="nkj-attendance-page">
        <header className="nkj-attendance-heading">
          <div className="nkj-attendance-title">
            <span className="nkj-attendance-title-icon"><CalendarDays size={29} /></span>
            <div>
              <span className="nkj-attendance-eyebrow">OWNER WORKSPACE</span>
              <h2>Attendance Management</h2>
              <p>Mark and view staff attendance for single or multiple days. Use P (Present), A (Absent) or H (Half Day).</p>
            </div>
          </div>
          <div className="nkj-attendance-actions">
            <button className="nkj-attendance-btn secondary" type="button" onClick={() => load(true)} disabled={refreshing}><RefreshCw size={16} className={refreshing ? "spinning" : ""} /> Refresh</button>
            <button className="nkj-attendance-btn primary" type="button" onClick={startAdd}><Plus size={17} /> Add Record</button>
            <div className="nkj-attendance-export">
              <button className="nkj-attendance-btn export" type="button" onClick={() => setExportOpen((value) => !value)}><Download size={16} /> Export <ChevronRight size={14} className={exportOpen ? "rotate" : ""} /></button>
              {exportOpen && <div className="nkj-attendance-export-menu"><button type="button" onClick={exportMonth}><FileSpreadsheet size={14} /> Selected Month CSV</button><button type="button" onClick={exportDay}><CalendarDays size={14} /> Single Day CSV</button></div>}
            </div>
          </div>
        </header>

        {error && <p className="nkj-attendance-alert error" role="alert">{error}</p>}
        {message && <p className="nkj-attendance-alert success" role="status">{message}</p>}

        <div className="nkj-attendance-summary">
          <article className="total"><span className="summary-icon"><Users size={25} /></span><div><b>Total Staff</b><strong>{summary.totalStaff ?? staff.length}</strong></div></article>
          <article className="present"><span className="summary-icon"><Check size={29} /></span><div><b>Today Present</b><strong>{summary.todayPresent ?? 0}</strong></div></article>
          <article className="absent"><span className="summary-icon"><X size={29} /></span><div><b>Today Absent</b><strong>{summary.todayAbsent ?? 0}</strong></div></article>
        </div>

        <section className="nkj-attendance-controls">
          <div className="nkj-attendance-view-toggle">
            <b>View Mode:</b>
            <button type="button" className={viewMode === "MULTI_DAY" ? "active" : ""} onClick={() => { setViewMode("MULTI_DAY"); setEditingCell(null); }}><CalendarDays size={15} /> Multi-Day</button>
            <button type="button" className={viewMode === "SINGLE_DAY" ? "active" : ""} onClick={() => { setViewMode("SINGLE_DAY"); setEditingCell(null); }}><CalendarCheck2 size={15} /> Single-Day</button>
          </div>
          <div className="nkj-attendance-month-controls">
            <label><span>Month &amp; Year:</span><select value={month} onChange={(event) => setMonth(Number(event.target.value))}>{monthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></label>
            <select aria-label="Attendance year" value={year} onChange={(event) => setYear(Number(event.target.value))}>{years.map((value) => <option key={value} value={value}>{value}</option>)}</select>
          </div>
          {viewMode === "MULTI_DAY" ? (
            <div className="nkj-attendance-month-nav">
              <button type="button" onClick={() => navigateMonth(-1)}><ChevronLeft size={15} /> Previous Month</button>
              <strong><CalendarDays size={17} /> {monthNames[month - 1]} {year}</strong>
              <button type="button" onClick={() => navigateMonth(1)}>Next Month <ChevronRight size={15} /></button>
              <button type="button" onClick={goToday}><Clock3 size={15} /> Today</button>
            </div>
          ) : (
            <label className="nkj-attendance-single-date"><span>Selected Date</span><input type="date" value={selectedDate} onChange={(event) => {
              const nextDate = event.target.value;
              if (!nextDate) return;
              setSelectedDate(nextDate);
              setYear(Number(nextDate.slice(0, 4)));
              setMonth(Number(nextDate.slice(5, 7)));
              setEditingCell(null);
            }} /></label>
          )}
        </section>

        <div className="nkj-attendance-table-toolbar">
          <label><Search size={16} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search staff name or Staff ID…" /></label>
          <div className="nkj-attendance-toolbar-right">
            {staffFilter && <span className="nkj-attendance-staff-filter">Filtered by Staff ID <b>{staff.find((person) => String(person.id) === String(staffFilter))?.staffCode || staffFilter}</b><button type="button" onClick={() => { const next = new URLSearchParams(searchParams); next.delete("staffId"); setSearchParams(next, { replace: true }); }}>Clear</button></span>}
            <span>{filteredStaff.length} active staff</span>
          </div>
        </div>

        <div className="nkj-attendance-table-card">
          <div className="nkj-attendance-table-scroll">
            <table className={viewMode === "MULTI_DAY" ? "multi-day" : "single-day"}>
              <thead>
                {viewMode === "MULTI_DAY" ? (
                  <>
                    <tr>
                      <th rowSpan={2} className="serial-col">Sr.<br />No.</th>
                      <th rowSpan={2} className="staff-name-col">Staff Name</th>
                      <th rowSpan={2} className="staff-id-col">Staff ID</th>
                      <th colSpan={days.length} className="month-span">{dateLabel(days[0]?.key)} – {dateLabel(days[days.length - 1]?.key)}</th>
                      <th colSpan={4} className="totals-span">Totals</th>
                      <th rowSpan={2} className="action-col">Actions</th>
                    </tr>
                    <tr>{days.map((day) => <th key={day.key} className={day.key === today ? "today-column" : ""}><span>{day.weekday}</span><b>{String(day.day).padStart(2, "0")} {monthNames[month - 1].slice(0, 3)}</b></th>)}<th className="count-p">P</th><th className="count-a">A</th><th className="count-h">H</th><th>Days</th></tr>
                  </>
                ) : (
                  <tr><th className="serial-col">Sr. No.</th><th className="staff-name-col">Staff Name</th><th className="staff-id-col">Staff ID</th><th>{dateLabel(selectedDate)}</th><th>P</th><th>A</th><th>H</th><th>Days</th><th>Actions</th></tr>
                )}
              </thead>
              <tbody>
                {visibleStaff.map((person, index) => {
                  const totals = totalsFor(person.id);
                  const daysMarked = totals.present + totals.absent + totals.half;
                  const singleRecord = recordMap.get(`${person.id}|${selectedDate}`);
                  return (
                    <tr key={person.id}>
                      <td className="serial-cell">{firstRecord + index}</td>
                      <td className="staff-name-cell"><span className="nkj-attendance-avatar">{person.photoUrl ? <img src={person.photoUrl} alt="" /> : String(person.fullName || "S").slice(0, 1).toUpperCase()}</span><b>{person.fullName}</b></td>
                      <td className="staff-id-cell"><span>{staffIdLabel(person)}</span></td>
                      {viewMode === "MULTI_DAY" ? (
                        <>
                          {days.map((day) => <td key={day.key} className={day.key === today ? "today-column" : ""}>{cell(person, day.key)}</td>)}
                          <td><b className="nkj-attendance-total present">{totals.present}</b></td>
                          <td><b className="nkj-attendance-total absent">{totals.absent}</b></td>
                          <td><b className="nkj-attendance-total half-day">{totals.half}</b></td>
                          <td className="days-total">{daysMarked}</td>
                        </>
                      ) : (
                        <>
                          <td>{cell(person, selectedDate)}</td>
                          <td><b className="nkj-attendance-total present">{singleRecord?.status === "PRESENT" ? 1 : 0}</b></td>
                          <td><b className="nkj-attendance-total absent">{singleRecord?.status === "ABSENT" ? 1 : 0}</b></td>
                          <td><b className="nkj-attendance-total half-day">{singleRecord?.status === "HALF_DAY" ? 1 : 0}</b></td>
                          <td className="days-total">{singleRecord ? 1 : 0}</td>
                        </>
                      )}
                      <td><button type="button" className="nkj-attendance-row-edit" title={singleRecord?.locked ? "Approved leave attendance is locked" : "Edit selected date"} onClick={() => startEditSelectedDate(person)} disabled={Boolean(singleRecord?.locked)}><Pencil size={14} /></button></td>
                    </tr>
                  );
                })}
                {!loading && !visibleStaff.length && <tr><td className="nkj-attendance-empty" colSpan={viewMode === "MULTI_DAY" ? days.length + 8 : 9}>No active staff records found.</td></tr>}
                {loading && <tr><td className="nkj-attendance-empty" colSpan={viewMode === "MULTI_DAY" ? days.length + 8 : 9}>Loading attendance…</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <footer className="nkj-attendance-footer">
          <div className="nkj-attendance-legend"><span><b className="present">P</b> P = Present</span><span><b className="absent">A</b> A = Absent</span><span><b className="half-day">H</b> H = Half Day</span><span><Lock size={13} /> Approved Leave (locked)</span></div>
          <div className="nkj-attendance-pagination">
            <span>Showing {firstRecord} to {lastRecord} of {filteredStaff.length} records</span>
            <label>Rows <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label>
            <button type="button" title="First page" disabled={safePage <= 1} onClick={() => setPage(1)}><ChevronsLeft size={16} /></button>
            <button type="button" title="Previous page" disabled={safePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={16} /></button>
            <b>{safePage}</b>
            <button type="button" title="Next page" disabled={safePage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}><ChevronRight size={16} /></button>
            <button type="button" title="Last page" disabled={safePage >= pageCount} onClick={() => setPage(pageCount)}><ChevronsRight size={16} /></button>
          </div>
        </footer>

        {showAdd && (
          <div className="nkj-attendance-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setShowAdd(false); }}>
            <form className="nkj-attendance-modal" onSubmit={saveNewRecord}>
              <div className="nkj-attendance-modal-head"><div><span>OWNER WORKSPACE</span><h3>Add Attendance Record</h3><p>Attendance is checked against approved leave before saving.</p></div><button type="button" onClick={() => setShowAdd(false)}><X size={18} /></button></div>
              <div className="nkj-attendance-modal-fields">
                <label><span>Staff Member</span><select value={form.staffId} required onChange={(event) => setForm((current) => ({ ...current, staffId: event.target.value }))}><option value="">Select active staff member</option>{staff.map((person) => <option key={person.id} value={person.id}>{staffIdLabel(person)} — {person.fullName}</option>)}</select></label>
                <label><span>Attendance Date</span><input type="date" value={form.attendanceDate} required onChange={(event) => setForm((current) => ({ ...current, attendanceDate: event.target.value }))} /></label>
                <label><span>Status</span><select value={form.status} disabled={!leaveCheck.allowed || leaveCheck.loading} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option value="PRESENT">PRESENT</option><option value="ABSENT">ABSENT</option><option value="HALF_DAY">HALF DAY</option></select></label>
              </div>
              {leaveCheck.loading && <p className="nkj-attendance-leave-check">Checking approved leave…</p>}
              {!leaveCheck.loading && !leaveCheck.allowed && <div className="nkj-attendance-leave-warning"><Lock size={16} /><div><b>{leaveCheck.message}</b>{leaveCheck.leave && <small>{leaveCheck.leave.leaveType} · {dateLabel(leaveCheck.leave.fromDate)} – {dateLabel(leaveCheck.leave.toDate)}</small>}</div></div>}
              <div className="nkj-attendance-modal-actions"><button type="button" className="nkj-attendance-btn secondary" onClick={() => setShowAdd(false)}>Cancel</button><button type="submit" className="nkj-attendance-btn primary" disabled={saving || leaveCheck.loading || !leaveCheck.allowed || !form.staffId}><Plus size={15} /> {saving ? "Saving…" : "Save Record"}</button></div>
            </form>
          </div>
        )}
      </section>
    </Page>
  );
}
