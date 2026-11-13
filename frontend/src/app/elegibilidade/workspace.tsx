'use client';
import { useEffect, useState } from 'react';
import { useAccess } from '../empresas/access';
import type { Company, Evidence } from '../empresas/contracts';
import { categorias, criticidades, estados, filtrar, filtrosVazios, resumo, type Avaliacao, type Filtros, type Item } from './contracts';

type DocumentoAnalise = { id: string; filename: string; page_count: number; extracted_pages: number };
export type Inicial = Partial<Filtros> & { documento?: string; empresa?: string; item?: string };

export async function api<T>(key: string, path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (key) headers.set('Authorization', `Bearer ${key}`);
  if (init.body) headers.set('Content-Type', 'application/json');
  let response: Response;
  try { response = await fetch(path, { ...init, headers, cache: 'no-store', signal: AbortSignal.timeout(65000) }); }
  catch { throw new Error('Falha de conexão. Verifique a rede e tente novamente.'); }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.detail;
    throw new Error(typeof detail === 'string' ? detail : Array.isArray(detail) ? 'Confira os campos: ' + detail.map((d: { msg: string }) => d.msg).join('; ') : 'Não foi possível concluir a operação.');
  }
  return data as T;
}

const data = (iso: string | null) => iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Recife' }) : 'Não informado';
const Selo = ({ estado }: { estado: Item['estado'] }) => <span className={`eleg-selo eleg-${estado}`}>{estados[estado]}</span>;

export function Cabecalho({ avaliacao }: { avaliacao: Avaliacao }) {
  return <section className="card eleg-cabecalho" aria-label="Contexto da avaliação"><dl>
    <div><dt>Oportunidade (edital na Análise)</dt><dd>{avaliacao.documento_nome}<small>SHA-256 {avaliacao.documento_sha256.slice(0, 12)}… · PNCP {avaliacao.oportunidade_pncp ?? 'Não informado'}</small></dd></div>
    <div><dt>Empresa</dt><dd>{avaliacao.empresa_nome}<small>CNPJ {avaliacao.empresa_cnpj} · revisão do perfil {avaliacao.empresa_revisao}</small></dd></div>
    <div><dt>Avaliação</dt><dd>{data(avaliacao.atualizada_em)}<small>Criada em {data(avaliacao.criada_em)}</small></dd></div>
    <div><dt>Processamento</dt><dd>{avaliacao.processamento === 'concluido' ? 'Comparação preliminar concluída' : 'Sem requisitos na Análise'}<small>{avaliacao.requisitos_excluidos} rejeitado(s) na Análise fora da matriz</small></dd></div>
  </dl></section>;
}

export function Resumo({ itens }: { itens: Item[] }) {
  const r = resumo(itens);
  const blocos: [string, number, string][] = [['Total de requisitos', r.total, ''], [estados.atendido_preliminarmente, r.atendido_preliminarmente, 'atendido_preliminarmente'],
    [estados.nao_atendido, r.nao_atendido, 'nao_atendido'], [estados.nao_verificado, r.nao_verificado, 'nao_verificado'],
    [estados.revisao_especializada, r.revisao_especializada, 'revisao_especializada'], ['Pendentes de revisão humana', r.pendentes, '']];
  return <section className="eleg-resumo" aria-label="Resumo da matriz">{blocos.map(([rotulo, valor, estado]) =>
    <div key={rotulo} className={`card ${estado ? `eleg-${estado}` : ''}`}><strong>{valor}</strong><span>{rotulo}</span></div>)}</section>;
}

