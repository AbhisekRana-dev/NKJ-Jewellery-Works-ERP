import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Calculator as CalculatorIcon, Coins, Gem, Scale, Delete, RotateCcw } from "lucide-react";
import { Page } from "../../shared/layouts/OwnerShell";
import "./CalculatorPage.css";

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

function ManualCalculator() {
  const [expression, setExpression] = useState("0");
  const [result, setResult] = useState("0");
  const [error, setError] = useState("");

  const append = useCallback((value) => {
    setError("");
    setExpression((current) => current === "0" && /\d/.test(value)
      ? value
      : current + value);
  }, []);

  const calculate = useCallback(() => {
    try {
      const value = evaluateExpression(expression);
      setResult(String(Number(value.toFixed(8))));
      setExpression(String(Number(value.toFixed(8))));
      setError("");
    } catch (err) {
      setError(err.message || "Invalid calculation.");
    }
  }, [expression]);

  const clear = useCallback(() => {
    setExpression("0");
    setResult("0");
    setError("");
  }, []);

  const backspace = useCallback(() => {
    setError("");
    setExpression((current) => current.length <= 1 ? "0" : current.slice(0, -1));
  }, []);

  // Capture keyboard input while this calculator is mounted. Capture mode
  // lets the calculator receive keys before other page shortcuts can swallow them.
  useEffect(() => {
    const handleCalculatorKeyDown = (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      const target = event.target;
      const isEditingField = target instanceof HTMLElement && (
        target.isContentEditable
        || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
        || Boolean(target.closest('[contenteditable="true"], [role="textbox"]'))
      );
      if (isEditingField) return;

      const key = event.key;
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

      if (key === "Escape") {
        consume();
        clear();
      }
    };

    window.addEventListener("keydown", handleCalculatorKeyDown, true);
    return () => window.removeEventListener("keydown", handleCalculatorKeyDown, true);
  }, [append, calculate, clear, backspace]);

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
            onClick={() => value === "clear" ? clear() : value === "equal" ? calculate() : append(value)}
          >
            {label}
          </button>
        ))}
        <button type="button" className="backspace" onClick={backspace} aria-label="Delete last character">
          <Delete size={18} /> DEL
        </button>
      </div>
      <p className="nkj-calc-keyboard-hint">Keyboard: 0–9, +, −, *, /, %, brackets · Enter or = to calculate · Backspace to delete · Esc to clear</p>
    </section>
  );
}

function OrnamentCalculator({ mode }) {
  const isOld = mode === "old";
  const [weight, setWeight] = useState("");
  const [rate, setRate] = useState("");
  const [making, setMaking] = useState("");
  const [stamp, setStamp] = useState("");
  const [extra, setExtra] = useState("");
  const total = useMemo(() => {
    const metalValue = Math.max(0, Number(weight) || 0) * Math.max(0, Number(rate) || 0);
    return isOld
      ? metalValue
      : metalValue + Math.max(0, Number(making) || 0) + Math.max(0, Number(stamp) || 0) + Math.max(0, Number(extra) || 0);
  }, [weight, rate, making, stamp, extra, isOld]);

  const reset = () => {
    setWeight("");
    setRate("");
    setMaking("");
    setStamp("");
    setExtra("");
  };

  return (
    <section className="nkj-calc-ornament">
      <div className="nkj-calc-fields">
        <label>
          {isOld ? "Pure Weight (gm)" : "Net Weight (gm)"}
          <input {...numberInput(weight, setWeight)} placeholder="Enter weight" />
        </label>
        <label>
          Rate / GM (₹)
          <input {...numberInput(rate, setRate)} placeholder="Enter rate per gram" />
        </label>
        {!isOld && (
          <>
            <label>Making Charge (₹)<input {...numberInput(making, setMaking)} placeholder="0.00" /></label>
            <label>Stamp Charge (₹)<input {...numberInput(stamp, setStamp)} placeholder="0.00" /></label>
            <label>Extra Charge (₹)<input {...numberInput(extra, setExtra)} placeholder="0.00" /></label>
          </>
        )}
      </div>
      <div className="nkj-calc-result-card">
        <div>
          <span>{isOld ? "OLD ORNAMENT VALUE" : "NEW ORNAMENT TOTAL"}</span>
          <strong>₹ {money(total)}</strong>
          <small>{isOld ? "Pure weight × rate per gram" : "Metal value + making + stamp + extra charges"}</small>
        </div>
        <button type="button" className="nkj-calc-reset" onClick={reset}>
          <RotateCcw size={15} /> Reset
        </button>
      </div>
    </section>
  );
}

export default function CalculatorPage() {
  const [mode, setMode] = useState("new");
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
                onClick={() => setMode(id)}
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
            {mode === "manual"
              ? <ManualCalculator />
              : <OrnamentCalculator key={mode} mode={mode} />}
          </section>
        </div>
      </div>
    </Page>
  );
}
