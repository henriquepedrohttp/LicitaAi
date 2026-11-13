import { type Profile, type DocumentType } from '../contracts';

// Modelo exclusivamente demonstrativo; CNPJ usado para testar formato, sem consulta cadastral.
export const demoProfile: Profile = {
  razao_social: 'Aurora Tecnologia e Soluções Digitais Ltda.',
  nome_fantasia: 'Aurora Tecnologia',
  cnpj: '11.222.333/0001-81',
  porte: 'EPP',
  municipio: 'Recife',
  uf: 'PE',
  segmento: 'Tecnologia da informação',
  cnae_principal: '6201501',
  cnaes_secundarios: ['6202300', '6204000'],
  produtos_servicos: 'Plataformas de gestão, portais de serviços digitais e soluções de comunicação em nuvem. Desenvolvimento, implantação, treinamento e suporte contínuo para equipes e organizações.',
  areas_atuacao: ['Desenvolvimento de software', 'Plataformas SaaS', 'Comunicação digital', 'Consultoria em TI'],
  capacidades: ['Desenvolvimento de aplicações web e APIs integradas', 'Implantação e operação de plataformas em nuvem', 'Integração de sistemas e migração de dados', 'Treinamento de usuários e suporte técnico'],
  experiencia: 'No cenário demonstrativo, a Aurora desenvolve e mantém plataformas digitais para organizações de educação e serviços, com atuação desde o levantamento de requisitos até a operação assistida.',
  projetos: 'Portal Conecta: centralização de serviços e atendimento digital.\nPlataforma Aprender: gestão de conteúdos e comunicação educacional.\nPainel Operações: indicadores e integração de dados gerenciais.',
  tecnologias: ['React e Next.js', 'Python e FastAPI', 'PostgreSQL', 'APIs REST', 'Infraestrutura em nuvem'],
};

// Metadados ilustrativos para o pitch; não representam arquivos enviados ou verificados.
export const demoDocuments: { titulo: string; tipo: DocumentType; validade: string }[] = [
  { titulo: 'Contrato social consolidado', tipo: 'juridico', validade: 'Não se aplica ao exemplo' },
  { titulo: 'Certidão de regularidade fiscal', tipo: 'fiscal_trabalhista', validade: '30/06/2027' },
  { titulo: 'Atestado de capacidade técnica — Portal Conecta', tipo: 'atestado_tecnico', validade: 'Não se aplica ao exemplo' },
  { titulo: 'Balanço patrimonial e demonstrações contábeis', tipo: 'economico_financeiro', validade: '31/12/2027' },
];
