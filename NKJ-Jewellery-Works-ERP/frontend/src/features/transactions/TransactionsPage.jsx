import "./TransactionsPage.css";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownLeft, ArrowUpRight, ArrowLeftRight, RefreshCw, Search,
  Wallet, RotateCcw, X,
} from "lucide-react";
import { Page } from "../../shared/layouts/OwnerShell";
import { money } from "../../shared/utils/formatters";
import { request } from "../../core/api/client";

const initialSummary = {
  totalIncoming: 0,
  totalOutgoing: 0,
  netCashFlow: 0,
  incomingCount: 0,
  outgoingCount: 0,
  transactionCount: 0,
};

const todayInShop = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

const transactionKey = () => {
  const token = globalThis.crypto?.randomUUID?.()
    || (Date.now() + "-" + Math.random().toString(36).slice(2));
  return "CASH-REFUND-" + token;
};

const sourceLabel = (source) => ({
  INVOICE: "Invoice collection",
  PAYMENTS: "Customer receipt",
  PRE_BOOKINGS: "Pre-Booking advance",
  INSTALLMENTS: "Installment receipt",
  EXPENSES: "Expense payment",
  PURCHASES: "Supplier payment",
  SALARY: "Initial salary payment",
  SALARY_PAYMENTS: "Salary payment",
  REFUNDS: "Customer refund",
}[String(source || "").toUpperCase()] || String(source || "Transaction").replaceAll("_", " "));

const dateLabel = (value) => {
  if (!value) return "—";
  const date = new Date(String(value).slice(0, 10) + "T00:00:00");
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
        timeZone: "Asia/Kolkata",
      }).format(date);
};

