# Radar de Licitações

Implementação na branch `radar`. Consulta oficial sob demanda, sem persistência de oportunidades e sem alteração dos módulos Análise, Empresas, Elegibilidade ou Relatórios.

## Arquitetura e arquivos

Navegador → página Next.js no servidor → FastAPI → PNCP. `API_BASE_URL` continua exclusivo do servidor. O navegador abre links oficiais apenas quando o usuário os seleciona.

- `backend/app/radar/pncp_client.py`: HTTP da biblioteca padrão, TLS, destinos fixos, redirecionamentos bloqueados, timeout de socket de 30 segundos, no máximo duas tentativas para falhas transitórias de conexão/HTTP 5xx e intervalo de 300 ms. Timeout não é repetido automaticamente. O frontend aguarda até 90 segundos e distingue expiração local de erro de conexão. Não repete HTTP 4xx; 429 informa espera. Respostas HTTP interrompidas também recebem tratamento seguro e retentativas limitadas. Resposta limitada a 5 MB. Cache por processo: 64 entradas, 60 segundos, conservando a data original de coleta. Não há fallback silencioso para cache vencido.
- `backend/app/radar/service.py`: normalização, validação dos dados externos, identidade oficial, filtros locais, ordenação, detalhes e documentos.
- `backend/app/radar/schemas.py`: contratos Pydantic de consulta, oportunidade, documentos, resultados e encaminhamento.
- `backend/app/radar/router.py`: endpoints internos.
- `backend/app/main.py`: único ponto de integração compartilhado necessário; registra o router uma vez e preserva health/readiness/CORS. Uma duplicação encontrada durante a verificação foi removida.
- `frontend/src/app/radar/`: página e detalhe contextual por query string, formulário com feedback de busca, loading/erro, cliente exclusivo do servidor, contratos e CSS isolado. `/radar/[id]` redireciona ao detalhe contextual conservando os filtros.
- `backend/tests/test_radar.py`, `frontend/tests/radar.test.cjs`: testes sem internet, com fixtures explicitamente de teste.
- `AGENTS.md`: regras do projeto. `frontend/AGENTS.md` foi preservado.

A alteração encontrada em `backend/requirements.txt` adicionando httpx foi preservada; o cliente Radar usa a biblioteca padrão e seus testes não dependem de httpx. Não foi necessário alterar PostgreSQL, volumes, migrações, navegação global ou componentes dos outros módulos.

## Fontes verificadas

Documentação consultada em 13/11/2026:

