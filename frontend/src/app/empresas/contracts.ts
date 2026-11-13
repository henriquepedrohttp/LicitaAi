export const documentTypes = {
  juridico: 'Documentação jurídica', fiscal_trabalhista: 'Certidões fiscais e trabalhistas',
  atestado_tecnico: 'Atestados técnicos', economico_financeiro: 'Documentação econômico-financeira', outro: 'Outros documentos',
} as const;
export type DocumentType = keyof typeof documentTypes;
export type Profile = {
  razao_social: string; nome_fantasia: string | null; cnpj: string;
  porte: 'MEI' | 'ME' | 'EPP' | 'demais' | null; cnae_principal: string | null; cnaes_secundarios: string[];
  municipio: string | null; uf: string | null; segmento: string | null; produtos_servicos: string | null;
  areas_atuacao: string[]; capacidades: string[]; experiencia: string | null; projetos: string | null; tecnologias: string[];
};
export type Company = Profile & {
  id: string; revisao: number; criado_em: string; atualizado_em: string; documentos_quantidade: number;
  campos_pendentes: (keyof Profile)[]; preenchimento: 'parcial' | 'campos_preenchidos'; origem: 'declarado';
};
export type Evidence = {
  id: string; empresa_id: string; anterior_id: string | null; versao: number; titulo: string; tipo: DocumentType;
  validade: string | null; enviado_em: string; excluido_em: string | null; tamanho: number; sha256: string;
  atual: boolean; vencido: boolean; verificacao: 'nao_verificado'; referencia: string;
};
export type EligibilityContext = {
  contrato: 'empresas.elegibilidade.v1'; consultado_em: string; empresa: Company;
  declaracoes_verificadas: false; documentos: Evidence[]; avisos: string[];
};
export const profileLabels: Record<keyof Profile, string> = {
  razao_social: 'Razão social', nome_fantasia: 'Nome fantasia', cnpj: 'CNPJ', porte: 'Porte empresarial',
  cnae_principal: 'CNAE principal', cnaes_secundarios: 'CNAEs secundários', municipio: 'Município', uf: 'UF',
  segmento: 'Segmento de atuação', produtos_servicos: 'Produtos e serviços', areas_atuacao: 'Áreas de atuação',
  capacidades: 'Capacidades técnicas declaradas', experiencia: 'Experiência anterior', projetos: 'Projetos executados', tecnologias: 'Tecnologias e especialidades',
};
export const emptyProfile: Profile = {
  razao_social: '', nome_fantasia: null, cnpj: '', porte: null, cnae_principal: null, cnaes_secundarios: [], municipio: null,
  uf: null, segmento: null, produtos_servicos: null, areas_atuacao: [], capacidades: [], experiencia: null, projetos: null, tecnologias: [],
};
export function profilePayload(data: FormData, current: Profile): Profile {
  return Object.fromEntries(Object.keys(emptyProfile).map(key => {
    const name = key as keyof Profile;
    if (!data.has(key)) return [key, current[name]];
    const value = String(data.get(key) ?? '').trim();
    if (name === 'razao_social' || name === 'cnpj') return [key, value];
    return [key, Array.isArray(emptyProfile[name]) ? value.split('\n').map(s => s.trim()).filter(Boolean) : value || null];
  })) as Profile;
}
