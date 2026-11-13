import { emptyProfile, type Profile } from '../contracts';
import { profileError } from '../validation';

export const DEMO_KEY = 'licitaai.empresas.demo.v1';
export const MAX_DEMO_FILE = 128 * 1024;
const changed = 'licitaai-empresas-demo-changed';

export function parseDemo(text: string): Profile {
  if (text.length > MAX_DEMO_FILE || new TextEncoder().encode(text).length > MAX_DEMO_FILE) throw new Error('Configuração excede o limite de 128 KiB.');
  const data: unknown = JSON.parse(text);
  if (!data || typeof data !== 'object' || !('formato' in data) || data.formato !== DEMO_KEY || !('perfil' in data)) throw new Error('Arquivo de configuração de Empresas inválido.');
  const profile = data.perfil;
  if (!profile || typeof profile !== 'object' || Array.isArray(profile) || Object.keys(profile).length !== Object.keys(emptyProfile).length) throw new Error('Perfil incompleto ou com campos desconhecidos.');
  for (const name of Object.keys(emptyProfile) as (keyof Profile)[]) {
    if (!(name in profile)) throw new Error('Perfil incompleto.');
    const value = (profile as Record<string, unknown>)[name];
    if (Array.isArray(emptyProfile[name])) {
      if (!Array.isArray(value) || value.length > 50 || value.some(item => typeof item !== 'string' || !item.trim() || item.length > 500)) throw new Error('Lista de configuração inválida.');
    } else {
      const optional = name !== 'razao_social' && name !== 'cnpj';
      const limit = ['produtos_servicos', 'experiencia', 'projetos'].includes(name) ? 5000 : 200;
      if (!(optional && value === null) && (typeof value !== 'string' || value.length > limit)) throw new Error('Campo de configuração inválido.');
    }
  }
  const result = profile as Profile;
  const error = profileError(result);
  if (error) throw new Error(error);
  if (result.porte !== null && !['MEI', 'ME', 'EPP', 'demais'].includes(result.porte)) throw new Error('Porte inválido.');
  if (result.uf !== null && !'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ').includes(result.uf)) throw new Error('UF inválida.');
  return result;
}

export function serializeDemo(profile: Profile): string {
  const text = JSON.stringify({ formato: DEMO_KEY, perfil: profile }, null, 2);
  parseDemo(text);
  return text;
}

export function readDemo(): string | null {
  try { return window.localStorage.getItem(DEMO_KEY); }
  catch { return 'armazenamento-indisponivel'; }
}

export function saveDemo(profile: Profile): void {
  const text = serializeDemo(profile);
  try { window.localStorage.setItem(DEMO_KEY, text); }
  catch { throw new Error('Não foi possível salvar neste navegador. Libere o armazenamento e tente novamente.'); }
  window.dispatchEvent(new Event(changed));
}

export function subscribeDemo(notify: () => void): () => void {
  window.addEventListener('storage', notify);
  window.addEventListener(changed, notify);
  return () => { window.removeEventListener('storage', notify); window.removeEventListener(changed, notify); };
}
