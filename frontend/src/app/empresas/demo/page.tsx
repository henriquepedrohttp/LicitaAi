'use client';
import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';
import { ProfileForm } from '../profile-form';
import type { Profile } from '../contracts';
import DemoSection from './sections';
import { demoDocuments, demoProfile } from './example';
import { MAX_DEMO_FILE, parseDemo, readDemo, saveDemo, serializeDemo, subscribeDemo } from './storage';

export default function Demo() {
  // shortcut: persistência local do pitch, usar cadastro privado para dados reais e exportar para trocar de notebook.
  const stored = useSyncExternalStore(subscribeDemo, readDemo, () => null);
  let profile: Profile = demoProfile;
  let loadError = '';
  try { if (stored) profile = parseDemo(stored); }
  catch { loadError = 'Não foi possível ler a configuração salva. Seus dados não foram apagados. Importe uma cópia ou restaure o exemplo.'; }
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState('geral');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  return <>
    <p className="pitch-demo-label">Demonstração · Dados fictícios · Configuração mantida neste navegador</p>
    {(error || loadError) && <p className="alert" role="alert">{error || loadError}</p>}
    <section className="card pitch-profile"><div className="pitch-identity"><div className="pitch-avatar" aria-hidden="true">AT</div><div><span className="pitch-caption">PERFIL EMPRESARIAL</span><h2>{profile.nome_fantasia || profile.razao_social}</h2><p>{profile.segmento} · {profile.municipio}/{profile.uf}</p><p className="pitch-caption">CNPJ {profile.cnpj} · {profile.porte}</p></div></div><button disabled={editing} onClick={() => { setTab('geral'); setEditing(true); setNotice(''); }}>Editar perfil</button></section>
    <div className="pitch-stats"><div><strong>{profile.areas_atuacao.length}</strong><span>áreas de atuação</span></div><div><strong>{profile.capacidades.length}</strong><span>capacidades declaradas</span></div><div><strong>{demoDocuments.length}</strong><span>referências documentais ilustrativas</span></div></div>
    {notice && <p role="status" className="notice">{notice}</p>}
    {editing ? <ProfileForm current={profile} section={tab === 'tecnica' ? 'tecnica' : 'geral'} save={async payload => {
      saveDemo(payload); setEditing(false); setError(''); setNotice('Perfil de demonstração salvo neste navegador. Você pode recarregar a página.');
    }} cancel={() => setEditing(false)} /> : <>
      <nav className="tabs" aria-label="Seções do perfil demonstrativo">{[['geral', 'Visão geral'], ['tecnica', 'Capacidade técnica'], ['documentos', 'Documentos'], ['pendencias', 'Pendências']].map(([value, label]) => <button key={value} aria-pressed={tab === value} onClick={() => { setTab(value); setNotice(''); }}>{label}</button>)}</nav>
      <DemoSection tab={tab} profile={profile} />
      {tab === 'tecnica' && <button className="secondary" onClick={() => { setEditing(true); setNotice(''); }}>Editar capacidade técnica</button>}
    </>}
    {!editing && <details className="card"><summary>Levar configuração para outro notebook</summary><p>Exporte o perfil, copie o arquivo para o outro notebook e importe aqui. O arquivo contém apenas a configuração demonstrativa, sem chave ou documentos empresariais.</p>
      <div className="actions"><button className="secondary" onClick={() => {
        const url = URL.createObjectURL(new Blob([serializeDemo(profile)], { type: 'application/json' }));
        const link = document.createElement('a'); link.href = url; link.download = 'licitaai-empresa-pitch.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}>Exportar perfil do pitch</button><label>Importar perfil do pitch<input type="file" accept="application/json,.json" onChange={async event => {
        const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (!file) return;
        try {
          if (file.size > MAX_DEMO_FILE) throw new Error('Configuração excede o limite de 128 KiB.');
          const imported = parseDemo(await file.text()); saveDemo(imported); setTab('geral'); setError(''); setNotice('Perfil importado e salvo neste navegador.');
        } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível importar o perfil.'); }
      }} /></label></div>
    </details>}
    <div className="actions"><button className="secondary" onClick={() => {
      if (!window.confirm('Restaurar o exemplo substitui a configuração salva neste navegador. Exporte uma cópia se quiser preservá-la. Continuar?')) return;
      try { saveDemo(demoProfile); setTab('geral'); setEditing(false); setError(''); setNotice('Exemplo fictício restaurado e salvo.'); }
      catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível restaurar o exemplo.'); }
    }}>Restaurar exemplo fictício</button><Link href="/empresas/cadastro">Cadastro privado</Link></div>
  </>;
}
