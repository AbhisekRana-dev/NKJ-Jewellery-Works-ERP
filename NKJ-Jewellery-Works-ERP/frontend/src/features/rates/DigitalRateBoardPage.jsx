import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { useAuth } from "../../core/auth/AuthProvider";
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
      </g>
      <g fill="#f5c74b" stroke="#914d08" strokeWidth="2">
        <path d="M93 8 l10 14 -10 14 -10 -14 Z" />
        <path d="M211 78 l9 12 -9 12 -9 -12 Z" />
        <circle cx="65" cy="156" r="7" /><circle cx="154" cy="86" r="6" />
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
      <path d="M60 0 V116" stroke="url(#nkj-diya-metal-left)" strokeWidth="3" />
      <path d="M60 15 l-8 7 8 7 8-7 Z M60 39 l-8 7 8 7 8-7 Z" fill="url(#nkj-diya-metal-left)" />
      <path d="M43 117 Q60 101 77 117" fill="none" stroke="url(#nkj-diya-metal-left)" strokeWidth="7" />
      <path d="M24 136 Q60 167 96 136 Q88 183 60 187 Q32 183 24 136 Z" fill="url(#nkj-diya-metal-left)" stroke="#8f4a06" strokeWidth="3" />
      <ellipse cx="60" cy="138" rx="37" ry="8" fill="#fff0a1" stroke="#b66b08" strokeWidth="3" />
      <path d="M60 133 C39 113 50 91 60 78 C70 95 81 115 60 133 Z" fill={"url(#nkj-diya-flame-" + side + ")"} />
      <path d="M60 133 C52 116 58 103 60 98 C66 114 67 124 60 133 Z" fill="#fff" opacity=".85" />
      <path d="M54 187 Q60 203 66 187" fill="none" stroke="url(#nkj-diya-metal-left)" strokeWidth="5" />
      <circle cx="60" cy="214" r="5" fill="#f0bd38" stroke="#8d4a05" strokeWidth="2" />
    </svg>
  );
}

function LotusFlower({ side }) {
  return (
    <svg className={"nkj-rate-lotus " + side} viewBox="0 0 260 150" aria-hidden="true">
      <defs>
        <linearGradient id={"nkj-lotus-petal-" + side} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd4e7" />
          <stop offset=".5" stopColor="#fb5da5" />
          <stop offset="1" stopColor="#b80a55" />
        </linearGradient>
      </defs>
      <g stroke="#a50049" strokeWidth="2">
        <path d="M130 139 C75 111 78 68 130 15 C182 68 185 111 130 139 Z" fill={"url(#nkj-lotus-petal-" + side + ")"} />
        <path d="M128 139 C30 128 19 82 46 48 C95 57 125 91 128 139 Z" fill={"url(#nkj-lotus-petal-" + side + ")"} />
        <path d="M132 139 C230 128 241 82 214 48 C165 57 135 91 132 139 Z" fill={"url(#nkj-lotus-petal-" + side + ")"} />
        <path d="M128 139 C43 145 8 118 10 91 C65 78 110 100 128 139 Z" fill="#d21a68" />
        <path d="M132 139 C217 145 252 118 250 91 C195 78 150 100 132 139 Z" fill="#d21a68" />
        <path d="M130 139 Q82 80 130 15 Q178 80 130 139" fill="none" stroke="#ffe5a5" strokeWidth="3" />
      </g>
      <path d="M32 137 Q130 112 228 137 Q180 160 130 145 Q80 160 32 137 Z" fill="#287c32" stroke="#10521e" strokeWidth="3" />
      <ellipse cx="130" cy="137" rx="22" ry="8" fill="#ffd748" stroke="#a86607" strokeWidth="2" />
    </svg>
  );
}

