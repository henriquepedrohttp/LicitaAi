import { notFound } from "next/navigation";
const areas: Record<string,{title:string;description:string;next:string}> = {
 radar:{title:"Radar",description:"Encontre oportunidades com origem e data de consulta identificadas.",next:"Próxima entrega: consulta PNCP, filtros e seleção de oportunidade."},
 analise:{title:"Análise",description:"Confira requisitos ao lado do documento original.",next:"Próxima entrega: upload, extração por página, OCR e revisão rastreável."},
 empresas:{title:"Empresas",description:"Organize capacidades declaradas e evidências documentais separadamente.",next:"Próxima entrega: perfil fictício Aurora Sistemas e documentos de demonstração identificados."},
 elegibilidade:{title:"Elegibilidade",description:"Compare requisitos com evidências e registre pendências.",next:"Próxima entrega: matriz de comparação. Documento ausente significa não verificado."},
 relatorios:{title:"Relatórios",description:"Consolide fontes, cobertura, pendências e decisão humana.",next:"Próxima entrega: registro Go/No-Go com autor, justificativa e horário; HTML imprimível."}
};
export default async function Area({params}:{params:Promise<{area:string}>}){const {area}=await params;const content=areas[area];if(!content)notFound();return <><div className="eyebrow">LICITAAI / {content.title.toUpperCase()}</div><h1>{content.title}</h1><p>{content.description}</p><section className="card"><h2>Nenhuma oportunidade selecionada</h2><p>{content.next}</p><p className="notice">Módulo em construção.</p></section></>}
