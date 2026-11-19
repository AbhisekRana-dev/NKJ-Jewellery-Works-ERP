import "./OwnerShell.css";
import React, { useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Home as HomeIcon, FileText, Files, Users, User, ChartNoAxesColumn,
  LogOut, LogIn, Plus, Receipt, LayoutDashboard, Boxes, Coins, Contact,
  Wallet, CalendarCheck, ClipboardList, Banknote, Database, ScrollText,
  Wrench, ChevronRight, ChevronDown, ArrowLeftRight, Calculator as CalculatorIcon, Gem, MapPin,
  Menu, X as CloseIcon,
} from "lucide-react";
import { useAuth } from "../../core/auth/AuthProvider";

const SIDEBAR_STORAGE_KEY = "nkj-owner-sidebar-collapsed";
const SIDEBAR_LAYOUT_VERSION_KEY = "nkj-owner-sidebar-layout-version";
const SIDEBAR_LAYOUT_VERSION = "compact-desktop-rail-v2";
const SIDEBAR_SCROLL_KEY = "nkj-owner-sidebar-scroll";
const SIDEBAR_NAV_CLICK_KEY = "nkj-owner-sidebar-nav-last-click";
const SIDEBAR_DOUBLE_CLICK_MS = 450;
function initialSidebarState() {
  try {
    // Move existing installations to the compact rail shown in the reference
    // screenshots exactly once. After this migration, the arrow toggle choice
    // is respected and persists across desktop visits.
    const savedVersion = window.localStorage.getItem(SIDEBAR_LAYOUT_VERSION_KEY);
    if (savedVersion !== SIDEBAR_LAYOUT_VERSION) {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "true");
      window.localStorage.setItem(SIDEBAR_LAYOUT_VERSION_KEY, SIDEBAR_LAYOUT_VERSION);
      return true;
    }

    if (window.matchMedia?.("(max-width: 760px)").matches) return true;
    const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (saved !== null) return saved === "true";
    return window.matchMedia?.("(max-width: 1100px)").matches ?? true;
  } catch {
    // Prefer the safe, compact layout when browser storage is unavailable.
    return true;
  }
}

const ownerNavigation = [
  { title: "OVERVIEW", items: [
    ["dashboard", "Dashboard", "/dashboard", LayoutDashboard, "Dash"],
  ]},
  { title: "BILLING & BOOKINGS", items: [
    ["invoice", "New Invoice", "/invoice", FileText, "Inv"],
    ["saved", "All Invoices", "/saved-invoices", Files, "All Inv"],
    ["bookings", "Pre-Booking Bills", "/bookings", Receipt, "Pre-Book"],
    ["installments", "Installment / EMI Management", "/installments", CalendarCheck, "EMI"],
    ["old-gold", "Old Gold Exchange", "/old-gold", Coins, "Old Gold"],
  ]},
  { title: "INVENTORY", items: [
    ["inventory", "Jewellery Inventory", "/inventory", Boxes, "Stock"],
    ["purchases", "Purchase Management", "/purchases", Banknote, "Buy"],
    ["stock-movements", "Stock Movements", "/stock-movements", ArrowLeftRight, "Move"],
    ["rates", "Gold & Silver Rates", "/rates", Coins, "Rates"],
  ]},
  { title: "MASTERS", items: [
    ["customers", "Customers", "/customers", Users, "Cust"],
    ["suppliers", "Suppliers", "/suppliers", Contact, "Supp"],
  ]},
  { title: "FINANCE & REPORTS", items: [
    ["expenses", "Expenses", "/expenses", Wallet, "Exp"],
    ["payments", "Payments", "/payments", Receipt, "Pay"],
    ["transactions", "Transactions", "/transactions", ArrowLeftRight, "Trans"],
    ["reports", "Reports Overview", "/reports", ChartNoAxesColumn, "Rpt"],
    ["reports-sales", "Sales Report", "/reports/sales", ChartNoAxesColumn, "Sales"],
    ["reports-profit", "Profit & Loss", "/reports/profit", ChartNoAxesColumn, "P&L"],
    ["reports-expenses", "Expense Report", "/reports/expenses", Receipt, "Exp Rpt"],
  ]},
  { title: "PEOPLE", items: [
    ["staff", "Staff Details", "/staff", Contact, "Staff"],
    ["attendance", "Attendance", "/attendance", CalendarCheck, "Attnd"],
    ["leaves", "Staff Leave", "/leaves", ClipboardList, "Leave"],
    ["salary", "Salary Management", "/salary", Banknote, "Salary"],
    ["salary-payments", "Salary Payments", "/salary-payments", Wallet, "Pay"],
    ["karigars", "Karigars", "/karigars", Users, "Kari"],
    ["repairs", "Repair Orders", "/repairs", Wrench, "Repair"],
  ]},
  { title: "SYSTEM", items: [
    ["design-catalog", "Jewellery Catalog Management", "/design-catalog", Gem, "Designs"],
    ["database", "Database Management", "/database", Database, "DB"],
    ["audit-logs", "Audit Logs", "/audit-logs", ScrollText, "Audit"],
    ["profile", "Owner Profile", "/profile", User, "Profile"],
  ]},
];

