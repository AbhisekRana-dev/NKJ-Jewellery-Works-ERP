import React, { useMemo, useState } from "react";
import {
  Gem, Crown, Flower2, Sparkles, CircleDot, Heart, Search, X, ArrowUpRight,
} from "lucide-react";
import { Page } from "../../shared/layouts/OwnerShell";
import "./JewelleryDesignsPage.css";

const designs = [
  { id: "NKJ-NK-001", name: "Traditional Bridal Haar", category: "Necklaces", metal: "22K Gold", style: "Temple-inspired", icon: Crown, tone: "gold", description: "A statement layered haar with a traditional temple-inspired finish for wedding and festive wear." },
  { id: "NKJ-NK-002", name: "Kundan Choker Set", category: "Necklaces", metal: "Gold & Kundan", style: "Bridal classic", icon: Gem, tone: "rose", description: "A close-fitting choker look with a rich kundan-inspired centre and matching detailing." },
  { id: "NKJ-ER-003", name: "Floral Jhumka", category: "Earrings", metal: "22K Gold", style: "Traditional", icon: Flower2, tone: "gold", description: "Floral top detailing paired with a classic bell-shaped jhumka silhouette." },
  { id: "NKJ-ER-004", name: "Pearl Drop Earrings", category: "Earrings", metal: "Gold & Pearl", style: "Elegant", icon: Sparkles, tone: "pearl", description: "A graceful drop design with a soft pearl-inspired finish for celebrations and occasions." },
  { id: "NKJ-RG-005", name: "Classic Solitaire Ring", category: "Rings", metal: "Gold", style: "Modern", icon: Gem, tone: "pearl", description: "A clean single-stone ring silhouette with a polished, minimal profile." },
  { id: "NKJ-RG-006", name: "Floral Gold Ring", category: "Rings", metal: "22K Gold", style: "Floral", icon: Flower2, tone: "rose", description: "A delicate floral motif ring designed for everyday festive styling." },
  { id: "NKJ-BG-007", name: "Antique Kada Pair", category: "Bangles", metal: "22K Gold", style: "Antique", icon: CircleDot, tone: "gold", description: "Bold kada-inspired bangles with an antique-style ornamental finish." },
  { id: "NKJ-BG-008", name: "Daily Wear Bangles", category: "Bangles", metal: "Gold", style: "Classic", icon: CircleDot, tone: "pearl", description: "Simple, versatile bangles designed to complement daily and occasion wear." },
  { id: "NKJ-PD-009", name: "Emerald Look Pendant", category: "Pendants", metal: "Gold & Stone", style: "Stone accent", icon: Gem, tone: "green", description: "A gemstone-inspired pendant with a refined gold setting and delicate detailing." },
  { id: "NKJ-PD-010", name: "Lakshmi Pendant", category: "Pendants", metal: "22K Gold", style: "Traditional", icon: Crown, tone: "rose", description: "A traditional deity-inspired pendant concept for devotional and festive jewellery." },
  { id: "NKJ-BR-011", name: "Bridal Necklace Set", category: "Bridal", metal: "22K Gold", style: "Wedding", icon: Crown, tone: "gold", description: "A grand necklace-set concept made for bridal styling and special occasions." },
  { id: "NKJ-BR-012", name: "Polki Festive Set", category: "Bridal", metal: "Gold & Polki", style: "Festive luxury", icon: Sparkles, tone: "pearl", description: "A statement festive set concept with polki-inspired highlights and a traditional silhouette." },
];

const categories = ["All Designs", "Necklaces", "Earrings", "Rings", "Bangles", "Pendants", "Bridal"];

function DesignArtwork({ design }) {
  const Icon = design.icon;
  return (
    <div className={`nkj-design-art tone-${design.tone}`} aria-hidden="true">
      <span className="nkj-design-art-orbit orbit-one" />
      <span className="nkj-design-art-orbit orbit-two" />
      <span className="nkj-design-art-spark spark-one">✦</span>
      <span className="nkj-design-art-spark spark-two">✧</span>
      <div className="nkj-design-art-center">
        <Icon size={76} strokeWidth={1.15} />
      </div>
      <span className="nkj-design-art-caption">NKJ • DESIGN</span>
    </div>
  );
}

