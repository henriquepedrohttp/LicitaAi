# LicitaAI — Product Requirements Document (PRD)

**Versão:** 0.3 — escopo confirmado pelo proponente, sujeito à validação do time  
**Data:** 13/11/2026  
**Contexto:** Hackathon, estratégia B (analista de licitações experiente)  
**Status:** Em revisão colaborativa; escopo funcional confirmado pelo proponente, detalhes técnicos ainda propostos  
**Documento de origem:** `LicitaAI_Estudo_de_Caso_001_ALEPE.md`

> **Princípio orientador:** toda conclusão relevante deve ser explicável, verificável em fonte identificada e revisável por uma pessoa. O sistema presta apoio à análise; não atesta habilitação jurídica nem recomenda investimentos ou participação de forma definitiva.

## 0. Convenções de decisão

- **[CONFIRMADO]**: decisão explícita de escopo do proponente.
- **[BASE]**: informação obtida do estudo de caso ou de fonte identificada.
- **[PROPOSTA]**: orientação de produto recomendada, ainda sujeita à validação pelo time.
- **[HIPÓTESE]**: algo a comprovar com usuários ou testes.
- **[ABERTO]**: questão pendente.
- **P0**: indispensável para a demonstração do hackathon; **P1**: extensão valiosa; **P2**: pós-MVP.

## Decisões confirmadas nesta revisão

- **[CONFIRMADO] Escopo do MVP:** monitoramento de oportunidades, análise documental e elegibilidade preliminar são partes do produto demonstrável.
- **[CONFIRMADO] PDFs:** suportar PDFs com texto selecionável **e** documentos digitalizados por meio de OCR, com avisos de qualidade e cobertura.
- **[CONFIRMADO] Chat:** não faz parte do primeiro workspace/MVP. Será avaliado após estabilizar a experiência estruturada.
- **[CONFIRMADO] Entregáveis de alinhamento:** PRD editável em Markdown e versão PDF diagramada para validação do time.
- **[PROPOSTA] Fonte inicial de monitoramento:** PNCP, com filtros básicos, atualização sob demanda e checagem periódica; cobertura nacional e atualização em tempo real **não** são promessas do MVP.
- **[PROPOSTA] Elegibilidade no hackathon:** perfil e documentos fictícios ou devidamente autorizados, sem emissão de parecer jurídico definitivo.

## 1. Resumo executivo

### 1.1 Problema

[HIPÓTESE] Em operações recorrentes de licitações, equipes gastam tempo significativo lendo editais e anexos, extraindo requisitos, cruzando informações e documentando avaliações Go/No-Go. O fluxo pode gerar retrabalho e risco de omissões importantes. A frequência, o custo e a gravidade da dor ainda precisam ser medidos em entrevistas.

### 1.2 Solução

[PROPOSTA] Workspace que monitora oportunidades no PNCP, permite selecionar uma licitação, importa o conjunto documental, organiza requisitos individualizados e referências verificáveis, permite associar evidências empresariais e produz diagnóstico preliminar com revisão humana e relatório exportável.

### 1.3 Público-alvo

- **Primário:** analista de licitações de empresa fornecedora que já participa de processos competitivos.
- **Secundário:** gestor comercial ou líder de licitações, responsável pela priorização e aprovação da participação.
- **Colaborador eventual:** especialistas jurídico, financeiro e técnico que verificam exigências especializadas.

### 1.4 Valor esperado

- Diminuir tempo de triagem documental sem degradar a qualidade.
- Reduzir omissões de exigências críticas e facilitar conferência.
- Reaproveitar conhecimento documental da empresa.
- Produzir um relatório auditável, em vez de apenas um resumo conversacional.

### 1.5 Não objetivos

Não operar chat conversacional no primeiro MVP; não participar automaticamente de pregões; não emitir lances; não substituir profissional jurídico/contábil; não garantir habilitação, vitória ou legalidade da contratação; não prometer cobertura integral de portais no hackathon.

## 2. Contexto e evidências

### 2.1 Estudo de caso-base

[BASE] Pregão Eletrônico ALEPE nº 001/2026, Processo Licitatório nº 002/2026; sessão inicialmente prevista para 30/03/2026. Uso histórico e experimental, não oportunidade atual confirmada. Fonte documental: https://portal.tce.pe.gov.br/remessatcepe/services/licon/api/publico/webservice/documentos-download/externo?idDocumento=60404591&tipoFonteDocumento=PC

[BASE] Objeto abrange plataforma SaaS de comunicação/educação, aplicativos móveis e Smart TV, infraestrutura de vídeo, transmissão, suporte e demais serviços correlatos. O estudo identificou exigências quantitativas em atestados técnicos: 20 TB de armazenamento, 200 TB de streaming, 720 h/mês de transcodificação e 40 h/mês de estúdio, além de plataforma integrada com aplicativos. Também há exigências econômico-financeiras e prova de conceito presencial. Detalhes e limites no estudo original.

**Limite:** o estudo não equivale a revisão jurídica integral de todos os documentos e suas retificações.

### 2.2 Fontes regulatórias e de integração

- Lei nº 14.133/2021, art. 62 (categorias de habilitação): https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm
- PNCP, portal oficial: https://www.gov.br/pncp/pt-br/
- API pública de consulta do PNCP: https://pncp.gov.br/api/consulta/swagger-ui/index.html

[CONFIRMADO] Monitoramento entra no MVP. [PROPOSTA] PNCP é a primeira fonte; usar sincronização desacoplada, cache local, carimbo de atualização e opção de upload manual se a fonte estiver indisponível. Cobertura e condições de uso da API devem ser verificadas na implementação.

## 3. Personas e trabalhos a realizar (JTBD)

### P1. Analista de licitações — usuário principal