function NecklaceArtwork() {
  return (
    <svg className="nkj-rate-jewel-svg" viewBox="0 0 330 190" role="img" aria-label="Gold necklace illustration">
      <defs>
        <linearGradient id="nkj-necklace-gold" x1="0" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#fff5af" />
          <stop offset=".22" stopColor="#ffda42" />
          <stop offset=".5" stopColor="#b76b05" />
          <stop offset=".72" stopColor="#fff1a0" />
          <stop offset="1" stopColor="#8d3d00" />
        </linearGradient>
        <radialGradient id="nkj-necklace-ruby">
          <stop offset="0" stopColor="#ffb9c7" />
          <stop offset=".45" stopColor="#ed1e4c" />
          <stop offset="1" stopColor="#710018" />
        </radialGradient>
      </defs>
      <path d="M29 20 C43 105 100 134 165 140 C230 134 287 105 301 20" fill="none" stroke="#6f3905" strokeWidth="12" strokeLinecap="round" />
      <path d="M29 18 C43 103 100 132 165 138 C230 132 287 103 301 18" fill="none" stroke="url(#nkj-necklace-gold)" strokeWidth="8" strokeLinecap="round" />
      <path d="M43 34 C65 102 110 119 165 123 C220 119 265 102 287 34" fill="none" stroke="#ffed9a" strokeWidth="5" />
      <path d="M55 51 C79 105 119 111 165 114 C211 111 251 105 275 51" fill="none" stroke="url(#nkj-necklace-gold)" strokeWidth="5" />
      {Array.from({ length: 23 }, (_, i) => {
        const t = i / 22;
        const x = 42 + t * 246;
        const y = 52 + Math.sin(t * Math.PI) * 55;
        return <g key={i}><circle cx={x} cy={y} r="6.2" fill="url(#nkj-necklace-gold)" stroke="#fff1a1" strokeWidth="1.6" /><circle cx={x-1.5} cy={y-2} r="1.7" fill="#fff" /></g>;
      })}
      <g fill="url(#nkj-necklace-gold)" stroke="#7f4200" strokeWidth="2.3">
        <path d="M123 96 L137 77 L165 69 L193 77 L207 96 L194 119 L165 138 L136 119 Z" />
        <path d="M144 119 L165 138 L186 119 L178 148 L165 165 L152 148 Z" />
        <path d="M151 93 L165 80 L179 93 L165 112 Z" />
      </g>
      <path d="M165 84 L177 95 L165 109 L153 95 Z" fill="url(#nkj-necklace-ruby)" stroke="#fff0a1" strokeWidth="2.8" />
      <path d="M165 140 L152 156 L165 184 L178 156 Z" fill="url(#nkj-necklace-ruby)" stroke="#ffe7a0" strokeWidth="3" />
      <g fill="#fff1b2" stroke="#9e5a08" strokeWidth="1">
        {Array.from({ length: 7 }, (_, i) => <circle key={i} cx={135 + i * 10} cy={142 + (i===3?9:Math.abs(3-i)*3)} r="4.4" />)}
      </g>
      <g fill="#fff6c7" opacity=".9">
        <path d="M77 64 l4-12 4 12 12 4-12 4-4 12-4-12-12-4 Z" />
        <path d="M250 70 l3-9 3 9 9 3-9 3-3 9-3-9-9-3 Z" />
      </g>
    </svg>
  );
}

