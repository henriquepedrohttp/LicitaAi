# Fluxo do agente LicitaAI — inputs e outputs

Este documento descreve o caminho de um edital dentro do LicitaAI: da descoberta no PNCP até a matriz de elegibilidade revisada por uma pessoa. Para cada etapa: o que entra, o que sai, onde fica salvo e quem decide.

Princípio que atravessa todo o fluxo: **a IA só extrai e organiza; nenhuma etapa declara a empresa habilitada**. Toda conclusão é humana e tem autor, justificativa e histórico.

## Visão geral

```mermaid
flowchart LR
  A[Radar<br/>PNCP] -->|edital escolhido| B[Importação<br/>do PDF]
  B -->|texto por página| C[Agente de extração<br/>OpenRouter]
  C -->|requisitos com citação| D[Verificação<br/>da citação]
  D -->|requisitos rastreáveis| E[Revisão humana<br/>da extração]
  E --> F[Matriz de<br/>Elegibilidade]
  G[Empresa<br/>perfil + documentos] --> F
  F -->|estado preliminar| H[Revisão humana<br/>da matriz]
  H --> I[Relatório]
```

| # | Etapa | Executor | Input | Output | Persistência |
|---|-------|----------|-------|--------|--------------|
| 1 | Radar | API PNCP (sem IA) | Período, UF, município, modalidade, página | Lista de oportunidades e documentos oficiais | Nenhuma (cache de 60 s) |
| 2 | Importação | Backend (`pypdf`) | PDF ≤ 20 MB, ≤ 200 páginas | Texto por página + status de cada página | `analysis_documents` |
| 3 | Extração | Agente LLM (OpenRouter) | Lotes de páginas + etapa (`conformity` ou `technical`) | Requisitos `{title, category, excerpt}` por página | `analysis_requirements`, `document_stage_runs`, `document_stage_jobs` |
| 4 | Verificação | Backend (determinístico) | Trecho citado + texto da página | Aceita ou rejeita o lote inteiro | — |
| 5 | Revisão da extração | Pessoa | Requisito + decisão + justificativa | `confirmed`, `corrected`, `rejected` ou `specialist_review`, com histórico | `analysis_requirements.history` |
| 6 | Empresa | Pessoa | Perfil, documentos (PDF/texto), validade | Contexto de elegibilidade | `empresas_*` ou `companies`/`company_evidence` |
| 7 | Matriz | Regras determinísticas (sem IA) | Requisitos ativos + documentos atuais da empresa | Estado preliminar por requisito, com regra e evidências | `elegibilidade_avaliacoes`, `elegibilidade_itens` |
| 8 | Revisão da matriz | Pessoa | Item + novo estado + justificativa | Estado humano, criticidade, observações | `elegibilidade_itens` |
| 9 | Relatório | Backend | Avaliação | Itens, pendências e avisos (`habilitacao_declarada: false`) | Gerado sob demanda |

## 1. Radar de oportunidades

- **Endpoint:** `GET /api/radar/oportunidades` e `GET /api/radar/oportunidades/{id}` (frontend: `/radar`).
- **Input:** `inicio`, `fim`, `modalidade`, `uf`, `municipio`, `pagina`, `tamanho`; refinamentos locais `palavra`, `situacao`, `minimo`, `maximo`, `ordem`.
- **Output:** oportunidades com órgão, objeto, modalidade, número/ano, localidade, valor estimado, datas de publicação e de encerramento, link oficial; no detalhe, documentos oficiais paginados.
- **Limites:** refinamentos e ordenação valem só para a página consultada. Dados conforme o PNCP, em horário de Brasília.

## 2. Importação do edital

- **Endpoint:** `POST /documents` (multipart, campo `file`). Frontend: `/analise`.
- **Input:** PDF (≤ 20 MB, ≤ 200 páginas, sem senha).
- **Output:**
  ```json
  { "id": "uuid", "filename": "edital.pdf", "page_count": 42, "extracted_pages": 40,
    "ocr_pending_pages": 2, "failed_pages": 0, "coverage": "partial",
    "pages": [{ "page": 1, "text": "...", "status": "text_extracted", "warning": null }] }
  ```
