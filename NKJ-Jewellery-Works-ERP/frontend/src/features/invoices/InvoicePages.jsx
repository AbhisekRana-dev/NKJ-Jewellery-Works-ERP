
import "./InvoicePages.css";
import React, { useEffect, useRef, useState } from "react";

import { Link, useNavigate, useLocation } from "react-router-dom";

import {
  Home as HomeIcon,
  FileText,
  User,
  ChartNoAxesColumn,
  LogOut,
  LogIn,
  Plus,
  Eye,
  Copy,
  Pencil,
  X,
  MessageCircle,
  Printer,
  Search,
  ArrowLeftRight,
  Trash2,
  ArrowLeft,
  Save,
  LockKeyhole,
  Diamond,
  EyeOff,
  Receipt,
  CalendarDays,
  LayoutDashboard,
  Boxes,
  Coins,
  Clock3,
  Contact,
  Truck,
  ShoppingCart,
  Wallet,
  CalendarCheck,
  ClipboardList,
  Banknote,
  Database,
  ScrollText,
  HardDrive,
  Settings,
  Gem,
  Wrench,
  ChevronRight,
  Calculator as CalculatorIcon,
} from "lucide-react";


import { request } from "../../core/api/client";
import { useRealtimeRefresh } from "../../core/realtime/realtime";

import { useAuth } from "../../core/auth/AuthProvider";
import InvoicePinDialog from "../../shared/components/InvoicePinDialog";
import { Page } from "../../shared/layouts/OwnerShell";
import { money } from "../../shared/utils/formatters";


function evaluateCalculatorExpression(rawExpression) {
  const expression = String(rawExpression ?? "")
    .replace(/[×xX]/g, "*")
    .replace(/[÷]/g, "/")
    .replace(/[−]/g, "-")
    .replace(/\s+/g, "");

  if (!expression) throw new Error("Enter a calculation first.");

  const tokens = expression.match(/\d+(?:\.\d*)?|\.\d+|[+\-*/%()]/g) || [];
  if (tokens.join("") !== expression) throw new Error("Check the expression and try again.");

  let cursor = 0;

  const parsePrimary = () => {
    const token = tokens[cursor];
    if (token === "(") {
      cursor += 1;
      const nested = parseExpression();
      if (tokens[cursor] !== ")") throw new Error("Missing closing bracket.");
      cursor += 1;
      return nested;
    }
    if (!token || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) {
      throw new Error("Enter a number.");
    }
    cursor += 1;
    const value = Number(token);
    if (!Number.isFinite(value)) throw new Error("The number is too large.");
    return { value, isPercent: false };
  };

  const parseFactor = () => {
    let sign = 1;
    while (tokens[cursor] === "+" || tokens[cursor] === "-") {
      if (tokens[cursor] === "-") sign *= -1;
      cursor += 1;
    }
    const node = parsePrimary();
    let isPercent = false;
    while (tokens[cursor] === "%") {
      node.value /= 100;
      isPercent = true;
      cursor += 1;
    }
    return { value: sign * node.value, isPercent };
  };

  const parseTerm = () => {
    let left = parseFactor();
    while (tokens[cursor] === "*" || tokens[cursor] === "/") {
      const operator = tokens[cursor++];
      const right = parseFactor();
      if (operator === "/" && right.value === 0) {
        throw new Error("Cannot divide by zero.");
      }
      left = {
        value: operator === "*" ? left.value * right.value : left.value / right.value,
        isPercent: false,
      };
      if (!Number.isFinite(left.value)) throw new Error("The result is outside the supported range.");
    }
    return left;
  };

  const parseExpression = () => {
    let left = parseTerm();
    while (tokens[cursor] === "+" || tokens[cursor] === "-") {
      const operator = tokens[cursor++];
      const right = parseTerm();
      // For addition/subtraction, a postfix percentage is relative to the
      // value on its left (for example, 200 + 10% = 220).
      const rightValue = right.isPercent ? left.value * right.value : right.value;
      left = {
        value: operator === "+" ? left.value + rightValue : left.value - rightValue,
        isPercent: false,
      };
      if (!Number.isFinite(left.value)) throw new Error("The result is outside the supported range.");
    }
    return left;
  };

  const result = parseExpression();
  if (cursor !== tokens.length) throw new Error("Check the expression and try again.");
  if (!Number.isFinite(result.value)) throw new Error("The result is not a valid number.");
  return result.value;
}

function formatCalculatorValue(value) {
  if (!Number.isFinite(value)) throw new Error("The result is not a valid number.");
  return Number(value.toPrecision(12)).toString();
}

function parseInvoiceDetails(invoice) {
  if (!invoice) return {};
  let details = invoice.details;

  if (typeof details === "string") {
    try {
      details = JSON.parse(details);
    } catch {
      details = {};
    }
  }

  if (!details || typeof details !== "object" || Array.isArray(details)) {
    details = {};
  }

  if ((!details.newItems && !details.oldItems) && typeof invoice.payload === "string") {
    try {
      const payload = JSON.parse(invoice.payload);
      if (payload && typeof payload === "object") details = { ...details, ...payload };
    } catch {
      // Older summary-only invoice records may have no parseable payload.
    }
  }

  return { ...details, ...invoice };
}

