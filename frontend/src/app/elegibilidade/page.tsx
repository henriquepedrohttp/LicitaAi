import { AccessGate, AccessProvider } from '../empresas/access';
import Workspace, { type Inicial } from './workspace';
import './elegibilidade.css';

const CAMPOS = ['documento', 'empresa', 'categoria', 'estado', 'criticidade', 'revisao', 'item'] as const;

export default async function ElegibilidadePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const inicial = Object.fromEntries(CAMPOS.flatMap(c => typeof params[c] === 'string' ? [[c, params[c].slice(0, 100)]] : [])) as Inicial;
  return <div className="elegibilidade">
    <div className="eyebrow">LICITAAI / ELEGIBILIDADE</div>
    <h1>Matriz de Elegibilidade</h1>
    <p>Compare os requisitos do edital com as evidências da empresa. O resultado é preliminar e não declara habilitação jurídica: a conclusão é sempre humana.</p>
    <p className="notice">A matriz expõe dados privados da empresa e usa a mesma chave de acesso de Empresas.</p>
    <AccessProvider><AccessGate><Workspace inicial={inicial} /></AccessGate></AccessProvider>
  </div>;
}
