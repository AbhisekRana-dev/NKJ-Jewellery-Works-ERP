import "./MetalRatesShared.css";
import React, { useCallback, useEffect, useState } from "react";
import "./MetalRatesPage.css";
import { Save, RefreshCw, Newspaper, PencilLine, History, ArrowRightLeft, ExternalLink } from "lucide-react";
import { Page } from "../../shared/layouts/OwnerShell";
import { request } from "../../core/api/client";

const fmt = (v) => Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const per10 = (value) => String(Number(value || 0) * 10);
const displayDate = (value) => {
  if (!value) return "—";
  const raw = String(value).slice(0, 10);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match
    ? new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00+05:30`).toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" })
    : raw;
};
const isExternalUrl = (value) => /^https?:\/\//i.test(String(value || ""));

export default function MetalRatesPage() {
  const [rates, setRates] = useState({
    gold24kRate: 0,
    gold22kRate: 0,
    silverRate: 0,
    rateMode: "MANUAL",
    rateSource: "",
    rateDate: null,
    sourcePublishedAt: null,
    sourceReference: null,
    updatedAt: null,
    lastAutoFetchAt: null,
    lastAutoFetchStatus: "NOT_CONFIGURED",
    rateFreshToday: false,
    ownerVerified: false,
  });
  const [form, setForm] = useState({ gold24kRate: "", gold22kRate: "", silverRate: "" });
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [r, h] = await Promise.all([
        request("/rates"),
        request("/admin/rates/history"),
      ]);
      setRates(r);
      setForm({
        gold24kRate: per10(r.gold24kRate),
        gold22kRate: per10(r.gold22kRate),
        silverRate: per10(r.silverRate),
      });
      setHistory(Array.isArray(h) ? h : []);
    } catch (e) {
      setError(e.message || "Could not load rates.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    const values = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [
        key,
        value.trim() === "" ? null : Number(value) / 10,
      ]),
    );
    if (!(values.gold24kRate > 0) || !(values.gold22kRate > 0) || !(values.silverRate > 0)) {
      setError("Enter positive 24K, 22K and 999 silver rates. All values are per 10 grams.");
      setSaving(false);
      return;
    }
    try {
      await request("/admin/rates", {
        method: "PUT",
        body: JSON.stringify(values),
      });
      setMessage("Manual Override Mode enabled. Your entered Kolkata rates are saved and automatic fetching will not overwrite them.");
      await load();
    } catch (e) {
      setError(e.message || "Could not save manual rates.");
    } finally {
      setSaving(false);
    }
  };

  const enableAuto = async () => {
    if (!window.confirm(
      "Switch to Automatic Mode? The latest previously imported automatic rates will be restored first. The system will then check Anandabazar Patrika (if an authorized adapter is configured) and the Kolkata-specific fallback.",
    )) return;

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const result = await request("/admin/rates/auto", { method: "PUT" });
      if (result?.lastAutoFetchStatus === "IMPORTED") {
        setMessage(`Automatic Mode enabled. Latest rates imported from ${result.rateSource || "the verified Kolkata source"}.`);
      } else if (result?.lastAutoFetchStatus === "NO_NEWER_KOLKATA_SNAPSHOT") {
        setMessage("Automatic Mode enabled. No newer Kolkata source snapshot was available; the last verified prices and original rate date remain active.");
      } else {
        setMessage("Automatic Mode enabled. The latest saved automatic snapshot is active; source status is shown below.");
      }
      await load();
    } catch (e) {
      setError(e.message || "Could not switch to Automatic Mode.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page active="rates">
      <section className="nkj-module-page nkj-rate-management-page">
        <div className="nkj-module-heading">
          <div>
            <span className="eyebrow">OWNER MASTER DATA</span>
            <h2>Gold &amp; Silver Rate Management</h2>
            <p>Manage Kolkata 24K, 22K and 999 silver reference rates. All entry and display values are per 10 grams.</p>
          </div>
          <button className="secondary" onClick={load} disabled={loading}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}

        <div className="nkj-rate-admin-banner">
          <div className="nkj-rate-admin-icon"><Newspaper /></div>
          <div>
            <strong>Kolkata daily rate sources</strong>
            <span>
              Anandabazar Patrika is preferred when an authorized Kolkata feed is connected. If it is unavailable or has no newer issue, the system checks an authorized All India Bullion Kolkata feed. Public website pages and display widgets are not scraped. Until a feed is configured with permission, the last verified rates and their original publication date remain active.
            </span>
          </div>
          <b className={`nkj-rate-mode-pill ${rates.rateFreshToday ? "is-live" : ""}`}>
            {rates.rateMode === "AUTO"
              ? rates.rateFreshToday ? "AUTO · TODAY'S KOLKATA RATE" : "AUTOMATIC MODE · LAST VERIFIED RATE"
              : "MANUAL OVERRIDE MODE"}
          </b>
        </div>

        {!rates.ownerVerified && !rates.rateFreshToday && (
          <p className="warning">
            The database contains unverified legacy seed values. They are not treated as published Kolkata market prices. Enter the correct 24K, 22K and 999 silver values before using the rate board for new billing.
          </p>
        )}
        {rates.rateMode === "AUTO" && [
          "NO_AUTHORIZED_KOLKATA_SOURCE",
          "FALLBACK_FEED_NOT_CONFIGURED",
          "ALL_AUTHORIZED_FEEDS_FAILED",
          "KOLKATA_FEED_FAILED",
          "KOLKATA_FALLBACK_FAILED",
          "ALL_SOURCES_FAILED",
        ].includes(rates.lastAutoFetchStatus) && (
          <p className="warning">
            Automatic Mode is selected, but no authorized Kolkata feed has supplied a fresh rate. The current verified values and their original rate date remain active. Configure an authorized Anandabazar feed or an authorized Kolkata-specific fallback before expecting automatic updates.
          </p>
        )}

        <div className="nkj-rate-active-grid">
          {[
            ["24K Gold", rates.gold24kRate],
            ["22K Gold", rates.gold22kRate],
            ["Silver 999", rates.silverRate],
          ].map(([label, value]) => (
            <div className="nkj-rate-active-card" key={label}>
              <span>{label}</span>
              <strong>₹ {fmt(Number(value || 0) * 10)}</strong>
              <small>per 10 grams</small>
            </div>
          ))}
        </div>

        <div className="nkj-rate-source-card">
          <div>
            <b>Active rate source</b>
            <strong>{rates.rateSource || "Not verified"}</strong>
          </div>
          <div>
            <b>Original rate date</b>
            <strong>{displayDate(rates.rateDate)}</strong>
          </div>
          <div>
            <b>Source publication time</b>
            <strong>{rates.sourcePublishedAt ? new Date(rates.sourcePublishedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }) : "Manual entry / unavailable"}</strong>
          </div>
          {isExternalUrl(rates.sourceReference) && (
            <a href={rates.sourceReference} target="_blank" rel="noreferrer">
              View source <ExternalLink size={13} />
            </a>
          )}
        </div>

        <form className="nkj-module-form nkj-rates-form nkj-rate-edit-form" onSubmit={save}>
          <h3><PencilLine size={18} /> Manual Override <small>All values are ₹ per 10 grams</small></h3>
          <div className="nkj-module-fields">
            <label>
              <span>Gold 24K (₹ / 10 grams)</span>
              <input type="number" min="0.01" step="0.01" value={form.gold24kRate} onChange={(e) => setForm({ ...form, gold24kRate: e.target.value })} placeholder="Enter 24K rate" required />
            </label>
            <label>
              <span>Gold 22K (₹ / 10 grams)</span>
              <input type="number" min="0.01" step="0.01" value={form.gold22kRate} onChange={(e) => setForm({ ...form, gold22kRate: e.target.value })} placeholder="Enter 22K rate" required />
            </label>
            <label>
              <span>Silver 999 (₹ / 10 grams)</span>
              <input type="number" min="0.01" step="0.01" value={form.silverRate} onChange={(e) => setForm({ ...form, silverRate: e.target.value })} placeholder="Enter Silver 999 rate" required />
            </label>
          </div>
          <div className="nkj-module-form-actions">
            <button className="primary" disabled={saving || loading}>
              <Save size={16} /> {saving ? "Saving…" : "Save Manual Rates"}
            </button>
            <button type="button" className="secondary" onClick={enableAuto} disabled={saving || loading}>
              <ArrowRightLeft size={16} /> Switch to Automatic Mode
            </button>
          </div>
        </form>

        <section className="panel nkj-rate-history-panel">
          <div className="nkj-panel-head">
            <h3><History size={18} /> Rate Change History</h3>
            <span>{history.length} entries</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Changed At</th>
                  <th>24K Gold (₹ / 10g)</th>
                  <th>22K Gold (₹ / 10g)</th>
                  <th>Silver 999 (₹ / 10g)</th>
                  <th>Original Rate Date</th>
                  <th>Source</th>
                  <th>Action</th>
                  <th>Admin / Process</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id}>
                    <td>{row.changedAt ? new Date(row.changedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "—"}</td>
                    <td>₹ {fmt(Number(row.newGold24kRate || 0) * 10)}</td>
                    <td>₹ {fmt(Number(row.newGold22kRate || 0) * 10)}</td>
                    <td>₹ {fmt(Number(row.newSilverRate || 0) * 10)}</td>
                    <td>{displayDate(row.newRateDate)}</td>
                    <td>
                      <span>{row.rateSource || "—"}</span>
                      {isExternalUrl(row.sourceReference) && (
                        <a className="nkj-rate-history-source-link" href={row.sourceReference} target="_blank" rel="noreferrer">
                          Source link <ExternalLink size={11} />
                        </a>
                      )}
                    </td>
                    <td>{row.changeType || "HISTORY"}</td>
                    <td>{row.changedBy || "—"}</td>
                  </tr>
                ))}
                {!history.length && (
                  <tr><td colSpan="8" className="empty">No rate changes recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="nkj-rate-fetch-meta">
          <span><b>Original rate date:</b> {displayDate(rates.rateDate)}</span>
          <span><b>Last scheduled check:</b> {rates.lastAutoFetchAt ? new Date(rates.lastAutoFetchAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }) : "Not run yet"}</span>
          <span><b>Fetch status:</b> {rates.lastAutoFetchStatus || "UNKNOWN"}</span>
        </div>

        <p className="nkj-module-footnote">
          Active rates remain stored internally per gram so existing invoice calculations are unchanged. This page displays ₹ per 10 grams. The daily job runs once at 06:15 Asia/Kolkata and checks only authorized source adapters. The All India Bullion Kolkata reference derives 22K from its 24K/999 metal reference and publishes silver per kilogram; the authorized adapter must normalize all three fields to the same unit before import. These are indicative reference rates, not final jewellery sale prices. Making charges and applicable taxes remain governed by your existing invoice workflow.
        </p>
      </section>
    </Page>
  );
}
