import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Camera, CheckCircle2, Clock3, ImagePlus, LoaderCircle, RotateCw,
  X, UploadCloud, Smartphone, ShieldCheck, AlertTriangle, Star,
} from "lucide-react";
import { request } from "../../core/api/client";
import "./MobileDesignUploadPage.css";

const API = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_PHOTOS = 20;
const METALS = ["GOLD", "SILVER", "DIAMOND"];

function photoId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `photo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function MobileDesignUploadPage() {
  const { token = "" } = useParams();
  const [session, setSession] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const [categories, setCategories] = useState([]);
  const [metal, setMetal] = useState("GOLD");
  const [categoryId, setCategoryId] = useState("");
  const [designName, setDesignName] = useState("");
  const [description, setDescription] = useState("");
  const [purity, setPurity] = useState("");
  const [weightGrams, setWeightGrams] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [photos, setPhotos] = useState([]);
  const [primaryPhotoId, setPrimaryPhotoId] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [savedDesign, setSavedDesign] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const galleryRef = useRef(null);
  const cameraFallbackRef = useRef(null);
  const saveInFlightRef = useRef(false);
  const previewUrlsRef = useRef([]);

  const metalCategories = useMemo(
    () => categories.filter((category) => category.metalType === metal && category.isActive !== false),
    [categories, metal],
  );

  useEffect(() => {
    let active = true;
    Promise.all([
      request(`/mobile-design-upload/${encodeURIComponent(token)}`, { publicRequest: true }),
      request("/designs/categories", { publicRequest: true }),
    ])
      .then(([sessionInfo, categoryRows]) => {
        if (!active) return;
        setSession(sessionInfo);
        setCategories(Array.isArray(categoryRows) ? categoryRows : []);
        const gold = (Array.isArray(categoryRows) ? categoryRows : []).find(
          (category) => category.metalType === "GOLD" && category.isActive !== false,
        );
        if (gold) setCategoryId(String(gold.id));
      })
      .catch((err) => {
        if (active) setSessionError(err.message || "This QR upload link is invalid or expired.");
      })
      .finally(() => {
        if (active) setSessionLoading(false);
      });
    return () => { active = false; };
  }, [token]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    if (!cameraOpen) return undefined;
    let cancelled = false;
    let stream = null;
    setCameraError("");
    setCameraReady(false);
    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Live camera is not supported here. Use the camera file picker below.");
        }
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCameraReady(true);
      } catch (err) {
        if (!cancelled) {
          setCameraError(err.message || "Could not open the rear camera.");
          setCameraReady(false);
        }
      }
    };
    startCamera();
    return () => {
      cancelled = true;
      (stream || streamRef.current)?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [cameraOpen]);

  const addPhotos = (fileList) => {
    const incoming = Array.from(fileList || []);
    const remaining = Math.max(0, MAX_PHOTOS - photos.length);
    const accepted = [];
    const rejected = [];
    incoming.slice(0, remaining).forEach((file) => {
      const mime = String(file.type || "").toLowerCase();
      const extensionOk = /\.(jpe?g|png|webp)$/i.test(file.name || "");
      const mimeOk = ["image/jpeg", "image/png", "image/webp"].includes(mime);
      if (!(mimeOk || extensionOk)) rejected.push(`${file.name}: unsupported format`);
      else if (file.size > MAX_FILE_BYTES) rejected.push(`${file.name}: larger than 10 MB`);
      else {
        const previewUrl = URL.createObjectURL(file);
        previewUrlsRef.current.push(previewUrl);
        accepted.push({
          id: photoId(),
          file,
          previewUrl,
          rotation: 0,
          cropZoom: 1,
        });
      }
    });
    if (incoming.length > remaining) rejected.push(`Only ${MAX_PHOTOS} photos are allowed per design.`);
    if (rejected.length) setError(rejected.join(". "));
    if (accepted.length) {
      setPhotos((current) => [...current, ...accepted].slice(0, MAX_PHOTOS));
      setPrimaryPhotoId((current) => current || accepted[0].id);
      setError("");
    }
  };

  const closeCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
    setCameraReady(false);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video?.videoHeight) {
      setCameraError("The camera preview is not ready yet.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("This browser cannot capture a photo.");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setCameraError("The camera could not create a photo. Please try again.");
        return;
      }
      const file = new File([blob], `nkj-design-${Date.now()}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
      addPhotos([file]);
      closeCamera();
    }, "image/jpeg", 0.96);
  };

  const removePhoto = (photo) => {
    URL.revokeObjectURL(photo.previewUrl);
    setPhotos((current) => {
      const next = current.filter((item) => item.id !== photo.id);
      if (primaryPhotoId === photo.id) setPrimaryPhotoId(next[0]?.id || "");
      return next;
    });
  };

  const updatePhoto = (id, changes) => {
    setPhotos((current) => current.map((photo) => photo.id === id ? { ...photo, ...changes } : photo));
  };

  const submitDesign = async (event) => {
    event.preventDefault();
    if (saveInFlightRef.current || saving) return;
    if (!session || session.status !== "WAITING") {
      setError("This upload session is no longer active. Ask the owner to generate a new QR code.");
      return;
    }
    if (!categoryId || !designName.trim()) {
      setError("Choose a subcategory and enter a design name.");
      return;
    }
    if (!photos.length) {
      setError("Select at least one jewellery photograph.");
      return;
    }

    saveInFlightRef.current = true;
    setSaving(true);
    setProgress(0);
    setError("");

    const orderedPhotos = [
      ...photos.filter((photo) => photo.id === primaryPhotoId),
      ...photos.filter((photo) => photo.id !== primaryPhotoId),
    ];
    const data = new FormData();
    data.append("categoryId", categoryId);
    data.append("designName", designName.trim());
    data.append("description", description);
    data.append("styleLabel", "Shop photograph");
    data.append("keywords", designName.trim());
    data.append("purity", purity);
    data.append("weightGrams", weightGrams);
    data.append("isActive", String(isActive));
    data.append("isFeatured", "false");
    orderedPhotos.forEach((photo) => {
      data.append("files", photo.file, photo.file.name);
      data.append("rotations", String(photo.rotation));
      data.append("cropZooms", String(photo.cropZoom));
    });

    try {
      const result = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${API}/mobile-design-upload/${encodeURIComponent(token)}/design`);
        xhr.setRequestHeader("Accept", "application/json");
        xhr.timeout = 180000;
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) setProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
        };
        xhr.onload = () => {
          let payload = {};
          try { payload = xhr.responseText ? JSON.parse(xhr.responseText) : {}; }
          catch { payload = { message: xhr.responseText }; }
          if (xhr.status >= 200 && xhr.status < 300) resolve(payload);
          else reject(new Error(payload.message || `Upload failed (${xhr.status}).`));
        };
        xhr.onerror = () => reject(new Error("Could not connect to the Jewellery ERP server."));
        xhr.ontimeout = () => reject(new Error("The upload timed out. Check your connection and try again."));
        xhr.onabort = () => reject(new Error("The upload was cancelled."));
        xhr.send(data);
      });
      setProgress(100);
      setSavedDesign(result);
      setSession((current) => current ? { ...current, status: "UPLOADED" } : current);
      closeCamera();
    } catch (err) {
      setError(err.message || "Could not save this jewellery design.");
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  };

  if (sessionLoading) {
    return (
      <main className="nkj-mobile-upload-page">
        <div className="nkj-mobile-upload-state"><LoaderCircle className="spin" size={30} /><b>Checking secure upload link…</b></div>
      </main>
    );
  }

  if (sessionError || !session) {
    return (
      <main className="nkj-mobile-upload-page">
        <section className="nkj-mobile-upload-state is-error">
          <AlertTriangle size={34} />
          <h1>Upload link unavailable</h1>
          <p>{sessionError || "This upload link is invalid or expired."}</p>
          <small>Return to the desktop Jewellery ERP and ask the owner to generate a new QR code.</small>
        </section>
      </main>
    );
  }

  if (!savedDesign && (session.status === "EXPIRED" || session.status === "REVOKED" || session.status === "UPLOADED")) {
    return (
      <main className="nkj-mobile-upload-page">
        <section className={`nkj-mobile-upload-state ${session.status === "UPLOADED" ? "is-success" : "is-error"}`}>
          {session.status === "UPLOADED" ? <CheckCircle2 size={38} /> : <Clock3 size={38} />}
          <h1>{session.status === "UPLOADED" ? "Design uploaded" : "Upload link expired"}</h1>
          <p>{session.status === "UPLOADED"
            ? "This QR upload link has already been used. Your design has been sent to the desktop catalogue."
            : "This secure QR link is no longer active. Ask the owner to generate a new QR code."}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="nkj-mobile-upload-page">
      <header className="nkj-mobile-upload-brand">
        <div className="nkj-mobile-brand-mark">NKJ</div>
        <div><b>Nandikishor Jewellery Works</b><span>Secure design upload</span></div>
        <span className="nkj-mobile-secure"><ShieldCheck size={15} /> Secure</span>
      </header>

      <section className="nkj-mobile-upload-intro">
        <span>OWNER-APPROVED QR SESSION</span>
        <h1>Upload Jewellery Designs</h1>
        <p>Select jewellery photographs from your phone or capture new photos using the rear camera.</p>
        <div className="nkj-mobile-expiry"><Clock3 size={14} /> Temporary link · 5-minute expiry · One design per QR</div>
      </section>

      <form className="nkj-mobile-design-form" onSubmit={submitDesign}>
        <section className="nkj-mobile-photo-section">
          <div className="nkj-mobile-section-title">
            <div><span>01</span><b>Jewellery photographs</b></div>
            <small>{photos.length}/{MAX_PHOTOS} selected</small>
          </div>

          <div className="nkj-mobile-photo-actions">
            <button type="button" className="is-primary" onClick={() => galleryRef.current?.click()}>
              <ImagePlus size={20} /><b>Upload from Gallery</b><small>Select multiple photos</small>
            </button>
            <button type="button" onClick={() => { setCameraError(""); setCameraOpen(true); }}>
              <Camera size={20} /><b>Take Photo</b><small>Use rear camera</small>
            </button>
          </div>
          <input ref={galleryRef} className="nkj-mobile-hidden-input" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" multiple onChange={(event) => { addPhotos(event.target.files); event.target.value = ""; }} />
          <input ref={cameraFallbackRef} className="nkj-mobile-hidden-input" type="file" accept="image/*" capture="environment" onChange={(event) => { addPhotos(event.target.files); event.target.value = ""; }} />

          {cameraOpen && (
            <div className="nkj-mobile-camera">
              <video ref={videoRef} autoPlay playsInline muted />
              {cameraError && <div className="nkj-mobile-camera-error">{cameraError}</div>}
              <div className="nkj-mobile-camera-controls">
                <button type="button" className="is-capture" onClick={capturePhoto} disabled={!cameraReady}><Camera size={19} /> Capture</button>
                <button type="button" onClick={() => cameraFallbackRef.current?.click()}><ImagePlus size={17} /> Camera picker</button>
                <button type="button" onClick={closeCamera}><X size={17} /> Close</button>
              </div>
              {!cameraReady && !cameraError && <small><LoaderCircle className="spin" size={14} /> Requesting rear camera permission…</small>}
            </div>
          )}

          {photos.length > 0 ? (
            <div className="nkj-mobile-photo-grid">
              {photos.map((photo, index) => (
                <article key={photo.id} className={primaryPhotoId === photo.id ? "is-primary" : ""}>
                  <div className="nkj-mobile-photo-preview">
                    <img src={photo.previewUrl} alt={photo.file.name} style={{
                      transform: `rotate(${photo.rotation}deg) scale(${photo.cropZoom})`,
                    }} />
                    <button type="button" className="nkj-mobile-photo-remove" onClick={() => removePhoto(photo)} aria-label="Remove photograph"><X size={15} /></button>
                  </div>
                  <div className="nkj-mobile-photo-tools">
                    <button type="button" onClick={() => updatePhoto(photo.id, { rotation: (photo.rotation + 90) % 360 })}><RotateCw size={14} /> Rotate</button>
                    <button type="button" className={primaryPhotoId === photo.id ? "selected" : ""} onClick={() => setPrimaryPhotoId(photo.id)}>
                      <Star size={13} fill={primaryPhotoId === photo.id ? "currentColor" : "none"} /> {primaryPhotoId === photo.id ? "Primary" : "Set primary"}
                    </button>
                  </div>
                  <label className="nkj-mobile-crop-label">Crop / zoom <b>{photo.cropZoom.toFixed(1)}×</b>
                    <input type="range" min="1" max="2" step="0.1" value={photo.cropZoom} onChange={(event) => updatePhoto(photo.id, { cropZoom: Number(event.target.value) })} />
                  </label>
                  <small className="nkj-mobile-photo-name">{index + 1}. {photo.file.name}</small>
                </article>
              ))}
            </div>
          ) : (
            <div className="nkj-mobile-photo-empty"><UploadCloud size={28} /><b>No photographs selected</b><small>JPG, PNG or WebP · Up to 10 MB each</small></div>
          )}
        </section>

        <section className="nkj-mobile-details-section">
          <div className="nkj-mobile-section-title"><div><span>02</span><b>Design information</b></div></div>
          <label>Main Category
            <select value={metal} onChange={(event) => {
              const nextMetal = event.target.value;
              setMetal(nextMetal);
              const first = categories.find((category) => category.metalType === nextMetal && category.isActive !== false);
              setCategoryId(first ? String(first.id) : "");
            }}>
              {METALS.map((value) => <option value={value} key={value}>{value}</option>)}
            </select>
          </label>
          <label>Subcategory
            <select required value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">Choose subcategory</option>
              {metalCategories.map((category) => <option key={category.id} value={category.id}>{category.subcategoryName}</option>)}
            </select>
          </label>
          <label>Design Name
            <input required maxLength={160} value={designName} onChange={(event) => setDesignName(event.target.value)} placeholder="Enter design name" />
          </label>
          <label>Description
            <textarea rows={3} maxLength={5000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the jewellery design (optional)" />
          </label>
          <div className="nkj-mobile-field-row">
            <label>Purity (optional)
              <input maxLength={40} value={purity} onChange={(event) => setPurity(event.target.value)} placeholder="22K / 18K / 925" />
            </label>
            <label>Weight in grams (optional)
              <input type="number" min="0" step="0.001" value={weightGrams} onChange={(event) => setWeightGrams(event.target.value)} placeholder="0.000" />
            </label>
          </div>
          <div className="nkj-mobile-id-note"><ShieldCheck size={16} /><span><b>Design ID generated automatically</b><small>The server generates the unique category-based ID when you save. It cannot be edited on this phone.</small></span></div>
          <label className="nkj-mobile-active-toggle">
            <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
            <span><b>Active / Publish design</b><small>When enabled, the design appears in the public jewellery catalogue after saving.</small></span>
          </label>
        </section>

        {error && <div className="nkj-mobile-form-error" role="alert"><AlertTriangle size={17} /> {error}</div>}
        {saving && (
          <div className="nkj-mobile-progress" role="status">
            <div><b>Uploading photographs…</b><strong>{progress}%</strong></div>
            <span><i style={{ width: `${progress}%` }} /></span>
          </div>
        )}

        <button type="submit" className="nkj-mobile-save" disabled={saving || session.status !== "WAITING" || !photos.length}>
          {saving ? <LoaderCircle className="spin" size={18} /> : <CheckCircle2 size={18} />}
          {saving ? "Saving Design…" : "Save Design"}
        </button>
        <p className="nkj-mobile-save-note">The original photographs and optimized display copies are stored on the Jewellery ERP server.</p>
      </form>
      <footer className="nkj-mobile-upload-footer">Nandikishor Jewellery Works · Secure owner upload</footer>

      {savedDesign && (
        <div className="nkj-mobile-success-overlay">
          <section role="dialog" aria-modal="true" className="nkj-mobile-success-card">
            <CheckCircle2 size={43} />
            <span>UPLOAD COMPLETED</span>
            <h2>Design saved successfully</h2>
            <b className="nkj-mobile-generated-id">{savedDesign.designId}</b>
            <p>{savedDesign.designName}</p>
            <small>Your design is now saved in PostgreSQL and the desktop catalogue has been notified.</small>
            <button type="button" onClick={() => setSavedDesign(null)}>Done</button>
          </section>
        </div>
      )}
    </main>
  );
}