**Situação:** recebe ou encontra um edital e precisa avaliar sua viabilidade rapidamente.  
**Desejo:** identificar exigências e riscos com evidências, preparar checklist e levar diagnóstico ao gestor.  
**Frustrações hipotéticas:** PDFs extensos, requisitos dispersos, conferência repetida de anexos, necessidade de justificar conclusões.

**JTBD:** "Quando recebo um conjunto de editais e anexos, quero visualizar requisitos e pendências em formato auditável, para reduzir minha triagem manual e apoiar a decisão da equipe."

### P2. Gestor comercial / líder de licitações

**Situação:** precisa priorizar investimentos em propostas.  
**JTBD:** "Quero entender os principais bloqueios e incertezas, com fontes verificáveis e a posição do analista, antes de autorizar a participação."

### P3. Especialista técnico/jurídico/financeiro

**Situação:** recebe um requisito específico para validação.  
**JTBD:** "Quero verificar o trecho original e registrar minha conclusão sem procurar manualmente todo o edital."

## 4. Proposta de experiência

### 4.1 Jornada principal — ponta a ponta

1. Analista acessa o **Radar** e escolhe filtros (palavra-chave, órgão, UF, situação e datas quando disponíveis na fonte).
2. Serviço consulta o PNCP, grava a origem e a última sincronização e mostra novas oportunidades, com opção de atualização manual.
3. Analista seleciona uma oportunidade; sistema apresenta metadados oficiais e documentos associados **quando acessíveis**, ou solicita upload de documentos ausentes.
4. Analista importa edital, anexos e, se necessário, versões complementares; o sistema identifica arquivos duplicados por hash.
5. Pipeline extrai texto nativo e executa **OCR para páginas sem camada de texto utilizável**; registra confiança/qualidade por página, avisos e falhas.
6. Extrator cria requisitos atômicos e aponta documento/página/trecho; não inventa lacunas.
7. Analista revisa requisitos no **workspace PDF + matriz**, com destaque e histórico das alterações.
8. Analista seleciona o perfil da empresa e associa documentos de evidência; avaliações preliminares distinguem correspondência, ausência de comprovação, incompatibilidade fundamentada e revisão especializada.
9. Sistema consolida checklist, pendências e riscos; analista revisa e registra decisão humana Go/No-Go com justificativa.
10. Relatório exportado carrega fontes, versões, avisos, histórico de revisão e carimbo temporal dos dados do PNCP.

**Rotas alternativas:** oportunidades sem anexos → upload manual; falha PNCP → resultados em cache com aviso de desatualização; OCR insatisfatório → revisão manual e análise marcada como incompleta; falta de perfil → relatório de requisitos sem diagnóstico de elegibilidade.

### 4.2 Arquitetura de informação — cinco áreas de navegação, oito funcionalidades

[CONFIRMADO PELO PROPONENTE] A navegação principal do MVP terá **cinco áreas**: **Radar, Análise, Empresas, Elegibilidade e Relatórios**. As oito funções T01–T08 permanecem, mas **não correspondem a oito páginas independentes**. Os detalhes de oportunidade e requisito são painéis ou subvisões contextuais. O workspace é o centro operacional do produto.

**Mapa simplificado:** `Radar (T01 + T02) → Análise (T03 + T04 + T05) → Elegibilidade (T07) → Relatórios (T08)`. A área **Empresas (T06)** é acessível pelo menu principal e pelo contexto da elegibilidade; pode ser preparada antecipadamente, sem bloquear a análise documental.

| Área principal | Funções | Estrutura recomendada | Ação principal |
|---|---|---|---|
| **Radar** | T01 busca/monitoramento; T02 detalhe | Lista com filtros + painel ou rota contextual de detalhes | Selecionar e analisar oportunidade |
| **Análise** | T03 ingestão/OCR; T04 workspace; T05 detalhe | Lista de arquivos/status; PDF e matriz lado a lado; painel lateral do requisito | Validar ou corrigir requisito com origem |
| **Empresas** | T06 perfil/documentos | Perfil, capacidades declaradas, evidências, validade e origem | Manter evidências empresariais |
| **Elegibilidade** | T07 correspondência | Requisito × documento da empresa; estados e justificativas | Confirmar lacuna, correspondência ou revisão |
| **Relatórios** | T08 decisão/exportação | Resumo, pendências, cobertura, fontes e parecer humano | Registrar Go/No-Go e exportar |

**Inventário das oito funções, preservando os identificadores de rastreabilidade:**

| ID | Função e localização | Componentes essenciais | Estados obrigatórios |
|---|---|---|---|
| T01 | Radar — lista de licitações | Pesquisa, filtros, resultado PNCP, origem, data de coleta | carregando, vazio, erro da API, cache antigo |
| T02 | Radar — painel de oportunidade | Órgão, objeto, valor se disponível, prazo, link e documentos | metadado ausente, link indisponível, alteração detectada |
| T03 | Análise — importação/processamento | Upload, anexos, OCR, progresso por arquivo/página | processando, OCR incerto, falhou, duplicidade |
| T04 | Análise — workspace | PDF, requisitos, categorias, filtros e progresso de revisão | sem requisitos, cobertura parcial, fonte indisponível |
| T05 | Análise — painel de requisito | Origem, texto, interpretação, quantidade, revisão e histórico | fonte não verificada, divergência, pendente de revisão |
| T06 | Empresas — perfil | Dados, declarações e documentos de comprovação | sem evidência, documento vencido, não verificado |
| T07 | Elegibilidade — matriz | Requisito × evidência, justificativa e estado de análise | não verificado, preliminar, incompatibilidade, revisão |
| T08 | Relatórios — decisão | Resumo, checklist, riscos, fontes, registro humano, exportação | incompleto, decisão pendente, versão obsoleta |

