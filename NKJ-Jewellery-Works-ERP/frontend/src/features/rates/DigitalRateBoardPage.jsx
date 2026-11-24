import React, { useCallback, useEffect, useRef, useState } from "react";
import { Coins, Maximize2, Minimize2, RefreshCw, ShieldCheck } from "lucide-react";
import { Nav } from "../../shared/layouts/OwnerShell";
import { request } from "../../core/api/client";
import "./DigitalRateBoardPage.css";

const initialRates = {
  gold22kRate: 0,
  silverRate: 0,
  rateMode: "MANUAL",
  rateSource: "",
  rateDate: null,
  updatedAt: null,
  ownerVerified: false,
  newspaperVerified: false,
};

const formatRate = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const formatRateDate = (value) => {
  if (!value) return "—";
  const match = String(value).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(value);
  return new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00+05:30`)
    .toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    });
};

export default function DigitalRateBoardPage() {
  const pageRef = useRef(null);
  const [rates, setRates] = useState(initialRates);
  const [now, setNow] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [refreshError, setRefreshError] = useState("");
  const [fullscreen, setFullscreen] = useState(false);

  const refreshRates = useCallback(async () => {
    try {
      const data = await request("/rates", {
        cache: "no-store",
        publicRequest: true,
      });
      if (data) setRates({ ...initialRates, ...data });
      setRefreshError("");
    } catch (error) {
      setRefreshError(error.message || "Unable to refresh rates.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshRates();
    const rateTimer = window.setInterval(refreshRates, 15000);
    const clockTimer = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      window.clearInterval(rateTimer);
      window.clearInterval(clockTimer);
    };
  }, [refreshRates]);

  useEffect(() => {
    const syncFullscreen = () => setFullscreen(document.fullscreenElement === pageRef.current);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (pageRef.current?.requestFullscreen) {
        await pageRef.current.requestFullscreen({ navigationUI: "hide" });
      } else {
        setRefreshError("Fullscreen is not supported by this browser. Use the display button or browser zoom.");
      }
    } catch {
      setRefreshError("The browser blocked fullscreen. Use the fullscreen button or check browser permissions.");
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      const isTyping = target instanceof HTMLElement
        && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if (event.key.toLowerCase() !== "f" || event.repeat || event.altKey || event.ctrlKey || event.metaKey || isTyping) return;
      event.preventDefault();
      toggleFullscreen();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleFullscreen]);

  const verified = Boolean(rates.ownerVerified || rates.newspaperVerified)
    && Number(rates.gold22kRate) > 0
    && Number(rates.silverRate) > 0;
  const rateTime = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  });
  const today = now.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

  return (
    <div className={`nkj-digital-rate-page${fullscreen ? " is-fullscreen" : ""}`} ref={pageRef}>
      <Nav active="rate" />
      <main className="nkj-digital-rate-content">
        <section className="nkj-digital-rate-board" aria-label="Nandikishor Jewellery Works digital rate board">
          <div className="nkj-rate-board-corner nkj-rate-board-corner-tl" />
          <div className="nkj-rate-board-corner nkj-rate-board-corner-tr" />
          <div className="nkj-rate-board-corner nkj-rate-board-corner-bl" />
          <div className="nkj-rate-board-corner nkj-rate-board-corner-br" />

          <div className="nkj-rate-board-topline">
            <span className="nkj-rate-board-brand-mark"><Coins size={23} /></span>
            <div className="nkj-rate-board-brand">
              <span>NANDIKISHOR</span>
              <strong>JEWELLERY WORKS</strong>
              <small>TRADITION • TRUST • PURITY</small>
            </div>
            <button
              className="nkj-rate-board-fullscreen"
              type="button"
              onClick={toggleFullscreen}
              title={fullscreen ? "Exit fullscreen (F)" : "Enter fullscreen (F)"}
              aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              <span>{fullscreen ? "EXIT FULL SCREEN" : "FULL SCREEN"}</span>
            </button>
          </div>

          <div className="nkj-rate-board-title-wrap">
            <span className="nkj-rate-board-title-rule" />
            <h1>TODAY'S RATE</h1>
            <span className="nkj-rate-board-title-rule" />
          </div>

          <div className="nkj-rate-board-meta">
            <div><span>DATE</span><strong>{today}</strong></div>
            <div className="nkj-rate-board-meta-divider" />
            <div><span>TIME</span><strong>{rateTime}</strong></div>
          </div>

          <div className="nkj-rate-board-certification">
            <ShieldCheck size={21} />
            <span>916 HALLMARK CERTIFIED JEWELLERY</span>
            <i />
            <b>RATE PER 10 GRAMS</b>
          </div>

          <div className="nkj-rate-board-values">
            <article className="nkj-rate-board-metal nkj-rate-board-gold">
              <div className="nkj-rate-board-metal-heading">
                <span className="nkj-rate-board-metal-symbol">Au</span>
                <div><small>HALLMARK GOLD</small><h2>GOLD 22K (916)</h2></div>
              </div>
              <div className="nkj-rate-board-value">
                <span>₹</span>
                <strong>{verified ? formatRate(Number(rates.gold22kRate) * 10) : "RATE PENDING"}</strong>
              </div>
              <small className="nkj-rate-board-unit">INDIAN RUPEES • PER 10 GRAMS</small>
            </article>

            <article className="nkj-rate-board-metal nkj-rate-board-silver">
              <div className="nkj-rate-board-metal-heading">
                <span className="nkj-rate-board-metal-symbol">Ag</span>
                <div><small>PURE SILVER</small><h2>SILVER</h2></div>
              </div>
              <div className="nkj-rate-board-value">
                <span>₹</span>
                <strong>{verified ? formatRate(Number(rates.silverRate) * 10) : "RATE PENDING"}</strong>
              </div>
              <small className="nkj-rate-board-unit">INDIAN RUPEES • PER 10 GRAMS</small>
            </article>
          </div>

          <div className="nkj-rate-board-bottom">
            <strong>GST AND MAKING CHARGES EXTRA</strong>
            <span>{verified ? `Rate date: ${formatRateDate(rates.rateDate)}` : "RATE NOT VERIFIED — PLEASE CONFIRM WITH THE STORE"}</span>
          </div>
        </section>

        <div className="nkj-rate-board-screen-footer">
          <span>{refreshError || (loading ? "Loading latest rates…" : `Rates refresh automatically every 15 seconds • Source: ${rates.rateSource || "ERP Rate Management"}`)}</span>
          <button type="button" onClick={refreshRates} aria-label="Refresh rates" title="Refresh rates">
            <RefreshCw size={15} /> Refresh
          </button>
          <span className="nkj-rate-board-key-hint">Press <kbd>F</kbd> to toggle full screen</span>
        </div>
      </main>
    </div>
  );
}
