# LicitaAI

Base de desenvolvimento do hackathon: Next.js + TypeScript + Tailwind, FastAPI e PostgreSQL.

## Iniciar

Requisitos: Node.js 22.13+ e Docker com Compose, com acesso ao daemon.

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env.local
docker compose up --build -d
cd frontend
npm ci
npm run dev
```

Abra http://localhost:3000. API: http://localhost:8000/docs.
A página inicial consulta o backend por uma rota do Next.js e mostra separadamente a disponibilidade do banco.

```bash
curl -f http://localhost:8000/health
curl -f http://localhost:8000/health/ready
docker compose logs -f backend
```

`/health` verifica o processo; `/health/ready` executa `SELECT 1` no PostgreSQL e retorna 503 se indisponível.

## Backend sem Docker

Python 3.12+ com suporte a venv e PostgreSQL acessível. Configure DATABASE_URL no .env da raiz.

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload
```

## Verificação

```bash
cd frontend
npm run lint
npm run build
```

## Organização

- `frontend/src/app`: cinco áreas de navegação; componentes iniciais sem dados simulados de análise.
- `backend/app`: API e verificações de infraestrutura.
- `docs`: PRD e divisão inicial de trabalho.
- `compose.yaml`: PostgreSQL persistente e backend com recarga automática.

Credenciais do exemplo são apenas locais. Não enviar `.env` ao Git. Esta base não implementa autenticação nem processamento documental. Nenhuma análise ou habilitação é apresentada como concluída.

## Encerrar

`docker compose down` preserva o banco. Não usar `down -v` se precisar conservar os dados.

## Análise documental — primeira entrega

Abra `/analise`, importe um PDF e selecione a página. O arquivo original e o texto por página são persistidos no PostgreSQL. Uploads idênticos reutilizam o registro por SHA-256. Nesta versão os documentos pertencem a um acervo único de demonstração, ainda sem vínculo com oportunidade ou organização.

Limites: 20 MB e 200 páginas por arquivo; PDFs protegidos são rejeitados. Páginas com menos de 30 caracteres alfanuméricos recebem status OCR pendente (heurística conservadora). OCR, extração de requisitos por IA e revisão humana estruturada ainda não foram implementados. O visualizador embutido depende do suporte a PDF do navegador; há link para abrir o original.

Ao atualizar dependências do backend em Docker, execute `docker compose up --build -d backend`.

Testes de integração (API e PostgreSQL locais em execução):

```bash
PYTHONPATH=backend backend/.venv/bin/python -m unittest discover -s backend/tests -v
```

Os testes criam PDFs sintéticos e removem somente seus próprios registros. Não há envio de documentos a um provedor de IA nesta etapa.

## Requisitos rastreáveis

Na área Análise, selecione um documento e uma página, depois use “Extrair requisitos” ou “Adicionar manualmente”. O backend confere se cada trecho está presente naquela página (aceitando apenas diferenças de espaços/quebras de linha). Documento, hash, página e trecho permanecem associados ao requisito. Essa conferência não valida a interpretação.

OpenRouter no `.env` da raiz, somente no backend:

```env
OPENROUTER_API_KEY=sua_chave
OPENROUTER_MODEL=qwen/qwen3.8-27b
```

Reinicie o backend após alterar o ambiente; em Docker, recrie o serviço. O endpoint legado de extração por página envia somente uma página, com limite de 30 mil caracteres, e registra uma execução bem-sucedida por página. Repetir a chamada preserva revisões sem cobrar nova extração. Uma falha ou citação inválida não salva requisitos nem marca a página como processada. Não há varredura automática integral nem reprocessamento de uma página já concluída nesta versão.

A revisão exige nome e justificativa, mantém valor anterior/novo e usa versão para detectar alterações concorrentes. Nome é autodeclarado no protótipo, sem autenticação. A fonte é imutável nesta versão; erros de origem devem ser rejeitados e registrados em um novo requisito correto. OCR permanece pendente.

Documentação de integração: https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request
Modelo: https://openrouter.ai/qwen/qwen3.8-27b

### Credencial Groq

A variável é `GROQ_API_KEY=sua_chave`. O endpoint compatível é `https://api.groq.com/openai/v1`. Apenas definir a chave não troca o provedor: a extração atual continua usando OpenRouter. A integração Groq ainda não foi implementada.

