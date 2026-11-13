import "./StaffDetailsPage.css";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  UserRound, Plus, Save, NotebookPen, X, Search, ShieldCheck, UserX,
  CalendarDays, Phone, Mail, BriefcaseBusiness, MapPin, Pencil,
  Trash2, Users, ClipboardList, CalendarCheck, Wallet, Banknote,
  ChevronRight, ExternalLink, Clock3
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Page } from "../../shared/layouts/OwnerShell";
import { money } from "../../shared/utils/formatters";
import { request } from "../../core/api/client";
import { useRealtimeRefresh } from "../../core/realtime/realtime";

const localToday = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const blank = {
  fullName: "", photoUrl: "", aadhaarNumber: "", panNumber: "", mobile: "",
  email: "", address: "", dob: "", joiningDate: localToday(), designation: "",
  department: "", monthlySalary: "", salaryMethod: "Cash", emergencyContact: "",
  status: "ACTIVE", notes: ""
};
const noteTypes = ["GENERAL", "WORK QUALITY", "PAYMENT", "ATTENDANCE", "WARNING", "APPRECIATION", "OTHER"];
const dateLabel = (value) => {
  if (!value) return "—";
  const raw = String(value).slice(0, 10);
  const date = new Date(`${raw}T00:00:00`);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};
const categoryClass = (value) => String(value || "GENERAL").toLowerCase().replace(/[^a-z0-9]+/g, "-");
const staffCode = (person) => person?.staffCode || (person?.id ? `NKJ-STF-${String(person.id).padStart(5, "0")}` : "—");

