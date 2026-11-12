import "./ReportsDashboard.css";
import React, { useCallback, useEffect, useState } from "react";
import { BarChart3, TrendingUp, Wallet, Receipt, AlertTriangle } from "lucide-react";
import { Page } from "../../shared/layouts/OwnerShell";
import { money } from "../../shared/utils/formatters";
import { request } from "../../core/api/client";
import { useRealtimeRefresh } from "../../core/realtime/realtime";

function Kpi({ icon: Icon, title, value, note }) {
  return <article className="nkj-report-kpi"><span><Icon size={21}/></span><div><small>{title}</small><strong>₹ {money(value)}</strong><em>{note}</em></div></article>;
}

export default function ReportsDashboard({ type = "overview" }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await request("/admin/reports/summary")); }
    catch (e) { setError(e.message || "Could not load reports."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useRealtimeRefresh(load, ["dashboard", "reports", "cashbook", "transactions", "invoices", "payments", "expenses", "salary", "attendance", "inventory"]);
  const title = type === "sales" ? "Sales Report" : type === "expenses" ? "Expenses Report" : type === "profit" ? "Profit & Loss" : "Reports & Analytics";
  const sales = Number(data?.monthSales || 0);
  const expenses = Number(data?.monthExpenses || 0);
  const max = Math.max(sales, expenses, 1);
  const activeKey = type === "sales" ? "reports-sales" : type === "expenses" ? "reports-expenses" : type === "profit" ? "reports-profit" : "reports-sales";
  return <Page active={activeKey}>
    <section className="nkj-module-page nkj-reports-page">
      <div className="nkj-module-heading"><div><span className="eyebrow">OWNER FINANCE</span><h2>{title}</h2><p>Financial summary from saved invoices and recorded expense entries.</p></div></div>
      {error && <p className="error">{error}</p>}
      {loading ? <div className="panel nkj-report-loading">Loading financial summary…</div> : data && <>
        <div className="nkj-report-kpis">
          {(type === "expenses" ? [
            [Wallet,"Today's expenses",data.todayExpenses,"Today"],[Wallet,"This month",data.monthExpenses,"Month to date"],[Receipt,"Recorded expenses",data.totalExpenses,"All recorded entries"]
          ] : type === "sales" ? [
            [Receipt,"Today's sales",data.todaySales,"Invoices and receipts received today"],[BarChart3,"This month's sales",data.monthSales,"Month-to-date realized sales"],[TrendingUp,"All-time sales",data.totalSales,"Normal invoices and installment receipts"]
          ] : [
            [Receipt,"This month's sales",data.monthSales,"Invoice totals"],[Wallet,"This month's expenses",data.monthExpenses,"Recorded expenses"],[TrendingUp,"Operating result",data.operatingResultBeforeCogs,"Before cost of goods sold"]
          ]).map(([icon,label,value,note])=><Kpi key={label} icon={icon} title={label} value={value} note={note}/>) }
        </div>
        <div className="nkj-report-grid">
          <section className="panel nkj-report-chart"><div className="nkj-panel-head"><h3><BarChart3/> Monthly comparison</h3><span>This month</span></div>
            <div className="nkj-bar-row"><label>Sales</label><div className="nkj-bar-track"><i style={{width:`${sales/max*100}%`}}/></div><b>₹ {money(sales)}</b></div>
            <div className="nkj-bar-row expenses"><label>Expenses</label><div className="nkj-bar-track"><i style={{width:`${expenses/max*100}%`}}/></div><b>₹ {money(expenses)}</b></div>
          </section>
          <section className="panel nkj-report-summary"><h3>Business snapshot</h3><dl><div><dt>Total invoices</dt><dd>{data.invoiceCount}</dd></div><div><dt>Customer records</dt><dd>{data.customerCount}</dd></div><div><dt>Active staff</dt><dd>{data.staffCount}</dd></div><div><dt>Present today</dt><dd>{data.presentToday}</dd></div><div><dt>Open bookings</dt><dd>{data.openBookings}</dd></div></dl></section>
        </div>
        <div className="nkj-report-warning"><AlertTriangle size={18}/><p><b>Accounting note:</b> Operating result is sales minus recorded expenses only. It is not final net profit until purchases, inventory cost of goods sold, returns and all payment allocations are reconciled.</p></div>
      </>}
    </section>
  </Page>;
}
