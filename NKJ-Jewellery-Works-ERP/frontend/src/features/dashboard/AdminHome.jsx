import "./AdminHome.css";
import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarCheck, ChartNoAxesColumn, Eye, Gem, Package,
  Receipt, ShieldCheck, Users, Wallet, UserMinus, Banknote, TrendingUp, Truck
} from "lucide-react";
import { request } from "../../core/api/client";
import { useRealtimeRefresh } from "../../core/realtime/realtime";
import { useAuth } from "../../core/auth/AuthProvider";
import { Page, Stat } from "../../shared/layouts/OwnerShell";
import { money } from "../../shared/utils/formatters";

function displayInvoiceDate(value) {
  const match = String(value || "").match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value || "—";
}

const StatLink = ({ to, ...props }) => <Link to={to} className="nkj-dashboard-stat-link"><Stat {...props} /></Link>;

const initial = { totalInvoices: 0, totalCustomers: 0, todayInvoices: 0, recent: [], staffCount: 0, presentToday: 0, absentToday: 0, openBookings: 0, monthSales: 0, monthExpenses: 0, todaySales: 0, todayExpenses: 0, goldStockQuantity: 0, silverStockQuantity: 0, lowStockCount: 0, bookingOutstanding: 0, supplierOutstanding: 0, monthlySalaryExpense: 0, pendingSalary: 0, operatingResultBeforeCogs: 0 };
export function AdminHome() {
  const { isAdmin } = useAuth();
  const [stats, setStats] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true); setError("");
    try {
      const [dashboard, finance] = await Promise.all([
        request("/admin/dashboard"), request("/admin/reports/summary")
      ]);
      setStats({ ...initial, ...(dashboard || {}), ...(finance || {}) });
    } catch (e) { setError(e.message || "Could not load the owner dashboard."); }
    finally { setLoading(false); }
  }, [isAdmin]);
  useEffect(() => { load(); }, [load]);
  useRealtimeRefresh(load, ["dashboard", "invoices", "transactions", "cashbook", "inventory", "purchases", "expenses", "attendance", "salary", "customers", "bookings", "installments", "staff"]);
  if (!isAdmin) return null;
  const recent = (stats.recent || []).slice(0, 8);
  return <Page active="dashboard">
    <section className="nkj-dashboard nkj-owner-dashboard">
      <div className="nkj-dashboard-heading"><div><span className="eyebrow">OWNER WORKSPACE</span><h2>Business Dashboard</h2><p>Live operational overview for Nandikishor Jewellery Works.</p></div></div>
      {error&&<p className="error">{error}</p>}
      <div className="nkj-stat-grid nkj-owner-kpis">
        <StatLink to="/reports/sales" icon={<Receipt/>} label="Today's Sales" value={loading?"…":"₹ " + money(stats.todaySales)} sub="Invoices and receipts received today"/>
        <Stat icon={<ChartNoAxesColumn/>} label="Monthly Sales" value={loading?"…":"₹ " + money(stats.monthSales)} sub="Month to date"/>
        <StatLink to="/customers" icon={<Users/>} label="Customers" value={loading?"…":stats.customerCount ?? stats.totalCustomers} sub="Customer master records"/>
        <StatLink to="/saved-invoices" icon={<Receipt/>} label="Total Invoices" value={loading?"…":stats.totalInvoices} sub="Saved billing records"/>
        <StatLink to="/inventory" icon={<Gem/>} label="Gold Stock Quantity" value={loading?"…":`${money(stats.goldStockQuantity)} units`} sub="Inventory master quantity"/>
        <StatLink to="/inventory" icon={<Gem/>} label="Silver Stock Quantity" value={loading?"…":`${money(stats.silverStockQuantity)} units`} sub="Inventory master quantity"/>
        <Stat icon={<Package/>} label="Low Stock Items" value={loading?"…":stats.lowStockCount} sub="At or below 2 units"/>
        <Stat icon={<Wallet/>} label="Today's Expenses" value={loading?"…":"₹ " + money(stats.todayExpenses)} sub="Recorded today"/>
        <StatLink to="/expenses" icon={<Wallet/>} label="Monthly Expenses" value={loading?"…":"₹ " + money(stats.monthExpenses)} sub="Month to date"/>
        <Stat icon={<TrendingUp/>} label="Operating Result" value={loading?"…":"₹ " + money(stats.operatingResultBeforeCogs)} sub="Before cost of goods sold"/>
        <StatLink to="/staff" icon={<ShieldCheck/>} label="Active Staff" value={loading?"…":stats.staffCount} sub="Current employees"/>
        <StatLink to="/attendance" icon={<CalendarCheck/>} label="Active Staff Today" value={loading?"…":stats.presentToday} sub="Attendance marked present"/>
        <Stat icon={<UserMinus/>} label="Absent Today" value={loading?"…":stats.absentToday} sub="Attendance marked absent"/>
        <StatLink to="/bookings" icon={<Gem/>} label="Open Bookings" value={loading?"…":stats.openBookings} sub={`Outstanding ₹ ${money(stats.bookingOutstanding)}`}/>
        <Stat icon={<Banknote/>} label="Monthly Salary Expense" value={loading?"…":"₹ " + money(stats.monthlySalaryExpense)} sub="Current payroll month"/>
        <Stat icon={<Wallet/>} label="Pending Salary" value={loading?"…":"₹ " + money(stats.pendingSalary)} sub="Remaining salary payments"/>
        <Stat icon={<Truck/>} label="Supplier Outstanding" value={loading?"…":"₹ " + money(stats.supplierOutstanding)} sub="Purchase balance entries"/>
      </div>
      <section className="nkj-dashboard-lower nkj-dashboard-lower-single">
        <div className="nkj-recent panel"><div className="nkj-panel-head"><h3><Receipt/> Recent Invoices</h3><Link to="/saved-invoices">View All</Link></div>
          <div className="table-wrap"><table><thead><tr><th>Invoice No.</th><th>Customer</th><th>Date</th><th>Payment</th><th>Amount (₹)</th><th>Action</th></tr></thead><tbody>
            {recent.map((row,i)=><tr key={row.id??row.invoiceNo??i}><td>{row.invoiceNo||"—"}</td><td>{row.customerName||"—"}</td><td>{displayInvoiceDate(row.invoiceDate)}</td><td>{row.paymentMode||"—"}</td><td>{money(row.grandTotal)}</td><td><Link className="nkj-view" to={row.id?`/saved-invoices?invoiceId=${row.id}`:"/saved-invoices"}><Eye size={16}/></Link></td></tr>)}
            {!loading&&!recent.length&&<tr><td colSpan="6" className="empty">No invoices have been saved yet.</td></tr>}
            {loading&&<tr><td colSpan="6" className="empty">Loading invoices…</td></tr>}
          </tbody></table></div>
        </div>
      </section>
    </section>
  </Page>;
}
export default AdminHome;
