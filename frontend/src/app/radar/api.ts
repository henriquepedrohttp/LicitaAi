import "server-only";
export class RadarError extends Error {}
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
function timestamp(value: unknown) { return typeof value === "string" && Number.isFinite(Date.parse(value)); }
function officialUrl(value: unknown) {
  if (typeof value !== "string") return false;
  try { const url = new URL(value); return url.protocol === "https:" && url.hostname === "pncp.gov.br" && !url.username && !url.password && (!url.port || url.port === "443"); }
  catch { return false; }
}
function opportunity(value: unknown) {
  return record(value) && typeof value.id === "string" && /^[0-9]{14}-1-[0-9]{6}\/[0-9]{4}$/.test(value.id)
    && typeof value.ano === "number" && typeof value.cnpj === "string" && timestamp(value.consultado_em)
    && officialUrl(value.url_oficial) && officialUrl(value.url_api)
    && ["objeto", "orgao", "municipio", "uf", "modalidade", "numero", "situacao", "criterio_julgamento"].every(key => value[key] === null || typeof value[key] === "string")
    && ["publicado_em", "abertura_em", "encerramento_em", "atualizado_em"].every(key => value[key] === null || timestamp(value[key]))
    && (value.valor_estimado === null || typeof value.valor_estimado === "string" && Number.isFinite(Number(value.valor_estimado)));
}
export async function radarGet<T>(path: string): Promise<T> {
  const base = process.env.API_BASE_URL ?? "http://127.0.0.1:8000";
  const started = Date.now();
  let response: Response;
  try { response = await fetch(`${base}/api/radar/${path}`, { cache: "no-store", signal: AbortSignal.timeout(90000) }); }
  catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) throw new RadarError("A consulta demorou além do esperado. Reduza o período da pesquisa e tente novamente.");
    throw new RadarError("Não foi possível conectar ao Radar. Verifique se o backend está disponível e tente novamente.");
  }
  if (!response.ok) {
    console.warn(`[Radar] Consulta falhou ${JSON.stringify({ status: response.status, duracao_ms: Date.now() - started })}`);
    const messages: Record<number, string> = {
      404: "Esta oportunidade está indisponível no PNCP.",
      422: "Confira os filtros: datas válidas, período de até 90 dias, município IBGE com 7 dígitos e valores em ordem crescente.",
      502: "O PNCP retornou uma falha ou dados em formato inesperado. Tente novamente em instantes.",
      503: "O PNCP está temporariamente indisponível. Tente novamente em instantes.",
      504: "O PNCP não respondeu a tempo. Reduza o período da pesquisa ou tente novamente em instantes.",
    };
    throw new RadarError(messages[response.status] ?? "Não foi possível concluir a consulta. Tente novamente.");
  }
  const diagnostico = response.headers?.get("content-type")?.includes("text/html") ? response.clone() : undefined;
  let etapa = "decodificação JSON";
  let formato: Record<string, string> = {};
  try {
    const payload: unknown = await response.json();
    etapa = "objeto principal";
    if (!record(payload)) throw new Error();
    formato = Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, value === null ? "null" : Array.isArray(value) ? "array" : typeof value]));
    if (path.startsWith("oportunidades?")) {
      etapa = "lista de oportunidades";
      if (!Array.isArray(payload.oportunidades)) throw new Error();
      for (let index = 0; index < payload.oportunidades.length; index++) {
        etapa = `oportunidades[${index}]`;
        if (!opportunity(payload.oportunidades[index])) {
          const item = payload.oportunidades[index];
          if (record(item)) formato = Object.fromEntries(Object.entries(item).map(([key, value]) => [key, value === null ? "null" : typeof value]));
          throw new Error();
        }
      }
      etapa = "consultado_em";
      if (!timestamp(payload.consultado_em)) throw new Error();
      for (const key of ["total_fonte", "total_paginas", "pagina", "registros_na_pagina"]) {
        etapa = key;
        if (!Number.isInteger(payload[key]) || Number(payload[key]) < 0) throw new Error();
      }
    } else {
      etapa = "detalhe/documentos";
      if (!opportunity(payload.oportunidade) || !Array.isArray(payload.avisos) || !payload.avisos.every(value => typeof value === "string")
      || !Array.isArray(payload.documentos) || !payload.documentos.every(doc => record(doc) && Number.isInteger(doc.id) && officialUrl(doc.url)
        && ["titulo", "tipo"].every(key => doc[key] === null || typeof doc[key] === "string") && (doc.publicado_em === null || timestamp(doc.publicado_em)))
      || !Number.isInteger(payload.documentos_pagina) || typeof payload.documentos_proxima_pagina !== "boolean"
      || (payload.documentos_consultados_em !== null && !timestamp(payload.documentos_consultados_em))) throw new Error();
    }
    console.info(`[Radar] Consulta concluída ${JSON.stringify({ duracao_ms: Date.now() - started, registros: Array.isArray(payload.oportunidades) ? payload.oportunidades.length : undefined })}`);
    return payload as T;
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) throw new RadarError("A consulta demorou além do esperado. Reduza o período da pesquisa e tente novamente.");
    const html = response.headers?.get("content-type")?.includes("text/html");
    const titulo = html ? ((await diagnostico?.text().catch(() => "")) ?? "").match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.slice(0, 120) : undefined;
    console.error(`[Radar] Resposta do backend incompatível ${JSON.stringify({ etapa, status: response.status, tipo: response.headers?.get("content-type"), origem: new URL(base).origin, destino: response.url ? new URL(response.url).origin : undefined, redirecionado: response.redirected, titulo, formato })}`);
    if (html) throw new RadarError("O serviço do Radar devolveu uma página web em vez dos dados. Verifique a conexão com o backend.");
    throw new RadarError("O Radar retornou uma resposta inválida. Tente novamente.");
  }
}