export default function JewelleryDesignsPage() {
  const [category, setCategory] = useState("All Designs");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  const visibleDesigns = useMemo(() => {
    const query = search.trim().toLowerCase();
    return designs.filter((design) => {
      const categoryMatch = category === "All Designs" || design.category === category;
      const searchMatch = !query || [
        design.name, design.id, design.category, design.metal, design.style,
      ].some((value) => value.toLowerCase().includes(query));
      return categoryMatch && searchMatch;
    });
  }, [category, search]);

  return (
    <Page active="designs">
      <div className="nkj-designs-page">
        <section className="nkj-designs-hero">
          <div className="nkj-designs-hero-copy">
            <span className="nkj-designs-eyebrow"><Sparkles size={14} /> NKJ DESIGN COLLECTION</span>
            <h1>Jewellery Designs</h1>
            <p>Explore traditional, bridal and everyday jewellery design inspirations from Nandikishor Jewellery Works.</p>
            <div className="nkj-designs-hero-note">
              <Gem size={16} />
              <span>Find a style you love and visit us for design and making enquiries.</span>
            </div>
          </div>
          <div className="nkj-designs-hero-mark" aria-hidden="true">
            <div className="nkj-designs-hero-ring"><Gem size={62} strokeWidth={1.1} /></div>
            <span>NKJ</span>
          </div>
        </section>

        <section className="nkj-designs-toolbar" aria-label="Browse jewellery designs">
          <div className="nkj-designs-categories">
            {categories.map((item) => (
              <button
                type="button"
                key={item}
                className={category === item ? "active" : ""}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <label className="nkj-designs-search">
            <Search size={17} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search designs, metal or style..."
              aria-label="Search jewellery designs"
            />
          </label>
        </section>

        <div className="nkj-designs-section-heading">
          <div>
            <span>OUR COLLECTION</span>
            <h2>{category === "All Designs" ? "Explore Designs" : category}</h2>
          </div>
          <small>{visibleDesigns.length} design{visibleDesigns.length === 1 ? "" : "s"}</small>
        </div>

        {visibleDesigns.length ? (
          <div className="nkj-designs-grid">
            {visibleDesigns.map((design) => (
              <article className="nkj-design-card" key={design.id}>
                <DesignArtwork design={design} />
                <div className="nkj-design-card-content">
                  <div className="nkj-design-card-meta">
                    <span>{design.category}</span>
                    <small>{design.id}</small>
                  </div>
                  <h3>{design.name}</h3>
                  <p>{design.metal} <span>•</span> {design.style}</p>
                  <button type="button" onClick={() => setSelected(design)}>
                    View Design <ArrowUpRight size={15} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="nkj-designs-empty">
            <Gem size={30} />
            <b>No matching designs found</b>
            <span>Try another keyword or choose a different category.</span>
            <button type="button" onClick={() => { setSearch(""); setCategory("All Designs"); }}>Clear search</button>
          </div>
        )}

        <section className="nkj-designs-enquiry">
          <div className="nkj-designs-enquiry-icon"><Heart size={21} /></div>
          <div>
            <b>Found a design you like?</b>
            <p>Save the design ID and share it with our shop team when you enquire.</p>
          </div>
          <span>Thank you for choosing NKJ</span>
        </section>

        {selected && (
          <div className="nkj-design-modal-backdrop" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelected(null);
          }}>
            <section className="nkj-design-modal" role="dialog" aria-modal="true" aria-labelledby="nkj-design-modal-title">
              <button type="button" className="nkj-design-modal-close" onClick={() => setSelected(null)} aria-label="Close design details">
                <X size={19} />
              </button>
              <DesignArtwork design={selected} />
              <div className="nkj-design-modal-content">
                <span>{selected.id} • {selected.category}</span>
                <h2 id="nkj-design-modal-title">{selected.name}</h2>
                <p>{selected.description}</p>
                <dl>
                  <div><dt>Material style</dt><dd>{selected.metal}</dd></div>
                  <div><dt>Design type</dt><dd>{selected.style}</dd></div>
                </dl>
                <small>Design preview only. Availability, weight and final price are confirmed by the shop.</small>
              </div>
              <button type="button" className="nkj-design-modal-done" onClick={() => setSelected(null)}>Close</button>
            </section>
          </div>
        )}
      </div>
    </Page>
  );
}
