import Link from "next/link";
import CompanyWorkspace from "./workspace";
export default function CompaniesPage(){return <><Link className="eyebrow" href="/analise">← Voltar para Análise</Link><h1>Empresas para comparação</h1><p>Cadastre evidências para comparar com as exigências do edital na área Análise.</p><CompanyWorkspace/></>;}