#### 4.2.1 Navegação e persistência de contexto

- **Menu principal:** Radar, Análise, Empresas, Elegibilidade e Relatórios; área ativa claramente indicada. A ordenação não força uma sequência rígida para usuários experientes.
- **Contexto de oportunidade:** Análise, Elegibilidade e Relatórios operam sobre a licitação selecionada, com cabeçalho persistente (objeto, identificador, órgão, versão e estado). Se não houver licitação selecionada, exibir seleção orientada, nunca dados de outra oportunidade.
- **T02 como detalhe contextual:** abrir uma oportunidade pelo Radar em painel contextual ou rota derivada (`/radar/:oportunidadeId`); ao iniciar análise, manter o mesmo identificador e documentos associados.
- **T03 incorporada à Análise:** a importação é um estado/aba da área Análise, não um item independente do menu; o usuário pode voltar à relação de anexos sem perder revisões.
- **T05 como painel lateral:** clicar em um requisito mantém o workspace visível, abre o detalhe e localiza a fonte no PDF; fechar o painel retorna ao mesmo filtro, seleção e posição de rolagem.
- **Desktop:** PDF à esquerda e requisitos à direita no workspace, com painéis redimensionáveis quando possível; detalhe em drawer sem encobrir totalmente a referência documental.
- **Mobile:** alternar visualização entre lista de requisitos, documento e detalhes por abas; preservar requisito ativo, página e rascunho não salvo. A viabilidade do layout mobile completo é proposta e deve ser testada.
- **Histórico e URLs:** rotas profundas para oportunidade/área e estado recuperável; back/forward não deve descartar correções persistidas nem abrir oportunidade errada.
- **Sem chat:** nenhum botão depende de uma interface conversacional para completar a jornada no MVP.

#### 4.2.2 Fluxos completos e alternativos

**F01 — PNCP para relatório:** `Radar: pesquisar → detalhe → iniciar análise → Análise: importar e processar → revisar requisitos e fontes → Elegibilidade: selecionar empresa e conferir evidências → Relatórios: revisar pendências → decisão humana → exportar`.

**F02 — Upload direto:** `Radar: importar oportunidade manual → Análise: upload de PDFs → OCR e extração → workspace → relatório documental`. A elegibilidade permanece disponível quando houver perfil da empresa.

**F03 — Atualização de edital:** `Radar: alteração sinalizada → Análise: nova versão e reprocessamento → Elegibilidade: resultados anteriores marcados para revisão → Relatórios: relatório anterior identificado como obsoleto`.

**F04 — Correção de requisito:** `Análise: selecionar requisito → painel T05 → verificar documento/página → corrigir classificação ou texto → salvar com auditoria → recalcular checklist/elegibilidade relacionados → manter contexto visual`.

**F05 — Fonte/OCR com falha:** `Análise: página ilegível → aviso de cobertura parcial → revisão manual → resultado sem certeza indevida → relatório com ressalvas visíveis`.

### 4.3 Detalhamento das interações principais

**T01/T02 / Radar e detalhe contextual:** ao pesquisar, mostrar filtros ativos, quantidade de resultados recebidos e data/hora da última sincronização. A ação "Analisar" cria ou abre uma oportunidade local e nunca declara participação no certame. Permitir upload direto para uma licitação não encontrada no PNCP.

**T03 / Processamento dentro de Análise:** exibir uma linha por arquivo com estados `aguardando`, `extraindo_texto`, `executando_ocr`, `extraido`, `revisao_necessaria`, `falhou`. Permitir reprocessar um arquivo sem duplicar os requisitos da análise anterior; expor número de páginas cobertas.

**T04 / Workspace:** preferir desktop em duas colunas ajustáveis; mobile com alternância entre requisitos e documento, mantendo seleção e rolagem. Selecionar requisito navega ao documento e página; o destaque de trecho pode ser aproximado e, se não confiável, deve ser explicitamente indicado. Não usar chat nesta fase.

**T05 / Painel de revisão no workspace:** cada requisito tem `texto_original`, `interpretacao`, `categoria`, `origem`, `quantidade/unidade` quando houver, `revisor` e `historico`. Ações: confirmar, corrigir, rejeitar e solicitar revisão especializada. Não sobrescrever a saída automática sem registro.

**T06/T07 / Empresas e Elegibilidade:** o agente sugere correspondências com evidências, mas o status `evidenciado_preliminarmente` não equivale à habilitação legal. Não localizar documento é `nao_verificado`, nunca `reprovado` por padrão.

**T08 / Relatórios:** exibir lista de documentos processados, cobertura e OCR, resumo de riscos, pendências, decisões humanas e fontes citadas. Gerar PDF ou HTML imprimível; relatório com lacunas deve conter aviso claro.

### 4.4 Fluxos de exceção e recuperação

- **E01 — PNCP fora do ar:** apresentar dados já sincronizados, mostrar quando foram consultados e habilitar atualização posterior ou upload manual; não fingir atualização bem-sucedida.
- **E02 — Licitação sem PDF acessível:** permitir acompanhamento da oportunidade e importação manual, com aviso de origem incompleta.
- **E03 — PDF digitalizado de baixa qualidade:** executar OCR, sinalizar páginas com baixa confiança e exigir conferência; não marcar análise como integralmente concluída.
- **E04 — Requisito citado incorretamente:** bloquear confirmação automática se página/trecho não puderem ser encontrados; permitir correção pelo analista.
- **E05 — Edital retificado:** preservar versão anterior, sinalizar que o relatório pode estar obsoleto e oferecer nova análise.
- **E06 — Perfil sem evidências:** permitir análise documental e deixar elegibilidade como `nao_verificado`.

## 5. Requisitos funcionais — escopo confirmado