export default function StaffDetailsPage() {
  const [searchParams] = useSearchParams();
  const [staff, setStaff] = useState([]);
  const [notes, setNotes] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState(blank);
  const [noteForm, setNoteForm] = useState({ noteDate: localToday(), noteType: "GENERAL", description: "" });
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [directoryFilter, setDirectoryFilter] = useState("ALL");
  const [expandedNotes, setExpandedNotes] = useState(() => new Set());
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [deletingNote, setDeletingNote] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notesLoading, setNotesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await request("/admin/modules/staff");
      const rows = Array.isArray(data) ? data : [];
      setStaff(rows);
      setSelectedId((current) => {
        if (current && rows.some((person) => String(person.id) === String(current))) return current;
        const requested = searchParams.get("staffId");
        if (requested && rows.some((person) => String(person.id) === String(requested))) return requested;
        return String(rows[0]?.id || "");
      });
    } catch (loadError) {
      setError(loadError.message || "Could not load staff details.");
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  const loadNotes = useCallback(async () => {
    if (!selectedId) {
      setNotes([]);
      return;
    }
    setNotesLoading(true);
    try {
      const data = await request(`/admin/modules/staff/${encodeURIComponent(selectedId)}/notes`);
      setNotes(Array.isArray(data) ? data : []);
      setExpandedNotes(new Set());
    } catch (loadError) {
      setError(loadError.message || "Could not load this staff member's notes.");
      setNotes([]);
    } finally {
      setNotesLoading(false);
    }
  }, [selectedId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadNotes(); }, [loadNotes]);
  useRealtimeRefresh(load, ["staff", "attendance", "salary", "leaves", "dashboard", "reports"]);
  useRealtimeRefresh(loadNotes, ["staff-notes"]);

  const activeCount = staff.filter((person) => String(person.status || "").toUpperCase() === "ACTIVE").length;
  const inactiveCount = staff.length - activeCount;
  const selected = staff.find((person) => String(person.id) === String(selectedId));
  const selectedNotes = useMemo(() => notes, [notes]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return staff.filter((person) => {
      const isActive = String(person.status || "").toUpperCase() === "ACTIVE";
      const matchesStatus = directoryFilter === "ALL" || (directoryFilter === "ACTIVE" ? isActive : !isActive);
      const haystack = `${person.fullName || ""} ${staffCode(person)} ${person.mobile || ""} ${person.designation || ""} ${person.department || ""}`.toLowerCase();
      return matchesStatus && (!query || haystack.includes(query));
    });
  }, [staff, search, directoryFilter]);

  const beginCreate = () => {
    setEditingId(null);
    setForm({ ...blank, joiningDate: localToday() });
    setShowForm(true);
    setError("");
    setMessage("");
  };
  const beginEdit = (person) => {
    setEditingId(person.id);
    setForm({ ...blank, ...person, monthlySalary: String(person.monthlySalary ?? "") });
    setShowForm(true);
    setError("");
    setMessage("");
  };
  const handlePhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) {
      setError("Choose an image no larger than 2 MB.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((current) => ({ ...current, photoUrl: String(reader.result || "") }));
    reader.readAsDataURL(file);
  };

  const saveStaff = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        ...form,
        monthlySalary: form.monthlySalary === "" ? 0 : Number(form.monthlySalary)
      };
      const result = editingId
        ? await request(`/admin/modules/staff/${editingId}`, { method: "PUT", body: JSON.stringify(payload) })
        : await request("/admin/modules/staff", { method: "POST", body: JSON.stringify(payload) });
      const nextId = editingId || result.id;
      setSelectedId(String(nextId));
      setShowForm(false);
      setMessage(editingId ? "Staff details updated." : "Staff profile created.");
      await load();
    } catch (saveError) {
      setError(saveError.message || "Could not save staff profile.");
    } finally {
      setSaving(false);
    }
  };

  const addNote = async (event) => {
    event.preventDefault();
    if (!selectedId) {
      setError("Select a staff member first.");
      return;
    }
    if (!noteForm.description.trim()) {
      setError("Enter a note description.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await request("/admin/modules/staff-notes", {
        method: "POST",
        body: JSON.stringify({
          ...noteForm,
          description: noteForm.description.trim(),
          staffId: Number(selectedId)
        })
      });
      setNoteForm({ noteDate: localToday(), noteType: "GENERAL", description: "" });
      await loadNotes();
      setMessage("Staff note saved in the notebook.");
    } catch (saveError) {
      setError(saveError.message || "Could not save staff note.");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (person) => {
    const nextStatus = String(person.status || "").toUpperCase() === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      setError("");
      setMessage("");
      await request(`/admin/modules/staff/${person.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: nextStatus })
      });
      setMessage(`${person.fullName} marked ${nextStatus.toLowerCase()}.`);
      await load();
    } catch (statusError) {
      setError(statusError.message || "Could not update staff status.");
    }
  };

  const confirmDeleteNote = async () => {
    if (!deleteCandidate || deletingNote || !selectedId) return;
    setDeletingNote(true);
    setError("");
    setMessage("");
    try {
      await request(`/admin/modules/staff/${encodeURIComponent(selectedId)}/notes/${encodeURIComponent(deleteCandidate.id)}`, { method: "DELETE" });
      setDeleteCandidate(null);
      await loadNotes();
      setMessage("Staff note deleted successfully.");
    } catch (deleteError) {
      setError(deleteError.message || "Could not delete this note.");
    } finally {
      setDeletingNote(false);
    }
  };

  const toggleExpanded = (noteId) => {
    setExpandedNotes((current) => {
      const next = new Set(current);
      if (next.has(noteId)) next.delete(noteId);
      else next.add(noteId);
      return next;
    });
  };

  const moduleLinks = selected ? [
    { to: `/attendance?staffId=${selected.id}`, label: "Attendance", Icon: CalendarCheck },
    { to: `/leaves?staffId=${selected.id}`, label: "Staff Leave", Icon: ClipboardList },
    { to: `/salary?staffId=${selected.id}`, label: "Salary Management", Icon: Wallet },
    { to: `/salary-payments?staffId=${selected.id}`, label: "Salary Payments", Icon: Banknote }
  ] : [];

  return (
    <Page active="staff">
      <section className="nkj-module-page nkj-staff-details-page">
        <div className="nkj-module-heading">
          <div>
            <span className="eyebrow">OWNER WORKSPACE</span>
            <h2>Staff Details</h2>
            <p>Manage staff profiles, attendance, leave history, salary records and private notes from one employee record.</p>
          </div>
          <div className="nkj-module-actions">
            <button className="primary" type="button" onClick={beginCreate}><Plus size={16} /> Add Staff</button>
          </div>
        </div>

        {error && <p className="error" role="alert">{error}</p>}
        {message && <p className="success" role="status">{message}</p>}

        <div className="nkj-staff-summary" aria-label="Staff summary">
          <div className="total">
            <span className="nkj-staff-summary-icon"><Users size={21} /></span>
            <span>Total Staff</span>
            <strong>{staff.length}</strong>
          </div>
          <div className="active">
            <span className="nkj-staff-summary-icon"><ShieldCheck size={21} /></span>
            <span>Active Staff</span>
            <strong>{activeCount}</strong>
          </div>
          <div className="inactive">
            <span className="nkj-staff-summary-icon"><UserX size={21} /></span>
            <span>Inactive Staff</span>
            <strong>{inactiveCount}</strong>
          </div>
          <div className="next-payday">
            <span className="nkj-staff-summary-icon"><CalendarDays size={21} /></span>
            <span>Next Salary Date</span>
            <strong>Not configured</strong>
            <small>No recurring salary date is stored yet.</small>
          </div>
        </div>

        <div className="nkj-staff-layout">
          <section className="panel nkj-staff-directory">
            <div className="nkj-staff-directory-head">
              <div className="nkj-staff-directory-title">
                <div><h3>Staff Directory</h3><small>Choose an employee to view their complete record</small></div>
                <span className="nkj-staff-directory-total">{staff.length} staff</span>
              </div>
              <label className="nkj-staff-search">
                <Search size={16} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, Staff ID, mobile or role" aria-label="Search staff" />
              </label>
              <div className="nkj-staff-directory-filters" role="group" aria-label="Filter staff">
                <button type="button" className={directoryFilter === "ALL" ? "active" : ""} onClick={() => setDirectoryFilter("ALL")}>All <b>{staff.length}</b></button>
                <button type="button" className={directoryFilter === "ACTIVE" ? "active" : ""} onClick={() => setDirectoryFilter("ACTIVE")}>Active <b>{activeCount}</b></button>
                <button type="button" className={directoryFilter === "INACTIVE" ? "active" : ""} onClick={() => setDirectoryFilter("INACTIVE")}>Inactive <b>{inactiveCount}</b></button>
              </div>
            </div>

            <div className="nkj-staff-list">
              {filtered.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  className={`nkj-staff-person ${String(person.id) === String(selectedId) ? "active" : ""}`}
                  onClick={() => { setSelectedId(String(person.id)); setMessage(""); }}
                  aria-pressed={String(person.id) === String(selectedId)}
                >
                  <span className="nkj-staff-avatar">
                    {person.photoUrl ? <img src={person.photoUrl} alt="" /> : String(person.fullName || "S").slice(0, 1).toUpperCase()}
                  </span>
                  <span className="nkj-staff-person-copy">
                    <b>{person.fullName}</b>
                    <small>{staffCode(person)}</small>
                    <small>{person.designation || "Team member"}{person.department ? ` · ${person.department}` : ""}</small>
                  </span>
                  <span className={`nkj-staff-status ${String(person.status || "").toUpperCase() === "ACTIVE" ? "active" : "inactive"}`}>
                    {String(person.status || "INACTIVE").toUpperCase() === "ACTIVE" ? "Active" : "Inactive"}
                  </span>
                </button>
              ))}
              {!loading && !filtered.length && <p className="empty">No staff found for this search.</p>}
              {loading && <p className="empty">Loading staff records…</p>}
            </div>
          </section>

          <section className="panel nkj-staff-profile-panel">
            {selected ? (
              <>
                <div className="nkj-staff-profile-head">
                  <div className="nkj-staff-profile-identity">
                    <span className="nkj-staff-profile-photo">
                      {selected.photoUrl ? <img src={selected.photoUrl} alt={selected.fullName} /> : <UserRound size={27} />}
                    </span>
                    <div>
                      <span className="nkj-staff-profile-code">{staffCode(selected)}</span>
                      <h3>{selected.fullName}</h3>
                      <p>{selected.designation || "Team member"}{selected.department ? ` · ${selected.department}` : ""}</p>
                      <span className={`nkj-staff-profile-status ${String(selected.status || "").toUpperCase() === "ACTIVE" ? "active" : "inactive"}`}>
                        {String(selected.status || "INACTIVE").toUpperCase() === "ACTIVE" ? "ACTIVE STAFF" : "INACTIVE STAFF"}
                      </span>
                    </div>
                  </div>
                  <div className="nkj-module-actions">
                    <button type="button" className="secondary" onClick={() => beginEdit(selected)}><Pencil size={14} /> Edit Details</button>
                    <button type="button" className="secondary" onClick={() => changeStatus(selected)}>
                      {String(selected.status || "").toUpperCase() === "ACTIVE" ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </div>

                <div className="nkj-staff-module-links" aria-label="Linked staff modules">
                  <span>STAFF WORKFLOWS</span>
                  {moduleLinks.map(({ to, label, Icon }) => (
                    <Link key={label} to={to}><Icon size={15} /> {label} <ExternalLink size={12} /></Link>
                  ))}
                </div>

                <div className="nkj-staff-section-heading">
                  <div><h4>Staff Information</h4><small>Profile data saved against this Staff ID</small></div>
                </div>
                <div className="nkj-staff-profile-facts">
                  <div><small><Phone size={12} /> Mobile Number</small><b>{selected.mobile || "—"}</b></div>
                  <div><small><Mail size={12} /> Email Address</small><b>{selected.email || "—"}</b></div>
                  <div><small><CalendarDays size={12} /> Date of Birth</small><b>{dateLabel(selected.dob)}</b></div>
                  <div><small><CalendarDays size={12} /> Joining Date</small><b>{dateLabel(selected.joiningDate)}</b></div>
                  <div><small><BriefcaseBusiness size={12} /> Role / Designation</small><b>{selected.designation || "—"}</b></div>
                  <div><small><BriefcaseBusiness size={12} /> Department</small><b>{selected.department || "—"}</b></div>
                  <div><small><Wallet size={12} /> Monthly Salary</small><b>₹ {money(selected.monthlySalary)}</b></div>
                  <div><small><Banknote size={12} /> Salary Method</small><b>{selected.salaryMethod || "—"}</b></div>
                  <div><small><ShieldCheck size={12} /> Aadhaar</small><b>{selected.aadhaarNumber || "—"}</b></div>
                  <div><small><ShieldCheck size={12} /> PAN</small><b>{selected.panNumber || "—"}</b></div>
                  <div><small><Phone size={12} /> Emergency Contact</small><b>{selected.emergencyContact || "—"}</b></div>
                  <div><small><MapPin size={12} /> Address</small><b>{selected.address || "—"}</b></div>
                </div>

                <div className="nkj-staff-notebook">
                  <div className="nkj-staff-notebook-head">
                    <div><h3><NotebookPen size={18} /> {selected.fullName} – Notes Notebook</h3><small>Private notes linked only to {staffCode(selected)}</small></div>
                    <span className="nkj-staff-note-count">{selectedNotes.length} {selectedNotes.length === 1 ? "Note" : "Notes"}</span>
                  </div>

                  <form onSubmit={addNote} className="nkj-staff-note-form">
                    <label><span>Date</span><input type="date" value={noteForm.noteDate} onChange={(event) => setNoteForm((current) => ({ ...current, noteDate: event.target.value }))} required /></label>
                    <label><span>Note Category</span><select value={noteForm.noteType} onChange={(event) => setNoteForm((current) => ({ ...current, noteType: event.target.value }))}>{noteTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
                    <label className="description"><span>Note Description</span><input type="text" value={noteForm.description} onChange={(event) => setNoteForm((current) => ({ ...current, description: event.target.value }))} placeholder="Write a note about this staff member…" required /></label>
                    <button className="primary" type="submit" disabled={saving || !noteForm.description.trim()}><Save size={14} /> Save Note</button>
                  </form>

                  <div className="nkj-staff-note-table-wrap">
                    <div className="nkj-staff-note-table-head">
                      <span>Date</span><span>Category</span><span>Note / Description</span><span>Recorded By</span><span>Action</span>
                    </div>
                    <div className="nkj-staff-note-list">
                      {selectedNotes.map((note) => {
                        const expanded = expandedNotes.has(note.id);
                        const long = String(note.description || "").length > 125;
                        return (
                          <article className="nkj-staff-note-row" key={note.id}>
                            <time>{dateLabel(note.noteDate)}</time>
                            <span className={`nkj-staff-note-category ${categoryClass(note.noteType)}`}>{note.noteType || "GENERAL"}</span>
                            <div className={`nkj-staff-note-description ${expanded ? "expanded" : ""}`}>
                              <p>{note.description}</p>
                              {long && <button type="button" onClick={() => toggleExpanded(note.id)}>{expanded ? "Show less" : "Show more"}</button>}
                            </div>
                            <small className="nkj-staff-note-author">{note.createdBy || "Owner"}</small>
                            <button type="button" className="nkj-staff-note-delete" onClick={() => setDeleteCandidate(note)} aria-label={`Delete note from ${dateLabel(note.noteDate)}`} title="Delete note"><Trash2 size={15} /></button>
                          </article>
                        );
                      })}
                      {notesLoading && <p className="empty">Loading notes…</p>}
                      {!notesLoading && !selectedNotes.length && <p className="empty nkj-staff-notes-empty">No notes recorded for this staff member yet.</p>}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty nkj-staff-select-empty">Select a staff member to view their profile and notes.</div>
            )}
          </section>
        </div>

        {showForm && (
          <div className="nkj-rate-editor-backdrop">
            <form className="nkj-rate-editor nkj-staff-form-modal" onSubmit={saveStaff}>
              <div className="nkj-rate-editor-heading">
                <div><span className="eyebrow">STAFF PROFILE</span><h2>{editingId ? "Edit Staff Details" : "Add New Staff"}</h2><p>Staff identity remains linked to attendance, leave and payroll records by Staff ID.</p></div>
                <button type="button" className="nkj-rate-editor-close" onClick={() => setShowForm(false)} aria-label="Close"><X /></button>
              </div>
              <div className="nkj-staff-form-grid">
                {[
                  ["fullName", "Full name"], ["mobile", "Mobile number"], ["email", "Email address"],
                  ["dob", "Date of birth"], ["joiningDate", "Joining date"], ["designation", "Role / Designation"],
                  ["department", "Department"], ["monthlySalary", "Monthly salary"], ["salaryMethod", "Salary method"],
                  ["aadhaarNumber", "Aadhaar number"], ["panNumber", "PAN number"], ["emergencyContact", "Emergency contact"]
                ].map(([key, label]) => (
                  <label key={key}><span>{label}</span>
                    {key === "salaryMethod" ? (
                      <select value={form[key] || "Cash"} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}>
                        {["Cash", "UPI", "Bank Transfer", "Cheque"].map((value) => <option key={value}>{value}</option>)}
                      </select>
                    ) : (
                      <input type={key === "email" ? "email" : ["dob", "joiningDate"].includes(key) ? "date" : key === "monthlySalary" ? "number" : "text"}
                        min={key === "monthlySalary" ? "0" : undefined}
                        value={form[key] ?? ""}
                        onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                        required={key === "fullName"} />
                    )}
                  </label>
                ))}
                <label><span>Photo (max 2 MB)</span><input type="file" accept="image/*" onChange={handlePhoto} />{form.photoUrl && <img className="nkj-staff-photo-preview" src={form.photoUrl} alt="Staff preview" />}</label>
                <label><span>Status</span><select value={form.status || "ACTIVE"} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>
                <label className="wide"><span>Address</span><textarea rows="2" value={form.address || ""} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} /></label>
                <label className="wide"><span>Staff profile notes</span><textarea rows="2" value={form.notes || ""} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Responsibilities, agreement or starting details" /></label>
              </div>
              <div className="nkj-rate-editor-actions">
                <button type="button" className="secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button className="primary" disabled={saving}><Save size={16} /> {saving ? "Saving…" : "Save Staff Details"}</button>
              </div>
            </form>
          </div>
        )}

        {deleteCandidate && (
          <div className="nkj-staff-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !deletingNote) setDeleteCandidate(null); }}>
            <div className="nkj-staff-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="nkj-staff-delete-note-title">
              <span className="nkj-staff-confirm-icon"><Trash2 size={20} /></span>
              <h3 id="nkj-staff-delete-note-title">Delete Staff Note?</h3>
              <p>Are you sure you want to delete this note?</p>
              <div><button type="button" className="secondary" disabled={deletingNote} onClick={() => setDeleteCandidate(null)}>Cancel</button><button type="button" className="danger" disabled={deletingNote} onClick={confirmDeleteNote}>{deletingNote ? "Deleting…" : "Delete"}</button></div>
            </div>
          </div>
        )}
      </section>
    </Page>
  );
}