## Análises independentes do edital

Na área Análise, escolha **Documentação e conformidade** ou **Objeto e projeto** e clique em **Analisar documento inteiro**. As análises podem ser iniciadas em qualquer ordem, sem revisar documentos empresariais ou validar uma etapa antes da outra. Apenas uma execução por documento é permitida por vez; a interface informa quando outra análise está em andamento.

A conformidade extrai documentos, certidões, declarações, registros e comprovações exigidas do licitante. O objeto/projeto extrai funcionalidades, capacidades, entregáveis e critérios técnicos. Atestado de experiência da empresa pertence à conformidade; capacidade do produto pertence ao objeto. A seleção da página serve para consultar fontes ou incluir exigências manualmente, sem limitar a análise automática.

O processamento percorre páginas utilizáveis em lotes, persiste progresso e permite retomada sem reenviar páginas concluídas. Páginas sem texto, com erro ou acima de 30 mil caracteres ficam pendentes; OCR não é executado nesta entrega. Anexos em arquivos separados precisam de análise própria. O worker roda no processo da API, sem fila externa; após falha/reinício use continuar/retomar. A primeira execução de cada análise consome chamadas ao OpenRouter. Citações inválidas impedem salvamento parcial do lote.

A revisão da extração ficou em **Revisar interpretação da extração** no detalhe do requisito. É diferente de avaliar a empresa. O endpoint de aprovação documental antigo permanece para compatibilidade e histórico, mas não bloqueia mais a análise técnica.

## Empresas, documentos e comparação preliminar

Abra **Análise → Empresas para comparação** (`/analise/empresas`) e cadastre uma empresa ou use **Usar empresa fictícia de demonstração**. A demonstração inclui contrato social, certidão federal vencida, CNDT e atestado técnico, todos explicitamente fictícios; não são arquivos oficiais. Novos documentos nessa empresa também são identificados como fictícios. Esses exemplos não constituem uma lista universal de documentos obrigatórios; as exigências vêm de cada edital.

Cadastre documentos por texto/transcrição ou envie PDF de até 20 MB e 200 páginas. Informe tipo documental e validade quando aplicável. O PDF original e texto extraído são preservados separadamente dos editais. PDFs sem texto suficiente exigem outro tratamento; não há OCR empresarial nesta versão. Tipo e validade são metadados declarados pelo usuário, não certificados pelo sistema. A aplicação ainda é um protótipo sem autenticação.

Na aba **Documentação e conformidade** da Análise, escolha a empresa e clique em **Comparar / atualizar documentos**. A comparação considera requisitos de conformidade disponíveis naquele clique. Identifica possíveis correspondências por tipos documentais específicos e compara a validade cadastrada com a data atual. Não valida semanticamente o conteúdo, autenticidade, todas as condições do edital, quantidades ou validade na futura data de habilitação.

- Documento não localizado ou tipo ambíguo: **Precisa de validação**, sem declarar não conformidade.
- Todos os documentos candidatos do tipo com validade informada vencida: **Possível incompatibilidade documental**, com justificativa e evidências.
- Documento candidato encontrado: continua **Precisa de validação**; não há confirmação positiva automática.

O analista pode registrar **Empresa conforme** (exige evidência), **Precisa de validação** ou **Empresa não conforme / avaliar esforço**. Exigem responsável e justificativa. Ação necessária, dias e custo estimados são opcionais para registrar avaliação de adequação. Nenhuma dessas decisões altera a interpretação original do edital. Histórico é preservado; alterações na versão do requisito, adição de documentos ou mudança da data de referência tornam a avaliação anterior desatualizada ao atualizar a comparação.

APIs: `GET/POST /companies`, `POST /companies/demo`, `GET /companies/{id}`, `POST /companies/{id}/evidence`, `POST /companies/{id}/evidence/upload`, `GET /companies/{id}/comparison/{document_id}` e `POST /companies/{id}/assessments/{requirement_id}`. No frontend, acessíveis pelo proxy `/api/companies`.

### Agrupamento de páginas

