import "./InstallmentManagementPage.css";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, CreditCard, Plus, RefreshCw, Search, Wallet, Printer, UserRound, ReceiptText } from "lucide-react";
import { Page } from "../../shared/layouts/OwnerShell";
import { money } from "../../shared/utils/formatters";
import { request } from "../../core/api/client";

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const fmtDate = (d) => d ? new Date(`${String(d).slice(0,10)}T00:00:00`).toLocaleDateString("en-IN") : "—";
const addMonths = (date, count, dueDay) => { const d = new Date(`${date}T12:00:00`); d.setDate(1); d.setMonth(d.getMonth()+count); const last = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate(); d.setDate(Math.min(Math.max(1, Number(dueDay) || 1), last)); return d.toISOString().slice(0,10); };

export default function InstallmentManagementPage() {
  const [tab, setTab] = useState("new");
  const [invoices, setInvoices] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [plan, setPlan] = useState({ totalAmount: "", downPayment: "0", count: "6", frequency: "MONTHLY", startDate: today(), dueDay: String(new Date().getDate()) });
  const [receiptForm, setReceiptForm] = useState({ installmentId: "", paymentDate: today(), amount: "", paymentMethod: "Cash", referenceNo: "" });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [inv, bk, sch, pay] = await Promise.all([
        request("/invoices"),
        request("/admin/modules/bookings"),
        request("/admin/modules/installments"),
        request("/admin/modules/installment-payments"),
      ]);
      setInvoices(Array.isArray(inv) ? inv : []); setBookings(Array.isArray(bk) ? bk : []);
      setSchedules(Array.isArray(sch) ? sch : []); setReceipts(Array.isArray(pay) ? pay : []);
    } catch (e) { setError(e.message || "Could not load installment data."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const selectedInvoice = invoices.find(x => String(x.id) === String(invoiceId));
  useEffect(() => {
    if (selectedInvoice) setPlan(p => ({ ...p, totalAmount: String(Number(selectedInvoice.grandTotal || 0)) }));
  }, [invoiceId]);

  const accounts = useMemo(() => {
    return bookings.filter(b => b.invoiceNo).map(b => {
      const rows = schedules.filter(s => Number(s.bookingId) === Number(b.id));
      const total = Number(b.estimatedValue || 0) + Number(b.makingEstimate || 0);
      const outstanding = Number(b.remainingAmount || rows.reduce((a,s)=>a+Number(s.remainingAmount||0),0));
      return { ...b, schedules: rows, total, outstanding, paid: Math.max(0,total-outstanding), paidCount: rows.filter(s=>s.paymentStatus==="PAID").length, count: rows.length };
    }).sort((a,b)=>String(b.bookingDate||"").localeCompare(String(a.bookingDate||"")));
  }, [bookings, schedules]);

  const filteredAccounts = accounts.filter(a => `${a.invoiceNo} ${a.customerName} ${a.mobile}`.toLowerCase().includes(search.toLowerCase()));
  const dueRows = schedules.filter(s => Number(s.remainingAmount||0)>0).sort((a,b)=>String(a.dueDate||"").localeCompare(String(b.dueDate||"")));

  const createPlan = async (e) => {
    e.preventDefault(); setError(""); setMessage("");
    if (!selectedInvoice) { setError("Select an existing invoice first."); return; }
    const total=Number(plan.totalAmount), down=Number(plan.downPayment), count=Number(plan.count);
    if (!Number.isFinite(total)||total<=0||!Number.isFinite(down)||down<0||down>=total||!Number.isInteger(count)||count<1||count>60) { setError("Check total amount, down payment and number of installments. Down payment must be less than invoice total."); return; }
    if (bookings.some(b=>String(b.invoiceNo)===String(selectedInvoice.invoiceNo))) { setError("An installment plan already exists for this invoice."); return; }
    setSaving(true);
    try {
      const remaining=total-down; const base=Math.floor((remaining/count)*100)/100; let allocated=0;
      const schedule=[];
      for (let i=1;i<=count;i++) {
        const amount=i===count?Number((remaining-allocated).toFixed(2)):base; allocated=Number((allocated+amount).toFixed(2));
        const dueDate=plan.frequency==="WEEKLY"?new Date(new Date(`${plan.startDate}T12:00:00`).getTime()+(i-1)*7*86400000).toISOString().slice(0,10):addMonths(plan.startDate,i-1,plan.dueDay);
        schedule.push({ installmentNo:i, dueDate, amountDue:amount, amountPaid:0, remainingAmount:amount, paymentStatus:"DUE" });
      }
      await request("/admin/installments/plans", { method:"POST", body:JSON.stringify({
        invoiceNo:selectedInvoice.invoiceNo,
        booking:{ customerName:selectedInvoice.customerName, mobile:selectedInvoice.mobile||"", bookingDate:today(), description:"Installment plan linked to invoice "+selectedInvoice.invoiceNo, metalType:"GOLD", purity:"", estimatedWeight:0, estimatedRate:0, estimatedValue:total, makingEstimate:0, advanceAmount:down, remainingAmount:remaining, deliveryDate:plan.startDate, status:"OPEN" },
        schedule
      }) });
      setMessage(`Installment account created for invoice ${selectedInvoice.invoiceNo}.`); setInvoiceId(""); setPlan({totalAmount:"",downPayment:"0",count:"6",frequency:"MONTHLY",startDate:today(),dueDay:String(new Date().getDate())}); await load(); setTab("accounts");
    } catch (e2) { setError(e2.message || "Could not create installment plan."); await load(); }
    finally { setSaving(false); }
  };

  const postReceipt = async (e) => {
    e.preventDefault(); setSaving(true); setError(""); setMessage("");
    const schedule=schedules.find(s=>String(s.id)===String(receiptForm.installmentId));
    const amount=Number(receiptForm.amount);
    if (!schedule||!Number.isFinite(amount)||amount<=0||amount>Number(schedule.remainingAmount||0)) { setError("Choose a due installment and enter an amount no greater than its remaining balance."); setSaving(false); return; }
    try {
      await request("/admin/modules/installment-payments", { method:"POST", body:JSON.stringify({ installmentId:Number(receiptForm.installmentId), paymentDate:receiptForm.paymentDate, amount, paymentMethod:receiptForm.paymentMethod, referenceNo:`Installment ${schedule.installmentNo}` }) });
      setMessage(`₹ ${money(amount)} receipt saved against invoice ${schedule.invoiceNo}.`);
      setReceiptForm({ installmentId:"",paymentDate:today(),amount:"",paymentMethod:"Cash",referenceNo:"" });
      await load(); setTab("receipts");
    } catch (e2) { setError(e2.message || "Could not post receipt."); }
    finally { setSaving(false); }
  };

  const startReceipt = (schedule) => { setReceiptForm({ installmentId:String(schedule.id), paymentDate:today(), amount:String(schedule.remainingAmount||""), paymentMethod:"Cash", referenceNo:`Installment ${schedule.installmentNo}` }); setTab("receipts"); };

  const printAccount = (account) => {
    const rows=account.schedules.map(s=>`<tr><td>${s.installmentNo}</td><td>${fmtDate(s.dueDate)}</td><td>₹ ${money(s.amountDue)}</td><td>₹ ${money(s.amountPaid)}</td><td>₹ ${money(s.remainingAmount)}</td><td>${s.paymentStatus}</td></tr>`).join("");
    const html=`<!doctype html><html><head><title>Installment ${account.invoiceNo}</title><style>body{font:14px Arial;padding:28px;color:#241b1b}h1{color:#850d2d}table{border-collapse:collapse;width:100%;margin-top:20px}th,td{border:1px solid #ddd;padding:9px;text-align:left}th{background:#8c0b2e;color:#fff}.sum{margin-top:18px;line-height:1.8}</style></head><body><h1>Nandikishor Jewellery Works</h1><h2>Installment Account Statement</h2><p><b>Invoice:</b> ${account.invoiceNo}<br><b>Customer:</b> ${account.customerName}<br><b>Mobile:</b> ${account.mobile||"—"}</p><table><thead><tr><th>No.</th><th>Due date</th><th>Due</th><th>Paid</th><th>Remaining</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table><div class="sum"><b>Total:</b> ₹ ${money(account.total)}<br><b>Paid:</b> ₹ ${money(account.paid)}<br><b>Outstanding:</b> ₹ ${money(account.outstanding)}</div><script>window.onload=()=>window.print()</script></body></html>`;
    const win=window.open("","_blank","width=900,height=700"); if (!win) { setError("Your browser blocked the print popup. Allow popups for this site and retry."); return; } win.document.write(html); win.document.close();
  };

  return <Page active="installments"><section className="nkj-module-page nkj-installment-page">
    <div className="nkj-module-heading"><div><span className="eyebrow">OWNER WORKSPACE</span><h2>Installment / EMI Management</h2><p>Create and manage customer installment plans linked to existing invoice numbers.</p></div><div className="nkj-module-actions"><button className="secondary" onClick={load} disabled={loading}><RefreshCw size={16}/> Refresh</button><button className="primary" onClick={()=>setTab("new")}><Plus size={16}/> New Installment</button></div></div>
    {error&&<p className="error">{error}</p>}{message&&<p className="success">{message}</p>}
    <div className="nkj-installment-kpis"><div><UserRound/><span>Active Accounts</span><strong>{accounts.filter(a=>a.outstanding>0).length}</strong></div><div><Wallet/><span>Total Outstanding</span><strong>₹ {money(accounts.reduce((a,x)=>a+x.outstanding,0))}</strong></div><div><CheckCircle2/><span>Total Collected</span><strong>₹ {money(accounts.reduce((a,x)=>a+x.paid,0))}</strong></div><div><Clock3/><span>Due Installments</span><strong>{dueRows.length}</strong></div></div>
    <div className="nkj-installment-tabs">{[["new","New Installment"],["accounts","Installment Accounts"],["receipts","Payments / Receipts"],["due","Due & Reminder"]].map(([key,label])=><button key={key} className={tab===key?"active":""} onClick={()=>setTab(key)}>{label}</button>)}</div>
    {tab==="new"&&<form className="nkj-module-form nkj-installment-form" onSubmit={createPlan}><div className="nkj-module-form-head"><h3><ReceiptText size={18}/> Create New Installment</h3></div><div className="nkj-installment-form-grid">
      <section><h4>Customer / Invoice Details</h4><label><span>Select invoice *</span><select value={invoiceId} onChange={e=>setInvoiceId(e.target.value)} required><option value="">Choose saved invoice</option>{invoices.map(i=><option key={i.id} value={i.id}>{i.invoiceNo} · {i.customerName} · ₹ {money(i.grandTotal)}</option>)}</select></label>{selectedInvoice&&<div className="nkj-installment-selected"><b>{selectedInvoice.customerName}</b><span>{selectedInvoice.mobile||"No mobile"}</span><span>Invoice: {selectedInvoice.invoiceNo}</span><span>Invoice date: {fmtDate(selectedInvoice.invoiceDate)}</span></div>}</section>
      <section><h4>Installment Plan</h4><div className="nkj-installment-input-grid"><label><span>Total amount (₹) *</span><input type="number" min="1" step="0.01" value={plan.totalAmount} onChange={e=>setPlan({...plan,totalAmount:e.target.value})} required/></label><label><span>Down payment (₹)</span><input type="number" min="0" step="0.01" value={plan.downPayment} onChange={e=>setPlan({...plan,downPayment:e.target.value})} required/></label><label><span>Number of installments *</span><select value={plan.count} onChange={e=>setPlan({...plan,count:e.target.value})}>{[3,4,6,9,12,15,18,24,36,48,60].map(n=><option key={n} value={n}>{n}</option>)}</select></label><label><span>Frequency</span><select value={plan.frequency} onChange={e=>setPlan({...plan,frequency:e.target.value})}><option value="MONTHLY">Monthly</option><option value="WEEKLY">Weekly</option></select></label><label><span>First due date *</span><input type="date" value={plan.startDate} onChange={e=>setPlan({...plan,startDate:e.target.value})} required/></label><label><span>Due day (monthly)</span><input type="number" min="1" max="31" value={plan.dueDay} onChange={e=>setPlan({...plan,dueDay:e.target.value})}/></label></div><div className="nkj-installment-calculation"><span>Estimated installment amount</span><strong>₹ {money(Number(plan.totalAmount||0)>Number(plan.downPayment||0)?(Number(plan.totalAmount)-Number(plan.downPayment))/Math.max(1,Number(plan.count)):0)}</strong></div></section>
    </div><div className="nkj-module-form-actions"><button type="submit" className="primary" disabled={saving||loading}>{saving?"Creating…":"Save Installment Plan"}</button></div></form>}
    {tab==="accounts"&&<section className="panel nkj-module-table"><div className="nkj-installment-toolbar"><div className="nkj-module-toolbar"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search invoice, customer or mobile"/></div><span>{filteredAccounts.length} accounts</span></div><div className="table-wrap"><table><thead><tr><th>Invoice No.</th><th>Customer</th><th>Installments</th><th>Total (₹)</th><th>Paid (₹)</th><th>Outstanding (₹)</th><th>Progress</th><th>Next Due</th><th>Action</th></tr></thead><tbody>{filteredAccounts.map(a=>{const next=a.schedules.find(s=>Number(s.remainingAmount)>0);const progress=a.total>0?Math.min(100,a.paid/a.total*100):0;return <tr key={a.id}><td><b>{a.invoiceNo}</b></td><td>{a.customerName}<small className="nkj-table-sub">{a.mobile}</small></td><td>{a.paidCount}/{a.count} paid<small className="nkj-table-sub">{Math.max(0,a.count-a.paidCount)} remaining</small></td><td>{money(a.total)}</td><td>{money(a.paid)}</td><td className="nkj-outstanding">{money(a.outstanding)}</td><td><div className="nkj-installment-progress"><i style={{width:`${progress}%`}}/></div><small>{progress.toFixed(0)}%</small></td><td>{next?fmtDate(next.dueDate):"Completed"}</td><td><button className="small-action" onClick={()=>printAccount(a)}><Printer size={14}/> Print</button>{next&&<button className="small-action" onClick={()=>startReceipt(next)}><CreditCard size={14}/> Add payment</button>}</td></tr>})}{!filteredAccounts.length&&<tr><td colSpan="9" className="empty">No installment accounts found. Create one from an existing invoice.</td></tr>}</tbody></table></div></section>}
    {tab==="receipts"&&<div className="nkj-installment-receipt-layout"><form className="nkj-module-form" onSubmit={postReceipt}><h3><Wallet size={18}/> Add money received</h3><label><span>Installment / invoice *</span><select value={receiptForm.installmentId} onChange={e=>setReceiptForm({...receiptForm,installmentId:e.target.value})} required><option value="">Select due installment</option>{dueRows.map(s=><option key={s.id} value={s.id}>{s.invoiceNo} · {s.customerName} · installment {s.installmentNo} · due ₹{money(s.remainingAmount)}</option>)}</select></label><div className="nkj-installment-input-grid"><label><span>Payment date *</span><input type="date" value={receiptForm.paymentDate} onChange={e=>setReceiptForm({...receiptForm,paymentDate:e.target.value})} required/></label><label><span>Amount received (₹) *</span><input type="number" min="0.01" step="0.01" value={receiptForm.amount} onChange={e=>setReceiptForm({...receiptForm,amount:e.target.value})} required/></label><label><span>Payment method</span><select value={receiptForm.paymentMethod} onChange={e=>setReceiptForm({...receiptForm,paymentMethod:e.target.value})}><option>Cash</option><option>UPI</option><option>Bank Transfer</option><option>Card</option><option>Cheque</option></select></label></div><p className="nkj-module-footnote">The receipt is posted against the schedule row and permanently linked to the original invoice number.</p><div className="nkj-module-form-actions"><button className="primary" disabled={saving}>{saving?"Saving receipt…":"Save Receipt"}</button></div></form><section className="panel nkj-notebook-ledger"><h3><ReceiptText size={18}/> Payment Notebook</h3><div className="table-wrap"><table><thead><tr><th>Invoice ID / No.</th><th>Customer</th><th>Date &amp; time</th><th>Amount</th><th>Method</th><th>Entry / reference</th></tr></thead><tbody>{receipts.map(r=><tr key={r.id}><td><b>{r.invoiceNo}</b></td><td>{r.customerName}</td><td>{r.paidAt?new Date(r.paidAt).toLocaleString("en-IN"):fmtDate(r.paymentDate)}</td><td>₹ {money(r.amount)}</td><td>{r.paymentMethod}</td><td>{r.referenceNo === "DOWN PAYMENT" ? <b className="nkj-downpayment-tag">Down payment</b> : (r.referenceNo || "Installment payment")}</td></tr>)}{!receipts.length&&<tr><td colSpan="6" className="empty">No installment receipts posted yet.</td></tr>}</tbody></table></div></section></div>}
    {tab==="due"&&<section className="panel nkj-module-table"><div className="nkj-panel-head"><h3><CalendarDays size={18}/> Due &amp; Reminder Register</h3><span>{dueRows.length} pending installments</span></div><div className="table-wrap"><table><thead><tr><th>Invoice No.</th><th>Customer</th><th>Installment</th><th>Due Date</th><th>Amount Due</th><th>Remaining</th><th>Status</th><th>Action</th></tr></thead><tbody>{dueRows.map(s=><tr key={s.id}><td><b>{s.invoiceNo}</b></td><td>{s.customerName}</td><td>{s.installmentNo}</td><td>{fmtDate(s.dueDate)}</td><td>{money(s.amountDue)}</td><td>{money(s.remainingAmount)}</td><td>{s.dueDate&&s.dueDate<today()?"OVERDUE":s.paymentStatus}</td><td><button className="small-action" onClick={()=>startReceipt(s)}><Plus size={14}/> Receive</button></td></tr>)}{!dueRows.length&&<tr><td colSpan="8" className="empty">No pending installments.</td></tr>}</tbody></table></div></section>}
  </section></Page>;
}
