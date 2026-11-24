import React, { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, Clock3, Gem, Maximize2, Minimize2, ShieldCheck } from "lucide-react";
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

const formatKolkataDate = (date) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value || "";
  return part("day") + "-" + part("month") + "-" + part("year");
};

const formatKolkataTime = (date) => date.toLocaleTimeString("en-IN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Kolkata",
}).toUpperCase();

function GoldNecklaceIcon() {
  return (
    <svg viewBox="0 0 150 100" aria-hidden="true" className="nkj-rate-board-jewel-art">
      <defs>
        <linearGradient id="nkj-gold-chain" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff3a5" /><stop offset=".45" stopColor="#e6a928" /><stop offset="1" stopColor="#8b4a08" />
        </linearGradient>
      </defs>
      <path d="M14 16 Q26 82 75 84 Q124 82 136 16" fill="none" stroke="url(#nkj-gold-chain)" strokeWidth="7" strokeLinecap="round" />
      <path d="M22 29 Q42 69 75 72 Q108 69 128 29" fill="none" stroke="#ffe58c" strokeWidth="3" />
      {Array.from({ length: 17 }, (_, i) => {
        const x = 25 + i * 6.25;
        const y = 34 + Math.sin((i / 16) * Math.PI) * 35;
        return <circle key={i} cx={x} cy={y} r="4.2" fill="#f7c842" stroke="#fff1a5" strokeWidth="1.4" />;
      })}
      <path d="M48 51 L58 39 L75 35 L92 39 L102 51 L94 65 L75 76 L56 65 Z" fill="url(#nkj-gold-chain)" stroke="#fff0a3" strokeWidth="2" />
      <path d="M75 68 L65 81 L75 96 L85 81 Z" fill="#bc1c36" stroke="#ffe58c" strokeWidth="3" />
      <circle cx="75" cy="54" r="8" fill="#d91d3c" stroke="#fff2a5" strokeWidth="2" />
    </svg>
  );
}

function SilverRingIcon() {
  return (
    <svg viewBox="0 0 150 100" aria-hidden="true" className="nkj-rate-board-jewel-art">
      <defs>
        <linearGradient id="nkj-silver-metal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" /><stop offset=".45" stopColor="#aab1bc" /><stop offset=".72" stopColor="#f7f8fa" /><stop offset="1" stopColor="#747c88" />
        </linearGradient>
      </defs>
      <ellipse cx="74" cy="62" rx="58" ry="26" fill="url(#nkj-silver-metal)" stroke="#fff" strokeWidth="3" />
      <ellipse cx="74" cy="59" rx="48" ry="17" fill="#51101d" stroke="#dce2e9" strokeWidth="4" />
      <ellipse cx="74" cy="57" rx="39" ry="12" fill="none" stroke="#f7f8fa" strokeWidth="3" />
      <path d="M20 60 Q74 91 128 60" fill="none" stroke="#858d99" strokeWidth="4" />
      <path d="M29 55 Q74 77 119 55" fill="none" stroke="#fff" strokeWidth="2" />
      {Array.from({ length: 13 }, (_, i) => <path key={i} d={"M" + (27 + i * 7.8) + " 53 l4 8 -4 6 -4 -6 Z"} fill="#d5dbe4" stroke="#737c89" strokeWidth="1" />)}
      <path d="M42 43 Q74 22 106 43" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

function HangingLamp({ side }) {
  return (
    <div className={"nkj-rate-board-hanging-lamp " + side} aria-hidden="true">
      <span className="lamp-chain" />
      <span className="lamp-cap" />
      <span className="lamp-bowl" />
      <span className="lamp-flame" />
    </div>
  );
}

export default function DigitalRateBoardPage() {
  const pageRef = useRef(null);
  const [rates, setRates] = useState(initialRates);
  const [now, setNow] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [refreshError, setRefreshError] = useState("");
  const [fullscreen, setFullscreen] = useState(false);

  const refreshRates = useCallback(async () => {
    try {
      const data = await request("/rates", { cache: "no-store", publicRequest: true });
      if (data) setRates({ ...initialRates, ...data });
      setRefreshError("");
    } catch (error) {
      setRefreshError(error.message || "Rate refresh failed.");
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
      } else if (pageRef.current && pageRef.current.requestFullscreen) {
        await pageRef.current.requestFullscreen({ navigationUI: "hide" });
      } else {
        setRefreshError("Fullscreen is not supported by this browser.");
      }
    } catch {
      setRefreshError("The browser blocked fullscreen. Use its fullscreen option.");
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
    <div className={"nkj-digital-rate-page" + (fullscreen ? " is-fullscreen" : "")} ref={pageRef}>
      <Nav active="rate" />
      <main className="nkj-digital-rate-content">
        <section className="nkj-digital-rate-board" aria-label="Nandikishor Jewellery Works gold and silver rate board">
          <div className="nkj-rate-board-frame" aria-hidden="true" />
          <div className="nkj-rate-board-corners" aria-hidden="true">
            <span>❦</span><span>❦</span><span>❦</span><span>❦</span>
          </div>
          <div className="nkj-rate-board-side-curtain curtain-left" aria-hidden="true" />
          <div className="nkj-rate-board-side-curtain curtain-right" aria-hidden="true" />
          <span className="nkj-rate-board-lotus lotus-left" aria-hidden="true" />
          <span className="nkj-rate-board-lotus lotus-right" aria-hidden="true" />
          <HangingLamp side="lamp-left" />
          <HangingLamp side="lamp-right" />

          <header className="nkj-rate-board-brand-plaque">
            <div className="nkj-rate-board-emblem">
              <span className="nkj-rate-board-crown">♛</span>
              <Gem size={42} strokeWidth={1.5} />
              <span className="nkj-rate-board-emblem-ribbon">NKJ</span>
            </div>
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
              <CalendarDays size={32} />
              <span>DATE :</span>
              <strong>{formatKolkataDate(now)}</strong>
            </div>
            <div className="nkj-rate-board-date-time-cell">
              <Clock3 size={32} />
              <span>TIME :</span>
              <strong>{formatKolkataTime(now)}</strong>
            </div>
          </div>

          <div className="nkj-rate-board-hallmark">
            <span className="nkj-rate-board-bis-mark" aria-hidden="true"><b>▲</b><small>BIS</small></span>
            <strong>916 HALLMARK CERTIFIED JEWELLERY</strong>
            <span className="nkj-rate-board-bis-mark" aria-hidden="true"><b>▲</b><small>BIS</small></span>
          </div>

          <div className="nkj-rate-board-per-gram">
            <span />
            <strong>RATE PER 10 GRAM</strong>
            <span />
          </div>

          <div className="nkj-rate-board-metal-list">
            <article className="nkj-rate-board-metal-row gold-row">
              <div className="nkj-rate-board-jewel"><GoldNecklaceIcon /></div>
              <div className="nkj-rate-board-metal-name"><h2>GOLD 22K (916)</h2></div>
              <div className="nkj-rate-board-price">
                <span>₹</span>
                <strong>{verified ? formatRate(Number(rates.gold22kRate) * 10) : "—"}</strong>
              </div>
            </article>
            <article className="nkj-rate-board-metal-row silver-row">
              <div className="nkj-rate-board-jewel"><SilverRingIcon /></div>
              <div className="nkj-rate-board-metal-name"><h2>SILVER</h2></div>
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
          <span className="nkj-rate-board-error" role="status" aria-live="polite">{refreshError || (loading ? "Loading rates…" : "")}</span>
        </section>
      </main>
    </div>
  );
}
