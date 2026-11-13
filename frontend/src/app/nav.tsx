"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const icon = (d: string) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
const areas: { href: string; label: string; d: string; group?: string; soon?: boolean }[] = [
  { href: "/", label: "Início", d: "M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
  { href: "/radar", label: "Radar", d: "M12 12 19 5M12 3a9 9 0 1 0 9 9M12 7a5 5 0 1 0 5 5", group: "Licitações" },
  { href: "/analise", label: "Análise de editais", d: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6" },
  { href: "/elegibilidade", label: "Elegibilidade", d: "M9 12l2 2 4-4M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" },
  { href: "/empresas", label: "Empresa", d: "M4 21V7l8-4 8 4v14M9 21v-5h6v5M8 10h.01M12 10h.01M16 10h.01", group: "Sua empresa" },
  { href: "/relatorios", label: "Relatórios", d: "M5 21V10M12 21V4M19 21v-7" },
];

export default function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
  return <aside className={open ? "sidebar open" : "sidebar"}>
    <Link href="/" className="brand"><span className="brand-mark" aria-hidden="true">L</span><span className="brand-name">Licita<span>AI</span></span></Link>
    <button type="button" className="menu-toggle" aria-expanded={open} aria-controls="nav-principal" onClick={() => setOpen(v => !v)}>{open ? "Fechar" : "Menu"}</button>
    <nav id="nav-principal" className="nav" aria-label="Navegação principal" onClick={e => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}>
      {areas.map(a => <div key={a.href} style={{ display: "contents" }}>
        {a.group && <div className="nav-group">{a.group}</div>}
        <Link href={a.href} aria-current={active(a.href) ? "page" : undefined}>{icon(a.d)}{a.label}{a.soon && <small>em breve</small>}</Link>
      </div>)}
    </nav>
    <div className="sidebar-foot"><strong>Revisão humana sempre</strong>A IA organiza e aponta a fonte. A decisão final é sua.</div>
  </aside>;
}
