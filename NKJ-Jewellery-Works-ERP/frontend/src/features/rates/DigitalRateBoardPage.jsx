import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Clock3,
  Maximize2,
  Minimize2,
  Pencil,
  Save,
  X,
  Gem,
  ShieldCheck,
} from "lucide-react";
import { request } from "../../core/api/client";
import "./DigitalRateBoardPage.css";

const initialRates = {
  gold24kRate: 0,
  gold22kRate: 0,
  silverRate: 0,
  diamondRate: 0,
  rateSource: "",
  rateDate: null,
  updatedAt: null,
  ownerVerified: false,
  newspaperVerified: false,
};

const money = (value, decimals = 0) => Number(value || 0).toLocaleString("en-IN", {
  minimumFractionDigits: decimals,
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

function BrandSeal() {
  return (
    <svg className="nkj-rate-seal" viewBox="0 0 220 220" role="img" aria-label="NKJ jewellery logo">
      <defs>
        <radialGradient id="nkj-seal-red" cx="50%" cy="35%" r="70%">
          <stop offset="0" stopColor="#8d0920" />
          <stop offset=".62" stopColor="#4a0010" />
          <stop offset="1" stopColor="#190006" />
        </radialGradient>
        <linearGradient id="nkj-seal-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff5a8" />
          <stop offset=".28" stopColor="#ffd33d" />
          <stop offset=".58" stopColor="#b86a08" />
          <stop offset=".8" stopColor="#fff0a1" />
          <stop offset="1" stopColor="#9a4e05" />
        </linearGradient>
        <linearGradient id="nkj-seal-stone" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset=".35" stopColor="#ffef7c" />
          <stop offset=".7" stopColor="#e3a800" />
          <stop offset="1" stopColor="#8f3c00" />
        </linearGradient>
      </defs>
      <circle cx="110" cy="110" r="103" fill="#290008" stroke="url(#nkj-seal-gold)" strokeWidth="8" />
      <circle cx="110" cy="110" r="92" fill="url(#nkj-seal-red)" stroke="#ffe58b" strokeWidth="2" />
      <circle cx="110" cy="110" r="83" fill="none" stroke="#d99a21" strokeWidth="1.6" strokeDasharray="3 5" />
      <g fill="none" stroke="url(#nkj-seal-gold)" strokeWidth="5" strokeLinecap="round">
        <path d="M39 133 C22 111 25 77 45 58 C41 85 53 112 70 127" />
        <path d="M181 133 C198 111 195 77 175 58 C179 85 167 112 150 127" />
      </g>
      <g fill="url(#nkj-seal-gold)" stroke="#6c3100" strokeWidth="1.2">
        <ellipse cx="41" cy="77" rx="7" ry="15" transform="rotate(-35 41 77)" />
        <ellipse cx="50" cy="98" rx="7" ry="14" transform="rotate(-28 50 98)" />
        <ellipse cx="62" cy="116" rx="7" ry="13" transform="rotate(-20 62 116)" />
        <ellipse cx="179" cy="77" rx="7" ry="15" transform="rotate(35 179 77)" />
        <ellipse cx="170" cy="98" rx="7" ry="14" transform="rotate(28 170 98)" />
        <ellipse cx="158" cy="116" rx="7" ry="13" transform="rotate(20 158 116)" />
        <path d="M88 44 L98 28 L110 39 L122 28 L132 45 L128 53 L92 53 Z" />
        <path d="M96 28 L96 17 L104 24 L110 12 L116 24 L124 17 L124 29" />
        <path d="M110 65 L143 93 L132 132 L110 151 L88 132 L77 93 Z" />
      </g>
      <path d="M110 76 L135 96 L126 126 L110 139 L94 126 L85 96 Z" fill="url(#nkj-seal-stone)" stroke="#fff0a0" strokeWidth="2.5" />
      <path d="M110 76 L110 139 M85 96 L135 96 M94 126 L110 96 L126 126" fill="none" stroke="#8a4100" strokeWidth="2" />
      <path d="M63 153 Q110 177 157 153 L151 178 Q110 194 69 178 Z" fill="url(#nkj-seal-gold)" stroke="#7d3900" strokeWidth="2" />
      <text x="110" y="174" textAnchor="middle" fontFamily="Georgia,serif" fontSize="25" fontWeight="900" fill="#4a0010">NKJ</text>
      <g fill="#fff2a1">
        <circle cx="110" cy="58" r="3" /><circle cx="66" cy="144" r="3" /><circle cx="154" cy="144" r="3" />
      </g>
    </svg>
  );
}

function CornerFiligree({ className = "" }) {
  return (
    <svg className={"nkj-rate-corner " + className} viewBox="0 0 240 190" aria-hidden="true">
      <defs>
        <linearGradient id="nkj-filigree-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff7b1" />
          <stop offset=".45" stopColor="#d99518" />
          <stop offset="1" stopColor="#783b03" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="url(#nkj-filigree-gold)" strokeWidth="5" strokeLinecap="round">
        <path d="M4 5 C55 5 47 61 93 57 C132 54 124 13 163 14 C198 15 204 48 176 62 C151 75 130 59 138 43 C145 29 166 31 170 45" />
        <path d="M5 24 C30 25 26 82 74 89 C106 95 128 77 111 62 C99 51 82 61 86 74" />
        <path d="M17 8 C26 34 64 31 63 7 M185 6 C193 29 225 28 231 5" />
        <path d="M4 112 C42 87 56 112 49 132 C42 152 18 148 18 130 C18 117 33 111 39 122" />
        <path d="M8 166 C46 151 60 174 86 164 C113 153 109 127 88 128 C70 129 68 147 82 151 C95 155 103 143 96 137" />
        <path d="M25 9 C46 36 83 39 101 57 C118 74 108 93 91 91 C74 89 72 73 85 68" />
        <path d="M119 10 C147 25 150 52 174 55 C199 58 211 40 197 29 C184 19 172 28 175 39" />
        <path d="M13 83 C35 77 39 58 29 47 C19 37 8 45 12 55" />
      </g>
      <g fill="#f5c74b" stroke="#914d08" strokeWidth="2">
        <path d="M93 8 l10 14 -10 14 -10 -14 Z" />
        <path d="M211 78 l9 12 -9 12 -9 -12 Z" />
        <circle cx="65" cy="156" r="7" /><circle cx="154" cy="86" r="6" />
        <path d="M48 12 C54 2 69 2 73 14 C64 21 55 20 48 12 Z" />
        <path d="M122 18 C135 6 148 10 150 24 C139 30 128 27 122 18 Z" />
        <path d="M22 138 C9 127 11 114 24 111 C34 120 33 131 22 138 Z" />
        <path d="M182 106 C195 93 208 98 207 112 C195 119 185 116 182 106 Z" />
        <path d="M83 168 C88 152 104 149 113 161 C107 175 94 178 83 168 Z" />
        <path d="M170 157 C177 144 192 145 198 157 C189 169 178 168 170 157 Z" />
        <path d="M108 104 C118 89 134 91 140 105 C128 117 116 116 108 104 Z" />
      </g>
    </svg>
  );
}

function HangingDiya({ side }) {
  return (
    <svg className={"nkj-rate-diya " + side} viewBox="0 0 120 230" aria-hidden="true">
      <defs>
        <linearGradient id={"nkj-diya-metal-" + side} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7b3904" />
          <stop offset=".25" stopColor="#ffd85c" />
          <stop offset=".52" stopColor="#fff2a3" />
          <stop offset=".78" stopColor="#d28b13" />
          <stop offset="1" stopColor="#693000" />
        </linearGradient>
        <radialGradient id={"nkj-diya-flame-" + side}>
          <stop offset="0" stopColor="#fff" />
          <stop offset=".38" stopColor="#fff4a1" />
          <stop offset=".72" stopColor="#ffab1e" />
          <stop offset="1" stopColor="#f45a00" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d="M60 0 V116" stroke={"url(#nkj-diya-metal-" + side + ")"} strokeWidth="3" />
      <path d="M60 15 l-8 7 8 7 8-7 Z M60 39 l-8 7 8 7 8-7 Z" fill={"url(#nkj-diya-metal-" + side + ")"} />
      <path d="M43 117 Q60 101 77 117" fill="none" stroke={"url(#nkj-diya-metal-" + side + ")"} strokeWidth="7" />
      <path d="M24 136 Q60 167 96 136 Q88 183 60 187 Q32 183 24 136 Z" fill={"url(#nkj-diya-metal-" + side + ")"} stroke="#8f4a06" strokeWidth="3" />
      <ellipse cx="60" cy="138" rx="37" ry="8" fill="#fff0a1" stroke="#b66b08" strokeWidth="3" />
      <path d="M60 133 C39 113 50 91 60 78 C70 95 81 115 60 133 Z" fill={"url(#nkj-diya-flame-" + side + ")"} />
      <path d="M60 133 C52 116 58 103 60 98 C66 114 67 124 60 133 Z" fill="#fff" opacity=".85" />
      <path d="M54 187 Q60 203 66 187" fill="none" stroke={"url(#nkj-diya-metal-" + side + ")"} strokeWidth="5" />
      <circle cx="60" cy="214" r="5" fill="#f0bd38" stroke="#8d4a05" strokeWidth="2" />
    </svg>
  );
}

function LotusFlower({ side }) {
  return (
    <img
      className={"nkj-rate-lotus " + side}
      src={side === "left" ? "/rate-lotus-left-reference.jpg" : "/rate-lotus-right-reference.jpg"}
      alt=""
      aria-hidden="true"
      loading="eager"
      decoding="async"
    />
  );
}

function NecklaceArtwork() {
  return (
    <img
      className="nkj-rate-jewel-photo"
      src="/rate-gold-necklace.webp"
      width="560"
      height="442"
      alt="Traditional gold temple necklace"
      loading="eager"
      decoding="async"
    />
  );
}

function SilverBanglesArtwork() {
  return (
    <img
      className="nkj-rate-jewel-photo is-silver"
      src="/rate-silver-bangles.webp"
      width="560"
      height="278"
      alt="Traditional silver bangles"
      loading="eager"
      decoding="async"
    />
  );
}

function RateDiamond() {
  return (
    <svg className="nkj-rate-diamond" viewBox="0 0 64 56" aria-hidden="true">
      <path d="M32 2 L61 27 L32 54 L3 27 Z" fill="#85001c" stroke="#6d0017" strokeWidth="2" />
      <path d="M32 2 L46 23 L32 54 L18 23 Z" fill="#e20b42" />
      <path d="M3 27 L18 23 L32 54 Z" fill="#b90032" />
      <path d="M61 27 L46 23 L32 54 Z" fill="#8d0025" />
      <path d="M18 23 L25 12 L46 23 L32 30 Z" fill="#ff6488" />
      <path d="M25 12 L32 2 L46 23 Z" fill="#ff9ab0" />
      <path d="M18 23 L32 30 L46 23" fill="none" stroke="#ffd9df" strokeWidth="1.8" />
      <path d="M32 30 L32 54" stroke="#6f0017" strokeWidth="1.5" />
      <path d="M25 12 L18 23 L3 27" fill="none" stroke="#ffd9df" strokeWidth="1.2" />
    </svg>
  );
}

function DecorativeScroll({ side }) {
  return (
    <svg className={"nkj-rate-scroll " + side} viewBox="0 0 280 90" aria-hidden="true">
      <path d="M4 45 H48 C72 45 72 15 99 15 C125 15 126 69 99 69 C82 69 78 48 94 40 C108 34 117 49 108 57 M52 45 C65 45 67 30 78 30 M181 45 H276" fill="none" stroke="#c78313" strokeWidth="5" strokeLinecap="round" />
      <path d="M4 45 H48 C72 45 72 15 99 15 C125 15 126 69 99 69 C82 69 78 48 94 40 C108 34 117 49 108 57" fill="none" stroke="#fff0a0" strokeWidth="1.7" />
      <path d="M168 45 l10 -13 10 13 -10 13 Z" fill="#e4ad31" stroke="#7c3600" strokeWidth="2" />
      <circle cx="31" cy="45" r="4" fill="#ffe7a0" />
    </svg>
  );
}

function BISFloralSpray({ side }) {
  return (
    <svg className={"nkj-rate-bis-spray " + side} viewBox="0 0 180 92" aria-hidden="true">
      <defs>
        <linearGradient id={"nkj-bis-leaf-" + side} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff2a2" />
          <stop offset=".34" stopColor="#d99a22" />
          <stop offset=".7" stopColor="#a45b08" />
          <stop offset="1" stopColor="#ffe58b" />
        </linearGradient>
      </defs>
      <g fill="none" stroke={"url(#nkj-bis-leaf-" + side + ")"} strokeWidth="4" strokeLinecap="round">
        <path d="M8 78 C48 70 65 45 82 15 C91 1 105 8 100 23" />
        <path d="M34 72 C22 52 25 37 43 30 C55 25 67 32 65 43" />
        <path d="M53 60 C54 39 71 28 89 30 C102 31 107 43 99 51" />
        <path d="M76 39 C70 18 84 4 100 6" />
      </g>
      <g fill={"url(#nkj-bis-leaf-" + side + ")"} stroke="#9c580c" strokeWidth="1.5">
        <path d="M41 35 C24 18 14 21 12 35 C24 47 34 47 41 35 Z" />
        <path d="M52 51 C31 45 21 53 27 68 C41 69 50 62 52 51 Z" />
        <path d="M70 43 C61 23 68 14 84 17 C88 30 82 40 70 43 Z" />
        <path d="M91 22 C83 6 91 -1 105 4 C108 15 102 22 91 22 Z" />
        <path d="M80 66 C80 47 94 40 107 49 C103 63 94 68 80 66 Z" />
      </g>
      <g fill="#fff4b0" opacity=".95">
        <circle cx="40" cy="34" r="2.2" />
        <circle cx="70" cy="43" r="2.2" />
        <circle cx="93" cy="22" r="2.2" />
      </g>
    </svg>
  );
}


function BisMark() {
  return (
    <svg className="nkj-rate-bis-logo" viewBox="0 0 74 76" aria-label="BIS hallmark">
      <path d="M37 4 L69 47 H5 Z" fill="#061a9b" stroke="#e7b52e" strokeWidth="2" />
      <path d="M37 17 L54 43 H20 Z" fill="#fff5d7" />
      <circle cx="37" cy="35" r="7" fill="#d71936" />
      <text x="37" y="68" textAnchor="middle" fontSize="15" fontWeight="900" fill="#09217f">BIS</text>
    </svg>
  );
}

export default function DigitalRateBoardPage() {
  const pageRef = useRef(null);
  const [rates, setRates] = useState(initialRates);
  const [now, setNow] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [refreshError, setRefreshError] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [rateEditToken, setRateEditToken] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [toast, setToast] = useState("");
  const [form, setForm] = useState({ gold22: "", silver: "" });

  const refreshRates = useCallback(async () => {
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      setLoading(false);
      setRefreshError("Rate service is taking longer than expected. Please check the connection.");
    }, 8000);
    try {
      const data = await request("/rates", { cache: "no-store", publicRequest: true });
      if (data) setRates({ ...initialRates, ...data });
      setRefreshError("");
    } catch (error) {
      setRefreshError(error.message || "Unable to refresh rates.");
    } finally {
      window.clearTimeout(timeout);
      if (!timedOut) setLoading(false);
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
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = oldOverflow; };
  }, []);

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
      setRefreshError("The browser blocked fullscreen. Use the browser's fullscreen option.");
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      const isTyping = target instanceof HTMLElement
        && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if (event.key === "Escape" && editOpen) {
        setEditOpen(false);
        setPasswordVerified(false);
        setAdminPassword("");
        setRateEditToken("");
        return;
      }
      if (event.key.toLowerCase() !== "f" || event.repeat || event.altKey || event.ctrlKey || event.metaKey || isTyping || editOpen) return;
      event.preventDefault();
      toggleFullscreen();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleFullscreen, editOpen]);

  const verified = Boolean(rates.ownerVerified || rates.newspaperVerified)
    && Number(rates.gold22kRate) > 0
    && Number(rates.silverRate) > 0;

  const dateText = useMemo(() => formatKolkataDate(now), [now]);
  const timeText = useMemo(() => formatKolkataTime(now), [now]);

  const closeEditor = () => {
    if (unlocking || saving) return;
    setEditOpen(false);
    setPasswordVerified(false);
    setAdminPassword("");
    setRateEditToken("");
    setEditError("");
  };

  const openEditor = () => {
    setEditError("");
    setAdminPassword("");
    setRateEditToken("");
    setPasswordVerified(false);
    setForm({
      gold22: rates.gold22kRate ? String(Number(rates.gold22kRate) * 10) : "",
      silver: rates.silverRate ? String(Number(rates.silverRate) * 10) : "",
    });
    setEditOpen(true);
  };

  const verifyAdminPassword = async (event) => {
    event.preventDefault();
    if (!adminPassword.trim()) {
      setEditError("Enter the administrator password.");
      return;
    }

    setUnlocking(true);
    setEditError("");
    try {
      const result = await request("/auth/rate-board/unlock", {
        method: "POST",
        body: JSON.stringify({ password: adminPassword }),
        publicRequest: true,
        suppressSessionExpiry: true,
        skipActivityBarrier: true,
      });
      if (!result?.editToken) throw new Error("The server did not return a rate-edit authorization. Please try again.");
      setRateEditToken(result.editToken);
      setPasswordVerified(true);
      setAdminPassword("");
      setEditError("");
    } catch (error) {
      setEditError(error.message || "Administrator password verification failed.");
    } finally {
      setUnlocking(false);
    }
  };

  const saveRates = async (event) => {
    event.preventDefault();
    const gold22 = Number(form.gold22);
    const silver = Number(form.silver);
    if (!(gold22 > 0) || !(silver > 0)) {
      setEditError("Enter positive Gold 22K and Silver rates per 10 grams.");
      return;
    }

    setSaving(true);
    setEditError("");
    try {
      // The board endpoint accepts only 22K and silver, so the stored 24K
      // and diamond rates remain unchanged even if this short-lived capability
      // is used outside the expected browser UI.
      const payload = {
        gold22kRate: gold22 / 10,
        silverRate: silver / 10,
      };
      const saved = await request("/admin/rates/board", {
        method: "PUT",
        body: JSON.stringify(payload),
        headers: { "X-NKJ-Rate-Edit-Token": rateEditToken },
        publicRequest: true,
        suppressSessionExpiry: true,
        skipActivityBarrier: true,
      });
      setRates({ ...initialRates, ...saved });
      setEditOpen(false);
      setPasswordVerified(false);
      setRateEditToken("");
      setToast("Rates saved successfully. Manual override is now active.");
      window.setTimeout(() => setToast(""), 4500);
    } catch (error) {
      const message = error.message || "Unable to save rates. Verify the administrator password again.";
      setEditError(message);
      if (message.toLowerCase().includes("authorization expired")) {
        setPasswordVerified(false);
        setRateEditToken("");
        setAdminPassword("");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="nkj-rate-board-page" ref={pageRef}>
      <div className="nkj-rate-board-canvas" aria-label="Nandikishor Jewellery Works Gold and Silver Rate Board">
        <div className="nkj-rate-board-marble" aria-hidden="true" />
        <div className="nkj-rate-board-curtain is-left" aria-hidden="true" />
        <div className="nkj-rate-board-curtain is-right" aria-hidden="true" />
        <CornerFiligree className="top-left" />
        <CornerFiligree className="top-right" />
        <CornerFiligree className="bottom-left" />
        <CornerFiligree className="bottom-right" />
        <HangingDiya side="left-outer" />
        <HangingDiya side="left-inner" />
        <HangingDiya side="right-inner" />
        <HangingDiya side="right-outer" />
        <LotusFlower side="left" />
        <LotusFlower side="right" />

        <header className="nkj-rate-board-header">
          <div className="nkj-rate-board-logo"><img className="nkj-rate-seal nkj-rate-logo-image" src="/rate-board-nkj-logo.webp" alt="NKJ Jewellery Works emblem" loading="eager" /></div>
          <div className="nkj-rate-board-brand">
            <span className="nkj-rate-brand-title">NANDIKISHOR</span>
            <div className="nkj-rate-brand-divider"><i /> <b>JEWELLERY WORKS</b> <i /></div>
          </div>
          <div className="nkj-rate-board-actions">
            <button className="nkj-rate-action" type="button" onClick={openEditor} aria-label="Edit gold and silver rates">
              <Pencil size={28} strokeWidth={2.4} />
              <span>Edit</span>
            </button>
            <button className="nkj-rate-action" type="button" onClick={toggleFullscreen} aria-label={fullscreen ? "Exit full screen" : "Enter full screen"}>
              {fullscreen ? <Minimize2 size={27} /> : <Maximize2 size={27} />}
              <span>{fullscreen ? "Exit" : "Full Screen"}</span>
            </button>
          </div>
        </header>

        <div className="nkj-rate-title-row">
          <DecorativeScroll side="left" />
          <div className="nkj-rate-title-banner">
            <RateDiamond />
            <h1>GOLD &amp; SILVER RATE</h1>
            <span className="nkj-rate-diamond">◆</span>
          </div>
          <DecorativeScroll side="right" />
        </div>

        <div className="nkj-rate-date-time">
          <div className="nkj-rate-time-card">
            <CalendarDays aria-hidden="true" />
            <span>DATE :</span>
            <strong>{dateText}</strong>
          </div>
          <div className="nkj-rate-time-separator" aria-hidden="true" />
          <div className="nkj-rate-time-card">
            <Clock3 aria-hidden="true" />
            <span>TIME :</span>
            <strong>{timeText}</strong>
          </div>
        </div>

        <div className="nkj-rate-hallmark">
          <BISFloralSpray side="left" />
          <BisMark />
          <strong>916 HALLMARK CERTIFIED JEWELLERY</strong>
          <BisMark />
          <BISFloralSpray side="right" />
        </div>

        <div className="nkj-rate-per-gram">
          <DecorativeScroll side="left" />
          <strong>RATE PER 10 GRAM</strong>
          <DecorativeScroll side="right" />
        </div>

        <section className="nkj-rate-metal-panel" aria-label="Live gold and silver rates">
          <article className="nkj-rate-metal-row">
            <div className="nkj-rate-jewel-cell"><NecklaceArtwork /></div>
            <div className="nkj-rate-metal-name"><h2>GOLD 22K (916)</h2></div>
            <div className="nkj-rate-metal-price">
              <span>₹</span>
              <strong>{verified ? money(Number(rates.gold22kRate) * 10) : (loading ? "Checking…" : "VERIFY")}</strong>
            </div>
          </article>
          <article className="nkj-rate-metal-row is-silver">
            <div className="nkj-rate-jewel-cell"><SilverBanglesArtwork /></div>
            <div className="nkj-rate-metal-name"><h2>SILVER</h2></div>
            <div className="nkj-rate-metal-price">
              <span>₹</span>
              <strong>{verified ? money(Number(rates.silverRate) * 10) : (loading ? "Checking…" : "VERIFY")}</strong>
            </div>
          </article>
        </section>

        <div className="nkj-rate-gst-banner">
          <span>◆</span><strong>GST AND MAKING CHARGES EXTRA</strong><span>◆</span>
        </div>

        <div className="nkj-rate-board-status" role="status" aria-live="polite">
          {refreshError || (loading ? "Connecting to live ERP rates…" : toast || (verified ? (rates.rateSource ? "Verified source: " + rates.rateSource : "Rates update automatically from the ERP") : "Rates are not verified. Confirm rates before using them for billing."))}
        </div>
      </div>

      {editOpen && (
        <div className="nkj-rate-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEditor(); }}>
          <section className="nkj-rate-edit-modal" role="dialog" aria-modal="true" aria-labelledby="nkj-rate-edit-title">
            <header>
              <div className="nkj-rate-modal-icon"><Gem size={24} /></div>
              <div>
                <span>{passwordVerified ? "RATE CONTROL UNLOCKED" : "SECURE RATE CONTROL"}</span>
                <h2 id="nkj-rate-edit-title">{passwordVerified ? "Edit Gold & Silver Rates" : "Verify Administrator"}</h2>
              </div>
              <button type="button" className="nkj-rate-modal-close" onClick={closeEditor} aria-label="Close edit dialog" disabled={saving || unlocking}><X /></button>
            </header>
            {!passwordVerified ? (
              <form className="nkj-rate-password-step" onSubmit={verifyAdminPassword}>
                <p>Enter the administrator password to unlock rate editing. You do not need to open the Owner Login page.</p>
                <label>
                  <span>Administrator password</span>
                  <div className="nkj-rate-input-wrap">
                    <b><ShieldCheck size={17} /></b>
                    <input
                      type="password"
                      value={adminPassword}
                      onChange={(event) => setAdminPassword(event.target.value)}
                      autoComplete="current-password"
                      autoFocus
                      required
                    />
                  </div>
                </label>
                {editError && <p className="nkj-rate-edit-error" role="alert">{editError}</p>}
                <footer>
                  <button type="button" className="nkj-rate-cancel" onClick={closeEditor} disabled={unlocking}>Cancel</button>
                  <button type="submit" className="nkj-rate-save" disabled={unlocking || !adminPassword}>
                    <ShieldCheck size={17} />{unlocking ? "Verifying…" : "Verify Password"}
                  </button>
                </footer>
              </form>
            ) : (
              <form onSubmit={saveRates}>
                <label>
                  <span>Gold 22K (916) · ₹ / 10 grams</span>
                  <div className="nkj-rate-input-wrap"><b>₹</b><input type="number" min="0.01" step="0.01" value={form.gold22} onChange={(event) => setForm((old) => ({ ...old, gold22: event.target.value }))} required /></div>
                </label>
                <label>
                  <span>Silver 999 · ₹ / 10 grams</span>
                  <div className="nkj-rate-input-wrap"><b>₹</b><input type="number" min="0.01" step="0.01" value={form.silver} onChange={(event) => setForm((old) => ({ ...old, silver: event.target.value }))} required /></div>
                </label>
                <p className="nkj-rate-modal-note"><ShieldCheck size={16} /> Password verified. This temporary edit authorization expires in three minutes. Date and time remain automatic in Kolkata time.</p>
                {editError && <p className="nkj-rate-edit-error" role="alert">{editError}</p>}
                <footer>
                  <button type="button" className="nkj-rate-cancel" onClick={closeEditor} disabled={saving}>Cancel</button>
                  <button type="submit" className="nkj-rate-save" disabled={saving || !rateEditToken}><Save size={17} />{saving ? "Saving…" : "Save Rates"}</button>
                </footer>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
