import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET(){
 const base = process.env.API_BASE_URL ?? "http://127.0.0.1:8000";
 try {
  const health = await fetch(`${base}/health`,{cache:"no-store",signal:AbortSignal.timeout(5000)});
  if(!health.ok)throw new Error("API unavailable");
  let database="unreachable";
  try {const ready = await fetch(`${base}/health/ready`,{cache:"no-store",signal:AbortSignal.timeout(5000)}); const result=await ready.json();if(ready.ok && result.database === "connected")database="connected";}catch{}
  return NextResponse.json({api:"ok",database});
 }catch{return NextResponse.json({api:"unavailable",database:"unknown"});}
}
