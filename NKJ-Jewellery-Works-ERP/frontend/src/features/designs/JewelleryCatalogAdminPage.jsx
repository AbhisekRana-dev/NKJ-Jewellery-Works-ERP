import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, Pencil, Trash2, Eye, EyeOff, Star, Upload, ImagePlus, X, LoaderCircle, Save, Layers3, QrCode, RefreshCw, Copy, CheckCircle2, Clock3, Smartphone, RotateCcw, RotateCw, Info, ArrowRightLeft, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, Gem, Package, Weight, LockKeyhole } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Page } from "../../shared/layouts/OwnerShell";
import { useLocation, useNavigate } from "react-router-dom";
import { request } from "../../core/api/client";
import { getRealtimeClientId, useRealtimeRefresh } from "../../core/realtime/realtime";
import "./JewelleryCatalogAdminPage.css";
import { getPurityOptions, isPurityAllowed } from "./purityOptions";

const API = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
const PAGE_SIZE = 30;
const assetUrl = (path) => path && path.startsWith("/api/") ? `${API}${path.slice(4)}` : path;
const blankForm = (categoryId = "", metalType = "GOLD") => ({
  categoryId: String(categoryId),
  metalType,
  designName: "",
  description: "",
  styleLabel: "",
  regionalInspiration: "",
  materialLabel: "",
  keywords: "",
  purity: "",
  weightGrams: "",
  priceInr: "",
  isActive: true,
  isFeatured: false,
});

async function uploadDesignImages(designId, files, imageAdjustments = []) {
  const selectedFiles = Array.from(files || []);
  if (!selectedFiles.length) return null;

  const token = window.localStorage.getItem("nkj_token");
  let latestResult = null;

  // The backend accepts 20 files per request (10 MB per image). Split larger
  // owner selections into sequential batches so a design can have more than
  // 20 photographs without asking the owner to repeat the selection.
  for (let offset = 0; offset < selectedFiles.length; offset += 20) {
    const formData = new FormData();
    selectedFiles.slice(offset, offset + 20).forEach((file, index) => {
      const sourceIndex = offset + index;
      const adjustment = imageAdjustments[sourceIndex] || {};
      formData.append("files", file);
      formData.append("rotations", String(Number(adjustment.rotation) || 0));
      formData.append("cropZooms", String(Number(adjustment.cropZoom) || 1));
    });

    let response;
    try {
      response = await fetch(`${API}/admin/designs/${designId}/images`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "X-NKJ-Client-Id": getRealtimeClientId(),
        },
        body: formData,
      });
    } catch {
      throw new Error("Cannot connect to the server while uploading images.");
    }

    const raw = await response.text();
    let data = {};
    if (raw) {
      try { data = JSON.parse(raw); } catch { data = { message: raw }; }
    }

    if (response.status === 401) {
      window.localStorage.removeItem("nkj_token");
      window.localStorage.removeItem("nkj_user");
      window.dispatchEvent(new Event("nkj:session-expired"));
    }
    if (!response.ok) {
      throw new Error(data.message || `Image upload failed at photo ${offset + 1} (${response.status}).`);
    }
    latestResult = data;
  }

  return latestResult;
}

const cleanFileName = (name) => String(name || "Jewellery Design")
  .replace(/\.[^.]+$/, "")
  .replace(/[_-]+/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, 150);

export default function JewelleryCatalogAdminPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [metal, setMetal] = useState("GOLD");
  const [subcategory, setSubcategory] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("latest");
  const [purityFilter, setPurityFilter] = useState("");
  const [page, setPage] = useState(0);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveInFlightRef = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [currentDesignId, setCurrentDesignId] = useState("");
  const [moveCategoryId, setMoveCategoryId] = useState("");
  const [movingDesign, setMovingDesign] = useState(false);
  const [form, setForm] = useState(blankForm());
  const [imageFiles, setImageFiles] = useState([]);
  const [imageAdjustments, setImageAdjustments] = useState({});
  const [currentImages, setCurrentImages] = useState([]);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [deletingDesign, setDeletingDesign] = useState(false);
  const [viewingDesign, setViewingDesign] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailImageIndex, setDetailImageIndex] = useState(0);
  const [detailImageZoom, setDetailImageZoom] = useState(1);
  const [detailPhotoExpanded, setDetailPhotoExpanded] = useState(false);
  const [detailsActionBusy, setDetailsActionBusy] = useState(false);
  const [detailsActionError, setDetailsActionError] = useState("");
  const [bulkFiles, setBulkFiles] = useState([]);
  const [bulkDesignNames, setBulkDesignNames] = useState([]);
  const [bulkNameConfirmed, setBulkNameConfirmed] = useState([]);
  const bulkPreviews = useMemo(() => bulkFiles.map((file) => ({ file, url: URL.createObjectURL(file) })), [bulkFiles]);
  useEffect(() => () => bulkPreviews.forEach((preview) => URL.revokeObjectURL(preview.url)), [bulkPreviews]);
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState("");
  const [newSubcategoryMetal, setNewSubcategoryMetal] = useState("GOLD");
  const [newSubcategoryName, setNewSubcategoryName] = useState("");
  const [categorySaving, setCategorySaving] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrSession, setQrSession] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState("");
  const [qrNow, setQrNow] = useState(Date.now());
  const [qrCopied, setQrCopied] = useState(false);
  const [activeUploadPreviewKey, setActiveUploadPreviewKey] = useState("");
  const [activeStoredImageId, setActiveStoredImageId] = useState(null);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const initialFormRef = useRef(blankForm());
  const imagePreviews = useMemo(
    () => imageFiles.map((file) => ({
      file,
      key: `${file.name}::${file.size}::${file.lastModified}`,
      url: URL.createObjectURL(file),
    })),
    [imageFiles],
  );

  useEffect(() => () => {
    imagePreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
  }, [imagePreviews]);

  const metalCategories = useMemo(() => categories.filter((item) => item.metalType === metal && item.isActive !== false), [categories, metal]);
  const formMetalCategories = useMemo(
    () => categories.filter((item) => item.metalType === form.metalType && item.isActive !== false),
    [categories, form.metalType],
  );
  const formPurityOptions = getPurityOptions(form.metalType);
  const hasLegacyPurity = Boolean(form.purity) && !isPurityAllowed(form.metalType, form.purity);

  const loadCategories = useCallback(async () => {
    const data = await request("/admin/designs/categories");
    setCategories(Array.isArray(data) ? data : []);
    if (Array.isArray(data) && data.length) {
      setBulkCategoryId((current) => current || String(data.find((item) => item.metalType === "GOLD")?.id || data[0].id));
    }
  }, []);

  const generateQrSession = async () => {
    setQrLoading(true);
    setQrError("");
    setQrSession(null);
    try {
      const session = await request("/admin/design-upload-sessions", { method: "POST" });
      setQrSession({ ...session, status: "WAITING" });
      setQrNow(Date.now());
    } catch (err) {
      setQrError(err.message || "Could not generate a mobile upload QR code.");
    } finally {
      setQrLoading(false);
    }
  };

  const closeQrModal = async () => {
    const sessionId = qrSession?.sessionId;
    setQrOpen(false);
    setQrSession(null);
    setQrError("");
    if (sessionId) {
      try {
        await request(`/admin/design-upload-sessions/${sessionId}`, { method: "DELETE" });
      } catch (err) {
        console.warn("QR upload session revoke did not complete:", err);
      }
    }
  };

  const copyQrLink = async () => {
    if (!qrSession?.uploadUrl) return;
    try {
      await navigator.clipboard.writeText(qrSession.uploadUrl);
      setQrCopied(true);
      window.setTimeout(() => setQrCopied(false), 1800);
    } catch {
      setQrError("Clipboard access is unavailable. Scan the QR code instead.");
    }
  };

  const loadDesigns = useCallback(async (nextPage = page) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ metal, sort, page: String(nextPage), size: String(PAGE_SIZE) });
      if (subcategory) params.set("subcategory", subcategory);
      if (search.trim()) params.set("q", search.trim());
      if (purityFilter) params.set("purity", purityFilter);
      const result = await request(`/admin/designs?${params.toString()}`);
      setItems(Array.isArray(result.items) ? result.items : []);
      setTotal(Number(result.total) || 0);
      setPage(Number(result.page) || 0);
    } catch (err) {
      setError(err.message || "Could not load the jewellery catalogue.");
    } finally {
      setLoading(false);
    }
  }, [metal, subcategory, search, sort, purityFilter, page]);

  useRealtimeRefresh(() => loadDesigns(page), ["designs"]);

  useEffect(() => {
    if (!qrOpen || !qrSession?.sessionId || !["WAITING", "SCANNED"].includes(qrSession.status)) return undefined;
    let active = true;
    let uploadHandled = false;
    const timer = window.setInterval(async () => {
      setQrNow(Date.now());
      try {
        const status = await request(`/admin/design-upload-sessions/${qrSession.sessionId}`);
        if (!active) return;
        setQrSession((current) => current ? { ...current, ...status } : current);

        if (status.status === "UPLOADED" && !uploadHandled) {
          uploadHandled = true;
          const nextMetal = status.metalType || metal;
          const nextSubcategory = status.subcategorySlug || "";
          setMetal(nextMetal);
          setSubcategory(nextSubcategory);
          setPurityFilter("");
          setSearch("");
          setSort("latest");
          setPage(0);
          setMessage(`New jewellery design uploaded: ${status.generatedDesignId || ""} ${status.designName || ""}`);

          // Fetch using the uploaded design's category rather than the
          // catalogue's previous filter (for example, SILVER -> GOLD).
          const params = new URLSearchParams({
            metal: nextMetal,
            sort: "latest",
            page: "0",
            size: String(PAGE_SIZE),
          });
          if (nextSubcategory) params.set("subcategory", nextSubcategory);
          const refreshed = await request(`/admin/designs?${params.toString()}`);
          if (!active) return;
          setItems(Array.isArray(refreshed.items) ? refreshed.items : []);
          setTotal(Number(refreshed.total) || 0);
          setPage(Number(refreshed.page) || 0);
          await loadCategories();
        }

        if (status.status === "EXPIRED" || status.status === "REVOKED") {
          setQrError(status.status === "EXPIRED"
            ? "This QR code has expired. Generate a new one to continue."
            : "This QR code has been revoked.");
        }
      } catch (err) {
        if (active) setQrError(err.message || "Could not check mobile upload status.");
      }
    }, 2200);
    const clock = window.setInterval(() => setQrNow(Date.now()), 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.clearInterval(clock);
    };
  }, [qrOpen, qrSession?.sessionId, qrSession?.status, loadCategories, metal]);

  // Periodic fallback: mobile QR uploads still appear if the browser's SSE
  // connection is temporarily unavailable or the laptop resumes from sleep.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") loadDesigns(page);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [loadDesigns, page]);

  useEffect(() => {
    loadCategories().catch((err) => setError(err.message || "Could not load catalogue categories."));
  }, [loadCategories]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadDesigns(0), search.trim() ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [metal, subcategory, search, sort, purityFilter]);

  const openNewForm = () => {
    const categoryId = metalCategories[0]?.id || categories[0]?.id || "";
    const nextForm = blankForm(categoryId, metal);
    setEditingId(null);
    setCurrentDesignId("");
    setMoveCategoryId("");
    setForm(nextForm);
    initialFormRef.current = nextForm;
    setImageFiles([]);
    setImageAdjustments({});
    setCurrentImages([]);
    setActiveUploadPreviewKey("");
    setActiveStoredImageId(null);
    setPreviewPhoto(null);
    setShowForm(true);
    setError("");
  };

  const openEditForm = async (design) => {
    setError("");
    try {
      const detail = await request(`/admin/designs/${design.id}`);
      setEditingId(design.id);
      setCurrentDesignId(detail.designId || "");
      setMoveCategoryId("");
      const nextForm = {
        categoryId: String(detail.categoryId),
        metalType: detail.metalType || "GOLD",
        designName: detail.designName || "",
        description: detail.description || "",
        styleLabel: detail.styleLabel || "",
        regionalInspiration: detail.regionalInspiration || "Pan-Indian",
        materialLabel: detail.materialLabel || "",
        keywords: detail.keywords || "",
        purity: getPurityOptions(detail.metalType || "GOLD").find((option) => option.toLowerCase() === String(detail.purity || "").trim().toLowerCase()) || detail.purity || "",
        weightGrams: detail.weightGrams ?? "",
        priceInr: detail.priceInr ?? "",
        isActive: Boolean(detail.isActive),
        isFeatured: Boolean(detail.isFeatured),
      };
      setForm(nextForm);
      initialFormRef.current = nextForm;
      setCurrentImages(Array.isArray(detail.images) ? detail.images : []);
      setActiveStoredImageId((detail.images || []).find((image) => Number(image.displayOrder) === 0)?.id || detail.images?.[0]?.id || null);
      setActiveUploadPreviewKey("");
      setPreviewPhoto(null);
      setImageFiles([]);
      setImageAdjustments({});
      setShowForm(true);
    } catch (err) {
      setError(err.message || "Could not open this design.");
    }
  };

  useEffect(() => {
    const openQr = Boolean(location.state?.openQr);
    const openNewDesign = Boolean(location.state?.openNewDesign);
    if (!openQr && !openNewDesign) return;
    if (openNewDesign) openNewForm();
    if (openQr) {
      setQrOpen(true);
      generateQrSession();
    }
    navigate(location.pathname, { replace: true, state: null });
  }, [location.key, categories.length]);

  const addSubcategory = async (event) => {
    event.preventDefault();
    if (!newSubcategoryName.trim()) return;
    setCategorySaving(true);
    setError("");
    try {
      await request("/admin/designs/categories", {
        method: "POST",
        body: JSON.stringify({ metalType: newSubcategoryMetal, subcategoryName: newSubcategoryName.trim() }),
      });
      setNewSubcategoryName("");
      setMessage("Subcategory added to " + newSubcategoryMetal + ".");
      await loadCategories();
    } catch (err) {
      setError(err.message || "Could not add this subcategory.");
    } finally {
      setCategorySaving(false);
    }
  };

  const updateSubcategory = async (category, changes) => {
    setCategorySaving(true);
    setError("");
    try {
      await request("/admin/designs/categories/" + category.id, {
        method: "PUT",
        body: JSON.stringify({
          subcategoryName: changes.subcategoryName || category.subcategoryName,
          isActive: changes.isActive ?? category.isActive,
          displayOrder: category.displayOrder,
        }),
      });
      setMessage("Subcategory updated.");
      await loadCategories();
    } catch (err) {
      setError(err.message || "Could not update this subcategory.");
    } finally {
      setCategorySaving(false);
    }
  };

  const renameSubcategory = (category) => {
    const name = window.prompt("New subcategory name", category.subcategoryName);
    if (name && name.trim() && name.trim() !== category.subcategoryName) {
      updateSubcategory(category, { subcategoryName: name.trim() });
    }
  };

  const toggleSubcategory = (category) => {
    const nextActive = !category.isActive;
    const action = nextActive ? "activate" : "deactivate";
    if (!window.confirm("Are you sure you want to " + action + " " + category.subcategoryName + "?")) return;
    updateSubcategory(category, { isActive: nextActive });
  };

  const addPendingImages = (files) => {
    const incoming = Array.from(files || []).filter((file) =>
      file && (/^image\/(jpeg|png|webp)$/i.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name || ""))
    );
    if (!incoming.length) return;
    setActiveStoredImageId(null);
    setActiveUploadPreviewKey(`${incoming[0].name}::${incoming[0].size}::${incoming[0].lastModified}`);
    setImageFiles((current) => {
      const seen = new Set(current.map((file) => `${file.name}::${file.size}::${file.lastModified}`));
      const merged = [...current];
      incoming.forEach((file) => {
        const key = `${file.name}::${file.size}::${file.lastModified}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(file);
        }
      });
      return merged;
    });
    setImageAdjustments((current) => {
      const next = { ...current };
      incoming.forEach((file) => {
        const key = `${file.name}::${file.size}::${file.lastModified}`;
        if (!next[key]) next[key] = { rotation: 0, cropZoom: 1 };
      });
      return next;
    });
  };

  const resetDesignForm = () => {
    setForm({ ...initialFormRef.current });
    setImageFiles([]);
    setImageAdjustments({});
    setActiveUploadPreviewKey("");
    setPreviewPhoto(null);
  };

  const removePendingImage = (preview) => {
    setImageFiles((current) => current.filter((file) => file !== preview.file));
    setImageAdjustments((current) => {
      const next = { ...current };
      delete next[preview.key];
      return next;
    });
    setActiveUploadPreviewKey((current) => current === preview.key ? "" : current);
  };

  const makePendingImagePrimary = (preview) => {
    setActiveStoredImageId(null);
    setImageFiles((current) => [preview.file, ...current.filter((file) => file !== preview.file)]);
    setActiveUploadPreviewKey(preview.key);
  };

  const saveDesign = async (event) => {
    event.preventDefault();
    if (saveInFlightRef.current) return;
    if (!form.categoryId || !form.designName.trim()) {
      setError("Choose a subcategory and enter a design name.");
      return;
    }
    saveInFlightRef.current = true;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        ...form,
        categoryId: Number(form.categoryId),
      };
      const wasNewDesign = !editingId;
      const saved = editingId
        ? await request(`/admin/designs/${editingId}`, { method: "PUT", body: JSON.stringify(payload) })
        : await request("/admin/designs", { method: "POST", body: JSON.stringify(payload) });
      const id = Number(saved.id);

      // If the record saves but photo transfer fails, bind the open form to that
      // record. Retrying the form updates it instead of allocating another ID.
      if (wasNewDesign) {
        setEditingId(id);
        setCurrentDesignId(saved.designId || "");
      }
      if (imageFiles.length) {
        const transforms = imageFiles.map((file) => imageAdjustments[`${file.name}::${file.size}::${file.lastModified}`] || {});
        const uploaded = await uploadDesignImages(id, imageFiles, transforms);
        if (Array.isArray(uploaded?.images)) setCurrentImages(uploaded.images);
        setImageFiles([]);
        setImageAdjustments({});
      }
      setShowForm(false);
      setMessage(`${saved.designId || saved.designCode || "Design"} saved successfully.`);
      await Promise.all([loadCategories(), loadDesigns(0)]);
    } catch (err) {
      setError(err.message || "Could not save the design.");
      await loadDesigns(page);
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  };

  const changeStatus = async (design) => {
    try {
      await request(`/admin/designs/${design.id}`, {
        method: "PUT",
        body: JSON.stringify({
          categoryId: categories.find((item) => item.slug === design.subcategorySlug && item.metalType === design.metalType)?.id,
          designName: design.designName,
          description: design.description,
          styleLabel: design.styleLabel,
          regionalInspiration: design.regionalInspiration || "Pan-Indian",
          materialLabel: design.materialLabel || "",
          keywords: design.keywords,
          purity: design.purity || "",
          weightGrams: design.weightGrams ?? "",
          priceInr: design.priceInr ?? "",
          isActive: !design.isActive,
          isFeatured: design.isFeatured,
        }),
      });
      setMessage(`${design.designCode} ${design.isActive ? "deactivated" : "activated"}.`);
      await loadDesigns(page);
    } catch (err) {
      setError(err.message || "Could not update design status.");
    }
  };

  const changeFeatured = async (design) => {
    const category = categories.find((item) => item.slug === design.subcategorySlug && item.metalType === design.metalType);
    try {
      await request(`/admin/designs/${design.id}`, {
        method: "PUT",
        body: JSON.stringify({
          categoryId: category?.id,
          designName: design.designName,
          description: design.description,
          styleLabel: design.styleLabel,
          regionalInspiration: design.regionalInspiration || "Pan-Indian",
          materialLabel: design.materialLabel || "",
          keywords: design.keywords,
          purity: design.purity || "",
          weightGrams: design.weightGrams ?? "",
          priceInr: design.priceInr ?? "",
          isActive: design.isActive,
          isFeatured: !design.isFeatured,
        }),
      });
      await loadDesigns(page);
    } catch (err) {
      setError(err.message || "Could not update featured status.");
    }
  };

  const viewDesignDetails = async (design) => {
    setDetailsLoading(true);
    setError("");
    try {
      const detail = await request(`/admin/designs/${design.id}`);
      setDetailImageIndex(0);
      setDetailImageZoom(1);
      setDetailPhotoExpanded(false);
      setDetailsActionError("");
      setViewingDesign(detail);
    } catch (err) {
      setError(err.message || "Could not load design details.");
    } finally {
      setDetailsLoading(false);
    }
  };

  const setViewedPrimaryImage = async (image) => {
    if (!viewingDesign?.id || !image?.id || detailsActionBusy || Number(image.displayOrder) === 0) return;
    setDetailsActionBusy(true);
    setDetailsActionError("");
    try {
      const result = await request(`/admin/designs/${viewingDesign.id}/images/${image.id}/primary`, { method: "PUT" });
      const updatedImages = Array.isArray(result.images) ? result.images : (viewingDesign.images || []).map((item) => ({
        ...item,
        displayOrder: String(item.id) === String(image.id) ? 0 : item.displayOrder,
      }));
      setViewingDesign((current) => current ? { ...current, images: updatedImages } : current);
      setDetailImageIndex(Math.max(0, updatedImages.findIndex((item) => String(item.id) === String(image.id))));
      await loadDesigns(page);
    } catch (err) {
      setDetailsActionError(err.message || "Could not set the primary photograph.");
    } finally {
      setDetailsActionBusy(false);
    }
  };

  const removeViewedImage = async (image) => {
    if (!viewingDesign?.id || !image?.id || detailsActionBusy) return;
    if (!window.confirm("Remove this photograph from the design?")) return;
    setDetailsActionBusy(true);
    setDetailsActionError("");
    try {
      const result = await request(`/admin/designs/${viewingDesign.id}/images/${image.id}`, { method: "DELETE" });
      const updatedImages = Array.isArray(result.images) ? result.images : (viewingDesign.images || []).filter((item) => String(item.id) !== String(image.id));
      setViewingDesign((current) => current ? { ...current, images: updatedImages } : current);
      setDetailImageIndex((current) => Math.max(0, Math.min(current, updatedImages.length - 1)));
      await loadDesigns(page);
    } catch (err) {
      setDetailsActionError(err.message || "Could not remove this photograph.");
    } finally {
      setDetailsActionBusy(false);
    }
  };

  const openMobileUploadFromDetails = () => {
    setViewingDesign(null);
    setQrError("");
    setQrOpen(true);
    generateQrSession();
  };

  const moveDesign = async () => {
    if (!editingId || !moveCategoryId || movingDesign) return;
    const destination = formMetalCategories.find((item) => String(item.id) === String(moveCategoryId));
    if (!destination) {
      setError("Choose a valid destination subcategory.");
      return;
    }
    const previousId = currentDesignId;
    if (!window.confirm(
      `Move "${form.designName}" to ${destination.subcategoryName}? A new Design ID will be generated. The original ID ${previousId} will remain in the archived record.`
    )) return;

    setMovingDesign(true);
    setError("");
    setMessage("");
    try {
      const moved = await request(`/admin/designs/${editingId}/move`, {
        method: "POST",
        body: JSON.stringify({ categoryId: Number(destination.id) }),
      });
      setShowForm(false);
      setEditingId(null);
      setCurrentDesignId("");
      setMoveCategoryId("");
      setSubcategory(destination.slug);
      setPage(0);
      setMessage(
        `Moved to ${destination.subcategoryName}. New ID: ${moved.designId}. Original ID archived: ${moved.movedFromDesignId || previousId}.`
      );
      await loadCategories();
    } catch (err) {
      setError(err.message || "Could not move this design.");
    } finally {
      setMovingDesign(false);
    }
  };

  const deleteDesign = (design) => {
    setDeleteCandidate(design);
  };

  const confirmDeleteDesign = async () => {
    if (!deleteCandidate || deletingDesign) return;
    setDeletingDesign(true);
    try {
      await request(`/admin/designs/${deleteCandidate.id}`, { method: "DELETE" });
      setMessage(`${deleteCandidate.designId || deleteCandidate.designCode} archived. The original record and photographs remain preserved.`);
      setDeleteCandidate(null);
      await Promise.all([loadCategories(), loadDesigns(page)]);
    } catch (err) {
      setError(err.message || "Could not archive this design.");
    } finally {
      setDeletingDesign(false);
    }
  };

  const removeImage = async (image) => {
    if (!editingId) return;
    try {
      const detail = await request(`/admin/designs/${editingId}/images/${image.id}`, { method: "DELETE" });
      setCurrentImages(Array.isArray(detail.images) ? detail.images : []);
      setMessage("Image removed.");
      await loadDesigns(page);
    } catch (err) {
      setError(err.message || "Could not remove this image.");
    }
  };

  const setPrimaryImage = async (image) => {
    if (!editingId || Number(image.displayOrder) === 0) return;
    try {
      const detail = await request(`/admin/designs/${editingId}/images/${image.id}/primary`, { method: "PUT" });
      setCurrentImages(Array.isArray(detail.images) ? detail.images : []);
      setMessage("Primary photograph updated.");
      await loadDesigns(page);
    } catch (err) {
      setError(err.message || "Could not set this photograph as primary.");
    }
  };

  const runBulkUpload = async () => {
    if (!bulkCategoryId) {
      setError("Choose the metal and subcategory for the bulk upload.");
      return;
    }
    if (!bulkFiles.length) {
      setError("Choose one or more JPG, PNG or WebP design photographs.");
      return;
    }
    const invalidIndex = bulkFiles.findIndex((file, index) =>
      !String(bulkDesignNames[index] || "").trim() || !bulkNameConfirmed[index]
    );
    if (invalidIndex !== -1) {
      setError(`Confirm that the product name matches photo ${invalidIndex + 1} before uploading. You can edit every name here.`);
      return;
    }
    setBulkRunning(true);
    setBulkProgress("");
    setError("");
    let completed = 0;
    try {
      for (let index = 0; index < bulkFiles.length; index += 1) {
        const file = bulkFiles[index];
        const designName = String(bulkDesignNames[index]).trim();
        const saved = await request("/admin/designs", {
          method: "POST",
          body: JSON.stringify({
            categoryId: Number(bulkCategoryId),
            designName,
            description: "Indian jewellery design reference. Verify material, purity, weight and other specifications against the actual piece.",
            styleLabel: "Indian jewellery design",
            regionalInspiration: "Pan-Indian",
            keywords: designName,
            isActive: true,
            isFeatured: false,
          }),
        });
        await uploadDesignImages(saved.id, [file]);
        completed += 1;
        setBulkProgress(`Uploaded ${completed} of ${bulkFiles.length} designs…`);
      }
      setBulkFiles([]);
      setBulkDesignNames([]);
      setBulkNameConfirmed([]);
      setBulkProgress(`Successfully added ${completed} designs.`);
      setMessage(`Bulk upload complete: ${completed} verified-name designs added.`);
      await loadDesigns(0);
    } catch (err) {
      setError(`${err.message || "Bulk upload stopped."} ${completed} design(s) uploaded before the error.`);
      await loadDesigns(0);
    } finally {
      setBulkRunning(false);
    }
  };

  const selectedPendingPhoto = activeStoredImageId
    ? null
    : imagePreviews.find((preview) => preview.key === activeUploadPreviewKey) || imagePreviews[0] || null;
  const selectedStoredPhoto = activeStoredImageId
    ? currentImages.find((image) => String(image.id) === String(activeStoredImageId)) || null
    : selectedPendingPhoto
      ? null
      : currentImages.find((image) => Number(image.displayOrder) === 0) || currentImages[0] || null;
  const selectedPhotoAdjustment = selectedPendingPhoto
    ? imageAdjustments[selectedPendingPhoto.key] || { rotation: 0, cropZoom: 1 }
    : null;

  return (
    <Page active="design-catalog">
      <div className="nkj-catalog-admin">
        <header className="nkj-catalog-admin-heading">
          <div>
            <span>OWNER WORKSPACE · CATALOGUE CONTROL</span>
            <h1><Layers3 size={25} /> Jewellery Catalog Management</h1>
            <p>Manage all 77 approved subcategories, add unlimited designs, and upload original shop photographs. Each subcategory starts with at least 25 clearly marked sample inspirations.</p>
          </div>
          <div className="nkj-catalog-heading-actions">
            <button type="button" className="nkj-catalog-qr-button" onClick={() => { setQrOpen(true); generateQrSession(); }}>
              <QrCode size={18} /> QR Code Upload
            </button>
            <button type="button" className="nkj-catalog-primary" onClick={openNewForm}><Plus size={17} /> Add New Design</button>
          </div>
        </header>

        <details className="nkj-catalog-subcategory-manager">
          <summary><span><b>Manage jewellery subcategories</b><small>Add, rename or deactivate subcategories under the three fixed main categories.</small></span><Layers3 size={18} /></summary>
          <form className="nkj-catalog-subcategory-form" onSubmit={addSubcategory}>
            <select value={newSubcategoryMetal} onChange={(event) => setNewSubcategoryMetal(event.target.value)}>
              <option value="GOLD">Gold</option><option value="SILVER">Silver</option><option value="DIAMOND">Diamond</option>
            </select>
            <input value={newSubcategoryName} maxLength={80} onChange={(event) => setNewSubcategoryName(event.target.value)} placeholder="New subcategory name" required />
            <button type="submit" disabled={categorySaving || !newSubcategoryName.trim()}>{categorySaving ? "Saving…" : "Add subcategory"}</button>
          </form>
          <div className="nkj-catalog-subcategory-list">
            {categories.map((category) => (
              <div className={category.isActive ? "" : "inactive"} key={category.id}>
                <span><b>{category.metalType}</b> · {category.subcategoryName}<small>{category.activeDesignCount || 0} active designs</small></span>
                <div>
                  <button type="button" disabled={categorySaving} onClick={() => renameSubcategory(category)}>Rename</button>
                  <button type="button" disabled={categorySaving} onClick={() => toggleSubcategory(category)}>{category.isActive ? "Deactivate" : "Activate"}</button>
                </div>
              </div>
            ))}
          </div>
        </details>

        {error && <div className="nkj-catalog-alert error">{error}</div>}
        {message && <div className="nkj-catalog-alert success">{message}</div>}

        <section className="nkj-catalog-bulk">
          <div className="nkj-catalog-bulk-heading">
            <div><Upload size={19} /><b>Upload Indian Jewellery Designs from Chrome</b></div>
            <small>Save images from Chrome to your device, select them here, then verify each product name before saving.</small>
          </div>
          <div className="nkj-catalog-bulk-fields">
            <label>Assign metal and subcategory
              <select value={bulkCategoryId} onChange={(event) => setBulkCategoryId(event.target.value)}>
                <option value="">Choose subcategory</option>
                {categories.filter((item) => item.isActive !== false).map((item) => <option key={item.id} value={item.id}>{item.metalType} · {item.subcategoryName}</option>)}
              </select>
            </label>
            <label className="nkj-catalog-file-picker"><ImagePlus size={17} /> Choose images saved from Chrome
              <input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" multiple disabled={bulkRunning} onChange={(event) => {
                const files = Array.from(event.target.files || []);
                setBulkFiles(files);
                setBulkDesignNames(files.map((file) => cleanFileName(file.name)));
                setBulkNameConfirmed(files.map(() => false));
                setError("");
              }} />
            </label>
            <button type="button" onClick={runBulkUpload} disabled={bulkRunning || !bulkFiles.length}>
              {bulkRunning ? <LoaderCircle className="spin" size={16} /> : <Upload size={16} />}
              {bulkRunning ? "Uploading…" : `Upload ${bulkFiles.length || ""} Designs`}
            </button>
          </div>
          {bulkProgress && <small className="nkj-catalog-progress">{bulkProgress}</small>}
          {bulkFiles.length > 0 && (
            <div className="nkj-catalog-bulk-review">
              <div className="nkj-catalog-bulk-review-title">
                <b>Review photos and product names ({bulkFiles.length})</b>
                <span>Names are editable. Confirm each one only after checking the photo.</span>
              </div>
              {bulkFiles.map((file, index) => (
                <div className="nkj-catalog-bulk-review-row" key={`${file.name}-${file.size}-${file.lastModified}-${index}`}>
                  <img src={bulkPreviews[index]?.url} alt={bulkDesignNames[index] || "Jewellery design preview"} />
                  <div className="nkj-catalog-bulk-review-fields">
                    <label>Product name
                      <input value={bulkDesignNames[index] || ""} maxLength={150} disabled={bulkRunning}
                        onChange={(event) => setBulkDesignNames((current) => current.map((name, itemIndex) => itemIndex === index ? event.target.value : name))} />
                    </label>
                    <label className="nkj-catalog-name-confirm">
                      <input type="checkbox" checked={Boolean(bulkNameConfirmed[index])} disabled={bulkRunning || !String(bulkDesignNames[index] || "").trim()}
                        onChange={(event) => setBulkNameConfirmed((current) => current.map((confirmed, itemIndex) => itemIndex === index ? event.target.checked : confirmed))} />
                      I checked this photo and confirmed the product name is correct
                    </label>
                    <small>{file.name}</small>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="nkj-catalog-filters">
          <label><span>Metal</span><select value={metal} onChange={(event) => { setMetal(event.target.value); setSubcategory(""); setPurityFilter(""); }}>
            <option value="GOLD">Gold</option><option value="SILVER">Silver</option><option value="DIAMOND">Diamond</option>
          </select></label>
          <label><span>Subcategory</span><select value={subcategory} onChange={(event) => setSubcategory(event.target.value)}>
            <option value="">All {metal} designs</option>
            {metalCategories.map((item) => <option key={item.id} value={item.slug}>{item.subcategoryName}</option>)}
          </select></label>
          <label><span>Purity / type</span><select value={purityFilter} onChange={(event) => setPurityFilter(event.target.value)}>
            <option value="">All {metal} purities</option>
            {getPurityOptions(metal).map((item) => <option key={item} value={item}>{item}</option>)}
          </select></label>
          <label className="nkj-catalog-search"><span>Search catalogue</span><div><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, code, style or purity" /></div></label>
          <label><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="latest">Latest</option><option value="popular">Popularity</option></select></label>
        </section>

        <div className="nkj-catalog-count-row"><b>{total.toLocaleString("en-IN")} design records</b><span>20 starter inspirations per approved subcategory · Add more at any time</span></div>

        {loading ? <div className="nkj-catalog-loading"><LoaderCircle className="spin" size={23} /> Loading catalogue…</div> : (
          <div className="nkj-catalog-table-wrap">
            <table className="nkj-catalog-table">
              <thead><tr><th>Design</th><th>Code</th><th>Metal / Subcategory</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {items.map((design) => (
                  <tr key={design.id}>
                    <td><div className="nkj-catalog-design-cell">
                      {design.thumbnailUrl ? <img src={assetUrl(design.thumbnailUrl)} alt="" loading="lazy" /> : <span className="nkj-catalog-placeholder"><ImagePlus size={17} /></span>}
                      <span><b>{design.designName}</b><small>{design.styleLabel}</small></span>
                    </div></td>
                    <td><code className="nkj-catalog-design-id" title={design.designId || design.designCode}>{design.designId || design.designCode}</code><small className="nkj-catalog-subcategory">Legacy: {design.designCode}</small></td>
                    <td>{design.metalType}<small className="nkj-catalog-subcategory">{design.subcategoryName}</small>
                      <small className="nkj-catalog-subcategory">{[design.purity, design.weightGrams != null ? Number(design.weightGrams).toLocaleString("en-IN") + " g" : "", design.priceInr != null ? "₹" + Number(design.priceInr).toLocaleString("en-IN") : ""].filter(Boolean).join(" · ") || "Specs not set"}</small>
                    </td>
                    <td>
                      {design.isSample ? <span className="nkj-catalog-badge sample">Sample inspiration</span> : <span className="nkj-catalog-badge real">Shop design</span>}
                      <span className={`nkj-catalog-badge ${design.imageStatus === "READY" ? "active" : "inactive"}`}>{design.imageStatus === "READY" ? "Photo ready" : "Photo pending"}</span>
                    </td>
                    <td>{design.isActive ? <span className="nkj-catalog-badge active">Active</span> : <span className="nkj-catalog-badge inactive">Inactive</span>}{design.isFeatured && <span className="nkj-catalog-badge featured">Featured</span>}</td>
                    <td><div className="nkj-catalog-actions">
                      <button type="button" title="View design details" disabled={detailsLoading} onClick={() => viewDesignDetails(design)}><Info size={15} /></button>
                      <button type="button" title="Change / upload design images" onClick={() => openEditForm(design)}><ImagePlus size={15} /></button>
                      <button type="button" title="Edit design" onClick={() => openEditForm(design)}><Pencil size={15} /></button>
                      <button type="button" title={design.isFeatured ? "Remove featured" : "Feature design"} onClick={() => changeFeatured(design)}><Star size={15} fill={design.isFeatured ? "currentColor" : "none"} /></button>
                      <button type="button" title={design.isActive ? "Deactivate" : "Activate"} onClick={() => changeStatus(design)}>{design.isActive ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                      <button type="button" title="Archive design" className="delete" onClick={() => deleteDesign(design)}><Trash2 size={15} /></button>
                    </div></td>
                  </tr>
                ))}
                {!items.length && <tr><td colSpan="6" className="nkj-catalog-empty">No catalogue records match these filters.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        <div className="nkj-catalog-pagination">
          <span>Page {page + 1} · {total.toLocaleString("en-IN")} total</span>
          <div>
            <button type="button" disabled={page <= 0 || loading} onClick={() => loadDesigns(page - 1)}>Previous</button>
            <button type="button" disabled={(page + 1) * PAGE_SIZE >= total || loading} onClick={() => loadDesigns(page + 1)}>Next</button>
          </div>
        </div>

        {qrOpen && (
          <div className="nkj-catalog-modal-backdrop nkj-qr-upload-backdrop" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeQrModal();
          }}>
            <section className="nkj-qr-upload-modal" role="dialog" aria-modal="true" aria-labelledby="nkj-qr-upload-title">
              <header>
                <div><span>SECURE MOBILE UPLOAD</span><h2 id="nkj-qr-upload-title">Upload Jewellery Designs From Mobile</h2></div>
                <button type="button" onClick={closeQrModal} aria-label="Close QR upload"><X size={19} /></button>
              </header>
              <p className="nkj-qr-upload-description">Scan this QR code using your mobile phone to upload jewellery photographs directly to your Jewellery ERP. The link must use an HTTPS address reachable from your phone; localhost is only accessible on this computer.</p>

              <div className="nkj-qr-upload-body">
                <div className="nkj-qr-code-frame">
                  {qrLoading ? (
                    <div className="nkj-qr-code-loading"><LoaderCircle className="spin" size={28} /><span>Generating secure QR…</span></div>
                  ) : qrSession?.uploadUrl ? (
                    <QRCodeSVG value={qrSession.uploadUrl} size={238} level="H" includeMargin />
                  ) : (
                    <div className="nkj-qr-code-loading"><QrCode size={32} /><span>QR code unavailable</span></div>
                  )}
                </div>
                <div className="nkj-qr-upload-instructions">
                  <b><Smartphone size={16} /> How to connect</b>
                  <ol>
                    <li>Open your phone camera.</li>
                    <li>Scan this QR code and open the secure upload link.</li>
                    <li>Select jewellery photographs and enter design details.</li>
                    <li>Save the design. This desktop catalogue updates automatically.</li>
                  </ol>
                  <div className="nkj-qr-countdown">
                    <Clock3 size={16} />
                    <span>QR expires in</span>
                    <strong>
                      {qrSession?.expiresAt
                        ? (() => {
                            const left = Math.max(0, Math.ceil((new Date(qrSession.expiresAt).getTime() - qrNow) / 1000));
                            return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
                          })()
                        : "—"}
                    </strong>
                  </div>
                  <div className={`nkj-qr-connection-status is-${String(qrSession?.status || (qrLoading ? "LOADING" : "ERROR")).toLowerCase()}`}>
                    <span />
                    {qrSession?.status === "UPLOADED" ? "Upload completed successfully"
                      : qrSession?.status === "EXPIRED" ? "QR session expired"
                        : qrSession?.status === "REVOKED" ? "QR session revoked"
                          : qrSession?.status === "SCANNED" ? "Mobile phone connected · selecting photographs"
                            : qrLoading ? "Creating secure connection…" : "Waiting for mobile phone to scan"}
                  </div>
                </div>
              </div>

              {qrSession?.status === "UPLOADED" && (
                <div className="nkj-qr-upload-success">
                  <CheckCircle2 size={18} />
                  <span><b>New design received</b><small>{qrSession.generatedDesignId} · {qrSession.designName}</small></span>
                </div>
              )}
              {qrError && <div className="nkj-qr-upload-error" role="alert">{qrError}</div>}
              <footer>
                <button type="button" onClick={copyQrLink} disabled={!qrSession?.uploadUrl || qrSession.status !== "WAITING"}>
                  {qrCopied ? <CheckCircle2 size={16} /> : <Copy size={16} />}{qrCopied ? "Copied" : "Copy upload link"}
                </button>
                <button type="button" className="primary" onClick={generateQrSession} disabled={qrLoading || qrSession?.status === "UPLOADED"}>
                  {qrLoading ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />} Regenerate QR
                </button>
                <button type="button" onClick={closeQrModal}>Close</button>
              </footer>
            </section>
          </div>
        )}

        {viewingDesign && (
          <div className="nkj-catalog-modal-backdrop nkj-catalog-details-backdrop nkj-catalog-view-backdrop" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setViewingDesign(null);
              setDetailPhotoExpanded(false);
            }
          }}>
            <section className="nkj-catalog-details-modal nkj-catalog-view-modal" role="dialog" aria-modal="true" aria-labelledby="nkj-catalog-admin-details-title">
              <button
                type="button"
                className="nkj-catalog-view-close"
                onClick={() => { setViewingDesign(null); setDetailPhotoExpanded(false); }}
                aria-label="Close design details"
              ><X size={23} /></button>

              <div className="nkj-catalog-view-layout">
                <section className="nkj-catalog-view-gallery" aria-label="Design photographs">
                  <div className="nkj-catalog-view-main-photo">
                    {viewingDesign.images?.length ? (
                      <>
                        <img
                          className="nkj-catalog-view-main-image"
                          src={assetUrl(viewingDesign.images[Math.min(detailImageIndex, viewingDesign.images.length - 1)]?.displayUrl
                            || viewingDesign.images[Math.min(detailImageIndex, viewingDesign.images.length - 1)]?.originalUrl
                            || viewingDesign.images[Math.min(detailImageIndex, viewingDesign.images.length - 1)]?.thumbnailUrl)}
                          alt={viewingDesign.images[Math.min(detailImageIndex, viewingDesign.images.length - 1)]?.altText || viewingDesign.designName}
                          style={{ transform: `scale(${detailImageZoom})` }}
                          onError={(event) => {
                            const image = viewingDesign.images[Math.min(detailImageIndex, viewingDesign.images.length - 1)];
                            const fallback = assetUrl(image?.thumbnailUrl);
                            if (fallback && event.currentTarget.src !== fallback) event.currentTarget.src = fallback;
                          }}
                        />
                        <span className="nkj-catalog-view-image-count">{Math.min(detailImageIndex + 1, viewingDesign.images.length)} / {viewingDesign.images.length}</span>
                        <div className="nkj-catalog-view-image-tools">
                          <button type="button" aria-label="Zoom in" onClick={() => setDetailImageZoom((value) => Math.min(2.5, Number((value + 0.25).toFixed(2))))}><ZoomIn size={19} /></button>
                          <button type="button" aria-label="Zoom out" onClick={() => setDetailImageZoom((value) => Math.max(1, Number((value - 0.25).toFixed(2))))} disabled={detailImageZoom <= 1}><ZoomOut size={19} /></button>
                          <button type="button" aria-label="View photograph full screen" onClick={() => setDetailPhotoExpanded(true)}><Maximize2 size={19} /></button>
                        </div>
                        {viewingDesign.images.length > 1 && (
                          <>
                            <button
                              type="button"
                              className="nkj-catalog-view-image-arrow previous"
                              aria-label="Previous photograph"
                              onClick={() => { setDetailImageIndex((value) => (value - 1 + viewingDesign.images.length) % viewingDesign.images.length); setDetailImageZoom(1); }}
                            ><ChevronLeft size={25} /></button>
                            <button
                              type="button"
                              className="nkj-catalog-view-image-arrow next"
                              aria-label="Next photograph"
                              onClick={() => { setDetailImageIndex((value) => (value + 1) % viewingDesign.images.length); setDetailImageZoom(1); }}
                            ><ChevronRight size={25} /></button>
                          </>
                        )}
                      </>
                    ) : (
                      <div className="nkj-catalog-view-no-photo"><ImagePlus size={48} /><b>No photograph uploaded</b><span>Edit this design to add product photographs.</span></div>
                    )}
                  </div>

                  <div className="nkj-catalog-view-gallery-thumbs">
                    {(viewingDesign.images || []).map((image, index) => (
                      <button
                        type="button"
                        key={image.id}
                        className={index === detailImageIndex ? "active" : ""}
                        onClick={() => { setDetailImageIndex(index); setDetailImageZoom(1); }}
                        aria-label={`View photograph ${index + 1}`}
                      >
                        <img src={assetUrl(image.thumbnailUrl || image.displayUrl || image.originalUrl)} alt={image.altText || `Design photograph ${index + 1}`} />
                      </button>
                    ))}
                  </div>
                </section>

                <section className="nkj-catalog-view-information">
                  <header className="nkj-catalog-view-title-row">
                    <div>
                      <span className="nkj-catalog-view-category">{viewingDesign.metalType || "JEWELLERY"} DESIGN</span>
                      <h2 id="nkj-catalog-admin-details-title">
                        {viewingDesign.designName || viewingDesign.subcategoryName}
                      </h2>
                    </div>
                  </header>

                  <div className="nkj-catalog-view-id">
                    <QrCode size={18} />
                    <span>DESIGN ID</span>
                    <b>{viewingDesign.designId || viewingDesign.designCode}</b>
                  </div>

                  <section className="nkj-catalog-view-card nkj-catalog-view-detail-card">
                    <h3><Info size={19} /> DETAIL</h3>
                    <div className="nkj-catalog-view-detail-rows">
                      <div><Gem size={22} /><span>Jewellery type</span><b>{viewingDesign.subcategoryName || viewingDesign.regionalInspiration || "—"}</b></div>
                      <div><Layers3 size={22} /><span>Style</span><b>{viewingDesign.styleLabel || "—"}</b></div>
                      <div><Package size={22} /><span>Material</span><b>{viewingDesign.materialLabel || viewingDesign.metalType || "—"}</b></div>
                      <div><Weight size={22} /><span>Weight</span><b>{viewingDesign.weightGrams == null ? "—" : Number(viewingDesign.weightGrams).toLocaleString("en-IN") + " g"}</b></div>
                    </div>
                    <div className="nkj-catalog-view-extra-details">
                      <span>Purity <b>{viewingDesign.purity || "Not specified"}</b></span>
                      <span>Price <b>{viewingDesign.priceInr == null ? "Not set" : "₹" + Number(viewingDesign.priceInr).toLocaleString("en-IN")}</b></span>
                      <span>Status <b className={viewingDesign.isActive ? "is-active" : "is-inactive"}>{viewingDesign.isActive ? "Active" : "Inactive"}</b></span>
                      {viewingDesign.regionalInspiration && <span>Regional inspiration <b>{viewingDesign.regionalInspiration}</b></span>}
                    </div>
                    {viewingDesign.description && <p className="nkj-catalog-view-description">{viewingDesign.description}</p>}
                  </section>

                  <section className="nkj-catalog-view-card nkj-catalog-view-photos-card">
                    <header>
                      <h3><ImagePlus size={19} /> Design photographs</h3>
                      <span>{viewingDesign.images?.length || 0} saved</span>
                    </header>
                    <div className="nkj-catalog-view-photo-management">
                      <div className="nkj-catalog-view-photo-strip">
                        {(viewingDesign.images || []).map((image, index) => (
                          <button
                            type="button"
                            key={image.id}
                            className={index === detailImageIndex ? "active" : ""}
                            onClick={() => { setDetailImageIndex(index); setDetailImageZoom(1); }}
                            aria-label={`Select saved photograph ${index + 1}`}
                          >
                            <img src={assetUrl(image.thumbnailUrl || image.displayUrl || image.originalUrl)} alt={image.altText || `Saved photograph ${index + 1}`} />
                          </button>
                        ))}
                        {!viewingDesign.images?.length && <span className="nkj-catalog-view-no-saved">No saved photographs</span>}
                      </div>
                      <div className="nkj-catalog-view-photo-actions">
                        <button
                          type="button"
                          className="primary-photo"
                          disabled={!viewingDesign.images?.length || detailsActionBusy || Number(viewingDesign.images?.[detailImageIndex]?.displayOrder) === 0}
                          onClick={() => setViewedPrimaryImage(viewingDesign.images[detailImageIndex])}
                        ><Star size={16} fill="currentColor" /> Primary</button>
                        <button
                          type="button"
                          className="remove-photo"
                          disabled={!viewingDesign.images?.length || detailsActionBusy}
                          onClick={() => removeViewedImage(viewingDesign.images[detailImageIndex])}
                          aria-label="Remove selected photograph"
                        >{detailsActionBusy ? <LoaderCircle className="spin" size={16} /> : <Trash2 size={17} />}</button>
                      </div>
                    </div>
                    {detailsActionError && <div className="nkj-catalog-view-action-error" role="alert">{detailsActionError}</div>}
                  </section>

                  <section className="nkj-catalog-view-card nkj-catalog-owner-controls">
                    <div className="nkj-catalog-owner-controls-heading">
                      <div><LockKeyhole size={21} /><span><small>OWNER CONTROLS</small><b>Manage this design</b></span></div>
                      <LockKeyhole size={22} />
                    </div>
                    <div className="nkj-catalog-owner-control-actions">
                      <button type="button" className="edit" onClick={() => {
                        const selectedDesign = viewingDesign;
                        setViewingDesign(null);
                        openEditForm({ id: selectedDesign.id });
                      }}><Pencil size={18} /> Edit Details</button>
                      <button type="button" className="archive" onClick={() => {
                        const selectedDesign = viewingDesign;
                        setViewingDesign(null);
                        deleteDesign(selectedDesign);
                      }}><Trash2 size={18} /> Delete / Archive</button>
                      <button type="button" className="mobile-upload" onClick={openMobileUploadFromDetails}><QrCode size={19} /> Upload from Mobile (QR Code)</button>
                    </div>
                  </section>
                </section>
              </div>

              <footer className="nkj-catalog-view-footer">
                <button type="button" onClick={() => { setViewingDesign(null); setDetailPhotoExpanded(false); }}>Close</button>
              </footer>

              {detailPhotoExpanded && viewingDesign.images?.length > 0 && (
                <div className="nkj-catalog-view-lightbox" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailPhotoExpanded(false); }}>
                  <button type="button" className="close" onClick={() => setDetailPhotoExpanded(false)} aria-label="Close full-screen photo"><X size={23} /></button>
                  <img
                    src={assetUrl(viewingDesign.images[Math.min(detailImageIndex, viewingDesign.images.length - 1)]?.displayUrl
                      || viewingDesign.images[Math.min(detailImageIndex, viewingDesign.images.length - 1)]?.originalUrl
                      || viewingDesign.images[Math.min(detailImageIndex, viewingDesign.images.length - 1)]?.thumbnailUrl)}
                    alt={viewingDesign.designName}
                  />
                </div>
              )}
            </section>
          </div>
        )}

        {deleteCandidate && (
          <div className="nkj-catalog-modal-backdrop nkj-catalog-delete-backdrop" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deletingDesign) setDeleteCandidate(null);
          }}>
            <section className="nkj-catalog-delete-modal" role="dialog" aria-modal="true" aria-labelledby="nkj-delete-design-title">
              <header><span>ARCHIVE JEWELLERY DESIGN</span><button type="button" onClick={() => setDeleteCandidate(null)} disabled={deletingDesign} aria-label="Close"><X size={18} /></button></header>
              {deleteCandidate.thumbnailUrl && <img src={assetUrl(deleteCandidate.thumbnailUrl)} alt={deleteCandidate.designName} />}
              <h2 id="nkj-delete-design-title">Archive this jewellery design?</h2>
              <dl>
                <div><dt>Design ID</dt><dd>{deleteCandidate.designId || deleteCandidate.designCode}</dd></div>
                <div><dt>Design name</dt><dd>{deleteCandidate.designName}</dd></div>
                <div><dt>Category</dt><dd>{deleteCandidate.metalType} · {deleteCandidate.subcategoryName}</dd></div>
              </dl>
              <p>The design will be hidden from the catalogue. Its database record, uploaded photographs, audit history and Design ID sequence will be preserved. This action does not delete invoice or transaction records.</p>
              <footer>
                <button type="button" disabled={deletingDesign} onClick={() => setDeleteCandidate(null)}>Cancel</button>
                <button type="button" className="delete" disabled={deletingDesign} onClick={confirmDeleteDesign}>
                  {deletingDesign ? <LoaderCircle className="spin" size={15} /> : <Trash2 size={15} />}
                  {deletingDesign ? "Archiving…" : "Archive Design"}
                </button>
              </footer>
            </section>
          </div>
        )}

        {showForm && (
          <div className="nkj-catalog-modal-backdrop nkj-catalog-design-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setShowForm(false); }}>
            <form className="nkj-catalog-modal nkj-catalog-design-modal" onSubmit={saveDesign}>
              <header className="nkj-catalog-design-header">
                <div>
                  <span>OWNER CATALOGUE</span>
                  <h2>{editingId ? "Edit Jewellery Design" : "Add New Design"}</h2>
                </div>
                <button type="button" onClick={() => setShowForm(false)} aria-label="Close" disabled={saving}><X size={22} /></button>
              </header>

              {error && <div className="nkj-catalog-design-error" role="alert">{error}</div>}

              <div className="nkj-catalog-design-editor-grid">
                <aside className="nkj-catalog-photo-panel">
                  <label
                    className={"nkj-catalog-photo-dropzone" + (imagePreviews.length || currentImages.length ? " has-photo" : "")}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => { event.preventDefault(); addPendingImages(event.dataTransfer.files); }}
                  >
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                      multiple
                      onChange={(event) => { addPendingImages(event.target.files); event.target.value = ""; }}
                    />
                    {selectedPendingPhoto?.url || selectedStoredPhoto ? (
                      <span className="nkj-catalog-photo-stage">
                        <img
                          src={selectedPendingPhoto?.url || assetUrl(selectedStoredPhoto.displayUrl || selectedStoredPhoto.thumbnailUrl)}
                          alt={selectedPendingPhoto?.file.name || selectedStoredPhoto?.altText || form.designName || "Design preview"}
                          style={selectedPendingPhoto ? { transform: `rotate(${selectedPhotoAdjustment.rotation}deg) scale(${selectedPhotoAdjustment.cropZoom})` } : undefined}
                        />
                        <span className="nkj-catalog-photo-stage-hint"><ImagePlus size={15} /> Add or drop more photographs</span>
                      </span>
                    ) : (
                      <span className="nkj-catalog-photo-empty">
                        <Upload size={48} strokeWidth={1.65} />
                        <b>Upload Design Photographs</b>
                        <small>Drag &amp; drop images here or click to browse</small>
                        <span className="nkj-catalog-choose-files"><Upload size={16} /> Choose Files</span>
                        <em>JPG, PNG, WEBP (Max 10 MB each)</em>
                      </span>
                    )}
                  </label>

                  <div className="nkj-catalog-photo-gallery-head">
                    <b>Design Photographs</b>
                    <span>{imageFiles.length + currentImages.length} {imageFiles.length + currentImages.length === 1 ? "photo" : "photos"}</span>
                  </div>

                  <div className="nkj-catalog-photo-thumbnails">
                    {imagePreviews.map((preview, index) => (
                      <div className={"nkj-catalog-photo-thumb" + ((!activeStoredImageId && (activeUploadPreviewKey ? activeUploadPreviewKey === preview.key : index === 0)) ? " active" : "")} key={preview.key}>
                        <button type="button" className="nkj-catalog-photo-thumb-image" onClick={() => { setActiveStoredImageId(null); setActiveUploadPreviewKey(preview.key); }} title={preview.file.name}>
                          <img
                            src={preview.url}
                            alt={preview.file.name}
                            style={{ transform: `rotate(${(imageAdjustments[preview.key] || {}).rotation || 0}deg) scale(${(imageAdjustments[preview.key] || {}).cropZoom || 1})` }}
                          />
                        </button>
                        {index === 0 ? <span className="nkj-catalog-photo-primary">★ Primary</span> : null}
                        <button type="button" className="nkj-catalog-photo-thumb-remove" onClick={() => removePendingImage(preview)} aria-label={"Remove " + preview.file.name}><X size={13} /></button>
                      </div>
                    ))}

                    {currentImages.map((image) => (
                      <div className={"nkj-catalog-photo-thumb" + (Number(image.displayOrder) === 0 ? " is-primary" : "") + ((String(activeStoredImageId) === String(image.id) || (!activeStoredImageId && !imagePreviews.length && Number(image.displayOrder) === 0)) ? " active" : "")} key={image.id}>
                        <button type="button" className="nkj-catalog-photo-thumb-image" onClick={() => { setActiveStoredImageId(image.id); setActiveUploadPreviewKey(""); }} title={image.altText || form.designName}>
                          <img src={assetUrl(image.thumbnailUrl || image.displayUrl)} alt={image.altText || form.designName} />
                        </button>
                        {Number(image.displayOrder) === 0 ? <span className="nkj-catalog-photo-primary">★ Primary</span> : <button type="button" className="nkj-catalog-photo-set-primary" onClick={() => { setPrimaryImage(image); setActiveStoredImageId(image.id); setActiveUploadPreviewKey(""); }}>Set Primary</button>}
                        <button type="button" className="nkj-catalog-photo-thumb-remove" onClick={() => removeImage(image)} aria-label="Remove image"><X size={13} /></button>
                      </div>
                    ))}

                    <label className="nkj-catalog-photo-add-more">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                        multiple
                        onChange={(event) => { addPendingImages(event.target.files); event.target.value = ""; }}
                      />
                      <Plus size={27} />
                      <span>Add More</span>
                    </label>
                  </div>

                  {(imagePreviews.length > 0 || currentImages.length > 0) && (
                    <div className="nkj-catalog-photo-actions">
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedPendingPhoto) {
                            makePendingImagePrimary(selectedPendingPhoto);
                          } else if (selectedStoredPhoto) {
                            setPrimaryImage(selectedStoredPhoto);
                          }
                        }}
                      ><CheckCircle2 size={17} /> Primary</button>
                      <button
                        type="button"
                        onClick={() => {
                          const src = selectedPendingPhoto?.url || (selectedStoredPhoto ? assetUrl(selectedStoredPhoto.displayUrl || selectedStoredPhoto.thumbnailUrl) : "");
                          if (src) setPreviewPhoto({ src, alt: selectedPendingPhoto?.file.name || selectedStoredPhoto?.altText || form.designName || "Jewellery design" });
                        }}
                      ><Eye size={17} /> Preview</button>
                      <button
                        type="button"
                        className="remove"
                        onClick={() => {
                          if (selectedPendingPhoto) removePendingImage(selectedPendingPhoto);
                          else if (selectedStoredPhoto) removeImage(selectedStoredPhoto);
                        }}
                      ><Trash2 size={17} /> Remove</button>
                    </div>
                  )}
                  {selectedPendingPhoto && (
                    <details className="nkj-catalog-photo-adjustments">
                      <summary>Photo Adjustments · rotate and crop</summary>
                      <div className="nkj-catalog-photo-adjustment-actions">
                        <button type="button" onClick={() => setImageAdjustments((current) => ({
                          ...current,
                          [selectedPendingPhoto.key]: { ...selectedPhotoAdjustment, rotation: (selectedPhotoAdjustment.rotation + 270) % 360 },
                        }))}><RotateCcw size={14} /> Rotate Left</button>
                        <button type="button" onClick={() => setImageAdjustments((current) => ({
                          ...current,
                          [selectedPendingPhoto.key]: { ...selectedPhotoAdjustment, rotation: (selectedPhotoAdjustment.rotation + 90) % 360 },
                        }))}><RotateCw size={14} /> Rotate Right</button>
                      </div>
                      <label>Crop / Zoom · {Number(selectedPhotoAdjustment.cropZoom).toFixed(1)}×
                        <input type="range" min="1" max="2" step="0.1" value={selectedPhotoAdjustment.cropZoom} onChange={(event) => setImageAdjustments((current) => ({
                          ...current,
                          [selectedPendingPhoto.key]: { ...selectedPhotoAdjustment, cropZoom: Number(event.target.value) },
                        }))} />
                      </label>
                    </details>
                  )}
                  <p className="nkj-catalog-photo-note">Original photographs are preserved. Add multiple JPG, PNG or WebP images; the first selected photo is primary unless changed above.</p>
                </aside>

                <div className="nkj-catalog-design-fields">
                  <section className="nkj-catalog-form-section">
                    <h3>BASIC INFORMATION</h3>
                    <div className="nkj-catalog-basic-grid">
                      <label>Design ID (auto-generated)
                        <input className="nkj-catalog-id-field" value={editingId ? currentDesignId : "Generated after saving"} readOnly aria-readonly="true" />
                      </label>
                      <label>Main Category <i>*</i>
                        <select required disabled={Boolean(editingId)} value={form.metalType} onChange={(event) => {
                          const nextMetal = event.target.value;
                          const first = categories.find((item) => item.metalType === nextMetal && item.isActive !== false);
                          setForm((current) => ({ ...current, metalType: nextMetal, categoryId: first ? String(first.id) : "", purity: "" }));
                        }}>
                          <option value="GOLD">Gold</option><option value="SILVER">Silver</option><option value="DIAMOND">Diamond</option>
                        </select>
                      </label>
                      <label>Subcategory <i>*</i>
                        <select required disabled={Boolean(editingId)} value={form.categoryId} onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}>
                          <option value="">Choose subcategory</option>
                          {formMetalCategories.map((item) => <option key={item.id} value={item.id}>{item.subcategoryName}</option>)}
                        </select>
                      </label>
                      <label className="full">Design Name <i>*</i>
                        <input required maxLength={160} value={form.designName} onChange={(event) => setForm((current) => ({ ...current, designName: event.target.value }))} placeholder="Enter a distinct design name" />
                      </label>
                    </div>
                    {editingId && (
                      <div className="nkj-catalog-move-panel">
                        <div><b>Move to another subcategory</b><small>The original Design ID remains archived. Design details and photo references transfer to the new record.</small></div>
                        <div className="nkj-catalog-move-controls">
                          <select value={moveCategoryId} onChange={(event) => setMoveCategoryId(event.target.value)} aria-label="Destination subcategory">
                            <option value="">Choose destination subcategory</option>
                            {formMetalCategories.filter((item) => String(item.id) !== String(form.categoryId)).map((item) => (
                              <option key={item.id} value={item.id}>{item.subcategoryName}</option>
                            ))}
                          </select>
                          <button type="button" disabled={!moveCategoryId || movingDesign || saving} onClick={moveDesign}>
                            {movingDesign ? <LoaderCircle size={14} className="spin" /> : <ArrowRightLeft size={14} />}
                            {movingDesign ? "Moving…" : "Move and generate new ID"}
                          </button>
                        </div>
                      </div>
                    )}
                  </section>

                  <section className="nkj-catalog-form-section">
                    <h3>DESIGN SPECIFICATIONS</h3>
                    <div className="nkj-catalog-spec-grid">
                      <label>Jewellery Type
                        <input maxLength={80} value={form.regionalInspiration} onChange={(event) => setForm((current) => ({ ...current, regionalInspiration: event.target.value }))} placeholder="e.g. Bengali / Rajasthani / Pan-Indian" />
                      </label>
                      <label>Style / Design Type
                        <input maxLength={80} value={form.styleLabel} onChange={(event) => setForm((current) => ({ ...current, styleLabel: event.target.value }))} placeholder="e.g. Bengali Nakshi" />
                      </label>
                      <label className="full">Material Description
                        <input maxLength={120} value={form.materialLabel} onChange={(event) => setForm((current) => ({ ...current, materialLabel: event.target.value }))} placeholder="e.g. Gold concept · actual karat not specified" />
                      </label>
                      <label>Purity / Fineness
                        <select value={form.purity} onChange={(event) => setForm((current) => ({ ...current, purity: event.target.value }))}>
                          <option value="">Not specified</option>
                          {hasLegacyPurity && <option value={form.purity}>Existing saved value (kept): {form.purity}</option>}
                          {formPurityOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                        {hasLegacyPurity && <small className="nkj-catalog-purity-legacy">This saved value is outside the current {form.metalType} options. It is preserved until you choose a valid value above.</small>}
                      </label>
                      <label>Weight (grams)
                        <input type="number" min="0" step="0.001" value={form.weightGrams} onChange={(event) => setForm((current) => ({ ...current, weightGrams: event.target.value }))} placeholder="Optional" />
                      </label>
                    </div>
                  </section>

                  <section className="nkj-catalog-form-section">
                    <h3>ADDITIONAL INFORMATION</h3>
                    <div className="nkj-catalog-additional-grid">
                      <label>Search Keywords
                        <input maxLength={800} value={form.keywords} onChange={(event) => setForm((current) => ({ ...current, keywords: event.target.value }))} placeholder="Motif, finish, occasion…" />
                      </label>
                      <label>Price (₹)
                        <input type="number" min="0" step="0.01" value={form.priceInr} onChange={(event) => setForm((current) => ({ ...current, priceInr: event.target.value }))} placeholder="Optional" />
                      </label>
                      <label className="full">Description
                        <textarea maxLength={5000} rows={3} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Describe the design details…" />
                      </label>
                    </div>
                  </section>
                </div>
              </div>

              <footer className="nkj-catalog-design-footer">
                <div className="nkj-catalog-design-status">
                  <label><input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} /> Publish / active</label>
                  <label><input type="checkbox" checked={form.isFeatured} onChange={(event) => setForm((current) => ({ ...current, isFeatured: event.target.checked }))} /> Featured design</label>
                </div>
                <div className="nkj-catalog-design-footer-actions">
                  <button type="button" className="cancel" disabled={saving} onClick={() => setShowForm(false)}><X size={17} /> Cancel</button>
                  <button type="button" className="reset" disabled={saving} onClick={resetDesignForm}><RefreshCw size={17} /> Reset Form</button>
                  <button type="submit" className="primary" disabled={saving}>{saving ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}{saving ? "Saving…" : "Save Design"}</button>
                </div>
              </footer>

              {previewPhoto && (
                <div className="nkj-catalog-photo-preview-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewPhoto(null); }}>
                  <div className="nkj-catalog-photo-preview" role="dialog" aria-modal="true" aria-label="Photograph preview">
                    <button type="button" onClick={() => setPreviewPhoto(null)} aria-label="Close preview"><X size={20} /></button>
                    <img src={previewPhoto.src} alt={previewPhoto.alt} />
                  </div>
                </div>
              )}
            </form>
          </div>
        )}
      </div>
    </Page>
  );
}
