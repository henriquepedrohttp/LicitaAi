export type Opportunity = {
  id: string; fonte: "PNCP"; url_oficial: string; url_api: string; consultado_em: string;
  objeto: string | null; orgao: string | null; cnpj: string; municipio: string | null; uf: string | null;
  modalidade: string | null; numero: string | null; ano: number; valor_estimado: string | null;
  publicado_em: string | null; abertura_em: string | null; encerramento_em: string | null; atualizado_em: string | null;
  situacao: string | null; situacao_id: number | null; criterio_julgamento: string | null;
};
export type Document = { id: number; titulo: string | null; tipo: string | null; url: string; publicado_em: string | null };
export type Results = { oportunidades: Opportunity[]; total_fonte: number; total_paginas: number; pagina: number; tamanho: number; registros_na_pagina: number; consultado_em: string; cobertura: "pagina"; url_fonte: string; aviso: string };
/** Proposta v1: aguarda aceite do responsável por Análise; não dispara processamento. */
export type AnalysisHandoff = { versao: "1"; oportunidade: Opportunity; documentos: Document[]; documentos_completos: boolean; documentos_consultados_em: string | null; referencias: string[] };
export type Detail = { oportunidade: Opportunity; documentos: Document[]; documentos_pagina: number; documentos_proxima_pagina: boolean; documentos_consultados_em: string | null; avisos: string[]; encaminhamento: AnalysisHandoff; analise_disponivel: false };