| ID | Pri. | Requisito | Evidência de aceite |
|---|---|---|---|
| RF-01 | P0 | Consultar licitações via PNCP | Pesquisa retorna dados reais com link de origem e timestamp; falhas informadas |
| RF-02 | P0 | Filtrar e selecionar oportunidades | Critérios aplicados aparecem na UI; seleção cria oportunidade persistida |
| RF-03 | P0 | Sincronizar e detectar atualizações | Reconsulta idempotente; mudança relevante sinalizada; duplicatas evitadas |
| RF-04 | P0 | Upload manual complementar | Aceita edital e múltiplos anexos; relaciona arquivos à oportunidade |
| RF-05 | P0 | Extrair PDFs com texto nativo | Texto por página, mantendo mapeamento da origem |
| RF-06 | P0 | Executar OCR em PDFs digitalizados | Identifica páginas sem texto, roda OCR e registra qualidade / falhas |
| RF-07 | P0 | Exibir cobertura documental | Mostra páginas processadas, erros, avisos de OCR e anexos faltantes conhecidos |
| RF-08 | P0 | Extrair metadados com fonte | Órgão, modalidade, objeto, valor e prazos quando encontrados; senão "não localizado" |
| RF-09 | P0 | Extrair requisitos atômicos | Cada obrigação tem categoria, texto, origem e quantidades/unidades quando aplicável |
| RF-10 | P0 | Verificar proveniência | Citação aponta documento/página/trecho verificáveis ou recebe estado de incerteza |
| RF-11 | P0 | Workspace PDF + matriz | Seleção abre página de origem, filtros e estados visíveis |
| RF-12 | P0 | Revisão humana e auditoria | Confirmar/corrigir/rejeitar mantém autor, data e versão anterior |
| RF-13 | P0 | Cadastrar perfil de empresa | Armazena capacidades declaradas separadas das evidências documentais |
| RF-14 | P0 | Registrar evidências da empresa | Importa e associa atestados/certidões; validade e verificação explicitadas |
| RF-15 | P0 | Avaliar elegibilidade preliminar | Requisito × evidência com justificativa e estado de incerteza |
| RF-16 | P0 | Construir checklist de pendências | Checklist derivado das exigências, atualizado após revisão |
| RF-17 | P0 | Registrar decisão humana Go/No-Go | Decisão, autor, justificativa e horário salvos |
| RF-18 | P0 | Exportar relatório | Documento apresenta fontes, cobertura/OCR, riscos, pendências e status de revisão |
| RF-19 | P0 | Operar com falha de integração | Upload manual e dados em cache sem representar dado antigo como atualizado |
| RF-20 | P1 | Comparar versões de editais | Diferenças assistidas e aviso de reanálise; versão anterior preservada |
| RF-21 | P1 | Gestão colaborativa | Comentários, atribuições e aprovações por especialistas |
| RF-22 | P2 | Chat contextual | **Fora do MVP**, condicionado à validação do workspace |
| RF-23 | P2 | Fontes adicionais ao PNCP | Expansão após validar cobertura, disponibilidade e manutenção |

**Observação de escopo:** P0 indica compromisso funcional do produto para o hackathon, não que todos os caminhos extremos tenham de ser resolvidos com automação completa. O piloto deve usar dados oficiais selecionados, OCR realmente executado e uma empresa demonstrativa; funcionalidades não concluídas devem aparecer como limitações no pitch.

## 6. Regras de negócio

**RN-01 — Evidência obrigatória.** Uma exigência crítica apresentada como derivada do edital deve apontar ao menos documento e referência textual localizável. Se não houver fonte verificável, marcar `fonte_nao_confirmada` e impedir declaração conclusiva.

**RN-02 — Ausência ≠ descumprimento.** Não encontrar atestado ou certidão na base do usuário gera `nao_verificado`, não `incompativel`.

**RN-03 — Estados de avaliação.** Estados propostos: `evidenciado`, `nao_verificado`, `incompatibilidade_identificada`, `revisao_especializada`. `Evidenciado` significa correspondência documental preliminar, **não** habilitação confirmada.

**RN-04 — Fatos versus inferências.** UI e exportação distinguem: citação do edital, interpretação da IA, evidência fornecida pela empresa, avaliação do analista.

**RN-05 — Conflitos e versões.** Documentos diferentes podem divergir; quando houver conflito, sinalizar sem selecionar automaticamente uma versão como válida. Guardar SHA-256 e data de entrada.

**RN-06 — Unidades e quantidades.** Guardar `valor`, `unidade`, `operador`, `periodicidade` e texto de origem; exemplo: `720`, `h/mês`, `>=` somente se esse comparador estiver amparado pelo texto. Não converter ambiguidades em certezas.

**RN-07 — Revisão e rastreabilidade.** Correções manuais não apagam a extração original; registrar usuário, momento, mudança e motivo, quando informado.

**RN-08 — Recomendações.** O relatório pode sugerir "prosseguir para análise comercial", "investigar pendências" ou "considerar não participar" apenas como recomendação preliminar, exigindo revisão humana.

**RN-09 — Erros de extração e OCR.** Quando um arquivo não for legível, sinalizar cobertura incompleta e não declarar que o conjunto documental foi integralmente analisado.

**RN-10 — Privacidade.** Não compartilhar documentos empresariais entre organizações. Nenhum documento enviado deve ser tornado público por padrão.


**RN-11 — Monitoramento auditável.** Cada item do radar deve registrar identificador na fonte, URL de origem, momento da coleta e último estado conhecido. Falha de API não gera estado "atualizado".

**RN-12 — OCR rastreável.** Guardar por página o método de extração (`native`/`ocr`), versão do motor, status e indicador de qualidade quando disponível. Confiança do OCR não é certeza jurídica.

