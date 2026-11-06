import "./MetalRatesShared.css";
import React, { useCallback, useEffect, useState } from "react";
import "./MetalRatesPage.css";
import { Save, RefreshCw, Newspaper, PencilLine, History, Radio, ArrowRightLeft } from "lucide-react";
import { Page } from "../../shared/layouts/OwnerShell";
import { request } from "../../core/api/client";

const fmt = (v) => Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const per10 = (value) => String(Number(value || 0) * 10);

export default function MetalRatesPage() {
  const [rates, setRates] = useState({ gold24kRate: 0, gold22kRate: 0, silverRate: 0, rateMode: "MANUAL", rateSource: "", rateDate: null, updatedAt: null, lastAutoFetchAt: null, lastAutoFetchStatus: "NOT_CONFIGURED", newspaperVerified: false, ownerVerified: false });
  const [form, setForm] = useState({ gold24kRate: "", gold22kRate: "", silverRate: "" });
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [r, h] = await Promise.all([request("/rates"), request("/admin/rates/history")]);
      setRates(r);
      setForm({ gold24kRate: per10(r.gold24kRate), gold22kRate: per10(r.gold22kRate), silverRate: per10(r.silverRate) });
      setHistory(Array.isArray(h) ? h : []);
    } catch (e) { setError(e.message || "Could not load rates."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (e) => {
    e.preventDefault(); setSaving(true); setError(""); setMessage("");
    const values = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() === "" ? null : Number(v) / 10]));
    if (!(values.gold24kRate > 0) || !(values.gold22kRate > 0) || !(values.silverRate > 0)) {
      setError("Enter positive 24K, 22K and 999 silver rates. All values are per 10 grams."); setSaving(false); return;
    }
    try {
      await request("/admin/rates", { method: "PUT", body: JSON.stringify(values) });
      setMessage("Manual rates saved. The public homepage now shows these active rates.");
      await load();
    } catch (e) { setError(e.message || "Could not save rates."); }
    finally { setSaving(false); }
  };

  const enableAuto = async () => {
    if (!window.confirm("Switch to AUTO mode? Current verified rates will remain visible until an authorized Anandabazar Patrika feed sends a newer verified rate.")) return;
    setSaving(true); setError(""); setMessage("");
    try { await request("/admin/rates/auto", { method: "PUT" }); setMessage("AUTO mode selected. The publisher feed is not connected yet, so no new newspaper price will be claimed as live."); await load(); }
    catch (e) { setError(e.message || "Could not switch mode."); }
    finally { setSaving(false); }
  };

  return <Page active="rates">
    <section className="nkj-module-page nkj-rate-management-page">
      <div className="nkj-module-heading"><div><span className="eyebrow">OWNER MASTER DATA</span><h2>Gold &amp; Silver Rate Management</h2><p>Manage the active 24K, 22K and 999 silver prices. All entry and display values are per 10 grams.</p></div><button className="secondary" onClick={load} disabled={loading}><RefreshCw size={16}/> Refresh</button></div>
      {error && <p className="error">{error}</p>}{message && <p className="success">{message}</p>}
      <div className="nkj-rate-admin-banner"><div className="nkj-rate-admin-icon"><Newspaper/></div><div><strong>Daily newspaper source</strong><span>Automatic polling is scheduled for 6:15 AM Asia/Kolkata when an authorized Anandabazar Patrika data adapter is configured. If today's issue is missing, the last verified rates and their original publication date stay active.</span></div><b className={`nkj-rate-mode-pill ${rates.newspaperVerified ? "is-live" : ""}`}>{rates.newspaperVerified ? "TODAY'S ISSUE VERIFIED" : rates.rateMode === "AUTO" ? "AUTO · LAST VERIFIED RATE" : "MANUAL OVERRIDE"}</b></div>
      {!rates.ownerVerified && !rates.newspaperVerified && <p className="warning">The database contains unverified legacy seed values. They are not treated as published market prices. Enter the correct 24K, 22K and 999 silver values before using the rate board for new billing.</p>}
      <div className="nkj-rate-active-grid">
        {[ ["24K Gold", rates.gold24kRate], ["22K Gold", rates.gold22kRate], ["Silver 999", rates.silverRate] ].map(([label, value]) => <div className="nkj-rate-active-card" key={label}><span>{label}</span><strong>₹ {fmt(Number(value || 0) * 10)}</strong><small>per 10 grams</small></div>)}
      </div>
      <form className="nkj-module-form nkj-rates-form nkj-rate-edit-form" onSubmit={save}>
        <h3><PencilLine size={18}/> Edit active rates <small>All values are ₹ per 10 grams</small></h3>
        <div className="nkj-module-fields">
          <label><span>Gold 24K (₹ / 10 grams)</span><input type="number" min="0.01" step="0.01" value={form.gold24kRate} onChange={e=>setForm({...form,gold24kRate:e.target.value})} placeholder="Enter 24K rate" required/></label>
          <label><span>Gold 22K (₹ / 10 grams)</span><input type="number" min="0.01" step="0.01" value={form.gold22kRate} onChange={e=>setForm({...form,gold22kRate:e.target.value})} required/></label>
          <label><span>Silver 999 (₹ / 10 grams)</span><input type="number" min="0.01" step="0.01" value={form.silverRate} onChange={e=>setForm({...form,silverRate:e.target.value})} required/></label>
        </div>
        <div className="nkj-module-form-actions"><button className="primary" disabled={saving||loading}><Save size={16}/>{saving?"Saving…":"Save Manual Rates"}</button><button type="button" className="secondary" onClick={enableAuto} disabled={saving||loading}><ArrowRightLeft size={16}/> Switch to Auto Mode</button></div>
      </form>
      <section className="panel nkj-rate-history-panel"><div className="nkj-panel-head"><h3><History size={18}/> Rate Change History</h3><span>{history.length} entries</span></div><div className="table-wrap"><table><thead><tr><th>Date &amp; Time</th><th>Action</th><th>24K (previous → new)</th><th>22K (previous → new)</th><th>Silver (previous → new)</th><th>Source</th><th>Admin / Process</th></tr></thead><tbody>{history.map(row=><tr key={row.id}><td>{row.changedAt?new Date(row.changedAt).toLocaleString("en-IN"):"—"}</td><td>{row.changeType || "HISTORY"}</td><td>₹ {fmt(Number(row.previousGold24kRate||0)*10)} → ₹ {fmt(Number(row.newGold24kRate||0)*10)}</td><td>₹ {fmt(Number(row.previousGold22kRate||0)*10)} → ₹ {fmt(Number(row.newGold22kRate||0)*10)}</td><td>₹ {fmt(Number(row.previousSilverRate||0)*10)} → ₹ {fmt(Number(row.newSilverRate||0)*10)}</td><td>{row.rateSource||"—"}</td><td>{row.changedBy||"—"}</td></tr>)}{!history.length&&<tr><td colSpan="7" className="empty">No rate changes recorded yet.</td></tr>}</tbody></table></div></section>
      <div className="nkj-rate-fetch-meta"><span><b>Rate date:</b> {rates.rateDate ? new Date(`${rates.rateDate}T00:00:00+05:30`).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "Not yet verified"}</span><span><b>Last scheduled check:</b> {rates.lastAutoFetchAt ? new Date(rates.lastAutoFetchAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Not run yet"}</span><span><b>Fetch status:</b> {rates.lastAutoFetchStatus || "UNKNOWN"}</span></div>
      <p className="nkj-module-footnote">For invoice compatibility, active rates are stored internally per gram; this editor displays and saves per 10 grams. The daily job never changes rates intraday. A missed or unavailable edition leaves the previous verified values and publication date untouched. AUTO mode requires a configured, authorized source adapter; it does not scrape subscriber-only pages.</p>
    </section>
  </Page>;
}
