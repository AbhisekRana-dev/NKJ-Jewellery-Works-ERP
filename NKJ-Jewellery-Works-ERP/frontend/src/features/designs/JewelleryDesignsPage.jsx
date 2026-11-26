import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Gem, Crown, Flower2, Sparkles, CircleDot, Heart, Search, X, ArrowUpRight, ImagePlus,
  Layers3, Star, ChevronDown, ChevronLeft, ChevronRight, LoaderCircle, Orbit, Hexagon, Aperture, Waves, Bird, QrCode,
  LayoutGrid, List, Pencil, Trash2, Save, UploadCloud, Smartphone, CheckCircle2, Lock,
  RotateCcw, ZoomIn, ZoomOut, Maximize2, Package, Weight, Info,
} from "lucide-react";
import { Page } from "../../shared/layouts/OwnerShell";
import { request } from "../../core/api/client";
import { getRealtimeClientId, useRealtimeRefresh } from "../../core/realtime/realtime";
import { useAuth } from "../../core/auth/AuthProvider";
import { QRCodeSVG } from "qrcode.react";
import "./JewelleryDesignsPage.css";

const PAGE_SIZE = 20;
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
const normalizeCollectionKey = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

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
  if (!path || typeof path !== "string") return "";
  const value = path.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/api/")) return `${API_ORIGIN}${value}`;
  if (value.startsWith("api/")) return `${API_ORIGIN}/${value}`;
  if (value.startsWith("/uploads/designs/")) return `${API_ORIGIN}/api${value}`;
  if (value.startsWith("uploads/designs/")) return `${API_ORIGIN}/api/${value}`;
  return value.startsWith("/") ? value : `/${value}`;
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

function sampleArtworkPhoto(design) {
  const description = [
    design?.metalType,
    design?.subcategoryName,
    design?.designName,
    design?.designCode,
  ].filter(Boolean).join(" ").toLowerCase();
  const code = String(design?.designCode || design?.designId || "");
  const suffix = Number(code.match(/(\d{4})$/)?.[1] || 0);

  // These photographs are existing, clearly-labelled sample inspiration assets.
  // Locket sample IDs 0021–0025 correspond to the 00721–00725 image set.
  if (description.includes("locket")) {
    const imageNumber = suffix >= 21 && suffix <= 25 ? suffix + 700 : 724;
    return `/nkj-design-samples/gold-locket-${String(imageNumber).padStart(5, "0")}.jpg`;
  }
  if (description.includes("jhumka") || description.includes("earring")) {
    return "/nkj-design-samples/gold-jhumka-earrings.jpg";
  }
  if (description.includes("anklet") || description.includes("payal") || description.includes("silver")) {
    return "/nkj-design-samples/silver-payal-anklets.jpg";
  }
  if (description.includes("diamond")) {
    return "/nkj-design-samples/diamond-halo-ring.jpg";
  }
  if (description.includes("necklace") || description.includes("haram")) {
    return "/nkj-design-samples/gold-temple-necklace.jpg";
  }
  if (description.includes("bangle")) return "/collection-bangles.png";
  if (description.includes("ring")) return "/collection-rings.png";
  return "";
}

