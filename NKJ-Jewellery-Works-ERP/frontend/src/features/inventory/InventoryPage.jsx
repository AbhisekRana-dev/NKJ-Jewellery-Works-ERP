import "./InventoryPage.css";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Barcode, Camera, Gem, ImagePlus, Package, Pencil, Plus, Save, Search, ShieldCheck, Trash2, X } from "lucide-react";
import { Page } from "../../shared/layouts/OwnerShell";
import { money } from "../../shared/utils/formatters";
import { request } from "../../core/api/client";
import { useRealtimeRefresh } from "../../core/realtime/realtime";

const blank = {
  itemCode:"", barcode:"", name:"", designNo:"", category:"", metalType:"GOLD", purity:"22K (916)",
  itemType:"Ready Stock", hallmarkStatus:"Pending", grossWeight:"", stoneWeight:"0", otherDeductions:"0",
  netWeight:"", makingCharge:"", wastage:"", huid:"", photoUrl:"", purchaseDate:"", purchaseType:"Cash",
  supplierName:"", supplierInvoiceNo:"", supplierMobile:"", purchaseBill:"", purchasePrice:"", stockQuantity:"1",
  reservedQty:"0", storeLocation:"Main Counter", lowStockAlert:"1", status:"IN_STOCK"
};
const numeric = ["grossWeight","stoneWeight","otherDeductions","netWeight","makingCharge","wastage","purchasePrice","stockQuantity","reservedQty","lowStockAlert"];
const safeNumber = v => v === "" || v == null ? null : Number(v);

function Field({ label, value, onChange, type="text", required=false, min, step, children, wide=false }) {
  return <label className={`nkj-inventory-field${wide?" wide":""}`}><span>{label}{required?" *":""}</span>{children || <input type={type} value={value ?? ""} onChange={onChange} required={required} min={min} step={step}/>}</label>;
}
function SelectField({ label, value, onChange, options, required=false }) {
  return <label className="nkj-inventory-field"><span>{label}{required?" *":""}</span><select value={value ?? ""} onChange={onChange} required={required}><option value="">Select</option>{options.map(x=><option key={x} value={x}>{x}</option>)}</select></label>;
}