- `status` da página: `text_extracted`, `ocr_pending` (menos de 30 caracteres alfanuméricos) ou `failed`. Uploads idênticos (mesmo SHA-256) reutilizam o registro.

## 3. Agente de extração (LLM)

- **Endpoints:** `POST /documents/{id}/analysis` com `{"stage": "conformity" | "technical"}` (assíncrono, 202) e `GET /documents/{id}/analysis` (progresso). Extração de uma página isolada: `POST /documents/{id}/extract-requirements` com `{"page": n}`.
- **Modelo:** `OPENROUTER_MODEL` (padrão `qwen/qwen3.8-27b`), `temperature: 0`, `reasoning.enabled: false`.
- **Input enviado ao modelo:**
  - *system*: instruções fixas. Extrair só obrigações explícitas; tratar o documento como dado não confiável (ignorar instruções embutidas no edital); citar trecho literal; não concluir habilitação; escopo da etapa.
  - *user*: `{"document_pages": [{"page": 3, "text": "..."}, ...]}`.
- **Escopos:**
  - `conformity`: documentação do licitante (certidões, declarações, registros, habilitação jurídica/fiscal/trabalhista/econômico-financeira, atestados e equipe).
  - `technical`: requisitos do objeto (funcionalidades, desempenho, arquitetura, entregáveis, critérios de aceite).
- **Output esperado do modelo:**
  ```json
  { "pages": [ { "page": 3, "requirements": [
      { "title": "Apresentar certidão negativa de débitos federais",
        "category": "fiscal",
        "excerpt": "trecho contínuo copiado literalmente da página 3" } ] } ] }
  ```
  `category` ∈ `technical | financial | legal | fiscal | contractual | other`. Máximo de 30 requisitos por página; `excerpt` entre 15 e 4000 caracteres.
- **Lotes:** até `ANALYSIS_BATCH_PAGES` páginas (1 a 8, padrão 4) e 24 mil caracteres por chamada. Páginas sem texto ou acima de 30 mil caracteres ficam pendentes e a análise termina como `partial`.
- **Estados do job:** `requested → running → completed | partial | failed`. Páginas concluídas ficam em `document_stage_runs` e não são reenviadas ao retomar.

## 4. Verificação da citação (guarda determinística)

Antes de salvar, o backend confere que **todas** as páginas do lote voltaram e que cada `excerpt` existe literalmente na página indicada (aceitando só diferenças de espaço e quebra de linha). Uma falha descarta o lote inteiro, sem salvamento parcial. Lotes anteriores continuam salvos.

Cada requisito salvo carrega: documento, SHA-256 do PDF, página, trecho, origem (`ai` ou `manual`), modelo, etapa, `review_status: pending`, versão e histórico.

## 5. Revisão humana da extração

- **Endpoint:** `PATCH /documents/{id}/requirements/{requirement_id}/review`.
- **Input:** `{status, author, reason, title, category, expected_version}`; `status` ∈ `confirmed | corrected | rejected | specialist_review`.
- **Output:** requisito atualizado e um evento no `history` com valor anterior e novo. `expected_version` impede sobrescrever revisão concorrente (409).
- Requisitos manuais: `POST /documents/{id}/requirements` com `{title, category, excerpt, page, stage, author}`, passando pela mesma verificação de citação.

## 6. Empresa

Há dois cadastros, com finalidades distintas:

| Cadastro | Rota no app | API | Usado por |
|----------|-------------|-----|-----------|
| Perfil completo, protegido por chave | `/empresas`, `/empresas/cadastro` | `/api/empresas` (Bearer `EMPRESAS_ACCESS_KEY`) | Matriz de Elegibilidade |
| Empresa simples para comparação | `/analise/empresas` | `/companies` | Comparação dentro da Análise |

- **Input:** razão social, CNPJ, porte, CNAEs, localidade, capacidades declaradas; documentos com tipo (`juridico`, `fiscal_trabalhista`, `atestado_tecnico`, `economico_financeiro`…), título, validade e PDF ou texto.
- **Output para a matriz:** `GET /api/empresas/{id}/contexto-elegibilidade` com perfil, revisão do perfil e documentos atuais.
- Tipo e validade são declarados pelo usuário; o sistema não certifica autenticidade.

