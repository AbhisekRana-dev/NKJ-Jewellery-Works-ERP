import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Gem, Crown, Flower2, Sparkles, CircleDot, Heart, Search, X, ArrowUpRight, ImagePlus,
  Layers3, Star, ChevronDown, LoaderCircle, Orbit, Hexagon, Aperture, Waves, Bird, QrCode,
  LayoutGrid, List, Pencil, Trash2, Save, UploadCloud, Smartphone, CheckCircle2, Lock,
  RotateCcw, Plus,
} from "lucide-react";
import { Page } from "../../shared/layouts/OwnerShell";
import { request } from "../../core/api/client";
import { getRealtimeClientId, useRealtimeRefresh } from "../../core/realtime/realtime";
import { useAuth } from "../../core/auth/AuthProvider";
import { QRCodeSVG } from "qrcode.react";
import "./JewelleryDesignsPage.css";

const PAGE_SIZE = 24;
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

async function uploadAdminMultipart(path, formData) {
  const token = window.localStorage.getItem("nkj_token");
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "X-NKJ-Client-Id": getRealtimeClientId(),
      Accept: "application/json",
    },
    body: formData,
  });
  const raw = await response.text();
  let result = {};
  if (raw) {
    try { result = JSON.parse(raw); }
    catch { result = { message: raw }; }
  }
  if (response.status === 401) {
    window.localStorage.removeItem("nkj_token");
    window.localStorage.removeItem("nkj_user");
    window.dispatchEvent(new Event("nkj:session-expired"));
  }
  if (!response.ok) {
    throw new Error(result.message || `Image upload failed (${response.status}).`);
  }
  return result;
}
const API_ORIGIN = API_BASE.endsWith("/api") ? API_BASE.slice(0, -4) : API_BASE;
const assetUrl = (path) => {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("/api/")) return `${API_ORIGIN}${path}`;
  return path.startsWith("/") ? path : `/${path}`;
};
const METALS = [
  { id: "GOLD", label: "Gold", description: "Traditional and contemporary gold designs", tone: "gold", mark: "Au" },
  { id: "SILVER", label: "Silver", description: "Classic silver and handcrafted collections", tone: "silver", mark: "Ag" },
  { id: "DIAMOND", label: "Diamond", description: "Diamond-inspired fine jewellery designs", tone: "diamond", mark: "D" },
];
const iconFor = (design) => {
  const text = `${design?.designName || ""} ${design?.styleLabel || ""} ${design?.subcategoryName || ""}`.toLowerCase();
  const motifs = [Gem, Crown, Flower2, Sparkles, CircleDot, Layers3, Orbit, Hexagon, Aperture, Waves, Bird, Heart];
  let hash = 0;
  for (const character of String(design?.designCode || design?.id || text)) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  if (/ring|bichiya|nath|nose/.test(text)) return [CircleDot, Gem, Flower2, Hexagon][hash % 4];
  if (/bridal|haar|haram|temple|lakshmi|mangalsutra/.test(text)) return [Crown, Gem, Layers3, Sparkles][hash % 4];
  if (/earring|jhumka|stud|chandbali|drop/.test(text)) return [Flower2, Sparkles, Bird, Gem][hash % 4];
  if (/chain|necklace|layer/.test(text)) return [Layers3, Orbit, Gem, Waves][hash % 4];
  return motifs[hash % motifs.length];
};
const isNewDesign = (createdAt) => {
  const timestamp = createdAt ? new Date(createdAt).getTime() : 0;
  return Number.isFinite(timestamp) && timestamp > 0 && Date.now() - timestamp <= 14 * 24 * 60 * 60 * 1000;
};
const hueFor = (design) => {
  const source = String(design?.designCode || design?.id || "NKJ");
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  return hash % 360;
};
const loadFavorites = () => {
  try {
    const value = JSON.parse(window.localStorage.getItem("nkj-design-favorites") || "[]");
    return new Set(Array.isArray(value) ? value.map(String) : []);
  } catch {
    return new Set();
  }
};

function SampleArtwork({ design }) {
  const Icon = iconFor(design);
  const hue = hueFor(design);
  return (
    <div className="nkj-design-art" style={{ "--design-hue": hue }} aria-label="Sample design inspiration illustration">
      <span className="nkj-design-art-orbit orbit-one" />
      <span className="nkj-design-art-orbit orbit-two" />
      <span className="nkj-design-art-spark spark-one">✦</span>
      <span className="nkj-design-art-spark spark-two">✧</span>
      <div className="nkj-design-art-center">
        <Icon size={70} strokeWidth={1.2} />
      </div>
      <span className="nkj-design-art-caption">SAMPLE • INSPIRATION</span>
      <span className="nkj-design-art-code">{design.designCode}</span>
    </div>
  );
}

