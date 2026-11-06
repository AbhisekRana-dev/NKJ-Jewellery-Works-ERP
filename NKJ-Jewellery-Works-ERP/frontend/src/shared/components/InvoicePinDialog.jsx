

import "./InvoicePinDialog.css";
import React, { useState } from "react";
import { LockKeyhole, X, ShieldCheck } from "lucide-react";
import { request } from "../../core/api/client";

export default function InvoicePinDialog({
  onClose,
  onVerified,
  title = "Verify invoice security PIN",
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handlePinChange = (event) => {
    const value = event.target.value.replace(/\D/g, "").slice(0, 6);
    setPin(value);
    setError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    if (!/^\d{6}$/.test(pin)) {
      setError("Enter the 6-digit invoice security PIN.");
      return;
    }

    setBusy(true);

    try {
      const result = await request("/invoices/verify-pin", {
        method: "POST",
        body: JSON.stringify({ pin }),
      });

      await onVerified(result.ticket);
    } catch (e) {
      setError(e.message || "PIN verification failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="nkj-pin-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) {
          onClose();
        }
      }}
    >
      <section
        className="nkj-pin-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nkj-pin-title"
      >
        <button
          className="nkj-pin-close"
          type="button"
          onClick={onClose}
          aria-label="Close"
          disabled={busy}
        >
          <X size={19} />
        </button>

        <div className="nkj-pin-icon">
          <LockKeyhole size={26} />
        </div>

        <h2 id="nkj-pin-title">{title}</h2>

        <p>Enter the owner-configured 6-digit PIN to continue.</p>

        <form onSubmit={submit}>
          <label htmlFor="nkj-invoice-pin">
            Invoice Security PIN
          </label>

          <input
            id="nkj-invoice-pin"
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            value={pin}
            onChange={handlePinChange}
            placeholder="••••••"
            required
            disabled={busy}
          />

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          <button
            className="primary"
            type="submit"
            disabled={busy || pin.length !== 6}
          >
            <ShieldCheck size={17} />
            {busy ? "Verifying…" : "Verify PIN"}
          </button>
        </form>

        <small>
          Attempts are rate-limited and verification is recorded in the
          owner audit log.
        </small>
      </section>
    </div>
  );
}