export function Nav({ active = "home" }) {
  const { isAdmin, logout, user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(initialSidebarState);
  const [publicMenuOpen, setPublicMenuOpen] = useState(false);
  const sidebarNavRef = useRef(null);
  const ownerWorkspace = isAdmin && active !== "login";
  const persistSidebarState = (collapsed) => {
    try {
      if (window.matchMedia?.("(max-width: 760px)").matches) return;
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
    } catch {
      // Keep the sidebar interactive if browser storage is unavailable.
    }
  };// The dedicated hamburger toggles the sidebar independently of navigation.
  const handleSidebarToggle = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      persistSidebarState(next);
      return next;
    });
  };

  useLayoutEffect(() => {
    if (!publicMenuOpen || ownerWorkspace) return undefined;
    const media = window.matchMedia?.("(max-width: 760px)");
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      setPublicMenuOpen(false);
      document.querySelector(".nkj-public-menu-button")?.focus();
    };
    const closeOutside = (event) => {
      const header = document.querySelector(".nkj-public-topbar");
      if (header && !header.contains(event.target)) setPublicMenuOpen(false);
    };
    const closeOnDesktop = () => {
      if (media && !media.matches) setPublicMenuOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOutside);
    if (media?.addEventListener) media.addEventListener("change", closeOnDesktop);
    else media?.addListener?.(closeOnDesktop);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOutside);
      if (media?.removeEventListener) media.removeEventListener("change", closeOnDesktop);
      else media?.removeListener?.(closeOnDesktop);
    };
  }, [publicMenuOpen, ownerWorkspace]);

  // Track two quick clicks on the same navigation item in sessionStorage.
  // This survives route navigation, where React may remount the sidebar between
  // the first and second click. A single click never changes the sidebar state.
  const handleSidebarNavigationClick = (key) => {
    const now = Date.now();

    try {
      const previous = JSON.parse(window.sessionStorage.getItem(SIDEBAR_NAV_CLICK_KEY) || "null");
      const isDoubleClick = previous?.key === key
        && Number.isFinite(previous?.at)
        && now >= previous.at
        && now - previous.at <= SIDEBAR_DOUBLE_CLICK_MS;

      if (isDoubleClick) {
        window.sessionStorage.removeItem(SIDEBAR_NAV_CLICK_KEY);
        setSidebarCollapsed((current) => {
          const next = !current;
          persistSidebarState(next);
          return next;
        });
        return;
      }

      window.sessionStorage.setItem(SIDEBAR_NAV_CLICK_KEY, JSON.stringify({ key, at: now }));
    } catch {
      // If session storage is unavailable, navigation remains usable; only
      // the dedicated sidebar toggle will change expanded/collapsed state.
    }
  };

  useLayoutEffect(() => {
    const body = document.body;
    body.classList.toggle("nkj-owner-layout", ownerWorkspace);
    body.classList.toggle("nkj-owner-sidebar-collapsed", ownerWorkspace && sidebarCollapsed);
    body.classList.toggle("invoice-page", active === "invoice");
    const mobileMenuOpen = ownerWorkspace
      && window.matchMedia?.("(max-width: 760px)").matches
      && !sidebarCollapsed;
    const previousBodyOverflow = body.style.overflow;
    body.classList.toggle("nkj-mobile-sidebar-open", Boolean(mobileMenuOpen));
    if (mobileMenuOpen) body.style.overflow = "hidden";

    if (ownerWorkspace && !window.matchMedia?.("(max-width: 760px)").matches) {
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarCollapsed));
      } catch {
        // The sidebar remains usable when browser storage is unavailable.
      }
    }

    return () => {
      body.classList.remove("nkj-mobile-sidebar-open");
      body.style.overflow = previousBodyOverflow;
    };
  }, [active, ownerWorkspace, sidebarCollapsed]);

  useLayoutEffect(() => {
    if (!ownerWorkspace) return undefined;
    const media = window.matchMedia?.("(max-width: 760px)");
    if (!media) return undefined;
    const syncSidebarToViewport = () => setSidebarCollapsed(media.matches ? true : initialSidebarState());
    if (media.addEventListener) media.addEventListener("change", syncSidebarToViewport);
    else media.addListener?.(syncSidebarToViewport);
    return () => {
      if (media.removeEventListener) media.removeEventListener("change", syncSidebarToViewport);
      else media.removeListener?.(syncSidebarToViewport);
    };
  }, [ownerWorkspace]);

  useLayoutEffect(() => {
    if (!ownerWorkspace || !window.matchMedia?.("(max-width: 760px)").matches || sidebarCollapsed) return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      setSidebarCollapsed(true);
      document.querySelector(".nkj-mobile-menu-button")?.focus();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [ownerWorkspace, sidebarCollapsed]);

  useLayoutEffect(() => {
    if (!ownerWorkspace || !sidebarNavRef.current) return;
    try {
      const savedScroll = Number(window.sessionStorage.getItem(SIDEBAR_SCROLL_KEY) || 0);
      sidebarNavRef.current.scrollTop = Number.isFinite(savedScroll) ? savedScroll : 0;
    } catch {
      // The navigation still works if session storage is disabled.
    }
  }, [ownerWorkspace]);

  if (ownerWorkspace) {
    return (
      <>
        <button
          type="button"
          className="nkj-mobile-sidebar-backdrop"
          aria-label="Close navigation menu"
          tabIndex={sidebarCollapsed ? -1 : 0}
          onClick={() => setSidebarCollapsed(true)}
        />
        <aside id="nkj-owner-sidebar" className={`nkj-owner-sidebar${sidebarCollapsed ? " is-collapsed" : ""}`} aria-label="Owner navigation">
          <button
            type="button"
            className="nkj-sidebar-toggle"
            aria-label={sidebarCollapsed ? "Expand owner sidebar" : "Collapse owner sidebar"}
            aria-expanded={!sidebarCollapsed}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={handleSidebarToggle}
          >
            <ChevronRight size={18} />
          </button>

          <Link to="/" className="nkj-owner-brand" aria-label="Nandikishor Jewellery Works home">
            <img className="nkj-owner-logo-image" src="/nkj-sidebar-logo-ornate.png" alt="Nandikishor Jewellery Works NKJ logo" />
          </Link>

          <nav
            className="nkj-owner-nav"
            ref={sidebarNavRef}
            onScroll={(event) => {
              try {
                window.sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(event.currentTarget.scrollTop));
              } catch {
                // Ignore storage errors; scrolling itself is unaffected.
              }
            }}
          >
            {ownerNavigation.map((group) => (
              <section className="nkj-owner-nav-group" key={group.title}>
                <small className="nkj-owner-nav-title">{group.title}</small>
                {group.items.map(([key, label, to, Icon, shortLabel]) => {
                  const selected = active === key || (key === "saved" && active === "saved");
                  return (
                    <Link
                      key={key}
                      to={to}
                      state={key === "invoice" ? { startNewInvoice: true } : undefined}
                      className={selected ? "active" : ""}
                      title={sidebarCollapsed ? label : undefined}
                      aria-label={label}
                      aria-current={selected ? "page" : undefined}
                      data-nav-key={key}
                      onClick={() => {
                        handleSidebarNavigationClick(key);
                        if (window.matchMedia?.("(max-width: 760px)").matches) setSidebarCollapsed(true);
                      }}
                    >
                      <Icon size={18} aria-hidden="true" />
                      <span className="nkj-owner-nav-full-label">{label}</span>
                      <small className="nkj-owner-nav-short-label" aria-hidden="true">{shortLabel}</small>
                      <ChevronRight className="nkj-owner-nav-arrow" size={14} aria-hidden="true" />
                    </Link>
                  );
                })}
              </section>
            ))}
          </nav>

          <div className="nkj-owner-sidebar-bottom">
            <button
              type="button"
              className="nkj-owner-logout"
              onClick={logout}
              title="Logout"
              aria-label="Logout"
            >
              <span className="nkj-owner-logout-icon"><LogOut size={19} aria-hidden="true" /></span>
              <span className="nkj-owner-logout-label">Logout</span>
            </button>
          </div>
        </aside>

        <header className="topbar nkj-owner-topbar nkj-reference-navbar">
          <Link to="/" className="brand" aria-label="Nandikishor Jewellery Works home">
            <div className="nkj-navbar-brand-copy">
              <b>Nandikishor Jewellery Works</b>
              <small><MapPin size={14} /> Sasra, Gopiballavpur, Jhargram</small>
            </div>
          </Link>
          <button
            type="button"
            className="nkj-mobile-menu-button"
            aria-label={sidebarCollapsed ? "Open navigation menu" : "Close navigation menu"}
            aria-controls="nkj-owner-sidebar"
            aria-expanded={!sidebarCollapsed}
            onClick={() => setSidebarCollapsed((current) => !current)}
          >
            {sidebarCollapsed ? <Menu size={22} aria-hidden="true" /> : <CloseIcon size={22} aria-hidden="true" />}
          </button>
          <nav aria-label="Main navigation">
            <Link className={`nkj-navbar-link${active === "home" ? " active" : ""}`} to="/"><HomeIcon /> <span>Home</span></Link>
            <Link className={`nkj-navbar-link${active === "designs" ? " active" : ""}`} to="/designs"><Gem /> <span>Jewellery Designs</span></Link>
            <Link className={`nkj-navbar-link${active === "calculator" ? " active" : ""}`} to="/calculator"><CalculatorIcon /> <span>Calculator</span></Link>
            <Link className={`nkj-navbar-link nkj-navbar-invoice${active === "invoice" ? " active" : ""}`} to="/invoice" state={{ startNewInvoice: true }}><FileText /> <span>New Invoice</span></Link>
            <span className="nkj-navbar-user"><User size={20} /> <b>{user || "Owner"}</b><ChevronDown size={15} aria-hidden="true" /></span>
          </nav>
        </header>
      </>
    );
  }

  return (
    <header className="topbar nkj-public-topbar">
      <Link to="/" className="brand" aria-label="Nandikishor Jewellery Works home" onClick={() => setPublicMenuOpen(false)}>
        <div><b>Nandikishor Jewellery Works</b><small>Sasra, Gopiballavpur, Jhargram</small></div>
      </Link>
      <button
        type="button"
        className="nkj-public-menu-button"
        aria-label={publicMenuOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-controls="nkj-public-navigation"
        aria-expanded={publicMenuOpen}
        onClick={() => setPublicMenuOpen((open) => !open)}
      >
        {publicMenuOpen ? <CloseIcon size={21} aria-hidden="true" /> : <Menu size={21} aria-hidden="true" />}
      </button>
      <nav id="nkj-public-navigation" className={publicMenuOpen ? "is-open" : ""} aria-label="Main navigation">
        <Link className={active === "home" ? "active" : ""} to="/" onClick={() => setPublicMenuOpen(false)}><HomeIcon />Home</Link>
        <Link className={active === "designs" ? "active" : ""} to="/designs" onClick={() => setPublicMenuOpen(false)}><Gem />Jewellery Designs</Link>
        <Link className={active === "calculator" ? "active" : ""} to="/calculator" onClick={() => setPublicMenuOpen(false)}><CalculatorIcon />Calculator</Link>
        <Link className={active === "invoice" ? "active" : ""} to="/invoice" state={{ startNewInvoice: true }} onClick={() => setPublicMenuOpen(false)}><FileText />New Invoice</Link>
        {isAdmin ? <>
          <Link className={active === "saved" ? "active" : ""} to="/saved-invoices" onClick={() => setPublicMenuOpen(false)}><Files />All Invoices</Link>
          <Link className={active === "dashboard" ? "active" : ""} to="/dashboard" onClick={() => setPublicMenuOpen(false)}><LayoutDashboard />Dashboard</Link>
          <Link className={active === "profile" ? "active" : ""} to="/profile" onClick={() => setPublicMenuOpen(false)}><User />Profile</Link>
          <button className="navbtn" onClick={() => { setPublicMenuOpen(false); logout(); }}><LogOut />Logout</button>
        </> : <Link className={active === "login" ? "active" : ""} to="/login" onClick={() => setPublicMenuOpen(false)}><LogIn />Owner Login</Link>}
      </nav>
    </header>
  );
}

export function Page({ active, children }) {
  const { isAdmin } = useAuth();
  const ownerLayout = isAdmin && active !== "login";

  return (
    <>
      <Nav active={active} />
      <main className={active === "invoice"
        ? `container invoice-container${ownerLayout ? " nkj-owner-invoice-container" : ""}`
        : ownerLayout ? "container nkj-owner-container" : "container"}>
        {children}
      </main>
    </>
  );
}

export function Stat({ icon, label, value, sub }) {
  return (
    <div className="stat">
      <div className="stat-icon">{icon}</div>
      <div className="stat-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <div className="stat-sub">{sub}</div>
      </div>
    </div>
  );
}
