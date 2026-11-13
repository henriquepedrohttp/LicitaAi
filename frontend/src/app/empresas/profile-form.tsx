'use client';
import { useState } from 'react';
import { emptyProfile, profileLabels, profilePayload, type Profile } from './contracts';
import { profileError } from './validation';

const general: (keyof Profile)[] = ['razao_social', 'nome_fantasia', 'cnpj', 'porte', 'municipio', 'uf', 'segmento', 'cnae_principal', 'cnaes_secundarios', 'produtos_servicos', 'areas_atuacao'];
const technical: (keyof Profile)[] = ['capacidades', 'experiencia', 'projetos', 'tecnologias'];
const long = ['produtos_servicos', 'capacidades', 'experiencia', 'projetos', 'tecnologias', 'areas_atuacao', 'cnaes_secundarios'];
export function ProfileForm({ current, section = 'geral', save, cancel }: {
  current?: Profile; section?: 'geral' | 'tecnica'; save: (payload: Profile) => Promise<void>; cancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const profile = current ?? emptyProfile;
  return <form className="card" onSubmit={async event => {
    event.preventDefault(); const payload = profilePayload(new FormData(event.currentTarget), profile);
    const invalid = profileError(payload);
    if (invalid) { setError(invalid); return; }
    payload.cnpj = payload.cnpj.trim().toUpperCase().replace(/[./-]/g, '');
    setBusy(true); setError('');
    try { await save(payload); } catch (err) { setError(err instanceof Error ? err.message : 'Falha de conexão. Tente novamente.'); } finally { setBusy(false); }
  }}><fieldset disabled={busy}><legend>{current ? 'Editar' : 'Cadastrar empresa'} · {section === 'geral' ? 'Informações cadastrais' : 'Capacidade técnica'}</legend>
    <p>Razão social e CNPJ são obrigatórios. Os demais campos podem ser preenchidos aos poucos. Todas as informações são declarações do usuário.</p>
    <div className="fields">{(section === 'geral' ? general : technical).map(name => {
      const value = profile[name]; const text = Array.isArray(value) ? value.join('\n') : value ?? '';
      return <label key={name}>{profileLabels[name]}{['razao_social', 'cnpj'].includes(name) ? ' *' : ''}
        {name === 'porte' ? <select name={name} defaultValue={text}><option value="">Não informado</option>{['MEI', 'ME', 'EPP', 'demais'].map(v => <option key={v} value={v}>{v === 'demais' ? 'Demais' : v}</option>)}</select>
          : name === 'uf' ? <select name={name} defaultValue={text}><option value="">Não informado</option>{'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ').map(v => <option key={v}>{v}</option>)}</select>
          : long.includes(name) ? <textarea name={name} defaultValue={text} maxLength={Array.isArray(value) ? 25000 : 5000} />
          : <input name={name} defaultValue={text} required={name === 'razao_social' || name === 'cnpj'} minLength={name === 'razao_social' ? 2 : undefined} maxLength={name === 'cnpj' ? 18 : name === 'cnae_principal' ? 7 : 200} pattern={name === 'cnae_principal' ? '[0-9]{7}' : undefined} />}
        {Array.isArray(value) && <small>Um item por linha. {name === 'cnaes_secundarios' ? 'Sete dígitos por CNAE.' : 'Até 50 itens, com até 500 caracteres cada.'}</small>}
        {name === 'cnpj' && <small>Numérico ou alfanumérico, com ou sem pontuação. Não consultamos bases cadastrais.</small>}
      </label>;
    })}</div><div className="actions"><button type="submit">{busy ? 'Salvando…' : 'Salvar empresa'}</button><button type="button" className="secondary" onClick={cancel}>Cancelar edição</button></div>
  </fieldset>{error && <p role="alert" className="alert">{error}</p>}</form>;
}