**RN-13 — Identidade e sincronização.** Utilizar identificador estável do PNCP quando disponível; atualizações devem ser idempotentes. Reprocessar versão não altera conclusões humanas anteriores sem registro.

**RN-14 — Dependência do contexto empresarial.** Resultado de elegibilidade sempre associa versão da oportunidade, versão dos documentos e perfil empresarial utilizados; avaliação é invalidada/revisada quando evidências relevantes mudam.

**RN-15 — Chat excluído.** Não criar caixa de chat no primeiro workspace, nem depender de mensagens conversacionais para completar fluxos fundamentais.

## 7. Modelo conceitual de dados

| Entidade | Campos centrais |
|---|---|
| `Organization` | id, name, users, permissions |
| `SourceSync` | id, source, executed_at, status, filters, count, error_message |
| `Opportunity` | id, org_id, source, title, tender_id, agency, object, estimated_value, deadline, lifecycle_status |
| `Document` | id, opportunity_id, file_name, type, sha256, version, pages, extraction_status, uploaded_at |
| `PageExtraction` | id, document_id, page, method, ocr_engine_version, quality_status, text_hash, warnings |
| `DocumentSegment` | id, document_id, page, section, text, offsets, parser_version |
| `Requirement` | id, opportunity_id, category, normalized_text, criticality, source_segment_id, original_excerpt, extracted_values, model_version, review_status |
| `CompanyProfile` | id, organization_id, segment, capabilities_declaration |
| `CompanyEvidence` | id, company_id, document_id, evidence_type, validity, verification_status |
| `Assessment` | id, requirement_id, evidence_ids, status, rationale, reviewer_id, reviewed_at |
| `AnalysisRun` | id, input_hashes, pipeline_version, model, started_at, duration, cost, failures |
| `ReviewEvent` | id, entity_type, entity_id, actor, action, before, after, timestamp |
| `DecisionReport` | id, opportunity_id, generated_at, reviewer, final_human_status, warnings, export_uri |

**Relações importantes:** `Opportunity` 1:N `Document` e 1:N `Requirement`; `Requirement` N:1 `DocumentSegment` ou N:M quando múltiplos trechos; `Assessment` liga `Requirement` e 0:N `CompanyEvidence`.

## 8. Arquitetura candidata (não decisão aprovada)

**[PROPOSTA] Frontend:** Next.js + TypeScript + Tailwind; visualizador PDF com navegação por página.  
**[PROPOSTA] Backend:** FastAPI; endpoint de importação, processamento e relatório.  
**[PROPOSTA] Banco:** PostgreSQL; vetores opcionais via pgvector caso recuperação semântica se mostre necessária.  
**Processamento:** adaptador PNCP → persistência de oportunidade → download/upload → parser PDF textual → detecção de páginas sem texto → OCR (ex.: OCRmyPDF/Tesseract, sujeito a benchmark) → indexação por página/trecho → extração tipada de requisitos → validação de citações → comparação com evidências → revisão humana. Jobs assíncronos com tentativas controladas e estados visíveis.  
**IA:** LLM com respostas tipadas/JSON schema; validação de consistência e referências; regras determinísticas para cálculos e datas.  
**Jobs:** processamento assíncrono interno e idempotente; estado visível ao usuário.  
**Exportação:** relatório PDF ou HTML imprimível no P0, com informações de cobertura, revisões e fontes.  
**Segurança:** isolamento por organização, controle de acesso, arquivos tratados como dados não confiáveis, limite de tamanho, validação de MIME, proteção contra prompt injection, logs sem segredos ou conteúdo sensível por padrão.

### 8.1 Interfaces de API candidatas

- `GET /monitor/opportunities` — buscar oportunidades sincronizadas e filtros.
- `POST /monitor/sync` — iniciar sincronização PNCP com controle de acesso e limites.
- `POST /opportunities` — criar oportunidade.
- `POST /opportunities/{id}/documents` — enviar PDFs.
- `POST /opportunities/{id}/analysis` — iniciar análise.
- `GET /opportunities/{id}/analysis/{run_id}` — status e avisos.
- `GET /opportunities/{id}/requirements` — requisitos e referências.
- `PATCH /requirements/{id}/review` — revisar extração.
- `GET /documents/{id}/extraction` — status de extração/OCR por página.
- `POST /organizations/{id}/evidence` — upload de evidência (P0).
- `POST /requirements/{id}/assessment` — revisão de correspondência (P0).
- `GET /opportunities/{id}/report` — relatório.

### 8.2 Contrato mínimo de `Requirement`

```json
{
  "id": "req_001",
  "category": "technical_qualification",
  "normalized_text": "Comprovar experiência de transcodificação ao vivo de 720 horas por mês",
  "source": {
    "document_id": "doc_tr_001",
    "section": "8.4.4.1.1",
    "page": null,
    "excerpt": "[trecho original verificado durante a ingestão]"
  },
  "quantitative_constraint": {
    "value": 720,
    "unit": "hours_per_month",
    "comparator": "as_written_in_source"
  },
  "extraction_status": "pending_human_review",
  "assessment": "not_verified"
}
```

Exemplo de esquema, não resultado executado. `page: null` é preferível a inventar número de página antes da ingestão real.

## 9. Épicos e histórias de usuário

### EP-01 Radar e monitoramento — P0

- **US-01:** Como analista, quero buscar oportunidades no PNCP por critérios disponíveis para descobrir editais relevantes. **Aceite:** resultados exibem origem, data de coleta e aviso de ausência de dados.
- **US-02:** Como analista, quero atualizar a pesquisa e ver eventuais mudanças para não operar com um edital antigo. **Aceite:** reconsulta idempotente, timestamp e aviso de alteração.
- **US-03:** Como analista, quero continuar pelo upload manual se a API falhar. **Aceite:** oportunidade pode ser criada sem PNCP e a falha fica visível.

