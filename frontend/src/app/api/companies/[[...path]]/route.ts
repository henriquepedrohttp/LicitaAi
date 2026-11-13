import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path?: string[] }> };
async function proxy(request: Request, context: Context) {
  const { path = [] } = await context.params;
  const uuid = /^[0-9a-f-]{36}$/i;
  const valid = path.length === 0 || (path.length === 1 && path[0] === "demo") || (uuid.test(path[0]) && (
    path.length === 1 ||
    (path.length === 2 && path[1] === "evidence") ||
    (path.length === 3 && path[1] === "evidence" && path[2] === "upload") ||
    (path.length === 3 && ["comparison", "assessments"].includes(path[1]) && uuid.test(path[2])) ||
    (path.length === 4 && path[1] === "evidence" && uuid.test(path[2]) && path[3] === "file")
  ));
  if (!valid) return NextResponse.json({detail:"Rota inválida."},{status:404});
  const limit = 21 * 1024 * 1024;
  try {
    let body: ArrayBuffer | undefined;
    if (["POST", "PATCH"].includes(request.method)) {
      if (Number(request.headers.get("content-length")) > limit) return NextResponse.json({ detail: "O limite é de 20 MB por PDF." }, { status: 413 });
      // Read incrementally to cap the request even without Content-Length.
      const reader = request.body?.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (reader) while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) { await reader.cancel(); return NextResponse.json({ detail: "O limite é de 20 MB por PDF." }, { status: 413 }); }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      body = bytes.buffer;
    }
    const base = process.env.API_BASE_URL ?? "http://127.0.0.1:8000";
    const response = await fetch(`${base}/companies${path.length ? "/" + path.join("/") : ""}`, {
      method: request.method, body, cache: "no-store", signal: AbortSignal.timeout(120000),
      headers: body ? { "Content-Type": request.headers.get("content-type") ?? "application/octet-stream" } : {},
    });
    return new Response(response.body, { status: response.status, headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
      ...(path.at(-1) === "file" ? { "Content-Disposition": 'inline; filename="documento.pdf"' } : {}),
    } });
  } catch {
    return NextResponse.json({ detail: "Não foi possível consultar a API. Verifique o backend e tente novamente." }, { status: 502 });
  }
}
export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
