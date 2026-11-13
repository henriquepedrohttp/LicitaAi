export type SearchParams = Record<string, string | string[] | undefined>;
export const modalities = ["Leilão - Eletrônico", "Diálogo Competitivo", "Concurso", "Concorrência - Eletrônica", "Concorrência - Presencial", "Pregão - Eletrônico", "Pregão - Presencial", "Dispensa de Licitação", "Inexigibilidade", "Manifestação de Interesse", "Pré-qualificação", "Credenciamento", "Leilão - Presencial"];
export const states = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
const keys = ["inicio", "fim", "modalidade", "uf", "municipio", "pagina", "tamanho", "palavra", "situacao", "minimo", "maximo", "ordem"];
export function searchQuery(input: SearchParams, now = new Date()) {
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 7);
  const day = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  const params = new URLSearchParams({ inicio: day(start), fim: day(now), modalidade: "6", uf: "PE", pagina: "1", tamanho: "20", ordem: "publicacao" });
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string" && (value || key === "uf")) params.set(key, value);
  }
  return params;
}
export function listHref(params: URLSearchParams, page?: number) {
  const next = new URLSearchParams(params);
  if (page !== undefined) next.set("pagina", String(page));
  return `/radar?${next}`;
}
export function detailHref(id: string, params: URLSearchParams) {
  return `/radar/${encodeURIComponent(id)}?${params}`;
}
export const text = (value: string | null | undefined) => value?.trim() || "Não informado";
export function money(value: string | null) {
  return value === null ? "Não informado / sigiloso" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}
export function dateTime(value: string | null) {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}
