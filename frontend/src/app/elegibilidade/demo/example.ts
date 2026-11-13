import type { Evidence } from '../../empresas/contracts';
import type { Avaliacao, Categoria, Estado, Evidencia, Item } from '../contracts';
import edital from '../../demo/edital.json';

// Cenário exclusivamente demonstrativo para o pitch: edital, empresa e documentos fictícios, sem backend.
const EDITAL = { id: edital.id, nome: edital.arquivo, sha: edital.sha256 };
const EMPRESA_ID = 'demo-aurora';
const AUTOR_DEMO = 'Marina Costa (analista)';
const CRIADA = '2026-11-13T13:05:00-03:00';

const doc = (id: string, titulo: string, tipo: Evidence['tipo'], validade: string | null, vencido = false): Evidence => ({
  id, empresa_id: EMPRESA_ID, anterior_id: null, versao: 1, titulo, tipo, validade, enviado_em: '2026-11-10T10:00:00-03:00',
  excluido_em: null, tamanho: 180_000, sha256: id.padEnd(64, '0'), atual: true, vencido, verificacao: 'nao_verificado', referencia: id,
});

export const demoEvidencias: Evidence[] = [
  doc('demo-doc-contrato', 'Contrato social consolidado', 'juridico', null),
  doc('demo-doc-cnd', 'Certidão de regularidade fiscal federal (CND)', 'fiscal_trabalhista', '2027-06-30'),
  doc('demo-doc-fgts', 'Certificado de regularidade do FGTS (CRF)', 'fiscal_trabalhista', '2026-10-30', true),
  doc('demo-doc-balanco', 'Balanço patrimonial e demonstrações contábeis 2025', 'economico_financeiro', '2027-12-31'),
  doc('demo-doc-atestado', 'Atestado de capacidade técnica - Portal Conecta', 'atestado_tecnico', null),
];

const ev = (id: string, origem: Evidencia['origem'] = 'sugerida_por_regra'): Evidencia => {
  const d = demoEvidencias.find(e => e.id === id)!;
  return { documento_id: d.id, titulo: d.titulo, tipo: d.tipo, versao: d.versao, sha256: d.sha256, validade: d.validade, vencido: d.vencido, origem };
};

type Base = { n: number; titulo: string; categoria: Categoria; original: string; trecho: string; estado: Estado; regra: string;
  justificativa: string; evidencias?: Evidencia[]; incertezas?: string[]; quantidades?: Item['automatico']['quantidades']; metodo?: string };

function item(b: Base): Item {
  const evidencias = b.evidencias ?? [];
  const pagina = edital.requisitos.find(r => r.trecho === b.trecho)?.pagina;
  if (!pagina) throw new Error(`Trecho da demo ausente do edital: ${b.titulo}`);
  return {
    id: `demo-item-${b.n}`, categoria: b.categoria, categoria_original: b.original, estado: b.estado, origem_estado: 'automatico',
    justificativa: b.justificativa, evidencias, criticidade: null, revisado: false, reconferir: null, versao: 1, observacoes: [], historico: [],
    requisito: { id: `demo-req-${b.n}`, title: b.titulo, category: b.original, review_status: 'confirmed', version: 1,
      source: { document_id: EDITAL.id, filename: EDITAL.nome, sha256: EDITAL.sha, page: pagina, excerpt: b.trecho, verified: true } },
    automatico: { estado: b.estado, justificativa: b.justificativa, regra: b.regra, metodo: b.metodo ?? 'regra_deterministica',
      incertezas: b.incertezas ?? [], quantidades: b.quantidades ?? [], declaracoes_relacionadas: [], evidencias },
  };
}

