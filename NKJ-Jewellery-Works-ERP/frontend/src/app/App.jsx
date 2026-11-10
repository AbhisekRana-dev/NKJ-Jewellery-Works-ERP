import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../core/auth/AuthProvider";
import Footer from "../shared/layouts/Footer";
import Profile from "../features/profile/Profile";
import { Home } from "../features/home/Home";
import { AdminHome } from "../features/dashboard/AdminHome";
import { InvoicePage, SavedInvoices } from "../features/invoices/InvoicePages";
import { Login, TotpSetup } from "../features/auth/AuthPages";
import Customers from "../features/customers/Customers";
import ErpModulePage from "../features/admin/ErpModulePage";
import ReportsDashboard from "../features/reports/ReportsDashboard";
import DatabaseStatus, { AuditLogsPage } from "../features/admin/AdminToolsPage";
import MetalRatesPage from "../features/rates/MetalRatesPage";
import InstallmentManagementPage from "../features/installments/InstallmentManagementPage";
import StaffDetailsPage from "../features/staff/StaffDetailsPage";
import InventoryPage from "../features/inventory/InventoryPage";
import KarigarsPage from "../features/karigars/KarigarsPage";
import CalculatorPage from "../features/calculator/CalculatorPage";
import JewelleryDesignsPage from "../features/designs/JewelleryDesignsPage";

function Guard({ children }) {
  const { isAdmin, authReady } = useAuth();
  const location = useLocation();
  if (!authReady) return <div className="auth-loading" role="status">Verifying administrator session…</div>;
  return isAdmin ? children : <Navigate to="/login" state={{ from: location }} replace />;
}

function OwnerOnly({ children }) {
  return <Guard>{children}</Guard>;
}

export default function App() {

  return (
    <div className="app-layout">
      <div className="app-content">
        <Routes>
          {/* Public access: Home, Jewellery Designs, Calculator and New Invoice. */}
          <Route path="/" element={<Home />} />
          <Route path="/invoice" element={<InvoicePage />} />
          <Route path="/designs" element={<JewelleryDesignsPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/setup-totp" element={<TotpSetup />} />

          {/* Owner workspace: every route below requires password + TOTP login. */}
          <Route path="/dashboard" element={<OwnerOnly><AdminHome /></OwnerOnly>} />
          <Route path="/saved-invoices" element={<OwnerOnly><SavedInvoices /></OwnerOnly>} />
          <Route path="/customers" element={<OwnerOnly><Customers /></OwnerOnly>} />
          <Route path="/profile" element={<OwnerOnly><Profile /></OwnerOnly>} />
          <Route path="/calculator" element={<CalculatorPage />} />
          <Route path="/rates" element={<OwnerOnly><MetalRatesPage /></OwnerOnly>} />

          <Route path="/inventory" element={<OwnerOnly><InventoryPage /></OwnerOnly>} />
          <Route path="/stock-movements" element={<OwnerOnly><ErpModulePage module="stock-movements" /></OwnerOnly>} />
          <Route path="/staff" element={<OwnerOnly><StaffDetailsPage /></OwnerOnly>} />
          <Route path="/attendance" element={<OwnerOnly><ErpModulePage module="attendance" /></OwnerOnly>} />
          <Route path="/salary" element={<OwnerOnly><ErpModulePage module="salary" /></OwnerOnly>} />
          <Route path="/salary-payments" element={<OwnerOnly><ErpModulePage module="salary-payments" /></OwnerOnly>} />
          <Route path="/leaves" element={<OwnerOnly><ErpModulePage module="leaves" /></OwnerOnly>} />
          <Route path="/expenses" element={<OwnerOnly><ErpModulePage module="expenses" /></OwnerOnly>} />
          <Route path="/bookings" element={<OwnerOnly><ErpModulePage module="bookings" /></OwnerOnly>} />
          <Route path="/installments" element={<OwnerOnly><InstallmentManagementPage /></OwnerOnly>} />
          <Route path="/installment-payments" element={<OwnerOnly><Navigate to="/installments" replace /></OwnerOnly>} />
          <Route path="/suppliers" element={<OwnerOnly><ErpModulePage module="suppliers" /></OwnerOnly>} />
          <Route path="/purchases" element={<OwnerOnly><ErpModulePage module="purchases" /></OwnerOnly>} />
          <Route path="/payments" element={<OwnerOnly><ErpModulePage module="payments" /></OwnerOnly>} />
          <Route path="/old-gold" element={<OwnerOnly><ErpModulePage module="old-gold" /></OwnerOnly>} />
          <Route path="/karigars" element={<OwnerOnly><KarigarsPage /></OwnerOnly>} />
          <Route path="/repairs" element={<OwnerOnly><ErpModulePage module="repairs" /></OwnerOnly>} />

          <Route path="/reports" element={<OwnerOnly><ReportsDashboard /></OwnerOnly>} />
          <Route path="/reports/sales" element={<OwnerOnly><ReportsDashboard type="sales" /></OwnerOnly>} />
          <Route path="/reports/profit" element={<OwnerOnly><ReportsDashboard type="profit" /></OwnerOnly>} />
          <Route path="/reports/expenses" element={<OwnerOnly><ReportsDashboard type="expenses" /></OwnerOnly>} />
          <Route path="/database" element={<OwnerOnly><DatabaseStatus /></OwnerOnly>} />
          <Route path="/audit-logs" element={<OwnerOnly><AuditLogsPage /></OwnerOnly>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <Footer />
    </div>
  );
}
