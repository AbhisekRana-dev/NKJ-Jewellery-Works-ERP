import "../rates/MetalRatesShared.css";
import React, { useEffect, useState } from "react";
import "./Home.css";
import { Link, useNavigate } from "react-router-dom";
import {
  Award,
  BarChart3,
  Crown,
  Diamond,
  Gem,
  FileText,
  FolderClosed,
  Headset,
  LockKeyhole,
  Layers3,
  ShieldCheck,
  Users,
  Settings,
  X,
  Save,
} from "lucide-react";
import { Page } from "../../shared/layouts/OwnerShell";
import { request } from "../../core/api/client";
import { useRealtimeRefresh } from "../../core/realtime/realtime";
import { useAuth } from "../../core/auth/AuthProvider";

const defaultMetalRates = {
  gold24kRate: 0,
  gold22kRate: 0,
  silverRate: 0,
  diamondRate: 0,
  rateMode: "MANUAL",
  rateSource: "Legacy rate - verify before use",
  newspaperVerified: false,
  ownerVerified: false,
  sourcePublishedAt: null,
  updatedAt: "",
};

const displayRate = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

export function Home() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [rates, setRates] = useState(defaultMetalRates);
  const [rateForm, setRateForm] = useState({
    gold24kRate: "",
    gold22kRate: "",
    silverRate: "",
    diamondRate: "",
  });
  const [showRateEditor, setShowRateEditor] = useState(false);
  const [rateSaving, setRateSaving] = useState(false);
  const [rateMessage, setRateMessage] = useState("");
  const [rateError, setRateError] = useState("");

  useEffect(() => {
    document.body.classList.add("public-home-page");
    return () => document.body.classList.remove("public-home-page");
  }, []);

  useEffect(() => {
    if (!isAdmin) setShowRateEditor(false);
  }, [isAdmin]);

  useEffect(() => {
    let active = true;
    request("/rates")
      .then((data) => {
        if (!active || !data) return;
        const nextRates = { ...defaultMetalRates, ...data };
        setRates(nextRates);
        const configured = Boolean(nextRates.ownerVerified || nextRates.newspaperVerified);
        setRateForm({
          gold24kRate: configured ? String(Number(nextRates.gold24kRate || 0) * 10 || "") : "",
          gold22kRate: configured ? String(Number(nextRates.gold22kRate || 0) * 10 || "") : "",
          silverRate: configured ? String(Number(nextRates.silverRate || 0) * 10 || "") : "",
          diamondRate: Number(nextRates.diamondRate) > 0 ? String(Number(nextRates.diamondRate)) : "",
        });
      })
      .catch((error) => {
        if (active) setRateError(error.message || "Unable to load current rates.");
      });
    return () => {
      active = false;
    };
  }, []);

  const refreshRates = async () => {
    try {
      const data = await request("/rates");
      if (!data) return;
      const nextRates = { ...defaultMetalRates, ...data };
      setRates(nextRates);
      if (!showRateEditor) {
        const configured = Boolean(nextRates.ownerVerified || nextRates.newspaperVerified);
        setRateForm({
          gold24kRate: configured ? String(Number(nextRates.gold24kRate || 0) * 10 || "") : "",
          gold22kRate: configured ? String(Number(nextRates.gold22kRate || 0) * 10 || "") : "",
          silverRate: configured ? String(Number(nextRates.silverRate || 0) * 10 || "") : "",
          diamondRate: Number(nextRates.diamondRate) > 0 ? String(Number(nextRates.diamondRate)) : "",
        });
      }
    } catch (error) {
      setRateError(error.message || "Unable to refresh current rates.");
    }
  };

  useRealtimeRefresh(refreshRates, ["rates"]);

  const ratesConfigured = Boolean(rates.ownerVerified || rates.newspaperVerified) && Number(rates.gold24kRate) > 0 && Number(rates.gold22kRate) > 0 && Number(rates.silverRate) > 0;
  const diamondRateConfigured = Number(rates.diamondRate) > 0;
  const rateIsLive = rates.rateMode === "AUTO" && Boolean(rates.rateFreshToday);

  const openRateEditor = () => {
    if (!isAdmin) {
      navigate("/login");
      return;
    }
    setRateForm({
      gold24kRate: ratesConfigured && Number(rates.gold24kRate) > 0 ? String(Number(rates.gold24kRate) * 10) : "",
      gold22kRate: ratesConfigured ? String(Number(rates.gold22kRate) * 10) : "",
      silverRate: ratesConfigured ? String(Number(rates.silverRate) * 10) : "",
      diamondRate: Number(rates.diamondRate) > 0 ? String(Number(rates.diamondRate)) : "",
    });
    setRateMessage("");
    setRateError("");
    setShowRateEditor(true);
  };

  const saveRates = async (event) => {
    event.preventDefault();
    setRateError("");
    setRateMessage("");

    const gold24kRate = rateForm.gold24kRate === "" ? null : Number(rateForm.gold24kRate);
    const gold22kRate = Number(rateForm.gold22kRate);
    const silverRate = Number(rateForm.silverRate);
    const diamondRate = Number(rateForm.diamondRate);
    if (
      !Number.isFinite(gold24kRate) || !Number.isFinite(gold22kRate) ||
      !Number.isFinite(silverRate) || !Number.isFinite(diamondRate) ||
      gold24kRate <= 0 || gold22kRate <= 0 || silverRate <= 0 || diamondRate <= 0
    ) {
      setRateError("Enter valid positive gold and silver rates per 10 grams and a Diamond rate per carat.");
      return;
    }

    setRateSaving(true);
    try {
      const updated = await request("/admin/rates", {
        method: "PUT",
        body: JSON.stringify({
          gold24kRate: gold24kRate / 10,
          gold22kRate: gold22kRate / 10,
          silverRate: silverRate / 10,
          diamondRate,
        }),
      });

      // Confirm the persisted value, not only the PUT response. This also
      // detects an older Spring Boot process that silently ignores diamondRate.
      let confirmedRates = updated;
      const returnedDiamondRate = Number(updated?.diamondRate);
      if (!Number.isFinite(returnedDiamondRate) || Math.abs(returnedDiamondRate - diamondRate) >= 0.005) {
        confirmedRates = await request("/rates");
      }
      const savedDiamondRate = Number(confirmedRates?.diamondRate);
      if (!Number.isFinite(savedDiamondRate) || Math.abs(savedDiamondRate - diamondRate) >= 0.005) {
        throw new Error("The server did not confirm the saved Diamond rate. Restart the latest Spring Boot backend and make sure Flyway migration V47 has completed, then save again.");
      }

      setRates({ ...defaultMetalRates, ...confirmedRates });
      setRateForm({
        gold24kRate: String(gold24kRate),
        gold22kRate: String(gold22kRate),
        silverRate: String(silverRate),
        diamondRate: String(savedDiamondRate),
      });
      setShowRateEditor(false);
      setRateMessage("Gold, silver and diamond rates updated and verified successfully.");
    } catch (error) {
      setRateError(error.message || "Could not update metal rates.");
    } finally {
      setRateSaving(false);
    }
  };

  return (
    <Page active="home">
      <div className="nkj-public-home">
        <section className="nkj-public-welcome">
          <div className="nkj-public-copy">
            <span className="eyebrow">PURE GOLD · TRUSTED QUALITY · TRADITIONAL DESIGNS</span>
            <h1>
              Nandikishor
              <br />
              <em>Jewellery Works</em>
            </h1>
            <div className="nkj-public-ornament" aria-hidden="true">◆ ━━━━━━━━━ ◆</div>
            <p>
              Jewellery billing made simple. Create invoices, save bills
              <br className="desktop-break" /> and access your records anytime.
            </p>
          </div>
          <div className="nkj-public-image">
            <img src="/home-hero-reference.png" alt="Gold jewellery displayed in a jewellery showroom" />
          </div>
        </section>

        <div className="nkj-public-content">
          <section className="nkj-public-market-services">
            <div className="nkj-public-rate-card nkj-rate-premium">
              <div className="nkj-public-card-heading nkj-public-rate-heading">
                <h3><BarChart3 size={22} /> Gold, Silver &amp; Diamond Rate</h3>
                <div className="nkj-rate-board-status">
                  <span className={rateIsLive ? "nkj-rate-live-dot" : "nkj-rate-manual-dot"} />
                  <b>KOLKATA RATE</b>
                  <i>•</i>
                  <b>{rateIsLive ? "LIVE UPDATE" : ratesConfigured ? "MANUAL UPDATE" : "RATE NOT VERIFIED"}</b>
                </div>
                {isAdmin && <button
                  type="button"
                  className="nkj-public-edit-rate"
                  onClick={openRateEditor}
                  aria-label="Edit gold, silver and diamond rates"
                  title="Edit gold, silver and diamond rates"
                >
                  <span aria-hidden="true">✎</span> Edit Rate
                </button>}
              </div>
              <div className="nkj-public-rate-values nkj-public-rate-values-four">
                <div className="nkj-public-rate-item nkj-public-gold-rate">
                  <span className="nkj-public-metal-bars nkj-public-gold-bars" aria-hidden="true"><i /><i /><i /></span>
                  <div className="nkj-public-rate-copy">
                    <b>Gold (24K)</b>
                    <strong>{ratesConfigured ? `₹ ${displayRate(Number(rates.gold24kRate) * 10)}` : "—"}</strong>
                    <small>/ 10 gm</small>
                  </div>
                </div>
                <div className="nkj-public-rate-item nkj-public-gold-rate">
                  <span className="nkj-public-metal-bars nkj-public-gold-bars" aria-hidden="true"><i /><i /><i /></span>
                  <div className="nkj-public-rate-copy">
                    <b>Gold (22K)</b>
                    <strong>{ratesConfigured ? `₹ ${displayRate(Number(rates.gold22kRate) * 10)}` : "—"}</strong>
                    <small>/ 10 gm</small>
                  </div>
                </div>
                <div className="nkj-public-rate-item nkj-public-silver-rate">
                  <span className="nkj-public-metal-bars nkj-public-silver-bars" aria-hidden="true"><i /><i /><i /></span>
                  <div className="nkj-public-rate-copy">
                    <b>Silver (999)</b>
                    <strong>{ratesConfigured ? `₹ ${displayRate(Number(rates.silverRate) * 10)}` : "—"}</strong>
                    <small>/ 10 gm</small>
                  </div>
                </div>
                <div className="nkj-public-rate-item nkj-public-diamond-rate">
                  <span className="nkj-public-diamond-icon" aria-hidden="true"><Gem size={36} /></span>
                  <div className="nkj-public-rate-copy">
                    <b>Diamond</b>
                    <strong>{diamondRateConfigured ? `₹ ${displayRate(rates.diamondRate)}` : "—"}</strong>
                    <small>/ Carat</small>
                  </div>
                </div>
              </div>
              <div className="nkj-public-rate-meta">
                <span>Source: <b>{rates.newspaperVerified ? "Anandabazar Patrika" : ratesConfigured ? (rates.rateSource || "Manual Admin Entry") : "Not verified — admin confirmation required"}</b></span>
                <span>Rate date: {ratesConfigured && rates.rateDate ? new Date(`${rates.rateDate}T00:00:00+05:30`).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "Not yet verified"}</span>
                <span>Last updated: {ratesConfigured && rates.updatedAt ? new Date(rates.updatedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"}</span>
              </div>
            </div>

            <div className="nkj-public-services-card">
              <div className="nkj-public-card-heading nkj-public-services-heading">
                <h3><Layers3 size={22} /> Our Services</h3>
              </div>
              <div className="nkj-public-service-list">
                <div className="nkj-public-service">
                  <FileText />
                  <b>Jewellery Billing</b>
                  <span>Create professional<br />invoices quickly</span>
                </div>
                <div className="nkj-public-service">
                  <Users />
                  <b>Customer Management</b>
                  <span>Maintain customer<br />details &amp; history</span>
                </div>
                <div className="nkj-public-service">
                  <FolderClosed />
                  <b>Invoices &amp; Records</b>
                  <span>View, search and<br />manage all invoices</span>
                </div>
              </div>
            </div>
          </section>

          <section className="nkj-public-why">
            <h3><Diamond /> Why Choose Us?</h3>
            <div className="nkj-public-why-item">
              <Award />
              <div><b>Trusted Quality</b><span>Pure &amp; certified jewellery</span></div>
            </div>
            <div className="nkj-public-why-item">
              <Settings />
              <div><b>Accurate Billing</b><span>Simple and error-free invoices</span></div>
            </div>
            <div className="nkj-public-why-item">
              <ShieldCheck />
              <div><b>Secure Records</b><span>Your business data is safe</span></div>
            </div>
            <div className="nkj-public-why-item">
              <Headset />
              <div><b>Customer Support</b><span>Quick and reliable assistance</span></div>
            </div>
          </section>

          <section className="nkj-public-collection">
            <div className="nkj-public-collection-heading">
              <h2><Crown /> Our Jewellery Collection</h2>
              <span>View More <b>→</b></span>
            </div>
            <div className="nkj-public-collection-grid">
              <article className="nkj-public-collection-card">
                <img src="/collection-necklaces.png" alt="Gold necklace collection" />
                <div><b>Necklaces</b><span aria-hidden="true">→</span></div>
              </article>
              <article className="nkj-public-collection-card">
                <img src="/collection-earrings.png" alt="Gold earrings collection" />
                <div><b>Earrings</b><span aria-hidden="true">→</span></div>
              </article>
              <article className="nkj-public-collection-card">
                <img src="/collection-bangles.png" alt="Gold bangles collection" />
                <div><b>Bangles</b><span aria-hidden="true">→</span></div>
              </article>
              <article className="nkj-public-collection-card">
                <img src="/collection-rings.png" alt="Gold rings collection" />
                <div><b>Rings</b><span aria-hidden="true">→</span></div>
              </article>
            </div>
          </section>
        </div>
      </div>

      {rateMessage && <p className="nkj-rate-message" role="status">{rateMessage}</p>}
      {rateError && !showRateEditor && <p className="nkj-rate-error" role="status">{rateError}</p>}

      {showRateEditor && (
        <div
          className="nkj-rate-editor-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !rateSaving) {
              setShowRateEditor(false);
            }
          }}
        >
          <section className="nkj-rate-editor" role="dialog" aria-modal="true" aria-labelledby="nkj-rate-editor-title">
            <div className="nkj-rate-editor-heading">
              <div>
                <span className="eyebrow">ADMINISTRATOR ONLY</span>
                <h2 id="nkj-rate-editor-title">Update Gold, Silver &amp; Diamond Rates</h2>
                <p>Enter gold and silver rates per 10 grams and the Diamond rate per carat. Manual updates are not labelled as newspaper live rates.</p>
              </div>
              <button type="button" className="nkj-rate-editor-close" onClick={() => setShowRateEditor(false)} disabled={rateSaving} aria-label="Close rate editor">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={saveRates}>
              <label>
                <span>Gold (24K) — ₹ per 10 grams</span>
                <input type="number" min="0.01" step="0.01" value={rateForm.gold24kRate} onChange={(event) => setRateForm((current) => ({ ...current, gold24kRate: event.target.value }))} required placeholder="Enter 24K rate" />
              </label>
              <label>
                <span>Gold (22K) — ₹ per 10 grams</span>
                <input type="number" min="0.01" step="0.01" value={rateForm.gold22kRate} onChange={(event) => setRateForm((current) => ({ ...current, gold22kRate: event.target.value }))} required />
              </label>
              <label>
                <span>Silver (999) — ₹ per 10 grams</span>
                <input type="number" min="0.01" step="0.01" value={rateForm.silverRate} onChange={(event) => setRateForm((current) => ({ ...current, silverRate: event.target.value }))} required />
              </label>
              <label>
                <span>Diamond — ₹ per carat</span>
                <input type="number" min="0.01" step="0.01" value={rateForm.diamondRate} onChange={(event) => setRateForm((current) => ({ ...current, diamondRate: event.target.value }))} required placeholder="Enter Diamond rate per carat" />
              </label>
              {rateError && <p className="error">{rateError}</p>}
              <div className="nkj-rate-editor-actions">
                <button type="button" className="secondary" onClick={() => setShowRateEditor(false)} disabled={rateSaving}>Cancel</button>
                <button type="submit" className="primary" disabled={rateSaving}>
                  <Save size={16} /> {rateSaving ? "Saving…" : "Save Rates"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </Page>
  );
}

export default Home;