### EP-02 Ingestão híbrida e OCR — P0

- **US-04:** Como analista, quero importar edital e anexos textuais ou escaneados. **Aceite:** PDF nativo e PDF digitalizado percorrem o pipeline de extração.
- **US-05:** Como analista, quero conhecer a cobertura e os erros de OCR. **Aceite:** interface informa páginas processadas, falhas e necessidade de revisão.

### EP-03 Requisitos e workspace — P0

- **US-06:** Como analista, quero requisitos atômicos, quantidades, categorias e origem. **Aceite:** resultados incluem ao menos os requisitos técnicos do gabarito selecionado.
- **US-07:** Como analista, quero abrir a fonte diretamente do requisito. **Aceite:** abre documento e página corretos; incerteza de destaque é sinalizada.
- **US-08:** Como analista, quero corrigir extrações sem apagar o histórico. **Aceite:** autor, data, anterior e novo valor são recuperáveis.

### EP-04 Perfil e elegibilidade — P0

- **US-09:** Como analista, quero cadastrar capacidades e documentos comprobatórios. **Aceite:** declarações e evidências permanecem distintas.
- **US-10:** Como analista, quero ver o status de cada requisito para a empresa selecionada. **Aceite:** ausência vira `nao_verificado` e incompatibilidade exige fundamento identificado.

### EP-05 Relatório e decisão — P0

- **US-11:** Como gestor, quero um relatório com requisitos, fontes, cobertura e riscos. **Aceite:** PDF/HTML gerado reflete a análise mais recente e suas ressalvas.
- **US-12:** Como gestor, quero registrar Go/No-Go com responsabilidade explícita. **Aceite:** autor, data, decisão e justificativa salvos.

## 10. Backlog priorizado por dependências

| Ordem | Entrega | Pri. | Depende de | Demo / prova |
|---|---|---|---|---|
| 1 | Repositório, fixtures e modelo de dados | P0 | — | Execução local previsível |
| 2 | Adaptador PNCP, consulta e cache | P0 | 1 | Pesquisa oficial + origem + data |
| 3 | Radar com filtros e detalhe | P0 | 2 | Seleciona oportunidade real |
| 4 | Upload/ingestão e versionamento | P0 | 1 | Edital + anexos persistidos |
| 5 | Extração textual + OCR por página | P0 | 4 | PDF textual e escaneado processados |
| 6 | Extração de requisitos + fontes | P0 | 5 | Itens e citações conferíveis |
| 7 | Workspace com PDF e revisão | P0 | 6 | Corrige requisito com trilha |
| 8 | Perfil empresarial e evidências | P0 | 1,4 | Empresa fictícia cadastrada |
| 9 | Matriz de elegibilidade | P0 | 6,8 | Lacunas identificadas e justificadas |
| 10 | Relatório + decisão humana | P0 | 7,9 | Exportação e Go/No-Go revisado |
| 11 | Testes com gabarito e casos de erro | P0 | 2–10 | Métricas registradas |
| 12 | Polimento, demo offline e pitch | P0 | 11 | Fluxo demonstrável com fallback |
| 13 | Chat e fontes adicionais | P2 | Após validação | Fora do MVP |

**Estratégia de contingência (sem remover requisitos confirmados):** desenvolvimento em fatias integráveis. Uma demonstração pode usar dados PNCP sincronizados previamente e OCR executado antes da apresentação, deixando claro que são resultados reais pré-processados. Nenhum mock pode ser apresentado como consulta ou análise ao vivo.

## 11. Critérios de aceite detalhados — Definition of Done

Os testes abaixo definem comportamentos observáveis e devem ser registrados como **Passou / Falhou / Não executado**. As metas quantitativas são propostas de validação, não resultados obtidos.