`ANALYSIS_BATCH_PAGES=4` define o máximo de páginas por chamada (aceita 1 a 8). Cada lote também respeita um orçamento de 24 mil caracteres; uma página individual de até 30 mil caracteres pode ser enviada sozinha. Por isso, lotes podem conter menos páginas. O modelo precisa retornar uma entrada para cada página recebida, inclusive sem requisitos, e as citações são verificadas na página correspondente. Um lote só é salvo após validação completa. Em caso de erro, páginas de lotes anteriores continuam salvas; o lote pendente é enviado novamente ao retomar e pode gerar nova cobrança. Não há repetição automática de chamadas que falharam.

Para aplicar mudanças no ambiente Docker: `docker compose up -d --force-recreate backend`. As páginas já analisadas pelo fluxo anterior são reaproveitadas. Não há garantia de ganho proporcional ao tamanho do lote: duração e qualidade precisam ser medidas em um edital real.

### Modelo e foco da classificação

Padrão atual: `qwen/qwen3.8-27b`, com `reasoning: {"enabled": false}` enviado em todas as chamadas de extração. Reinicie/recrie o backend após atualizar `.env`. Isso não reprocessa páginas já concluídas. A distinção usa a obrigação, não apenas a seção: atestado de experiência é conformidade da empresa; capacidade da solução é requisito do objeto. Títulos de sumário não são exigências por si mesmos.

### Porta do backend ocupada

Se `localhost:8000` responder com outra aplicação, configure `BACKEND_PORT=8001` no `.env` da raiz e `API_BASE_URL=http://127.0.0.1:8001` em `frontend/.env.local`. Execute `docker compose up --build -d backend` e reinicie `npm run dev`. A API ficará em `http://localhost:8001/docs`; a porta interna do container continua 8000. Não encerre serviços de outros projetos para liberar a porta.

## Fluxo do agente: inputs e outputs

Documentação completa, com diagrama, contratos JSON e regras: [docs/FLUXO_AGENTE.md](docs/FLUXO_AGENTE.md).

| Etapa | Input | Output |
|-------|-------|--------|
| Radar (`/radar`) | Período, UF, município, modalidade | Oportunidades do PNCP e documentos oficiais |
| Importação (`POST /documents`) | PDF ≤ 20 MB, ≤ 200 páginas | Texto e status por página (`text_extracted`, `ocr_pending`, `failed`) |
| Agente de extração (`POST /documents/{id}/analysis`) | Lotes de páginas + etapa `conformity` ou `technical` | Requisitos `{title, category, excerpt}` por página, salvos só se a citação existir literalmente na página |
| Revisão da extração (`PATCH .../requirements/{id}/review`) | Decisão, autor, justificativa, versão | Requisito `confirmed`, `corrected`, `rejected` ou `specialist_review`, com histórico |
| Empresa (`/api/empresas`, `/companies`) | Perfil, documentos, validade | Contexto de evidências da empresa |
| Matriz de Elegibilidade (`POST /api/elegibilidade/avaliacoes`) | Requisitos do edital + documentos da empresa | Estado preliminar por requisito (`atendido_preliminarmente`, `nao_atendido`, `nao_verificado`, `revisao_especializada`) com regra e evidências |
| Relatório (`GET .../relatorio`) | Avaliação | Itens, pendências e avisos; `habilitacao_declarada: false` |

A IA (OpenRouter, `OPENROUTER_MODEL`) atua só na extração. A matriz usa regras determinísticas, e toda conclusão é humana.

## Empresas e demonstração para o pitch

Abra `/empresas` (perfis usados pela Elegibilidade): perfil fictício completo, sem chave ou backend. Ao salvar, as alterações ficam neste navegador e sobrevivem ao recarregamento. Para levar as edições a outro notebook, abra **Levar configuração para outro notebook**, exporte o JSON e importe-o no destino. O perfil inicial acompanha o código; o armazenamento do navegador não sincroniza automaticamente entre computadores ou endereços.

Para gravar somente a demonstração em outro notebook:

```bash
git clone https://github.com/henriquepedrohttp/LicitaAi.git
cd LicitaAi/frontend
npm ci
npm run dev
```

O cadastro real permanece em `/empresas/cadastro`, protegido por chave, com persistência PostgreSQL e migração explícita. Documentos da apresentação são ilustrativos e não comprovam requisitos. Configuração, endpoints, contrato de Elegibilidade e limites: [docs/EMPRESAS.md](docs/EMPRESAS.md).
