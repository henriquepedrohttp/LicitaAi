import { readLimited } from '../../proxy';
const uuid = '[0-9a-fA-F-]{36}';
const allowed = new RegExp(`^(?:${uuid}(?:/contexto-elegibilidade|/documentos(?:/${uuid}(?:/arquivo)?)?)?)?$`);
const privateHeaders = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };

async function proxy(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const path = (await context.params).path?.join('/') ?? '';
  if (!allowed.test(path)) return Response.json({ detail: 'Rota indisponível.' }, { status: 404, headers: privateHeaders });
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ') || authorization.length > 1024) return Response.json({ detail: 'Informe a chave de acesso.' }, { status: 401, headers: privateHeaders });
  try {
    let body: Uint8Array | undefined;
    if (request.method === 'POST' || request.method === 'PUT') {
      const bytes = await readLimited(request, 10 * 1024 * 1024);
      if (!bytes) return Response.json({ detail: 'Envio excede 10 MiB.' }, { status: 413, headers: privateHeaders });
      body = bytes;
    }
    const headers = new Headers({ authorization });
    for (const name of ['content-type', 'x-document-title']) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    const base = process.env.API_BASE_URL ?? 'http://127.0.0.1:8000';
    const response = await fetch(`${base}/api/empresas${path ? `/${path}` : ''}${new URL(request.url).search}`, {
      method: request.method, headers, body: body as BodyInit | undefined, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(30000),
    });
    const outgoing = new Headers(privateHeaders);
    for (const name of ['content-type', 'content-disposition', 'content-security-policy', 'referrer-policy']) {
      const value = response.headers.get(name);
      if (value) outgoing.set(name, value);
    }
    return new Response(response.body, { status: response.status, headers: outgoing });
  } catch {
    return Response.json({ detail: 'Não foi possível conectar a Empresas. Verifique o backend e tente novamente.' }, { status: 503, headers: privateHeaders });
  }
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as DELETE };
