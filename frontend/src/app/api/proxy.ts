import { NextResponse } from "next/server";

/** Lê o corpo incrementalmente, limitando o tamanho mesmo sem Content-Length. Retorna null se exceder `limit`. */
export async function readLimited(request: Request, limit: number): Promise<Uint8Array | null> {
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) for (let part = await reader.read(); !part.done; part = await reader.read()) {
    size += part.value.byteLength;
    if (size > limit) { await reader.cancel(); return null; }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

type Context = { params: Promise<{ path?: string[] }> };
const PDF_LIMIT = 21 * 1024 * 1024;

/** Proxy público (sem chave) para rotas do backend sob `prefix`, aceitando PDFs de até 20 MB. */
export function backendProxy(prefix: string, valid: (path: string[]) => boolean) {
  return async function proxy(request: Request, context: Context) {
    const { path = [] } = await context.params;
    if (!valid(path)) return NextResponse.json({ detail: "Rota inválida." }, { status: 404 });
    const tooLarge = () => NextResponse.json({ detail: "O limite é de 20 MB por PDF." }, { status: 413 });
    try {
      let body: Uint8Array | undefined;
      if (["POST", "PATCH"].includes(request.method)) {
        if (Number(request.headers.get("content-length")) > PDF_LIMIT) return tooLarge();
        const bytes = await readLimited(request, PDF_LIMIT);
        if (!bytes) return tooLarge();
        body = bytes;
      }
      const base = process.env.API_BASE_URL ?? "http://127.0.0.1:8000";
      const response = await fetch(`${base}/${prefix}${path.length ? "/" + path.join("/") : ""}`, {
        method: request.method, body: body as BodyInit | undefined, cache: "no-store", signal: AbortSignal.timeout(120000),
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
  };
}
