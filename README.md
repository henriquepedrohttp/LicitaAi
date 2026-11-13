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

## Análise automática em duas etapas

Na área Análise, selecione o arquivo e clique em **Analisar documento inteiro** na etapa **Documentação e conformidade**. Não é necessário escolher páginas para extrair: o sistema percorre todas as páginas com texto utilizável, em lotes de até 4 páginas, e mostra progresso. Páginas sem texto, com erro ou acima de 30 mil caracteres ficam explicitamente bloqueadas; OCR não é executado nesta entrega. Anexos em arquivos separados precisam ser importados e analisados separadamente.

A primeira etapa busca documentos, certidões, declarações, registros e comprovações de habilitação/qualificação do licitante. Revise cada sugestão: confirme, corrija ou rejeite. Pendências e pedidos de revisão especializada bloqueiam a validação. Depois informe responsável e justificativa e use **Validar etapa e liberar análise técnica**. Isso valida a revisão da lista de exigências, não a conformidade ou habilitação de uma empresa.

Somente então é possível iniciar a etapa **Objeto e projeto**, que procura funcionalidades, capacidades, entregáveis e critérios técnicos. As etapas são separadas mesmo quando a categoria é técnica: atestado de capacidade da empresa pertence à conformidade; capacidade do produto pertence ao objeto. Alterar ou adicionar requisitos de conformidade invalida a aprovação e bloqueia a continuação técnica até nova validação. Resultados técnicos anteriores são preservados e precisam ser reconferidos nesse caso.

O processamento roda em segundo plano dentro do backend, com progresso persistido por página/etapa. Pode sair da tela e voltar. Após uma falha ou reinício da API, use continuar/retomar; páginas concluídas não são enviadas novamente ao provedor. A primeira análise de cada etapa faz chamadas por lote de páginas e pode consumir créditos do OpenRouter. Não há estimativa garantida de duração nem fila externa durável nesta versão. Citações inválidas interrompem a etapa sem salvar parcialmente os requisitos do lote. Resultados de extrações antigas ficam em **Extrações anteriores** e não contam para validar a nova etapa.

Endpoints: `GET/POST /documents/{id}/analysis` e `POST /documents/{id}/analysis/approve`. A liberação técnica é conferida no backend; a aprovação registra autor, justificativa, data e versão dos requisitos revisados. Os nomes continuam autodeclarados no protótipo.

### Agrupamento de páginas

`ANALYSIS_BATCH_PAGES=4` define o máximo de páginas por chamada (aceita 1 a 8). Cada lote também respeita um orçamento de 24 mil caracteres; uma página individual de até 30 mil caracteres pode ser enviada sozinha. Por isso, lotes podem conter menos páginas. O modelo precisa retornar uma entrada para cada página recebida, inclusive sem requisitos, e as citações são verificadas na página correspondente. Um lote só é salvo após validação completa. Em caso de erro, páginas de lotes anteriores continuam salvas; o lote pendente é enviado novamente ao retomar e pode gerar nova cobrança. Não há repetição automática de chamadas que falharam.

Para aplicar mudanças no ambiente Docker: `docker compose up -d --force-recreate backend`. As páginas já analisadas pelo fluxo anterior são reaproveitadas. Não há garantia de ganho proporcional ao tamanho do lote: duração e qualidade precisam ser medidas em um edital real.

### Modelo e foco da classificação

Padrão atual: `qwen/qwen3.8-27b`, com `reasoning: {"enabled": false}` enviado em todas as chamadas de extração. Reinicie/recrie o backend após atualizar `.env`. Isso não reprocessa páginas já concluídas. A distinção usa a obrigação, não apenas a seção: atestado de experiência é conformidade da empresa; capacidade da solução é requisito do objeto. Títulos de sumário não são exigências por si mesmos.