function invoiceRows(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function rowHasAnyInput(row, fields) {
  return fields.some((field) => String(row?.[field] ?? "").trim() !== "");
}

function hasInvoiceLineItems(invoice) {
  const data = parseInvoiceDetails(invoice);
  const newItems = invoiceRows(data.newItems);
  const oldItems = invoiceRows(data.oldItems);
  return (
    newItems.some((row) => rowHasAnyInput(row, ["description", "purity", "netWeight", "rate", "makingCharge", "stampCharge", "extraCharge"])) ||
    oldItems.some((row) => rowHasAnyInput(row, ["description", "purity", "pureWeight", "rate"]))
  );
}

function makeInvoiceShareMessage(invoice) {
  const data = parseInvoiceDetails(invoice);
  const newItems = invoiceRows(data.newItems).filter((row) =>
    rowHasAnyInput(row, ["description", "purity", "netWeight", "rate", "makingCharge", "stampCharge", "extraCharge"]),
  );
  const oldItems = invoiceRows(data.oldItems).filter((row) =>
    rowHasAnyInput(row, ["description", "purity", "pureWeight", "rate"]),
  );
  const lines = [
    "NANDIKISHOR JEWELLERY WORKS",
    "Sasra, Gopiballavpur, Jhargram, West Bengal - 721506",
    "Contact: 99322770722 | 8116022248",
    "",
    `INVOICE: ${data.invoiceNo || "—"}`,
    `Date: ${data.invoiceDate || "—"}${data.invoiceTime ? ` ${data.invoiceTime}` : ""}`,
    `Customer: ${data.customerName || "—"}`,
    `Mobile: ${data.mobile || "—"}`,
    `Address: ${data.address || "—"}`,
    `Payment: ${data.paymentMode || "—"}`,
    `Reference: ${data.referenceNo || "—"}`,
    "",
    "NEW ORNAMENTS:",
  ];

  if (newItems.length) {
    newItems.forEach((row, index) => {
      const amount =
        row.amount !== undefined && row.amount !== null
          ? Number(row.amount)
          : Math.max(
              0,
              (Number(row.netWeight) || 0) * (Number(row.rate) || 0) +
                (Number(row.makingCharge) || 0) +
                (Number(row.stampCharge) || 0) +
                (Number(row.extraCharge) || 0),
            );
      lines.push(
        `${index + 1}. ${row.description || "Ornament"} | Purity: ${row.purity || "—"} | Weight: ${row.netWeight || "0"} gm | Rate: ₹${money(row.rate)} | Making: ₹${money(row.makingCharge)} | Stamp: ₹${money(row.stampCharge)} | Extra: ₹${money(row.extraCharge)} | Amount: ₹${money(amount)}`,
      );
    });
  } else {
    lines.push("No new ornaments.");
  }

  lines.push("", "OLD / EXCHANGE ORNAMENTS:");
  if (oldItems.length) {
    oldItems.forEach((row, index) => {
      const amount =
        row.amount !== undefined && row.amount !== null
          ? Number(row.amount)
          : (Number(row.pureWeight) || 0) * (Number(row.rate) || 0);
      lines.push(
        `${index + 1}. ${row.description || "Ornament"} | Purity: ${row.purity || "—"} | Weight: ${row.pureWeight || "0"} gm | Rate: ₹${money(row.rate)} | Amount: ₹${money(amount)}`,
      );
    });
  } else {
    lines.push("No old/exchange ornaments.");
  }

  lines.push(
    "",
    `New Ornaments Total: ₹${money(data.newTotal ?? data.subTotal)}`,
    `Old Exchange: - ₹${money(data.oldTotal)}`,
    `GST (${Number(data.gstPercent) || 0}%): ₹${money(data.gstAmount)}`,
    `Discount: - ₹${money(data.discount)}`,
    `GRAND TOTAL: ₹${money(data.grandTotal)}`,
    `Amount in Words: ${amountInWords(Number(data.grandTotal) || 0)}`,
  );

  if (data.description) {
    lines.push("", `Additional Description: ${data.description}`);
  }

  lines.push("", "Thank you for shopping with Nandikishor Jewellery Works.");
  return lines.join("\n");
}


/** Generate a shareable PDF from a saved invoice without opening the Print dialog. */
function createSavedInvoicePdf(invoice) {
  const data = parseInvoiceDetails(invoice);
  const newRows = invoiceRows(data.newItems);
  const oldRows = invoiceRows(data.oldItems);
  const showGstin = data.showGstin !== false;
  const newTotal = Number(data.newTotal ?? data.subTotal ?? newRows.reduce((sum, row) => sum + newAmt(row), 0)) || 0;
  const oldTotal = Number(data.oldTotal ?? oldRows.reduce((sum, row) => sum + oldAmt(row), 0)) || 0;
  const gstPercent = Number(data.gstPercent) || 0;
  const gstAmount = showGstin ? (Number(data.gstAmount ?? (newTotal * gstPercent) / 100) || 0) : 0;
  const discount = Number(data.discount) || 0;
  const grandTotal = Number(data.grandTotal ?? (newTotal + gstAmount - discount - oldTotal)) || 0;
  const totalPaid = Math.max(0, Number(data.totalPaid ?? data.paymentAmount ?? 0) || 0);
  const dueAmount = Math.max(0, grandTotal - totalPaid);
  const W = 842, H = 595, M = 34;
  const pages = [];
  let ops = [], y = 32;

  const safe = (v) => String(v ?? "").replace(/₹/g, "Rs. ").replace(/[–—]/g, "-").replace(/[•·]/g, "-").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[^\x20-\x7E]/g, "");
  const esc = (v) => safe(v).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const fmt = (v) => Number(v || 0).toLocaleString("en-IN", {minimumFractionDigits:2, maximumFractionDigits:2});
  const addPage = () => { if (ops.length) pages.push(ops.join("\n")); ops = []; y = 32; };
  const txt = (v,x,t,size=8,bold=false,color="0.12 0.12 0.12") => {
    ops.push(color + " rg BT /" + (bold ? "F2" : "F1") + " " + size + " Tf 1 0 0 1 " + x + " " + (H-t-size) + " Tm (" + esc(v) + ") Tj ET");
  };
  const rule = (x1,t1,x2,t2,color="0.78 0.65 0.48",width=0.7) => {
    ops.push(color + " RG " + width + " w " + x1 + " " + (H-t1) + " m " + x2 + " " + (H-t2) + " l S");
  };
  const box = (x,t,w,h,fill="1 1 1",stroke="0.86 0.75 0.65") => {
    ops.push(fill + " rg " + stroke + " RG 0.7 w " + x + " " + (H-t-h) + " " + w + " " + h + " re B");
  };
  const section = (label) => {
    box(M,y,W-2*M,19,"0.98 0.95 0.90");
    txt(label,M+7,y+4,9,true,"0.48 0.08 0.16");
    y += 25;
  };
  const drawTableHead = (label, cols) => {
    section(label);
    box(M,y,W-2*M,19,"0.53 0.04 0.14","0.53 0.04 0.14");
    let x=M;
    cols.forEach((c) => { txt(c[0],x+4,y+5,7,true,"1 1 1"); x+=c[1]; });
    y+=19;
  };
  const row = (values, cols) => {
    if (y > H-55) { addPage(); drawTableHead("ITEM DETAILS (CONTINUED)",cols); }
    box(M,y,W-2*M,20);
    let x=M;
    values.forEach((v,i) => {
      txt(safe(v).slice(0,Math.max(7,Math.floor(cols[i][1]/4.2))),x+4,y+5,7.2);
      if(i) rule(x,y,x,y+20,"0.86 0.86 0.86",0.4);
      x+=cols[i][1];
    });
    y+=20;
  };

  txt("NANDIKISHOR JEWELLERY WORKS",M,y,19,true,"0.55 0.03 0.14");
  txt("Sasra, Gopiballavpur, Jhargram, West Bengal - 721506",M,y+22,8.5);
  txt("Contact: 99322770722 | 8116022248",M,y+36,8.5);
  if(showGstin) txt("GSTIN: 19ABCDE1234F1Z5",M,y+50,8);
  box(615,y-2,193,67,"1 0.98 0.95","0.78 0.20 0.25");
  txt("TAX INVOICE",675,y+5,11,true,"0.55 0.03 0.14");
  txt("Invoice No.: " + (data.invoiceNo || "-"),625,y+24,8,true);
  txt("Date: " + displaySavedInvoiceDate(data.invoiceDate || data.date),625,y+38,8);
  txt("Time: " + displaySavedInvoiceTime(data.invoiceTime || data.time),625,y+51,8);
  y+=78; rule(M,y,W-M,y,"0.65 0.35 0.12",1.2); y+=12;

  const half=(W-2*M-10)/2;
  box(M,y,half,67); box(M+half+10,y,half,67);
  txt("CUSTOMER DETAILS",M+8,y+8,8,true,"0.55 0.03 0.14");
  txt("Name: " + (data.customerName || data.name || "-"),M+8,y+24,8);
  txt("Mobile: " + (data.mobile || "-"),M+8,y+38,8);
  txt("Address: " + (data.address || "-"),M+8,y+52,7.5);
  const px=M+half+18;
  txt("PAYMENT DETAILS",px,y+8,8,true,"0.55 0.03 0.14");
  txt("Payment mode: " + (data.paymentMode || "Cash"),px,y+26,8);
  txt("Reference: " + (data.referenceNo || "-"),px,y+42,8);
  y+=79;

  const newCols=[["No.",34],["Description",150],["Purity",105],["Net Wt.",62],["Rate/GM",78],["Making",70],["Stamp",60],["Extra",60],["Amount (Rs.)",155]];
  drawTableHead("NEW ORNAMENTS",newCols);
  if(!newRows.length) row(["-","No new ornaments","","","","","","","0.00"],newCols);
  newRows.forEach((r,i)=>row([i+1,r.description||"Ornament",r.purity||"-",r.netWeight||"0",fmt(r.rate),fmt(r.makingCharge),fmt(r.stampCharge),fmt(r.extraCharge),fmt(r.amount??newAmt(r))],newCols));
  txt("Total New Ornaments: Rs. "+fmt(newTotal),W-M-205,y+5,8.5,true,"0.55 0.03 0.14"); y+=23;

  const oldCols=[["No.",34],["Description",220],["Purity",145],["Weight (gm)",100],["Rate/GM",110],["Amount (Rs.)",220]];
  drawTableHead("OLD / EXCHANGE ORNAMENTS",oldCols);
  if(!oldRows.length) row(["-","No old/exchange ornaments","","","", "0.00"],oldCols);
  oldRows.forEach((r,i)=>row([i+1,r.description||"Ornament",r.purity||"-",r.pureWeight||"0",fmt(r.rate),fmt(r.amount??oldAmt(r))],oldCols));
  txt("Total Old Exchange: Rs. "+fmt(oldTotal),W-M-205,y+5,8.5,true,"0.55 0.03 0.14"); y+=24;

  if(y>H-145) addPage();
  const tx=535,tw=273;
  const totals=[["SUB TOTAL",fmt(newTotal)]].concat(showGstin?[["GST ("+gstPercent+"%)",fmt(gstAmount)]]:[]).concat([["DISCOUNT","- "+fmt(discount)],["OLD EXCHANGE","- "+fmt(oldTotal)],["TOTAL PAID",fmt(totalPaid)],["DUE AMOUNT",fmt(dueAmount)]]);
  totals.forEach(([label,value])=>{box(tx,y,tw,17);txt(label,tx+8,y+4,7.5,true);txt(value,tx+180,y+4,7.5,true);y+=17;});
  box(tx,y,tw,23,"0.53 0.04 0.14","0.53 0.04 0.14");
  txt("GRAND TOTAL",tx+8,y+6,9,true,"1 1 1");txt("Rs. "+fmt(grandTotal),tx+180,y+6,9,true,"1 1 1");y+=31;

  if(data.description){txt("Additional Description: "+data.description,M,y,8);y+=13;}
  if(y>H-55) addPage();
  txt("Amount in Words: "+amountInWords(grandTotal),M,y,8,true);y+=20;
  rule(M,y,W-M,y);txt("Customer Signature",M+80,y+18,8);txt("Authorised Signature",W-M-155,y+18,8);
  txt("Thank you for shopping with Nandikishor Jewellery Works.",245,H-24,8,true,"0.55 0.03 0.14");
  if(ops.length) pages.push(ops.join("\n"));

  const objects=[];
  const add=(v)=>{objects.push(v);return objects.length;};
  const catalog=add(""), pagesObj=add("");
  const regular=add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const bold=add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const pageIds=[];
  pages.forEach((stream)=>{
    const streamData=stream+"\n";
    const contentId=add("<< /Length "+streamData.length+" >>\nstream\n"+streamData+"endstream");
    pageIds.push(add("<< /Type /Page /Parent "+pagesObj+" 0 R /MediaBox [0 0 "+W+" "+H+"] /Resources << /Font << /F1 "+regular+" 0 R /F2 "+bold+" 0 R >> >> /Contents "+contentId+" 0 R >>"));
  });
  objects[catalog-1]="<< /Type /Catalog /Pages "+pagesObj+" 0 R >>";
  objects[pagesObj-1]="<< /Type /Pages /Kids ["+pageIds.map(id=>id+" 0 R").join(" ")+"] /Count "+pageIds.length+" >>";
  let pdf="%PDF-1.4\n";const offsets=[0];
  objects.forEach((obj,i)=>{offsets.push(pdf.length);pdf+=(i+1)+" 0 obj\n"+obj+"\nendobj\n";});
  const xref=pdf.length;
  pdf+="xref\n0 "+(objects.length+1)+"\n0000000000 65535 f \n";
  offsets.slice(1).forEach((off)=>{pdf+=String(off).padStart(10,"0")+" 00000 n \n";});
  pdf+="trailer\n<< /Size "+(objects.length+1)+" /Root "+catalog+" 0 R >>\nstartxref\n"+xref+"\n%%EOF";
  return new Blob([pdf],{type:"application/pdf"});
}

const blankNew = () => ({
  description: "",

  purity: "",

  netWeight: "",

  rate: "",

  makingCharge: "",

  stampCharge: "",

  extraCharge: "",
});

const blankOld = () => ({
  description: "",

  purity: "",

  pureWeight: "",

  rate: "",
});

const newAmt = (x) => {
  const netWeight = Number(x.netWeight) || 0;
  const rate = Number(x.rate) || 0;
  const makingCharge = Number(x.makingCharge) || 0;
  const stampCharge = Number(x.stampCharge) || 0;
  const extraCharge = Number(x.extraCharge) || 0;

  // Add each charge independently. Extra, making, or stamp charges
  // must still appear in Amount even when weight or rate is zero.
  return Math.max(
    0,
    netWeight * rate + makingCharge + stampCharge + extraCharge,
  );
};

const oldAmt = (x) => (+x.pureWeight || 0) * (+x.rate || 0);

function amountInWords(value) {
  const fixed = (Number(value) || 0).toFixed(2);

  const parts = fixed.split(".");

  const n = Number(parts[0]);

  const paise = Number(parts[1]);

  const ones = [
    "",

    "One",

    "Two",

    "Three",

    "Four",

    "Five",

    "Six",

    "Seven",

    "Eight",

    "Nine",

    "Ten",

    "Eleven",

    "Twelve",

    "Thirteen",

    "Fourteen",

    "Fifteen",

    "Sixteen",

    "Seventeen",

    "Eighteen",

    "Nineteen",
  ];

  const tens = [
    "",

    "",

    "Twenty",

    "Thirty",

    "Forty",

    "Fifty",

    "Sixty",

    "Seventy",

    "Eighty",

    "Ninety",
  ];

  const under1000 = (x) => {
    let out = "";

    if (x >= 100) {
      out += ones[Math.floor(x / 100)] + " Hundred ";

      x %= 100;
    }

    if (x >= 20) {
      out += tens[Math.floor(x / 10)] + " ";

      x %= 10;
    }

    if (x > 0) out += ones[x] + " ";

    return out.trim();
  };

  if (n === 0) {
    return paise ? `Zero Rupees and ${under1000(paise)} Paise Only` : "Zero Rupees Only";
  }

  let x = n,
    out = "";

  const crore = Math.floor(x / 10000000);

  x %= 10000000;

  const lakh = Math.floor(x / 100000);

  x %= 100000;

  const thousand = Math.floor(x / 1000);

  x %= 1000;

  if (crore) out += under1000(crore) + " Crore ";

  if (lakh) out += under1000(lakh) + " Lakh ";

  if (thousand) out += under1000(thousand) + " Thousand ";

  if (x) out += under1000(x);

  return (
    out.trim() + (paise ? " and " + under1000(paise) + " Paise" : "") + " Only"
  );
}

const INVOICE_DRAFT_STORAGE_KEY = "nkj.invoice.draft.v1";

function getTodayIndiaDate() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatInvoiceDateForDisplay(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : String(value || "—");
}

const INVOICE_DRAFT_RELOAD_GUARD_KEY = "nkj.invoice.draft.reload-document";
// Capture the route loaded by the browser itself. The document navigation
// type remains "reload" during later SPA navigation, so it must not reset an
// invoice opened after the user refreshed another page.
const INVOICE_DOCUMENT_ENTRY_PATH = typeof window !== "undefined"
  ? String(window.location.pathname || "").replace(/\/+$/, "")
  : "";
let invoiceReloadDraftClearedInMemory = false;

function getInvoiceReloadDocumentKey() {
  if (typeof window === "undefined" || INVOICE_DOCUMENT_ENTRY_PATH !== "/invoice") return "";
  try {
    const navigationEntries = window.performance?.getEntriesByType?.("navigation") || [];
    const navigationType = navigationEntries[0]?.type;
    const legacyReload = navigationEntries.length === 0
      && window.performance?.navigation?.type === 1;
    if (navigationType !== "reload" && !legacyReload) return "";
    return String(
      window.performance?.timeOrigin ||
      window.performance?.timing?.navigationStart ||
      "",
    );
  } catch {
    return "";
  }
}

// This check is deliberately read-only because React Strict Mode may call
// state initializers more than once in development.
function isUnconsumedInvoiceReload() {
  const documentKey = getInvoiceReloadDocumentKey();
  if (!documentKey) return false;
  try {
    return window.sessionStorage.getItem(INVOICE_DRAFT_RELOAD_GUARD_KEY) !== documentKey;
  } catch {
    return !invoiceReloadDraftClearedInMemory;
  }
}

