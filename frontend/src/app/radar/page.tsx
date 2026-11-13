import Link from "next/link";
import { Suspense } from "react";
import { radarGet, RadarError } from "./api";
import type { Detail, Opportunity, Results } from "./contracts";
import SearchForm from "./search-form";
import { dateTime, money } from "./query";
import Loading from "./loading";
import "./radar.css";
export const dynamic = "force-dynamic";
type Params = Record<string, string | string[] | undefined>;
const absent = "Não informado";
const text = (value: string | null) => value || absent;
function href(values: Record<string, string>, changes: Record<string, string> = {}) {
  return `/radar?${new URLSearchParams({ ...values, ...changes })}`;
}
function Facts({ item }: { item: Opportunity }) {
  return <dl className="radar-facts">
    <div><dt>Órgão</dt><dd>{text(item.orgao)}</dd></div><div><dt>Localidade</dt><dd>{text(item.municipio)} · {text(item.uf)}</dd></div>
    <div><dt>Modalidade · número/ano</dt><dd>{text(item.modalidade)} · {text(item.numero)}/{item.ano}</dd></div>
    <div><dt>Valor estimado</dt><dd className="radar-value">{money(item.valor_estimado)}</dd><small>Não informado quando ausente, zero ou sigiloso na fonte.</small></div>
    <div><dt>Publicado em</dt><dd>{dateTime(item.publicado_em)}</dd></div><div><dt>Encerramento das propostas</dt><dd>{dateTime(item.encerramento_em)}</dd></div>
  </dl>;
}
function Deadline({ value }: { value: string | null }) {
  if (!value) return null;
  const days = Math.ceil((new Date(value).getTime() - new Date().getTime()) / 86_400_000);
  if (Number.isNaN(days)) return null;
  if (days < 0) return <span className="chip">Propostas encerradas</span>;
  const label = days === 0 ? "Encerra hoje" : days === 1 ? "Encerra amanhã" : `Encerra em ${days} dias`;
  return <span className={days <= 3 ? "chip danger" : days <= 7 ? "chip warn" : "chip ok"}>{label}</span>;
}
async function Content({ values, identifier, docsPage }: { values: Record<string, string>; identifier: string; docsPage: string }) {
  const back = href(values);
  let detail: Detail | undefined;
  let data: Results | undefined;
  let failure: string | undefined;
  const query = new URLSearchParams(values);
  for (const [key, value] of [...query]) if (!value && key !== "uf") query.delete(key);
  try {
    if (identifier) {
      detail = await radarGet<Detail>(`oportunidades/${encodeURIComponent(identifier)}?documentos_pagina=${encodeURIComponent(docsPage)}`);
    } else {
      data = await radarGet<Results>(`oportunidades?${query}`);
    }
  } catch (error) {
    if (!(error instanceof RadarError)) throw error;
    failure = error.message;
  }
  if (failure) return <section className="card radar-error" role="alert"><h2>Não foi possível exibir os dados</h2><p>{failure}</p><div className="radar-actions"><Link prefetch={false} href={href(values, identifier ? { oportunidade: identifier, documentos_pagina: docsPage } : {})}>Tentar novamente</Link><Link prefetch={false} href={back}>Voltar à pesquisa</Link></div></section>;
  if (detail) {
      const item = detail.oportunidade;
      return <><Link href={back} prefetch={false}>← Voltar à pesquisa</Link><article className="card radar-detail">
        <div className="radar-meta"><span className="radar-tags"><span className="radar-badge">{text(item.situacao)}</span><Deadline value={item.encerramento_em} /></span><span>{item.id}</span></div>
        <h2>{text(item.objeto)}</h2><Facts item={item} />
        <dl className="radar-facts"><div><dt>CNPJ do órgão</dt><dd>{item.cnpj}</dd></div><div><dt>Abertura das propostas</dt><dd>{dateTime(item.abertura_em)}</dd></div><div><dt>Critério de julgamento</dt><dd>{text(item.criterio_julgamento)}</dd></div></dl>
        <p>Datas e horários das propostas conforme o PNCP, em horário de Brasília. Confirme retificações na fonte.</p>
        <div className="radar-actions"><a href={item.url_oficial} target="_blank" rel="noreferrer">Abrir oportunidade no PNCP ↗</a><a href={item.url_api} target="_blank" rel="noreferrer">Metadados oficiais ↗</a></div>
        <h3>Documentos oficiais</h3>
        {detail.avisos.map((warning, index) => <p key={index} role="alert" className="notice">{warning} <Link prefetch={false} href={href(values, { oportunidade: identifier, documentos_pagina: docsPage })}>Tentar novamente</Link></p>)}
        {detail.documentos.length === 0 ? <p>{detail.avisos.length ? "Documentos não confirmados nesta consulta." : "Nenhum documento disponível nesta página."} <a href={item.url_oficial} target="_blank" rel="noreferrer">Conferir no PNCP ↗</a></p>
          : <ul className="radar-documents">{detail.documentos.map(doc => <li key={doc.id}><a href={doc.url} target="_blank" rel="noreferrer">{doc.titulo || `Documento ${doc.id}`} ↗</a><span>{text(doc.tipo)} · {dateTime(doc.publicado_em)}</span></li>)}</ul>}
        {detail.documentos_consultados_em && <p className="radar-stamp">Documentos consultados em {dateTime(detail.documentos_consultados_em)} (Brasília).</p>}
        <nav className="radar-pagination" aria-label="Páginas dos documentos">
          {Number(docsPage) > 1 && <Link prefetch={false} href={href(values, { oportunidade: identifier, documentos_pagina: String(Number(docsPage) - 1) })}>Documentos anteriores</Link>}
          <span>Página de documentos {detail.documentos_pagina} · até 20 por página</span>
          {detail.documentos_proxima_pagina && <Link prefetch={false} href={href(values, { oportunidade: identifier, documentos_pagina: String(Number(docsPage) + 1) })}>Próximos documentos</Link>}
        </nav>
        <button disabled aria-describedby="analysis-pending">Analisar oportunidade</button><p id="analysis-pending">Integração com Análise pendente. Nenhuma análise foi iniciada.</p>
        <p className="radar-stamp">Fonte: PNCP · Metadados consultados em {new Date(item.consultado_em).toLocaleString("pt-BR", { timeZone: "America/Recife" })} (Brasília). Cache de até 60 segundos.</p>
      </article></>;
    }
    if (!data) return null;
    return <><div className="radar-results-heading"><h2>Oportunidades</h2><span>{data.total_fonte.toLocaleString("pt-BR")} registros na consulta oficial</span></div>
      <p role="status">{data.oportunidades.length} exibidos de {data.registros_na_pagina} recebidos nesta página · Página {data.pagina} de {Math.max(data.total_paginas, 1)}.</p>
      <p className="radar-stamp">Fonte: PNCP · Consulta em {new Date(data.consultado_em).toLocaleString("pt-BR", { timeZone: "America/Recife" })} (Brasília). Cache de até 60 segundos.</p>
      <p className="notice">Os refinamentos e a ordenação são locais à página. O total oficial considera apenas período, modalidade, UF e município.</p>
      {data.oportunidades.length ? <div className="radar-list">{data.oportunidades.map(item => <article key={item.id} className="card">
        <div className="radar-meta"><span className="radar-tags"><span className="radar-badge">{text(item.situacao)}</span><Deadline value={item.encerramento_em} /></span><span>{item.id}</span></div>
        <h3><Link prefetch={false} href={href(values, { oportunidade: item.id })}>{text(item.objeto)}</Link></h3><Facts item={item} />
        <div className="radar-actions"><Link prefetch={false} href={href(values, { oportunidade: item.id })}>Ver detalhes e documentos</Link><a href={item.url_oficial} target="_blank" rel="noreferrer">Fonte PNCP ↗</a></div>
      </article>)}</div> : <section className="card"><h3>Nenhuma oportunidade nesta página</h3><p>{data.registros_na_pagina ? "Remova os refinamentos ou consulte outra página oficial." : "Tente outro período, modalidade ou localidade."}</p></section>}
      <nav className="radar-pagination" aria-label="Páginas de oportunidades">
        {data.pagina > 1 && <Link prefetch={false} href={href(values, { pagina: String(data.pagina - 1) })}>← Página anterior</Link>}<span>Página {data.pagina}</span>
        {data.pagina < data.total_paginas && <Link prefetch={false} href={href(values, { pagina: String(data.pagina + 1) })}>Próxima página →</Link>}
      </nav></>;
}

export default async function Radar({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Recife" });
  const week = new Date(`${today}T12:00:00Z`); week.setUTCDate(week.getUTCDate() - 7);
  const defaults: Record<string, string> = { inicio: week.toISOString().slice(0, 10), fim: today, modalidade: "6", uf: "PE", tamanho: "20", pagina: "1", palavra: "", municipio: "", situacao: "", minimo: "", maximo: "", ordem: "publicacao" };
  const values = Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, typeof params[key] === "string" ? params[key] : fallback]));
  const identifier = typeof params.oportunidade === "string" ? params.oportunidade : "";
  const docsPage = typeof params.documentos_pagina === "string" ? params.documentos_pagina : "1";
  return <div className="radar" key={JSON.stringify(params)}><div className="radar-heading"><div><h1>Radar de oportunidades</h1><p>Licitações publicadas no PNCP, filtradas pelo que interessa à sua empresa.</p></div><a className="radar-source" href="https://pncp.gov.br/" target="_blank" rel="noreferrer"><span aria-hidden="true" />Dados oficiais · PNCP ↗</a></div>
    {!identifier && <SearchForm values={values} />}
    <Suspense fallback={<Loading />}><Content values={values} identifier={identifier} docsPage={docsPage} /></Suspense>
  </div>;
}
