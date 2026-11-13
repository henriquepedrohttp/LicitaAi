import Link from "next/link";
import HealthStatus from "./health-status";
export const dynamic = "force-dynamic";

type Doc = { id: string; filename: string; page_count: number; extracted_pages: number; ocr_pending_pages: number; failed_pages: number };

async function documents(): Promise<Doc[] | null> {
  try {
    const response = await fetch(`${process.env.API_BASE_URL ?? "http://127.0.0.1:8000"}/documents`, { cache: "no-store", signal: AbortSignal.timeout(4000) });
    return response.ok ? await response.json() : null;
  } catch { return null; }
}

export default async function Home() {
  const docs = await documents();
  const attention = docs?.filter(d => d.ocr_pending_pages + d.failed_pages > 0) ?? [];
  const pages = docs?.reduce((n, d) => n + d.page_count, 0) ?? 0;
  return <>
    <div className="page-head"><div><h1>Bom trabalho começa pela fonte.</h1><p>Encontre licitações, entenda o edital e confira se sua empresa atende, com cada requisito ligado à página de origem.</p></div></div>

    <ol className="journey" aria-label="Como usar o LicitaAI">
      <li><span className="step" aria-hidden="true">1</span><h2>Encontre oportunidades</h2><p>Pesquise no PNCP por período, região e modalidade.</p><Link className="button" href="/radar">Abrir Radar</Link></li>
      <li><span className="step" aria-hidden="true">2</span><h2>Analise o edital</h2><p>Importe o PDF. A IA lista os requisitos e mostra o trecho de cada um.</p><Link className="button ghost" href="/analise">Importar edital</Link></li>
      <li><span className="step" aria-hidden="true">3</span><h2>Confira se você atende</h2><p>Compare os requisitos com os documentos da sua empresa.</p><Link className="button ghost" href="/elegibilidade">Ver elegibilidade</Link></li>
    </ol>

    <div className="dash-grid">
      <section className="card" aria-labelledby="editais">
        <div className="dash-section-head"><h2 id="editais">Editais em análise</h2>{docs && docs.length > 0 && <Link href="/analise">Ver todos</Link>}</div>
        {docs === null ? <p className="error" role="alert">Não foi possível carregar os editais. Confira a conexão com a API ao lado.</p>
          : docs.length === 0 ? <div className="empty"><p><strong>Nenhum edital importado ainda.</strong></p><p>Importe o PDF de um edital para ver os requisitos organizados aqui.</p><Link className="button" href="/analise">Importar primeiro edital</Link></div>
          : <>
            <div className="stat-row">
              <div className="stat"><strong>{docs.length}</strong><span>editais importados</span></div>
              <div className="stat"><strong>{pages.toLocaleString("pt-BR")}</strong><span>páginas lidas</span></div>
              <div className={attention.length ? "stat attention" : "stat"}><strong>{attention.length}</strong><span>precisam de atenção</span></div>
            </div>
            <ul className="doc-rows">{docs.slice(0, 5).map(d => {
              const pct = d.page_count ? Math.round(d.extracted_pages / d.page_count * 100) : 0;
              const issues = d.ocr_pending_pages + d.failed_pages;
              return <li key={d.id}><div><strong title={d.filename}>{d.filename}</strong><small>{d.extracted_pages} de {d.page_count} páginas com texto</small><div className="meter" role="img" aria-label={`${pct}% do texto extraído`}><i style={{ width: `${pct}%` }} /></div></div>
                {issues ? <span className="chip warn">{issues} {issues === 1 ? "página pendente" : "páginas pendentes"}</span> : <span className="chip ok">Texto completo</span>}</li>;
            })}</ul>
          </>}
      </section>
      <aside style={{ display: "grid", gap: 20 }}>
        <section className="card" aria-labelledby="pendencias"><h2 id="pendencias">Pendências</h2>
          {attention.length ? <ul className="status-list">{attention.slice(0, 4).map(d => <li key={d.id}><span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{d.filename}</span><span className="chip warn">Revisar páginas</span></li>)}</ul>
            : <p>Nada pendente nos editais importados. Requisitos aguardando validação aparecem na Análise.</p>}
        </section>
        <section className="card" aria-labelledby="servicos"><h2 id="servicos">Conexão</h2><HealthStatus /></section>
      </aside>
    </div>
  </>;
}