function SampleArtwork({ design }) {
  const Icon = iconFor(design);
  const hue = hueFor(design);
  const photo = sampleArtworkPhoto(design);
  return (
    <div className={`nkj-design-art ${photo ? "has-product-photo" : ""}`} style={{ "--design-hue": hue }} aria-label="Sample design inspiration">
      {photo ? (
        <img className="nkj-design-art-image" src={photo} alt={design.designName || "Jewellery sample inspiration"} loading="lazy" />
      ) : (
        <>
          <span className="nkj-design-art-orbit orbit-one" />
          <span className="nkj-design-art-orbit orbit-two" />
          <span className="nkj-design-art-spark spark-one">✦</span>
          <span className="nkj-design-art-spark spark-two">✧</span>
          <div className="nkj-design-art-center">
            <Icon size={70} strokeWidth={1.2} />
          </div>
        </>
      )}
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
  const { isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const collectionQuery = searchParams.get("collection") || "";
  const [categories, setCategories] = useState([]);
  const [metal, setMetal] = useState("GOLD");
  const [subcategory, setSubcategory] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("latest");
  const [view, setView] = useState("grid");
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [adminPhotoZoom, setAdminPhotoZoom] = useState(1);
  const [adminPhotoExpanded, setAdminPhotoExpanded] = useState(false);
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
  const modalContentRef = useRef(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [qrSession, setQrSession] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState("");
  const [favorites, setFavorites] = useState(loadFavorites);
  const appliedCollectionRef = useRef("");

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

  // Homepage collection links carry a category slug. Resolve it against the
  // live catalogue so the links keep working even if the owner renames or
  // re-slugs a category later.
  useEffect(() => {
    const requested = collectionQuery.trim();
    if (!requested || loadingCategories || !categories.length || appliedCollectionRef.current === requested) return;

    const requestedKey = normalizeCollectionKey(requested);
    const singularKey = requestedKey.endsWith("s") ? requestedKey.slice(0, -1) : requestedKey;
    const match = categories.find((category) => {
      const keys = [
        normalizeCollectionKey(category.slug),
        normalizeCollectionKey(category.subcategoryName),
      ].filter(Boolean);
      return keys.some((key) => key === requestedKey || (key.endsWith("s") ? key.slice(0, -1) : key) === singularKey);
    });

    appliedCollectionRef.current = requested;
    if (match) {
      setMetal(String(match.metalType || "GOLD").toUpperCase());
      setSubcategory(match.slug || "");
      setSearch("");
    } else {
      // If the catalogue uses a different category label, still take the
      // customer to a useful filtered view rather than an unfiltered page.
      setMetal("GOLD");
      setSubcategory("");
      setSearch(requested.replace(/[-_]+/g, " "));
    }

    const frame = window.requestAnimationFrame(() => {
      document.querySelector(".nkj-designs-gallery-section")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [collectionQuery, categories, loadingCategories]);

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
    setAdminPhotoZoom(1);
    setAdminPhotoExpanded(false);
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
    if (modalContentRef.current) modalContentRef.current.scrollTop = 0;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handlePreviewKeys = (event) => {
      if (event.key === "Escape") {
        closeSelectedModal();
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
  const activeImageCandidates = [...new Set([
    activeImage?.displayUrl,
    activeImage?.originalUrl,
    activeImage?.thumbnailUrl,
    selected?.displayUrl,
    selected?.originalUrl,
    selected?.thumbnailUrl,
  ].map(assetUrl).filter(Boolean))];

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
    // Never leave a previously authenticated owner detail view visible after logout.
    setSelected(null);
    setActiveImageIndex(0);
    setZoomed(false);
    setAdminPhotoZoom(1);
    setAdminPhotoExpanded(false);
    setEditMode(false);
    setQrSession(null);
    setQrError("");
    setAdminActionError("");
    setAdminActionMessage("");
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
    setAdminPhotoZoom(1);
    setAdminPhotoExpanded(false);
  };

  const beginEditingDetails = () => {
    if (!isAdmin || !selected) return;
    setAdminActionError("");
    setAdminActionMessage("");
    setEditForm({
      designName: selected.designName || "",
      styleLabel: selected.styleLabel || "",
      materialLabel: selected.materialLabel || "",
      weightGrams: selected.weightGrams == null ? "" : String(selected.weightGrams),
    });
    setEditMode(true);
  };

  const cancelEditingDetails = () => {
    setEditForm({});
    setEditMode(false);
    setAdminActionError("");
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
        // Preserve every field that is not part of the compact detail editor.
        // The existing record is updated in place; no create endpoint is called.
        categoryId: selected.categoryId,
        designName: editForm.designName.trim(),
        description: selected.description || "",
        styleLabel: editForm.styleLabel || "",
        keywords: selected.keywords || "",
        purity: selected.purity || "",
        regionalInspiration: selected.regionalInspiration || "",
        materialLabel: editForm.materialLabel || "",
        weightGrams: editForm.weightGrams === "" ? null : Number(editForm.weightGrams),
        priceInr: selected.priceInr == null ? null : Number(selected.priceInr),
        isActive: selected.isActive !== false,
        isFeatured: Boolean(selected.isFeatured),
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

  const revokeMobileUploadQr = async () => {
    if (!isAdmin || !qrSession?.sessionId) return;
    try {
      await request(`/admin/design-upload-sessions/${qrSession.sessionId}`, { method: "DELETE" });
      setQrSession((current) => current ? { ...current, status: "REVOKED" } : current);
      setQrError("");
    } catch (error) {
      setQrError(error.message || "Could not revoke this QR upload session.");
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

        <section className="nkj-designs-gallery-section" id="nkj-designs-gallery">
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
                          <b>{design.designId || design.designCode || "Not assigned"}</b>
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
          <div className="nkj-catalog-modal-backdrop nkj-catalog-view-backdrop" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeSelectedModal();
          }}>
            
              <section className="nkj-catalog-details-modal nkj-catalog-view-modal" role="dialog" aria-modal="true" aria-labelledby="nkj-design-modal-title">
                <button type="button" className="nkj-catalog-view-close" onClick={closeSelectedModal} aria-label="Close design details"><X size={23} /></button>
                <div className="nkj-catalog-view-layout">
                  <section className="nkj-catalog-view-gallery" aria-label="Design photographs">
                    <div className="nkj-catalog-view-main-photo">
                      {selected.images?.length ? (
                        <>
                          <span className="nkj-catalog-view-image-fallback"><ImagePlus size={34} /><b>Photograph unavailable</b><small>The saved image could not be loaded.</small></span>
                          <img
                            className="nkj-catalog-view-main-image"
                            src={activeImageCandidates[0] || ""}
                            alt={activeImage?.altText || selected.designName}
                            style={{ transform: `scale(${adminPhotoZoom})` }}
                            onError={(event) => {
                              const element = event.currentTarget;
                              const nextIndex = Number(element.dataset.fallbackIndex || "0") + 1;
                              if (nextIndex < activeImageCandidates.length) {
                                element.dataset.fallbackIndex = String(nextIndex);
                                element.src = activeImageCandidates[nextIndex];
                              } else {
                                element.style.display = "none";
                                element.parentElement?.querySelector(".nkj-catalog-view-image-fallback")?.classList.add("is-visible");
                              }
                            }}
                            onLoad={(event) => {
                              event.currentTarget.dataset.fallbackIndex = "0";
                              event.currentTarget.style.display = "block";
                              event.currentTarget.parentElement?.querySelector(".nkj-catalog-view-image-fallback")?.classList.remove("is-visible");
                            }}
                          />
                          <span className="nkj-catalog-view-image-count">{Math.min(activeImageIndex + 1, selected.images.length)} / {selected.images.length}</span>
                          <div className="nkj-catalog-view-image-tools">
                            <button type="button" aria-label="Zoom in" onClick={() => setAdminPhotoZoom((value) => Math.min(2.5, Number((value + .25).toFixed(2))))}><ZoomIn size={19} /></button>
                            <button type="button" aria-label="Zoom out" disabled={adminPhotoZoom <= 1} onClick={() => setAdminPhotoZoom((value) => Math.max(1, Number((value - .25).toFixed(2))))}><ZoomOut size={19} /></button>
                            <button type="button" aria-label="View photograph full screen" onClick={() => setAdminPhotoExpanded(true)}><Maximize2 size={19} /></button>
                          </div>
                          {selected.images.length > 1 && (
                            <>
                              <button type="button" className="nkj-catalog-view-image-arrow previous" aria-label="Previous photograph" onClick={() => { setActiveImageIndex((index) => (index - 1 + selected.images.length) % selected.images.length); setAdminPhotoZoom(1); }}><ChevronLeft size={25} /></button>
                              <button type="button" className="nkj-catalog-view-image-arrow next" aria-label="Next photograph" onClick={() => { setActiveImageIndex((index) => (index + 1) % selected.images.length); setAdminPhotoZoom(1); }}><ChevronRight size={25} /></button>
                            </>
                          )}
                        </>
                      ) : (
                        <div className="nkj-catalog-view-no-photo"><ImagePlus size={48} /><b>No photograph uploaded</b><span>Edit this design to add product photographs.</span></div>
                      )}
                    </div>
                    <div className="nkj-catalog-view-gallery-thumbs">
                      {(selected.images || []).map((image, index) => (
                        <button type="button" key={image.id} className={index === activeImageIndex ? "active" : ""} onClick={() => { setActiveImageIndex(index); setAdminPhotoZoom(1); }} aria-label={`View photograph ${index + 1}`}>
                          <img src={assetUrl(image.thumbnailUrl || image.displayUrl || image.originalUrl)} alt={image.altText || `Design photograph ${index + 1}`} loading="lazy" />
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="nkj-catalog-view-information">
                    <header className="nkj-catalog-view-title-row">
                      <div>
                        {editMode ? (
                          <input className="nkj-design-inline-name" id="nkj-design-modal-title" maxLength={160} required value={editForm.designName || ""} onChange={(event) => setEditForm((current) => ({ ...current, designName: event.target.value }))} />
                        ) : <h2 id="nkj-design-modal-title">{selected.designName || selected.subcategoryName || "Untitled Design"}</h2>}
                      </div>
                    </header>

                    <div className="nkj-catalog-view-id">
                      <QrCode size={18} /><span>DESIGN ID</span><b>{selected.designId || selected.designCode || "Not assigned"}</b>
                    </div>

                    <section className="nkj-catalog-view-card nkj-catalog-view-detail-card">
                      <h3><Info size={19} /> DETAIL</h3>
                      <div className="nkj-catalog-view-detail-rows">
                        <div><Gem size={22} /><span>Jewellery type</span><b>{selected.subcategoryName || "—"}</b></div>
                        <div><Layers3 size={22} /><span>Style</span><b>{editMode
                          ? <input aria-label="Style" maxLength={80} value={editForm.styleLabel ?? ""} onChange={(event) => setEditForm((current) => ({ ...current, styleLabel: event.target.value }))} />
                          : (selected.styleLabel || "—")}</b></div>
                        <div><Package size={22} /><span>Material</span><b>{editMode
                          ? <input aria-label="Material" maxLength={120} value={editForm.materialLabel ?? ""} onChange={(event) => setEditForm((current) => ({ ...current, materialLabel: event.target.value }))} />
                          : (selected.materialLabel || selected.metalType || "—")}</b></div>
                        <div><Weight size={22} /><span>Weight</span><b>{editMode
                          ? <input aria-label="Weight in grams" type="number" min="0" step="0.001" value={editForm.weightGrams ?? ""} onChange={(event) => setEditForm((current) => ({ ...current, weightGrams: event.target.value }))} />
                          : (selected.weightGrams == null ? "—" : Number(selected.weightGrams).toLocaleString("en-IN") + " g")}</b></div>
                      </div>

                    </section>

                    <section className="nkj-catalog-view-card nkj-catalog-view-photos-card">
                      <header><h3><ImagePlus size={19} /> Design photographs</h3><span>{selected.images?.length || 0} photographs</span></header>
                      <div className="nkj-catalog-view-photo-management">
                        <div className="nkj-catalog-view-photo-strip">
                          {(selected.images || []).map((image, index) => (
                            <button type="button" key={image.id} className={index === activeImageIndex ? "active" : ""} onClick={() => { setActiveImageIndex(index); setAdminPhotoZoom(1); }} aria-label={`Select photograph ${index + 1}`}>
                              <img src={assetUrl(image.thumbnailUrl || image.displayUrl || image.originalUrl)} alt={image.altText || `Saved photograph ${index + 1}`} />
                            </button>
                          ))}
                          {!selected.images?.length && <span className="nkj-catalog-view-no-saved">No saved photographs</span>}
                        </div>
                        {isAdmin && (
                        <div className="nkj-catalog-view-photo-actions">
                          <button type="button" className="primary-photo" disabled={!selected.images?.length || activeImageIndex === 0} onClick={() => activeImage && setPrimaryImage(activeImage.id)}><Star size={16} fill="currentColor" /> Primary</button>
                          <button type="button" className="remove-photo" disabled={!selected.images?.length} onClick={() => activeImage && deleteDesignImage(activeImage.id)} aria-label="Remove selected photograph"><Trash2 size={17} /></button>
                        </div>
                        )}
                      </div>
                    </section>

                    {isAdmin && (
                      <section className="nkj-catalog-view-card nkj-catalog-owner-controls">
                        <div className="nkj-catalog-owner-controls-heading">
                          <div><Lock size={21} /><span><small>OWNER CONTROLS</small><b>Manage this design</b></span></div>
                          <Lock size={22} />
                        </div>
                        <div className="nkj-catalog-owner-control-actions">
                          {!editMode && <button type="button" className="edit" onClick={beginEditingDetails}><Pencil size={18} /> Edit Details</button>}
                          <button type="button" className="archive" onClick={archiveSelectedDesign}><Trash2 size={18} /> Delete / Archive</button>
                          <button type="button" className="mobile-upload" onClick={generateMobileUploadQr} disabled={qrLoading}>{qrLoading ? <LoaderCircle size={16} className="spin" /> : <QrCode size={19} />} Upload from Mobile (QR Code)</button>
                        </div>
  
                        <details className="nkj-catalog-view-computer-upload">
                          <summary><UploadCloud size={15} /> Upload from Computer / Replace Primary Photograph</summary>
                          <div className="nkj-design-upload-tools">
                            <div><b>Upload from Computer</b><small>Add one or multiple photographs to this design. Existing photographs remain saved.</small></div>
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
                        </details>
  
                        {(qrLoading || qrSession || qrError) && (
                          <div className="nkj-design-mobile-qr-panel">
                            <div className="nkj-design-mobile-qr-heading"><div><b>Upload from Mobile</b><small>Scan with your phone camera. This link expires in five minutes and accepts one upload.</small></div><Smartphone size={20} /></div>
                            {qrLoading && <p className="nkj-design-qr-status"><LoaderCircle size={14} className="spin" /> Generating secure QR code…</p>}
                            {qrError && <p className="nkj-design-admin-feedback error" role="alert">{qrError}</p>}
                            {qrSession && (
                              <div className="nkj-design-mobile-qr-content">
                                {["WAITING", "SCANNED"].includes(qrSession.status) && qrSession.uploadUrl && <div className="nkj-design-mobile-qr-image"><QRCodeSVG value={qrSession.uploadUrl} size={176} level="H" includeMargin /></div>}
                                <div className="nkj-design-mobile-qr-info">
                                  <span className={"nkj-design-qr-status-chip " + String(qrSession.status || "").toLowerCase()}>{qrSession.status || "WAITING"}</span>
                                  <b>{qrSession.status === "SCANNED" ? "Phone connected" : qrSession.status === "UPLOADED" ? "Photos received" : qrSession.status === "EXPIRED" ? "QR expired" : qrSession.status === "REVOKED" ? "QR revoked" : "Waiting for phone scan"}</b>
                                  <small>Design: {selected.designId || selected.designCode}</small>
                                  {qrSession.expiresAt && <small>Expires: {new Date(qrSession.expiresAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</small>}
                                  {["EXPIRED", "REVOKED", "UPLOADED"].includes(qrSession.status) && <button type="button" className="nkj-design-admin-button gold" onClick={generateMobileUploadQr} disabled={qrLoading}><QrCode size={13} /> Generate New QR</button>}
                                  {["WAITING", "SCANNED"].includes(qrSession.status) && <button type="button" className="nkj-design-admin-button danger" onClick={revokeMobileUploadQr}><X size={13} /> Revoke QR</button>}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        {adminActionError && <p className="nkj-design-admin-feedback error" role="alert">{adminActionError}</p>}
                        {adminActionMessage && <p className="nkj-design-admin-feedback success" role="status">{adminActionMessage}</p>}
                        {replacePhotoError && <p className="nkj-design-admin-feedback error" role="alert">{replacePhotoError}</p>}
                      </section>
                    )}
                  </section>
                </div>
                <footer className="nkj-catalog-view-footer"><button type="button" onClick={closeSelectedModal}>Close</button></footer>
                {adminPhotoExpanded && selected.images?.length > 0 && (
                  <div className="nkj-catalog-view-lightbox" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAdminPhotoExpanded(false); }}>
                    <button type="button" className="close" onClick={() => setAdminPhotoExpanded(false)} aria-label="Close full-screen photo"><X size={23} /></button>
                    <img src={assetUrl(activeImage?.originalUrl || activeImage?.displayUrl || activeImage?.thumbnailUrl)} alt={selected.designName} />
                  </div>
                )}
              </section>
          </div>
        )}
      </div>
    </Page>
  );
}