function DesignImage({ design }) {
  const rawSources = design.imageStatus === "READY"
    ? [design.thumbnailUrl, design.displayUrl, design.originalUrl]
    : [];
  const sources = Array.from(new Set(rawSources.map(assetUrl).filter(Boolean)));
  const sourceKey = sources.join("|");
  const [sourceIndex, setSourceIndex] = useState(0);
  const [loadState, setLoadState] = useState(sources.length ? "loading" : "missing");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    setSourceIndex(0);
    setLoadState(sources.length ? "loading" : "missing");
    setRetry(0);
  }, [design.id, sourceKey]);

  const retryImage = () => {
    setSourceIndex(0);
    setLoadState("loading");
    setRetry((value) => value + 1);
  };

  if (!sources.length) {
    // Sample records are inspiration concepts, not live stock. Use the
    // existing clearly-labelled sample artwork instead of an empty photo box.
    if (design.isSample) return <SampleArtwork design={design} />;
    return (
      <div className="nkj-design-photo-missing" role="img" aria-label="No jewellery photograph uploaded">
        <ImagePlus size={25} />
        <span>{design.imageStatus === "PENDING" ? "Photo pending" : "Photograph not uploaded"}</span>
      </div>
    );
  }

  const source = sources[sourceIndex] || "";
  const imageSource = retry > 0
    ? `${source}${source.includes("?") ? "&" : "?"}retry=${retry}`
    : source;

  if (loadState === "error") {
    if (design.isSample) return <SampleArtwork design={design} />;
    return (
      <div className="nkj-design-photo-missing" role="img" aria-label="Jewellery photograph unavailable">
        <ImagePlus size={25} />
        <span>Photograph unavailable</span>
        <button type="button" onClick={retryImage}>Retry image</button>
      </div>
    );
  }

  return (
    <div className="nkj-design-photo">
      <img
        key={imageSource}
        src={imageSource}
        alt={design.designName}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoadState("loaded")}
        onError={() => {
          if (sourceIndex + 1 < sources.length) {
            setSourceIndex((current) => current + 1);
            setLoadState("loading");
          } else {
            console.error("All jewellery catalogue image URLs failed:", sources);
            setLoadState("error");
          }
        }}
        style={{ objectFit: "contain" }}
      />
      {loadState === "loading" && <span className="nkj-design-photo-status">Loading photograph…</span>}
      {!design.isSample && <span className="nkj-design-photo-label">SHOP PHOTO</span>}
    </div>
  );
}

