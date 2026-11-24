import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { request } from "../../core/api/client";
import { Nav } from "../../shared/layouts/OwnerShell";
import "./DigitalRateBoardPage.css";

// Demo-only values are shown until the ERP returns verified rates.
const DEMO_RATES_PER_GRAM = {
  gold22kRate: 12540, // ₹1,25,400 per 10 grams
  silverRate: 156,    // ₹1,560 per 10 grams
};

const initialRates = {
  ...DEMO_RATES_PER_GRAM,
  ownerVerified: false,
  newspaperVerified: false,
};

const formatRate = (value) => Number(value || 0).toLocaleString("en-IN", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

const formatKolkataDate = (date) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).formatToParts(date);
  const get = (key) => parts.find((part) => part.type === key)?.value || "";
  return get("day") + "-" + get("month") + "-" + get("year");
};

const formatKolkataTime = (date) => date.toLocaleTimeString("en-IN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Kolkata",
}).toUpperCase();

function RateBoardArtwork({ rates, now }) {
  const useVerifiedRates = Boolean(rates.ownerVerified || rates.newspaperVerified)
    && Number(rates.gold22kRate) > 0
    && Number(rates.silverRate) > 0;
  const goldDisplayRate = Number(useVerifiedRates ? rates.gold22kRate : DEMO_RATES_PER_GRAM.gold22kRate) * 10;
  const silverDisplayRate = Number(useVerifiedRates ? rates.silverRate : DEMO_RATES_PER_GRAM.silverRate) * 10;

  return (
    <svg className="nkj-rate-board-svg" viewBox="0 0 1672 941" role="img" aria-label="Nandikishor Jewellery Works Gold and Silver Rate Board">
      <defs>
        <linearGradient id="nkj-ivory" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff8e9" /><stop offset=".48" stopColor="#fffdf5" /><stop offset="1" stopColor="#f1dfbd" />
        </linearGradient>
        <linearGradient id="nkj-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff6a9" /><stop offset=".22" stopColor="#f7d66a" /><stop offset=".52" stopColor="#dfaa34" /><stop offset=".75" stopColor="#fff0a0" /><stop offset="1" stopColor="#a96716" />
        </linearGradient>
        <linearGradient id="nkj-gold-light" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff9bf" /><stop offset=".45" stopColor="#f2ca55" /><stop offset="1" stopColor="#ad6d18" />
        </linearGradient>
        <linearGradient id="nkj-maroon" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#920c29" /><stop offset=".42" stopColor="#65051d" /><stop offset="1" stopColor="#370711" />
        </linearGradient>
        <linearGradient id="nkj-maroon-button" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#850820" /><stop offset=".55" stopColor="#530514" /><stop offset="1" stopColor="#30050e" />
        </linearGradient>
        <linearGradient id="nkj-green" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0bbd32" /><stop offset=".45" stopColor="#07851d" /><stop offset="1" stopColor="#004b13" />
        </linearGradient>
        <linearGradient id="nkj-blue" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#174db4" /><stop offset="1" stopColor="#04164f" />
        </linearGradient>
        <linearGradient id="nkj-curtain" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#62001c" /><stop offset=".22" stopColor="#e84484" /><stop offset=".45" stopColor="#ff9bbd" /><stop offset=".62" stopColor="#a40035" /><stop offset="1" stopColor="#480011" />
        </linearGradient>
        <linearGradient id="nkj-silver" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" /><stop offset=".35" stopColor="#c4cbd4" /><stop offset=".65" stopColor="#f5f7fb" /><stop offset="1" stopColor="#727b86" />
        </linearGradient>
        <radialGradient id="nkj-emblem" cx=".5" cy=".35" r=".7">
          <stop offset="0" stopColor="#a70e2e" /><stop offset="1" stopColor="#350711" />
        </radialGradient>
        <filter id="nkj-shadow" x="-30%" y="-30%" width="160%" height="180%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="blur" />
          <feOffset in="blur" dy="5" result="offset" />
          <feComponentTransfer><feFuncA type="linear" slope=".35" /></feComponentTransfer>
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="nkj-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <pattern id="nkj-paper" width="38" height="38" patternUnits="userSpaceOnUse">
          <path d="M0 19 Q9 3 19 19 T38 19 M19 0 Q3 9 19 19 T19 38" fill="none" stroke="#c9a96d" strokeWidth="1" opacity=".16" />
          <circle cx="19" cy="19" r="1.3" fill="#c49a4c" opacity=".18" />
        </pattern>
        <g id="nkj-lamp">
          <path d="M0 0 V66" stroke="#b77819" strokeWidth="3" />
          <path d="M-8 63 Q0 55 8 63 L13 75 H-13 Z" fill="url(#nkj-gold)" stroke="#985b10" strokeWidth="2" />
          <path d="M-30 76 Q-27 60 0 60 Q27 60 30 76 L22 101 Q0 117 -22 101 Z" fill="url(#nkj-gold)" stroke="#97570e" strokeWidth="3" />
          <path d="M-24 78 Q0 69 24 78" fill="none" stroke="#fff3a3" strokeWidth="3" />
          <path d="M0 92 Q-12 112 0 126 Q12 112 0 92" fill="#ffb51c" stroke="#fef0a0" strokeWidth="2" filter="url(#nkj-glow)" />
        </g>
        <g id="nkj-lotus">
          <path d="M0 0 C-55 -5 -77 -42 -55 -57 C-30 -66 -8 -34 0 0 C8 -34 30 -66 55 -57 C77 -42 55 -5 0 0" fill="#ed579a" stroke="#c52667" strokeWidth="4" />
          <path d="M0 0 C-32 -14 -47 -52 -24 -67 C-4 -75 0 -35 0 0 C0 -35 4 -75 24 -67 C47 -52 32 -14 0 0" fill="#ff9bc3" stroke="#d64182" strokeWidth="3" />
          <path d="M0 0 Q-25 -24 -19 -49 Q0 -43 0 0 Q19 -43 19 -49 Q25 -24 0 0" fill="#ffd0df" stroke="#e66b9b" strokeWidth="2" />
          <ellipse cx="0" cy="-3" rx="11" ry="7" fill="#f4c74c" stroke="#b67a19" strokeWidth="2" />
          <path d="M-44 7 Q0 22 44 7" fill="none" stroke="#39802a" strokeWidth="7" />
        </g>
        <g id="nkj-diamond">
          <path d="M-24 -7 L-12 -20 H12 L24 -7 L0 19 Z" fill="#d7193f" stroke="#fff1b5" strokeWidth="2" />
          <path d="M-24 -7 H24 M-12 -20 L-6 -7 L0 19 L6 -7 L12 -20" fill="none" stroke="#ffdce3" strokeWidth="1.7" />
        </g>
        <g id="nkj-small-ornament">
          <path d="M0 0 C22 -3 23 -24 8 -25 C-4 -26 -7 -10 0 -8 C7 -7 11 -18 4 -19 M0 0 C-22 -3 -23 -24 -8 -25 C4 -26 7 -10 0 -8" fill="none" stroke="url(#nkj-gold)" strokeWidth="4" strokeLinecap="round" />
          <path d="M0 0 H-42 M0 0 H42" stroke="#bf7b20" strokeWidth="2" />
          <circle cx="0" cy="0" r="4" fill="#f4c95e" />
        </g>
      </defs>

      {/* Ivory background and double gold frame */}
      <rect width="1672" height="941" fill="url(#nkj-ivory)" />
      <rect width="1672" height="941" fill="url(#nkj-paper)" opacity=".75" />
      <rect x="8" y="8" width="1656" height="925" rx="24" fill="none" stroke="#b8781b" strokeWidth="8" />
      <rect x="18" y="18" width="1636" height="905" rx="18" fill="none" stroke="url(#nkj-gold)" strokeWidth="5" />
      <rect x="28" y="28" width="1616" height="885" rx="13" fill="none" stroke="#d79b35" strokeWidth="1.5" />

      {/* Side curtains */}
      <path d="M0 0 H145 L130 80 L112 160 L142 220 L115 325 L145 430 L119 545 L141 670 L110 788 L140 941 H0 Z" fill="url(#nkj-curtain)" stroke="#8b4a12" strokeWidth="4" />
      <path d="M1672 0 H1527 L1542 80 L1560 160 L1530 220 L1557 325 L1527 430 L1553 545 L1531 670 L1562 788 L1532 941 H1672 Z" fill="url(#nkj-curtain)" stroke="#8b4a12" strokeWidth="4" />
      <path d="M18 0 L40 90 L24 160 L52 260 L30 360 L57 463 L29 565 L54 675 L22 775 L40 941" fill="none" stroke="#ffcf70" strokeWidth="5" opacity=".75" />
      <path d="M1654 0 L1632 90 L1648 160 L1620 260 L1642 360 L1615 463 L1643 565 L1618 675 L1650 775 L1632 941" fill="none" stroke="#ffcf70" strokeWidth="5" opacity=".75" />
      <path d="M110 0 Q140 130 95 270 Q145 400 97 555 Q145 705 92 941" fill="none" stroke="#ffb1cf" strokeWidth="8" opacity=".48" />
      <path d="M1562 0 Q1532 130 1577 270 Q1527 400 1575 555 Q1527 705 1580 941" fill="none" stroke="#ffb1cf" strokeWidth="8" opacity=".48" />

      {/* Top corner scrollwork */}
      <path d="M12 85 Q28 6 112 15 Q75 35 91 63 Q115 52 125 31 Q137 90 80 111 Q51 119 30 99 Q58 105 66 83 Q40 81 27 101 Z" fill="none" stroke="url(#nkj-gold)" strokeWidth="6" />
      <path d="M1660 85 Q1644 6 1558 15 Q1595 35 1579 63 Q1555 52 1545 31 Q1533 90 1590 111 Q1619 119 1640 99 Q1612 105 1604 83 Q1630 81 1643 101 Z" fill="none" stroke="url(#nkj-gold)" strokeWidth="6" />
      <path d="M18 225 Q52 185 94 215 Q57 222 69 255 Q92 253 103 234" fill="none" stroke="#dda83d" strokeWidth="4" />
      <path d="M1654 225 Q1620 185 1578 215 Q1615 222 1603 255 Q1580 253 1569 234" fill="none" stroke="#dda83d" strokeWidth="4" />

      {/* Hanging lamps */}
      <use href="#nkj-lamp" transform="translate(162 0) scale(.9)" />
      <use href="#nkj-lamp" transform="translate(1508 0) scale(.9)" />
      <use href="#nkj-lamp" transform="translate(78 112) scale(.55)" />
      <use href="#nkj-lamp" transform="translate(1594 112) scale(.55)" />

      {/* Brand plaque and emblem */}
      <rect x="440" y="16" width="900" height="174" rx="43" fill="#6a071b" stroke="#f4c64f" strokeWidth="8" filter="url(#nkj-shadow)" />
      <rect x="450" y="26" width="880" height="154" rx="35" fill="url(#nkj-maroon)" stroke="#ffe28a" strokeWidth="3" />
      <circle cx="325" cy="104" r="105" fill="url(#nkj-maroon)" stroke="url(#nkj-gold)" strokeWidth="9" filter="url(#nkj-shadow)" />
      <circle cx="325" cy="104" r="91" fill="url(#nkj-emblem)" stroke="#ffdd72" strokeWidth="3" />
      <path d="M267 139 Q238 88 272 47 M383 139 Q412 88 378 47" fill="none" stroke="#b6d84a" strokeWidth="8" />
      <path d="M269 128 l-16 -16 M278 102 l-16 -12 M291 78 l-12 -16 M379 128 l16 -16 M370 102 l16 -12 M357 78 l12 -16" stroke="#e3c24a" strokeWidth="5" strokeLinecap="round" />
      <path d="M286 56 L306 29 L325 39 L344 29 L364 56 L350 50 L340 61 L326 51 L310 61 L300 50 Z" fill="url(#nkj-gold)" stroke="#8f5919" strokeWidth="3" />
      <path d="M288 86 L308 58 H344 L363 86 L326 128 Z" fill="url(#nkj-gold)" stroke="#fff0a0" strokeWidth="3" />
      <path d="M288 86 H363 M308 58 L318 86 L326 128 L339 86 L344 58" fill="none" stroke="#fff5c3" strokeWidth="2" />
      <path d="M268 139 H383 L366 165 H284 Z" fill="url(#nkj-gold)" stroke="#9a5c17" strokeWidth="3" />
      <text x="326" y="160" textAnchor="middle" fontFamily="Georgia,serif" fontWeight="900" fontSize="28" fill="#4d0b16">NKJ</text>
      <text x="885" y="105" textAnchor="middle" fontFamily="Georgia,'Times New Roman',serif" fontWeight="900" fontSize="93" letterSpacing="1" fill="url(#nkj-gold)" stroke="#57200b" strokeWidth="2" paintOrder="stroke">NANDIKISHOR</text>
      <path d="M493 123 H555 M1214 123 H1278" stroke="url(#nkj-gold)" strokeWidth="5" />
      <path d="M520 111 l13 12 -13 12 -13 -12 Z M1252 111 l13 12 -13 12 -13 -12 Z" fill="url(#nkj-gold)" />
      <text x="890" y="163" textAnchor="middle" fontFamily="Georgia,'Times New Roman',serif" fontWeight="700" fontSize="47" letterSpacing="6" fill="#fff4dd">JEWELLERY WORKS</text>

      {/* Header controls: buttons are interactive HTML hotspots over the artwork */}
      <rect x="1364" y="57" width="82" height="92" rx="20" fill="url(#nkj-maroon)" stroke="url(#nkj-gold)" strokeWidth="6" filter="url(#nkj-shadow)" />
      <rect x="1473" y="57" width="82" height="92" rx="20" fill="url(#nkj-maroon)" stroke="url(#nkj-gold)" strokeWidth="6" filter="url(#nkj-shadow)" />
      <path d="M1390 78 l25 -18 10 10 -25 25 -14 4 Z M1384 103 l8 -7" fill="none" stroke="#ffe06a" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <text x="1405" y="135" textAnchor="middle" fontFamily="Georgia,serif" fontWeight="900" fontSize="28" fill="#fff8e9">Edit</text>
      <path d="M1491 84 V69 H1506 M1491 69 l14 14 M1537 84 V69 H1522 M1537 69 l-14 14 M1491 107 V122 H1506 M1491 122 l14 -14 M1537 107 V122 H1522 M1537 122 l-14 -14" fill="none" stroke="#ffe06a" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <text x="1514" y="134" textAnchor="middle" fontFamily="Georgia,serif" fontWeight="900" fontSize="22" fill="#fff8e9">Full</text>
      <text x="1514" y="153" textAnchor="middle" fontFamily="Georgia,serif" fontWeight="900" fontSize="22" fill="#fff8e9">Screen</text>

      {/* Gold and silver headline */}
      <path d="M364 210 H1308 L1285 258 L1308 304 H364 L387 258 Z" fill="url(#nkj-gold)" stroke="#b9751d" strokeWidth="5" filter="url(#nkj-shadow)" />
      <path d="M381 220 H1291 L1274 258 L1291 294 H381 L398 258 Z" fill="url(#nkj-gold-light)" stroke="#fff3b0" strokeWidth="3" />
      <use href="#nkj-diamond" transform="translate(442 258) scale(1.25)" />
      <use href="#nkj-diamond" transform="translate(1230 258) scale(1.25)" />
      <text x="836" y="281" textAnchor="middle" fontFamily="Georgia,'Times New Roman',serif" fontWeight="900" fontSize="67" fill="#6b101a" stroke="#fff4ba" strokeWidth="1.5" paintOrder="stroke">GOLD &amp; SILVER RATE</text>
      <path d="M213 286 Q255 246 301 278 Q277 284 284 305 Q318 303 339 275 M1459 286 Q1417 246 1371 278 Q1395 284 1388 305 Q1354 303 1333 275" fill="none" stroke="url(#nkj-gold)" strokeWidth="7" strokeLinecap="round" />

      {/* Date and time panels */}
      <rect x="138" y="323" width="661" height="85" rx="44" fill="url(#nkj-maroon-button)" stroke="url(#nkj-gold)" strokeWidth="7" filter="url(#nkj-shadow)" />
      <rect x="873" y="323" width="661" height="85" rx="44" fill="url(#nkj-maroon-button)" stroke="url(#nkj-gold)" strokeWidth="7" filter="url(#nkj-shadow)" />
      <rect x="146" y="330" width="645" height="70" rx="37" fill="none" stroke="#fff1a5" strokeWidth="2" />
      <rect x="881" y="330" width="645" height="70" rx="37" fill="none" stroke="#fff1a5" strokeWidth="2" />
      <g transform="translate(218 339)" fill="none" stroke="#fff6e6" strokeWidth="6" strokeLinecap="round">
        <rect x="0" y="7" width="52" height="52" rx="4" /><path d="M0 21 H52 M13 0 V13 M39 0 V13 M13 33 H20 M31 33 H39 M13 45 H20 M31 45 H39" />
      </g>
      <g transform="translate(952 365)" fill="none" stroke="#fff6e6" strokeWidth="5">
        <circle r="29" /><path d="M0 -22 V0 L17 11" strokeLinecap="round" />
      </g>
      <text x="318" y="380" fontFamily="Georgia,serif" fontWeight="900" fontSize="37" fill="#fff7e8">DATE :</text>
      <text x="1045" y="380" fontFamily="Georgia,serif" fontWeight="900" fontSize="37" fill="#fff7e8">TIME :</text>
      <text x="630" y="380" textAnchor="middle" fontFamily="Georgia,serif" fontWeight="900" fontSize="43" fill="#ffe329" stroke="#5d270a" strokeWidth="1.5" paintOrder="stroke">{formatKolkataDate(now)}</text>
      <text x="1328" y="380" textAnchor="middle" fontFamily="Georgia,serif" fontWeight="900" fontSize="43" fill="#ffe329" stroke="#5d270a" strokeWidth="1.5" paintOrder="stroke">{formatKolkataTime(now)}</text>

      {/* Hallmark certification strip */}
      <rect x="165" y="420" width="1342" height="76" rx="39" fill="url(#nkj-gold)" stroke="#bd7a1e" strokeWidth="5" filter="url(#nkj-shadow)" />
      <rect x="174" y="427" width="1324" height="61" rx="31" fill="url(#nkj-gold-light)" stroke="#fff4bd" strokeWidth="2" />
      <g fill="#123f9c" textAnchor="middle" fontFamily="Arial,sans-serif" fontWeight="900">
        <path d="M245 468 L274 435 L302 468 Z" fill="#1243a2" /><circle cx="274" cy="458" r="7" fill="#e32338" /><text x="274" y="489" fontSize="22">BIS</text>
        <path d="M1370 468 L1399 435 L1427 468 Z" fill="#1243a2" /><circle cx="1399" cy="458" r="7" fill="#e32338" /><text x="1399" y="489" fontSize="22">BIS</text>
      </g>
      <text x="836" y="474" textAnchor="middle" fontFamily="Georgia,'Times New Roman',serif" fontWeight="900" fontSize="42" fill="#123d9b">916 HALLMARK CERTIFIED JEWELLERY</text>
      <path d="M98 465 Q135 425 162 459 M1574 459 Q1601 425 1638 465" fill="none" stroke="url(#nkj-gold)" strokeWidth="8" />

      {/* Rate per gram ribbon */}
      <path d="M464 528 L510 500 H1162 L1208 528 L1162 562 H510 Z" fill="url(#nkj-maroon)" stroke="url(#nkj-gold)" strokeWidth="5" filter="url(#nkj-shadow)" />
      <path d="M238 537 H448 M1225 537 H1434" stroke="url(#nkj-gold)" strokeWidth="3" />
      <use href="#nkj-small-ornament" transform="translate(405 537) scale(1.15)" />
      <use href="#nkj-small-ornament" transform="translate(1267 537) scale(1.15)" />
      <text x="836" y="548" textAnchor="middle" fontFamily="Georgia,serif" fontWeight="900" fontSize="42" fill="#fff2c9">RATE PER 10 GRAM</text>

      {/* Metal-rate board */}
      <rect x="80" y="566" width="1508" height="258" rx="43" fill="url(#nkj-maroon)" stroke="url(#nkj-gold)" strokeWidth="7" filter="url(#nkj-shadow)" />
      <rect x="91" y="576" width="1486" height="237" rx="34" fill="none" stroke="#ffdf71" strokeWidth="2" />
      <path d="M93 694 H1577" stroke="#ff2c67" strokeWidth="7" filter="url(#nkj-glow)" />
      <path d="M93 696 H1577" stroke="#fff7de" strokeWidth="2" />

      {/* Gold necklace illustration */}
      <g transform="translate(220 584)" filter="url(#nkj-shadow)">
        <path d="M-62 7 Q-50 90 0 105 Q50 90 62 7" fill="none" stroke="url(#nkj-gold)" strokeWidth="10" />
        <path d="M-55 24 Q-33 78 0 83 Q33 78 55 24" fill="none" stroke="#ffe9a2" strokeWidth="4" />
        {Array.from({ length: 15 }, (_, i) => {
          const x = -52 + i * 7.4;
          const y = 27 + Math.sin((i / 14) * Math.PI) * 52;
          return <circle key={i} cx={x} cy={y} r="5.5" fill="#f5c63b" stroke="#fff1a2" strokeWidth="1.7" />;
        })}
        <path d="M-29 56 L-17 35 L0 29 L17 35 L29 56 L20 80 L0 96 L-20 80 Z" fill="url(#nkj-gold)" stroke="#fff0a4" strokeWidth="3" />
        <path d="M0 89 L-12 110 L0 128 L12 110 Z" fill="#c51439" stroke="#ffdf81" strokeWidth="4" />
        <circle cx="0" cy="60" r="12" fill="#c81438" stroke="#fff0a4" strokeWidth="3" />
      </g>

      {/* Silver rings illustration */}
      <g transform="translate(220 712)" filter="url(#nkj-shadow)">
        <ellipse cx="0" cy="56" rx="90" ry="33" fill="url(#nkj-silver)" stroke="#fff" strokeWidth="4" />
        <ellipse cx="0" cy="51" rx="71" ry="22" fill="#610b1e" stroke="#d9dfe8" strokeWidth="5" />
        <ellipse cx="0" cy="47" rx="59" ry="16" fill="none" stroke="#fff" strokeWidth="4" />
        <path d="M-78 61 Q0 104 78 61" fill="none" stroke="#7d8791" strokeWidth="5" />
        <path d="M-60 48 l9 13 -9 9 -9 -9 Z M-34 42 l9 13 -9 9 -9 -9 Z M-8 39 l9 13 -9 9 -9 -9 Z M18 39 l9 13 -9 9 -9 -9 Z M44 42 l9 13 -9 9 -9 -9 Z" fill="#dce1e7" stroke="#737c88" strokeWidth="2" />
      </g>

      {/* Divider and labels */}
      <path d="M408 586 V681 M408 710 V799" stroke="url(#nkj-gold)" strokeWidth="4" />
      <text x="455" y="665" fontFamily="Georgia,'Times New Roman',serif" fontWeight="900" fontSize="60" fill="#fff4df" stroke="#8d5b18" strokeWidth="3" paintOrder="stroke">GOLD 22K (916)</text>
      <text x="506" y="787" fontFamily="Georgia,'Times New Roman',serif" fontWeight="900" fontSize="68" fill="#fff8ed" stroke="#333" strokeWidth="1.5" paintOrder="stroke">SILVER</text>

      {/* Green rate panels */}
      <rect x="944" y="579" width="592" height="104" rx="38" fill="url(#nkj-green)" stroke="#f3d33c" strokeWidth="8" filter="url(#nkj-shadow)" />
      <rect x="955" y="588" width="570" height="85" rx="31" fill="none" stroke="#fff7ac" strokeWidth="3" />
      <rect x="944" y="700" width="592" height="104" rx="38" fill="url(#nkj-green)" stroke="#f3d33c" strokeWidth="8" filter="url(#nkj-shadow)" />
      <rect x="955" y="709" width="570" height="85" rx="31" fill="none" stroke="#fff7ac" strokeWidth="3" />
      <text x="1010" y="656" fontFamily="Arial,sans-serif" fontWeight="900" fontSize="61" fill="#fff">₹</text>
      <text x="1010" y="778" fontFamily="Arial,sans-serif" fontWeight="900" fontSize="61" fill="#fff">₹</text>
      <text x="1280" y="653" textAnchor="middle" fontFamily="Georgia,'Times New Roman',serif" fontWeight="900" fontSize="77" letterSpacing="1" fill="#ffe42b" stroke="#523300" strokeWidth="2" paintOrder="stroke">{formatRate(goldDisplayRate)}</text>
      <text x="1280" y="775" textAnchor="middle" fontFamily="Georgia,'Times New Roman',serif" fontWeight="900" fontSize="77" letterSpacing="1" fill="#ffe42b" stroke="#523300" strokeWidth="2" paintOrder="stroke">{formatRate(silverDisplayRate)}</text>

      {/* GST and making charge banner */}
      <path d="M370 844 H1302 L1279 883 L1302 916 H370 L393 883 Z" fill="url(#nkj-blue)" stroke="url(#nkj-gold)" strokeWidth="7" filter="url(#nkj-shadow)" />
      <rect x="386" y="853" width="900" height="51" rx="25" fill="none" stroke="#ffed95" strokeWidth="2" />
      <use href="#nkj-diamond" transform="translate(422 882) scale(.65)" />
      <use href="#nkj-diamond" transform="translate(1250 882) scale(.65)" />
      <text x="836" y="899" textAnchor="middle" fontFamily="Georgia,'Times New Roman',serif" fontWeight="900" fontSize="36" letterSpacing="1" fill="#fff5dc">GST AND MAKING CHARGES EXTRA</text>

      {/* Bottom lotus decorations */}
      <use href="#nkj-lotus" transform="translate(94 873) scale(1.15)" />
      <use href="#nkj-lotus" transform="translate(1578 873) scale(1.15)" />
      <path d="M0 916 Q140 892 278 928 H1394 Q1532 892 1672 916" fill="none" stroke="url(#nkj-gold)" strokeWidth="7" />
    </svg>
  );
}

