/** Espelho de backend/app/elegibilidade/schemas.py. */
export const estados = {
  atendido_preliminarmente: 'Atendido preliminarmente', nao_atendido: 'Não atendido',
  nao_verificado: 'Não verificado', revisao_especializada: 'Revisão especializada',
} as const;
export const categorias = {
  habilitacao_juridica: 'Habilitação jurídica', qualificacao_tecnica: 'Qualificação técnica',
  fiscal_social_trabalhista: 'Fiscal, social e trabalhista', economico_financeira: 'Econômico-financeira',
  obrigacao_operacional: 'Obrigação operacional', contratual: 'Contratual', nao_classificada: 'Não classificada',
} as const;
export const criticidades = { alta: 'Alta', media: 'Média', baixa: 'Baixa' } as const;
export type Estado = keyof typeof estados;
export type Categoria = keyof typeof categorias;
export type Criticidade = keyof typeof criticidades;

export type Fonte = { document_id: string; filename: string; sha256: string; page: number | null; excerpt: string; verified: boolean };
export type Evidencia = { documento_id: string; titulo: string; tipo: string; versao: number; sha256: string; validade: string | null; vencido: boolean; origem: 'sugerida_por_regra' | 'associada_por_analista' };
export type Evento = { acao: string; autor: string; justificativa: string; em: string; antes: Record<string, unknown> | null; depois: Record<string, unknown> | null };
export type Item = {
  id: string; categoria: Categoria; categoria_original: string; estado: Estado; origem_estado: 'automatico' | 'humano';
  justificativa: string; evidencias: Evidencia[]; criticidade: Criticidade | null; revisado: boolean; reconferir: string | null; versao: number;
  observacoes: { autor: string; texto: string; em: string }[]; historico: Evento[];
  requisito: { id: string; title: string; category: string; review_status: string; version: number; source: Fonte };
  automatico: { estado: Estado; justificativa: string; regra: string; metodo: string; incertezas: string[]; quantidades: { valor: string; unidade: string; texto: string }[]; declaracoes_relacionadas: string[]; evidencias: Evidencia[] };
};
export type Avaliacao = {
  id: string; documento_id: string; documento_nome: string; documento_sha256: string; oportunidade_pncp: string | null;
  empresa_id: string; empresa_nome: string; empresa_cnpj: string; empresa_revisao: number; criada_em: string; atualizada_em: string;
  processamento: 'concluido' | 'sem_requisitos'; requisitos_excluidos: number; avisos: string[]; itens: Item[];
};
export type Filtros = { categoria: string; estado: string; criticidade: string; revisao: string };
export const filtrosVazios: Filtros = { categoria: '', estado: '', criticidade: '', revisao: '' };

export function filtrar(itens: Item[], f: Filtros) {
  return itens.filter(i => (!f.categoria || i.categoria === f.categoria) && (!f.estado || i.estado === f.estado)
    && (!f.criticidade || (f.criticidade === 'nao_informada' ? i.criticidade === null : i.criticidade === f.criticidade))
    && (!f.revisao || (f.revisao === 'revisados' ? i.revisado && !i.reconferir : !i.revisado || !!i.reconferir)));
}

export function resumo(itens: Item[]) {
  const conta = (estado: Estado) => itens.filter(i => i.estado === estado).length;
  return { total: itens.length, atendido_preliminarmente: conta('atendido_preliminarmente'), nao_atendido: conta('nao_atendido'),
    nao_verificado: conta('nao_verificado'), revisao_especializada: conta('revisao_especializada'),
    pendentes: itens.filter(i => !i.revisado || i.reconferir).length };
}
