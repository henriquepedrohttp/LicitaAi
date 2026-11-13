'use client';
import { createContext, useContext, useState, type ReactNode } from 'react';

type Access = { key: string; setKey: (key: string) => void };
const AccessContext = createContext<Access>({ key: '', setKey: () => {} });
export function AccessProvider({ children }: { children: ReactNode }) {
  const [key, setKey] = useState('');
  return <AccessContext.Provider value={{ key, setKey }}>{children}</AccessContext.Provider>;
}
export const useAccess = () => useContext(AccessContext);

export async function empresasRequest(key: string, path = '', init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${key}`);
  const response = await fetch(`/api/empresas${path}`, { ...init, headers, cache: 'no-store', signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(35000)]) : AbortSignal.timeout(35000) });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const detail = payload?.detail;
    if (typeof detail === 'string') throw new Error(detail);
    if (Array.isArray(detail)) throw new Error('Confira os campos: ' + detail.map(item => `${item.loc?.slice(1).join('.')}: ${item.msg}`).join('; '));
    throw new Error('Não foi possível concluir a operação. Tente novamente.');
  }
  return response;
}

export function AccessGate({ children }: { children: ReactNode }) {
  const { key, setKey } = useAccess();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (key) return children;
  return <section className="card"><h2>Acesso ao workspace empresarial</h2><p>Área privada do piloto, com uma chave compartilhada pelos responsáveis deste workspace. A chave permanece somente na memória desta aba; recarregar exige novo acesso.</p><p>Multiusuário e isolamento entre organizações ainda não estão disponíveis. Use apenas dados de demonstração ou autorizados para este piloto.</p>
    <form onSubmit={async event => { event.preventDefault(); const value = String(new FormData(event.currentTarget).get('key')); setBusy(true); setError('');
      try { await empresasRequest(value); setKey(value); } catch (err) { setError(err instanceof Error ? err.message : 'Erro de conexão. Tente novamente.'); } finally { setBusy(false); }
    }}><label>Chave privada de acesso<input name="key" type="password" required minLength={32} maxLength={512} autoComplete="off" /></label><button disabled={busy}>{busy ? 'Verificando acesso…' : 'Acessar Empresas'}</button></form>
    {error && <p role="alert">{error}</p>}</section>;
}
