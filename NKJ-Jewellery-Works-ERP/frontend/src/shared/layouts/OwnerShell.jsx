import "./OwnerShell.css";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Home as HomeIcon, FileText, Files, Users, User, ChartNoAxesColumn,
  LogOut, LogIn, Plus, Receipt, LayoutDashboard, Boxes, Coins, Contact,
  Wallet, CalendarCheck, ClipboardList, Banknote, Database, ScrollText,
  Wrench, ChevronRight, ArrowLeftRight,
} from "lucide-react";
import { useAuth } from "../../core/auth/AuthProvider";

const SIDEBAR_STORAGE_KEY = "nkj-owner-sidebar-collapsed";
const SIDEBAR_SCROLL_KEY = "nkj-owner-sidebar-scroll";

function initialSidebarState() {
  try {
    const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (saved !== null) return saved === "true";
    return window.matchMedia?.("(max-width: 1050px)").matches ?? false;
  } catch {
    return false;
  }
}

const ownerNavigation = [
  { title: "OVERVIEW", items: [
    ["dashboard", "Dashboard", "/dashboard", LayoutDashboard],
  ]},
  { title: "BILLING & BOOKINGS", items: [
    ["invoice", "New Invoice", "/invoice", FileText],
    ["saved", "All Invoices", "/saved-invoices", Files],
    ["bookings", "Pre-Booking Bills", "/bookings", Receipt],
    ["installments", "Installment / EMI Management", "/installments", CalendarCheck],
    ["old-gold", "Old Gold Exchange", "/old-gold", Coins],
  ]},
  { title: "INVENTORY", items: [
    ["inventory", "Jewellery Inventory", "/inventory", Boxes],
    ["purchases", "Purchase Management", "/purchases", Banknote],
    ["stock-movements", "Stock Movements", "/stock-movements", ArrowLeftRight],
    ["rates", "Gold & Silver Rates", "/rates", Coins],
  ]},
  { title: "MASTERS", items: [
    ["customers", "Customers", "/customers", Users],
    ["suppliers", "Suppliers", "/suppliers", Contact],
  ]},
  { title: "FINANCE & REPORTS", items: [
    ["expenses", "Expenses", "/expenses", Wallet],
    ["payments", "Payments", "/payments", Receipt],
    ["reports", "Reports Overview", "/reports", ChartNoAxesColumn],
    ["reports-sales", "Sales Report", "/reports/sales", ChartNoAxesColumn],
    ["reports-profit", "Profit & Loss", "/reports/profit", ChartNoAxesColumn],
    ["reports-expenses", "Expense Report", "/reports/expenses", Receipt],
  ]},
  { title: "PEOPLE", items: [
    ["staff", "Staff Details", "/staff", Contact],
    ["attendance", "Attendance", "/attendance", CalendarCheck],
    ["leaves", "Staff Leave", "/leaves", ClipboardList],
    ["salary", "Salary Management", "/salary", Banknote],
    ["salary-payments", "Salary Payments", "/salary-payments", Wallet],
    ["karigars", "Karigars", "/karigars", Users],
    ["repairs", "Repair Orders", "/repairs", Wrench],
  ]},
  { title: "SYSTEM", items: [
    ["database", "Database Management", "/database", Database],
    ["audit-logs", "Audit Logs", "/audit-logs", ScrollText],
    ["profile", "Owner Profile", "/profile", User],
  ]},
];