const especialista = 'encaminhamento_revisao_humana';
const itens: Item[] = [
  item({ n: 1, titulo: 'Apresentar ato constitutivo (contrato social) em vigor', categoria: 'habilitacao_juridica', original: 'legal',
    trecho: '8.2.1. Ato constitutivo, estatuto ou contrato social em vigor, devidamente registrado, acompanhado de todas as alterações ou da consolidação respectiva.',
    estado: 'atendido_preliminarmente', regra: 'documento_correspondente', evidencias: [ev('demo-doc-contrato')],
    justificativa: 'Documento atual da categoria com título correspondente ao requisito e sem vencimento informado.',
    incertezas: ['Correspondência pelo título; o conteúdo do documento não foi lido pelo sistema.'] }),
  item({ n: 2, titulo: 'Declaração de que não emprega menor de 18 anos em trabalho noturno, perigoso ou insalubre', categoria: 'habilitacao_juridica', original: 'legal',
    trecho: '8.2.5. Declaração de que não emprega menor de dezoito anos em trabalho noturno, perigoso ou insalubre e não emprega menor de dezesseis anos, salvo na condição de aprendiz.',
    estado: 'nao_verificado', regra: 'sem_correspondencia',
    justificativa: 'Há documentos da categoria, mas nenhum título corresponde aos termos do requisito. Associe manualmente se aplicável.' }),
  item({ n: 3, titulo: 'Prova de regularidade fiscal perante a Fazenda Nacional (CND conjunta RFB/PGFN)', categoria: 'fiscal_social_trabalhista', original: 'fiscal',
    trecho: '8.3.2. Prova de regularidade fiscal perante a Fazenda Nacional, mediante certidão conjunta emitida pela Receita Federal do Brasil e pela Procuradoria-Geral da Fazenda Nacional.',
    estado: 'atendido_preliminarmente', regra: 'documento_correspondente', evidencias: [ev('demo-doc-cnd')],
    justificativa: 'Documento atual da categoria com título correspondente ao requisito e validade em 30/06/2027.',
    incertezas: ['Correspondência pelo título; o conteúdo do documento não foi lido pelo sistema.'] }),
  item({ n: 4, titulo: 'Prova de regularidade relativa ao FGTS (CRF)', categoria: 'fiscal_social_trabalhista', original: 'fiscal',
    trecho: '8.3.4. Prova de regularidade relativa ao Fundo de Garantia por Tempo de Serviço (FGTS), demonstrando situação regular no cumprimento dos encargos sociais.',
    estado: 'nao_atendido', regra: 'documento_vencido', evidencias: [ev('demo-doc-fgts')],
    justificativa: 'Todos os documentos correspondentes estão com a validade informada vencida (2026-10-30). Emita um CRF atualizado antes da sessão.' }),
  item({ n: 5, titulo: 'Prova de inexistência de débitos trabalhistas (CNDT)', categoria: 'fiscal_social_trabalhista', original: 'fiscal',
    trecho: '8.3.5. Prova de inexistência de débitos inadimplidos perante a Justiça do Trabalho, mediante a apresentação de Certidão Negativa de Débitos Trabalhistas (CNDT).',
    estado: 'nao_verificado', regra: 'sem_correspondencia',
    justificativa: 'Há documentos da categoria, mas nenhum título corresponde aos termos do requisito. Ausência de evidência é informação insuficiente, não descumprimento.' }),
  item({ n: 6, titulo: 'Balanço patrimonial e demonstrações contábeis do último exercício social', categoria: 'economico_financeira', original: 'financial',
    trecho: '8.4.1. Balanço patrimonial e demonstrações contábeis do último exercício social, já exigíveis e apresentados na forma da lei.',
    estado: 'atendido_preliminarmente', regra: 'documento_correspondente', evidencias: [ev('demo-doc-balanco')],
    justificativa: 'Documento atual da categoria com título correspondente ao requisito e validade em 31/12/2027.',
    incertezas: ['Correspondência pelo título; o conteúdo do documento não foi lido pelo sistema.'] }),
  item({ n: 7, titulo: 'Índices de Liquidez Geral, Solvência Geral e Liquidez Corrente superiores a 1', categoria: 'economico_financeira', original: 'financial',
    trecho: '8.4.2. A comprovação da boa situação financeira será feita por meio dos índices de Liquidez Geral (LG), Solvência Geral (SG) e Liquidez Corrente (LC), que deverão ser superiores a 1 (um).',
    estado: 'revisao_especializada', regra: 'indice_contabil', metodo: especialista, evidencias: [ev('demo-doc-balanco')],
    justificativa: 'Exigência de índice ou valor contábil: requer conferência contábil das demonstrações.',
    incertezas: ['Empresas não fornece demonstrações estruturadas para cálculo.'], quantidades: [{ valor: '1', unidade: '', texto: 'superiores a 1' }] }),
  item({ n: 8, titulo: 'Atestado de capacidade técnica em plataforma digital compatível com o objeto', categoria: 'qualificacao_tecnica', original: 'technical',
    trecho: '8.5.1. Atestado(s) de capacidade técnica, fornecido(s) por pessoa jurídica de direito público ou privado, que comprove(m) a execução de serviços compatíveis em características com o objeto desta licitação.',
    estado: 'revisao_especializada', regra: 'termo_interpretativo', metodo: especialista, evidencias: [ev('demo-doc-atestado')],
    justificativa: 'O texto usa termo que exige interpretação ("compativeis").',
    incertezas: ['Critério de equivalência não definido de forma objetiva no trecho.'] }),
  item({ n: 9, titulo: 'Atestado comprovando plataforma com no mínimo 5.000 usuários ativos', categoria: 'qualificacao_tecnica', original: 'technical',
    trecho: '8.5.2. Para fins de comprovação de capacidade técnica, o(s) atestado(s) deverá(ão) demonstrar a operação de plataforma com, no mínimo, 5.000 usuários ativos.',
    estado: 'revisao_especializada', regra: 'quantitativo_sem_dado_estruturado', metodo: especialista, evidencias: [ev('demo-doc-atestado')],
    justificativa: 'Exigência quantitativa (5.000 usuários): os atestados não possuem quantidades estruturadas para comparação.',
    incertezas: ['Conteúdo dos atestados não foi lido pelo sistema.'], quantidades: [{ valor: '5.000', unidade: 'usuários', texto: '5.000 usuários' }] }),
  item({ n: 10, titulo: 'Prestar garantia de execução de 5% do valor do contrato', categoria: 'contratual', original: 'contractual',
    trecho: '15.1. O adjudicatário deverá prestar garantia de execução do contrato no percentual de 5% (cinco por cento) do valor contratual, no prazo de 10 dias úteis após a assinatura.',
    estado: 'revisao_especializada', regra: 'obrigacao_contratual', metodo: especialista,
    justificativa: 'Obrigação de execução contratual: depende de interpretação jurídica/comercial, não de documento cadastrado.',
    quantidades: [{ valor: '5', unidade: '%', texto: '5%' }, { valor: '10', unidade: 'dias', texto: '10 dias' }] }),
];

