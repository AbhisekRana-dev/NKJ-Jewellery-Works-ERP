import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Calculator as CalculatorIcon, Coins, Gem, Scale, Delete, RotateCcw } from "lucide-react";
import { Page } from "../../shared/layouts/OwnerShell";
import "./CalculatorPage.css";

const INITIAL_ORNAMENT_DRAFT = Object.freeze({
  weight: "", purity: "", rate: "", making: "",
  makingMode: "rupees", stamp: "", extra: "",
});
const INITIAL_MANUAL_DRAFT = Object.freeze({ expression: "0", result: "0", error: "" });

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
});

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
    if (token === "(") {
      take();
      const value = expression();
      if (take() !== ")") throw new Error("Missing closing bracket.");
      return value;
    }
    if (!token || !/^\d*\.?\d+$/.test(token)) {
      throw new Error("Enter a valid number.");
    }
    take();
    return Number(token);
  };

  const term = () => {
    let value = factor();
    while (["*", "/", "%"].includes(peek())) {
      const operator = take();
      const right = factor();
      if ((operator === "/" || operator === "%") && right === 0) {
        throw new Error("Cannot divide by zero.");
      }
      value = operator === "*"
        ? value * right
        : operator === "/"
          ? value / right
          : value % right;
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
    setDraft((current) => ({
      ...current,
      error: "",
      expression: current.expression === "0" && /\d/.test(value) ? value : current.expression + value,
    }));
  }, [setDraft]);

  const calculate = useCallback(() => {
    setDraft((current) => {
      try {
        const value = evaluateExpression(current.expression);
        const formatted = String(Number(value.toFixed(8)));
        return { ...current, result: formatted, expression: formatted, error: "" };
      } catch (err) {
        return { ...current, error: err.message || "Invalid calculation." };
      }
    });
  }, [setDraft]);

  const clear = useCallback(() => {
    setDraft({ ...INITIAL_MANUAL_DRAFT });
  }, [setDraft]);

  const confirmReset = useCallback(() => {
    if (window.confirm("Reset Manual Calculator? Only its saved draft will be cleared.")) clear();
  }, [clear]);

  const backspace = useCallback(() => {
    setDraft((current) => ({
      ...current,
      error: "",
      expression: current.expression.length <= 1 ? "0" : current.expression.slice(0, -1),
    }));
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
        if (event.target instanceof Element && !event.target.closest(".nkj-calculator-page")) return;
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
  }, [active, append, calculate, confirmReset, backspace]);

  const keys = [
    ["AC", "clear"], ["(", "("], [")", ")"], ["÷", "/"],
    ["7", "7"], ["8", "8"], ["9", "9"], ["×", "*"],
    ["4", "4"], ["5", "5"], ["6", "6"], ["−", "-"],
    ["1", "1"], ["2", "2"], ["3", "3"], ["+", "+"],
    ["%", "%"], ["0", "0"], [".", "."], ["=", "equal"],
  ];

  return (
    <section className="nkj-calc-manual">
      <div className="nkj-calc-display">
        <span>MANUAL CALCULATOR</span>
        <div className="nkj-calc-expression" aria-live="polite">{expression}</div>
        <div className="nkj-calc-result">= {result}</div>
        {error && <small className="nkj-calc-error">{error}</small>}
      </div>
      <div className="nkj-calc-keypad" aria-label="Manual calculator keypad">
        {keys.map(([label, value]) => (
          <button
            type="button"
            key={label}
            className={value === "clear" ? "utility" : value === "equal" ? "equal" : ["+", "-", "*", "/", "%"].includes(value) ? "operator" : ""}
            onClick={() => value === "clear" ? confirmReset() : value === "equal" ? calculate() : append(value)}
          >
            {label}
          </button>
        ))}
        <button type="button" className="backspace" onClick={backspace} aria-label="Delete last character">
          <Delete size={18} /> DEL
        </button>
      </div>
      <button type="button" className="nkj-calc-manual-reset" onClick={confirmReset}>
        <RotateCcw size={15} /> Reset Manual Calculator
      </button>
      <p className="nkj-calc-keyboard-hint">Keyboard: 0–9, +, −, *, /, %, brackets · Enter or = to calculate · Backspace to delete · Esc resets immediately</p>
    </section>
  );
}

