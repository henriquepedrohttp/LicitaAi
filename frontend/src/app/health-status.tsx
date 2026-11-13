"use client";
import { useEffect, useState } from "react";
type Status = { api: string; database: string };
export default function HealthStatus(){
 const [status,setStatus]=useState<Status | null>(null);
 const [loading,setLoading]=useState(true);
 async function check(){setLoading(true);try{const response=await fetch("/api/health",{cache:"no-store"});if(!response.ok)throw new Error();setStatus(await response.json());}catch{setStatus({api:"unavailable",database:"unknown"});}finally{setLoading(false);}}
 useEffect(()=>{
 const controller = new AbortController();
 fetch("/api/health", {cache:"no-store",signal:controller.signal})
  .then(response=>{if(!response.ok)throw new Error();return response.json();})
  .then(result=>setStatus(result))
  .catch(()=>{if(!controller.signal.aborted)setStatus({api:"unavailable",database:"unknown"});})
  .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
 return ()=>controller.abort();
 },[]);
 const chip=(ok:boolean,yes:string,no:string)=>loading?<span className="chip">Verificando…</span>:<span className={ok?"chip ok":"chip danger"}>{ok?yes:no}</span>;
 return <><ul className="status-list" role="status" aria-live="polite">
  <li>Servidor{chip(status?.api==="ok","Conectado","Indisponível")}</li>
  <li>Banco de dados{chip(status?.database==="connected","Conectado","Não confirmado")}</li>
 </ul><button className="secondary" style={{marginLeft:0}} onClick={check} disabled={loading}>{loading&&<span className="spinner" aria-hidden="true"/>}Verificar de novo</button></>;
}