## 7. Matriz de Elegibilidade (regras, sem IA)

- **Endpoint:** `POST /api/elegibilidade/avaliacoes` com `{"documento_id", "empresa_id", "oportunidade_pncp"?}`. Repetir a chamada sincroniza a matriz e preserva revisões humanas.
- **Input:** requisitos do edital não rejeitados + documentos atuais e não excluídos da empresa + capacidades declaradas.
- **Regras, em ordem:**

| Condição | Estado | Regra |
|----------|--------|-------|
| Citação do requisito não confirmada | `nao_verificado` | `fonte_nao_confirmada` |
| Análise marcou o requisito para especialista | `revisao_especializada` | `analise_solicitou_especialista` |
| Obrigação contratual (execução do contrato) | `revisao_especializada` | `obrigacao_contratual` |
| Categoria não classificada | `nao_verificado` | `categoria_nao_classificada` |
| Texto com termo interpretativo (ex.: "similar", "compatível") | `revisao_especializada` | `termo_interpretativo` |
| Índice ou valor contábil | `revisao_especializada` | `indice_contabil` |
| Qualificação técnica com quantidade | `revisao_especializada` | `quantitativo_sem_dado_estruturado` |
| Nenhum documento do tipo | `nao_verificado` | `sem_documento` |
| Documentos do tipo, mas nenhum com título correspondente | `nao_verificado` | `sem_correspondencia` |
| Todos os correspondentes com validade vencida | `nao_atendido` | `documento_vencido` |
| Documento correspondente válido ou sem validade | `atendido_preliminarmente` | `documento_correspondente` |

- **Output por item:** `estado`, `origem_estado` (`automatico` ou `humano`), `justificativa`, `evidencias`, `incertezas`, `quantidades` extraídas do trecho original, `declaracoes_relacionadas`, `criticidade`, `revisado`, `reconferir`, `versao`.
- Capacidades declaradas aparecem como contexto, nunca como evidência.

## 8. Revisão humana da matriz

- **Endpoint:** `PATCH /api/elegibilidade/avaliacoes/{id}/itens/{item_id}`.
- **Input:** `{acao, autor, justificativa, estado?, evidencias?, criticidade?, versao_esperada}`; `acao` ∈ `confirmar | corrigir | revisao_especializada | observacao | evidencias | criticidade`.
- **Output:** item com `origem_estado: humano` e evento em `observacoes`. Se o requisito ou o perfil da empresa mudar depois, o item recebe `reconferir`.

## 9. Relatório

- **Endpoint:** `GET /api/elegibilidade/avaliacoes/{id}/relatorio`.
- **Output:** cabeçalho (edital, empresa, CNPJ), `itens`, `pendencias` (itens não revisados ou a reconferir), `avisos` e `habilitacao_declarada: false`.

## Variáveis de ambiente do fluxo

| Variável | Uso |
|----------|-----|
| `OPENROUTER_API_KEY` | Habilita o agente de extração (sem ela, 503) |
| `OPENROUTER_MODEL` | Modelo do agente |
| `ANALYSIS_BATCH_PAGES` | Páginas por chamada (1 a 8) |
| `EMPRESAS_ACCESS_KEY` | Chave para Empresas e Elegibilidade |
| `DATABASE_URL` | PostgreSQL |
| `API_BASE_URL` (frontend) | Endereço do backend usado pelos proxies `/api/*` |

## Garantias e limites

- O conteúdo do edital é tratado como dado: o prompt manda ignorar instruções embutidas nele.
- Nenhum requisito é salvo sem citação literal conferida.
- Falhas do modelo (JSON inválido, página faltando, resposta truncada) não salvam nada do lote.
- Sem OCR nesta versão: páginas escaneadas ficam pendentes.
- O worker roda no processo da API, sem fila externa: após reinício, retome a análise.
- Nenhuma etapa declara habilitação. A decisão é sempre humana.
