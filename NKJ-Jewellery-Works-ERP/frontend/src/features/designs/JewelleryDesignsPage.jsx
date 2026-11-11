import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Gem, Crown, Flower2, Sparkles, CircleDot, Heart, Search, X, ArrowUpRight, ImagePlus,
  Layers3, Star, ChevronDown, LoaderCircle, Orbit, Hexagon, Aperture, Waves, Bird,
} from "lucide-react";
import { Page } from "../../shared/layouts/OwnerShell";
import { request } from "../../core/api/client";
import { useRealtimeRefresh } from "../../core/realtime/realtime";
import "./JewelleryDesignsPage.css";

const PAGE_SIZE = 24;
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
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
  const [loadState, setLoadState] = useState("loading");
  const [retry, setRetry] = useState(0);
  const source = assetUrl(design.thumbnailUrl);

  if (!source) {
    return (
      <div className="nkj-design-photo-missing" role="img" aria-label="No jewellery photograph uploaded">
        <ImagePlus size={25} />
        <span>Photograph not uploaded</span>
      </div>
    );
  }

  const imageSource = retry > 0
    ? `${source}${source.includes("?") ? "&" : "?"}retry=${retry}`
    : source;

  return (
    <div className="nkj-design-photo">
      <img
        key={imageSource}
        src={imageSource}
        alt={design.images?.[0]?.altText || design.designName}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoadState("loaded")}
        onError={() => {
          console.error("Jewellery catalogue image failed to load:", imageSource);
          setLoadState("error");
        }}
        style={{ objectFit: "contain" }}
      />
      {loadState === "loading" && <span className="nkj-design-photo-status">Loading photograph…</span>}
      {loadState === "error" && (
        <div className="nkj-design-photo-error" role="alert">
          <b>Photograph unavailable</b>
          <button type="button" onClick={() => { setLoadState("loading"); setRetry((value) => value + 1); }}>
            Retry image
          </button>
        </div>
      )}
      {!design.isSample && <span className="nkj-design-photo-label">SHOP PHOTO</span>}
    </div>
  );
}

