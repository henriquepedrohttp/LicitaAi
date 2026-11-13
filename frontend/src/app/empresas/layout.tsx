import { AccessProvider } from './access';
import './empresas.css';
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AccessProvider><div className="empresas"><div className="eyebrow">PERFIS E EVIDÊNCIAS</div><h1>Empresas</h1><p>Capacidades declaradas, documentos rastreáveis e pendências para revisão humana.</p>{children}</div></AccessProvider>;
}