function markInvoiceReloadHandled() {
  const documentKey = getInvoiceReloadDocumentKey();
  if (!documentKey) return;
  invoiceReloadDraftClearedInMemory = true;
  try {
    window.sessionStorage.setItem(INVOICE_DRAFT_RELOAD_GUARD_KEY, documentKey);
  } catch {
    // The in-memory guard handles browsers with blocked session storage.
  }
}

function readInvoiceDraft() {
  if (typeof window === "undefined") return null;
  try {
    const draft = JSON.parse(window.localStorage.getItem(INVOICE_DRAFT_STORAGE_KEY) || "null");
    return draft && draft.version === 1 ? draft : null;
  } catch {
    return null;
  }
}

function createInvoiceDraftKey() {
  try {
    if (typeof window !== "undefined" && typeof window.crypto?.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
  } catch {
    // Fall back for browsers without crypto.randomUUID.
  }
  return `nkj-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Print only the invoice sheet in an isolated same-origin document.
 *
 * The previous implementation called window.print() on the full ERP page.
 * Its print CSS used visibility:hidden for unrelated application elements;
 * visibility preserves layout space, so the owner shell/sidebar could create
 * blank pages before the invoice. An iframe removes the shell from the print
 * document entirely while reusing the existing invoice markup and CSS.
 */
async function printInvoiceAsPdf({ onAfterPrint } = {}) {
  const source = document.getElementById("invoice-print");
  if (!source) {
    throw new Error("The invoice is not available for printing. Open the invoice and try again.");
  }

  const frame = document.createElement("iframe");
  frame.title = "Invoice PDF print";
  frame.setAttribute("aria-hidden", "true");
  frame.setAttribute("tabindex", "-1");
  Object.assign(frame.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "1px",
    height: "1px",
    border: "0",
    opacity: "0",
    pointerEvents: "none",
  });
  document.body.appendChild(frame);

  const printWindow = frame.contentWindow;
  const printDocument = frame.contentDocument;
  if (!printWindow || !printDocument) {
    frame.remove();
    throw new Error("The browser could not prepare the invoice print document.");
  }

  let cleanupTimer = null;
  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    window.removeEventListener("afterprint", cleanup);
    printWindow.removeEventListener("afterprint", cleanup);
    if (cleanupTimer !== null) window.clearTimeout(cleanupTimer);
    frame.remove();
    onAfterPrint?.();
  };

  try {
    printDocument.open();
    printDocument.write("<!doctype html><html lang='en'><head><meta charset='utf-8'><title>Invoice</title></head><body></body></html>");
    printDocument.close();

    const base = printDocument.createElement("base");
    base.href = document.baseURI;
    printDocument.head.prepend(base);

    // Copy the app's existing stylesheets; no PDF library or duplicate invoice
    // template is required.
    const stylesheetLoads = [];
    document.querySelectorAll('link[rel="stylesheet"]').forEach((originalLink) => {
      const link = originalLink.cloneNode(true);
      link.href = new URL(originalLink.getAttribute("href") || originalLink.href, document.baseURI).href;
      stylesheetLoads.push(new Promise((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        link.addEventListener("load", finish, { once: true });
        link.addEventListener("error", finish, { once: true });
        printDocument.head.appendChild(link);
        if (link.sheet) finish();
        window.setTimeout(finish, 4000);
      }));
    });

    document.querySelectorAll("style").forEach((style) => {
      printDocument.head.appendChild(style.cloneNode(true));
    });

    const invoiceClone = source.cloneNode(true);
    printDocument.body.appendChild(invoiceClone);

    const invoiceNumber = source.querySelector(".inv-meta span strong")?.textContent?.trim() || "Invoice";
    const itemTables = Array.from(invoiceClone.querySelectorAll(".items-table"));
    const itemRowCount = itemTables.reduce(
      (total, table) => total + table.querySelectorAll("tbody tr").length,
      0,
    );

    // Repeated table headers identify the invoice on every printed page.
    itemTables.forEach((table) => {
      const header = table.tHead;
      if (!header) return;
      const columnCount = header.querySelectorAll("tr:last-child th").length || 1;
      const continuationRow = printDocument.createElement("tr");
      continuationRow.className = "nkj-pdf-repeat-header";
      const continuationCell = printDocument.createElement("th");
      continuationCell.colSpan = columnCount;
      continuationCell.textContent = `INVOICE ${invoiceNumber}  •  ITEM DETAILS`;
      continuationRow.appendChild(continuationCell);
      header.insertBefore(continuationRow, header.firstChild);
    });

    // Very long item lists use a continuous vertical flow so the table can
    // paginate naturally instead of forcing a tall CSS grid onto one sheet.
    if (itemRowCount > 8) {
      invoiceClone.classList.add("nkj-pdf-long-invoice");
    }

    // cloneNode does not copy current DOM properties for form controls.
    const originalControls = source.querySelectorAll("input, textarea, select");
    const clonedControls = invoiceClone.querySelectorAll("input, textarea, select");
    originalControls.forEach((control, index) => {
      const clone = clonedControls[index];
      if (!clone) return;
      if (control instanceof HTMLInputElement) {
        clone.value = control.value;
        clone.checked = control.checked;
      } else if (control instanceof HTMLTextAreaElement) {
        clone.value = control.value;
      } else if (control instanceof HTMLSelectElement) {
        clone.value = control.value;
      }
    });

    const printStyle = printDocument.createElement("style");
    printStyle.textContent = `
      @page {
        size: A4 portrait;
        margin: 8mm;
      }

      @media print {
        html,
        body {
          width: 194mm !important;
          min-width: 0 !important;
          max-width: 194mm !important;
          height: auto !important;
          min-height: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: visible !important;
          background: #fff !important;
        }

        body:has(#invoice-print) #invoice-print {
          display: block !important;
          position: relative !important;
          inset: auto !important;
          width: 291mm !important;
          min-width: 291mm !important;
          max-width: 291mm !important;
          height: auto !important;
          min-height: 0 !important;
          max-height: none !important;
          margin: 0 !important;
          padding: 2mm !important;
          box-sizing: border-box !important;
          zoom: 0.6666667 !important;
          transform: none !important;
          rotate: none !important;
          translate: none !important;
          overflow: visible !important;
          background: #fff !important;
          border: 0.35mm solid #c98a2a !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          break-inside: auto !important;
          page-break-inside: auto !important;
        }

        #invoice-print .invoice-actions,
        #invoice-print .nkj-invoice-detail-actions,
        #invoice-print .no-print,
        #invoice-print button,
        #invoice-print .icon-btn {
          display: none !important;
        }

        #invoice-print .table-wrap {
          width: 100% !important;
          max-width: 100% !important;
          overflow: visible !important;
        }

        #invoice-print table,
        #invoice-print .items-table,
        #invoice-print .new-items-table,
        #invoice-print .old-items-table {
          width: 100% !important;
          min-width: 0 !important;
          max-width: 100% !important;
          table-layout: fixed !important;
        }

        #invoice-print .items-table thead {
          display: table-header-group !important;
        }

        #invoice-print .items-table tbody {
          break-inside: auto !important;
          page-break-inside: auto !important;
        }

        #invoice-print .items-table tr {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }

        #invoice-print .ornament-panel {
          break-inside: auto !important;
          page-break-inside: auto !important;
        }

        #invoice-print .items-table .nkj-pdf-repeat-header th {
          display: table-cell !important;
          padding: 0.7mm 1mm !important;
          background: #fff7e8 !important;
          color: #7a1029 !important;
          font: 700 7pt/1.1 Georgia, "Times New Roman", serif !important;
          text-align: left !important;
          letter-spacing: 0.2px !important;
        }

        #invoice-print.nkj-pdf-long-invoice .inv-main {
          display: block !important;
        }

        #invoice-print.nkj-pdf-long-invoice .inv-left {
          width: 100% !important;
          max-width: 100% !important;
        }

        #invoice-print.nkj-pdf-long-invoice .totals {
          width: 100% !important;
          min-width: 0 !important;
          max-width: 100% !important;
          margin-top: 2mm !important;
        }

        #invoice-print img {
          max-width: 100% !important;
          object-fit: contain !important;
        }

        #invoice-print .total-paid-row,
        #invoice-print .due-amount-row,
        #invoice-print .inv-head,
        #invoice-print .inv-two,
        #invoice-print .description-panel,
        #invoice-print .words-panel {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }

        /* Let ornament sections flow across pages while each table row stays intact. */
        #invoice-print .ornament-panel {
          break-inside: auto !important;
          page-break-inside: auto !important;
        }

        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
    `;
    printDocument.head.appendChild(printStyle);

    await Promise.all(stylesheetLoads);
    if (printDocument.fonts?.ready) {
      await Promise.race([
        printDocument.fonts.ready.catch(() => {}),
        new Promise((resolve) => window.setTimeout(resolve, 1500)),
      ]);
    }
    await Promise.all(Array.from(invoiceClone.querySelectorAll("img")).map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise((resolve) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", resolve, { once: true });
        window.setTimeout(resolve, 2500);
      });
    }));

    window.addEventListener("afterprint", cleanup, { once: true });
    printWindow.addEventListener("afterprint", cleanup, { once: true });
    cleanupTimer = window.setTimeout(cleanup, 5 * 60 * 1000);
    printWindow.focus();
    printWindow.print();
  } catch (error) {
    cleanup();
    throw error;
  }
}

export function InvoicePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [reloadResetPending, setReloadResetPending] = useState(() => isUnconsumedInvoiceReload());
  const editingInvoice = !reloadResetPending && location.state?.editInvoice
    ? parseInvoiceDetails(location.state.editInvoice)
    : null;
  const copiedInvoice = !reloadResetPending && location.state?.copyInvoice
    ? parseInvoiceDetails(location.state.copyInvoice)
    : null;
  const invoiceSeed = editingInvoice || copiedInvoice;
  const [isEditingSavedInvoice] = useState(() =>
    Boolean(location.state?.editInvoice?.id) && !isUnconsumedInvoiceReload()
  );
  const startingNewInvoice = location.state?.startNewInvoice === true;
  const [initialDraft] = useState(() =>
    reloadResetPending || invoiceSeed || startingNewInvoice ? null : readInvoiceDraft()
  );
  const [invoiceDate, setInvoiceDate] = useState(() =>
    invoiceSeed?.invoiceDate || initialDraft?.invoiceDate || getTodayIndiaDate()
  );
  const [showGstin, setShowGstin] = useState(() =>
    Boolean(invoiceSeed?.showGstin ?? initialDraft?.showGstin ?? true)
  );
  const maxInvoiceDate = getTodayIndiaDate();

  const copiedRows = (value, fallback) => {
    if (Array.isArray(value) && value.length) return value;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      } catch {}
    }
    return fallback;
  };

  const [customer, setCustomer] = useState(() => ({
    name: invoiceSeed?.customerName || invoiceSeed?.name || initialDraft?.customer?.name || "",
    mobile: invoiceSeed?.mobile || initialDraft?.customer?.mobile || "",
    address: invoiceSeed?.address || initialDraft?.customer?.address || "",
  }));

  const [paymentMode, setPaymentMode] = useState(() => invoiceSeed?.paymentMode || initialDraft?.paymentMode || "Cash");
  const [referenceNo, setReferenceNo] = useState(() => invoiceSeed?.referenceNo || initialDraft?.referenceNo || "");
  const [totalPaid, setTotalPaid] = useState(() => {
    if (isEditingSavedInvoice) {
      return String(invoiceSeed?.totalPaid ?? invoiceSeed?.paymentAmount ?? 0);
    }
    return initialDraft?.totalPaid === undefined || initialDraft?.totalPaid === null
      ? null
      : String(initialDraft.totalPaid);
  });
  const [newItems, setNewItems] = useState(() => copiedRows(invoiceSeed?.newItems, copiedRows(initialDraft?.newItems, [blankNew()])).map((x) => ({ ...blankNew(), ...x })));
  // Keep all entered/copied old-ornament rows, remove unused blank rows,
  // and always start with exactly one empty row at the end.
  const [oldItems, setOldItems] = useState(() => {
    const rows = copiedRows(invoiceSeed?.oldItems, copiedRows(initialDraft?.oldItems, [blankOld()])).map((x) => ({ ...blankOld(), ...x }));
    const enteredRows = rows.filter((row) =>
      String(row.description ?? "").trim() !== "" ||
      String(row.purity ?? "").trim() !== "" ||
      Number(row.pureWeight) > 0 ||
      Number(row.rate) > 0
    );
    return [...enteredRows, blankOld()];
  });
  const [discount, setDiscount] = useState(() => String(invoiceSeed?.discount ?? initialDraft?.discount ?? ""));
  const [gst, setGst] = useState(() => String(invoiceSeed?.gstPercent ?? initialDraft?.gst ?? 0));
  const [description, setDescription] = useState(() => invoiceSeed?.description || initialDraft?.description || "");
  const [saved, setSaved] = useState(false);
  const [draftRestored, setDraftRestored] = useState(() => Boolean(initialDraft));
  // Keep the draft's idempotency key when restoring it. The backend checks
  // that key and safely repairs a prior save's business date only when the
  // rest of the invoice payload is identical.
  const [idempotencyKey, setIdempotencyKey] = useState(() => initialDraft?.idempotencyKey || createInvoiceDraftKey());
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [invoiceNo, setInvoiceNo] = useState(() =>
    isEditingSavedInvoice ? String(invoiceSeed?.invoiceNo || "") : ""
  );
  const [invoiceId, setInvoiceId] = useState(() =>
    isEditingSavedInvoice ? invoiceSeed?.id ?? null : null
  );
  const [showInvoicePin, setShowInvoicePin] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [calculatorExpression, setCalculatorExpression] = useState("");
  const [calculatorResult, setCalculatorResult] = useState("");
  const [calculatorError, setCalculatorError] = useState("");
  const [isPrintPreparing, setIsPrintPreparing] = useState(false);
  const saveInProgressRef = useRef(false);
  const skipNextDraftPersistRef = useRef(false);

  const clearCalculator = () => {
    setCalculatorExpression("");
    setCalculatorResult("");
    setCalculatorError("");
  };

  const appendCalculatorToken = (token) => {
    setCalculatorError("");
    setCalculatorResult("");
    setCalculatorExpression((current) => {
      const operators = ["+", "−", "×", "÷"];
      const isOperator = operators.includes(token);
      const continuesResult = isOperator || token === "%";
      let next = calculatorResult !== ""
        ? (continuesResult ? calculatorResult : "")
        : current;
      const last = next.slice(-1);

      if (isOperator) {
        if (!next) return token === "−" ? token : "";
        if (operators.includes(last)) {
          if (next.length === 1 && last === "−" && token !== "−") return next;
          return next.slice(0, -1) + token;
        }
        return next + token;
      }

      if (token === ".") {
        const currentNumber = next.split(/[+−×÷*/()]/).pop() || "";
        if (currentNumber.includes(".")) return next;
        return next + (currentNumber ? "." : "0.");
      }

      if (token === "%") {
        if (!/[0-9.)]$/.test(next) || last === "%") return next;
        return next + token;
      }

      if (/^[0-9]$/.test(token)) return next + token;
      if (token === "(") return next + token;
      if (token === ")") return next + token;
      return next;
    });
  };

  const backspaceCalculator = () => {
    setCalculatorError("");
    setCalculatorResult("");
    setCalculatorExpression((current) => {
      const value = calculatorResult !== "" ? calculatorResult : current;
      return value.slice(0, -1);
    });
  };

  const calculateExpression = () => {
    try {
      const value = evaluateCalculatorExpression(calculatorExpression);
      const formatted = formatCalculatorValue(value);
      setCalculatorExpression(calculatorExpression);
      setCalculatorResult(formatted);
      setCalculatorError("");
    } catch (error) {
      setCalculatorResult("");
      setCalculatorError(error.message || "Unable to calculate this expression.");
    }
  };

  useEffect(() => {
    if (!calculatorOpen || isPrintPreparing) return undefined;

    const isEditableElement = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      return element.isContentEditable ||
        Boolean(element.closest("input, textarea, select, [contenteditable='true'], [role='textbox']"));
    };

    const onCalculatorKeyDown = (event) => {
      if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
      const key = event.key;
      // Escape always closes the popup, even when focus is currently in an
      // invoice field. All other calculator keys leave editable fields alone.
      if (key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setCalculatorOpen(false);
        setCalculatorError("");
        return;
      }
      if (isEditableElement(event.target) || isEditableElement(document.activeElement)) return;
      if (key === "Enter" || key === "=") {
        event.preventDefault();
        event.stopPropagation();
        calculateExpression();
        return;
      }
      if (key === "Backspace") {
        event.preventDefault();
        event.stopPropagation();
        backspaceCalculator();
        return;
      }
      if (key === "Delete") {
        event.preventDefault();
        event.stopPropagation();
        clearCalculator();
        return;
      }

      const mapped = key === "*" || key.toLowerCase() === "x" ? "×"
        : key === "/" ? "÷"
          : key === "-" ? "−"
            : key === "+" ? "+"
              : key;
      if (/^[0-9.]$/.test(mapped) || ["+", "−", "×", "÷", "%", "(", ")"].includes(mapped)) {
        event.preventDefault();
        event.stopPropagation();
        appendCalculatorToken(mapped);
      }
    };

    window.addEventListener("keydown", onCalculatorKeyDown, true);
    return () => window.removeEventListener("keydown", onCalculatorKeyDown, true);
  }, [calculatorOpen, isPrintPreparing, calculatorExpression, calculatorResult]);

  // Disable the browser print shortcut only while the New Invoice page is mounted.
  useEffect(() => {
    const blockInvoicePrintShortcut = (event) => {
      const isPrintShortcut = (event.ctrlKey || event.metaKey) &&
        (String(event.key).toLowerCase() === "p" || event.code === "KeyP");

      if (!isPrintShortcut) return;

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }
    };

    window.addEventListener("keydown", blockInvoicePrintShortcut, true);
    document.addEventListener("keydown", blockInvoicePrintShortcut, true);

    return () => {
      window.removeEventListener("keydown", blockInvoicePrintShortcut, true);
      document.removeEventListener("keydown", blockInvoicePrintShortcut, true);
    };
  }, []);

  const initialReloadResetHandledRef = useRef(false);

  useEffect(() => {
    const firstMountAfterReload = reloadResetPending && !initialReloadResetHandledRef.current;
    const explicitNewInvoice = !reloadResetPending && startingNewInvoice;

    if (firstMountAfterReload || explicitNewInvoice) {
      if (firstMountAfterReload) {
        // Mark the reload only after render. Keeping the state initializer
        // read-only makes this reliable under React Strict Mode.
        initialReloadResetHandledRef.current = true;
        markInvoiceReloadHandled();
        setReloadResetPending(false);
      }

      // A full browser reload must always start a blank invoice, even when
      // history.state still contains a copied invoice or a New Invoice flag.
      // Explicit New Invoice navigation uses the same reset path. Saved
      // database invoices and Invoice History are never modified here.
      try { window.localStorage.removeItem(INVOICE_DRAFT_STORAGE_KEY); } catch {}
      setInvoiceDate(getTodayIndiaDate());
      setShowGstin(true);
      setCustomer({ name: "", mobile: "", address: "" });
      setPaymentMode("Cash");
      setReferenceNo("");
      setTotalPaid(null);
      setNewItems([blankNew()]);
      setOldItems([blankOld()]);
      setDiscount("");
      setGst("0");
      setDescription("");
      setSaved(false);
      setDraftRestored(false);
      setIdempotencyKey(createInvoiceDraftKey());
      setError("");
      setSuccessMessage("");
      setInvoiceNo("");
      setInvoiceId(null);
      setShowInvoicePin(false);

      // Remove persisted router state so another refresh cannot reopen the
      // invoice that was previously copied or selected.
      navigate("/invoice", { replace: true, state: null });
      return;
    }

    // Do not process stale history.state while the initial reload reset is
    // waiting to be committed.
    if (reloadResetPending) return;

    if (location.state?.copyInvoice || location.state?.editInvoice) {
      navigate("/invoice", { replace: true, state: null });
    }
  }, [location.key, startingNewInvoice, location.state, navigate, reloadResetPending]);

  useEffect(() => {
    if (saved) {
      try { window.localStorage.removeItem(INVOICE_DRAFT_STORAGE_KEY); } catch {}
      return;
    }
    if (skipNextDraftPersistRef.current) {
      skipNextDraftPersistRef.current = false;
      return;
    }
    const draft = {
      version: 1,
      idempotencyKey,
      invoiceDate,
      customer,
      paymentMode,
      referenceNo,
      totalPaid,
      newItems,
      oldItems,
      discount,
      gst,
      description,
      showGstin,
      savedAt: new Date().toISOString(),
    };
    try {
      window.localStorage.setItem(INVOICE_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // The invoice remains usable when browser storage is unavailable or full.
    }
  }, [invoiceDate, customer, paymentMode, referenceNo, totalPaid, newItems, oldItems, discount, gst, description, showGstin, idempotencyKey, saved]);

  const newTotal = newItems.reduce((sum, item) => sum + newAmt(item), 0);

  const oldTotal = oldItems.reduce((sum, item) => sum + oldAmt(item), 0);

  const makingTotal = newItems.reduce(
    (sum, item) => sum + (+item.makingCharge || 0),

    0,
  );

  const stampTotal = newItems.reduce(
    (sum, item) => sum + (+item.stampCharge || 0),

    0,
  );

  const extraTotal = newItems.reduce(
    (sum, item) => sum + (+item.extraCharge || 0),

    0,
  );

  const discountValue = Math.min(newTotal, Math.max(0, +discount || 0));

  // GST applies only when the invoice's GSTIN/GST visibility option is ON.
  // Keep the entered GST percentage in state so turning the option back ON
  // immediately restores the correct calculation.
  const tax = showGstin ? (newTotal * (+gst || 0)) / 100 : 0;

  // Discount deducted after GST calculation

  const grand = Math.max(0, newTotal + tax - discountValue - oldTotal);
  const totalPaidValue = totalPaid === null
    ? grand
    : Math.max(0, Number(totalPaid) || 0);
  const dueAmount = Math.max(0, grand - totalPaidValue);

  // Update only the field being edited. Description and purity never
  // change or auto-fill the Rate / GM field.
  const update = (setter, _items, i, key, val) => {
    if (setter === setNewItems) setError("");
    setter((current) =>
      current.map((item, rowIndex) =>
        rowIndex === i ? { ...item, [key]: val } : item,
      ),
    );
  };

  const numberProps = {
    type: "number",

    min: "0",

    onWheel: (e) => e.currentTarget.blur(),
  };

  const hasNewItemDetails = newItems.some((row) =>
    rowHasAnyInput(row, ["description", "purity", "netWeight", "rate", "makingCharge", "stampCharge", "extraCharge"]),
  );
  const hasOldItemDetails = oldItems.some((row) =>
    rowHasAnyInput(row, ["description", "purity", "pureWeight", "rate"]),
  );

  // Add the next row only after the current last row has at least one detail.
  const addNewOrnamentRow = (event) => {
    event?.preventDefault();
    event?.stopPropagation();

    const previousRow = newItems[newItems.length - 1];
    const hasPreviousRowDetail = rowHasAnyInput(previousRow, [
      "description",
      "purity",
      "netWeight",
      "rate",
      "makingCharge",
      "stampCharge",
      "extraCharge",
    ]);

    if (!hasPreviousRowDetail) {
      setError("Please enter details in the previous ornament row");
      return;
    }

    setError("");
    setNewItems((current) => [...current, blankNew()]);
  };

  // Add an old/exchange row only when the current last row has at least
  // one meaningful detail. Zero weight/rate values do not count as details.
  const addOldOrnamentRow = (event) => {
    event?.preventDefault();
    event?.stopPropagation();

    const previousRow = oldItems[oldItems.length - 1];
    const hasPreviousRowDetail =
      String(previousRow?.description ?? "").trim() !== "" ||
      String(previousRow?.purity ?? "").trim() !== "" ||
      Number(previousRow?.pureWeight) > 0 ||
      Number(previousRow?.rate) > 0;

    if (!hasPreviousRowDetail) {
      setError("Please enter at least one detail in the previous old ornament row before adding another row.");
      return;
    }

    setError("");
    setOldItems((current) => [...current, blankOld()]);
  };
  const removeNewOrnamentRow = (index) => setNewItems((current) => {
    const next = current.filter((_, rowIndex) => rowIndex !== index);
    return next.length ? next : [blankNew()];
  });
  const removeOldOrnamentRow = (index) => setOldItems((current) => {
    const next = current.filter((_, rowIndex) => rowIndex !== index);
    return next.length ? next : [blankOld()];
  });

  function buildInvoicePayload() {
    return {
      invoiceDate,
      showGstin,
      customerName: customer.name,
      mobile: customer.mobile,
      address: customer.address,
      paymentMode,
      referenceNo,
      description,
      // Preserve every displayed row, including intentionally blank rows.
      newItems,
      oldItems,
      newTotal,
      oldTotal,
      makingCharge: makingTotal,
      extraCharge: stampTotal + extraTotal,
      discount: discountValue,
      subTotal: newTotal,
      gstPercent: +gst || 0,
      gstAmount: tax,
      otherCharge: 0,
      grandTotal: grand,
      totalPaid: totalPaidValue,
      dueAmount,
      // Reuse the existing initial-collection payment and Cashbook workflow.
      // Editing a saved invoice must never create another receipt.
      paymentAmount: isEditingSavedInvoice ? undefined : totalPaidValue,
    };
  }

  function discardDraft() {
    if (saved || saving) return;
    if (!window.confirm("Discard this unfinished invoice draft? This cannot be undone.")) return;

    skipNextDraftPersistRef.current = true;
    try { window.localStorage.removeItem(INVOICE_DRAFT_STORAGE_KEY); } catch {}
    setInvoiceDate(getTodayIndiaDate());
    setShowGstin(true);
    setCustomer({ name: "", mobile: "", address: "" });
    setPaymentMode("Cash");
    setReferenceNo("");
    setTotalPaid(null);
    setNewItems([blankNew()]);
    setOldItems([blankOld()]);
    setDiscount("");
    setGst("0");
    setDescription("");
    setSuccessMessage("");
    setInvoiceNo("");
    setInvoiceId(null);
    setIdempotencyKey(createInvoiceDraftKey());
    setDraftRestored(false);
    setError("");
  }

  function validateInvoiceForm() {
    if (!invoiceDate) return "Please select an invoice date.";
    if (invoiceDate > maxInvoiceDate) return "Invoice date cannot be in the future.";
    if (!customer.name.trim()) return "Please enter customer name.";
    if (customer.mobile && !/^[0-9]{10}$/.test(customer.mobile)) {
      return "Please enter a valid 10-digit Indian mobile number using digits 0-9 only.";
    }
    if (!hasNewItemDetails && !hasOldItemDetails) {
      return "Enter at least one ornament detail before saving the invoice.";
    }

    const hasInvalidNumber = (row, fields) => fields.some((field) => {
      const raw = String(row?.[field] ?? "").trim();
      return raw !== "" && (!Number.isFinite(Number(raw)) || Number(raw) < 0);
    });
    const invalidNewItem = newItems.some((row) =>
      rowHasAnyInput(row, ["description", "purity", "netWeight", "rate", "makingCharge", "stampCharge", "extraCharge"]) &&
      hasInvalidNumber(row, ["netWeight", "rate", "makingCharge", "stampCharge", "extraCharge"]),
    );
    if (invalidNewItem) return "New ornament weights, rates, and charges must be valid non-negative numbers.";

    const invalidOldItem = oldItems.some((row) =>
      rowHasAnyInput(row, ["description", "purity", "pureWeight", "rate"]) &&
      hasInvalidNumber(row, ["pureWeight", "rate"]),
    );
    if (invalidOldItem) return "Old ornament weights and rates must be valid non-negative numbers.";

    for (const [label, value] of [["GST", gst], ["Discount", discount], ["Total Paid", totalPaid === null ? "" : totalPaid]]) {
      const raw = String(value ?? "").trim();
      if (raw !== "" && (!Number.isFinite(Number(raw)) || Number(raw) < 0)) {
        return `${label} must be a valid non-negative number.`;
      }
    }
    if (!isEditingSavedInvoice && totalPaidValue > grand + 0.005) {
      return "Total Paid cannot be greater than the Grand Total.";
    }
    return "";
  }

  async function persistInvoice() {
    if (saved && invoiceId) return { id: invoiceId, invoiceNo };
    if (saveInProgressRef.current) return null;

    setError("");
    setSuccessMessage("");
    const validationError = validateInvoiceForm();
    if (validationError) {
      setError(validationError);
      return null;
    }

    saveInProgressRef.current = true;
    setSaving(true);
    try {
      // Preflight before POST. Older deployed backends ignored invoiceDate
      // and generated the invoice date/number from createdAt, which could
      // persist an incorrect invoice even though the UI later detected it.
      let dateSupport = null;
      let dateSupportRequestFailed = false;
      try {
        dateSupport = await request("/invoices/date-support", {
          publicRequest: true,
          suppressSessionExpiry: true,
        });
      } catch {
        dateSupportRequestFailed = true;
      }

      const supportsBackdatedInvoices =
        !dateSupportRequestFailed &&
        dateSupport?.invoiceDateSupported === true &&
        dateSupport?.apiVersion === "backdated-invoice-date-v1";
      const supportsInvoiceGstinVisibility =
        !dateSupportRequestFailed &&
        dateSupport?.invoiceGstinVisibilitySupported === true;
      const selectedDateIsToday = invoiceDate === getTodayIndiaDate();

      if (!supportsInvoiceGstinVisibility) {
        throw new Error(
          "Per-invoice GSTIN visibility is not enabled on the connected backend. No invoice was submitted. Deploy the updated Spring Boot backend and apply Flyway migration V12, then retry."
        );
      }

      // Keep the existing safe fallback for today's invoices when an older
      // backend is still deployed; backdated dates remain protected.
      if (!supportsBackdatedInvoices && !selectedDateIsToday) {
        throw new Error(
          "Backdated invoice saving is not enabled on the connected backend. No invoice was submitted. Deploy the updated Spring Boot backend with Flyway migration V11, then retry this same draft. Today's invoices can still be saved using the existing backend."
        );
      }

      const invoicePayload = JSON.stringify(buildInvoicePayload());
      const result = isEditingSavedInvoice && invoiceId
        ? await request(`/invoices/${invoiceId}`, {
            method: "PUT",
            body: invoicePayload,
          })
        : await request("/invoices", {
            method: "POST",
            headers: { "Idempotency-Key": idempotencyKey },
            body: invoicePayload,
          });
      if (!result?.id || !result?.invoiceNo) {
        throw new Error("The server did not confirm a saved invoice ID and number. Nothing will be printed or downloaded. Your draft is still available.");
      }
      if (result.showGstin !== showGstin) {
        throw new Error("The server did not confirm the selected GSTIN visibility setting. Check the backend migration and reopen Invoice History before retrying.");
      }
      const expectedDatePart = invoiceDate.slice(8, 10) + invoiceDate.slice(5, 7) + invoiceDate.slice(2, 4);
      const invoiceNumberMatchesDate = result.invoiceNo.startsWith(`NKJ-${expectedDatePart}-`);
      if (result.invoiceDate !== invoiceDate || !invoiceNumberMatchesDate) {
        throw new Error(
          `Invoice date confirmation mismatch. You selected ${formatInvoiceDateForDisplay(invoiceDate)}, but the server returned ${formatInvoiceDateForDisplay(result.invoiceDate)} with invoice number ${result.invoiceNo}. Check Invoice History before retrying; the server may already have saved this request.`
        );
      }
      setInvoiceId(result.id);
      setInvoiceNo(result.invoiceNo);
      setSaved(true);
      window.dispatchEvent(new Event("nkj:customers-updated"));
      setDraftRestored(false);
      setShowInvoicePin(false);
      setSuccessMessage(`Invoice ${result.invoiceNo} ${isEditingSavedInvoice ? "updated" : "saved"} successfully. It is now available in Invoice History.`);
      return result;
    } catch (e) {
      setError(e.message || "Could not save the invoice. Printing and PDF download have been stopped; your draft is still available.");
      return null;
    } finally {
      saveInProgressRef.current = false;
      setSaving(false);
    }
  }

  async function save() {
    await persistInvoice();
  }

  async function requestPrintPin() {
    setCalculatorOpen(false);
    setIsPrintPreparing(true);
    setError("");
    const result = await persistInvoice();
    if (!result?.id || !result?.invoiceNo) {
      setIsPrintPreparing(false);
      return;
    }

    // persistInvoice returns the existing ID for a saved invoice and only
    // creates a database record for an unsaved draft. Never POST again on reprint.
    setInvoiceId(result.id);
    setInvoiceNo(result.invoiceNo);
    setSuccessMessage(`Invoice ${result.invoiceNo} is saved. Verify the invoice security PIN to print or save as PDF.`);
    setShowInvoicePin(true);
  }

  async function printCurrentInvoice(ticket) {
    try {
      await request("/invoices/consume-print-ticket", {
        method: "POST",
        body: JSON.stringify({ ticket, invoiceId }),
      });
      setShowInvoicePin(false);
      window.setTimeout(() => {
        printInvoiceAsPdf({ onAfterPrint: () => setIsPrintPreparing(false) }).catch((error) => {
          setIsPrintPreparing(false);
          setError(error.message || "Could not prepare the invoice PDF.");
        });
      }, 120);
    } catch (error) {
      setShowInvoicePin(false);
      setIsPrintPreparing(false);
      setError(error.message || "Could not authorize invoice printing.");
    }
  }

  const now = new Date();

  const time = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",

    minute: "2-digit",
  });

  return (
    <Page active="invoice">
      <div className="page-title no-print">
        <div>
          <span className="eyebrow">BILLING</span>

          <h2>{isEditingSavedInvoice ? "Edit Invoice" : "Create New Invoice"}</h2>
        </div>

        <Link to="/" className="secondary">
          <ArrowLeft /> Home
        </Link>
      </div>

      <div className="nkj-invoice-toolbar no-print">
        <label className="nkj-gstin-toggle">
          <input
            type="checkbox"
            checked={showGstin}
            disabled={saving || saved}
            onChange={(event) => setShowGstin(event.target.checked)}
            aria-label="Show GSTIN on Invoice"
          />
          <span>Show GSTIN on Invoice</span>
          <strong>{showGstin ? "ON" : "OFF"}</strong>
        </label>
        {isEditingSavedInvoice && invoiceNo && (
          <span className="nkj-editing-invoice-note">Editing {invoiceNo}</span>
        )}
        {!isPrintPreparing && (
          <div className="nkj-invoice-calculator-anchor no-print">
            <button
              type="button"
              className="nkj-calculator-trigger"
              onClick={() => {
                setCalculatorOpen((open) => !open);
                setCalculatorError("");
              }}
              aria-label={calculatorOpen ? "Close calculator" : "Open manual calculator"}
              aria-expanded={calculatorOpen}
              aria-haspopup="dialog"
              title="Manual calculator"
            >
              <CalculatorIcon size={19} />
              <span>Calculator</span>
            </button>

            {calculatorOpen && (
              <section
                className="nkj-invoice-calculator-popup no-print"
                role="dialog"
                aria-label="Manual calculator"
                aria-modal="false"
              >
                <header className="nkj-calculator-heading">
                  <div>
                    <CalculatorIcon size={17} />
                    <strong>Manual Calculator</strong>
                  </div>
                  <button
                    type="button"
                    className="nkj-calculator-close"
                    onClick={() => {
                      setCalculatorOpen(false);
                      setCalculatorError("");
                    }}
                    aria-label="Close calculator"
                    title="Close"
                  >
                    <X size={18} />
                  </button>
                </header>

                <div className="nkj-calculator-display" aria-live="polite" aria-atomic="true">
                  <div className="nkj-calculator-expression">{calculatorExpression || "Enter calculation"}</div>
                  <div className={`nkj-calculator-value${calculatorError ? " has-error" : ""}`}>
                    {calculatorError || calculatorResult || calculatorExpression || "0"}
                  </div>
                </div>

                <div className="nkj-calculator-keypad">
                  {["AC", "⌫", "%", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "0", ".", "="].map((key) => (
                    <button
                      type="button"
                      key={key}
                      className={`nkj-calc-key${["÷", "×", "−", "+"].includes(key) ? " is-operator" : ""}${key === "=" ? " is-equals" : ""}${key === "AC" || key === "⌫" ? " is-utility" : ""}`}
                      onClick={() => {
                        if (key === "AC") clearCalculator();
                        else if (key === "⌫") backspaceCalculator();
                        else if (key === "=") calculateExpression();
                        else appendCalculatorToken(key);
                      }}
                      aria-label={key === "⌫" ? "Backspace" : key === "AC" ? "Clear calculator" : key}
                    >
                      {key}
                    </button>
                  ))}
                </div>
                <p className="nkj-calculator-hint">Keyboard: 0–9, +, −, *, /, %, Enter, Backspace, Delete, Esc</p>
              </section>
            )}
          </div>
        )}
      </div>

      <div className="invoice-sheet" id="invoice-print">
        <header className="inv-head">
          <div className="inv-logo-wrap">
            <img
              className="invoice-logo-image"
              src="/nkj-logo-reference.png"
              alt="Nandikishor Jewellery Works logo"
            />
          </div>

          <div className="inv-shop">
            <h1>NANDIKISHOR JEWELLERY WORKS</h1>

 
            <h3>Owner : Bhuteswar Rana</h3>

            <b>Contact No. : 99322770722 |  8116022248</b>

            <p>Sasra, Gopiballavpur, Jhargram, Pin - 721506</p>

            <strong>Gold & Silver Ornaments</strong>
            {showGstin && (
              <small className="invoice-gstin">
                GSTIN No: 19ABCDE1234F1Z5
              </small>
            )}
          
          </div>
          
          <div className="inv-meta">
            <b>INVOICE</b>

            <span>
              <label>Invoice No.</label>

              <strong>{invoiceNo || "Auto-generated on save"}</strong>
            </span>

            <span>
              <label>Date</label>

              <strong>
                {saved || isEditingSavedInvoice ? (
                  formatInvoiceDateForDisplay(invoiceDate)
                ) : (
                  <input
                    className="invoice-date-input"
                    type="date"
                    value={invoiceDate}
                    max={maxInvoiceDate}
                    disabled={saving || isEditingSavedInvoice}
                    onChange={(e) => {
                      setInvoiceDate(e.target.value);
                      setError("");
                    }}
                    aria-label="Invoice Date"
                  />
                )}
              </strong>
            </span>

            <span>
              <label>Time</label>

              <strong>{time}</strong>
            </span>
          </div>
        </header>

        <div className="inv-two">
          <section className="inv-panel">
            <h3>Customer Details</h3>

            <div className="form-grid">
              <label>
                <span>Customer Name</span>

                <i>:</i>

                <input
                  value={customer.name}
                  onChange={(e) =>
                    setCustomer({ ...customer, name: e.target.value })
                  }
                  placeholder="Customer name"
                />
              </label>

              <label>
                <span>Mobile No.</span>

                <i>:</i>

                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  maxLength={10}
                  value={customer.mobile}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^0-9]/g, "");
                    setCustomer({ ...customer, mobile: digits });
                    setError("");
                  }}
                  onPaste={(e) => {
                    const pastedDigits = e.clipboardData.getData("text").replace(/[^0-9]/g, "");
                    if (pastedDigits.length > 10) {
                      e.preventDefault();
                      setError("Paste only the 10-digit mobile number without country code.");
                      return;
                    }
                    e.preventDefault();
                    setCustomer({ ...customer, mobile: pastedDigits });
                    setError("");
                  }}
                  placeholder="10-digit mobile number"
                  aria-label="10-digit mobile number"
                />
              </label>

              <label>
                <span>Address</span>

                <i>:</i>

                <input
                  value={customer.address}
                  onChange={(e) =>
                    setCustomer({ ...customer, address: e.target.value })
                  }
                  placeholder="Address"
                />
              </label>
            </div>
          </section>

          <section className="inv-panel">
            <h3>Payment Details</h3>

            <div className="form-grid">
              <label>
                <span>Payment Mode</span>

                <i>:</i>

                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                >
                  {["Cash", "UPI", "Card", "Bank Transfer", "Other"].map(
                    (x) => (
                      <option key={x}>{x}</option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>Reference No.</span>

                <i>:</i>

                <input
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  placeholder="Optional transaction reference"
                />
              </label>
            </div>
          </section>
        </div>

        <div className="inv-main">
          <div className="inv-left">
            <section className="inv-panel ornament-panel">
              <h3>
                <Diamond size={18} /> New Ornaments Details
              </h3>

              <div className="table-wrap">
                <table className="items-table new-items-table">
                  <thead>
                    <tr>
                      {[
                        "Sl. No.",

                        "Description",

                        "Purity",

                        "Net Wt. (gm)",

                        "Rate / GM (₹)",

                        "Making (₹)",

                        "Stamp (₹)",

                        "Extra (₹)",

                        "Amount (₹)",

                        "",
                      ].map((x) => (
                        <th key={x}>{x}</th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {newItems.map((x, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>

                        <td>
                          <input
                            value={x.description}
                            onChange={(e) =>
                              update(
                                setNewItems,

                                newItems,

                                i,

                                "description",

                                e.target.value,
                              )
                            }
                            placeholder="Description"
                          />
                        </td>

                        <td>
                          <input
                            value={x.purity}
                            onChange={(e) =>
                              update(
                                setNewItems,

                                newItems,

                                i,

                                "purity",

                                e.target.value,
                              )
                            }
                            placeholder="e.g. 22K / 916"
                          />
                        </td>

                        <td>
                          <input
                            {...numberProps}
                            step="0.001"
                            value={x.netWeight}
                            onChange={(e) =>
                              update(
                                setNewItems,

                                newItems,

                                i,

                                "netWeight",

                                e.target.value,
                              )
                            }
                            placeholder="0.00"
                          />
                        </td>

                        <td>
                          <input
                            {...numberProps}
                            value={x.rate}
                            onChange={(e) =>
                              update(
                                setNewItems,

                                newItems,

                                i,

                                "rate",

                                e.target.value,
                              )
                            }
                            placeholder="0.00"
                          />
                        </td>

                        <td>
                          <input
                            {...numberProps}
                            value={x.makingCharge}
                            onChange={(e) =>
                              update(
                                setNewItems,

                                newItems,

                                i,

                                "makingCharge",

                                e.target.value,
                              )
                            }
                            placeholder="0.00"
                          />
                        </td>

                        <td>
                          <input
                            {...numberProps}
                            value={x.stampCharge}
                            onChange={(e) =>
                              update(
                                setNewItems,

                                newItems,

                                i,

                                "stampCharge",

                                e.target.value,
                              )
                            }
                            placeholder="0.00"
                          />
                        </td>

                        <td>
                          <input
                            {...numberProps}
                            value={x.extraCharge}
                            onChange={(e) =>
                              update(
                                setNewItems,

                                newItems,

                                i,

                                "extraCharge",

                                e.target.value,
                              )
                            }
                            placeholder="0.00"
                          />
                        </td>

                        <td>{money(newAmt(x))}</td>

                        <td className="no-print">
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={`Remove new ornament row ${i + 1}`}
                            onClick={() => removeNewOrnamentRow(i)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="row-end">
                <button
                  type="button"
                  className="small-action no-print"
                  onClick={addNewOrnamentRow}
                >
                  + Add Ornament
                </button>

                <b>
                  Total New Ornaments Amount :{" "}
                  <strong>₹ {money(newTotal)}</strong>
                </b>
              </div>
            </section>

            <section className="inv-panel ornament-panel old-panel">
              <h3>
                <ArrowLeftRight size={18} /> Old / Exchange Ornaments Details
              </h3>

              <div className="table-wrap">
                <table className="items-table old-items-table">
                  <thead>
                    <tr>
                      {[
                        "Sl. No.",

                        "Description",

                        "Purity",

                        "Wt. (gm)",

                        "Rate / GM (₹)",

                        "Amount (₹)",

                        "",
                      ].map((x) => (
                        <th key={x}>{x}</th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {oldItems.map((x, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>

                        <td>
                          <input
                            value={x.description}
                            onChange={(e) =>
                              update(
                                setOldItems,

                                oldItems,

                                i,

                                "description",

                                e.target.value,
                              )
                            }
                            placeholder="Description"
                          />
                        </td>

                        <td>
                          <input
                            value={x.purity}
                            onChange={(e) =>
                              update(
                                setOldItems,

                                oldItems,

                                i,

                                "purity",

                                e.target.value,
                              )
                            }
                            placeholder="e.g. 22k / 916"
                          />
                        </td>

                        <td>
                          <input
                            {...numberProps}
                            step="0.001"
                            value={x.pureWeight}
                            onChange={(e) =>
                              update(
                                setOldItems,

                                oldItems,

                                i,

                                "pureWeight",

                                e.target.value,
                              )
                            }
                            placeholder="0.00"
                          />
                        </td>

                        <td>
                          <input
                            {...numberProps}
                            value={x.rate}
                            onChange={(e) =>
                              update(
                                setOldItems,

                                oldItems,

                                i,

                                "rate",

                                e.target.value,
                              )
                            }
                            placeholder="0.00"
                          />
                        </td>

                        <td>{money(oldAmt(x))}</td>

                        <td className="no-print">
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={`Remove old ornament row ${i + 1}`}
                            onClick={() => removeOldOrnamentRow(i)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="row-end">
                <button
                  type="button"
                  className="small-action no-print"
                  onClick={addOldOrnamentRow}
                >
                  + Add Old Ornament
                </button>

                <b>
                  Total Old Value (₹) : <strong>₹ {money(oldTotal)}</strong>
                </b>
              </div>
            </section>
          </div>

          <aside className="totals second-reference-totals">
            {/* 1. SUB TOTAL */}

            <div className="total-row">
              <span>SUB TOTAL (₹)</span>

              <b>{money(newTotal)}</b>
            </div>

            {/* 2. GST AMOUNT */}

            {showGstin && (
              <div className="total-row">
                <span>
                  GST AMOUNT (₹){" "}
                  <small>
                    GST %{" "}
                    <input
                      className="gst-percent-input"
                      aria-label="GST percentage"
                      type="number"
                      min="0"
                      onWheel={(e) => e.currentTarget.blur()}
                      value={gst}
                      onChange={(e) => setGst(e.target.value)}
                    />
                  </small>
                </span>

                <b>{money(tax)}</b>
              </div>
            )}

            {/* 3. DISCOUNT */}

            <div className="total-row">
              <span>DISCOUNT (₹)</span>

              <b>
                <input
                  aria-label="Discount"
                  type="number"
                  min="0"
                  placeholder="0.00"
                  onWheel={(e) => e.currentTarget.blur()}
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </b>
            </div>

            {/* 4. OLD EXCHANGE */}

            <div className="total-row">
              <span>OLD EXCHANGE (₹)</span>

              <b>− {money(oldTotal)}</b>
            </div>

            {/* 5. GRAND TOTAL */}

            <div className="grand">
              <span>GRAND TOTAL (₹)</span>

              <b>{money(grand)}</b>
            </div>

            <div className="total-row total-paid-row">
              <span><Coins size={17} aria-hidden="true" /> TOTAL PAID (₹)</span>
              <b>
                <input
                  aria-label="Total Paid"
                  type="number"
                  min="0"
                  max={grand}
                  step="0.01"
                  value={totalPaid === null ? grand.toFixed(2) : totalPaid}
                  readOnly={isEditingSavedInvoice || saved}
                  onWheel={(event) => event.currentTarget.blur()}
                  onChange={(event) => setTotalPaid(event.target.value)}
                />
              </b>
            </div>

            <div className="total-row due-amount-row">
              <span><Clock3 size={17} aria-hidden="true" /> DUE AMOUNT (₹)</span>
              <b>{money(dueAmount)}</b>
            </div>
          </aside>
        </div>

        <div className="inv-bottom">
          <section className="inv-panel description-panel">
            <h3>✎ Additional Description :</h3>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </section>

          <section className="inv-panel words-panel">
            <h3>Amount in Words :</h3>

            <div className="words-sign">
              <div className="amount-words">{amountInWords(grand)}</div>

              <div className="signatures">
                <span>Customer Signature</span>

                <span>Authorised Signature</span>
              </div>
            </div>
          </section>
        </div>

        <div className="thankyou">
          <img
            className="flourish-img"
            src="/invoice-flourish-left.png"
            alt=""
          />

          <div>
            <i>Thank You</i>

            <b>Visit Again</b>
          </div>

          <img
            className="flourish-img"
            src="/invoice-flourish-right.png"
            alt=""
          />
        </div>
      </div>

      {error && <p className="error no-print" role="alert">{error}</p>}

      {successMessage && <p className="success no-print" role="status">{successMessage}</p>}
      {saving && <p className="draft-note no-print" role="status">Saving the complete invoice to PostgreSQL. Printing will start only after the server confirms the save.</p>}

      <div className="invoice-actions no-print">
        <button type="button" className="primary" onClick={save} disabled={saving || saved}>
          <Save /> {saving ? (isEditingSavedInvoice ? "Updating..." : "Saving...") : saved ? (isEditingSavedInvoice ? "Invoice Updated" : "Invoice Saved") : (isEditingSavedInvoice ? "Update Invoice" : "Save Invoice")}
        </button>

        <button
          type="button"
          className="secondary"
          onClick={requestPrintPin}
          disabled={saving || showInvoicePin}
          title="Save this invoice to PostgreSQL before opening Print or Save as PDF"
        >
          <Printer /> {saving ? "Saving..." : "Print Invoice / Save as PDF"}
        </button>

      </div>
      {!saved && (
        <p className="draft-note no-print" role="status">
          {draftRestored
            ? "An unfinished draft was restored during in-app navigation. Refreshing this page clears the draft."
            : "Unsaved invoice: refreshing this page clears these details. Select Save Invoice to keep it in Invoice History."}
        </p>
      )}
      {showInvoicePin && (
        <InvoicePinDialog
          invoiceId={invoiceId}
          onClose={() => {
            setShowInvoicePin(false);
            setIsPrintPreparing(false);
          }}
          onVerified={printCurrentInvoice}
          title="Authorize saved invoice printing"
        />
      )}
    </Page>
  );
}


function displaySavedInvoiceDate(value) {
  if (!value) return "—";
  const text = String(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : text;
}

function displaySavedInvoiceTime(value) {
  if (!value) return "—";
  const match = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return String(value);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const time = new Date(2000, 0, 1, hour, minute);
  return time.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Read-only version of the original invoice sheet.
 * It deliberately reuses the same invoice classes, structure, logo, ornament
 * columns, totals, signature area and A4 print stylesheet as InvoicePage.
 */
function SavedInvoicePrintSheet({ invoice }) {
  const data = parseInvoiceDetails(invoice);
  const newRows = invoiceRows(data.newItems);
  const oldRows = invoiceRows(data.oldItems);
  const calculatedNewTotal = newRows.reduce((sum, row) => sum + newAmt(row), 0);
  const calculatedOldTotal = oldRows.reduce((sum, row) => sum + oldAmt(row), 0);
  const showGstin = data.showGstin !== false;
  const newTotal = Number(data.newTotal ?? data.subTotal ?? calculatedNewTotal) || 0;
  const oldTotal = Number(data.oldTotal ?? calculatedOldTotal) || 0;
  const gstPercent = Number(data.gstPercent) || 0;
  const gstAmount = showGstin
    ? Number(data.gstAmount ?? (newTotal * gstPercent) / 100) || 0
    : 0;
  const discount = Number(data.discount) || 0;
  const grandTotal = Number(data.grandTotal ?? (newTotal + gstAmount - discount - oldTotal)) || 0;
  const totalPaid = Math.max(0, Number(data.totalPaid ?? data.paymentAmount ?? 0) || 0);
  const dueAmount = Math.max(0, grandTotal - totalPaid);
  const invoiceDate = displaySavedInvoiceDate(data.invoiceDate || data.date);
  const invoiceTime = displaySavedInvoiceTime(data.invoiceTime || data.time);

  return (
    <div className="invoice-sheet nkj-saved-invoice-sheet" id="invoice-print">
      <header className="inv-head">
        <div className="inv-logo-wrap">
          <img
            className="invoice-logo-image"
            src="/nkj-logo-reference.png"
            alt="Nandikishor Jewellery Works logo"
          />
        </div>

        <div className="inv-shop">
          <h1 id="invoice-detail-title">NANDIKISHOR JEWELLERY WORKS</h1>
          <h3>Owner : Bhuteswar Rana</h3>
          <b>Contact No. : 99322770722 | 8116022248</b>
          <p>Sasra, Gopiballavpur, Jhargram, Pin - 721506</p>
          <strong>Gold &amp; Silver Ornaments</strong>
          {showGstin && (
            <small className="invoice-gstin">
              GSTIN No: 19ABCDE1234F1Z5
            </small>
          )}
        </div>

        <div className="inv-meta">
          <b>INVOICE</b>
          <span><label>Invoice No.</label><strong>{data.invoiceNo || "—"}</strong></span>
          <span><label>Date</label><strong>{invoiceDate}</strong></span>
          <span><label>Time</label><strong>{invoiceTime}</strong></span>
        </div>
      </header>

      <div className="inv-two">
        <section className="inv-panel">
          <h3>Customer Details</h3>
          <div className="form-grid">
            <label>
              <span>Customer Name</span><i>:</i>
              <input value={data.customerName || data.name || ""} readOnly />
            </label>
            <label>
              <span>Mobile No.</span><i>:</i>
              <input value={data.mobile || ""} readOnly />
            </label>
            <label>
              <span>Address</span><i>:</i>
              <input value={data.address || ""} readOnly />
            </label>
          </div>
        </section>

        <section className="inv-panel">
          <h3>Payment Details</h3>
          <div className="form-grid">
            <label>
              <span>Payment Mode</span><i>:</i>
              <input value={data.paymentMode || "Cash"} readOnly />
            </label>
            <label>
              <span>Reference No.</span><i>:</i>
              <input value={data.referenceNo || ""} readOnly />
            </label>
          </div>
        </section>
      </div>

      <div className="inv-main">
        <div className="inv-left">
          <section className="inv-panel ornament-panel">
            <h3><Diamond size={18} /> New Ornaments Details</h3>
            <div className="table-wrap">
              <table className="items-table new-items-table">
                <thead>
                  <tr>
                    {["Sl. No.", "Description", "Purity", "Net Wt. (gm)", "Rate / GM (₹)", "Making (₹)", "Stamp (₹)", "Extra (₹)", "Amount (₹)", ""].map((label, index) => (
                      <th key={`${label}-${index}`}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {newRows.map((row, index) => (
                    <tr key={row.id ?? index}>
                      <td>{index + 1}</td>
                      <td><input value={row.description || ""} readOnly /></td>
                      <td><input value={row.purity || ""} readOnly /></td>
                      <td><input value={row.netWeight ?? ""} readOnly /></td>
                      <td><input value={row.rate ?? ""} readOnly /></td>
                      <td><input value={row.makingCharge ?? ""} readOnly /></td>
                      <td><input value={row.stampCharge ?? ""} readOnly /></td>
                      <td><input value={row.extraCharge ?? ""} readOnly /></td>
                      <td>{money(row.amount ?? newAmt(row))}</td>
                      <td className="no-print saved-invoice-empty-action" />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="row-end">
              <b>Total New Ornaments Amount : <strong>₹ {money(newTotal)}</strong></b>
            </div>
          </section>

          <section className="inv-panel ornament-panel old-panel">
            <h3><ArrowLeftRight size={18} /> Old / Exchange Ornaments Details</h3>
            <div className="table-wrap">
              <table className="items-table old-items-table">
                <thead>
                  <tr>
                    {["Sl. No.", "Description", "Purity", "Wt. (gm)", "Rate / GM (₹)", "Amount (₹)", ""].map((label, index) => (
                      <th key={`${label}-${index}`}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {oldRows.map((row, index) => (
                    <tr key={row.id ?? index}>
                      <td>{index + 1}</td>
                      <td><input value={row.description || ""} readOnly /></td>
                      <td><input value={row.purity || ""} readOnly /></td>
                      <td><input value={row.pureWeight ?? ""} readOnly /></td>
                      <td><input value={row.rate ?? ""} readOnly /></td>
                      <td>{money(row.amount ?? oldAmt(row))}</td>
                      <td className="no-print saved-invoice-empty-action" />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="row-end">
              <b>Total Old Value (₹) : <strong>₹ {money(oldTotal)}</strong></b>
            </div>
          </section>
        </div>

        <aside className="totals second-reference-totals">
          <div className="total-row">
            <span>SUB TOTAL (₹)</span>
            <b>{money(newTotal)}</b>
          </div>
          {showGstin && (
            <div className="total-row">
              <span>
                GST AMOUNT (₹) <small>GST % <input className="gst-percent-input" aria-label="GST percentage" value={gstPercent} readOnly /></small>
              </span>
              <b>{money(gstAmount)}</b>
            </div>
          )}
          <div className="total-row">
            <span>DISCOUNT (₹)</span>
            <b><input aria-label="Discount" value={discount > 0 ? discount.toFixed(2) : ""} placeholder="0.00" readOnly /></b>
          </div>
          <div className="total-row">
            <span>OLD EXCHANGE (₹)</span>
            <b>− {money(oldTotal)}</b>
          </div>
          <div className="grand">
            <span>GRAND TOTAL (₹)</span>
            <b>{money(grandTotal)}</b>
          </div>
          <div className="total-row total-paid-row">
            <span><Coins size={15} aria-hidden="true" /> TOTAL PAID (₹)</span>
            <b>{money(totalPaid)}</b>
          </div>
          <div className="total-row due-amount-row">
            <span><Clock3 size={15} aria-hidden="true" /> DUE AMOUNT (₹)</span>
            <b>{money(dueAmount)}</b>
          </div>
        </aside>
      </div>

      <div className="inv-bottom">
        <section className="inv-panel description-panel">
          <h3>✎ Additional Description :</h3>
          <textarea value={data.description || ""} readOnly />
        </section>
        <section className="inv-panel words-panel">
          <h3>Amount in Words :</h3>
          <div className="words-sign">
            <div className="amount-words">{amountInWords(grandTotal)}</div>
            <div className="signatures">
              <span>Customer Signature</span>
              <span>Authorised Signature</span>
            </div>
          </div>
        </section>
      </div>

      <div className="thankyou">
        <img className="flourish-img" src="/invoice-flourish-left.png" alt="" />
        <div><i>Thank You</i><b>Visit Again</b></div>
        <img className="flourish-img" src="/invoice-flourish-right.png" alt="" />
      </div>
    </div>
  );
}

export function SavedInvoices() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [showPrintPin, setShowPrintPin] = useState(false);

  // Disable Ctrl+P / Cmd+P only while a saved invoice detail is open.
  useEffect(() => {
    if (!selectedInvoice) return undefined;

    const blockSavedInvoicePrintShortcut = (event) => {
      const isPrintShortcut = (event.ctrlKey || event.metaKey) &&
        (String(event.key).toLowerCase() === "p" || event.code === "KeyP");

      if (!isPrintShortcut) return;

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }
    };

    window.addEventListener("keydown", blockSavedInvoicePrintShortcut, true);
    document.addEventListener("keydown", blockSavedInvoicePrintShortcut, true);

    return () => {
      window.removeEventListener("keydown", blockSavedInvoicePrintShortcut, true);
      document.removeEventListener("keydown", blockSavedInvoicePrintShortcut, true);
    };
  }, [selectedInvoice]);

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const data = await request("/invoices");
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e.message || "Could not load saved invoices.");
    } finally {
      setLoading(false);
    }
  };

  useRealtimeRefresh(load, ["invoices", "installments", "payments", "transactions", "cashbook", "dashboard", "reports", "customers"]);

  const openInvoiceDetails = async (invoice) => {
    setDetailLoading(true);
    setDetailError("");
    try {
      const fullRecord = invoice.id
        ? await request(`/invoices/${invoice.id}`)
        : invoice;
      setSelectedInvoice(parseInvoiceDetails(fullRecord));
    } catch (error) {
      setSelectedInvoice(parseInvoiceDetails(invoice));
      setDetailError(
        error.message || "Could not load the complete invoice record. Showing available saved data.",
      );
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) {
      navigate("/login", { replace: true });
      return;
    }
    load();
  }, [isAdmin, navigate]);

  useEffect(() => {
    const invoiceId = new URLSearchParams(location.search).get("invoiceId");
    if (!invoiceId || !items.length) return;
    const match = items.find((item) => String(item.id) === invoiceId);
    if (match) openInvoiceDetails(match);
  }, [location.search, items]);

  const searchText = q.trim().toLowerCase();
  const searchPhone = q.replace(/\D/g, "");
  const filtered = items.filter((x) => {
    const invoiceNo = String(x.invoiceNo || "").toLowerCase();
    const customerName = String(x.customerName || "").toLowerCase();
    const customerPhone = String(x.mobile || "").replace(/\D/g, "");
    return invoiceNo.includes(searchText) || customerName.includes(searchText) ||
      (searchPhone.length > 0 && customerPhone.includes(searchPhone));
  });

  const editSelectedInvoice = () => {
    if (!selectedInvoice?.id) {
      setDetailError("This saved invoice cannot be edited because its database ID is missing.");
      return;
    }
    if (!hasInvoiceLineItems(selectedInvoice)) {
      setDetailError("This older saved record has no ornament line items, so it cannot be edited as a complete invoice.");
      return;
    }
    const invoice = selectedInvoice;
    setSelectedInvoice(null);
    setShowPrintPin(false);
    navigate("/invoice", { state: { editInvoice: invoice } });
  };

  const copySelectedInvoice = () => {
    if (!selectedInvoice) return;
    if (!hasInvoiceLineItems(selectedInvoice)) {
      setDetailError("This saved record has no ornament line items. It can be printed or shared as a summary, but it cannot be copied as a complete invoice.");
      return;
    }
    const invoice = selectedInvoice;
    setSelectedInvoice(null);
    navigate("/invoice", { state: { copyInvoice: invoice } });
  };

  const closeInvoiceDetails = () => {
    setSelectedInvoice(null);
    setDetailError("");
    if (location.search) navigate("/saved-invoices", { replace: true });
  };

  const copyInvoiceToNew = async (invoice) => {
    setDetailLoading(true);
    setErr("");
    try {
      const fullRecord = invoice?.id
        ? await request(`/invoices/${invoice.id}`)
        : invoice;
      const copyData = parseInvoiceDetails(fullRecord);
      setDetailLoading(false);
      if (!hasInvoiceLineItems(copyData)) {
        setErr("This saved record has no ornament line items, so it cannot be copied as a complete invoice.");
        return;
      }
      navigate("/invoice", { state: { copyInvoice: copyData } });
    } catch (error) {
      setDetailLoading(false);
      setErr(error.message || "Could not load the complete invoice for copying.");
    }
  };

  const deleteInvoice = async (invoice) => {
    if (!invoice?.id) {
      setErr("This invoice cannot be deleted because its database ID is missing.");
      return;
    }
    const confirmed = window.confirm(
      `Delete invoice ${invoice.invoiceNo || ""}? This action cannot be undone.`,
    );
    if (!confirmed) return;

    const password = window.prompt("Enter the administrator password to confirm deletion:");
    if (password === null) return;
    if (!password.trim()) {
      setErr("Administrator password is required.");
      return;
    }

    setErr("");
    try {
      await request(`/invoices/${invoice.id}`, {
        method: "DELETE",
        body: JSON.stringify({ password }),
      });
      setItems((current) => current.filter((item) => item.id !== invoice.id));
      if (selectedInvoice?.id === invoice.id) closeInvoiceDetails();
    } catch (error) {
      setErr(error.message || "Could not delete the invoice.");
    }
  };

  if (!isAdmin) return null;

  const printSavedInvoice = async (ticket) => {
    if (!selectedInvoice?.id) {
      throw new Error("Open a saved invoice before printing.");
    }
    await request("/invoices/consume-print-ticket", {
      method: "POST",
      body: JSON.stringify({ ticket, invoiceId: selectedInvoice.id }),
    });
    setShowPrintPin(false);
    window.setTimeout(() => {
      printInvoiceAsPdf().catch((error) => {
        setErr(error.message || "Could not prepare the invoice PDF.");
      });
    }, 120);
  };

  const shareInvoiceOnWhatsApp = async () => {
    if (!selectedInvoice?.id) return;
    const invoiceNo = String(selectedInvoice.invoiceNo || "Invoice").replace(/[^a-zA-Z0-9_-]/g, "_");
    const file = new File(
      [createSavedInvoicePdf(selectedInvoice)],
      invoiceNo + ".pdf",
      { type: "application/pdf" },
    );

    // Native file sharing attaches the actual PDF to WhatsApp on supported devices.
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Invoice " + (selectedInvoice.invoiceNo || "") });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
        console.error("Native PDF sharing failed:", error);
      }
    }

    // Browsers without file-sharing support download the PDF for manual attachment.
    const objectUrl = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = file.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);

    const digits = String(selectedInvoice.mobile || "").replace(/\D/g, "");
    const normalizedDigits = digits.length === 11 && digits.startsWith("0") ? digits.slice(1) : digits;
    const phone = normalizedDigits.length === 10 ? "91" + normalizedDigits : normalizedDigits;
    window.open(phone ? "https://wa.me/" + phone : "https://wa.me/", "_blank", "noopener,noreferrer");
    window.alert("Your invoice PDF has been downloaded. In WhatsApp, open the chat and attach the downloaded PDF document.");
  };

  return (
    <Page active="saved">
      <div className="page-title">
        <div>
          <span className="eyebrow">RECORDS</span>
          <h2>Saved Invoices</h2>
        </div>
        <Link className="primary" to="/invoice" state={{ startNewInvoice: true }}><Plus /> New Invoice</Link>
      </div>

      <div className="nkj-saved-toolbar-row">
        <div className="toolbar">
          <Search />
          <input
            placeholder="Search by invoice number, customer name or phone"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

      </div>

      {err && <p className="error">{err}</p>}

      <div className="panel nkj-saved-panel">
        <div className="table-wrap">
          <table className="nkj-saved-table">
            <thead>
              <tr>
                <th>Invoice No.</th><th>Customer Name</th><th>Date</th>
                <th>Mobile</th><th>Amount (₹)</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((x, index) => (
                <tr key={x.id ?? x.invoiceNo ?? index}>
                  <td>{x.invoiceNo || "—"}</td>
                  <td>{x.customerName || "—"}</td>
                  <td>{displaySavedInvoiceDate(x.invoiceDate)}</td>
                  <td>{x.mobile || "—"}</td>
                  <td>₹ {money(x.grandTotal)}</td>
                  <td>
                    <div className="nkj-invoice-row-actions">
                      <button
                        className="small-action"
                        onClick={() => openInvoiceDetails(x)}
                        disabled={detailLoading}
                      >
                        <Eye size={15} /> Full Details
                      </button>
                      <button
                        className="small-action nkj-copy-action"
                        onClick={() => copyInvoiceToNew(x)}
                        disabled={detailLoading}
                      >
                        <Copy size={15} /> Copy Invoice
                      </button>
                      <button className="small-action nkj-delete-action" onClick={() => deleteInvoice(x)}>
                        <Trash2 size={15} /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !filtered.length && (
                <tr><td colSpan="6" className="empty">{q ? "No matching invoices found." : "No invoices saved yet."}</td></tr>
              )}
              {loading && <tr><td colSpan="6" className="empty">Loading saved invoices…</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {detailLoading && <p className="success" role="status">Loading complete invoice details…</p>}
      {selectedInvoice && (
        <div
          className="nkj-invoice-detail-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeInvoiceDetails();
          }}
        >
          <section
            className="nkj-invoice-detail-sheet nkj-full-invoice-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="invoice-detail-title"
          >
            <div className="nkj-invoice-detail-actions no-print">
              <button type="button" className="secondary" onClick={editSelectedInvoice}>
                <Pencil size={16} /> Edit Invoice
              </button>
              <button type="button" className="secondary" onClick={() => setShowPrintPin(true)}>
                <Printer size={16} /> Print / Save PDF
              </button>
              <button type="button" className="secondary nkj-whatsapp-action" onClick={shareInvoiceOnWhatsApp}>
                <MessageCircle size={16} /> Share via WhatsApp
              </button>
              <button type="button" className="primary" onClick={copySelectedInvoice}>
                <Copy size={16} /> Copy Invoice
              </button>
              <button type="button" className="nkj-modal-close" onClick={closeInvoiceDetails} aria-label="Close invoice details">
                <X size={20} />
              </button>
            </div>

            {detailError && <p className="error no-print">{detailError}</p>}
            {!hasInvoiceLineItems(selectedInvoice) && (
              <p className="nkj-detail-notice no-print">
                This older saved record does not contain ornament line items. The available saved values are shown below; missing rows cannot be reconstructed from totals alone.
              </p>
            )}
            <SavedInvoicePrintSheet invoice={selectedInvoice} />
          </section>
        </div>
      )}
      {showPrintPin && <InvoicePinDialog invoiceId={selectedInvoice?.id} onClose={() => setShowPrintPin(false)} onVerified={printSavedInvoice} title="Authorize saved invoice printing" />}
    </Page>
  );
}