export default function JewelleryDesignsPage() {
  const { isAdmin, authReady } = useAuth();
  const [categories, setCategories] = useState([]);
  const [metal, setMetal] = useState("GOLD");
  const [subcategory, setSubcategory] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("latest");
  const [view, setView] = useState("grid");
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [replacingPhoto, setReplacingPhoto] = useState(false);
  const [replacePhotoError, setReplacePhotoError] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [savingDetails, setSavingDetails] = useState(false);
  const [adminActionError, setAdminActionError] = useState("");
  const [adminActionMessage, setAdminActionMessage] = useState("");
  const [pendingImages, setPendingImages] = useState([]);
  const pendingImagesRef = useRef([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [qrSession, setQrSession] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState("");
  const [favorites, setFavorites] = useState(loadFavorites);

  const metalCategories = useMemo(
    () => categories.filter((item) => item.metalType === metal),
    [categories, metal],
  );
  const currentMetal = METALS.find((item) => item.id === metal) || METALS[0];
  const selectedCategory = metalCategories.find((item) => item.slug === subcategory);
  const heading = selectedCategory?.subcategoryName || `All ${currentMetal.label} Designs`;

  useEffect(() => {
    let cancelled = false;
    setLoadingCategories(true);
    request("/designs/categories", { publicRequest: true })
      .then((data) => {
        if (!cancelled) setCategories(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Could not load jewellery categories.");
      })
      .finally(() => {
        if (!cancelled) setLoadingCategories(false);
      });
    return () => { cancelled = true; };
  }, []);

  const loadDesigns = useCallback(async (nextPage, append = false) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        metal,
        sort,
        page: String(nextPage),
        size: String(PAGE_SIZE),
      });
      if (subcategory) params.set("subcategory", subcategory);
      if (search.trim()) params.set("q", search.trim());
      const result = await request(`/designs?${params.toString()}`, { publicRequest: true });
      const nextItems = Array.isArray(result.items) ? result.items : [];
      setItems((current) => append ? [...current, ...nextItems] : nextItems);
      setTotal(Number(result.total) || 0);
      setPage(Number(result.page) || 0);
    } catch (err) {
      setError(err.message || "Could not load jewellery designs.");
      if (!append) {
        setItems([]);
        setTotal(0);
      }
    } finally {
      setLoading(false);
    }
  }, [metal, subcategory, search, sort]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadDesigns(0, false), search.trim() ? 280 : 0);
    return () => window.clearTimeout(timer);
  }, [loadDesigns]);

  const refreshCatalogue = useCallback(async () => {
    const [categoryResult] = await Promise.all([
      request("/designs/categories", { publicRequest: true }),
      loadDesigns(0, false),
    ]);
    setCategories(Array.isArray(categoryResult) ? categoryResult : []);
  }, [loadDesigns]);
  useRealtimeRefresh(refreshCatalogue, ["designs"]);

  useEffect(() => {
    const timer = window.setInterval(() => { refreshCatalogue().catch(() => {}); }, 60000);
    return () => window.clearInterval(timer);
  }, [refreshCatalogue]);

  const selectMetal = (nextMetal) => {
    setMetal(nextMetal);
    setSubcategory("");
    setPurity("");
    setStyle("");
    setMaterial("");
    setRegion("");
    setMinWeight("");
    setMaxWeight("");
  };

  const toggleFavorite = (designCode) => {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(designCode)) next.delete(designCode);
      else next.add(designCode);
      try {
        window.localStorage.setItem("nkj-design-favorites", JSON.stringify([...next]));
      } catch {
        // Browsing remains available when local storage is disabled.
      }
      return next;
    });
  };

  const openDesign = async (design) => {
    setSelected(design);
    setActiveImageIndex(0);
    setZoomed(false);
    setDetailLoading(true);
    setEditMode(false);
    setQrSession(null);
    setQrError("");
    setAdminActionError("");
    setAdminActionMessage("");
    clearPendingImages();
    try {
      const detail = await request(
        isAdmin ? `/admin/designs/${design.id}` : `/designs/${design.id}`,
        { publicRequest: !isAdmin },
      );
      setSelected(detail);
    } catch (error) {
      setAdminActionError(error.message || "The complete design details could not be loaded.");
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (!selected) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handlePreviewKeys = (event) => {
      if (event.key === "Escape") {
        setSelected(null);
        setZoomed(false);
        return;
      }
      const imageCount = Array.isArray(selected.images) ? selected.images.length : 0;
      if (imageCount < 2) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setActiveImageIndex((index) => (index + 1) % imageCount);
        setZoomed(false);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setActiveImageIndex((index) => (index - 1 + imageCount) % imageCount);
        setZoomed(false);
      }
    };
    window.addEventListener("keydown", handlePreviewKeys);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handlePreviewKeys);
    };
  }, [selected]);

  const activeImage = selected?.images?.[activeImageIndex] || selected?.images?.[0] || null;
  const modalImageUrl = selected?.imageStatus === "READY"
    ? (zoomed
        ? (activeImage?.originalUrl || selected?.originalUrl || activeImage?.displayUrl || activeImage?.thumbnailUrl || "")
        : (activeImage?.displayUrl || activeImage?.originalUrl || selected?.originalUrl || activeImage?.thumbnailUrl || selected?.thumbnailUrl || ""))
    : "";
  const modalThumbnailUrl = selected?.imageStatus === "READY"
    ? (activeImage?.thumbnailUrl || selected?.thumbnailUrl || "")
    : "";

  const clearPendingImages = () => {
    pendingImagesRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    pendingImagesRef.current = [];
    setPendingImages([]);
  };

  useEffect(() => {
    pendingImagesRef.current = pendingImages;
  }, [pendingImages]);

  useEffect(() => () => {
    pendingImagesRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
  }, []);

  useEffect(() => {
    if (isAdmin) return;
    setEditMode(false);
    setQrSession(null);
    setQrError("");
    clearPendingImages();
  }, [isAdmin]);

  const loadSelectedDetails = async (designId) => {
    const updated = await request(
      isAdmin ? `/admin/designs/${designId}` : `/designs/${designId}`,
      { publicRequest: !isAdmin },
    );
    setSelected(updated);
    setActiveImageIndex(0);
    setZoomed(false);
    return updated;
  };

  const closeSelectedModal = () => {
    const activeSessionId = qrSession?.sessionId;
    if (isAdmin && activeSessionId && ["WAITING", "SCANNED"].includes(qrSession.status)) {
      request(`/admin/design-upload-sessions/${activeSessionId}`, { method: "DELETE" }).catch(() => {});
    }
    clearPendingImages();
    setQrSession(null);
    setSelected(null);
    setEditMode(false);
    setZoomed(false);
  };

  const beginEditingDetails = () => {
    if (!isAdmin || !selected) return;
    setAdminActionError("");
    setAdminActionMessage("");
    setEditForm({
      designName: selected.designName || "",
      description: selected.description || "",
      styleLabel: selected.styleLabel || "",
      keywords: selected.keywords || "",
      purity: selected.purity || "",
      regionalInspiration: selected.regionalInspiration || "",
      materialLabel: selected.materialLabel || "",
      weightGrams: selected.weightGrams == null ? "" : String(selected.weightGrams),
      priceInr: selected.priceInr == null ? "" : String(selected.priceInr),
      isActive: selected.isActive !== false,
      isFeatured: Boolean(selected.isFeatured),
    });
    setEditMode(true);
  };

  const saveDesignDetails = async (event) => {
    event.preventDefault();
    if (!isAdmin || !selected || savingDetails) return;
    if (!editForm.designName.trim()) {
      setAdminActionError("Design name is required.");
      return;
    }
    setSavingDetails(true);
    setAdminActionError("");
    setAdminActionMessage("");
    try {
      const payload = {
        categoryId: selected.categoryId,
        designName: editForm.designName.trim(),
        description: editForm.description,
        styleLabel: editForm.styleLabel,
        keywords: editForm.keywords,
        purity: editForm.purity,
        regionalInspiration: editForm.regionalInspiration,
        materialLabel: editForm.materialLabel,
        weightGrams: editForm.weightGrams === "" ? null : Number(editForm.weightGrams),
        priceInr: editForm.priceInr === "" ? null : Number(editForm.priceInr),
        isActive: Boolean(editForm.isActive),
        isFeatured: Boolean(editForm.isFeatured),
      };
      const updated = await request(`/admin/designs/${selected.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setSelected(updated);
      setEditMode(false);
      setAdminActionMessage("Design details saved successfully.");
      await refreshCatalogue();
    } catch (error) {
      setAdminActionError(error.message || "Could not save design details.");
    } finally {
      setSavingDetails(false);
    }
  };

  const archiveSelectedDesign = async () => {
    if (!isAdmin || !selected) return;
    const confirmed = window.confirm(
      `Archive design ${selected.designId || selected.designCode}? It will disappear from the public catalogue, but its record, Design ID and photo history will be retained.`,
    );
    if (!confirmed) return;
    try {
      await request(`/admin/designs/${selected.id}`, { method: "DELETE" });
      closeSelectedModal();
      await refreshCatalogue();
    } catch (error) {
      setAdminActionError(error.message || "Could not archive this design.");
    }
  };

  const selectDesktopImages = (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    const existingCount = pendingImages.length;
    const accepted = [];
    const errors = [];
    selectedFiles.forEach((file) => {
      const mime = String(file.type || "").toLowerCase();
      const extensionOk = /\.(jpe?g|png|webp)$/i.test(file.name || "");
      const mimeOk = ["image/jpeg", "image/png", "image/webp"].includes(mime);
      if (!(mimeOk || extensionOk)) errors.push(`${file.name}: unsupported format`);
      else if (file.size > 10 * 1024 * 1024) errors.push(`${file.name}: larger than 10 MB`);
      else if (existingCount + accepted.length >= 20) errors.push("A maximum of 20 images can be uploaded at once.");
      else accepted.push({ id: `${Date.now()}-${Math.random()}`, file, previewUrl: URL.createObjectURL(file) });
    });
    if (accepted.length) {
      setPendingImages((current) => [...current, ...accepted]);
      setAdminActionError("");
    }
    if (errors.length) setAdminActionError(errors.join(". "));
    event.target.value = "";
  };

  const removePendingImage = (imageId) => {
    const item = pendingImages.find((entry) => entry.id === imageId);
    if (item) URL.revokeObjectURL(item.previewUrl);
    setPendingImages((current) => current.filter((entry) => entry.id !== imageId));
  };

  const uploadSelectedImages = async () => {
    if (!isAdmin || !selected || !pendingImages.length || uploadingImages) return;
    setUploadingImages(true);
    setAdminActionError("");
    setAdminActionMessage("");
    const data = new FormData();
    pendingImages.forEach((item) => data.append("files", item.file, item.file.name));
    try {
      const updated = await uploadAdminMultipart(`/admin/designs/${selected.id}/images`, data);
      setSelected(updated);
      setActiveImageIndex(0);
      clearPendingImages();
      setAdminActionMessage("Photographs uploaded and saved permanently.");
      await refreshCatalogue();
    } catch (error) {
      setAdminActionError(error.message || "Could not upload the selected photographs.");
    } finally {
      setUploadingImages(false);
    }
  };

  const setPrimaryImage = async (imageId) => {
    if (!isAdmin || !selected) return;
    try {
      const updated = await request(`/admin/designs/${selected.id}/images/${imageId}/primary`, { method: "PUT" });
      setSelected(updated);
      setActiveImageIndex(0);
      setAdminActionMessage("Primary photograph updated.");
      await refreshCatalogue();
    } catch (error) {
      setAdminActionError(error.message || "Could not change the primary photograph.");
    }
  };

  const deleteDesignImage = async (imageId) => {
    if (!isAdmin || !selected) return;
    if (!window.confirm("Delete this photograph from the selected design?")) return;
    try {
      const updated = await request(`/admin/designs/${selected.id}/images/${imageId}`, { method: "DELETE" });
      setSelected(updated);
      setActiveImageIndex(0);
      setAdminActionMessage("Photograph removed.");
      await refreshCatalogue();
    } catch (error) {
      setAdminActionError(error.message || "Could not remove this photograph.");
    }
  };

  const generateMobileUploadQr = async () => {
    if (!isAdmin || !selected || qrLoading) return;
    setQrLoading(true);
    setQrError("");
    setQrSession(null);
    try {
      const result = await request(`/admin/design-upload-sessions?designId=${encodeURIComponent(selected.id)}`, { method: "POST" });
      setQrSession(result);
    } catch (error) {
      setQrError(error.message || "Could not create a secure mobile upload QR code.");
    } finally {
      setQrLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin || !selected?.id || !qrSession?.sessionId || !["WAITING", "SCANNED"].includes(qrSession.status)) {
      return undefined;
    }
    let active = true;
    const pollStatus = async () => {
      try {
        const status = await request(`/admin/design-upload-sessions/${qrSession.sessionId}`);
        if (!active) return;
        setQrSession((current) => current?.sessionId === status.sessionId ? { ...current, ...status } : current);
        if (status.status === "UPLOADED") {
          const updated = await request(`/admin/designs/${selected.id}`);
          if (!active) return;
          setSelected(updated);
          setActiveImageIndex(0);
          setZoomed(false);
          setAdminActionMessage("Mobile photographs uploaded successfully. The catalogue is updated.");
          await refreshCatalogue();
        }
      } catch (error) {
        if (active) setQrError(error.message || "Could not check the mobile upload status.");
      }
    };
    pollStatus();
    const timer = window.setInterval(pollStatus, 1800);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [isAdmin, selected?.id, qrSession?.sessionId, qrSession?.status, refreshCatalogue]);

  const replaceSelectedPhoto = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !selected || !isAdmin) return;

    setReplacingPhoto(true);
    setReplacePhotoError("");
    setAdminActionError("");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const updated = await uploadAdminMultipart(`/admin/designs/${selected.id}/images/replace-primary`, formData);
      setSelected(updated);
      setActiveImageIndex(0);
      setZoomed(false);
      setAdminActionMessage("Primary photograph replaced successfully.");
      await refreshCatalogue();
    } catch (error) {
      setReplacePhotoError(error.message || "Could not replace the design photograph.");
    } finally {
      setReplacingPhoto(false);
      event.target.value = "";
    }
  };


    const file = event.target.files?.[0];
    if (!file || !selected || !isAdmin) return;

    setReplacingPhoto(true);
    setReplacePhotoError("");
    const formData = new FormData();
    formData.append("file", file);
    const token = window.localStorage.getItem("nkj_token");

    try {
      const response = await fetch(
        `${API_BASE}/admin/designs/${selected.id}/images/replace-primary`,
        {
          method: "POST",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            "X-NKJ-Client-Id": getRealtimeClientId(),
          },
          body: formData,
        },
      );
      const raw = await response.text();
      let result = {};
      if (raw) {
        try { result = JSON.parse(raw); } catch { result = { message: raw }; }
      }
      if (response.status === 401) {
        window.localStorage.removeItem("nkj_token");
        window.localStorage.removeItem("nkj_user");
        window.dispatchEvent(new Event("nkj:session-expired"));
      }
      if (!response.ok) {
        throw new Error(result.message || `Photograph replacement failed (${response.status}).`);
      }

      const updated = await request(`/designs/${selected.id}`, { publicRequest: true });
      setSelected(updated);
      setActiveImageIndex(0);
      setZoomed(false);
      await refreshCatalogue();
    } catch (error) {
      setReplacePhotoError(error.message || "Could not replace the design photograph.");
    } finally {
      setReplacingPhoto(false);
      event.target.value = "";
    }
  };

  return (
    <Page active="designs">
      <div className="nkj-designs-page">
        <section className="nkj-designs-hero">
          <div className="nkj-designs-hero-copy">
            <span className="nkj-designs-eyebrow"><Sparkles size={14} /> NKJ DESIGN COLLECTION</span>
            <h1>Jewellery Designs</h1>
            <p>Discover elegant gold, silver and diamond designs for weddings, celebrations and everyday wear.</p>
          </div>
          {isAdmin && (
            <div className="nkj-designs-owner-tools">
              <Link to="/design-catalog" state={{ openNewDesign: true }} className="nkj-designs-owner-add">
                <ImagePlus size={17} /> Add New Design
              </Link>
              <Link to="/design-catalog" state={{ openQr: true }} className="nkj-designs-owner-qr">
                <QrCode size={17} /> QR Code Upload
              </Link>
              <button type="button" onClick={() => refreshCatalogue()} className="nkj-designs-owner-refresh">
                <LoaderCircle size={16} /> Refresh
              </button>
            </div>
          )}
        </section>

        <section className="nkj-designs-metal-section" aria-label="Browse by metal">
          <div className="nkj-designs-metal-heading"><span /> <h2><Gem size={22} /> Browse by Metal</h2> <span /></div>
          <div className="nkj-designs-metal-grid">
            {METALS.map((item) => {
              const count = categories.filter((entry) => entry.metalType === item.id).length;
              return (
                <button type="button" key={item.id}
                  className={`nkj-designs-metal-card tone-${item.tone} ${metal === item.id ? "active" : ""}`}
                  onClick={() => selectMetal(item.id)}>
                  <span className="nkj-designs-metal-symbol">{item.mark}</span>
                  <span className="nkj-designs-metal-copy">
                    <b>{item.label}</b>
                    <small>{item.description}</small>
                    <em>{count} subcategories</em>
                  </span>
                  <ArrowUpRight size={20} />
                </button>
              );
            })}
          </div>
        </section>

        <section className="nkj-designs-category-section">
          <div className="nkj-designs-section-heading">
            <div>
              <span>EXPLORE BY CATEGORY</span>
              <h2>{currentMetal.label} Subcategories</h2>
            </div>
            <small>{metalCategories.length} subcategories</small>
          </div>
          {loadingCategories ? (
            <div className="nkj-designs-loading"><LoaderCircle className="spin" size={22} /> Loading catalogue categories…</div>
          ) : (
            <div className="nkj-designs-category-box">
              <button type="button" className={subcategory === "" ? "active" : ""} onClick={() => setSubcategory("")}>
                <Layers3 size={16} /> All {currentMetal.label} Designs
                <small>{metalCategories.reduce((sum, item) => sum + Number(item.activeDesignCount || 0), 0)}</small>
              </button>
              {metalCategories.map((item) => (
                <button type="button" key={item.id}
                  className={subcategory === item.slug ? "active" : ""}
                  onClick={() => setSubcategory(item.slug)}>
                  <Gem size={15} /> {item.subcategoryName}
                  <small>{item.activeDesignCount || 0}</small>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="nkj-designs-gallery-section">
          <div className="nkj-designs-gallery-heading">
            <div>
              <span>CURATED NKJ COLLECTION</span>
              <h2>{heading}</h2>
              <small>{total.toLocaleString("en-IN")} designs in this view</small>
            </div>
            <div className="nkj-designs-gallery-tools">
              <label className="nkj-designs-search">
                <Search size={17} aria-hidden="true" />
                <input value={search} onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search design ID, name, code, style or purity…" aria-label="Search jewellery designs" />
                {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search"><X size={14} /></button>}
              </label>
              <div className="nkj-design-view-toggle" role="group" aria-label="Catalogue layout">
                <button type="button" className={view === "grid" ? "active" : ""} onClick={() => setView("grid")} aria-pressed={view === "grid"} aria-label="Grid view" title="Grid view"><LayoutGrid size={16} /></button>
                <button type="button" className={view === "list" ? "active" : ""} onClick={() => setView("list")} aria-pressed={view === "list"} aria-label="List view" title="List view"><List size={16} /></button>
              </div>
              <label className="nkj-designs-sort">
                <span>Sort by</span>
                <select value={sort} onChange={(event) => setSort(event.target.value)}>
                  <option value="latest">Latest</option>
                  <option value="oldest">Oldest</option>
                  <option value="name">Name</option>
                  <option value="popular">Popularity</option>
                </select>
                <ChevronDown size={14} />
              </label>
            </div>
          </div>

          {error && <div className="nkj-designs-error" role="alert">{error}</div>}
          {loading && items.length === 0 ? (
            <div className="nkj-designs-loading"><LoaderCircle className="spin" size={24} /> Loading designs…</div>
          ) : items.length ? (
            <>
              <div className={`nkj-designs-grid ${view === "list" ? "is-list" : ""}`}>
                {items.map((design) => (
                  <article className="nkj-design-card" key={design.id}>
                    <div className="nkj-design-card-image">
                      <button
                        type="button"
                        className="nkj-design-image-trigger"
                        onClick={() => openDesign(design)}
                        aria-label={`Open ${design.designName} photograph and details`}
                      >
                        <DesignImage design={design} />
                        <span className="nkj-design-image-zoom-hint">View large photo <ArrowUpRight size={13} /></span>
                      </button>
                      <button type="button" className={`nkj-design-favorite ${favorites.has(design.designCode) ? "saved" : ""}`}
                        onClick={() => toggleFavorite(design.designCode)}
                        aria-label={favorites.has(design.designCode) ? "Remove favorite" : "Add favorite"}>
                        <Heart size={17} fill={favorites.has(design.designCode) ? "currentColor" : "none"} />
                      </button>
                      {isNewDesign(design.createdAt) && <span className="nkj-design-new-label">NEW</span>}
                      {design.isFeatured && <span className="nkj-design-featured"><Star size={11} fill="currentColor" /> Featured</span>}
                      {design.isSample && <span className="nkj-design-sample-label">Sample inspiration</span>}
                      {!design.isSample && <span className="nkj-design-real-label">Shop design</span>}
                    </div>
                    <div className="nkj-design-card-content">
                      <div className="nkj-design-card-meta">
                        <span>{design.subcategoryName}</span>
                        <small className="nkj-design-id-badge" title={design.designId || design.designCode}>
                          <span>DESIGN ID</span>
                          <b>{design.designId || design.designCode}</b>
                        </small>
                      </div>
                      <h3>{design.designName}</h3>
                      <p>{design.metalType} <span>•</span> {design.styleLabel || "Traditional Indian"} <span>•</span> {design.regionalInspiration || "Pan-Indian"}</p>
                      <p className="nkj-design-card-specs">
                        <span>{design.materialLabel || design.purity || "Material to be confirmed"}</span>
                        {design.purity && <span>{design.purity}</span>}
                        {design.weightGrams != null && <span>{Number(design.weightGrams).toLocaleString("en-IN")} g</span>}
                        {design.imageStatus === "PENDING" && <span className="nkj-design-pending-chip">Photo pending</span>}
                      </p>
                      <button type="button" onClick={() => openDesign(design)}>
                        View Design <ArrowUpRight size={15} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              <div className="nkj-designs-pagination">
                <span>Showing {items.length.toLocaleString("en-IN")} of {total.toLocaleString("en-IN")} designs</span>
                {items.length < total && (
                  <button type="button" disabled={loading} onClick={() => loadDesigns(page + 1, true)}>
                    {loading ? <LoaderCircle className="spin" size={16} /> : <ChevronDown size={16} />}
                    Load More Designs
                  </button>
                )}
              </div>
            </>
          ) : !error ? (
            <div className="nkj-designs-empty">
              <Gem size={30} />
              <b>No designs found</b>
              <span>Try another subcategory or keyword.</span>
              <button type="button" onClick={() => { setSearch(""); setSubcategory(""); }}>Clear filters</button>
            </div>
          ) : null}
        </section>

        {selected && (
          <div className="nkj-design-modal-backdrop" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeSelectedModal();
          }}>
            <section className="nkj-design-modal" role="dialog" aria-modal="true" aria-labelledby="nkj-design-modal-title">
              <button type="button" className="nkj-design-modal-close" onClick={closeSelectedModal} aria-label="Close design details">
                <X size={19} />
              </button>

              {modalImageUrl
                ? <div className={"nkj-design-modal-photo" + (zoomed ? " zoomed" : "")}>
                    <img
                      src={assetUrl(modalImageUrl)}
                      alt={activeImage?.altText || selected.designName}
                      onClick={() => setZoomed((value) => !value)}
                      onError={(event) => {
                        const fallback = assetUrl(modalThumbnailUrl);
                        if (fallback && fallback !== event.currentTarget.src && !event.currentTarget.dataset.fallbackTried) {
                          event.currentTarget.dataset.fallbackTried = "true";
                          event.currentTarget.src = fallback;
                        }
                      }}
                    />
                    {selected.images?.length > 1 && <>
                      <button type="button" className="nkj-design-photo-nav prev" onClick={() => { setActiveImageIndex((index) => (index - 1 + selected.images.length) % selected.images.length); setZoomed(false); }} aria-label="Previous photograph">‹</button>
                      <button type="button" className="nkj-design-photo-nav next" onClick={() => { setActiveImageIndex((index) => (index + 1) % selected.images.length); setZoomed(false); }} aria-label="Next photograph">›</button>
                    </>}
                    <button type="button" className="nkj-design-photo-zoom" onClick={() => setZoomed((value) => !value)}>
                      {zoomed ? "Zoom out" : "Zoom in"}
                    </button>
                    <small>{zoomed ? "Zoomed view · click photo or Zoom out" : "Full-size photograph · click to zoom"}</small>
                  </div>
                : <div className="nkj-design-photo-missing nkj-design-modal-photo-pending" role="img" aria-label="Jewellery photograph pending upload">
                    <ImagePlus size={42} />
                    <b>PHOTOGRAPH PENDING</b>
                    <span>The owner has not uploaded a verified product photograph for this design yet.</span>
                  </div>}

              <div className="nkj-design-modal-content">
                <div className="nkj-design-modal-content-scroll">
                  <span>{selected.designId || selected.designCode} • {selected.metalType} • {selected.subcategoryName}</span>
                  {selected.designId && selected.designCode && <small className="nkj-design-legacy-code">Legacy code: {selected.designCode}</small>}
                  <h2 id="nkj-design-modal-title">{selected.designName}</h2>
                  <p>{selected.description || "No additional design description has been added."}</p>
                  <dl>
                    <div><dt>Jewellery type</dt><dd>{selected.subcategoryName || "—"}</dd></div>
                    <div><dt>Style</dt><dd>{selected.styleLabel || "Traditional Indian"}</dd></div>
                    <div><dt>Regional inspiration</dt><dd>{selected.regionalInspiration || "Pan-Indian"}</dd></div>
                    <div><dt>Material</dt><dd>{selected.materialLabel || "To be confirmed"}</dd></div>
                    <div><dt>Purity / fineness</dt><dd>{selected.purity || "Not specified"}</dd></div>
                    <div><dt>Weight</dt><dd>{selected.weightGrams != null ? Number(selected.weightGrams).toLocaleString("en-IN") + " g" : "Not specified"}</dd></div>
                    {isAdmin && <div><dt>Reference price</dt><dd>{selected.priceInr != null ? "₹ " + Number(selected.priceInr).toLocaleString("en-IN") : "Not specified"}</dd></div>}
                    <div><dt>Photograph</dt><dd>{selected.imageStatus === "READY" ? "Available" : "Pending upload"}</dd></div>
                    <div><dt>Images</dt><dd>{selected.images?.length || selected.imageCount || 0}</dd></div>
                    <div><dt>Catalogue status</dt><dd>{selected.isSample ? "Sample inspiration" : "Owner-uploaded shop design"}</dd></div>
                    {isAdmin && <div><dt>Publication</dt><dd>{selected.isActive ? "Public" : "Hidden from public"}</dd></div>}
                  </dl>

                  {selected.images?.length > 0 && (
                    <div className="nkj-design-modal-gallery-section">
                      <div className="nkj-design-admin-section-heading">
                        <b>Design photographs</b>
                        <small>{selected.images.length} saved</small>
                      </div>
                      <div className="nkj-design-modal-gallery">
                        {selected.images.map((image, index) => (
                          <article key={image.id} className="nkj-design-gallery-image-item">
                            <button type="button" className={activeImageIndex === index ? "active" : ""} onClick={() => { setActiveImageIndex(index); setZoomed(false); }} aria-label={"View image " + (index + 1)}>
                              <img src={assetUrl(image.thumbnailUrl || image.displayUrl || image.originalUrl)} alt={image.altText || selected.designName} loading="lazy" />
                            </button>
                            {isAdmin && <div className="nkj-design-gallery-image-actions">
                              <button type="button" onClick={() => setPrimaryImage(image.id)} disabled={index === 0} title="Make primary"><CheckCircle2 size={12} /> Primary</button>
                              <button type="button" onClick={() => deleteDesignImage(image.id)} title="Delete image"><Trash2 size={12} /></button>
                            </div>}
                          </article>
                        ))}
                      </div>
                    </div>
                  )}

                  {adminActionError && <p className="nkj-design-admin-feedback error" role="alert">{adminActionError}</p>}
                  {adminActionMessage && <p className="nkj-design-admin-feedback success" role="status">{adminActionMessage}</p>}
                  {replacePhotoError && <p className="nkj-design-admin-feedback error" role="alert">{replacePhotoError}</p>}

                  {isAdmin && (
                    <section className="nkj-design-admin-panel">
                      <div className="nkj-design-admin-panel-heading">
                        <div><span>OWNER CONTROLS</span><b>Manage this design</b></div>
                        <Lock size={16} />
                      </div>
                      <div className="nkj-design-admin-action-row">
                        <button type="button" onClick={() => editMode ? setEditMode(false) : beginEditingDetails()} className="nkj-design-admin-button">
                          <Pencil size={14} /> {editMode ? "Close Edit" : "Edit Details"}
                        </button>
                        <button type="button" onClick={archiveSelectedDesign} className="nkj-design-admin-button danger">
                          <Trash2 size={14} /> Delete / Archive
                        </button>
                        <button type="button" onClick={generateMobileUploadQr} disabled={qrLoading} className="nkj-design-admin-button gold">
                          {qrLoading ? <LoaderCircle size={14} className="spin" /> : <QrCode size={14} />}
                          Upload from Mobile (QR Code)
                        </button>
                      </div>

                      {editMode && (
                        <form className="nkj-design-edit-form" onSubmit={saveDesignDetails}>
                          <div className="nkj-design-edit-grid">
                            <label className="wide">Design Name
                              <input maxLength={160} required value={editForm.designName || ""} onChange={(event) => setEditForm((current) => ({ ...current, designName: event.target.value }))} />
                            </label>
                            <label>Style
                              <input maxLength={80} value={editForm.styleLabel || ""} onChange={(event) => setEditForm((current) => ({ ...current, styleLabel: event.target.value }))} />
                            </label>
                            <label>Purity / Fineness
                              <input maxLength={40} value={editForm.purity || ""} onChange={(event) => setEditForm((current) => ({ ...current, purity: event.target.value }))} />
                            </label>
                            <label>Regional Inspiration
                              <input maxLength={80} value={editForm.regionalInspiration || ""} onChange={(event) => setEditForm((current) => ({ ...current, regionalInspiration: event.target.value }))} />
                            </label>
                            <label>Material
                              <input maxLength={120} value={editForm.materialLabel || ""} onChange={(event) => setEditForm((current) => ({ ...current, materialLabel: event.target.value }))} />
                            </label>
                            <label>Weight (grams)
                              <input type="number" min="0" step="0.001" value={editForm.weightGrams ?? ""} onChange={(event) => setEditForm((current) => ({ ...current, weightGrams: event.target.value }))} />
                            </label>
                            <label>Reference Price (₹)
                              <input type="number" min="0" step="0.01" value={editForm.priceInr ?? ""} onChange={(event) => setEditForm((current) => ({ ...current, priceInr: event.target.value }))} />
                            </label>
                            <label className="wide">Keywords
                              <input maxLength={800} value={editForm.keywords || ""} onChange={(event) => setEditForm((current) => ({ ...current, keywords: event.target.value }))} />
                            </label>
                            <label className="wide">Description
                              <textarea rows={3} maxLength={5000} value={editForm.description || ""} onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))} />
                            </label>
                          </div>
                          <div className="nkj-design-edit-toggles">
                            <label><input type="checkbox" checked={Boolean(editForm.isActive)} onChange={(event) => setEditForm((current) => ({ ...current, isActive: event.target.checked }))} /> Publish in public catalogue</label>
                            <label><input type="checkbox" checked={Boolean(editForm.isFeatured)} onChange={(event) => setEditForm((current) => ({ ...current, isFeatured: event.target.checked }))} /> Featured design</label>
                          </div>
                          <div className="nkj-design-admin-action-row">
                            <button type="button" className="nkj-design-admin-button" onClick={() => setEditMode(false)}><X size={14} /> Cancel</button>
                            <button type="submit" className="nkj-design-admin-button primary" disabled={savingDetails}>{savingDetails ? <LoaderCircle size={14} className="spin" /> : <Save size={14} />} Save Details</button>
                          </div>
                        </form>
                      )}

                      <div className="nkj-design-upload-tools">
                        <div>
                          <b>Upload from Computer</b>
                          <small>Add one or multiple photographs to this design. Existing photographs remain saved.</small>
                        </div>
                        <label className="nkj-design-admin-button">
                          <UploadCloud size={14} /> Choose Photos
                          <input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" multiple onChange={selectDesktopImages} disabled={uploadingImages} />
                        </label>
                        {pendingImages.length > 0 && (
                          <>
                            <div className="nkj-design-desktop-preview-grid">
                              {pendingImages.map((item) => <article key={item.id}>
                                <img src={item.previewUrl} alt={item.file.name} />
                                <span title={item.file.name}>{item.file.name}</span>
                                <button type="button" onClick={() => removePendingImage(item.id)} aria-label="Remove selected photo"><X size={13} /></button>
                              </article>)}
                            </div>
                            <div className="nkj-design-admin-action-row">
                              <button type="button" className="nkj-design-admin-button" onClick={clearPendingImages}><RotateCcw size={13} /> Clear Selection</button>
                              <button type="button" className="nkj-design-admin-button primary" onClick={uploadSelectedImages} disabled={uploadingImages}>{uploadingImages ? <LoaderCircle size={14} className="spin" /> : <UploadCloud size={14} />} {uploadingImages ? "Uploading…" : "Save Photos"}</button>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="nkj-design-replace-photo-tools">
                        <div><b>Replace Primary Photograph</b><small>Replaces only the first photograph; other gallery images and the Design ID are preserved.</small></div>
                        <label className={"nkj-design-replace-photo-button" + (replacingPhoto ? " is-busy" : "")}>
                          {replacingPhoto ? <LoaderCircle size={16} className="spin" /> : <ImagePlus size={16} />}
                          <span>{replacingPhoto ? "Replacing photograph…" : "Change / Replace photograph"}</span>
                          <input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" disabled={replacingPhoto} onChange={replaceSelectedPhoto} />
                        </label>
                      </div>

                      {(qrLoading || qrSession || qrError) && (
                        <div className="nkj-design-mobile-qr-panel">
                          <div className="nkj-design-mobile-qr-heading">
                            <div><b>Upload from Mobile</b><small>Scan with your phone camera. This link expires in five minutes and accepts one upload.</small></div>
                            <Smartphone size={20} />
                          </div>
                          {qrLoading && <p className="nkj-design-qr-status"><LoaderCircle size={14} className="spin" /> Generating secure QR code…</p>}
                          {qrError && <p className="nkj-design-admin-feedback error" role="alert">{qrError}</p>}
                          {qrSession && (
                            <div className="nkj-design-mobile-qr-content">
                              {["WAITING", "SCANNED"].includes(qrSession.status) && qrSession.uploadUrl && (
                                <div className="nkj-design-mobile-qr-image"><QRCodeSVG value={qrSession.uploadUrl} size={176} level="H" includeMargin /></div>
                              )}
                              <div className="nkj-design-mobile-qr-info">
                                <span className={"nkj-design-qr-status-chip " + String(qrSession.status || "").toLowerCase()}>{qrSession.status || "WAITING"}</span>
                                <b>{qrSession.status === "SCANNED" ? "Phone connected" : qrSession.status === "UPLOADED" ? "Photos received" : qrSession.status === "EXPIRED" ? "QR expired" : qrSession.status === "REVOKED" ? "QR revoked" : "Waiting for phone scan"}</b>
                                <small>Design: {selected.designId || selected.designCode}</small>
                                {qrSession.expiresAt && <small>Expires: {new Date(qrSession.expiresAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</small>}
                                {["EXPIRED", "REVOKED", "UPLOADED"].includes(qrSession.status) && <button type="button" className="nkj-design-admin-button gold" onClick={generateMobileUploadQr} disabled={qrLoading}><QrCode size={13} /> Generate New QR</button>}
                                {["WAITING", "SCANNED"].includes(qrSession.status) && <button type="button" className="nkj-design-admin-button" onClick={closeSelectedModal}>Close and Revoke QR</button>}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </section>
                  )}

                  <small>{detailLoading ? "Loading complete design details…" : selected.isSample ? "Inspiration entry only. This is not confirmed stock or a product available for sale." : "Shop photograph uploaded by the owner. Confirm current availability and final price with the shop."}</small>
                </div>
              </div>
              <button type="button" className="nkj-design-modal-done" onClick={closeSelectedModal}>Close</button>
            </section>
          </div>
        )}
      </div>
    </Page>
  );
}
