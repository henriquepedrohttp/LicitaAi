'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AccessGate, empresasRequest, useAccess } from './access';
import { profileLabels, type Company, type Evidence, type Profile } from './contracts';
import { ProfileForm } from './profile-form';
import { Documents } from './documents';

export function Facts({ company, technical = false }: { company: Profile; technical?: boolean }) {
  const fields: (keyof Profile)[] = technical ? ['capacidades', 'experiencia', 'projetos', 'tecnologias'] : ['razao_social', 'nome_fantasia', 'cnpj', 'porte', 'municipio', 'uf', 'segmento', 'cnae_principal', 'cnaes_secundarios', 'produtos_servicos', 'areas_atuacao', 'capacidades'];
  return <dl>{fields.map(name => <div key={name}><dt>{profileLabels[name]}</dt><dd>{Array.isArray(company[name]) ? (company[name] as string[]).join('\n') || 'Não informado' : company[name] || 'Não informado'}</dd></div>)}</dl>;
}

export function Pending({ company, documents }: { company: Company; documents: Evidence[] }) {
  const active = documents.filter(d => d.atual && !d.excluido_em);
  return <section className="card"><h2>Pendências do perfil</h2><p>Esta lista organiza lacunas cadastrais e documentais. A exigência de cada documento depende do edital e será avaliada pela Elegibilidade.</p>
    <h3>Campos não preenchidos</h3>{company.campos_pendentes.length ? <ul>{company.campos_pendentes.map(field => <li key={field}>{profileLabels[field]}</li>)}</ul> : <p>Campos do perfil preenchidos. Informações ainda declaradas, sem verificação cadastral.</p>}
    <h3>Categorias sem documento atual</h3><ul>{Object.entries({ juridico: 'Documentação jurídica', fiscal_trabalhista: 'Certidões fiscais e trabalhistas', atestado_tecnico: 'Atestados técnicos', economico_financeiro: 'Documentação econômico-financeira' }).filter(([type]) => !active.some(doc => doc.tipo === type)).map(([type, label]) => <li key={type}>{label} · ausência de evidência, sem juízo de habilitação</li>)}</ul>
    <h3>Validade e verificação</h3>{active.length ? <ul>{active.map(doc => <li key={doc.id}>{doc.titulo}: {doc.vencido ? 'validade informada vencida' : doc.validade ? 'validade informada, sem validação de autenticidade' : 'validade não informada'} · aguardando verificação</li>)}</ul> : <p>Não há documentos para verificar.</p>}
  </section>;
}

