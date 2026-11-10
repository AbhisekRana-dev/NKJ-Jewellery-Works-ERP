import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, Eye, EyeOff, Star, Upload, ImagePlus, X, LoaderCircle, Save, Layers3 } from "lucide-react";
import { Page } from "../../shared/layouts/OwnerShell";
import { request } from "../../core/api/client";
import "./JewelleryCatalogAdminPage.css";

const API = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
const PAGE_SIZE = 30;
const assetUrl = (path) => path && path.startsWith("/api/") ? `${API}${path.slice(4)}` : path;
const blankForm = (categoryId = "") => ({
  categoryId: String(categoryId),
  designName: "",
  description: "",
  styleLabel: "",
  keywords: "",
  isActive: true,
  isFeatured: false,
});

async function uploadDesignImages(designId, files) {
  const formData = new FormData();
  Array.from(files).forEach((file) => formData.append("files", file));
  const token = window.localStorage.getItem("nkj_token");
  let response;
  try {
    response = await fetch(`${API}/admin/designs/${designId}/images`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
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
  if (!response.ok) throw new Error(data.message || `Image upload failed (${response.status}).`);
  return data;
}

const cleanFileName = (name) => String(name || "Jewellery Design")
  .replace(/\.[^.]+$/, "")
  .replace(/[_-]+/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, 150);

export default function JewelleryCatalogAdminPage() {
  const [categories, setCategories] = useState([]);
  const [metal, setMetal] = useState("GOLD");
  const [subcategory, setSubcategory] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("latest");
  const [page, setPage] = useState(0);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blankForm());
  const [imageFiles, setImageFiles] = useState([]);
  const [currentImages, setCurrentImages] = useState([]);
  const [bulkFiles, setBulkFiles] = useState([]);
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState("");

  const metalCategories = useMemo(() => categories.filter((item) => item.metalType === metal), [categories, metal]);
  const selectedCategory = categories.find((item) => String(item.id) === String(form.categoryId));

  const loadCategories = useCallback(async () => {
    const data = await request("/admin/designs/categories");
    setCategories(Array.isArray(data) ? data : []);
    if (Array.isArray(data) && data.length) {
      setBulkCategoryId((current) => current || String(data.find((item) => item.metalType === "GOLD")?.id || data[0].id));
    }
  }, []);

  const loadDesigns = useCallback(async (nextPage = page) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ metal, sort, page: String(nextPage), size: String(PAGE_SIZE) });
      if (subcategory) params.set("subcategory", subcategory);
      if (search.trim()) params.set("q", search.trim());
      const result = await request(`/admin/designs?${params.toString()}`);
      setItems(Array.isArray(result.items) ? result.items : []);
      setTotal(Number(result.total) || 0);
      setPage(Number(result.page) || 0);
    } catch (err) {
      setError(err.message || "Could not load the jewellery catalogue.");
    } finally {
      setLoading(false);
    }
  }, [metal, subcategory, search, sort, page]);

  useEffect(() => {
    loadCategories().catch((err) => setError(err.message || "Could not load catalogue categories."));
  }, [loadCategories]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadDesigns(0), search.trim() ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [metal, subcategory, search, sort]);

  const openNewForm = () => {
    const categoryId = metalCategories[0]?.id || categories[0]?.id || "";
    setEditingId(null);
    setForm(blankForm(categoryId));
    setImageFiles([]);
    setCurrentImages([]);
    setShowForm(true);
    setError("");
  };

  const openEditForm = async (design) => {
    setError("");
    try {
      const detail = await request(`/admin/designs/${design.id}`);
      setEditingId(design.id);
      setForm({
        categoryId: String(detail.categoryId),
        designName: detail.designName || "",
        description: detail.description || "",
        styleLabel: detail.styleLabel || "",
        keywords: detail.keywords || "",
        isActive: Boolean(detail.isActive),
        isFeatured: Boolean(detail.isFeatured),
      });
      setCurrentImages(Array.isArray(detail.images) ? detail.images : []);
      setImageFiles([]);
      setShowForm(true);
    } catch (err) {
      setError(err.message || "Could not open this design.");
    }
  };

  const saveDesign = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        ...form,
        categoryId: Number(form.categoryId),
      };
      const saved = editingId
        ? await request(`/admin/designs/${editingId}`, { method: "PUT", body: JSON.stringify(payload) })
        : await request("/admin/designs", { method: "POST", body: JSON.stringify(payload) });
      const id = Number(saved.id);
      if (imageFiles.length) {
        await uploadDesignImages(id, imageFiles);
      }
      setShowForm(false);
      setMessage(`${saved.designCode || "Design"} saved successfully.`);
      await loadDesigns(0);
    } catch (err) {
      setError(err.message || "Could not save the design.");
    } finally {
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
          keywords: design.keywords,
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
          keywords: design.keywords,
          isActive: design.isActive,
          isFeatured: !design.isFeatured,
        }),
      });
      await loadDesigns(page);
    } catch (err) {
      setError(err.message || "Could not update featured status.");
    }
  };

  const deleteDesign = async (design) => {
    if (!window.confirm(`Delete ${design.designCode} — ${design.designName}? This removes this catalogue record and its uploaded photos.`)) return;
    try {
      await request(`/admin/designs/${design.id}`, { method: "DELETE" });
      setMessage(`${design.designCode} deleted.`);
      await loadDesigns(page);
    } catch (err) {
      setError(err.message || "Could not delete this design.");
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

  const runBulkUpload = async () => {
    if (!bulkCategoryId) {
      setError("Choose the metal and subcategory for the bulk upload.");
      return;
    }
    if (!bulkFiles.length) {
      setError("Choose one or more JPG/PNG design photographs.");
      return;
    }
    setBulkRunning(true);
    setBulkProgress("");
    setError("");
    let completed = 0;
    try {
      for (const file of bulkFiles) {
        const saved = await request("/admin/designs", {
          method: "POST",
          body: JSON.stringify({
            categoryId: Number(bulkCategoryId),
            designName: cleanFileName(file.name),
            description: "Owner-uploaded jewellery design photograph.",
            styleLabel: "Shop photograph",
            keywords: cleanFileName(file.name),
            isActive: true,
            isFeatured: false,
          }),
        });
        await uploadDesignImages(saved.id, [file]);
        completed += 1;
        setBulkProgress(`Uploaded ${completed} of ${bulkFiles.length} designs…`);
      }
      setBulkFiles([]);
      setBulkProgress(`Successfully added ${completed} designs.`);
      setMessage(`Bulk upload complete: ${completed} designs added.`);
      await loadDesigns(0);
    } catch (err) {
      setError(`${err.message || "Bulk upload stopped."} ${completed} design(s) uploaded before the error.`);
      await loadDesigns(0);
    } finally {
      setBulkRunning(false);
    }
  };

  return (
    <Page active="design-catalog">
      <div className="nkj-catalog-admin">
        <header className="nkj-catalog-admin-heading">
          <div>
            <span>OWNER WORKSPACE · CATALOGUE CONTROL</span>
            <h1><Layers3 size={25} /> Jewellery Catalog Management</h1>
            <p>Add, organise and publish jewellery design inspirations and shop photographs.</p>
          </div>
          <button type="button" className="nkj-catalog-primary" onClick={openNewForm}><Plus size={17} /> Add New Design</button>
        </header>

        {error && <div className="nkj-catalog-alert error">{error}</div>}
        {message && <div className="nkj-catalog-alert success">{message}</div>}

        <section className="nkj-catalog-bulk">
          <div className="nkj-catalog-bulk-heading">
            <div><Upload size={19} /><b>Bulk Upload Shop Photographs</b></div>
            <small>Each selected image becomes a separate design record with its own generated design code.</small>
          </div>
          <div className="nkj-catalog-bulk-fields">
            <label>Assign metal and subcategory
              <select value={bulkCategoryId} onChange={(event) => setBulkCategoryId(event.target.value)}>
                <option value="">Choose subcategory</option>
                {categories.map((item) => <option key={item.id} value={item.id}>{item.metalType} · {item.subcategoryName}</option>)}
              </select>
            </label>
            <label className="nkj-catalog-file-picker"><ImagePlus size={17} /> Choose multiple JPG/PNG images
              <input type="file" accept="image/jpeg,image/png" multiple onChange={(event) => setBulkFiles(Array.from(event.target.files || []))} />
            </label>
            <button type="button" onClick={runBulkUpload} disabled={bulkRunning || !bulkFiles.length}>
              {bulkRunning ? <LoaderCircle className="spin" size={16} /> : <Upload size={16} />}
              {bulkRunning ? "Uploading…" : `Upload ${bulkFiles.length || ""} Designs`}
            </button>
          </div>
          {bulkProgress && <small className="nkj-catalog-progress">{bulkProgress}</small>}
          {bulkFiles.length > 0 && <small className="nkj-catalog-progress">{bulkFiles.map((file) => file.name).join(" · ")}</small>}
        </section>

        <section className="nkj-catalog-filters">
          <label><span>Metal</span><select value={metal} onChange={(event) => { setMetal(event.target.value); setSubcategory(""); }}>
            <option value="GOLD">Gold</option><option value="SILVER">Silver</option><option value="DIAMOND">Diamond</option>
          </select></label>
          <label><span>Subcategory</span><select value={subcategory} onChange={(event) => setSubcategory(event.target.value)}>
            <option value="">All {metal} designs</option>
            {metalCategories.map((item) => <option key={item.id} value={item.slug}>{item.subcategoryName}</option>)}
          </select></label>
          <label className="nkj-catalog-search"><span>Search catalogue</span><div><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, code or style" /></div></label>
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
                    <td><code>{design.designCode}</code></td>
                    <td>{design.metalType}<small className="nkj-catalog-subcategory">{design.subcategoryName}</small></td>
                    <td>{design.isSample ? <span className="nkj-catalog-badge sample">Sample inspiration</span> : <span className="nkj-catalog-badge real">Shop photo</span>}</td>
                    <td>{design.isActive ? <span className="nkj-catalog-badge active">Active</span> : <span className="nkj-catalog-badge inactive">Inactive</span>}{design.isFeatured && <span className="nkj-catalog-badge featured">Featured</span>}</td>
                    <td><div className="nkj-catalog-actions">
                      <button type="button" title="Edit design" onClick={() => openEditForm(design)}><Pencil size={15} /></button>
                      <button type="button" title={design.isFeatured ? "Remove featured" : "Feature design"} onClick={() => changeFeatured(design)}><Star size={15} fill={design.isFeatured ? "currentColor" : "none"} /></button>
                      <button type="button" title={design.isActive ? "Deactivate" : "Activate"} onClick={() => changeStatus(design)}>{design.isActive ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                      <button type="button" title="Delete design" className="delete" onClick={() => deleteDesign(design)}><Trash2 size={15} /></button>
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

        {showForm && (
          <div className="nkj-catalog-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setShowForm(false); }}>
            <form className="nkj-catalog-modal" onSubmit={saveDesign}>
              <header><div><span>OWNER CATALOGUE</span><h2>{editingId ? "Edit Jewellery Design" : "Add New Design"}</h2></div><button type="button" onClick={() => setShowForm(false)} aria-label="Close"><X size={19} /></button></header>
              <div className="nkj-catalog-form-grid">
                <label className="wide">Approved metal / subcategory
                  <select required value={form.categoryId} onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}>
                    <option value="">Choose subcategory</option>
                    {categories.map((item) => <option key={item.id} value={item.id}>{item.metalType} · {item.subcategoryName}</option>)}
                  </select>
                </label>
                <label className="wide">Design name<input required maxLength={160} value={form.designName} onChange={(event) => setForm((current) => ({ ...current, designName: event.target.value }))} placeholder="Enter a distinct design name" /></label>
                <label>Style / design type<input maxLength={80} value={form.styleLabel} onChange={(event) => setForm((current) => ({ ...current, styleLabel: event.target.value }))} placeholder="e.g. Bengali Nakshi" /></label>
                <label>Search keywords<input maxLength={800} value={form.keywords} onChange={(event) => setForm((current) => ({ ...current, keywords: event.target.value }))} placeholder="Motif, finish, occasion…" /></label>
                <label className="wide">Description<textarea maxLength={5000} rows={3} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Describe the design details…" /></label>
                <label className="wide nkj-catalog-upload-box"><ImagePlus size={18} /> Upload multiple design photographs
                  <input type="file" accept="image/jpeg,image/png" multiple onChange={(event) => setImageFiles(Array.from(event.target.files || []))} />
                  <small>JPG/PNG · Maximum 10 MB per image. Originals and 800px thumbnails are stored separately.</small>
                </label>
              </div>
              {imageFiles.length > 0 && <p className="nkj-catalog-selected-files">{imageFiles.length} image(s) selected: {imageFiles.map((file) => file.name).join(", ")}</p>}
              {editingId && currentImages.length > 0 && <div className="nkj-catalog-current-images">
                <b>Current images</b>
                <div>{currentImages.map((image) => <span key={image.id}><img src={assetUrl(image.thumbnailUrl)} alt={image.altText || form.designName} /><button type="button" onClick={() => removeImage(image)} aria-label="Remove image"><X size={13} /></button></span>)}</div>
              </div>}
              <div className="nkj-catalog-checkboxes">
                <label><input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} /> Publish / active</label>
                <label><input type="checkbox" checked={form.isFeatured} onChange={(event) => setForm((current) => ({ ...current, isFeatured: event.target.checked }))} /> Featured design</label>
              </div>
              <footer><button type="button" className="secondary" disabled={saving} onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="primary" disabled={saving}>{saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}{saving ? "Saving…" : "Save Design"}</button></footer>
            </form>
          </div>
        )}
      </div>
    </Page>
  );
}