function SilverBanglesArtwork() {
  return (
    <svg className="nkj-rate-jewel-svg" viewBox="0 0 330 190" role="img" aria-label="Silver bangles illustration">
      <defs>
        <linearGradient id="nkj-silver-bangle" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset=".16" stopColor="#b9c0ca" />
          <stop offset=".34" stopColor="#f7fbff" />
          <stop offset=".57" stopColor="#737d8c" />
          <stop offset=".78" stopColor="#eef4fa" />
          <stop offset="1" stopColor="#7c8490" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="#515866" strokeWidth="18">
        <ellipse cx="133" cy="106" rx="105" ry="44" transform="rotate(-7 133 106)" />
        <ellipse cx="201" cy="91" rx="101" ry="42" transform="rotate(8 201 91)" />
        <ellipse cx="164" cy="76" rx="103" ry="42" transform="rotate(-2 164 76)" />
      </g>
      <g fill="none" stroke="url(#nkj-silver-bangle)" strokeWidth="14">
        <ellipse cx="133" cy="106" rx="105" ry="44" transform="rotate(-7 133 106)" />
        <ellipse cx="201" cy="91" rx="101" ry="42" transform="rotate(8 201 91)" />
        <ellipse cx="164" cy="76" rx="103" ry="42" transform="rotate(-2 164 76)" />
      </g>
      <g fill="none" stroke="#fff" strokeWidth="3" opacity=".9">
        <ellipse cx="133" cy="99" rx="99" ry="39" transform="rotate(-7 133 99)" />
        <ellipse cx="201" cy="84" rx="95" ry="37" transform="rotate(8 201 84)" />
        <ellipse cx="164" cy="69" rx="98" ry="37" transform="rotate(-2 164 69)" />
      </g>
      <g fill="#dfe5ee" stroke="#687181" strokeWidth="1.5">
        {Array.from({ length: 21 }, (_, i) => {
          const x = 42 + i * 11.8;
          const y = 75 - Math.sin((i / 20) * Math.PI) * 29;
          return <path key={i} d={"M" + x + " " + y + " l5 -7 5 7 -5 7 Z"} />;
        })}
      </g>
      <g fill="#fff" opacity=".8"><circle cx="72" cy="42" r="4" /><circle cx="260" cy="48" r="3" /><circle cx="278" cy="116" r="3" /></g>
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
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [rates, setRates] = useState(initialRates);
  const [now, setNow] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [refreshError, setRefreshError] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [toast, setToast] = useState("");
  const [form, setForm] = useState({ gold22: "", silver: "" });

  const refreshRates = useCallback(async () => {
    try {
      const data = await request("/rates", { cache: "no-store", publicRequest: true });
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

  const openEditor = () => {
    setEditError("");
    setForm({
      gold22: rates.gold22kRate ? String(Number(rates.gold22kRate) * 10) : "",
      silver: rates.silverRate ? String(Number(rates.silverRate) * 10) : "",
    });
    setEditOpen(true);
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
      // The existing ERP rate endpoint stores values per gram.
      // Preserve the saved 24K/diamond values while changing only the two
      // values exposed on this public rate board.
      const gold24PerGram = Number(rates.gold24kRate) > 0
        ? Number(rates.gold24kRate)
        : (gold22 / 10) / 0.916;
      const payload = {
        gold24kRate: gold24PerGram,
        gold22kRate: gold22 / 10,
        silverRate: silver / 10,
        diamondRate: Number(rates.diamondRate || 0),
      };
      const saved = await request("/admin/rates", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setRates({ ...initialRates, ...saved });
      setEditOpen(false);
      setToast("Rates saved successfully. Manual override is now active.");
      window.setTimeout(() => setToast(""), 4500);
    } catch (error) {
      setEditError(error.message || "Unable to save rates. Please sign in as owner.");
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
        <HangingDiya side="left" />
        <HangingDiya side="right" />
        <LotusFlower side="left" />
        <LotusFlower side="right" />

        <header className="nkj-rate-board-header">
          <div className="nkj-rate-board-logo"><BrandSeal /></div>
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
            <span className="nkj-rate-diamond">◆</span>
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
          <span className="nkj-rate-hallmark-leaves" aria-hidden="true">❧</span>
          <BisMark />
          <strong>916 HALLMARK CERTIFIED JEWELLERY</strong>
          <BisMark />
          <span className="nkj-rate-hallmark-leaves" aria-hidden="true">❧</span>
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
              <strong>{verified ? money(Number(rates.gold22kRate) * 10) : (loading ? "Loading…" : "—")}</strong>
            </div>
          </article>
          <article className="nkj-rate-metal-row is-silver">
            <div className="nkj-rate-jewel-cell"><SilverBanglesArtwork /></div>
            <div className="nkj-rate-metal-name"><h2>SILVER</h2></div>
            <div className="nkj-rate-metal-price">
              <span>₹</span>
              <strong>{verified ? money(Number(rates.silverRate) * 10) : (loading ? "Loading…" : "—")}</strong>
            </div>
          </article>
        </section>

        <div className="nkj-rate-gst-banner">
          <span>◆</span><strong>GST AND MAKING CHARGES EXTRA</strong><span>◆</span>
        </div>

        <div className="nkj-rate-board-status" role="status" aria-live="polite">
          {refreshError || (loading ? "Connecting to live ERP rates…" : toast || (rates.rateSource ? "Verified source: " + rates.rateSource : "Rates update automatically from the ERP"))}
        </div>
      </div>

      {editOpen && (
        <div className="nkj-rate-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditOpen(false); }}>
          <section className="nkj-rate-edit-modal" role="dialog" aria-modal="true" aria-labelledby="nkj-rate-edit-title">
            <header>
              <div className="nkj-rate-modal-icon"><Gem size={24} /></div>
              <div><span>OWNER RATE CONTROL</span><h2 id="nkj-rate-edit-title">Edit Gold &amp; Silver Rates</h2></div>
              <button type="button" className="nkj-rate-modal-close" onClick={() => setEditOpen(false)} aria-label="Close edit dialog"><X /></button>
            </header>
            {isAdmin ? (
              <form onSubmit={saveRates}>
                <label>
                  <span>Gold 22K (916) · ₹ / 10 grams</span>
                  <div className="nkj-rate-input-wrap"><b>₹</b><input type="number" min="0.01" step="0.01" value={form.gold22} onChange={(event) => setForm((old) => ({ ...old, gold22: event.target.value }))} required /></div>
                </label>
                <label>
                  <span>Silver 999 · ₹ / 10 grams</span>
                  <div className="nkj-rate-input-wrap"><b>₹</b><input type="number" min="0.01" step="0.01" value={form.silver} onChange={(event) => setForm((old) => ({ ...old, silver: event.target.value }))} required /></div>
                </label>
                <p className="nkj-rate-modal-note"><ShieldCheck size={16} /> Date and time stay live in Kolkata time. Saving rates uses the existing ERP rate history and switches to Manual Override Mode.</p>
                {editError && <p className="nkj-rate-edit-error" role="alert">{editError}</p>}
                <footer>
                  <button type="button" className="nkj-rate-cancel" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</button>
                  <button type="submit" className="nkj-rate-save" disabled={saving}><Save size={17} />{saving ? "Saving…" : "Save Rates"}</button>
                </footer>
              </form>
            ) : (
              <div className="nkj-rate-login-prompt">
                <p>Only the signed-in owner can change jewellery rates.</p>
                <p>Date and time continue to update automatically using Asia/Kolkata.</p>
                <button type="button" onClick={() => navigate("/login", { state: { from: { pathname: "/rate" } } })}>Owner Login</button>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