| ID | Dado / Quando | Então / resultado esperado | Evidência para QA |
|---|---|---|---|
| CA-01 | Com API PNCP acessível, usuário aplica filtro | Radar exibe registros, fonte oficial, filtros e horário da coleta | Captura + payload com IDs |
| CA-02 | PNCP retorna erro ou timeout | UI exibe falha, carimbo do último cache e opção de upload manual | Teste com resposta simulada 5xx |
| CA-03 | A mesma oportunidade é sincronizada duas vezes | Não surgem oportunidades duplicadas; atualização preserva histórico | Teste de idempotência |
| CA-04 | Upload de edital e dois anexos | Todos aparecem com status e hash; arquivo inválido é rejeitado individualmente | Teste com 3 PDFs + 1 arquivo inválido |
| CA-05 | PDF nativo com texto selecionável | Texto separado por página, com página de origem correta | Conferência com gabarito |
| CA-06 | PDF digitalizado sem texto utilizável | OCR executa e registra método, saída e avisos por página | PDF escaneado de teste |
| CA-07 | OCR falha em páginas ilegíveis | Cobertura parcial explícita; não aparece selo de análise completa | PDF propositalmente ilegível |
| CA-08 | Edital contém requisitos quantitativos | Exigência extraída com número, unidade e periodicidade sem invenção | Gabarito ALEPE e variações |
| CA-09 | Requisito aponta a trecho de origem | Clique abre documento e página corretos; sem referência inventada | Auditoria de amostra |
| CA-10 | Texto não pode ser associado à fonte | Estado de fonte não confirmada e bloqueio de conclusão categórica | Caso sem correspondência |
| CA-11 | Analista corrige categoria/valor | Nova versão aparece e histórico original permanece | Antes/depois no log |
| CA-12 | Perfil inclui declaração sem comprovação | A avaliação distingue declaração de evidência verificada | Perfil fictício de teste |
| CA-13 | Empresa não possui documento na base | Resultado é `nao_verificado`, não `inapta` | Teste automatizado de regra |
| CA-14 | Exigência contradiz evidência apresentada | Sistema sinaliza potencial incompatibilidade com justificativa e revisão | Fixture de conflito |
| CA-15 | Relatório é exportado com falhas de OCR | PDF/HTML inclui aviso de cobertura e lista documentos afetados | Inspeção do arquivo |
| CA-16 | Analista registra Go/No-Go | Decisão tem autor, data e justificativa, sem afirmação automática de habilitação | Log e relatório |
| CA-17 | Edital recebe versão adicional | Versão anterior preservada e avaliação anterior sinalizada como potencialmente desatualizada | Dois PDFs com hashes diferentes |
| CA-18 | Usuário acessa workspace do MVP | Fluxo essencial funciona sem chat | Inspeção e teste de ponta a ponta |
| CA-19 | Documento contém instrução maliciosa ao modelo | Pipeline trata texto como dado e não executa ações solicitadas pelo PDF | Teste de prompt injection |
| CA-20 | O piloto usa a licitação ALEPE | A análise recupera pontos técnicos, índices financeiros e prova de conceito presentes no material selecionado, conforme gabarito humano | Matriz de conferência do estudo |
| CA-21 | Usuário navega pelo menu principal | Somente cinco áreas principais aparecem: Radar, Análise, Empresas, Elegibilidade e Relatórios | Inspeção de navegação desktop/mobile |
| CA-22 | Analista abre oportunidade no Radar e inicia análise | O identificador, metadados e anexos da oportunidade permanecem consistentes em todas as áreas | Teste de ponta a ponta com duas oportunidades |
| CA-23 | Analista abre e fecha detalhe T05 | O detalhe aparece no contexto do workspace, liga à página/trecho e preserva filtro, seleção e rolagem ao fechar | Teste funcional com PDF e múltiplos requisitos |
| CA-24 | Usuário visita Empresas e retorna a Elegibilidade | Perfil selecionado e evidências persistem; falta de perfil não bloqueia relatório estritamente documental | Teste de navegação e estado vazio |
| CA-25 | Usuário troca de visão no celular ou usa Voltar | Requisito ativo e página selecionada são preservados; mudanças não salvas recebem aviso | Testes responsivos e de histórico |

**Saída mínima da validação:** relatório de testes com identificador CA, responsável, data, input, esperado, obtido, status, link para evidência e observações. Itens não executados não devem ser tratados como aprovados.

## 12. Métricas e validação

### 12.1 Qualidade técnica

- **Recall de requisito crítico:** itens críticos corretos encontrados / total de itens críticos do gabarito. **Meta exploratória:** ≥90% em conjunto piloto.
- **Precisão da citação:** referências que apontam corretamente para o trecho/página / referências auditadas. **Meta exploratória:** ≥95%.
- **Omissões críticas:** toda omissão identificada recebe severidade, causa e mitigação. **Tolerância de segurança:** não classificar documento como integralmente analisado se há falhas conhecidas.
- **Falsa certeza:** número de conclusões definitivas sem base documental. **Meta:** zero nos casos testados.

### 12.2 Produtividade

Medir tempo de triagem em editais comparáveis com e sem ferramenta, anotando tarefas, revisões e erros; evitar comparações quando participantes ou documentos tiverem níveis muito diferentes. **Meta exploratória:** ≥40% de redução do tempo, não performance alegada.

### 12.3 Valor comercial

Entrevistar pelo menos cinco profissionais de licitações e registrar volume mensal, ferramentas existentes, maiores atrasos, custo de omissões, integração necessária, disposição de pagamento e motivadores de troca. Não inferir mercado validado apenas porque concorrentes existem.

### 12.4 Plano de teste

1. Selecionar 3–5 editais e anexos (diversidade de tipos e formatos).
2. Montar gabarito de requisitos e citações com especialista.
3. Testar extração sem ajustar prompt ao próprio conjunto de teste a cada falha, ou reservar conjunto não visto.
4. Registrar métricas, falsos positivos, omissões e tipos de erro.
5. Rodar teste de UX com analistas, usando tarefas observáveis.
6. Publicar resultados e limitações honestamente no pitch.

## 13. Segurança, confiabilidade e compliance

- Upload com limites de tamanho/tipo e processamento isolado.
- Proteção contra instruções maliciosas contidas no texto dos arquivos.
- Controle de acesso por organização; dados privados não devem entrar em exemplos públicos.
- Política explícita de retenção, exclusão e uso de provedores de IA antes de receber documentos corporativos reais.
- Logs de auditoria das revisões, sem copiar documentos sensíveis desnecessariamente.
- Exibição de limites quando OCR, extração de tabela, referências ou anexos falharem.
- Não prometer certificação jurídica, contábil ou garantia de habilitação.

## 14. Riscos e respostas

| Risco | Impacto | Mitigação |
|---|---|---|
| Omissão de exigência em anexo | Alto | Ingestão multiparâmetro, aviso de cobertura, teste com gabarito |
| Alucinação de fonte | Alto | Validação de trecho/documento e bloqueio de fonte inventada |
| PDF escaneado/tabela complexa | Alto | OCR obrigatório no MVP; medir qualidade, identificar páginas de revisão e fallback manual |
| Interpretação legal equivocada | Alto | Status de revisão especializada + revisão humana |
| Dependência de API externa | Alto | Cache com data, reintentos controlados e upload manual; demonstrar monitoramento com dados reais sincronizados |
| Sobrecusto da IA | Médio | Medir tokens, cache, análise por seções |
| Prazo curto do hackathon | Alto | Corte formal de P1/P2, dados de teste prontos |
| Concorrência estabelecida | Alto | Diferenciação por requisito verificável + workflow de revisão; validação com usuários |

