import edital from '../demo/edital.json';
import { estados, resumo, type Estado, type Item } from '../elegibilidade/contracts';
import { demoAvaliacao } from '../elegibilidade/demo/example';
import Decisao, { Imprimir } from './decisao';
import './relatorios.css';

// Relatório de demonstração para o pitch: dados fictícios, sem backend.
const tom: Record<Estado, string> = { atendido_preliminarmente: 'ok', nao_atendido: 'danger', nao_verificado: '', revisao_especializada: 'warn' };
const barra: Record<Estado, string> = { atendido_preliminarmente: 'var(--success)', nao_atendido: 'var(--danger)', nao_verificado: 'var(--line-strong)', revisao_especializada: '#d98a1c' };
const ordem: Estado[] = ['nao_atendido', 'nao_verificado', 'revisao_especializada'];
const data = (iso: string, opcoes: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Recife', ...opcoes });
const Chip = ({ estado }: { estado: Estado }) => <span className={`chip ${tom[estado]}`}>{estados[estado]}</span>;

function acao(item: Item) {
  const vencido = item.evidencias.find(e => e.vencido);
  if (item.estado === 'nao_atendido' && vencido)
    return `Emitir nova versão de “${vencido.titulo}”${vencido.validade ? `, vencida em ${data(`${vencido.validade}T12:00:00-03:00`, { dateStyle: 'short' })}` : ''}.`;
  if (item.estado === 'nao_atendido') return 'Providenciar o documento exigido e cadastrá-lo na empresa.';
  if (item.estado === 'nao_verificado') return 'Enviar ou associar o documento que comprova este requisito.';
  return 'Pedir a conferência de um especialista (contábil, técnico ou jurídico).';
}

export default function RelatoriosPage() {
  const itens = demoAvaliacao.itens;
  const r = resumo(itens);
  const etapas = { conformity: 0, technical: 0 };
  edital.requisitos.forEach(q => { if (q.etapa === 'conformity' || q.etapa === 'technical') etapas[q.etapa] += 1; });
  const revisados = itens.filter(i => i.revisado).length;
  const pendencias = ordem.flatMap(e => itens.filter(i => i.estado === e));
  const contagens = (Object.keys(estados) as Estado[]).map(e => [e, r[e]] as const);

  return <div className="relatorios">
    <div className="page-head">
      <div><h1>Relatório da oportunidade</h1><p>Resumo do edital, do que foi conferido e do que falta antes da sessão.</p></div>
      <Imprimir />
    </div>
    <p className="notice">Dados fictícios para demonstração: órgão, edital, empresa e documentos são ilustrativos.</p>

    <section className="card" aria-labelledby="rel-edital">
      <h2 id="rel-edital">{edital.pregao}</h2>
      <dl className="rel-dados">
        <div><dt>Órgão</dt><dd>{edital.orgao}</dd></div>
        <div><dt>Objeto</dt><dd>{edital.objeto}</dd></div>
        <div><dt>Valor estimado</dt><dd>{edital.valor_estimado}</dd></div>
        <div><dt>Sessão pública</dt><dd>{data(edital.sessao, { dateStyle: 'long', timeStyle: 'short' })}</dd></div>
        <div><dt>Número PNCP</dt><dd>{edital.pncp}</dd></div>
        <div><dt>Arquivo</dt><dd>{edital.arquivo}</dd></div>
        <div><dt>Empresa avaliada</dt><dd>{demoAvaliacao.empresa_nome} · CNPJ {demoAvaliacao.empresa_cnpj}</dd></div>
      </dl>
    </section>

    <section className="card" aria-labelledby="rel-cobertura">
      <h2 id="rel-cobertura">O que foi lido</h2>
      <div className="stat-row rel-stats">
        <div className="stat"><strong>{edital.paginas.length} de {edital.paginas.length}</strong><span>páginas lidas</span></div>
        <div className="stat"><strong>{etapas.conformity}</strong><span>requisitos de habilitação</span></div>
        <div className="stat"><strong>{etapas.technical}</strong><span>requisitos técnicos</span></div>
        <div className={revisados < itens.length ? 'stat attention' : 'stat'}><strong>{revisados} de {itens.length}</strong><span>conferidos por uma pessoa</span></div>
      </div>
      <p className="rel-nota">{edital.requisitos.length} requisitos extraídos do edital; {itens.length} comparados com os documentos da empresa.</p>
    </section>

    <section className="card" aria-labelledby="rel-elegibilidade">
      <h2 id="rel-elegibilidade">A empresa atende?</h2>
      <p>Resultado preliminar de {r.total} requisitos comparados.</p>
      <div className="rel-barra" aria-hidden="true">{contagens.filter(([, n]) => n).map(([e, n]) => <i key={e} style={{ flexGrow: n, background: barra[e] }} />)}</div>
      <ul className="rel-contagens">{contagens.map(([e, n]) => <li key={e}><strong>{n}</strong> <Chip estado={e} /></li>)}</ul>
    </section>

    <section className="card" aria-labelledby="rel-acoes">
      <h2 id="rel-acoes">O que fazer antes da sessão</h2>
      {pendencias.length === 0 ? <p>Nenhuma pendência encontrada.</p> : <ol className="rel-acoes">{pendencias.map(i =>
        <li key={i.id}>
          <div className="rel-acao-topo"><strong>{i.requisito.title}</strong><Chip estado={i.estado} /></div>
          <p className="rel-acao">{acao(i)}</p>
          <p className="rel-nota">Motivo: {i.justificativa} {i.requisito.source.page != null && <>· Edital, página {i.requisito.source.page}</>}</p>
        </li>)}</ol>}
    </section>

    <Decisao />

    <p className="notice">Resultado preliminar de apoio à decisão. Não constitui habilitação nem parecer jurídico: a decisão final é sempre humana.</p>
  </div>;
}