- [Swagger da API de consulta](https://pncp.gov.br/api/consulta/swagger-ui/index.html), [OpenAPI de consulta](https://pncp.gov.br/api/consulta/v3/api-docs).
- [Manuais oficiais](https://www.gov.br/pncp/pt-br/pncp/manuais), incluindo o manual de consultas 1.0 e o manual de integração.
- [OpenAPI de integração/documentos](https://pncp.gov.br/api/pncp/v3/api-docs).

Também foram inspecionados os snapshots OpenAPI e um payload real já existentes em `/tmp`. Esses arquivos temporários não são dependências do produto nem fixtures entregues. O snapshot atual limita a consulta de publicações a 10–50 registros por página, diferente do limite mais amplo descrito no manual antigo; a implementação segue o limite atual. Não foram encontrados filtros oficiais de palavra-chave, faixa de valor, situação ou ordenação nesse endpoint. Nenhuma cota numérica por segundo foi confirmada. Os GETs utilizados não declaram exigência de autenticação no snapshot consultado; mudanças de acesso poderão exigir atualização do adaptador.

### Endpoints oficiais usados

- `GET https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao`: `dataInicial`, `dataFinal` em AAAAMMDD, modalidade obrigatória, página e tamanho; UF e código IBGE opcionais.
- `GET https://pncp.gov.br/api/consulta/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}`: contratação individual.
- `GET https://pncp.gov.br/api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}/arquivos`: lista de documentos com paginação.

## Endpoints internos e navegação

```http
GET /api/radar/oportunidades?inicio=2026-11-06&fim=2026-11-13&modalidade=6&uf=PE&pagina=1&tamanho=20
GET /api/radar/oportunidades/{numeroControlePNCP}?documentos_pagina=1
```

O número de controle mantém sua forma oficial `CNPJ-1-SEQUENCIAL/ANO`. O cliente codifica o identificador na URL; o FastAPI aceita a barra no parâmetro de caminho. Não confundir o sequencial PNCP com o número do edital do órgão.

Parâmetros de pesquisa:

| Parâmetro | Comportamento |
| --- | --- |
| `inicio`, `fim` | Datas de publicação ISO; intervalo de até 90 dias, limite local do MVP |
| `modalidade` | Código 1–13; inicial 6, pregão eletrônico |
| `uf` | Inicial PE; vazio consulta todos os estados |
| `municipio` | Código IBGE de 7 dígitos, opcional |
| `pagina`, `tamanho` | Paginação real da fonte; tamanho 10–50, inicial 20 |
| `palavra` | Refinamento local no objeto, órgão e número; até 200 caracteres |
| `situacao` | Refinamento local por situação oficial 1–4; não significa propostas abertas |
| `minimo`, `maximo` | Refinamento local por valor conhecido; valores ausentes não correspondem a uma faixa |
| `ordem` | `publicacao`, `prazo`, `maior`, `menor`; somente registros da página |

O total da fonte é calculado antes dos refinamentos locais. Página sem correspondência não significa ausência de oportunidades nas demais páginas. Nenhuma ordenação global é prometida. Filtros e página permanecem na URL ao abrir detalhes e retornar; a submissão de nova pesquisa reinicia a página.

Documentos usam páginas de 20 registros. Sem total oficial no array, uma página cheia habilita a próxima, que pode estar vazia. Falha de documentos conserva os metadados e mostra aviso; não representa lista vazia confirmada. URLs de documentos devem usar HTTPS e o host exato `pncp.gov.br`, sem credenciais nem porta não padrão. URLs externas são omitidas com aviso e permanecem acessíveis para conferência pelo portal oficial. Não há download de documentos pelo backend.

Campos ausentes são nulos. Datas sem offset são interpretadas em Brasília; a interface também apresenta Brasília. Valor zero da fonte fica indisponível porque pode representar orçamento sigiloso. O critério de julgamento permanece não informado: não foi confirmado como campo do endpoint de contratação utilizado; dados por item precisam de expansão futura.

## Contrato com Análise

O detalhe retorna `encaminhamento`, tipado em Python e TypeScript:

```text
AnalysisHandoff {
  versao: "1"
  oportunidade: Opportunity  // ID, fonte, órgão/CNPJ, objeto, modalidade, número/ano,
                            // valor, datas, situação, links e horário de coleta
  documentos: Document[]    // id, título, tipo, URL oficial e publicação
  documentos_completos: boolean
  documentos_consultados_em: datetime | null
  referencias: string[]     // página oficial, API de metadados e API de documentos
}
```

`documentos_completos` só é verdadeiro para a primeira página, menor que 20 registros e sem avisos. Uma página posterior nunca é apresentada como conjunto completo. `analise_disponivel` é sempre falso. Não existe POST para iniciar análise e o botão permanece desabilitado. Contrato proposto, ainda sem aceite do responsável pelo módulo; não há confirmação de análise iniciada.

Favoritos foram adiados: não há identificação autenticada nem armazenamento global de favoritos.

## Execução

Siga o README para instalar dependências, configurar os exemplos de ambiente e iniciar Docker/backend e frontend. Configure `frontend/.env.local` com `API_BASE_URL=http://127.0.0.1:8000`. Abra `http://localhost:3000/radar`. O Radar não depende de PostgreSQL para consultas; readiness continua verificando o banco para o restante da aplicação.

## Verificação executada

Da raiz:

```bash
PYTHONPATH=backend python3 -m unittest discover -s backend/tests -v
```

Em `frontend/` (Node 22+):

```bash
node --test --test-isolation=none tests/radar.test.cjs
npm run lint
npx tsc --noEmit
npm run build
```

Os testes frontend usam o compilador TypeScript já instalado, renderização React e o runner nativo do Node, sem dependências novas. Desabilita-se isolamento do runner para evitar processos filhos restritos neste ambiente. Os testes HTTP backend percorrem a interface ASGI, validação FastAPI e serialização; o executor de handlers síncronos é substituído por execução inline nos testes devido ao bloqueio de wakeups entre threads do ambiente. Concorrência em produção não foi validada por esse teste.

| Verificação | Resultado nesta execução |
| --- | --- |
| Backend | 22 testes aprovados, sem internet |
| Frontend | 16 testes aprovados |
| Payload real previamente salvo | 10 registros normalizados; total de fonte 248; não é consulta ao vivo |
| Lint e TypeScript | Aprovados |
| Build padrão | Falhou: Turbopack tentou abrir porta interna e recebeu `Operation not permitted` |
| Build alternativo `npm run build -- --webpack` | Falhou ao interpretar saída do TypeScript `--showConfig` |
| Browser desktop/mobile e auditoria visual | Não executados; testes cobrem HTML, labels, feedback, foco e regras CSS, sem comprovar renderização real |
| Integração completa com servidor e PNCP ao vivo | Não executada: terminal sem DNS externo, sem abertura de portas e sem psycopg instalado no Python disponível |

O ambiente possui Python 3.14/FastAPI 0.141.1, enquanto o requirements fixa FastAPI 0.135.1 e a base requer Python 3.12+. A suíte ainda precisa ser repetida no ambiente de dependências fixadas. A compatibilidade com o contrato Next.js instalado foi verificada por leitura da documentação local e TypeScript.

## Pendências antes da demonstração

1. Executar o build e testar o fluxo no navegador fora deste ambiente restrito, com as dependências fixadas.
2. Consultar o PNCP ao vivo e conferir uma amostra de metadados e documentos contra o portal oficial.
3. Confirmar o contrato com o responsável por Análise antes de habilitar processamento.
4. Se a triagem exigir busca e ordenação globais, implementar indexação própria com atualização e cobertura explícitas; o MVP não varre todas as páginas.

Publicação da branch e abertura de PR são realizadas somente mediante autorização explícita; não há merge automático. O estado prévio à reconciliação foi preservado em `/tmp/licitaai-radar-before-reconcile`; não é backup permanente.

A tentativa de preparar um commit apenas com os caminhos do Radar falhou antes de alterar o índice: `.git/index.lock: Read-only file system`. Nenhum commit local foi criado nessa tentativa. A publicação autorizada posteriormente é realizada pelo conector GitHub, preservando a `main` remota atualizada e as mudanças de Análise; o `.git` local permanece sem sincronização. As alterações prévias em `frontend/AGENTS.md` e `backend/requirements.txt` ficaram fora da seleção de staging.

## Diagnóstico da execução local

O log `frontend/.next/dev/logs/next-development.log` mostrou o loader Tailwind renomeando `radar.module.css` para `radar.module.css.css`; os seletores `:global(...)` chegaram ao navegador sem processamento e o escopo deixou de corresponder ao elemento raiz. O Radar passou a importar `radar.css`, com seletores limitados explicitamente a `.radar`, sem mudar o loader global. Também foram diferenciadas as chaves dos filtros e resultados, que podiam coincidir.

Respostas incompatíveis agora registram `[Radar] Resposta do backend incompatível` no terminal do Next.js, com etapa de validação e status HTTP, sem payload nem segredos. Colete esse registro e a resposta do endpoint interno ao investigar uma execução que retorna “resposta inválida”. O teste cruzado com 10 registros de payload PNCP previamente salvo passou pelo serializador Python e pelo validador TypeScript; a resposta do backend em execução ainda precisa ser conferida. Acesso aos logs Docker foi negado pelo ambiente e a automação de navegador não estava disponível.

### Causa identificada no serviço em execução

O log do Next.js confirmou resposta HTTP 200 com `content-type: text/html`, sem redirecionamento, na URL `http://127.0.0.1:8000/api/radar/oportunidades`. O HTML tinha título `Just Analytics`: a porta apontava para outra aplicação. Não era resposta JSON do PNCP.

O Compose agora aceita `BACKEND_PORT` com padrão 8000, conservando o comportamento dos outros ambientes. Nesta máquina, os arquivos locais ignorados pelo Git foram configurados com `BACKEND_PORT=8001` e `API_BASE_URL=http://127.0.0.1:8001`. É necessário recriar/iniciar o backend via `docker compose up --build -d backend` para aplicar a publicação de porta. Reinicie o Next.js e faça uma recarga completa do navegador para descartar DOM antigo duplicado pelas chaves React. A busca ao vivo ainda depende dessa inicialização, que exige acesso ao Docker fora do sandbox.

Consulta conhecida para verificação: pregão eletrônico, PE/Recife (IBGE 2611606), publicação em 06/11/2026, sem palavra-chave ou faixa de valor. O payload oficial anteriormente salvo contém a contratação `00396895000125-1-000485/2026`, para serviços de motorista, nesse recorte. Esse dado salvo não garante disponibilidade atual da fonte.

### Backend não consegue importar `app.main` no Fedora

A inspeção local encontrou Fedora 44, `/sys/fs/selinux/enforce=1` e os fontes com contexto `user_home_t`. O bind mount não possuía rotulagem SELinux. O Compose passou a montar exclusivamente `backend/app` com `:Z` (rótulo privado do container), conforme a documentação Docker. Essa é uma correção da configuração encontrada; a causa do erro de importação ainda deve ser confirmada dentro do container, pois o sandbox não permite acessar o daemon.

Aplique com `docker compose up --build -d --force-recreate backend` e confira `curl -f http://localhost:8001/health`. Se persistir, `docker compose exec backend python -c "import app.main; print(app.main.app.title)"` revela o traceback completo da importação. Nenhum volume PostgreSQL precisa ser removido.

### Consulta ao vivo confirmada após ajuste de timeout

Após o backend iniciar na porta 8001, uma consulta retornou HTTP 504 com o limite antigo de 6 segundos. O cliente foi ajustado para 30 segundos de timeout de socket, sem repetir consultas após timeout; falhas transitórias de conexão e HTTP 5xx continuam com no máximo duas tentativas. O Next.js aguarda até 90 segundos, inclusive para o fluxo sequencial de metadados e documentos, e diferencia expiração durante conexão ou recebimento do JSON. Esses são limites de espera; não prometem prazo de resposta do PNCP.

O log real `frontend/.next/dev/logs/next-development.log` registrou `[Radar] Consulta concluída` com 10 registros, em 4.193 ms, 4.746 ms e 4.937 ms após recompilação. Esses registros foram emitidos pelo servidor Next.js após receber e validar a resposta do backend; não são resultados de fixture. A listagem ao vivo foi confirmada nessa execução. Detalhes/documentos ao vivo, avaliação visual completa e build de produção permanecem pendentes.