## 15. Organização do trabalho (proposta para 4 pessoas)

1. **Responsável IA/documentos:** parser, extração estruturada, citações, métricas.
2. **Responsável backend/dados:** APIs, banco, jobs, controle de versão, exportações.
3. **Responsável frontend/UX:** radar, importação, leitor PDF, matriz, estados de erro e revisão.
4. **Responsável produto/qualidade/integração:** gabarito, testes, entrevistas, demonstração, integração entre serviços.

Distribuição é uma proposta; capacidade real e divisão dependem do tamanho do time e duração do evento.

## 16. Roteiro de demonstração de 4–5 minutos

1. Apresentar problema do analista (30–45 s).
2. Buscar oportunidade oficial no radar ou mostrar resultado PNCP sincronizado, abrir ALEPE e carregar documentos (30–45 s).
3. Mostrar requisitos extraídos: cinco capacidades técnicas e POC (60–90 s).
4. Clicar em requisito e abrir evidência original no PDF (30 s).
5. Mostrar comparação com empresa fictícia e estado "não verificado" (30–45 s; se P1 concluído).
6. Mostrar um PDF digitalizado processado via OCR, corrigir um requisito e exportar relatório (45–60 s).
7. Explicar métrica de produtividade, resultados de teste e modelo SaaS hipotético (45 s).

**Contingência:** preparar demo local com resultados PNCP sincronizados previamente, OCR já executado e logs de processamento real, todos rotulados como pré-processados; não simular execução inexistente.

## 17. Modelo de negócio (hipóteses, fora do núcleo funcional)

- SaaS por assento/volume de análise; preço ainda não validado.
- Cliente inicial: equipe que analisa editais recorrentemente.
- Indicadores a estudar: frequência de análises, custo de IA por edital, margem bruta, retenção, tempo economizado, taxa de adoção, conversão de teste para assinatura.
- Diferencial a testar: auditabilidade em nível de requisito + revisão + documentação de decisão.

## 18. Decisões e validações pendentes

| ID | Questão | Estado | Encaminhamento recomendado |
|---|---|---|---|
| D-01 | Monitoramento + análise + elegibilidade no MVP | **Confirmado** | Planejar integração PNCP e fallback manual |
| D-02 | PDFs textuais e OCR para digitalizados | **Confirmado** | Benchmark de OCR com PDFs reais e escaneados |
| D-03 | Chat fora do primeiro workspace | **Confirmado** | Reavaliar depois de medir UX |
| D-04 | Escopo do monitoramento | Aberto | Definir filtros e periodicidade sustentados pela API |
| D-05 | Qual motor OCR e limites de qualidade? | Aberto | Comparar Tesseract/OCRmyPDF e alternativa comercial |
| D-06 | Qual modelo e provedor de IA? | Aberto | Medir precisão, latência, custo e política de dados |
| D-07 | Quais verticais no piloto? | Proposta | Tecnologia inicialmente; testar outros editais |
| D-08 | Autenticação, multiempresa e retenção | Aberto | Definir antes de receber documentos privados reais |
| D-09 | Qual visualizador PDF e tecnologia de highlight? | Aberto | Prototipar ligação requisito → página |
| D-10 | Tempo do hackathon e composição do time | Aberto | Ajustar sequência e responsabilidade de tarefas |
| D-11 | Formato de exportação no MVP | Proposta | PDF com HTML imprimível como fallback |
| D-12 | Critérios jurídicos de Go/No-Go | Aberto | Revisão humana e sem score opaco |

### 18.1 Checklist para reunião de validação do time

- [ ] Confirmar a persona primária e o problema mais relevante no trabalho diário.
- [ ] Validar as cinco áreas principais e o agrupamento T01–T08, incluindo o painel T05.
- [ ] Validar continuidade de contexto e alternância mobile sem perda de alterações.
- [ ] Confirmar quais filtros do PNCP serão suportados no piloto.
- [ ] Aprovar abordagem OCR e política de falhas de leitura.
- [ ] Aprovar as quatro categorias de estado de elegibilidade e suas nomenclaturas.
- [ ] Confirmar os PDFs reais e o gabarito que serão usados nos testes.
- [ ] Revisar os 25 critérios de aceite e nomear responsáveis por cada teste.
- [ ] Definir a duração do evento, divisão de tarefas e cortes de acabamento (sem ocultar limitações).
- [ ] Definir autenticação e tratamento de dados antes do uso de documentos empresariais verdadeiros.
- [ ] Confirmar se o MVP será demonstrado com dados ao vivo, pré-processados, ou ambos.

## 19. Próximos artefatos

1. Mapa de fluxos de tela e wireframes do workspace.
2. Modelo ER e contratos de API detalhados.
3. Schema JSON de extração de requisitos e testes unitários de validação.
4. Corpus de editais + gabarito anotado.
5. Backlog de implementação no GitHub Issues/board.
6. Script da demo e avaliação objetiva de qualidade.

## 20. Controle de alterações

| Versão | Data | Resumo |
|---|---|---|
| 0.1 | 13/11/2026 | Primeira proposta consolidada a partir do Estudo de Caso 001 |
| 0.2 | 13/11/2026 | Monitoramento + elegibilidade promovidos a P0; OCR obrigatório; chat pós-MVP; 20 critérios testáveis |
| 0.3 | 13/11/2026 | Cinco áreas de navegação aprovadas, oito funções agrupadas, detalhamento de fluxo/estado e mais cinco critérios de aceite (25 no total) |

---

**Observação:** escopo confirmado pelo proponente não equivale a validação coletiva do time; este PRD contém hipóteses e propostas técnicas, não laudo legal. Uma implementação comercial requer revisão jurídica, segurança, testes com diferentes formatos e feedback de profissionais experientes.
