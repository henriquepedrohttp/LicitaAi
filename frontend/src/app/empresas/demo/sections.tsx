import { Facts } from '../workspace';
import { documentTypes, profileLabels, type Profile } from '../contracts';
import { demoDocuments } from './example';

export default function DemoSection({ tab, profile }: { tab: string; profile: Profile }) {
  if (tab === 'documentos') return <section className="card"><div className="pitch-section-heading"><div><h2>Documentos e evidências</h2><p>Organização documental para apoiar a revisão de requisitos.</p></div><span className="badge">{demoDocuments.length} referências ilustrativas</span></div>
    <p className="pitch-caption">Documentos de demonstração, sem arquivos anexados ou verificação.</p>
    <ul className="pitch-documents">{demoDocuments.map(doc => <li key={doc.tipo}><span className="pitch-file" aria-hidden="true">PDF</span><div><h3>{doc.titulo}</h3><p>{documentTypes[doc.tipo]} · Validade de exemplo: {doc.validade}</p></div><span className="pitch-pending">Não verificado</span></li>)}</ul>
  </section>;
  if (tab === 'pendencias') {
    const missing = (Object.keys(profile) as (keyof Profile)[]).filter(key => !profile[key] || Array.isArray(profile[key]) && !profile[key].length);
    return <section className="card"><h2>Pendências e revisão</h2><p>Uma visão clara do que está preenchido e do que ainda precisa de comprovação.</p>
      <div className="pitch-review"><span className="badge">{missing.length ? `${missing.length} ${missing.length === 1 ? 'campo pendente' : 'campos pendentes'}` : 'Cadastro preenchido'}</span><p>{missing.length ? missing.map(key => profileLabels[key]).join(' · ') : 'Informações cadastrais e capacidades organizadas para a próxima etapa.'}</p></div>
      <h3>Verificação de evidências</h3><ul>{demoDocuments.map(doc => <li key={doc.tipo}>{doc.titulo} · referência ilustrativa, aguardando evidência real e revisão.</li>)}</ul><p className="pitch-caption">Preenchimento não significa habilitação. A avaliação depende dos requisitos de cada edital e de revisão humana.</p>
    </section>;
  }
  if (tab === 'tecnica') return <section className="card"><h2>Capacidade técnica</h2><p>Experiência, projetos e especialidades declarados pela empresa.</p><Facts company={profile} technical /><div className="pitch-review"><span className="badge">Declarações organizadas</span><p>Capacidades separadas das evidências para uma avaliação rastreável.</p></div></section>;
  return <section className="card"><div className="pitch-section-heading"><div><h2>Visão geral</h2><p>Perfil empresarial estruturado e reutilizável.</p></div><span className="badge">Informações declaradas</span></div><Facts company={profile} /></section>;
}