export default function InventoryPage() {
  const [rows,setRows]=useState([]); const [form,setForm]=useState(blank); const [editingId,setEditingId]=useState(null);
  const [showForm,setShowForm]=useState(false); const [search,setSearch]=useState(""); const [metalFilter,setMetalFilter]=useState("ALL"); const [statusFilter,setStatusFilter]=useState("ALL");
  const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [error,setError]=useState(""); const [message,setMessage]=useState("");
  const load=useCallback(async()=>{setLoading(true);setError("");try{const data=await request("/admin/modules/inventory");setRows(Array.isArray(data)?data:[]);}catch(e){setError(e.message||"Could not load jewellery inventory.");}finally{setLoading(false);}},[]);
  useEffect(()=>{load();},[load]);
  useRealtimeRefresh(load, ["inventory", "stock", "purchases", "invoices", "dashboard"]);
  const filtered=useMemo(()=>rows.filter(x=>`${x.itemCode||""} ${x.barcode||""} ${x.name||""} ${x.designNo||""} ${x.huid||""}`.toLowerCase().includes(search.toLowerCase())&&(metalFilter==="ALL"||String(x.metalType).toUpperCase()===metalFilter)&&(statusFilter==="ALL"||String(x.status).toUpperCase()===statusFilter)),[rows,search,metalFilter,statusFilter]);
  const stats=useMemo(()=>({total:rows.length,gold:rows.filter(x=>String(x.metalType).toUpperCase()==="GOLD").length,silver:rows.filter(x=>String(x.metalType).toUpperCase()==="SILVER").length,inStock:rows.filter(x=>String(x.status).toUpperCase()==="IN_STOCK").length}),[rows]);
  const openNew=()=>{setEditingId(null);setForm({...blank});setShowForm(true);setError("");setMessage("");};
  const openEdit=row=>{setEditingId(row.id);setForm({...blank,...row});setShowForm(true);setError("");setMessage("");};
  const update=(key,value)=>setForm(current=>{
    const next={...current,[key]:value};
    if(["grossWeight","stoneWeight","otherDeductions"].includes(key)) next.netWeight=String(Math.max(0,Number(next.grossWeight||0)-Number(next.stoneWeight||0)-Number(next.otherDeductions||0)).toFixed(3));
    return next;
  });
  const upload= (key, file) => {
    if(!file)return;
    const isBill=key==="purchaseBill", max=isBill?5*1024*1024:2*1024*1024;
    if(isBill && !(file.type.startsWith("image/")||file.type==="application/pdf")){setError("Purchase bill must be an image or PDF.");return;}
    if(!isBill&&!file.type.startsWith("image/")){setError("Choose an image file for jewellery photos.");return;}
    if(file.size>max){setError(isBill?"Purchase bill must be 5 MB or smaller.":"Jewellery photo must be 2 MB or smaller.");return;}
    const reader=new FileReader();reader.onload=()=>update(key,String(reader.result||""));reader.readAsDataURL(file);
  };
  const save=async e=>{e.preventDefault();setSaving(true);setError("");setMessage("");try{
    const payload={...form}; numeric.forEach(k=>payload[k]=safeNumber(payload[k]));
    if(payload.netWeight==null) payload.netWeight=Math.max(0,Number(payload.grossWeight||0)-Number(payload.stoneWeight||0)-Number(payload.otherDeductions||0));
    await request(editingId?`/admin/modules/inventory/${editingId}`:"/admin/modules/inventory",{method:editingId?"PUT":"POST",body:JSON.stringify(payload)});
    setMessage(editingId?"Jewellery item updated.":"Jewellery item added to inventory.");setShowForm(false);setForm(blank);setEditingId(null);await load();
  }catch(e2){setError(e2.message||"Could not save inventory item.");}finally{setSaving(false);}};
  const remove=async row=>{if(!window.confirm(`Delete ${row.name||"this item"} (${row.itemCode||row.id}) from inventory?`))return;setError("");setMessage("");try{await request(`/admin/modules/inventory/${row.id}`,{method:"DELETE"});setMessage("Inventory item deleted.");await load();}catch(e){setError(e.message||"Could not delete item.");}};

  return <Page active="inventory"><section className="nkj-module-page nkj-inventory-page">
    <div className="nkj-module-heading"><div><span className="eyebrow">INVENTORY CONTROL</span><h2>Jewellery Inventory</h2><p>Manage jewellery identity, purity, weights, pricing, supplier documents and available stock.</p></div><div className="nkj-module-actions"><Link className="secondary" to="/stock-movements"><ArrowLeft size={16}/> Stock Movements</Link><button className="primary" onClick={openNew}><Plus size={16}/> Add New Jewellery Item</button></div></div>
    {error&&<p className="error">{error}</p>}{message&&<p className="success">{message}</p>}
    <div className="nkj-inventory-kpis"><div><Package/><span>Total Items</span><strong>{stats.total}</strong></div><div><Gem/><span>Gold Items</span><strong>{stats.gold}</strong></div><div><Gem/><span>Silver Items</span><strong>{stats.silver}</strong></div><div><ShieldCheck/><span>In Stock</span><strong>{stats.inStock}</strong></div></div>
    {showForm&&<form className="nkj-inventory-editor" onSubmit={save}>
      <div className="nkj-inventory-editor-head"><div><span className="eyebrow">JEWELLERY MASTER</span><h3>{editingId?"Edit Jewellery Item":"Add New Jewellery Item"}</h3><p>Enter item details accurately. Net metal weight is calculated from gross weight less deductions.</p></div><button type="button" className="icon-btn" onClick={()=>setShowForm(false)} aria-label="Close form"><X/></button></div>
      <div className="nkj-inventory-editor-grid">
        <div className="nkj-inventory-form-column">
          <section className="nkj-inventory-section"><h4><span>1</span> Basic Information</h4><div className="nkj-inventory-fields"><Field label="Item Code" value={form.itemCode} onChange={e=>update("itemCode",e.target.value)}/><Field label="Barcode" value={form.barcode} onChange={e=>update("barcode",e.target.value)}/><Field label="Ornament Name" value={form.name} onChange={e=>update("name",e.target.value)} required/><Field label="Design No." value={form.designNo} onChange={e=>update("designNo",e.target.value)}/><SelectField label="Category" value={form.category} onChange={e=>update("category",e.target.value)} options={["Necklace","Chain","Ring","Bangle","Earring","Coin / Bar","Other"]}/><Field label="HUID No." value={form.huid} onChange={e=>update("huid",e.target.value)}/></div></section>
          <section className="nkj-inventory-section"><h4><span>2</span> Metal &amp; Purity Details</h4><div className="nkj-inventory-fields"><SelectField label="Metal Type" value={form.metalType} onChange={e=>update("metalType",e.target.value)} options={["GOLD","SILVER","DIAMOND","OTHER"]} required/><Field label="Purity" value={form.purity} onChange={e=>update("purity",e.target.value)}/><SelectField label="Item Type" value={form.itemType} onChange={e=>update("itemType",e.target.value)} options={["Ready Stock","Customer Order","Repair","Exchange"]}/><SelectField label="Hallmark Status" value={form.hallmarkStatus} onChange={e=>update("hallmarkStatus",e.target.value)} options={["Hallmarked","Not Hallmarked","Pending"]}/></div></section>
          <section className="nkj-inventory-section"><h4><span>3</span> Weight &amp; Pricing Details</h4><div className="nkj-inventory-fields"><Field label="Gross Weight (g)" type="number" min="0" step="0.001" value={form.grossWeight} onChange={e=>update("grossWeight",e.target.value)}/><Field label="Stone Weight (g)" type="number" min="0" step="0.001" value={form.stoneWeight} onChange={e=>update("stoneWeight",e.target.value)}/><Field label="Other Deductions (g)" type="number" min="0" step="0.001" value={form.otherDeductions} onChange={e=>update("otherDeductions",e.target.value)}/><Field label="Net Metal Weight (g)" type="number" min="0" step="0.001" value={form.netWeight} onChange={e=>update("netWeight",e.target.value)}/><Field label="Making Charge (₹)" type="number" min="0" step="0.01" value={form.makingCharge} onChange={e=>update("makingCharge",e.target.value)}/><Field label="Wastage (g)" type="number" min="0" step="0.001" value={form.wastage} onChange={e=>update("wastage",e.target.value)}/><Field label="Purchase Price (₹)" type="number" min="0" step="0.01" value={form.purchasePrice} onChange={e=>update("purchasePrice",e.target.value)}/><Field label="Purchase Date" type="date" value={form.purchaseDate} onChange={e=>update("purchaseDate",e.target.value)}/></div><p className="nkj-inventory-formula">Net metal weight = Gross weight − Stone weight − Other deductions</p></section>
        </div>
        <div className="nkj-inventory-form-column">
          <section className="nkj-inventory-section"><h4><ImagePlus/> Jewellery Image</h4><div className="nkj-inventory-photo-area">{form.photoUrl?<img src={form.photoUrl} alt="Jewellery preview"/>:<div className="nkj-inventory-photo-placeholder"><Camera size={30}/><b>Upload jewellery image</b><small>JPG / PNG · Max 2 MB</small></div>}<label className="nkj-inventory-upload"><input type="file" accept="image/*" onChange={e=>upload("photoUrl",e.target.files?.[0])}/>Choose Image</label>{form.photoUrl&&<button type="button" className="small-action" onClick={()=>update("photoUrl","")}>Remove image</button>}</div></section>
          <section className="nkj-inventory-section"><h4><span>4</span> Supplier &amp; Purchase Details</h4><div className="nkj-inventory-fields"><Field label="Supplier Name" value={form.supplierName} onChange={e=>update("supplierName",e.target.value)}/><Field label="Supplier Invoice No." value={form.supplierInvoiceNo} onChange={e=>update("supplierInvoiceNo",e.target.value)}/><Field label="Supplier Mobile" value={form.supplierMobile} onChange={e=>update("supplierMobile",e.target.value)}/><SelectField label="Purchase Type" value={form.purchaseType} onChange={e=>update("purchaseType",e.target.value)} options={["Cash","Credit"]}/><Field label="Purchase Bill (image/PDF)" wide><input type="file" accept="image/*,.pdf,application/pdf" onChange={e=>upload("purchaseBill",e.target.files?.[0])}/></Field>{form.purchaseBill&&<div className="nkj-inventory-file-present">Purchase bill attached <button type="button" onClick={()=>update("purchaseBill","")}>Remove</button></div>}</div></section>
          <section className="nkj-inventory-section"><h4><span>5</span> Stock Management</h4><div className="nkj-inventory-fields"><Field label="Stock Quantity" type="number" min="0" step="0.001" value={form.stockQuantity} onChange={e=>update("stockQuantity",e.target.value)}/><Field label="Reserved Quantity" type="number" min="0" step="0.001" value={form.reservedQty} onChange={e=>update("reservedQty",e.target.value)}/><Field label="Low Stock Alert" type="number" min="0" step="0.001" value={form.lowStockAlert} onChange={e=>update("lowStockAlert",e.target.value)}/><Field label="Store / Location" value={form.storeLocation} onChange={e=>update("storeLocation",e.target.value)}/><SelectField label="Stock Status" value={form.status} onChange={e=>update("status",e.target.value)} options={["IN_STOCK","RESERVED","OUT_OF_STOCK","DAMAGED"]}/></div></section>
        </div>
      </div>
      <div className="nkj-inventory-editor-actions"><button type="button" className="secondary" onClick={()=>{setShowForm(false);setEditingId(null);}}>Cancel</button><button type="submit" className="primary" disabled={saving}><Save size={16}/>{saving?"Saving…":"Save Item"}</button></div>
    </form>}
    <section className="panel nkj-inventory-table"><div className="nkj-inventory-table-head"><h3>Jewellery Stock Register</h3><div className="nkj-inventory-filters"><label className="nkj-module-toolbar"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search item, code, barcode or HUID"/></label><select value={metalFilter} onChange={e=>setMetalFilter(e.target.value)}><option value="ALL">Metal: All</option><option value="GOLD">Gold</option><option value="SILVER">Silver</option><option value="DIAMOND">Diamond</option></select><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="ALL">Status: All</option><option value="IN_STOCK">In Stock</option><option value="RESERVED">Reserved</option><option value="OUT_OF_STOCK">Out of Stock</option><option value="DAMAGED">Damaged</option></select></div></div><div className="table-wrap"><table><thead><tr><th>Image</th><th>Item Code</th><th>Ornament</th><th>Metal</th><th>Purity</th><th>Net wt. (g)</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.map(row=><tr key={row.id}><td>{row.photoUrl?<img className="nkj-inventory-thumb" src={row.photoUrl} alt=""/>:<Gem size={18}/>}</td><td><b>{row.itemCode||`NKJ-ITM-${String(row.id).padStart(6,"0")}`}</b></td><td>{row.name}<small className="nkj-table-sub">{row.designNo||row.category||""}</small></td><td>{row.metalType}</td><td>{row.purity||"—"}</td><td>{Number(row.netWeight||0).toFixed(3)}</td><td>{Number(row.stockQuantity||0)} <small className="nkj-table-sub">Reserved {Number(row.reservedQty||0)}</small></td><td><span className={`nkj-status-pill ${String(row.status).toLowerCase()}`}>{String(row.status||"").replaceAll("_"," ")}</span></td><td><button className="small-action" onClick={()=>openEdit(row)}><Pencil size={14}/> Edit</button><button className="small-action nkj-delete-action" onClick={()=>remove(row)}><Trash2 size={14}/> Delete</button></td></tr>)}{!loading&&!filtered.length&&<tr><td colSpan="9" className="empty">No jewellery items found.</td></tr>}{loading&&<tr><td colSpan="9" className="empty">Loading inventory…</td></tr>}</tbody></table></div></section>
  </section></Page>;
}
