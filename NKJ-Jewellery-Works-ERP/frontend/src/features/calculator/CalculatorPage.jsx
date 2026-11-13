import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calculator as CalculatorIcon, Coins, Gem, Scale, Delete, RotateCcw, History, Copy, Trash2, Tag, Wrench, Stamp, CirclePlus, BadgeCheck } from "lucide-react";
import { Page } from "../../shared/layouts/OwnerShell";
import "./CalculatorPage.css";

const INITIAL_ORNAMENT_DRAFT = Object.freeze({
  weight: "", purity: "", rate: "", making: "",
  makingMode: "rupees", stamp: "", extra: "",
});
const INITIAL_MANUAL_DRAFT = Object.freeze({ expression: "0", result: "0", error: "", calculated: false });

function usePersistentDraft(storageKey, initialValue) {
  const [draft, setDraft] = useState(() => {
    if (typeof window === "undefined") return { ...initialValue };
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (!saved) return { ...initialValue };
      const parsed = JSON.parse(saved);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? { ...initialValue, ...parsed }
        : { ...initialValue };
    } catch {
      return { ...initialValue };
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {
      // Keep calculator usable when browser storage is disabled or full.
    }
  }, [storageKey, draft]);

  return [draft, setDraft];
}

const money = (value) => Number(value || 0).toLocaleString("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberInput = (value, setter) => ({
  type: "number",
  min: "0",
  step: "0.01",
  value,
  onChange: (event) => setter(event.target.value),
  // Prevent the mouse wheel from accidentally incrementing/decrementing values.
  onWheel: (event) => event.currentTarget.blur(),
});

function usePersistentHistory(storageKey, limit = 15) {
  const [items, setItems] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
      return Array.isArray(saved) ? saved.slice(0, limit) : [];
    } catch {
      return [];
    }
  });
  const itemsRef = useRef(items);

  // Persistence happens only inside an explicit add/clear action, never in an effect.
  const commitItems = useCallback((update) => {
    const current = itemsRef.current;
    const next = typeof update === "function" ? update(current) : update;
    const limited = next.slice(0, limit);
    itemsRef.current = limited;

    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, JSON.stringify(limited));
      }
    } catch {
      // Keep the in-memory history usable when browser storage is unavailable.
    }

    setItems(limited);
  }, [storageKey, limit]);

  const addItem = useCallback((item) => {
    commitItems((current) => [{ ...item, createdAt: Date.now() }, ...current]);
  }, [commitItems]);

  const clearItems = useCallback(() => commitItems([]), [commitItems]);
  return [items, addItem, clearItems];
}

function CalculationHistory({ title, items, onClear, emptyText = "Your calculations will appear here." }) {
  const copyItem = (item) => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(`${item.expression} = ${item.result}`).catch(() => {});
    }
  };

  return (
    <aside className="nkj-calc-history">
      <div className="nkj-calc-history-heading">
        <h3><History size={20} /> {title}</h3>
        <button type="button" onClick={onClear} disabled={!items.length}>
          <Trash2 size={14} /> Clear All
        </button>
      </div>
      <div className="nkj-calc-history-list">
        {items.length ? items.map((item, index) => (
          <div className="nkj-calc-history-row" key={`${item.createdAt || "history"}-${index}`}>
            <span className="nkj-calc-history-expression">{item.expression}</span>
            <strong>{item.result}</strong>
            <button type="button" aria-label="Copy calculation" title="Copy calculation" onClick={() => copyItem(item)}>
              <Copy size={17} />
            </button>
          </div>
        )) : <p className="nkj-calc-history-empty">{emptyText}</p>}
      </div>
    </aside>
  );
}