export default function DigitalRateBoardPage() {
  const pageRef = useRef(null);
  const [rates, setRates] = useState(initialRates);
  const [now, setNow] = useState(() => new Date());
  const [fullscreen, setFullscreen] = useState(false);

  const refreshRates = useCallback(async () => {
    try {
      const data = await request("/rates", { cache: "no-store", publicRequest: true });
      if (data) setRates({ ...initialRates, ...data });
    } catch (error) {
      // Keep the last successfully loaded rates visible during a temporary network issue.
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
      }
    } catch (error) {
      // Some TV browsers restrict script-initiated fullscreen.
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

  return (
    <div className={"nkj-digital-rate-page" + (fullscreen ? " is-fullscreen" : "")} ref={pageRef}>
      <Nav active="rate" />
      <main className="nkj-digital-rate-content">
        <section className="nkj-rate-board-stage">
          <RateBoardArtwork rates={rates} now={now} />
          <Link className="nkj-rate-board-hotspot nkj-rate-board-edit-hotspot" to="/rates" aria-label="Edit Gold and Silver Rates" title="Edit Rates" />
          <button className="nkj-rate-board-hotspot nkj-rate-board-fullscreen-hotspot" type="button" onClick={toggleFullscreen} aria-label={fullscreen ? "Exit Full Screen" : "Full Screen"} title={fullscreen ? "Exit Full Screen" : "Full Screen"} />
        </section>
      </main>
    </div>
  );
}