export function FiltrosForm({ filtros, onChange }: { filtros: Filtros; onChange: (f: Filtros) => void }) {
  const campo = (nome: keyof Filtros, rotulo: string, opcoes: Record<string, string>) =>
    <label>{rotulo}<select value={filtros[nome]} onChange={e => onChange({ ...filtros, [nome]: e.target.value })}>
      <option value="">Todos</option>{Object.entries(opcoes).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>;
  return <fieldset className="eleg-filtros"><legend>Filtrar requisitos</legend>
    {campo('categoria', 'Categoria', categorias)}{campo('estado', 'Estado da avaliação', estados)}
    {campo('criticidade', 'Criticidade', { ...criticidades, nao_informada: 'Não informada' })}
    {campo('revisao', 'Revisão humana', { pendentes: 'Pendentes', revisados: 'Revisados' })}
    <button type="button" className="secondary" onClick={() => onChange(filtrosVazios)}>Limpar filtros</button></fieldset>;
}

export function Matriz({ itens, selecionado, onSelect }: { itens: Item[]; selecionado?: string; onSelect: (id: string) => void }) {
  if (!itens.length) return <p className="card">Nenhum requisito corresponde aos filtros. Limpe os filtros para ver a matriz completa.</p>;
  return <div className="eleg-tabela" role="region" aria-label="Matriz de elegibilidade" tabIndex={0}><table>
    <thead><tr><th scope="col">Requisito</th><th scope="col">Categoria</th><th scope="col">Descrição</th><th scope="col">Fonte no edital</th>
      <th scope="col">Evidências da empresa</th><th scope="col">Estado</th><th scope="col">Justificativa</th><th scope="col">Ações</th></tr></thead>
    <tbody>{itens.map((item, n) => <tr key={item.id} aria-selected={item.id === selecionado} className={item.id === selecionado ? 'selecionado' : ''}>
      <td>R{String(n + 1).padStart(2, '0')}<small>{item.requisito.id.slice(0, 8)}</small></td>
      <td>{categorias[item.categoria]}<small>Análise: {item.categoria_original}</small></td>
      <td>{item.requisito.title}</td>
      <td>{item.requisito.source.filename}<small>pág. {item.requisito.source.page ?? 'Não informada'}{item.requisito.source.verified ? '' : ' · fonte não confirmada'}</small></td>
      <td>{item.evidencias.length ? item.evidencias.map(e => <span key={e.documento_id} className="eleg-evidencia">{e.titulo}{e.vencido ? ' (vencido)' : ''}</span>) : 'Nenhuma'}</td>
      <td><Selo estado={item.estado} /><small>{item.origem_estado === 'humano' ? 'Revisado por analista' : 'Preliminar automático'}{item.reconferir ? ' · reconferir' : ''}</small></td>
      <td className="eleg-justificativa">{item.justificativa}</td>
      <td><button type="button" onClick={() => onSelect(item.id)} aria-label={`Revisar requisito R${n + 1}`}>Revisar</button></td>
    </tr>)}</tbody></table></div>;
}

type Acao = 'confirmar' | 'corrigir' | 'revisao_especializada' | 'observacao' | 'evidencias' | 'criticidade';
export function Detalhe({ item, documentos, busy, autor, onAutor, onSave, onClose, onMove, posicao, urlFonte }: {
  item: Item; documentos: Evidence[]; busy: boolean; autor: string; onAutor: (v: string) => void; posicao: string; urlFonte?: string;
  onSave: (acao: Acao, extra: Record<string, unknown>, justificativa: string) => void; onClose: () => void; onMove: (passo: number) => void;
}) {
  const [justificativa, setJustificativa] = useState('');
  const [estado, setEstado] = useState(item.estado);
  const [criticidade, setCriticidade] = useState(item.criticidade ?? 'media');
  const [vinculos, setVinculos] = useState(item.evidencias.map(e => e.documento_id));
  const fonte = item.requisito.source;
  const salvar = (acao: Acao, extra: Record<string, unknown> = {}) => onSave(acao, extra, justificativa);
  return <aside className="card eleg-detalhe" aria-label="Detalhe do requisito">
    <div className="eleg-detalhe-topo"><span>{posicao}</span><div>
      <button type="button" className="secondary" onClick={() => onMove(-1)} aria-label="Requisito anterior">←</button>
      <button type="button" className="secondary" onClick={() => onMove(1)} aria-label="Próximo requisito">→</button>
      <button type="button" className="secondary" onClick={onClose}>Fechar</button></div></div>
    <h2>{item.requisito.title}</h2>
    <p><Selo estado={item.estado} /> {item.origem_estado === 'humano' ? 'Conclusão do analista' : 'Resultado preliminar automático'} · criticidade {item.criticidade ? criticidades[item.criticidade] : 'não informada'}</p>
    {item.reconferir && <p className="notice" role="note">Reconferir: {item.reconferir}</p>}
    <h3>Texto original</h3><blockquote className="source-excerpt">{fonte.excerpt}</blockquote>
    <p>{fonte.filename} · página {fonte.page ?? 'Não informada'} · cláusula não informada pela Análise · {fonte.verified ? 'trecho localizado na fonte' : 'fonte não confirmada'}
      {fonte.page && <> · <a href={`${urlFonte ?? `/api/documents/${fonte.document_id}/file`}#page=${fonte.page}`} target="_blank" rel="noreferrer">Abrir página no edital ↗</a></>}</p>
    <h3>Interpretação estruturada</h3>
    <ul><li>Categoria: {categorias[item.categoria]} (original da Análise: {item.categoria_original})</li>
      <li>Revisão na Análise: {item.requisito.review_status} · versão {item.requisito.version}</li>
      <li>Quantidades no texto: {item.automatico.quantidades.length ? item.automatico.quantidades.map(q => `${q.valor} ${q.unidade}`).join('; ') : 'nenhuma identificada'} (sem comparador inferido)</li>
      <li>Regra: {item.automatico.regra} · {item.automatico.metodo === 'regra_deterministica' ? 'regra determinística' : 'encaminhado à revisão humana'}</li></ul>
    <h3>Justificativa</h3><p>{item.justificativa}</p>
    {item.origem_estado === 'humano' && <p><small>Resultado automático: {estados[item.automatico.estado]} — {item.automatico.justificativa}</small></p>}
    {!!item.automatico.incertezas.length && <><h3>Incertezas</h3><ul>{item.automatico.incertezas.map(t => <li key={t}>{t}</li>)}</ul></>}
    {!!item.automatico.declaracoes_relacionadas.length && <p><small>Declarações relacionadas (não são evidência): {item.automatico.declaracoes_relacionadas.join('; ')}</small></p>}
    <h3>Evidências encontradas</h3>
    {item.evidencias.length ? <ul>{item.evidencias.map(e => <li key={e.documento_id}>{e.titulo} · {e.tipo} · v{e.versao} · validade {e.validade ?? 'não informada'}{e.vencido ? ' · VENCIDO' : ''} · {e.origem === 'associada_por_analista' ? 'associada por analista' : 'sugerida por regra'}</li>)}</ul> : <p>Nenhuma evidência associada.</p>}

    <form className="eleg-revisao" onSubmit={e => e.preventDefault()}>
      <h3>Revisão humana</h3>
      <label>Responsável<input value={autor} onChange={e => onAutor(e.target.value)} maxLength={100} required autoComplete="name" /></label>
      <label>Justificativa ou observação<textarea value={justificativa} onChange={e => setJustificativa(e.target.value)} maxLength={2000} rows={3} required /></label>
      <div className="review-actions">
        <button type="button" disabled={busy} onClick={() => salvar('confirmar')}>Confirmar conclusão</button>
        <button type="button" className="secondary" disabled={busy} onClick={() => salvar('revisao_especializada')}>Marcar revisão especializada</button>
        <button type="button" className="secondary" disabled={busy} onClick={() => salvar('observacao')}>Adicionar observação</button>
      </div>
      <label>Corrigir estado<select value={estado} onChange={e => setEstado(e.target.value as Item['estado'])}>{Object.entries(estados).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
      <button type="button" className="secondary" disabled={busy || estado === item.estado} onClick={() => salvar('corrigir', { estado })}>Salvar correção</button>
      <label>Criticidade (somente quando fundamentada)<select value={criticidade} onChange={e => setCriticidade(e.target.value as typeof criticidade)}>{Object.entries(criticidades).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
      <button type="button" className="secondary" disabled={busy} onClick={() => salvar('criticidade', { criticidade })}>Definir criticidade</button>
      <fieldset><legend>Associar evidências da empresa</legend>
        {documentos.length ? documentos.map(d => <label key={d.id} className="eleg-check"><input type="checkbox" checked={vinculos.includes(d.id)}
          onChange={e => setVinculos(e.target.checked ? [...vinculos, d.id] : vinculos.filter(v => v !== d.id))} />{d.titulo} · validade {d.validade ?? 'não informada'}{d.vencido ? ' · vencido' : ''}</label>)
          : <p>Nenhum documento atual cadastrado em Empresas.</p>}
        <button type="button" className="secondary" disabled={busy} onClick={() => salvar('evidencias', { evidencias: vinculos })}>Salvar evidências</button></fieldset>
    </form>
    {!!item.observacoes.length && <><h3>Observações</h3>{item.observacoes.map((o, i) => <p key={i}><strong>{o.autor}</strong> · {data(o.em)}<br />{o.texto}</p>)}</>}
    <details><summary>Histórico de revisão · versão {item.versao}</summary><ol>{item.historico.map((e, i) => <li key={i}>
      <strong>{e.autor}</strong> · {e.acao} · {data(e.em)}<br />{e.justificativa}
      {e.antes && e.depois && <><br /><small>Antes: {JSON.stringify(e.antes)} · Depois: {JSON.stringify(e.depois)}</small></>}</li>)}</ol></details>
  </aside>;
}

export default function Workspace({ inicial }: { inicial: Inicial }) {
  const { key } = useAccess();
  const [documentos, setDocumentos] = useState<DocumentoAnalise[] | null>(null);
  const [empresas, setEmpresas] = useState<Company[] | null>(null);
  const [documento, setDocumento] = useState(inicial.documento ?? '');
  const [empresa, setEmpresa] = useState(inicial.empresa ?? '');
  const [pncp, setPncp] = useState('');
  const [avaliacao, setAvaliacao] = useState<Avaliacao | null>(null);
  const [evidencias, setEvidencias] = useState<Evidence[]>([]);
  const [filtros, setFiltros] = useState<Filtros>({ ...filtrosVazios, ...Object.fromEntries(Object.entries(inicial).filter(([k]) => k in filtrosVazios)) });
  const [selecionado, setSelecionado] = useState(inicial.item ?? '');
  const [autor, setAutor] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    api<DocumentoAnalise[]>('', '/api/documents').then(setDocumentos).catch(e => { setDocumentos([]); setErro(`Análise: ${e.message}`); });
    // shortcut: somente a primeira página (20) de Empresas; paginar o seletor quando houver mais empresas.
    api<Company[]>(key, '/api/empresas').then(lista => {
      setEmpresas(lista);
      // Seleção feita na área Empresas (contrato: somente UUID, válido nesta aba).
      try { const salva = window.sessionStorage.getItem('licitaai.empresaSelecionada'); if (salva) setEmpresa(atual => atual || salva); } catch { /* armazenamento indisponível */ }
      // Reabre a avaliação indicada na URL (voltar/recarregar) após a chave ser informada.
      if (inicial.documento && inicial.empresa) return comparar();
    }).catch(e => { setEmpresas([]); setErro(`Empresas: ${e.message}`); });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const params = new URLSearchParams(Object.entries({ documento, empresa, ...filtros, item: selecionado }).filter(([, v]) => v));
    window.history.replaceState(null, '', params.size ? `?${params}` : window.location.pathname);
  }, [documento, empresa, filtros, selecionado]);

  async function comparar(event?: React.FormEvent) {
    event?.preventDefault();
    if (!documento || !empresa) return;
    setBusy(true); setErro(''); setMensagem('');
    try {
      const [resultado, docs] = await Promise.all([
        api<Avaliacao>(key, '/api/elegibilidade/avaliacoes', { method: 'POST', body: JSON.stringify({ documento_id: documento, empresa_id: empresa, oportunidade_pncp: pncp.trim() || null }) }),
        api<Evidence[]>(key, `/api/empresas/${empresa}/documentos`)]);
      setAvaliacao(resultado);
      setEvidencias(docs.filter(d => d.atual && !d.excluido_em));
      setSelecionado(atual => resultado.itens.some(i => i.id === atual) ? atual : '');
      setMensagem(`Matriz atualizada com ${resultado.itens.length} requisito(s). Revisões humanas anteriores foram preservadas.`);
    } catch (e) { setAvaliacao(null); setErro(e instanceof Error ? e.message : 'Falha ao comparar.'); }
    finally { setBusy(false); }
  }

  const visiveis = avaliacao ? filtrar(avaliacao.itens, filtros) : [];
  const atual = avaliacao?.itens.find(i => i.id === selecionado);
  const indice = visiveis.findIndex(i => i.id === selecionado);

  async function salvar(acao: string, extra: Record<string, unknown>, justificativa: string) {
    if (!avaliacao || !atual) return;
    if (autor.trim().length < 2 || justificativa.trim().length < 3) { setErro('Informe o responsável e uma justificativa (mínimo 3 caracteres).'); return; }
    setBusy(true); setErro(''); setMensagem('Salvando revisão…');
    try {
      const item = await api<Item>(key, `/api/elegibilidade/avaliacoes/${avaliacao.id}/itens/${atual.id}`, { method: 'PATCH',
        body: JSON.stringify({ acao, autor, justificativa, versao_esperada: atual.versao, ...extra }) });
      setAvaliacao({ ...avaliacao, itens: avaliacao.itens.map(i => i.id === item.id ? item : i) });
      setMensagem(`Revisão salva por ${autor} às ${new Date().toLocaleTimeString('pt-BR')}. Histórico atualizado.`);
    } catch (e) { setMensagem(''); setErro(e instanceof Error ? e.message : 'Falha ao salvar.'); }
    finally { setBusy(false); }
  }

  return <>
    <form className="card eleg-selecao" onSubmit={comparar}>
      <label>Oportunidade (edital importado na Análise)<select value={documento} onChange={e => setDocumento(e.target.value)} required disabled={busy}>
        <option value="">{documentos === null ? 'Carregando…' : documentos.length ? 'Selecione' : 'Nenhum edital importado'}</option>
        {documentos?.map(d => <option key={d.id} value={d.id}>{d.filename} · {d.extracted_pages}/{d.page_count} páginas com texto</option>)}</select></label>
      <label>Empresa<select value={empresa} onChange={e => setEmpresa(e.target.value)} required disabled={busy}>
        <option value="">{empresas === null ? 'Carregando…' : empresas.length ? 'Selecione' : 'Nenhuma empresa cadastrada'}</option>
        {empresas?.map(c => <option key={c.id} value={c.id}>{c.razao_social} · {c.cnpj}</option>)}</select></label>
      <label>Número de controle PNCP (opcional)<input value={pncp} onChange={e => setPncp(e.target.value)} pattern="[0-9]{14}-1-[0-9]{6}/[0-9]{4}" placeholder="00000000000000-1-000000/2026" disabled={busy} /></label>
      <button disabled={busy || !documento || !empresa}>{busy ? 'Comparando…' : avaliacao ? 'Atualizar comparação' : 'Comparar requisitos'}</button>
    </form>
    <div role="status" aria-live="polite">{busy && <p>Processando…</p>}{mensagem && <p className="eleg-ok">{mensagem}</p>}</div>
    {erro && <p className="error" role="alert">{erro}</p>}
    {!avaliacao && !busy && <section className="card"><h2>Selecione oportunidade e empresa</h2><p>A matriz usa os requisitos registrados na Análise e o contexto de Empresas. Sem documento, o resultado é “não verificado”, nunca “não atendido”.</p></section>}
    {avaliacao && <>
      <Cabecalho avaliacao={avaliacao} />
      <ul className="notice eleg-avisos">{avaliacao.avisos.map(a => <li key={a}>{a}</li>)}</ul>
      <Resumo itens={avaliacao.itens} />
      <FiltrosForm filtros={filtros} onChange={setFiltros} />
      <p className="eleg-contagem">{visiveis.length} de {avaliacao.itens.length} requisito(s) exibido(s)</p>
      <div className={atual ? 'eleg-workspace com-detalhe' : 'eleg-workspace'}>
        <Matriz itens={visiveis} selecionado={selecionado} onSelect={setSelecionado} />
        {atual && <Detalhe key={`${atual.id}-${atual.versao}`} item={atual} documentos={evidencias} busy={busy} autor={autor} onAutor={setAutor}
          onSave={salvar} onClose={() => setSelecionado('')} posicao={indice >= 0 ? `${indice + 1} de ${visiveis.length}` : 'Fora do filtro atual'}
          onMove={passo => visiveis.length && setSelecionado(visiveis[(Math.max(indice, 0) + passo + visiveis.length) % visiveis.length].id)} />}
      </div>
    </>}
  </>;
}
