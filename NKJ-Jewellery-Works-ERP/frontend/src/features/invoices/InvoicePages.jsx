
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
  X,
  MessageCircle,
  Printer,
  Search,
  RefreshCw,
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
} from "lucide-react";


import { request } from "../../core/api/client";

import { useAuth } from "../../core/auth/AuthProvider";
import InvoicePinDialog from "../../shared/components/InvoicePinDialog";
import { Page } from "../../shared/layouts/OwnerShell";
import { money } from "../../shared/utils/formatters";

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

export function InvoicePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const copiedInvoice = location.state?.copyInvoice
    ? parseInvoiceDetails(location.state.copyInvoice)
    : null;
  const [initialDraft] = useState(() => copiedInvoice ? null : readInvoiceDraft());

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
    name: copiedInvoice?.customerName || copiedInvoice?.name || initialDraft?.customer?.name || "",
    mobile: copiedInvoice?.mobile || initialDraft?.customer?.mobile || "",
    address: copiedInvoice?.address || initialDraft?.customer?.address || "",
  }));

  const [paymentMode, setPaymentMode] = useState(() => copiedInvoice?.paymentMode || initialDraft?.paymentMode || "Cash");
  const [referenceNo, setReferenceNo] = useState(() => copiedInvoice?.referenceNo || initialDraft?.referenceNo || "");
  const [newItems, setNewItems] = useState(() => copiedRows(copiedInvoice?.newItems, copiedRows(initialDraft?.newItems, [blankNew()])).map((x) => ({ ...blankNew(), ...x })));
  // Keep all entered/copied old-ornament rows, remove unused blank rows,
  // and always start with exactly one empty row at the end.
  const [oldItems, setOldItems] = useState(() => {
    const rows = copiedRows(copiedInvoice?.oldItems, copiedRows(initialDraft?.oldItems, [blankOld()])).map((x) => ({ ...blankOld(), ...x }));
    const enteredRows = rows.filter((row) =>
      String(row.description ?? "").trim() !== "" ||
      String(row.purity ?? "").trim() !== "" ||
      Number(row.pureWeight) > 0 ||
      Number(row.rate) > 0
    );
    return [...enteredRows, blankOld()];
  });
  const [discount, setDiscount] = useState(() => String(copiedInvoice?.discount ?? initialDraft?.discount ?? ""));
  const [gst, setGst] = useState(() => String(copiedInvoice?.gstPercent ?? initialDraft?.gst ?? 0));
  const [description, setDescription] = useState(() => copiedInvoice?.description || initialDraft?.description || "");
  const [saved, setSaved] = useState(false);
  const [draftRestored, setDraftRestored] = useState(() => Boolean(initialDraft));
  const [idempotencyKey, setIdempotencyKey] = useState(() => initialDraft?.idempotencyKey || createInvoiceDraftKey());
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceId, setInvoiceId] = useState(null);
  const [showInvoicePin, setShowInvoicePin] = useState(false);
  const saveInProgressRef = useRef(false);
  const skipNextDraftPersistRef = useRef(false);

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

  useEffect(() => {
    if (location.state?.copyInvoice) {
      navigate("/invoice", { replace: true, state: null });
    }
  }, [location.state, navigate]);

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
      customer,
      paymentMode,
      referenceNo,
      newItems,
      oldItems,
      discount,
      gst,
      description,
      savedAt: new Date().toISOString(),
    };
    try {
      window.localStorage.setItem(INVOICE_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // The invoice remains usable when browser storage is unavailable or full.
    }
  }, [customer, paymentMode, referenceNo, newItems, oldItems, discount, gst, description, idempotencyKey, saved]);

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

  // GST calculated on SUB TOTAL before discount

  const tax = (newTotal * (+gst || 0)) / 100;

  // Discount deducted after GST calculation

  const grand = Math.max(0, newTotal + tax - discountValue - oldTotal);

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
    };
  }

  function discardDraft() {
    if (saved || saving) return;
    if (!window.confirm("Discard this unfinished invoice draft? This cannot be undone.")) return;

    skipNextDraftPersistRef.current = true;
    try { window.localStorage.removeItem(INVOICE_DRAFT_STORAGE_KEY); } catch {}
    setCustomer({ name: "", mobile: "", address: "" });
    setPaymentMode("Cash");
    setReferenceNo("");
    setNewItems([blankNew()]);
    setOldItems([blankOld()]);
    setDiscount("");
    setGst("0");
    setDescription("");
    setInvoiceNo("");
    setInvoiceId(null);
    setIdempotencyKey(createInvoiceDraftKey());
    setDraftRestored(false);
    setError("");
  }

  async function save() {
    if (saveInProgressRef.current || saved) return;
    setError("");
    if (!customer.name.trim()) { setError("Please enter customer name."); return; }
    if (!hasNewItemDetails && !hasOldItemDetails) { setError("Enter at least one ornament detail before saving the invoice."); return; }

    saveInProgressRef.current = true;
    setSaving(true);
    try {
      const result = await request("/invoices", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(buildInvoicePayload()),
      });
      if (!result?.id || !result?.invoiceNo) {
        throw new Error("The server did not return a saved invoice ID and number. Please refresh the saved invoice list before retrying.");
      }
      setInvoiceId(result.id);
      setInvoiceNo(result.invoiceNo);
      setSaved(true);
      setDraftRestored(false);
      setShowInvoicePin(false);
    } catch (e) {
      setError(e.message || "Could not save the invoice. Your draft is still available.");
    } finally {
      saveInProgressRef.current = false;
      setSaving(false);
    }
  }

  function requestPrintPin() {
    if (!saved || !invoiceId) {
      setError("Save the invoice before printing or downloading its PDF.");
      return;
    }
    setError("");
    setShowInvoicePin(true);
  }

  async function printCurrentInvoice(ticket) {
    await request("/invoices/consume-print-ticket", {
      method: "POST",
      body: JSON.stringify({ ticket, invoiceId }),
    });
    setShowInvoicePin(false);
    window.setTimeout(() => window.print(), 120);
  }

  const now = new Date();

  const date = now.toLocaleDateString("en-GB").replace(/\//g, "-");

  const time = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",

    minute: "2-digit",
  });

  return (
    <Page active="invoice">
      <div className="page-title no-print">
        <div>
          <span className="eyebrow">BILLING</span>

          <h2>Create New Invoice</h2>
        </div>

        <Link to="/" className="secondary">
          <ArrowLeft /> Home
        </Link>
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
            <small className="invoice-gstin">
        GSTIN No: 19ABCDE1234F1Z5
    </small>
          
          </div>
          
          <div className="inv-meta">
            <b>INVOICE</b>

            <span>
              <label>Invoice No.</label>

              <strong>{invoiceNo || "Auto-generated on save"}</strong>
            </span>

            <span>
              <label>Date</label>

              <strong>{date}</strong>
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
                  value={customer.mobile}
                  onChange={(e) =>
                    setCustomer({ ...customer, mobile: e.target.value })
                  }
                  placeholder="Mobile number"
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
                <RefreshCw size={18} /> Old / Exchange Ornaments Details
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

      {error && <p className="error no-print">{error}</p>}

      {saved && <p className="success no-print">Invoice saved successfully.</p>}

      <div className="invoice-actions no-print">
        <button type="button" className="primary" onClick={save} disabled={saving || saved}>
          <Save /> {saving ? "Saving..." : saved ? "Invoice Saved" : "Save Invoice"}
        </button>

        <button
          type="button"
          className="secondary"
          onClick={requestPrintPin}
          disabled={!saved || !invoiceId}
          title={!saved ? "Save the invoice before printing or downloading a PDF" : "Print this saved invoice"}
        >
          <Printer /> Print / Save PDF
        </button>

        {!saved && (
          <button type="button" className="secondary" onClick={discardDraft} disabled={saving}>
            <Trash2 /> Discard Draft
          </button>
        )}
      </div>
      {!saved && (
        <p className="draft-note no-print" role="status">
          {draftRestored
            ? "Your unfinished invoice draft was restored from this browser. Changes continue to save automatically."
            : "Your unfinished invoice is saved automatically in this browser and will be restored after a refresh."}
        </p>
      )}
      {showInvoicePin && (
        <InvoicePinDialog
          invoiceId={invoiceId}
          onClose={() => setShowInvoicePin(false)}
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
  const newTotal = Number(data.newTotal ?? data.subTotal ?? calculatedNewTotal) || 0;
  const oldTotal = Number(data.oldTotal ?? calculatedOldTotal) || 0;
  const gstPercent = Number(data.gstPercent) || 0;
  const gstAmount = Number(data.gstAmount ?? (newTotal * gstPercent) / 100) || 0;
  const discount = Number(data.discount) || 0;
  const grandTotal = Number(data.grandTotal ?? (newTotal + gstAmount - discount - oldTotal)) || 0;
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
          <small className="invoice-gstin" style={{ display: "block", marginTop: "2px", fontSize: "15px", fontWeight: 700 }}>GSTIN: 19ABCDE1234F1Z5</small>
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
            <h3><RefreshCw size={18} /> Old / Exchange Ornaments Details</h3>
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
          <div className="total-row">
            <span>
              GST AMOUNT (₹) <small>GST % <input className="gst-percent-input" aria-label="GST percentage" value={gstPercent} readOnly /></small>
            </span>
            <b>{money(gstAmount)}</b>
          </div>
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
    window.setTimeout(() => window.print(), 120);
  };

  const shareInvoiceOnWhatsApp = () => {
    if (!selectedInvoice) return;
    const digits = String(selectedInvoice.mobile || "").replace(/\D/g, "");
    const normalizedDigits =
      digits.length === 11 && digits.startsWith("0") ? digits.slice(1) : digits;
    const phone =
      normalizedDigits.length === 10 ? `91${normalizedDigits}` : normalizedDigits;
    const text = encodeURIComponent(makeInvoiceShareMessage(selectedInvoice));
    const url = phone
      ? `https://wa.me/${phone}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Page active="saved">
      <div className="page-title">
        <div>
          <span className="eyebrow">RECORDS</span>
          <h2>Saved Invoices</h2>
        </div>
        <Link className="primary" to="/invoice"><Plus /> New Invoice</Link>
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
        <button className="secondary" onClick={load} disabled={loading}>
          <RefreshCw size={16} /> {loading ? "Loading" : "Refresh"}
        </button>
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
                  <td>{x.invoiceDate || "—"}</td>
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