export default function TransactionsPage() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(initialSummary);
  const [refundable, setRefundable] = useState([]);
  const [direction, setDirection] = useState("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showRefund, setShowRefund] = useState(false);
  const [refundSaving, setRefundSaving] = useState(false);
  const [refundForm, setRefundForm] = useState({
    originalTransactionId: "",
    refundDate: todayInShop(),
    amount: "",
    paymentMethod: "Cash",
    referenceNo: "",
    notes: "",
  });
  const refundKeyRef = useRef("");

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (direction !== "ALL") params.set("direction", direction);
      if (search) params.set("search", search);
      const query = params.toString();
      const [transactions, totals, refundOptions] = await Promise.all([
        request("/admin/transactions" + (query ? "?" + query : "")),
        request("/admin/transactions/summary"),
        request("/admin/transactions/refundable"),
      ]);
      setRows(Array.isArray(transactions) ? transactions : []);
      setSummary({ ...initialSummary, ...(totals || {}) });
      setRefundable(Array.isArray(refundOptions) ? refundOptions : []);
    } catch (e) {
      setError(e.message || "Could not load the cash transaction history.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [direction, search]);

  useEffect(() => { load(); }, [load]);

  const openRefund = (row = null) => {
    const option = row
      ? refundable.find((item) => Number(item.transactionId) === Number(row.id))
      : refundable[0];
    if (!option) {
      setError("There is no remaining refundable Incoming receipt.");
      return;
    }
    refundKeyRef.current = transactionKey();
    setRefundForm({
      originalTransactionId: String(option.transactionId),
      refundDate: todayInShop(),
      amount: String(Number(option.refundableAmount || 0).toFixed(2)),
      paymentMethod: "Cash",
      referenceNo: "",
      notes: "",
    });
    setError("");
    setNotice("");
    setShowRefund(true);
  };

  const selectedRefund = refundable.find(
    (item) => String(item.transactionId) === refundForm.originalTransactionId,
  );

  const submitRefund = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    const amount = Number(refundForm.amount);
    const remaining = Number(selectedRefund?.refundableAmount || 0);
    if (!refundForm.originalTransactionId || !Number.isFinite(amount) || amount <= 0) {
      setError("Select the original receipt and enter a valid refund amount.");
      return;
    }
    if (amount > remaining) {
      setError("Refund cannot exceed the remaining refundable amount of ₹ " + money(remaining) + ".");
      return;
    }
    if (!refundKeyRef.current) refundKeyRef.current = transactionKey();

    setRefundSaving(true);
    try {
      await request("/admin/transactions/refunds", {
        method: "POST",
        headers: { "Idempotency-Key": refundKeyRef.current },
        body: JSON.stringify({
          ...refundForm,
          originalTransactionId: Number(refundForm.originalTransactionId),
          amount,
        }),
      });
      refundKeyRef.current = "";
      setShowRefund(false);
      setNotice("Refund posted as an Outgoing transaction. Original receipt history is preserved.");
      await load(true);
    } catch (e) {
      setError(e.message || "Could not record the refund.");
    } finally {
      setRefundSaving(false);
    }
  };

  const changeDirection = (next) => {
    setDirection(next);
    setNotice("");
  };

  return (
    <Page active="transactions">
      <div className="nkj-transactions">
        <header className="nkj-transactions-heading">
          <div>
            <span className="eyebrow">FINANCE &amp; CASH FLOW</span>
            <h1>Transactions</h1>
            <p>Track money actually received and paid by the shop.</p>
          </div>
          <div className="nkj-transactions-heading-actions">
            <button type="button" className="nkj-transactions-refresh" onClick={() => load(true)} disabled={loading || refreshing}>
              <RefreshCw size={16} className={refreshing ? "is-spinning" : ""} />
              Refresh
            </button>
            <button type="button" className="nkj-transactions-refund-button" onClick={() => openRefund()} disabled={!refundable.length}>
              <RotateCcw size={16} />
              Record Refund
            </button>
          </div>
        </header>

        {error && !showRefund && <div className="nkj-transactions-alert error" role="alert">{error}</div>}
        {notice && <div className="nkj-transactions-alert success" role="status">{notice}</div>}

        <section className="nkj-cash-summary" aria-label="Cash flow totals">
          <article className="nkj-cash-summary-card incoming">
            <div className="nkj-cash-summary-icon"><ArrowDownLeft size={21} /></div>
            <div>
              <span>Total Incoming</span>
              <strong>+ ₹ {money(summary.totalIncoming)}</strong>
              <small>{Number(summary.incomingCount || 0).toLocaleString("en-IN")} receipts</small>
            </div>
          </article>
          <article className="nkj-cash-summary-card outgoing">
            <div className="nkj-cash-summary-icon"><ArrowUpRight size={21} /></div>
            <div>
              <span>Total Outgoing</span>
              <strong>− ₹ {money(summary.totalOutgoing)}</strong>
              <small>{Number(summary.outgoingCount || 0).toLocaleString("en-IN")} payments</small>
            </div>
          </article>
          <article className="nkj-cash-summary-card net">
            <div className="nkj-cash-summary-icon"><Wallet size={21} /></div>
            <div>
              <span>Net Cash Flow</span>
              <strong className={Number(summary.netCashFlow || 0) >= 0 ? "positive" : "negative"}>
                {Number(summary.netCashFlow || 0) >= 0 ? "+" : "−"} ₹ {money(Math.abs(Number(summary.netCashFlow || 0)))}
              </strong>
              <small>{Number(summary.transactionCount || 0).toLocaleString("en-IN")} posted transactions</small>
            </div>
          </article>
        </section>

        <section className="nkj-transactions-panel">
          <div className="nkj-transactions-toolbar">
            <div className="nkj-transactions-filters" role="group" aria-label="Filter transaction direction">
              {[
                ["ALL", "All transactions"],
                ["INCOMING", "Incoming"],
                ["OUTGOING", "Outgoing"],
              ].map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  className={direction === value ? "active" : ""}
                  onClick={() => changeDirection(value)}
                  aria-pressed={direction === value}
                >
                  {value === "INCOMING" && <ArrowDownLeft size={15} />}
                  {value === "OUTGOING" && <ArrowUpRight size={15} />}
                  {label}
                </button>
              ))}
            </div>
            <form
              className="nkj-transactions-search"
              onSubmit={(event) => { event.preventDefault(); setSearch(searchInput.trim()); }}
            >
              <Search size={17} />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search party, invoice, source or reference"
                aria-label="Search transactions"
              />
              <button type="submit">Search</button>
            </form>
          </div>

          <div className="nkj-transactions-table-wrap">
            <table className="nkj-transactions-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Transaction / Source</th>
                  <th>Party / Reference</th>
                  <th>Payment method</th>
                  <th className="amount-col">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan="5" className="nkj-transactions-empty">Loading transaction history…</td></tr>
                )}
                {!loading && rows.map((row) => {
                  const incoming = row.direction === "INCOMING";
                  const amount = Number(row.amount || 0);
                  const voided = row.status === "VOIDED";
                  return (
                    <tr key={row.id} className={voided ? "is-voided" : ""}>
                      <td>
                        <strong>{dateLabel(row.transactionDate)}</strong>
                        <small>TXN-{String(row.id).padStart(6, "0")}</small>
                      </td>
                      <td>
                        <strong>{row.description || sourceLabel(row.sourceModule)}</strong>
                        <small>{sourceLabel(row.sourceModule)} · {String(row.sourceOperation || "").replaceAll("_", " ")}</small>
                        {voided && <span className="nkj-voided-tag">Reversed / voided</span>}
                      </td>
                      <td>
                        <strong>{row.partyName || "—"}</strong>
                        <small>{row.sourceReference || row.referenceNo || ("Record #" + row.sourceRecordId)}</small>
                      </td>
                      <td>{row.paymentMethod || "—"}</td>
                      <td className={"amount-col nkj-direction-amount " + (incoming ? "is-incoming" : "is-outgoing")}>
                        <strong>{incoming ? "+" : "−"} ₹ {money(amount)}</strong>
                      </td>
                    </tr>
                  );
                })}
                {!loading && !rows.length && (
                  <tr><td colSpan="5" className="nkj-transactions-empty">
                    <ArrowLeftRight size={28} />
                    <strong>No transactions found</strong>
                    <span>Only recorded payments and receipts appear here. Unpaid invoices and pending balances are excluded.</span>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          <footer className="nkj-transactions-footnote">
            <span><i className="incoming-dot" /> Incoming money received</span>
            <span><i className="outgoing-dot" /> Outgoing money paid</span>
            <small>Voided entries stay in history but are excluded from cash flow totals.</small>
          </footer>
        </section>
      </div>

      {showRefund && (
        <div className="nkj-refund-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !refundSaving) setShowRefund(false);
        }}>
          <section className="nkj-refund-modal" role="dialog" aria-modal="true" aria-labelledby="nkj-refund-title">
            <header>
              <div>
                <span className="eyebrow">OUTGOING CASH</span>
                <h2 id="nkj-refund-title">Record customer refund</h2>
              </div>
              <button type="button" aria-label="Close refund form" onClick={() => setShowRefund(false)} disabled={refundSaving}><X size={20} /></button>
            </header>
            <form onSubmit={submitRefund}>
              <label>
                Original Incoming receipt
                <select
                  required
                  value={refundForm.originalTransactionId}
                  onChange={(event) => {
                    const option = refundable.find((item) => String(item.transactionId) === event.target.value);
                    setRefundForm((old) => ({
                      ...old,
                      originalTransactionId: event.target.value,
                      amount: option ? String(Number(option.refundableAmount || 0).toFixed(2)) : "",
                    }));
                  }}
                >
                  <option value="">Select receipt</option>
                  {refundable.map((option) => (
                    <option key={option.transactionId} value={option.transactionId}>
                      {(option.sourceReference || ("Receipt #" + option.transactionId)) + " · " + (option.partyName || "Customer") + " · ₹ " + money(option.refundableAmount)}
                    </option>
                  ))}
                </select>
              </label>
              {selectedRefund && (
                <div className="nkj-refundable-balance">
                  Remaining refundable amount <strong>₹ {money(selectedRefund.refundableAmount)}</strong>
                </div>
              )}
              <div className="nkj-refund-grid">
                <label>
                  Refund date
                  <input type="date" required max={todayInShop()} value={refundForm.refundDate}
                    onChange={(event) => setRefundForm((old) => ({ ...old, refundDate: event.target.value }))} />
                </label>
                <label>
                  Refund amount (₹)
                  <input type="number" required min="0.01" step="0.01" max={selectedRefund?.refundableAmount || undefined}
                    value={refundForm.amount}
                    onChange={(event) => setRefundForm((old) => ({ ...old, amount: event.target.value }))} />
                </label>
              </div>
              <div className="nkj-refund-grid">
                <label>
                  Payment method
                  <select value={refundForm.paymentMethod} onChange={(event) => setRefundForm((old) => ({ ...old, paymentMethod: event.target.value }))}>
                    {["Cash", "UPI", "Bank Transfer", "Card", "Cheque", "NEFT", "RTGS"].map((method) => <option key={method}>{method}</option>)}
                  </select>
                </label>
                <label>
                  Reference no.
                  <input value={refundForm.referenceNo} maxLength={120} onChange={(event) => setRefundForm((old) => ({ ...old, referenceNo: event.target.value }))} />
                </label>
              </div>
              <label>
                Notes / reason
                <textarea rows="3" maxLength={2000} value={refundForm.notes}
                  onChange={(event) => setRefundForm((old) => ({ ...old, notes: event.target.value }))} />
              </label>
              {error && <div className="nkj-transactions-alert error">{error}</div>}
              <footer>
                <button type="button" className="secondary" onClick={() => setShowRefund(false)} disabled={refundSaving}>Cancel</button>
                <button type="submit" className="primary" disabled={refundSaving || !selectedRefund}>
                  <RotateCcw size={16} /> {refundSaving ? "Posting refund…" : "Confirm refund"}
                </button>
              </footer>
              <small className="nkj-refund-note">This creates a separate Outgoing entry linked to the original receipt. It does not edit or delete the original Incoming record.</small>
            </form>
          </section>
        </div>
      )}
    </Page>
  );
}