function evaluateExpression(source) {
  const tokens = source.match(/\d*\.?\d+|[()+\-*/%]/g) || [];
  if (!tokens.length || tokens.join("") !== source.replace(/\s+/g, "")) {
    throw new Error("Enter a valid calculation.");
  }

  let index = 0;
  const peek = () => tokens[index];
  const take = () => tokens[index++];

  const factor = () => {
    const token = peek();
    if (token === "+" || token === "-") {
      take();
      const value = factor();
      return token === "-" ? -value : value;
    }
    let value;
    if (token === "(") {
      take();
      value = expression();
      if (take() !== ")") throw new Error("Missing closing bracket.");
    } else {
      if (!token || !/^\d*\.?\d+$/.test(token)) {
        throw new Error("Enter a valid number.");
      }
      take();
      value = Number(token);
    }
    // A trailing percent is a postfix percentage (10% = 0.1), not modulo.
    while (peek() === "%") {
      take();
      value /= 100;
    }
    return value;
  };

  const term = () => {
    let value = factor();
    while (["*", "/"].includes(peek())) {
      const operator = take();
      const right = factor();
      if (operator === "/" && right === 0) {
        throw new Error("Cannot divide by zero.");
      }
      value = operator === "*" ? value * right : value / right;
    }
    return value;
  };

  const expression = () => {
    let value = term();
    while (peek() === "+" || peek() === "-") {
      const operator = take();
      const right = term();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  };

  const result = expression();
  if (index !== tokens.length || !Number.isFinite(result)) {
    throw new Error("Check the calculation and try again.");
  }
  return result;
}

function ManualCalculator({ active }) {
  const [draft, setDraft] = usePersistentDraft("nkj_manual_calculator_draft", INITIAL_MANUAL_DRAFT);
  const { expression, result, error } = draft;

  const append = useCallback((value) => {
    setDraft((current) => {
      const isOperator = ["+", "-", "*", "/", "%"].includes(value);
      const baseExpression = current.calculated
        ? (isOperator ? current.result : "0")
        : current.expression;
      const nextExpression = baseExpression === "0"
        ? value === "(" ? "(" : value === "." ? "0." : /\d/.test(value) ? value : baseExpression + value
        : baseExpression + value;
      return {
        ...current,
        error: "",
        calculated: false,
        result: current.calculated ? "0" : current.result,
        expression: nextExpression,
      };
    });
  }, [setDraft]);

  const calculate = useCallback(() => {
    try {
      const value = evaluateExpression(expression);
      const formatted = String(Number(value.toFixed(8)));
      setDraft((current) => ({ ...current, result: formatted, calculated: true, error: "" }));
    } catch (err) {
      setDraft((current) => ({ ...current, error: err.message || "Invalid calculation." }));
    }
  }, [expression, setDraft]);

  const clear = useCallback(() => {
    setDraft({ ...INITIAL_MANUAL_DRAFT });
  }, [setDraft]);

  // Reset immediately; no confirmation dialog for the Manual Calculator.
  const resetManualCalculator = clear;

  const backspace = useCallback(() => {
    setDraft((current) => {
      const source = current.calculated ? current.result : current.expression;
      return {
        ...current,
        error: "",
        calculated: false,
        result: current.calculated ? "0" : current.result,
        expression: source.length <= 1 ? "0" : source.slice(0, -1),
      };
    });
  }, [setDraft]);

  // Capture keyboard input while this calculator is mounted. Capture mode
  // lets the calculator receive keys before other page shortcuts can swallow them.
  useEffect(() => {
    if (!active) return undefined;

    const handleCalculatorKeyDown = (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      const target = event.target;
      const key = event.key;

      // Escape immediately resets only the active Manual Calculator.
      // Handle it before the editable-field guard so the shortcut also works
      // when focus is inside a calculator control.
      if (key === "Escape") {
        if (event.target instanceof Element && !event.target.closest(".nkj-calculator-page--manual")) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        clear();
        return;
      }

      const isEditingField = target instanceof HTMLElement && (
        target.isContentEditable
        || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
        || Boolean(target.closest('[contenteditable="true"], [role="textbox"]'))
      );
      if (isEditingField) return;
      const consume = () => {
        event.preventDefault();
        event.stopPropagation();
      };

      if (/^[0-9.]$/.test(key) || ["+", "-", "*", "/", "%", "(", ")"].includes(key)) {
        consume();
        append(key);
        return;
      }

      if (key === "x" || key === "X" || key === "×") {
        consume();
        append("*");
        return;
      }

      if (key === "÷") {
        consume();
        append("/");
        return;
      }

      if (key === "Enter" || key === "=") {
        consume();
        calculate();
        return;
      }

      if (key === "Backspace" || key === "Delete") {
        consume();
        backspace();
        return;
      }

    };

    window.addEventListener("keydown", handleCalculatorKeyDown, true);
    return () => window.removeEventListener("keydown", handleCalculatorKeyDown, true);
  }, [active, append, calculate, backspace, clear]);

  const keys = [
    ["AC", "clear"], ["(", "("], [")", ")"], ["÷", "/"],
    ["7", "7"], ["8", "8"], ["9", "9"], ["×", "*"],
    ["4", "4"], ["5", "5"], ["6", "6"], ["−", "-"],
    ["1", "1"], ["2", "2"], ["3", "3"], ["+", "+"],
    ["%", "%"], ["0", "0"], [".", "."], ["=", "equal"],
  ];

  return (
    <div className="nkj-calc-manual-only">
      <section className="nkj-calc-manual">
        <div className="nkj-calc-display">
          <span>MANUAL CALCULATOR</span>
          <div className="nkj-calc-expression" aria-live="polite">{expression}</div>
          <div className="nkj-calc-result">= {Number(result || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          {error && <small className="nkj-calc-error">{error}</small>}
        </div>

        <div className="nkj-calc-manual-keypad-area">
          <div className="nkj-calc-keypad" aria-label="Manual calculator keypad">
            {keys.map(([label, value]) => (
              <button
                type="button"
                key={label}
                className={
                  value === "clear" ? "utility"
                    : value === "equal" ? "equal"
                      : ["+", "-", "*", "/", "%"].includes(value) ? "operator"
                        : ""
                }
                onClick={() => {
                  if (value === "clear") resetManualCalculator();
                  else if (value === "equal") calculate();
                  else append(value);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="nkj-calc-manual-side-actions">
            <button type="button" className="nkj-calc-backspace" onClick={backspace}>
              <Delete size={18} /> DEL
            </button>
            <button type="button" className="nkj-calc-manual-reset" onClick={resetManualCalculator}>
              <RotateCcw size={17} /> Reset
            </button>
          </div>
        </div>
        <p className="nkj-calc-keyboard-hint">Keyboard: 0–9, +, −, *, /, %, brackets · Enter or = to calculate · Backspace to delete · Esc resets</p>
      </section>
    </div>
  );
}

function OrnamentCalculator({ mode, active, history, addHistory, clearHistory }) {
  const isOld = mode === "old";
  const draftKey = isOld ? "nkj_old_ornament_draft" : "nkj_new_ornament_draft";
  const [draft, setDraft] = usePersistentDraft(draftKey, INITIAL_ORNAMENT_DRAFT);
  const { weight, purity, rate, making, makingMode, stamp, extra } = draft;
  const [calculationFeedback, setCalculationFeedback] = useState("");
  const calculateGuardRef = useRef({ inFlight: false, lastAcceptedAt: 0, lastSignature: "" });

  const updateDraftField = useCallback((field, value) => {
    setCalculationFeedback("");
    setDraft((current) => ({ ...current, [field]: value }));
  }, [setDraft]);
  const purityPercent = purity.trim() === "" ? 100 : Number(purity);
  const isPurityValid = !isOld || (Number.isFinite(purityPercent) && purityPercent >= 0 && purityPercent <= 100);
  const pureWeight = isOld
    ? (Math.max(0, Number(weight) || 0) * Math.max(0, purityPercent)) / 100
    : Math.max(0, Number(weight) || 0);
  const metalValue = pureWeight * Math.max(0, Number(rate) || 0);
  const makingNumber = Number(making);
  const makingInputValue = Number.isFinite(makingNumber) ? Math.max(0, makingNumber) : 0;
  const isMakingValid = isOld || makingMode !== "percentage" || making === ""
    || (Number.isFinite(makingNumber) && makingNumber >= 0 && makingNumber <= 100);
  const makingChargeRupees = makingMode === "percentage"
    ? (metalValue * makingInputValue) / 100
    : makingInputValue;
  const total = useMemo(() => {
    return isOld
      ? (isPurityValid ? metalValue : 0)
      : metalValue + (isMakingValid ? makingChargeRupees : 0)
        + Math.max(0, Number(stamp) || 0) + Math.max(0, Number(extra) || 0);
  }, [metalValue, makingChargeRupees, stamp, extra, isOld, isPurityValid, isMakingValid]);

  const reset = useCallback(() => {
    setDraft({ ...INITIAL_ORNAMENT_DRAFT });
    setCalculationFeedback("");
  }, [setDraft]);

  // Escape resets only the selected Ornament tab. The inactive Ornament
  // component stays mounted to preserve its draft, but has no active listener.
  useEffect(() => {
    if (!active) return undefined;

    const handleActiveOrnamentReset = (event) => {
      if (event.key !== "Escape" || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (!(target instanceof Element) || !target.closest(".nkj-calculator-page")) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      reset();
    };

    window.addEventListener("keydown", handleActiveOrnamentReset, true);
    return () => window.removeEventListener("keydown", handleActiveOrnamentReset, true);
  }, [active, reset]);

  // Ornament drafts reset only through their own Reset button or active-tab Escape.

  // Add exactly one record only after a valid, deliberate Calculate action.
  // A short click guard blocks duplicate events from rapid double-clicks while
  // still allowing the same calculation to be recorded again as a later action.
  const handleCalculate = useCallback(() => {
    const guard = calculateGuardRef.current;
    const now = Date.now();
    const calculationSignature = JSON.stringify({
      mode, weight, purity: purityPercent, rate, making, makingMode, stamp, extra,
    });
    if (guard.inFlight) return;
    // Ignore the same calculation only when the second click is part of a rapid double-click.
    // A changed input signature is always allowed, and the same values can be submitted again later.
    if (guard.lastSignature === calculationSignature && now - guard.lastAcceptedAt < 450) return;

    if (!(Number(weight) > 0) || !(Number(rate) > 0)) {
      setCalculationFeedback("Enter a weight and rate greater than zero before calculating.");
      return;
    }
    if (!isPurityValid) {
      setCalculationFeedback("Enter a valid purity percentage from 0 to 100.");
      return;
    }
    if (!isMakingValid) {
      setCalculationFeedback("Enter a making charge percentage from 0 to 100.");
      return;
    }

    guard.inFlight = true;
    guard.lastAcceptedAt = now;
    guard.lastSignature = calculationSignature;
    try {
      const formatNumber = (value) => Number(value || 0).toLocaleString("en-IN", {
        maximumFractionDigits: 2,
      });
      const expressionText = isOld
        ? `${formatNumber(weight)} gm × ${formatNumber(purityPercent)}% × ₹${formatNumber(rate)}`
        : [
            `${formatNumber(weight)} gm × ₹${formatNumber(rate)}`,
            makingMode === "percentage"
              ? `MC ${formatNumber(makingInputValue)}% (₹${money(makingChargeRupees)})`
              : `MC ₹${money(makingChargeRupees)}`,
            ...(Number(stamp) > 0 ? [`SC ₹${money(stamp)}`] : []),
            ...(Number(extra) > 0 ? [`EC ₹${money(extra)}`] : []),
          ].join(" + ");

      addHistory({
        expression: expressionText,
        result: `₹ ${money(total)}`,
      });
      setCalculationFeedback("Calculation added to Recent Calculations.");
    } finally {
      guard.inFlight = false;
    }
  }, [
    mode, weight, purityPercent, rate, making, makingMode, stamp, extra,
    isPurityValid, isMakingValid, isOld, makingInputValue, makingChargeRupees, total, addHistory,
  ]);

  return (
    <div className="nkj-calc-with-history nkj-calc-ornament-layout">
      <section className="nkj-calc-ornament">
        <section className="nkj-calc-details-card">
          <header className="nkj-calc-section-heading">
            <Scale size={22} />
            <h3>{isOld ? "Old Ornament Details" : "Ornament Details"}</h3>
          </header>
          <div className="nkj-calc-fields">
            <label>
              <span className="nkj-calc-field-label"><Scale size={17} />{isOld ? "Weight (gm)" : "Net Weight (gm)"} <b>*</b></span>
              <input {...numberInput(weight, (value) => updateDraftField("weight", value))} placeholder="Enter weight" />
            </label>
            {isOld && (
              <label>
                <span className="nkj-calc-field-label"><BadgeCheck size={17} />Purity (%) <b>*</b></span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  inputMode="decimal"
                  value={purity}
                  onChange={(event) => updateDraftField("purity", event.target.value)}
                  onWheel={(event) => event.currentTarget.blur()}
                  placeholder="Enter purity percentage"
                  aria-label="Purity percentage"
                  aria-invalid={!isPurityValid}
                />
                {!isPurityValid && <small className="nkj-calc-error">Purity must be between 0 and 100%.</small>}
              </label>
            )}
            <label className={isOld ? "nkj-calc-rate-field nkj-calc-rate-field-old" : "nkj-calc-rate-field"}>
              <span className="nkj-calc-field-label"><Coins size={17} />Rate / GM (₹) <b>*</b></span>
              <input {...numberInput(rate, (value) => updateDraftField("rate", value))} placeholder="Enter rate per gram" />
            </label>
            {!isOld && (
              <>
                <label className="nkj-calc-making-mode-field">
                  <span className="nkj-calc-field-label"><Tag size={17} />Making Charge Type</span>
                  <select
                    value={makingMode}
                    onChange={(event) => updateDraftField("makingMode", event.target.value)}
                    aria-label="Making charge type"
                  >
                    <option value="rupees">Rupees (₹)</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                </label>
                <label>
                  <span className="nkj-calc-field-label"><Wrench size={17} />Making Charge ({makingMode === "percentage" ? "%" : "₹"})</span>
                  <input
                    type="number"
                    min="0"
                    max={makingMode === "percentage" ? 100 : undefined}
                    step="0.01"
                    inputMode="decimal"
                    value={making ?? ""}
                    onChange={(event) => updateDraftField("making", event.currentTarget.value)}
                    onWheel={(event) => event.currentTarget.blur()}
                    placeholder={makingMode === "percentage" ? "Enter percentage (e.g. 12)" : "Enter making charge in rupees"}
                    aria-label={makingMode === "percentage" ? "Making charge percentage" : "Making charge in rupees"}
                    aria-invalid={makingMode === "percentage" && !isMakingValid}
                  />
                  {!isMakingValid && <small className="nkj-calc-error">Making charge percentage must be between 0 and 100%.</small>}
                </label>
                <label><span className="nkj-calc-field-label"><Stamp size={17} />Stamp Charge (₹)</span><input {...numberInput(stamp, (value) => updateDraftField("stamp", value))} placeholder="0.00" /></label>
                <label><span className="nkj-calc-field-label"><CirclePlus size={17} />Extra Charge (₹)</span><input {...numberInput(extra, (value) => updateDraftField("extra", value))} placeholder="0.00" /></label>
              </>
            )}
          </div>
        </section>

        <section className={`nkj-calc-result-card ${isOld ? "is-old" : "is-new"}`}>
          <header className="nkj-calc-result-hero">
            <span>{isOld ? "OLD ORNAMENT VALUE" : "NEW ORNAMENT TOTAL"}</span>
            <strong>₹ {money(total)}</strong>
          </header>
          <div className="nkj-calc-breakdown">
            {isOld ? (
              <>
                <div className="nkj-calc-breakdown-row"><span className="nkj-calc-breakdown-label"><Scale size={18} />Gross Weight</span><strong>{money(weight)} gm</strong></div>
                <div className="nkj-calc-breakdown-row"><span className="nkj-calc-breakdown-label"><BadgeCheck size={18} />Purity</span><strong>{money(purityPercent)}%</strong></div>
                <div className="nkj-calc-breakdown-row"><span className="nkj-calc-breakdown-label"><Gem size={18} />Pure Weight</span><strong>{money(pureWeight)} gm</strong></div>
                <div className="nkj-calc-breakdown-row"><span className="nkj-calc-breakdown-label"><Coins size={18} />Rate per Gram</span><strong>₹ {money(rate)}</strong></div>
                <div className="nkj-calc-breakdown-row"><span className="nkj-calc-breakdown-label"><CalculatorIcon size={18} />Calculation ({money(pureWeight)} × {money(rate)})</span><strong>₹ {money(metalValue)}</strong></div>
                {!isPurityValid && <small className="nkj-calc-error">Enter a purity percentage from 0 to 100.</small>}
                <div className="nkj-calc-total-row"><span>Old Ornament Value</span><strong>₹ {money(total)}</strong></div>
              </>
            ) : (
              <>
                <div className="nkj-calc-breakdown-row"><span className="nkj-calc-breakdown-label"><Coins size={18} />Metal Value ({money(weight)} × {money(rate)})</span><strong>₹ {money(metalValue)}</strong></div>
                <div className="nkj-calc-breakdown-row">
                  <span className="nkj-calc-breakdown-label"><Wrench size={18} />Making Charge{makingMode === "percentage" ? ` (${makingInputValue}%)` : ""}</span>
                  <strong>₹ {money(isMakingValid ? makingChargeRupees : 0)}</strong>
                </div>
                <div className="nkj-calc-breakdown-row"><span className="nkj-calc-breakdown-label"><Stamp size={18} />Stamp Charge</span><strong>₹ {money(stamp)}</strong></div>
                <div className="nkj-calc-breakdown-row"><span className="nkj-calc-breakdown-label"><CirclePlus size={18} />Extra Charge</span><strong>₹ {money(extra)}</strong></div>
                {!isMakingValid && <small className="nkj-calc-error">Enter a making charge percentage from 0 to 100.</small>}
                <div className="nkj-calc-total-row"><span>Total Amount</span><strong>₹ {money(total)}</strong></div>
              </>
            )}
          </div>
          <div className="nkj-calc-result-actions">
            {calculationFeedback && <small className="nkj-calc-calculation-feedback" role="status">{calculationFeedback}</small>}
            <div>
              <button type="button" className="nkj-calc-calculate" onClick={handleCalculate}>
                <CalculatorIcon size={16} /> Calculate
              </button>
              <button type="button" className="nkj-calc-reset" onClick={reset}>
                <RotateCcw size={16} /> Reset
              </button>
            </div>
          </div>
        </section>
      </section>
      <CalculationHistory title="Recent Calculations (Last 15)" items={history} onClear={clearHistory} />
    </div>
  );
}

export default function CalculatorPage() {
  const [mode, setMode] = useState("new");
  // Keep each Ornament tab's history separate as well as its persisted draft.
  const [newOrnamentHistory, addNewOrnamentHistory, clearNewOrnamentHistory] =
    usePersistentHistory("nkj_new_ornament_calculation_history", 15);
  const [oldOrnamentHistory, addOldOrnamentHistory, clearOldOrnamentHistory] =
    usePersistentHistory("nkj_old_ornament_calculation_history", 15);

  const changeMode = (nextMode) => {
    if (nextMode === mode) return;
    // Preserve each calculator's independent values when changing tabs.
    setMode(nextMode);
  };

  const options = [
    { id: "new", label: "New Ornaments", icon: Gem, description: "Gold / silver ornament calculation" },
    { id: "old", label: "Old Ornaments", icon: Scale, description: "Old gold exchange value" },
    { id: "manual", label: "Manual Calculator", icon: CalculatorIcon, description: "Standard arithmetic calculator" },
  ];

  return (
    <Page active="calculator">
      <div className={`nkj-calculator-page nkj-calculator-page--${mode}`} >
        <header className="nkj-calculator-heading">
          <span>JEWELLERY TOOLS</span>
          <h1><CalculatorIcon size={25} /> Calculator</h1>
          <p>Calculate ornament values and everyday amounts quickly.</p>
        </header>

        <div className="nkj-calculator-layout">
          <aside className="nkj-calculator-options" aria-label="Calculator type">
            {options.map(({ id, label, icon: Icon, description }) => (
              <button
                type="button"
                key={id}
                data-calculator-mode={id}
                className={mode === id ? "active" : ""}
                onClick={() => changeMode(id)}
              >
                <span className="nkj-calculator-option-icon"><Icon size={20} /></span>
                <span className="nkj-calculator-option-copy">
                  <b>{label}</b>
                  <small>{description}</small>
                </span>
              </button>
            ))}
          </aside>

          <section className="nkj-calculator-workspace">
            <div className="nkj-calculator-workspace-title">
              {mode === "manual" ? <CalculatorIcon size={24} /> : <Coins size={20} />}
              <h2>{options.find((option) => option.id === mode)?.label}</h2>
            </div>
            <div className="nkj-calculator-panel" hidden={mode !== "new"}>
              <OrnamentCalculator mode="new" active={mode === "new"} history={newOrnamentHistory} addHistory={addNewOrnamentHistory} clearHistory={clearNewOrnamentHistory} />
            </div>
            <div className="nkj-calculator-panel" hidden={mode !== "old"}>
              <OrnamentCalculator mode="old" active={mode === "old"} history={oldOrnamentHistory} addHistory={addOldOrnamentHistory} clearHistory={clearOldOrnamentHistory} />
            </div>
            <div className="nkj-calculator-panel" hidden={mode !== "manual"}>
              <ManualCalculator active={mode === "manual"} />
            </div>
          </section>
        </div>
      </div>
    </Page>
  );
}
