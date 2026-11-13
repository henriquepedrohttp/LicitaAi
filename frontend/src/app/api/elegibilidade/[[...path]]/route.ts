const uuid = '[0-9a-fA-F-]{36}';
const allowed = new RegExp(`^avaliacoes(?:/${uuid}(?:/relatorio|/itens/${uuid})?)?$`);
const privateHeaders = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const MAX_BODY = 64 * 1024;

async function proxy(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const path = (await context.params).path?.join('/') ?? '';
  if (!allowed.test(path)) return Response.json({ detail: 'Rota indisponível.' }, { status: 404, headers: privateHeaders });
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ') || authorization.length > 1024) return Response.json({ detail: 'Informe a chave de acesso.' }, { status: 401, headers: privateHeaders });
  try {
    let body: string | undefined;
    if (request.method !== 'GET' && request.body) {
      // Leitura incremental: limita o corpo mesmo sem Content-Length.
      const reader = request.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (let part = await reader.read(); !part.done; part = await reader.read()) {
        size += part.value.byteLength;
        if (size > MAX_BODY) { await reader.cancel(); return Response.json({ detail: 'Requisição excede o limite.' }, { status: 413, headers: privateHeaders }); }
        chunks.push(part.value);
      }
      body = Buffer.concat(chunks).toString('utf8');
    }
    const base = process.env.API_BASE_URL ?? 'http://127.0.0.1:8000';
    const response = await fetch(`${base}/api/elegibilidade/${path}`, {
      method: request.method, body, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(60000),
      headers: { authorization, ...(body ? { 'content-type': 'application/json' } : {}) },
    });
    return new Response(response.body, { status: response.status, headers: { ...privateHeaders, 'Content-Type': response.headers.get('content-type') ?? 'application/json' } });
  } catch {
    return Response.json({ detail: 'Não foi possível conectar à Elegibilidade. Verifique o backend e tente novamente.' }, { status: 503, headers: privateHeaders });
  }
}

export { proxy as GET, proxy as POST, proxy as PATCH };