function Content({ id }: { id?: string }) {
  const { key, setKey } = useAccess();
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [company, setCompany] = useState<Company>();
  const [documents, setDocuments] = useState<Evidence[]>([]);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState('geral');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState(() => typeof window === 'undefined' ? '' : sessionStorage.getItem('licitaai.empresaSelecionada') ?? '');
  const [deleting, setDeleting] = useState(false);
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      if (id) {
        const [profileResponse, documentResponse] = await Promise.all([empresasRequest(key, `/${id}`, { signal }), empresasRequest(key, `/${id}/documentos`, { signal })]);
        const profile: Company = await profileResponse.json(); const docs: Evidence[] = await documentResponse.json();
        if (!profile.id || !Array.isArray(profile.campos_pendentes) || !Array.isArray(docs)) throw new Error('Resposta inválida do serviço de Empresas.');
        if (signal?.aborted) return;
        setCompany(profile); setDocuments(docs);
      } else {
        const response = await empresasRequest(key, `?pagina=${page}`, { signal }); const list: Company[] = await response.json();
        if (!Array.isArray(list)) throw new Error('Resposta inválida do serviço de Empresas.');
        if (signal?.aborted) return;
        setCompanies(list);
      }
      setError('');
    } catch (err) { if (!signal?.aborted) { setError(err instanceof Error ? err.message : 'Falha de conexão. Tente novamente.'); throw err; } } finally { if (!signal?.aborted) setBusy(false); }
  }, [key, id, page]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Sincroniza o perfil remoto ao trocar empresa ou página.
  useEffect(() => { const controller = new AbortController(); void load(controller.signal).catch(() => {}); return () => controller.abort(); }, [load]);
  useEffect(() => {
    if (!editing) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [editing]);
  async function save(payload: Profile) {
    const response = await empresasRequest(key, id ? `/${id}` : '', { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(id ? { ...payload, revisao: company?.revisao } : payload) });
    const saved: Company = await response.json(); setEditing(false); setNotice('Empresa salva. Dados registrados como declarações do usuário.');
    if (!id) router.push(`/empresas/${saved.id}`); else await load();
  }
  function select(value: string) { sessionStorage.setItem('licitaai.empresaSelecionada', value); setSelected(value); setNotice('Empresa selecionada nesta aba para integração com Elegibilidade. Nenhuma avaliação foi iniciada.'); }
  return <><div className="actions"><Link href="/empresas/cadastro" onClick={event => { if (editing && !window.confirm('Sair e descartar alterações não salvas?')) event.preventDefault(); }}>← Listagem de empresas</Link><button className="secondary" onClick={() => setKey('')}>Encerrar acesso</button></div>
    {notice && <p role="status" className="notice">{notice}</p>}
    {error && <div className="alert" role="alert"><p>{error}</p><button className="secondary" onClick={() => void load().catch(() => {})}>Tentar novamente</button></div>}
    {busy && <p role="status" aria-live="polite">Carregando empresas e evidências…</p>}
    {!id && !editing && !busy && !error && <><div className="actions"><h2>Empresas cadastradas</h2><button onClick={() => setEditing(true)}>Cadastrar empresa</button></div>
      {!companies.length && <section className="card"><h3>{page === 1 ? 'Nenhuma empresa cadastrada' : 'Nenhuma empresa nesta página'}</h3><p>Crie um perfil para organizar declarações e evidências. Não há cadastros fictícios pré-carregados.</p></section>}
      {companies.map(item => <article className="card" key={item.id}><span className="badge">{item.preenchimento === 'parcial' ? 'Perfil parcial' : 'Campos preenchidos · não verificados'}</span><h2><Link href={`/empresas/${item.id}`}>{item.razao_social}</Link></h2>
        <dl><div><dt>Nome fantasia</dt><dd>{item.nome_fantasia || 'Não informado'}</dd></div><div><dt>CNPJ</dt><dd>{item.cnpj}</dd></div><div><dt>Porte · município/UF</dt><dd>{item.porte || 'Não informado'} · {item.municipio || 'Não informado'}/{item.uf || 'Não informado'}</dd></div><div><dt>Segmento · documentos atuais</dt><dd>{item.segmento || 'Não informado'} · {item.documentos_quantidade} documentos</dd></div></dl>
        <div className="actions"><Link href={`/empresas/${item.id}`}>Visualizar e editar perfil →</Link><button className="secondary" onClick={() => select(item.id)}>{selected === item.id ? 'Empresa selecionada' : 'Selecionar empresa'}</button></div></article>)}
      <nav className="actions" aria-label="Paginação de empresas"><button className="secondary" disabled={page === 1} onClick={() => { setBusy(true); setPage(page - 1); }}>Anterior</button><span>Página {page} · até 20 empresas</span><button className="secondary" disabled={companies.length < 20} onClick={() => { setBusy(true); setPage(page + 1); }}>Próxima</button></nav></>}
    {editing ? <ProfileForm current={company} section={tab === 'tecnica' ? 'tecnica' : 'geral'} save={save} cancel={() => { setEditing(false); setError(''); }} /> : id && company && !error && !busy && <>
      <section className="card"><span className="badge">Informações declaradas · revisão {company.revisao}</span><h2>{company.razao_social}</h2><p>CNPJ {company.cnpj} · {company.documentos_quantidade} documentos atuais · {company.campos_pendentes.length ? 'Perfil parcial' : 'Campos preenchidos'}</p><div className="actions"><button onClick={() => select(company.id)}>{selected === company.id ? 'Empresa selecionada' : 'Selecionar empresa'}</button><button className="danger" onClick={() => setDeleting(true)}>Excluir empresa</button></div></section>
      {deleting && <section className="card"><h3>Excluir esta empresa?</h3><p>A exclusão só é permitida sem histórico documental. Esta operação não pode ser desfeita.</p><div className="actions"><button className="danger" onClick={async () => { try { await empresasRequest(key, `/${id}`, { method: 'DELETE' }); if (selected === id) sessionStorage.removeItem('licitaai.empresaSelecionada'); router.push('/empresas/cadastro'); } catch (err) { setError(err instanceof Error ? err.message : 'Falha ao excluir.'); } }}>Confirmar exclusão da empresa</button><button className="secondary" onClick={() => setDeleting(false)}>Cancelar</button></div></section>}
      <nav className="tabs" aria-label="Seções do perfil">{[['geral', 'Visão geral'], ['tecnica', 'Capacidade técnica'], ['documentos', 'Documentos'], ['pendencias', 'Pendências']].map(([value, label]) => <button key={value} aria-pressed={tab === value} onClick={() => setTab(value)}>{label}</button>)}</nav>
      {tab === 'geral' || tab === 'tecnica' ? <section className="card"><h2>{tab === 'geral' ? 'Visão geral' : 'Capacidade técnica declarada'}</h2><p>Informações fornecidas pelo usuário; sem verificação independente.</p><button className="secondary" onClick={() => setEditing(true)}>Editar {tab === 'geral' ? 'informações cadastrais' : 'capacidade técnica'}</button><Facts company={company} technical={tab === 'tecnica'} />{tab === 'tecnica' && <p>{documents.filter(d => d.tipo === 'atestado_tecnico' && d.atual && !d.excluido_em).length} atestados cadastrados · Consulte a seção Documentos para verificar as referências.</p>}</section>
        : tab === 'documentos' ? <Documents id={id} documents={documents} reload={load} /> : <Pending company={company} documents={documents} />}
    </>}
  </>;
}

export default function Workspace({ id }: { id?: string }) { return <AccessGate><Content key={id ?? 'list'} id={id} /></AccessGate>; }
