import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
export const metadata: Metadata = { title: "LicitaAI", description: "Requisitos verificáveis e decisões revisáveis" };
const areas = [["radar", "Radar"], ["analise", "Análise"], ["empresas", "Empresas"], ["elegibilidade", "Elegibilidade"], ["relatorios", "Relatórios"]];
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
 return <html lang="pt-BR"><body><header><Link href="/" className="brand">Licita<span>AI</span></Link><nav aria-label="Navegação principal">{areas.map(([path,label]) => <Link key={path} href={`/${path}`}>{label}</Link>)}</nav></header><main>{children}</main><footer>Apoio à análise com revisão humana · Protótipo em desenvolvimento</footer></body></html>;
}
