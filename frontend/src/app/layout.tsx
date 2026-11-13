import type { Metadata } from "next";
import { Manrope, Source_Sans_3 } from "next/font/google";
import Nav from "./nav";
import "./globals.css";
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
const source = Source_Sans_3({ subsets: ["latin"], variable: "--font-source", display: "swap" });
export const metadata: Metadata = { title: "LicitaAI", description: "Requisitos verificáveis e decisões revisáveis" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" className={`${manrope.variable} ${source.variable}`}><body><div className="shell"><Nav /><div className="content"><main>{children}</main><footer>LicitaAI: apoio à análise de licitações, sempre com revisão humana. Protótipo.</footer></div></div></body></html>;
}
