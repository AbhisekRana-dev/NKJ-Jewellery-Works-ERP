import "./OwnerShell.css";
import React, { useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Home as HomeIcon, FileText, Files, Users, User, ChartNoAxesColumn,
  LogOut, LogIn, Plus, Receipt, LayoutDashboard, Boxes, Coins, Contact,
  Wallet, CalendarCheck, ClipboardList, Banknote, Database, ScrollText,
  Wrench, ChevronRight, ArrowLeftRight, Calculator as CalculatorIcon, Gem,
} from "lucide-react";
import { useAuth } from "../../core/auth/AuthProvider";

const SIDEBAR_STORAGE_KEY = "nkj-owner-sidebar-collapsed";
const SIDEBAR_SCROLL_KEY = "nkj-owner-sidebar-scroll";
const SIDEBAR_NAV_CLICK_KEY = "nkj-owner-sidebar-nav-last-click";
const SIDEBAR_DOUBLE_CLICK_MS = 450;

function initialSidebarState() {
  try {
    const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (saved !== null) return saved === "true";
    return window.matchMedia?.("(max-width: 1100px)").matches ?? false;
  } catch {
    return false;
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
  const sidebarNavRef = useRef(null);
  const ownerWorkspace = isAdmin && active !== "login";

  const persistSidebarState = (collapsed) => {
    try {
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
            onClick={handleSidebarToggle}
          >
            <ChevronRight size={18} />
          </button>

          <Link to="/" className="nkj-owner-brand" aria-label="Nandikishor Jewellery Works home">
            <span className="nkj-owner-logo">NKJ</span>
            <span className="nkj-owner-brand-copy">
              <b>Nandikishor</b>
              <small>Jewellery Works</small>
            </span>
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
                      onClick={() => handleSidebarNavigationClick(key)}
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

        <header className="nkj-owner-topbar">
          <div className="nkj-owner-top-title">
            <span className="eyebrow">OWNER WORKSPACE</span>
            <b>Nandikishor Jewellery Works</b>
          </div>
          <div className="nkj-owner-top-actions">
            <Link to="/" className="nkj-calculator-link nkj-home-link" aria-label="Open home">
              <HomeIcon size={17} /> <span>Home</span>
            </Link>
            <Link to="/designs" className="nkj-calculator-link nkj-designs-link" aria-label="Open jewellery designs">
              <Gem size={17} /> <span>Jewellery Designs</span>
            </Link>
            <Link to="/calculator" className="nkj-calculator-link" aria-label="Open calculator">
              <CalculatorIcon size={17} /> <span>Calculator</span>
            </Link>
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
        <Link className={active === "designs" ? "active" : ""} to="/designs"><Gem />Jewellery Designs</Link>
        <Link className={active === "calculator" ? "active" : ""} to="/calculator"><CalculatorIcon />Calculator</Link>
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
