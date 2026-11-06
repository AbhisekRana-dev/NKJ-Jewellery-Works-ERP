import "./Profile.css";
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Nav } from "../../shared/layouts/OwnerShell";
import { useAuth } from "../../core/auth/AuthProvider";
import { request } from "../../core/api/client";
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
} from "lucide-react";

export default function Profile() {
  const { user } = useAuth();
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
              </section>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
