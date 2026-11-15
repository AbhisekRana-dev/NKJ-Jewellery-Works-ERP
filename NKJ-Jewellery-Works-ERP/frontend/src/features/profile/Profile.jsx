import "./Profile.css";
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Nav } from "../../shared/layouts/OwnerShell";
import { useAuth } from "../../core/auth/AuthProvider";
import { request } from "../../core/api/client";
import { useRealtimeRefresh } from "../../core/realtime/realtime";
import {
  UserRound,
  Mail,
  Phone,
  MapPin,
  ShieldCheck,
  LockKeyhole,
  Camera,
  Pencil,
  Save,
  X,
  KeyRound,
  Crown,
  Info,
  CheckCircle2,
  Building2,
  History,
  MonitorSmartphone,
  LogOut,
  RefreshCw,
  Eye,
  ShieldAlert,
} from "lucide-react";

export default function Profile() {
  const { user, logout } = useAuth();
  const fileRef = useRef(null);

  const username =
    typeof user === "string" ? user : user?.username || "admin2026";

  const [editing, setEditing] = useState(false);
  const [photo, setPhoto] = useState("");
  const [savedPhoto, setSavedPhoto] = useState("");
  const [message, setMessage] = useState("");
  const [savedForm, setSavedForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sessionSummary, setSessionSummary] = useState({ activeCount: 0, historyCount: 0 });
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [managerPassword, setManagerPassword] = useState("");
  const [managerToken, setManagerToken] = useState("");
  const [loginSessions, setLoginSessions] = useState([]);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionBusy, setSessionBusy] = useState("");
  const [sessionMessage, setSessionMessage] = useState("");
  const [showManagerPassword, setShowManagerPassword] = useState(false);

  const [form, setForm] = useState({
    fullName: "Abhisek Rana",
    username,
    email: "",
    phone: "",
    designation: "Administrator",
    company: "Nandikishor Jewellery Works",
    address: "Sasra, Gopiballavpur, Jhargram, West Bengal - 721506",
    about:
      "Administrator of Nandikishor Jewellery Works, responsible for managing jewellery billing operations, customer information, invoices and business records.",
  });

  useEffect(() => {
    let active = true;
    request("/admin/profile")
      .then((data) => {
        if (!active || !data) return;
        const loaded = {
          ...form,
          ...data,
          username,
        };
        setForm(loaded);
        setSavedForm(loaded);
        setPhoto(data.photoDataUrl || "");
        setSavedPhoto(data.photoDataUrl || "");
      })
      .catch((error) => {
        if (active) setMessage(error.message || "Could not load profile information.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [username]);

  useEffect(() => {
    let active = true;
    request("/auth/sessions/summary")
      .then((data) => {
        if (active) setSessionSummary({
          activeCount: Number(data?.activeCount || 0),
          historyCount: Number(data?.historyCount || 0),
        });
      })
      .catch(() => {
        if (active) setSessionSummary({ activeCount: 0, historyCount: 0 });
      });
    return () => { active = false; };
  }, [username]);

  const refreshSessionSummary = async () => {
    try {
      const data = await request("/auth/sessions/summary");
      setSessionSummary({
        activeCount: Number(data?.activeCount || 0),
        historyCount: Number(data?.historyCount || 0),
      });
    } catch {
      // The current profile remains usable if the session summary is unavailable.
    }
  };

  const loadLoginSessions = async (grant = managerToken) => {
    if (!grant) return;
    setSessionLoading(true);
    setSessionMessage("");
    try {
      const data = await request("/auth/sessions", {
        headers: { "X-Owner-Session-Manager": grant },
      });
      setLoginSessions(Array.isArray(data?.sessions) ? data.sessions : []);
      await refreshSessionSummary();
    } catch (error) {
      setSessionMessage(error.message || "Could not load owner login history.");
    } finally {
      setSessionLoading(false);
    }
  };

  const openLoginDetails = () => {
    setSessionDialogOpen(true);
    setManagerPassword("");
    setManagerToken("");
    setLoginSessions([]);
    setSessionMessage("");
    setShowManagerPassword(false);
  };

  const unlockLoginDetails = async (event) => {
    event.preventDefault();
    if (!managerPassword) {
      setSessionMessage("Enter the owner login-management password.");
      return;
    }
    setSessionBusy("unlock");
    setSessionMessage("");
    try {
      const result = await request("/auth/sessions/unlock", {
        method: "POST",
        body: JSON.stringify({ password: managerPassword }),
      });
      setManagerToken(result.managerToken);
      setManagerPassword("");
      await loadLoginSessions(result.managerToken);
    } catch (error) {
      setSessionMessage(error.message || "Owner login details could not be unlocked.");
    } finally {
      setSessionBusy("");
    }
  };

  const revokeLoginSession = async (session) => {
    if (!managerToken || !session?.sessionId) return;
    const target = session.current ? "this device" : "this device session";
    if (!window.confirm("Log out " + target + "? The device will need to sign in again.")) return;
    setSessionBusy(session.sessionId);
    setSessionMessage("");
    try {
      const result = await request("/auth/sessions/" + encodeURIComponent(session.sessionId) + "/logout", {
        method: "POST",
        headers: { "X-Owner-Session-Manager": managerToken },
      });
      if (result.currentSession) {
        await logout();
        return;
      }
      await loadLoginSessions(managerToken);
    } catch (error) {
      setSessionMessage(error.message || "Could not log out that device.");
    } finally {
      setSessionBusy("");
    }
  };

  const revokeOtherLoginSessions = async () => {
    if (!managerToken) return;
    if (!window.confirm("Log out every other owner device? This device will stay signed in.")) return;
    setSessionBusy("others");
    setSessionMessage("");
    try {
      const result = await request("/auth/sessions/logout-others", {
        method: "POST",
        headers: { "X-Owner-Session-Manager": managerToken },
      });
      setSessionMessage((result.loggedOutCount || 0) + " other active device(s) signed out.");
      await loadLoginSessions(managerToken);
    } catch (error) {
      setSessionMessage(error.message || "Could not sign out other devices.");
    } finally {
      setSessionBusy("");
    }
  };

  const closeLoginDetails = () => {
    setSessionDialogOpen(false);
    setManagerPassword("");
    setManagerToken("");
    setLoginSessions([]);
    setSessionMessage("");
  };

  const formatSessionDate = (value) => {
    if (!value) return "Not available";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Not available" : new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short",
    }).format(date);
  };

  const formatSessionDuration = (seconds) => {
    const total = Math.max(0, Number(seconds) || 0);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const remainingSeconds = total % 60;
    if (hours) return hours + "h " + minutes + "m";
    if (minutes) return minutes + "m " + remainingSeconds + "s";
    return remainingSeconds + "s";
  };

  const formatLogoutReason = (reason, status) => {
    if (reason === "INACTIVITY_TIMEOUT") return "Automatic Logout (30 min inactivity)";
    if (reason === "SESSION_EXPIRED" || status === "EXPIRED") return "Session Expired";
    if (reason === "MANUAL_LOGOUT" || reason === "REVOKED_BY_OWNER") return "Manual Logout";
    return status === "ACTIVE" ? "Currently Active" : "Not recorded";
  };

  const refreshProfile = async () => {
    if (editing) return;
    try {
      const data = await request("/admin/profile");
      if (!data) return;
      const updated = { ...data, username };
      setForm((current) => ({ ...current, ...updated }));
      setSavedForm((current) => ({ ...(current || {}), ...updated }));
      setPhoto(data.photoDataUrl || "");
      setSavedPhoto(data.photoDataUrl || "");
    } catch (error) {
      setMessage(error.message || "Could not synchronize profile information.");
    }
  };

  useRealtimeRefresh(refreshProfile, ["profile"]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage("Please select a valid image.");
      e.target.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setMessage("Photo must be less than 2 MB.");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(String(reader.result || ""));
      setMessage("Photo preview updated. Save your profile to keep the photo.");
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!form.fullName.trim()) {
      setMessage("Please enter your full name.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const result = await request("/admin/profile", {
        method: "PUT",
        body: JSON.stringify({
          ...form,
          username,
          photoDataUrl: photo,
        }),
      });
      const updated = { ...form, ...result, username };
      setForm(updated);
      setSavedForm(updated);
      setPhoto(result.photoDataUrl || photo);
      setSavedPhoto(result.photoDataUrl || photo);
      setEditing(false);
      setMessage("Profile saved successfully.");
    } catch (error) {
      setMessage(error.message || "Could not save profile changes.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (savedForm) setForm(savedForm);
    setPhoto(savedPhoto);
    setEditing(false);
    setMessage("");
  };

  const startEditing = () => {
    setSavedForm({ ...form });
    setSavedPhoto(photo);
    setEditing(true);
    setMessage("");
  };

  return (
    <>
      <Nav active="profile" />



      <div className="nk-profile">
        <div className="nk-profile-heading">
          <div>
            <span className="eyebrow">ACCOUNT MANAGEMENT</span>
            <h1>My Account</h1>
            <p>Manage your personal information and account settings.</p>
            {loading && <p>Loading saved profile…</p>}
          </div>
          <div className="nk-account-label">
            <Info size={19} />
            Administrator Account
          </div>
        </div>

        <div className="nk-profile-layout">
          <aside className="nk-sidebar">
            <div className="nk-cover" />

            <div className="nk-avatar-wrap">
              {photo ? (
                <img src={photo} alt="Profile" className="nk-avatar" />
              ) : (
                <div className="nk-avatar nk-avatar-placeholder">
                  <UserRound size={82} />
                </div>
              )}

              <button
                className="nk-camera"
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={!editing}
                title={editing ? "Change photo" : "Click Edit Profile to change photo"}
                aria-label="Change profile photo"
              >
                <Camera size={23} />
              </button>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                disabled={!editing}
                onChange={handlePhoto}
              />
            </div>

            <div className="nk-sidebar-info">
              <h2>{form.fullName}</h2>
              <span className="nk-role">
                <Crown size={19} />
                Administrator
              </span>

              <div className="nk-divider" />

              <div className="nk-contact">
                <Mail size={23} />
                <span>{form.email || "Email not added"}</span>
              </div>
              <div className="nk-contact">
                <Phone size={23} />
                <span>{form.phone || "Phone not added"}</span>
              </div>
              <div className="nk-contact">
                <MapPin size={24} />
                <span>{form.address}</span>
              </div>
              <div className="nk-contact">
                <ShieldCheck size={23} />
                <span>Administrator account</span>
              </div>

              <div className="nk-status">
                <span className="nk-status-dot" />
                Account Active
              </div>
            </div>
          </aside>

          <main className="nk-content">
            <section className="nk-card">
              <div className="nk-card-heading">
                <div>
                  <h3>
                    <UserRound size={29} />
                    Personal Information
                  </h3>
                  <p>Update your personal account details.</p>
                </div>

                {!editing && (
                  <button
                    className="nk-edit"
                    type="button"
                    onClick={startEditing}
                  >
                    <Pencil size={18} />
                    Edit Profile
                  </button>
                )}
              </div>

              <div className="nk-fields">
                <div className="nk-field">
                  <label>Full Name</label>
                  <div className="nk-input">
                    <UserRound size={23} />
                    <input
                      name="fullName"
                      value={form.fullName}
                      onChange={handleChange}
                      disabled={!editing}
                    />
                  </div>
                </div>

                <div className="nk-field">
                  <label>Username</label>
                  <div className="nk-input">
                    <UserRound size={23} />
                    <input value={form.username} disabled />
                  </div>
                </div>

                <div className="nk-field">
                  <label>Email Address</label>
                  <div className="nk-input">
                    <Mail size={23} />
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="Enter email address"
                      disabled={!editing}
                    />
                  </div>
                </div>

                <div className="nk-field">
                  <label>Phone Number</label>
                  <div className="nk-input">
                    <Phone size={23} />
                    <input
                      type="tel"
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="Enter phone number"
                      disabled={!editing}
                    />
                  </div>
                </div>

                <div className="nk-field">
                  <label>Designation</label>
                  <div className="nk-input">
                    <Crown size={23} />
                    <input value={form.designation} disabled />
                  </div>
                </div>

                <div className="nk-field">
                  <label>Company</label>
                  <div className="nk-input">
                    <Building2 size={23} />
                    <input value={form.company} disabled />
                  </div>
                </div>

                <div className="nk-field nk-full">
                  <label>Business Address</label>
                  <div className="nk-input nk-textarea-input">
                    <MapPin size={23} />
                    <textarea
                      name="address"
                      rows={1}
                      value={form.address}
                      onChange={handleChange}
                      disabled={!editing}
                    />
                  </div>
                </div>
              </div>

              {editing && (
                <div className="nk-actions">
                  <button
                    className="nk-save"
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    <Save size={18} />
                    {saving ? "Saving…" : "Save Changes"}
                  </button>
                  <button
                    className="nk-cancel"
                    type="button"
                    onClick={handleCancel}
                  >
                    <X size={18} />
                    Cancel
                  </button>
                </div>
              )}

              {message && <div className="nk-message">{message}</div>}
            </section>

            <section className="nk-overview-grid">
              <div className="nk-overview">
                <div className="nk-overview-icon">
                  <ShieldCheck size={31} />
                </div>
                <div>
                  <h4>Account Status</h4>
                  <span className="nk-active">
                    <CheckCircle2 size={17} />
                    Active
                  </span>
                </div>
              </div>

              <div className="nk-overview">
                <div className="nk-overview-icon">
                  <LockKeyhole size={30} />
                </div>
                <div>
                  <h4>Authentication</h4>
                  <span className="nk-active">
                    <CheckCircle2 size={17} />
                    TOTP Login
                  </span>
                </div>
              </div>

              <div className="nk-overview">
                <div className="nk-overview-icon">
                  <Crown size={31} />
                </div>
                <div>
                  <h4>Account Type</h4>
                  <span className="nk-normal">Administrator</span>
                </div>
              </div>
            </section>

            <div className="nk-bottom-grid">
              <section className="nk-card">
                <div className="nk-card-heading">
                  <div>
                    <h3>
                      <Info size={29} />
                      About Me
                    </h3>
                    <p>Short introduction about your account.</p>
                  </div>
                </div>

                <textarea
                  className="nk-about"
                  name="about"
                  value={form.about}
                  onChange={handleChange}
                  disabled={!editing}
                  rows={4}
                />
              </section>

              <section className="nk-card">
                <div className="nk-card-heading">
                  <div>
                    <h3>
                      <LockKeyhole size={29} />
                      Account Security
                    </h3>
                    <p>Manage your account protection.</p>
                  </div>
                </div>

                <div className="nk-security-row">
                  <div className="nk-security-icon">
                    <KeyRound size={27} />
                  </div>
                  <div className="nk-security-info">
                    <strong>Password</strong>
                    <span>Keep your administrator password secure.</span>
                  </div>
                  <button
                    type="button"
                    className="nk-security-btn"
                    onClick={() =>
                      setMessage(
                        "Your administrator password is managed by the backend ADMIN_PASSWORD environment setting. Update it securely on the server and restart the backend.",
                      )
                    }
                  >
                    Change Password
                  </button>
                </div>

                <div className="nk-security-row">
                  <div className="nk-security-icon">
                    <ShieldCheck size={27} />
                  </div>
                  <div className="nk-security-info">
                    <strong>Google Authenticator</strong>
                    <span>Use a six-digit OTP during login.</span>
                  </div>
                  <Link to="/setup-totp" className="nk-security-btn">
                    TOTP Setup
                  </Link>
                </div>

                <div className="nk-security-row">
                  <div className="nk-security-icon">
                    <History size={27} />
                  </div>
                  <div className="nk-security-info">
                    <strong>Owner Login History</strong>
                    <span>
                      {sessionSummary.activeCount} active login(s) · {sessionSummary.historyCount} record(s) in the last 30 days
                    </span>
                  </div>
                  <button type="button" className="nk-security-btn" onClick={openLoginDetails}>
                    <Eye size={16} /> View Details
                  </button>
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>

      {sessionDialogOpen && (
        <div className="nk-session-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeLoginDetails();
        }}>
          <section className="nk-session-modal" role="dialog" aria-modal="true" aria-labelledby="nk-session-title">
            <header className="nk-session-heading">
              <div className="nk-session-title-icon"><History size={25} /></div>
              <div>
                <h2 id="nk-session-title">Owner Login Details</h2>
                <p>Review login history and manage active devices.</p>
              </div>
              <button type="button" className="nk-session-close" onClick={closeLoginDetails} aria-label="Close login history">
                <X size={22} />
              </button>
            </header>

            {!managerToken ? (
              <form className="nk-session-unlock" onSubmit={unlockLoginDetails}>
                <div className="nk-session-lock-icon"><LockKeyhole size={30} /></div>
                <h3>Verify owner access</h3>
                <p>Enter the separate owner login-management password to view history or sign out devices.</p>
                <label htmlFor="owner-session-manager-password">Owner management password</label>
                <div className="nk-session-password-wrap">
                  <input
                    id="owner-session-manager-password"
                    type={showManagerPassword ? "text" : "password"}
                    value={managerPassword}
                    onChange={(event) => setManagerPassword(event.target.value)}
                    autoComplete="current-password"
                    placeholder="Enter management password"
                    required
                  />
                  <button type="button" onClick={() => setShowManagerPassword((value) => !value)}>
                    {showManagerPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <button className="nk-session-primary" type="submit" disabled={sessionBusy === "unlock"}>
                  <ShieldCheck size={17} />
                  {sessionBusy === "unlock" ? "Verifying…" : "Unlock Login History"}
                </button>
              </form>
            ) : (
              <div className="nk-session-content">
                <div className="nk-session-summary">
                  <div>
                    <strong>{sessionSummary.activeCount}</strong>
                    <span>Active login(s)</span>
                  </div>
                  <div>
                    <strong>{loginSessions.length}</strong>
                    <span>Recent history records</span>
                  </div>
                  <button type="button" onClick={() => loadLoginSessions()} disabled={sessionLoading}>
                    <RefreshCw size={16} /> Refresh
                  </button>
                </div>
                <div className="nk-session-toolbar">
                  <div>
                    <strong>Login activity</strong>
                    <span>Login records retained for 24 hours · access unlock expires after 5 minutes</span>
                  </div>
                  <button
                    type="button"
                    className="nk-session-danger"
                    onClick={revokeOtherLoginSessions}
                    disabled={sessionBusy === "others" || sessionSummary.activeCount <= 1}
                  >
                    <LogOut size={16} /> {sessionBusy === "others" ? "Signing out…" : "Logout other devices"}
                  </button>
                </div>

                {sessionLoading && <div className="nk-session-empty">Loading login history…</div>}
                {!sessionLoading && loginSessions.length === 0 && (
                  <div className="nk-session-empty">No login history has been recorded yet. New logins will appear here.</div>
                )}
                <div className="nk-session-list">
                  {loginSessions.map((session) => (
                    <article className="nk-session-item" key={session.sessionId}>
                      <div className="nk-session-device-icon"><MonitorSmartphone size={24} /></div>
                      <div className="nk-session-device">
                        <div className="nk-session-device-title">
                          <strong>{session.device || "Unknown device"}</strong>
                          {session.current && <span className="nk-session-current">This device</span>}
                          <span className={"nk-session-status " + String(session.status || "ENDED").toLowerCase().replaceAll("_", "-")}>
                            {String(session.status || "ENDED").replaceAll("_", " ")}
                          </span>
                        </div>
                        <div className="nk-session-meta">
                          <span>IP: {session.ipAddress || "Not available"}</span>
                          <span>Login: {formatSessionDate(session.loginAt)}</span>
                          <span>Last active: {formatSessionDate(session.lastActiveAt)}</span>
                          <span>Logout: {formatSessionDate(session.loggedOutAt)}</span>
                          <span>Duration: {formatSessionDuration(session.durationSeconds)}</span>
                          <span>Reason: {formatLogoutReason(session.logoutReason, session.status)}</span>
                        </div>
                      </div>
                      {session.status === "ACTIVE" && (
                        <button
                          type="button"
                          className="nk-session-logout"
                          onClick={() => revokeLoginSession(session)}
                          disabled={Boolean(sessionBusy)}
                        >
                          <LogOut size={16} /> {sessionBusy === session.sessionId ? "Signing out…" : "Logout"}
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            )}

            {sessionMessage && <div className="nk-session-message" role="status">{sessionMessage}</div>}
            <footer className="nk-session-footer">
              <ShieldAlert size={16} />
              <span>Only this authenticated owner account can view or revoke its login sessions. Never share this management password.</span>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