// Um item já revisado por analista mostra como fica a conclusão humana com histórico.
const revisado = itens[7];
Object.assign(revisado, {
  estado: 'atendido_preliminarmente', origem_estado: 'humano', revisado: true, criticidade: 'alta', versao: 2,
  justificativa: 'Atestado do Portal Conecta cobre portal de serviços digitais com atendimento ao cidadão, mesmo escopo do objeto.',
  historico: [{ acao: 'corrigir', autor: AUTOR_DEMO, justificativa: 'Atestado do Portal Conecta cobre portal de serviços digitais com atendimento ao cidadão, mesmo escopo do objeto.',
    em: '2026-11-13T13:20:00-03:00', antes: { estado: 'revisao_especializada' }, depois: { estado: 'atendido_preliminarmente' } }],
} satisfies Partial<Item>);

export const demoAvaliacao: Avaliacao = {
  id: 'demo-avaliacao', documento_id: EDITAL.id, documento_nome: EDITAL.nome, documento_sha256: EDITAL.sha,
  oportunidade_pncp: edital.pncp, empresa_id: EMPRESA_ID, empresa_nome: 'Aurora Tecnologia e Soluções Digitais Ltda.',
  empresa_cnpj: '11.222.333/0001-81', empresa_revisao: 3, criada_em: CRIADA, atualizada_em: '2026-11-13T13:20:00-03:00',
  processamento: 'concluido', requisitos_excluidos: 1, itens,
  avisos: ['Resultado preliminar de apoio à decisão; não constitui habilitação jurídica nem parecer.',
    'Documentos e capacidades da empresa não foram verificados quanto a autenticidade ou conteúdo.',
    'Ausência de evidência é tratada como informação insuficiente (não verificado), nunca como descumprimento.'],
};

/** Aplica uma revisão localmente, com as mesmas regras de estado e histórico do backend. */
export function revisarDemo(item: Item, acao: string, autor: string, justificativa: string, extra: Record<string, unknown>): Item {
  const em = new Date().toISOString();
  const evento = (antes: Record<string, unknown> | null, depois: Record<string, unknown> | null) => ({ acao, autor, justificativa, em, antes, depois });
  const proximo: Item = { ...item, versao: item.versao + 1, reconferir: null };
  if (acao === 'observacao') return { ...proximo, observacoes: [...item.observacoes, { autor, texto: justificativa, em }], historico: [...item.historico, evento(null, null)] };
  if (acao === 'criticidade') return { ...proximo, criticidade: extra.criticidade as Item['criticidade'], historico: [...item.historico, evento({ criticidade: item.criticidade }, { criticidade: extra.criticidade })] };
  if (acao === 'evidencias') {
    const ids = extra.evidencias as string[];
    const evidencias = ids.map(id => ev(id, item.evidencias.some(e => e.documento_id === id && e.origem === 'sugerida_por_regra') ? 'sugerida_por_regra' : 'associada_por_analista'));
    return { ...proximo, evidencias, historico: [...item.historico, evento({ evidencias: item.evidencias.map(e => e.titulo) }, { evidencias: evidencias.map(e => e.titulo) })] };
  }
  const estado: Estado = acao === 'corrigir' ? extra.estado as Estado : acao === 'revisao_especializada' ? 'revisao_especializada' : item.estado;
  return { ...proximo, estado, origem_estado: 'humano', revisado: true, justificativa,
    historico: [...item.historico, evento({ estado: item.estado }, { estado })] };
}
