import "./AdminToolsPage.css";
import React, { useEffect, useState } from "react";
import { Database, ShieldCheck, HardDrive } from "lucide-react";
import { Page } from "../../shared/layouts/OwnerShell";
import { request } from "../../core/api/client";
import ErpModulePage from "./ErpModulePage";

function DatabaseStatus() {
  const [status,setStatus] = useState(null); const [error,setError] = useState(""); const [loading,setLoading] = useState(true);
  const load = async()=>{setLoading(true);setError("");try{setStatus(await request("/admin/database/status"));}catch(e){setError(e.message);}finally{setLoading(false);}};
  useEffect(()=>{load();},[]);
  return <Page active="database"><section className="nkj-module-page"><div className="nkj-module-heading"><div><span className="eyebrow">SYSTEM ADMINISTRATION</span><h2>Database Management</h2><p>Connection and schema health for your local PostgreSQL database.</p></div></div>{error&&<p className="error">{error}</p>}{status&&<div className="nkj-db-grid"><div className="panel"><Database/><small>Connection</small><strong>{status.connected?"Connected":"Unavailable"}</strong></div><div className="panel"><HardDrive/><small>Database</small><strong>{status.database}</strong></div><div className="panel"><ShieldCheck/><small>Version</small><strong>{status.version}</strong></div><div className="panel"><Database/><small>Tables</small><strong>{status.tableCount}</strong></div><div className="panel"><HardDrive/><small>Database size</small><strong>{status.size}</strong></div></div>}<p className="nkj-module-footnote">This page does not expose unrestricted SQL access. Make a verified backup before any manual database restore. Automated encrypted local/Drive backup must be configured separately.</p></section></Page>;
}

export function AuditLogsPage(){return <ErpModulePage module="audit-logs"/>;}
export function BackupHistoryPage(){return <ErpModulePage module="backup-history"/>;}
export default DatabaseStatus;