export default function JewelleryDesignsPage() {
  const [categories, setCategories] = useState([]);
  const [metal, setMetal] = useState("GOLD");
  const [subcategory, setSubcategory] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("latest");
  const [purity, setPurity] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minWeight, setMinWeight] = useState("");
  const [maxWeight, setMaxWeight] = useState("");
  const [featuredItems, setFeaturedItems] = useState([]);
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
      if (purity) params.set("purity", purity);
      if (minPrice !== "") params.set("minPrice", minPrice);
      if (maxPrice !== "") params.set("maxPrice", maxPrice);
      if (minWeight !== "") params.set("minWeight", minWeight);
      if (maxWeight !== "") params.set("maxWeight", maxWeight);
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
  }, [metal, subcategory, search, sort, purity, minPrice, maxPrice, minWeight, maxWeight]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadDesigns(0, false), search.trim() ? 280 : 0);
    return () => window.clearTimeout(timer);
  }, [loadDesigns]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ metal, sort: "latest", page: "0", size: "6", featured: "true" });
    request("/designs?" + params.toString(), { publicRequest: true })
      .then((result) => { if (!cancelled) setFeaturedItems(Array.isArray(result.items) ? result.items : []); })
      .catch(() => { if (!cancelled) setFeaturedItems([]); });
    return () => { cancelled = true; };
  }, [metal]);

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
    try {
      const detail = await request(`/designs/${design.id}`, { publicRequest: true });
      setSelected(detail);
    } catch {
      // The card remains available in the dialog when details cannot be fetched.
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
  const modalImageUrl = activeImage?.originalUrl || selected?.originalUrl || activeImage?.thumbnailUrl || selected?.thumbnailUrl || "";
  const modalThumbnailUrl = activeImage?.thumbnailUrl || selected?.thumbnailUrl || "";

  return (
    <Page active="designs">
      <div className="nkj-designs-page">
        <section className="nkj-designs-hero">
          <div className="nkj-designs-hero-copy">
            <span className="nkj-designs-eyebrow"><Sparkles size={14} /> NKJ DESIGN COLLECTION</span>
            <h1>Jewellery Designs</h1>
            <p>Discover elegant gold, silver and diamond designs for weddings, celebrations and everyday wear.</p>
          </div>
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

        {featuredItems.length > 0 && (
          <section className="nkj-designs-featured-section">
            <div className="nkj-designs-section-heading">
              <div><span>OWNER SELECTED</span><h2>Featured {currentMetal.label} Designs</h2></div>
              <small>{featuredItems.length} featured</small>
            </div>
            <div className="nkj-designs-featured-grid">
              {featuredItems.map((design) => (
                <button type="button" className="nkj-designs-featured-card" key={design.id} onClick={() => openDesign(design)}>
                  <DesignImage design={design} />
                  <span><b>{design.designName}</b><small>{design.subcategoryName}</small></span>
                  <Star size={14} fill="currentColor" />
                </button>
              ))}
            </div>
          </section>
        )}

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
                  placeholder="Search design, code or style…" aria-label="Search jewellery designs" />
                {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search"><X size={14} /></button>}
              </label>
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

          <div className="nkj-design-filter-row" aria-label="Filter jewellery designs">
            <label>Purity<select value={purity} onChange={(event) => setPurity(event.target.value)}>
              <option value="">All purities</option><option value="24K">24K</option><option value="22K">22K</option><option value="18K">18K</option><option value="14K">14K</option><option value="925">925 Silver</option><option value="999">999 Silver</option>
            </select></label>
            <label>Minimum price (₹)<input type="number" min="0" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder="No minimum" /></label>
            <label>Maximum price (₹)<input type="number" min="0" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="No maximum" /></label>
            <label>Minimum weight (g)<input type="number" min="0" step="0.001" value={minWeight} onChange={(event) => setMinWeight(event.target.value)} placeholder="No minimum" /></label>
            <label>Maximum weight (g)<input type="number" min="0" step="0.001" value={maxWeight} onChange={(event) => setMaxWeight(event.target.value)} placeholder="No maximum" /></label>
            <button type="button" onClick={() => { setPurity(""); setMinPrice(""); setMaxPrice(""); setMinWeight(""); setMaxWeight(""); }}>Clear filters</button>
          </div>

          {error && <div className="nkj-designs-error" role="alert">{error}</div>}
          {loading && items.length === 0 ? (
            <div className="nkj-designs-loading"><LoaderCircle className="spin" size={24} /> Loading designs…</div>
          ) : items.length ? (
            <>
              <div className="nkj-designs-grid">
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
                        <small title={design.designId || design.designCode}>{design.designId || design.designCode}</small>
                      </div>
                      <h3>{design.designName}</h3>
                      <p>{design.metalType} <span>•</span> {design.styleLabel}</p>
                      {(design.purity || design.weightGrams != null || design.priceInr != null) && (
                        <p className="nkj-design-card-specs">
                          {design.purity && <span>{design.purity}</span>}
                          {design.weightGrams != null && <span>{Number(design.weightGrams).toLocaleString("en-IN")} g</span>}
                          {design.priceInr != null && <span>₹{Number(design.priceInr).toLocaleString("en-IN")}</span>}
                        </p>
                      )}
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
            if (event.target === event.currentTarget) setSelected(null);
          }}>
            <section className="nkj-design-modal" role="dialog" aria-modal="true" aria-labelledby="nkj-design-modal-title">
              <button type="button" className="nkj-design-modal-close" onClick={() => setSelected(null)} aria-label="Close design details">
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
                : <SampleArtwork design={selected} />}
              <div className="nkj-design-modal-content">
                <span>{selected.designId || selected.designCode} • {selected.metalType} • {selected.subcategoryName}</span>
                {selected.designId && selected.designCode && <small className="nkj-design-legacy-code">Legacy code: {selected.designCode}</small>}
                <h2 id="nkj-design-modal-title">{selected.designName}</h2>
                <p>{selected.description}</p>
                <dl>
                  <div><dt>Style</dt><dd>{selected.styleLabel || "—"}</dd></div>
                  <div><dt>Purity</dt><dd>{selected.purity || "Not specified"}</dd></div>
                  <div><dt>Weight</dt><dd>{selected.weightGrams != null ? Number(selected.weightGrams).toLocaleString("en-IN") + " g" : "Not specified"}</dd></div>
                  <div><dt>Price</dt><dd>{selected.priceInr != null ? "₹" + Number(selected.priceInr).toLocaleString("en-IN") : "Contact shop"}</dd></div>
                  <div><dt>Images</dt><dd>{selected.images?.length || selected.imageCount || 0}</dd></div>
                  <div><dt>Catalogue status</dt><dd>{selected.isSample ? "Sample inspiration" : "Owner-uploaded shop design"}</dd></div>
                </dl>
                {selected.images?.length > 1 && (
                  <div className="nkj-design-modal-gallery">
                    {selected.images.map((image, index) => (
                      <button type="button" key={image.id} className={activeImageIndex === index ? "active" : ""} onClick={() => { setActiveImageIndex(index); setZoomed(false); }} aria-label={"View image " + (index + 1)}>
                        <img src={assetUrl(image.thumbnailUrl)} alt={image.altText || selected.designName} loading="lazy" />
                      </button>
                    ))}
                  </div>
                )}
                <small>{detailLoading ? "Loading complete design details…" : selected.isSample ? "Inspiration entry only. This is not confirmed stock or a product available for sale." : "Shop photograph uploaded by the owner. Confirm current availability and final price with the shop."}</small>
              </div>
              <button type="button" className="nkj-design-modal-done" onClick={() => setSelected(null)}>Close</button>
            </section>
          </div>
        )}
      </div>
    </Page>
  );
}