function OrnamentCalculator({ mode, active }) {
  const isOld = mode === "old";
  const draftKey = isOld ? "nkj_old_ornament_draft" : "nkj_new_ornament_draft";
  const [draft, setDraft] = usePersistentDraft(draftKey, INITIAL_ORNAMENT_DRAFT);
  const { weight, purity, rate, making, makingMode, stamp, extra } = draft;
  const updateDraftField = useCallback((field, value) => {
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
  }, [setDraft]);

  const confirmReset = useCallback(() => {
    const name = isOld ? "Old Ornaments" : "New Ornaments";
    if (window.confirm(`Reset ${name}? Only its saved draft will be cleared.`)) reset();
  }, [isOld, reset]);

  // Escape is a quick reset for the currently active ornament calculator.
  // Unlike the Reset button, this keyboard shortcut does not show a popup.
  useEffect(() => {
    if (!active) return undefined;

    const handleEscape = (event) => {
      if (event.key !== "Escape" || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      const isInCalculator = target instanceof Element
        ? Boolean(target.closest(".nkj-calculator-page"))
        : target === document.body || target === document.documentElement;
      if (!isInCalculator) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      reset();
    };

    window.addEventListener("keydown", handleEscape, true);
    return () => window.removeEventListener("keydown", handleEscape, true);
  }, [active, reset]);

  return (
    <section className="nkj-calc-ornament">
      <div className="nkj-calc-fields">
        <label>
          {isOld ? "Weight (gm)" : "Net Weight (gm)"}
          <input {...numberInput(weight, (value) => updateDraftField("weight", value))} placeholder="Enter weight" />
        </label>
        {isOld && (
          <label>
            Purity (%)
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              inputMode="decimal"
              value={purity}
              onChange={(event) => updateDraftField("purity", event.target.value)}
              placeholder="Enter purity percentage"
              aria-label="Purity percentage"
              aria-invalid={!isPurityValid}
            />
            {!isPurityValid && <small className="nkj-calc-error">Purity must be between 0 and 100%.</small>}
          </label>
        )}
        <label>
          Rate / GM (₹)
          <input {...numberInput(rate, (value) => updateDraftField("rate", value))} placeholder="Enter rate per gram" />
        </label>
        {!isOld && (
          <>
            <label className="nkj-calc-making-mode-field">
              Making Charge Type
              <select
                value={makingMode}
                onChange={(event) => {
                  // Keep the entered charge when switching modes. The value is
                  // reinterpreted as rupees or percentage without clearing it.
                  updateDraftField("makingMode", event.target.value);
                }}
                aria-label="Making charge type"
              >
                <option value="rupees">Rupees (₹)</option>
                <option value="percentage">Percentage (%)</option>
              </select>
            </label>
            <label>
              Making Charge ({makingMode === "percentage" ? "%" : "₹"})
              <input
                type="number"
                min="0"
                max={makingMode === "percentage" ? 100 : undefined}
                step="0.01"
                inputMode="decimal"
                value={making ?? ""}
                onChange={(event) => updateDraftField("making", event.currentTarget.value)}
                placeholder={makingMode === "percentage"
                  ? "Enter percentage (e.g. 12)"
                  : "Enter making charge in rupees"}
                aria-label={makingMode === "percentage" ? "Making charge percentage" : "Making charge in rupees"}
                aria-invalid={makingMode === "percentage" && !isMakingValid}
              />
              {!isMakingValid && <small className="nkj-calc-error">Making charge percentage must be between 0 and 100%.</small>}
            </label>
            <label>Stamp Charge (₹)<input {...numberInput(stamp, (value) => updateDraftField("stamp", value))} placeholder="0.00" /></label>
            <label>Extra Charge (₹)<input {...numberInput(extra, (value) => updateDraftField("extra", value))} placeholder="0.00" /></label>
          </>
        )}
      </div>
      <div className="nkj-calc-result-card">
        <div>
          <span>{isOld ? "OLD ORNAMENT VALUE" : "NEW ORNAMENT TOTAL"}</span>
          <strong>₹ {money(total)}</strong>
          {isOld
            ? <>
                <small>Pure weight: {money(pureWeight)} gm ({weight || "0"} gm × {purity.trim() === "" ? "100% default" : purity + "%"})</small>
                <small>{purity.trim() === "" ? "Value = weight × rate per gram (100% purity assumed)" : "Value = weight × purity ÷ 100 × rate per gram"}</small>
                {!isPurityValid && <small className="nkj-calc-error">Enter a purity percentage from 0 to 100.</small>}
              </>
            : <>
                <small>Metal value: ₹ {money(metalValue)}</small>
                <small>Making charge{makingMode === "percentage" ? ` (${makingInputValue}% of metal value)` : ""}: ₹ {money(isMakingValid ? makingChargeRupees : 0)}</small>
                {makingMode === "percentage" && <small>Calculation: ₹ {money(metalValue)} × {makingInputValue}% ÷ 100</small>}
                <small>Stamp + extra charges: ₹ {money(Math.max(0, Number(stamp) || 0) + Math.max(0, Number(extra) || 0))}</small>
                {!isMakingValid && <small className="nkj-calc-error">Enter a making charge percentage from 0 to 100.</small>}
              </>}
          <small className="nkj-calc-reset-hint">Press Esc to reset immediately, or click Reset for confirmation.</small>
        </div>
        <button type="button" className="nkj-calc-reset" onClick={confirmReset}>
          <RotateCcw size={15} /> Reset
        </button>
      </div>
    </section>
  );
}

export default function CalculatorPage() {
  const [mode, setMode] = useState("new");

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
      <div className="nkj-calculator-page">
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
              <Coins size={20} />
              <h2>{options.find((option) => option.id === mode)?.label}</h2>
            </div>
            <div className="nkj-calculator-panel" hidden={mode !== "new"}>
              <OrnamentCalculator mode="new" active={mode === "new"} />
            </div>
            <div className="nkj-calculator-panel" hidden={mode !== "old"}>
              <OrnamentCalculator mode="old" active={mode === "old"} />
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
