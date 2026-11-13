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
 return <><div role="status" aria-live="polite"><p>API: {loading ? "verificando…" : status?.api === "ok" ? "conectada" : "indisponível"}<br/>PostgreSQL: {loading ? "verificando…" : status?.database === "connected" ? "conectado" : "conexão não confirmada"}</p></div><button onClick={check} disabled={loading}>Verificar conexão</button></>;
}
