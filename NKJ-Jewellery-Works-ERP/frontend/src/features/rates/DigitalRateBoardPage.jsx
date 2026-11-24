import React, { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, Clock3, Coins, Gem, Maximize2, Minimize2, RefreshCw, ShieldCheck } from "lucide-react";
import { Nav } from "../../shared/layouts/OwnerShell";
import { request } from "../../core/api/client";
import "./DigitalRateBoardPage.css";

const initialRates = {
  gold22kRate: 0,
  silverRate: 0,
  rateSource: "",
  rateDate: null,
  updatedAt: null,
  ownerVerified: false,
  newspaperVerified: false,
};

const formatRate = (value) => Number(value || 0).toLocaleString("en-IN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

// The clock is always rendered in Kolkata time, regardless of the TV/device timezone.
const formatKolkataDate = (date) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value || "";
  return `${part("day")}-${part("month")}-${part("year")}`;
};

const formatKolkataTime = (date) => date.toLocaleTimeString("en-IN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Kolkata",
}).toUpperCase();

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
      setRefreshError(error.message || "Unable to refresh rates. Please check the internet connection.");
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
        setRefreshError("Fullscreen is not supported by this browser. Use the browser's full-screen option.");
      }
    } catch {
      setRefreshError("The browser blocked fullscreen. Use the on-screen fullscreen control or check browser permissions.");
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

  return (
    <div className={`nkj-digital-rate-page${fullscreen ? " is-fullscreen" : ""}`} ref={pageRef}>
      <Nav active="rate" />
      <main className="nkj-digital-rate-content">
        <section className="nkj-digital-rate-board" aria-label="Nandikishor Jewellery Works gold and silver rate board">
          <div className="nkj-rate-board-frame-corner corner-tl" aria-hidden="true">❧</div>
          <div className="nkj-rate-board-frame-corner corner-tr" aria-hidden="true">❧</div>
          <div className="nkj-rate-board-frame-corner corner-bl" aria-hidden="true">❧</div>
          <div className="nkj-rate-board-frame-corner corner-br" aria-hidden="true">❧</div>

          <header className="nkj-rate-board-brand-plaque">
            <div className="nkj-rate-board-emblem"><Gem size={36} strokeWidth={1.5} /><span>NKJ</span></div>
            <div className="nkj-rate-board-brand-copy">
              <span>NANDIKISHOR</span>
              <strong>JEWELLERY WORKS</strong>
            </div>
            <button
              className="nkj-rate-board-fullscreen"
              type="button"
              onClick={toggleFullscreen}
              title={fullscreen ? "Exit fullscreen (F)" : "Enter fullscreen (F)"}
              aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              <span>{fullscreen ? "EXIT" : "FULL SCREEN"}</span>
            </button>
          </header>

          <div className="nkj-rate-board-main-title">
            <span className="nkj-rate-board-gem" aria-hidden="true">◆</span>
            <h1>GOLD &amp; SILVER RATE</h1>
            <span className="nkj-rate-board-gem" aria-hidden="true">◆</span>
          </div>

          <div className="nkj-rate-board-date-time">
            <div className="nkj-rate-board-date-time-cell">
              <CalendarDays size={31} />
              <span>DATE :</span>
              <strong>{formatKolkataDate(now)}</strong>
            </div>
            <div className="nkj-rate-board-date-time-cell">
              <Clock3 size={31} />
              <span>TIME :</span>
              <strong>{formatKolkataTime(now)}</strong>
            </div>
          </div>

          <div className="nkj-rate-board-hallmark">
            <ShieldCheck size={34} />
            <strong>916 HALLMARK CERTIFIED JEWELLERY</strong>
            <ShieldCheck size={34} />
          </div>

          <div className="nkj-rate-board-per-gram">
            <span />
            <strong>RATE PER 10 GRAM</strong>
            <span />
          </div>

          <div className="nkj-rate-board-metal-list">
            <article className="nkj-rate-board-metal-row gold-row">
              <div className="nkj-rate-board-metal-icon gold-icon"><Gem size={43} /></div>
              <div className="nkj-rate-board-metal-name">
                <small>HALLMARK GOLD</small>
                <h2>GOLD 22K (916)</h2>
              </div>
              <div className="nkj-rate-board-price">
                <span>₹</span>
                <strong>{verified ? formatRate(Number(rates.gold22kRate) * 10) : "—"}</strong>
              </div>
            </article>

            <article className="nkj-rate-board-metal-row silver-row">
              <div className="nkj-rate-board-metal-icon silver-icon"><Coins size={43} /></div>
              <div className="nkj-rate-board-metal-name">
                <small>PURE SILVER</small>
                <h2>SILVER</h2>
              </div>
              <div className="nkj-rate-board-price">
                <span>₹</span>
                <strong>{verified ? formatRate(Number(rates.silverRate) * 10) : "—"}</strong>
              </div>
            </article>
          </div>

          <footer className="nkj-rate-board-disclaimer">
            <span>◆</span>
            <strong>GST AND MAKING CHARGES EXTRA</strong>
            <span>◆</span>
          </footer>
        </section>

        <div className="nkj-rate-board-screen-footer">
          <span role="status">{refreshError || (loading ? "Loading rates…" : `Rates refresh automatically • ${rates.rateSource || "ERP Rate Management"}`)}</span>
          <button type="button" onClick={refreshRates} aria-label="Refresh rates" title="Refresh rates">
            <RefreshCw size={15} /> Refresh
          </button>
          <span className="nkj-rate-board-key-hint">Press <kbd>F</kbd> to toggle full screen</span>
        </div>
      </main>
    </div>
  );
}