export function Nav({ active = "home" }) {
  const { isAdmin, logout, user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(initialSidebarState);
  const sidebarNavRef = useRef(null);
  const ownerWorkspace = isAdmin && active !== "login";

  useLayoutEffect(() => {
    const body = document.body;
    body.classList.toggle("nkj-owner-layout", ownerWorkspace);
    body.classList.toggle("nkj-owner-sidebar-collapsed", ownerWorkspace && sidebarCollapsed);
    body.classList.toggle("invoice-page", active === "invoice");

    if (ownerWorkspace) {
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarCollapsed));
      } catch {
        // The sidebar remains usable when browser storage is unavailable.
      }
    }
  }, [active, ownerWorkspace, sidebarCollapsed]);

  useLayoutEffect(() => {
    if (!ownerWorkspace || !sidebarNavRef.current) return;
    try {
      const savedScroll = Number(window.sessionStorage.getItem(SIDEBAR_SCROLL_KEY) || 0);
      sidebarNavRef.current.scrollTop = Number.isFinite(savedScroll) ? savedScroll : 0;
    } catch {
      // The navigation still works if session storage is disabled.
    }
  }, [ownerWorkspace]);

  useEffect(() => {
    if (!ownerWorkspace) return undefined;

    const elementFromTarget = (target) => (
      target instanceof Element ? target : target?.parentElement
    );

    // Delegated handling survives route changes because it is attached to
    // document, while the page and its shared sidebar are re-rendered.
    const handleDoubleClick = (event) => {
      const target = elementFromTarget(event.target);
      if (!target) return;

      if (sidebarCollapsed) {
        // Expand only for double-clicks inside actual page content.
        // Clicks on the sidebar itself, header, or footer do not toggle it.
        if (target.closest(".app-content main") && !target.closest(".nkj-owner-sidebar")) {
          setSidebarCollapsed(false);
        }
        return;
      }

      // When expanded, only menu text (not its icon, arrow, brand, or user
      // profile) collapses the sidebar. Public Home text is included.
      if (target.closest(".nkj-owner-nav a span, .nkj-owner-sidebar-bottom a span")) {
        event.preventDefault();
        setSidebarCollapsed(true);
      }
    };

    const handleClickCapture = (event) => {
      if (event.detail < 2) return;
      const target = elementFromTarget(event.target);
      if (!target) return;

      // Suppress only the second click of a double-click sequence. The first
      // click is untouched, so ordinary sidebar/page navigation stays instant.
      const repeatedSidebarClick = target.closest(".nkj-owner-sidebar a");
      const repeatedContentLink = sidebarCollapsed
        && target.closest(".app-content main a");
      if (repeatedSidebarClick || repeatedContentLink) {
        event.preventDefault();
      }
    };

    document.addEventListener("dblclick", handleDoubleClick);
    document.addEventListener("click", handleClickCapture, true);
    return () => {
      document.removeEventListener("dblclick", handleDoubleClick);
      document.removeEventListener("click", handleClickCapture, true);
    };
  }, [ownerWorkspace, sidebarCollapsed]);

  if (ownerWorkspace) {
    return (
      <>
        <aside className={`nkj-owner-sidebar${sidebarCollapsed ? " is-collapsed" : ""}`} aria-label="Owner navigation">
          <button
            type="button"
            className="nkj-sidebar-toggle"
            aria-label={sidebarCollapsed ? "Expand owner sidebar" : "Collapse owner sidebar"}
            aria-expanded={!sidebarCollapsed}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setSidebarCollapsed((value) => !value)}
          >
            <ChevronRight size={18} />
          </button>

          <Link to="/" className="nkj-owner-brand" aria-label="Nandikishor Jewellery Works home">
            <span className="nkj-owner-logo">NKJ</span>
            <span><b>Nandikishor</b><small>Jewellery Works ERP</small></span>
          </Link>

          <div className="nkj-owner-user" title={user || "Owner account"}>
            <span className="nkj-owner-avatar">{String(user || "O").slice(0, 1).toUpperCase()}</span>
            <span><b>{user || "Owner"}</b><small>Owner account</small></span>
          </div>

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
                {group.items.map(([key, label, to, Icon]) => {
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
                    >
                      <Icon size={18} aria-hidden="true" />
                      <span>{label}</span>
                      <ChevronRight className="nkj-owner-nav-arrow" size={14} aria-hidden="true" />
                    </Link>
                  );
                })}
              </section>
            ))}
          </nav>

          <div className="nkj-owner-sidebar-bottom">
            <Link to="/" className="nkj-owner-public-link" title={sidebarCollapsed ? "Public Home" : undefined}>
              <HomeIcon size={18} /><span>Public Home</span>
            </Link>
            <button type="button" onClick={logout} title={sidebarCollapsed ? "Logout" : undefined}>
              <LogOut size={18} /><span>Logout</span>
            </button>
          </div>
        </aside>

        <header className="nkj-owner-topbar">
          <div className="nkj-owner-top-title">
            <span className="eyebrow">OWNER WORKSPACE</span>
            <b>Nandikishor Jewellery Works</b>
          </div>
          <div className="nkj-owner-top-actions">
            <Link to="/invoice" state={{ startNewInvoice: true }} className="primary"><Plus size={16} /> New Invoice</Link>
            <span className="nkj-owner-top-user"><User size={16} /> {user || "Owner"}</span>
          </div>
        </header>
      </>
    );
  }

  return (
    <header className="topbar">
      <Link to="/" className="brand">
        <div className="logo">NKJ</div>
        <div><b>Nandikishor Jewellery Works</b><small>Sasra, Gopiballavpur, Jhargram</small></div>
      </Link>
      <nav aria-label="Main navigation">
        <Link className={active === "home" ? "active" : ""} to="/"><HomeIcon />Home</Link>
        <Link className={active === "invoice" ? "active" : ""} to="/invoice" state={{ startNewInvoice: true }}><FileText />New Invoice</Link>
        {isAdmin ? <>
          <Link className={active === "saved" ? "active" : ""} to="/saved-invoices"><Files />All Invoices</Link>
          <Link className={active === "dashboard" ? "active" : ""} to="/dashboard"><LayoutDashboard />Dashboard</Link>
          <Link className={active === "profile" ? "active" : ""} to="/profile"><User />Profile</Link>
          <button className="navbtn" onClick={logout}><LogOut />Logout</button>
        </> : <Link className={active === "login" ? "active" : ""} to="/login"><LogIn />Owner Login</Link>}
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
