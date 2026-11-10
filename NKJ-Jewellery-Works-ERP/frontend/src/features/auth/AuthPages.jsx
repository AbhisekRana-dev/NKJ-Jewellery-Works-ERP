import "./AuthPages.css";
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  CalendarDays, Diamond, ShieldCheck, Users, LockKeyhole, User,
  EyeOff, Eye,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "../../core/auth/AuthProvider";
import { Nav } from "../../shared/layouts/OwnerShell";

export function TotpSetup() {
  const [username, setUsername] = useState("admin2026");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [destination, setDestination] = useState("");
  const [uri, setUri] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendOtp(e) {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      const response = await fetch("/api/auth/setup-email/start", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not send setup OTP.");
      setChallengeId(data.challengeId); setDestination(data.destination || "your owner email");
      setSetupToken(""); setUri(""); setCode("");
    } catch (e2) { setError(e2.message); }
    finally { setBusy(false); }
  }

  async function verifyOtp(e) {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      const response = await fetch("/api/auth/setup-email/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, code }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Email OTP verification failed.");
      setSetupToken(data.setupToken);
      const qrResponse = await fetch("/api/auth/setup-uri", { headers: { "X-Setup-Token": data.setupToken } });
      const qrData = await qrResponse.json();
      if (!qrResponse.ok) throw new Error(qrData.message || "Could not generate authenticator setup QR.");
      setUri(qrData.otpauthUri);
    } catch (e2) { setError(e2.message); }
    finally { setBusy(false); }
  }

  return (
    <>
      <Nav active="login" />
      <div className="setup-screen">
        <div className="setup-card">
          <span className="eyebrow">FIRST-TIME OWNER SECURITY SETUP</span>
          <h2>Verify your owner email</h2>
          <p>Before generating the Google Authenticator setup QR, verify the owner mailbox. The one-time code is sent to the configured owner email address.</p>
          {!challengeId ? (
            <form onSubmit={sendOtp}>
              <label>Admin username</label><input value={username} onChange={e=>setUsername(e.target.value)} required autoComplete="username" />
              <label>Admin password</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password" />
              <button className="primary full" disabled={busy}>{busy ? "Sending OTP…" : "Send email OTP"}</button>
            </form>
          ) : !uri ? (
            <form onSubmit={verifyOtp}>
              <p className="success">OTP sent to {destination}. It expires in 5 minutes.</p>
              <label>Email verification code</label>
              <input inputMode="numeric" autoComplete="one-time-code" maxLength="6" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} required />
              <button className="primary full" disabled={busy || code.length!==6}>{busy ? "Verifying…" : "Verify OTP and continue"}</button>
              <button type="button" className="secondary full" onClick={()=>{setChallengeId("");setCode("");setError("");}}>Start again</button>
            </form>
          ) : (
            <div className="qr-box">
              <QRCodeSVG value={uri} size={220} />
              <b>Email verified. Scan using Google Authenticator.</b>
              <p>Keep this QR private. The configured TOTP_SECRET in backend/.env must match this setup URI before owner login can use authenticator codes.</p>
              <code>{uri}</code>
            </div>
          )}
          {error && <p className="error">{error}</p>}
          <Link className="link-button" to="/login">Return to login</Link>
        </div>
      </div>
    </>
  );
}

export function Login() {
  const { begin, verify, isAdmin } = useAuth();

  const nav = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState("");

  const [password, setPassword] = useState("");

  const [code, setCode] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");

  const [busy, setBusy] = useState(false);

  if (isAdmin) return <NavigateHome />;

  async function submit(e) {
    e.preventDefault();

    setError("");

    setBusy(true);

    try {
      await begin(username, password);

      await verify(code);

      const from = location.state?.from;
      const destination = from
        ? `${from.pathname || "/"}${from.search || ""}${from.hash || ""}`
        : "/";
      nav(destination, { replace: true });
    } catch (x) {
      setError(x.message);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setUsername("admin2026");

    setPassword("");

    setCode("");

    setError("");
  }

  return (
    <>
      <Nav active="login" />

      <div className="nkj-login-page">
        <div className="nkj-login-brand">
          <img
            src="/nkj-logo-reference.png"
            alt="NKJ logo"
            className="nkj-login-logo"
          />

          <h1>
            Nandikishor
            <br />
            Jewellery Works
          </h1>

          <div className="nkj-login-ornament">◆ ━━━━━━━━━ ◆</div>

          <p className="nkj-login-location">
            <CalendarDays /> Sasra, Gopiballavpur, Jhargram
          </p>

          <ul>
            <li>
              <Diamond /> Pure Gold & Silver
            </li>

            <li>
              <span className="nkj-ring-icon">♧</span> Traditional Designs
            </li>

            <li>
              <ShieldCheck /> Trusted Quality
            </li>

            <li>
              <Users /> Customer Satisfaction
            </li>
          </ul>
        </div>

        <section className="nkj-login-card">
          <div className="nkj-login-lock">
            <LockKeyhole />
          </div>

          <div className="nkj-login-rule">
            <span></span>◆<span></span>
          </div>

          <h2>Account Login</h2>

          <p className="nkj-login-subtitle">
            Login to Nandikishor Jewellery Works
          </p>

          <form onSubmit={submit}>
            <label className="nkj-login-field">
              <User />

              <span>
                <b>Login ID</b>

                <input
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your Login ID"
                  required
                />
              </span>
            </label>

            <label className="nkj-login-field">
              <LockKeyhole />

              <span>
                <b>Password</b>

                <div className="nkj-password-wrap">
                  <input
                    autoComplete="current-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your Password"
                    required
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </span>
            </label>

            <label className="nkj-login-field nkj-totp-field">
              <ShieldCheck />

              <span>
                <b>Google Authenticator (OTP)</b>

                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength="6"
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="Enter 6-digit OTP"
                  required
                />
              </span>

              <span className="nkj-google-mark">✣</span>
            </label>

            <div className="nkj-otp-note">
              <ShieldCheck /> Enter the 6-digit code from Google Authenticator
              app
            </div>

            {error && <p className="error">{error}</p>}

            <button
              className="nkj-login-submit"
              type="submit"
              disabled={busy || code.length !== 6}
            >
              {busy ? "Verifying…" : "⇥  Login"}
            </button>

            <div className="nkj-reset-row">
              <span></span>

              <button type="button" onClick={reset}>
                Reset
              </button>

              <span></span>
            </div>
          </form>

          <Link className="nkj-totp-setup-link" to="/setup-totp">
            First-time setup: connect Google Authenticator
          </Link>
        </section>
      </div>
    </>
  );
}

function NavigateHome() {
  const nav = useNavigate();
  const location = useLocation();
  const from = location.state?.from;
  const destination = from
    ? `${from.pathname || "/"}${from.search || ""}${from.hash || ""}`
    : "/";

  useEffect(() => {
    nav(destination, { replace: true });
  }, [nav, destination]);

  return null;
}

