# Empresas — implementação do piloto

## Escopo e arquitetura

Implementação exclusiva na branch `empresas`. O estado inicial continha alterações locais do Radar e de `frontend/AGENTS.md`; elas foram preservadas. A missão de Empresas substitui o escopo Radar e a branch descritos nos AGENTS.md para este trabalho. Nenhuma alteração funcional em Análise, Elegibilidade ou Relatórios. Publicação da branch autorizada pelo usuário após revisão; sem PR ou merge na main. A entrega usa como base o histórico remoto do Radar (`f02a17e`), que já inclui a Análise da main (`3438a20`), evitando publicar um checkout antigo sem esses módulos.

Fluxo: navegador → Route Handler Next.js `/api/empresas` → FastAPI → PostgreSQL. Rotas próprias `/empresas` e `/empresas/{id}` precedem o placeholder `[area]`. O layout, navegação e CSS globais permanecem intactos. As cores, tipografia, superfícies, bordas e medidas seguem o Radar em CSS restrito a `.empresas`.

Impacto compartilhado: `backend/app/main.py` recebe somente o import e registro de `empresas_router`. O registro existente do Radar, CORS e health/readiness são preservados. O frontend utiliza proxy de mesma origem; não precisa ampliar o CORS global. `compose.empresas.yaml` é um override opcional, sem alterar o Compose original. Nenhuma nova dependência.

Arquivos desta entrega:

- `backend/app/empresas/`: `__init__.py`, `schemas.py`, `router.py`, `migrate.py` e `migrations/001_empresas.sql`.
- `backend/app/main.py`: duas linhas próprias para registrar Empresas; as alterações anteriores do Radar permanecem.
- `frontend/src/app/empresas/`: `layout.tsx`, `page.tsx`, `[id]/page.tsx`, `workspace.tsx`, `access.tsx`, `profile-form.tsx`, `documents.tsx`, `contracts.ts` e `empresas.css`.
- `frontend/src/app/api/empresas/[[...path]]/route.ts`: BFF privado.
- `backend/tests/test_empresas.py` e `frontend/tests/empresas.test.cjs`: novos testes, sem modificar os testes do Radar.
- `compose.empresas.yaml` e este `docs/EMPRESAS.md`: configuração opcional e documentação. README, exemplos de ambiente, requirements, Compose original e AGENTS.md existentes não foram editados por esta entrega.

## Funcionalidades

### Modelo mockado de configuração

Para a gravação do pitch, `/empresas` abre diretamente o perfil demonstrativo da Aurora, sem chave, com todos os campos preenchidos. `/empresas/demo` mostra o mesmo perfil. A apresentação contém identificação visual da empresa, indicadores de áreas/capacidades/referências e quatro seções: Visão geral, Capacidade técnica, Documentos e Pendências. Um aviso discreto identifica os dados fictícios. Os quatro documentos são somente referências ilustrativas, sem arquivos ou verificação; não há download simulado nem conclusão de habilitação.

Use Editar perfil para configurar os dados e, na seção Capacidade técnica, Editar capacidade técnica. Os formulários mantêm a validação mínima. Ao salvar, o perfil fica em `localStorage['licitaai.empresas.demo.v1']` e sobrevive ao recarregamento e à reabertura no mesmo navegador/endereço. Nenhuma chamada à API, acesso a arquivos privados ou alteração da empresa selecionada é feita. O CNPJ é um exemplo de formato com DV válido, sem afirmar existência cadastral. O cadastro real está em `/empresas/cadastro` (link discreto Cadastro privado), com a mesma proteção por chave. Não insira dados sensíveis na demonstração.

O perfil inicial completo está no código e aparece em qualquer notebook. Edições locais não sincronizam automaticamente: abra **Levar configuração para outro notebook**, clique em **Exportar perfil do pitch**, copie `licitaai-empresa-pitch.json` e use **Importar perfil do pitch** no destino. O arquivo contém somente formato/versionamento e campos do perfil, sem chave, documentos privados ou identidade de usuário. Importação exige estrutura completa conhecida, formato v1, tipos/limites, CNPJ/CNAE e UF/porte válidos; limite de 128 KiB. Arquivo inválido ou falha de armazenamento mantém o perfil anterior. Navegação anônima, limpeza dos dados do navegador ou troca de domínio/porta não preservam o armazenamento: exporte uma cópia antes da gravação. Restaurar exemplo fictício agora exige confirmação porque substitui o perfil salvo.

O mesmo formulário de cadastro real agora valida no cliente razão social, CNPJ numérico/alfanumérico (formato, repetição e dígitos verificadores), CNAEs opcionais de sete dígitos e limites de listas. Normaliza CNPJ antes do envio. Os campos nativos continuam validando obrigatoriedade, tamanho e opções de UF/porte. As validações existentes do backend permanecem obrigatórias e inalteradas. Sem consulta de situação cadastral, Receita Federal ou avaliação jurídica.

Arquivos adicionais: `frontend/src/app/empresas/demo/page.tsx`, `demo/sections.tsx`, `demo/example.ts`, `demo/storage.ts`, `cadastro/page.tsx` e `validation.ts`. Alterados `page.tsx` (demonstração como entrada), `layout.tsx` (cabeçalho sem link redundante), `empresas.css` (apresentação do perfil), `profile-form.tsx` (validação antes de salvar), `contracts.ts` (campos obrigatórios vazios preservados como string), `workspace.tsx` (Facts aceita Profile; retorno à listagem privada) e os testes de Empresas. Nenhuma alteração adicional no backend ou na configuração de acesso. `backend/requirements-empresas-test.txt` declara somente o extra httpx para os testes, sem alterar os requisitos compartilhados.

Verificação desta extensão: nove cenários de Empresas aprovados (`node tests/empresas.test.cjs`); os dois arquivos frontend passaram em `node --test tests/*.test.cjs`; lint aprovado; build com Webpack aprovado incluindo `/empresas/demo`. O build padrão voltou a falhar pela restrição de abertura de porta interna do Turbopack. Backend sem internet: 27 testes aprovados, sete de integração ignorados sem variável de banco; não foi necessário repetir a integração PostgreSQL nesta mudança de frontend. Consulta HTTP local da demonstração retornou 200, com campos preenchidos, aviso de mock e sem formulário de chave. Não foram executados cliques reais em navegador.

Atualização para o pitch: dez cenários de Empresas aprovados, incluindo abertura direta da página principal com todos os campos preenchidos e as quatro seções, documentos ilustrativos e preservação da chave na rota privada. Testes frontend de Empresas e Radar, lint, `git diff --check` e build com Webpack aprovados. Conferência HTTP local: `/empresas` e `/empresas/demo` retornaram 200 com perfil completo e sem formulário de chave; `/empresas/cadastro` retornou 200 com solicitação de chave. O backend não foi alterado. A apresentação visual e os cliques continuam sem validação em navegador conectado.

- Listagem paginada em grupos de 20, cadastro, consulta, edição e seleção da empresa.
- Identificadores UUID estáveis, CNPJ único, normalização e dígitos verificadores dos formatos numérico e alfanumérico. Validação de formato não consulta a Receita nem confirma existência cadastral. Algoritmo: [manual da Receita Federal](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/cnpj/manual-dv-cnpj.pdf).
- Razão social e CNPJ obrigatórios; demais campos opcionais para preenchimento progressivo. CNAEs informados exigem sete dígitos; UF aceita somente unidades brasileiras. Limites de tamanho e listas no backend.
- Perfil com Visão geral, Capacidade técnica, Documentos e Pendências. Cadastro e capacidade técnica são editados em formulários separados. Controle otimista de revisão evita sobrescrever edição concorrente.
- Seleção em `sessionStorage['licitaai.empresaSelecionada']`: somente UUID, válida nesta aba. O consumidor deve carregar o contexto autorizado desse UUID; nenhuma avaliação é iniciada. A seleção pode deixar de existir e exige tratamento de 404 pelo consumidor.
- PDF até 10 MiB, categoria, título, data de envio, validade informada, SHA-256, prévia/download autorizados e substituição com referência à versão anterior. Histórico e versões excluídas aparecem mediante seleção na interface.
- Exclusão documental apaga bytes daquela versão e mantém metadados/timestamp para rastreabilidade. Versões anteriores não são apagadas automaticamente nem voltam a ser atuais. Exclusão de empresa é permitida apenas sem qualquer histórico documental.
- Campos preenchidos não significam perfil verificado. Categorias ausentes são sugestões de organização, sem presumir exigência do edital. Prazo vencido usa a data civil de Brasília; validade informada não significa autenticidade ou aderência.

## Acesso e limites de segurança

**Piloto de workspace único, sem multiusuário ou multi-organização.** Todos os portadores da mesma chave acessam o mesmo conjunto de empresas. Não distribuir a chave entre organizações. Não há contas, papéis, auditoria individual, recuperação de senha ou integração de autenticação global.

Todas as rotas FastAPI de Empresas, incluindo metadados, contexto e bytes, exigem `Authorization: Bearer <EMPRESAS_ACCESS_KEY>`. Sem configuração de ao menos 32 caracteres, retornam 503; sem credencial correta, 401. Use uma chave aleatória, privada e longa. A interface a solicita ao operador e a mantém somente na memória do layout de Empresas: não grava em URL, cookie, localStorage, sessionStorage ou logs. Ao recarregar a página ou sair da área, o acesso precisa ser informado novamente. Encerrar acesso remove a chave da memória. Rotação no backend revoga o acesso futuro da chave anterior.

O BFF encaminha a credencial apresentada, nunca injeta uma chave administrativa para visitantes anônimos. Aceita somente caminhos internos do módulo, não segue redirects, limita corpo e timeout e usa `private, no-store`. O backend também desabilita cache nas consultas privadas. Arquivos não têm diretório público, URL assinada, endpoint externo ou envio a provedor de IA. Título documental vai em header codificado, evitando nomes empresariais nos logs de URLs. Não registrar corpos, headers de autorização ou parâmetros SQL na infraestrutura.

**Uso inicial local, com dados fictícios ou expressamente autorizados para o piloto.** Antes de receber acervo corporativo de produção: autenticação por usuário/organização, autorização com tenant, auditoria atribuível, HTTPS e limitação de requisições no ingresso, política aprovada de retenção/backup e inspeção isolada de PDFs. A chave compartilhada não substitui essas capacidades. Downloads já realizados não podem ser revogados.

Validação atual do arquivo confere MIME, tamanho e envelope `%PDF`/`%%EOF`; não valida integralmente a estrutura, conteúdo, malware, assinatura ou autenticidade. A prévia abre um Blob local no visualizador do navegador; não é processamento de confiança. Nenhum documento pode receber status verificado neste MVP. Documentos malformados que passam pelo envelope podem falhar ao abrir. Não há OCR, extração nem avaliação jurídica.

## Dados e migração

Migração explícita: `backend/app/empresas/migrations/001_empresas.sql`.

| Tabela | Conteúdo |
| --- | --- |
| `empresas_perfis` | UUID, CNPJ único, perfil JSONB validado pelo schema Pydantic, revisão, criação e atualização |
| `empresas_documentos` | UUID, FK da empresa, FK única da versão anterior, versão, categoria, título, validade, tamanho, SHA-256, envio, exclusão e verificação fixa `nao_verificado` |
| `empresas_arquivos` | FK do documento e bytes PDF privados em `bytea`, separados dos metadados |
| `empresas_migracoes` | Nome, checksum e data das migrações aplicadas |

As operações de metadados/bytes são transacionais: falha não deixa um upload parcial. Serialização por perfil impede cadeias de versão concorrentes. Revisão do perfil também aumenta quando documentos são enviados/excluídos. O snapshot de Elegibilidade bloqueia o perfil durante a consulta para consistência com suas evidências. O migrador é idempotente, usa lock transacional e rejeita alteração retroativa de migração aplicada. Não cria ou modifica tabelas de outros módulos. Migração não roda automaticamente no startup.

Armazenar PDFs no PostgreSQL simplifica permissões, persistência e atomicidade do piloto, com custo de tamanho do banco/backups. O limite por PDF não é uma quota total de armazenamento. Listagem de documentos/histórico ainda não é paginada. Evoluir para storage privado e paginação quando houver volume real; nunca tornar o bucket público. A exclusão remove os bytes da base ativa, mas backups seguem a política operacional de retenção.

## Endpoints

Prefixo FastAPI e BFF: `/api/empresas`. Todos exigem a chave apresentada pelo operador.

| Método | Caminho após o prefixo | Resultado |
| --- | --- | --- |
| GET | `?pagina=1` | Até 20 empresas, ordem estável de criação/UUID |
| POST | vazio | Cria perfil (JSON `Profile`) |
| GET | `/{id}` | Perfil, revisão, contagem de documentos atuais e campos pendentes |
| PUT | `/{id}` | Substitui campos do perfil; exige `revisao` atual |
| DELETE | `/{id}` | Exclui empresa sem histórico; caso contrário 409 |
| GET | `/{id}/documentos` | Metadados de todas as versões, incluindo exclusões |
| POST | `/{id}/documentos?tipo=...&validade=AAAA-MM-DD&anterior_id=...` | Bytes PDF no corpo; `X-Document-Title` contém título com percent-encoding; validade e anterior opcionais |
| GET | `/{id}/documentos/{documento_id}/arquivo?download=true` | PDF autorizado; sem `download=true`, resposta inline |
| DELETE | `/{id}/documentos/{documento_id}` | Apaga bytes da versão e registra exclusão |
| GET | `/{id}/contexto-elegibilidade` | Snapshot tipado de perfil e evidências |

Tipos: `juridico`, `fiscal_trabalhista`, `atestado_tecnico`, `economico_financeiro`, `outro`. Erros relevantes: 401 acesso; 404 não encontrado/excluído; 409 CNPJ duplicado, revisão obsoleta ou substituição concorrente; 413 tamanho; 415 MIME; 422 campos/envelope; 503 indisponibilidade, configuração ou migração pendente. Erro de persistência não expõe detalhes da conexão/SQL.

## Contrato com Elegibilidade

Schemas canônicos em `backend/app/empresas/schemas.py`; espelho TypeScript em `frontend/src/app/empresas/contracts.ts` (`EligibilityContext`). OpenAPI disponível em `/docs` quando o backend está ativo.

`empresas.elegibilidade.v1` contém `consultado_em`, `empresa` (UUID, revisão, perfil e timestamps), `declaracoes_verificadas: false`, `documentos` (UUID, empresa, versão/anterior, tipo, validade, SHA-256, exclusão, atual, vencido, verificacao e referência protegida) e `avisos`. Cada referência exige a mesma autorização; não é URL pública. A Elegibilidade deve selecionar versões atuais não excluídas, registrar UUID/hash/revisão utilizados e tratar mudanças como necessidade de revisão. Histórico também é fornecido para rastrear avaliações anteriores.

Status documental sempre `nao_verificado`. Não há endpoint para marcar documento como validado nem validação jurídica. Nenhum documento ou capacidade declarada comprova por si um requisito. O consumidor não deve converter ausência em inaptidão ou preenchimento em habilitação. A implementação do motor e a integração de telas pertencem ao módulo Elegibilidade e não foram alteradas.

## Executar

1. Siga o README para configurar `.env`, banco e `frontend/.env.local`. Preserve a porta usada pelo Radar (`BACKEND_PORT`/`API_BASE_URL`).
2. Gere uma chave local com `python3 -c 'import secrets; print(secrets.token_urlsafe(32))'` e acrescente `EMPRESAS_ACCESS_KEY=<chave>` ao `.env` privado da raiz. Não commitar ou publicar a chave.
3. Execute `docker compose -f compose.yaml -f compose.empresas.yaml up --build -d`.
4. Execute a migração explicitamente: `docker compose -f compose.yaml -f compose.empresas.yaml exec -T backend python -m app.empresas.migrate`.
5. Em `frontend/`, execute `npm ci` se necessário e `npm run dev`. Abra `/empresas` para o pitch sem chave, ou `/empresas/cadastro` e informe a chave do workspace para dados persistidos.

Sem Docker: em `backend/`, instale `requirements.txt`, configure `DATABASE_URL` e a chave no `.env` da raiz, execute `.venv/bin/python -m app.empresas.migrate` e `.venv/bin/uvicorn app.main:app --reload`. Não remover volumes para iniciar/migrar.

## Verificação

Resultados em 13/11/2026. Testes automatizados usam apenas dados explicitamente fictícios, sem enviar documentos a serviços externos.

- Backend: `.venv/bin/python -m unittest discover -s tests -v`.
- Dependências de teste de Empresas: em `backend/`, instale `.venv/bin/python -m pip install -r requirements-empresas-test.txt`. O httpx é necessário somente para testar HTTP ASGI sem rede externa.
- Integração: defina `EMPRESAS_TEST_DATABASE_URL` para PostgreSQL de desenvolvimento e repita o comando. Os testes criam/removem apenas um schema `empresas_test_<UUID>`; não limpam o schema público. Exigem permissão de criar schema. Sem a variável, integração é marcada como não executada.
- Frontend: `node --test tests/*.test.cjs`, `npm run lint`, `npm run build`.

| Verificação executada | Resultado real |
| --- | --- |
| Backend sem integração | 27 passaram, 7 de integração explicitamente ignorados sem variável de banco |
| Backend com PostgreSQL local e schema isolado | 34 testes passaram, nenhum ignorado; schema de teste removido ao final |
| Frontend `node --test tests/*.test.cjs` | 2 arquivos passaram: Empresas (6 cenários) e Radar |
| Frontend `npm run lint` | Passou |
| Frontend `npx tsc --noEmit` | Passou |
| Frontend `npm run build` (Turbopack) | Falhou no ambiente: `binding to a port / Operation not permitted`, inclusive após tentativa com permissão ampliada |
| Frontend `npm run build -- --webpack` | Passou: compilação, TypeScript, geração de páginas e rotas dos dois módulos |
| `git diff --check` | Passou |
| Browser desktop/mobile e E2E visual | Não executados: CLI Maestri ausente e browser access host indisponível na ferramenta alternativa |

O teste PostgreSQL foi executado com a URL local lida do `.env` para `EMPRESAS_TEST_DATABASE_URL`, sem imprimir credenciais. Cobre CRUD persistido, unicidade, revisões concorrentes, acesso negado, escopo empresa/documento, migração idempotente, envelope/tamanho/MIME, versões, validade vencida, bytes apagados, metadados retidos e contrato. A suíte existente do Radar permaneceu aprovada com mocks sem PNCP ao vivo.

Os seis cenários frontend cobrem payload de edição progressiva, marcação de acesso/formulários, declarações/pendências/documentos ausentes, mensagens HTTP e proxy (autorização, limites, headers e destinos). Não simulam cliques reais em navegador, upload por seletor nativo, histórico/Voltar ou inspeção visual responsiva. Layout em duas colunas adapta para uma em até 600px; campos têm labels, controles nativos e foco visível. Esses recursos ainda exigem QA interativo. Não houve conexão ao vivo do browser com o módulo, nem migração aplicada ao schema operacional; somente ao schema isolado de teste.

Próximos passos: executar o guia de inicialização e QA desktop/mobile no ambiente do time, acordar o consumo de `empresas.elegibilidade.v1` com o responsável de Elegibilidade e aprovar identidade por organização/política documental antes de usar dados corporativos de produção. O build padrão com Turbopack precisa de nova verificação em host com as permissões necessárias; a alternativa Webpack não altera os scripts existentes.

## Revisão final contra a missão original

Revisão para uso em piloto/pitch, com uma equipe e dados demonstrativos; não é aceite de produção multi-organização.

| Critério | Resultado e evidência |
| --- | --- |
| Cadastrar, consultar, editar e selecionar empresa | Implementado no cadastro privado; CRUD, unicidade, revisão concorrente e paginação validados com PostgreSQL |
| Perfil estruturado e progressivo | Campos cadastrais, segmento, produtos/serviços, capacidades, experiência, projetos e tecnologias; formulários por seção |
| Declaração versus evidência | Origem declarada, documentos sempre não verificados; ausência e validade não viram conclusão jurídica |
| Documentos privados | Upload, download, substituição/versionamento, exclusão de bytes com metadados preservados; tamanho, MIME, envelope e acesso validados |
| Persistência e migração | PostgreSQL transacional com migração idempotente no cadastro; demonstração salva no navegador com exportação/importação para outro notebook |
| Contrato de Elegibilidade | `empresas.elegibilidade.v1`, snapshot coerente e referências autenticadas; motor de avaliação não implementado aqui |
| Identidade visual e escopo | CSS restrito a Empresas; cinco módulos mantidos; histórico remoto de Radar/Análise preservado e suas suítes executadas |
| Desktop/mobile e acessibilidade | Layout responsivo, labels, controles nativos, foco e avisos acessíveis implementados; QA visual/interativo ainda não executado por indisponibilidade de navegador conectado |

Correções antes da publicação: persistência das edições do pitch, importação/exportação validada, tratamento de falha de armazenamento sem apagar dados e teste explícito que o cadastro privado continua exigindo chave. Formato e validação do CNPJ não confirmam inscrição na Receita. Documentos ilustrativos do pitch não são arquivos empresariais enviados.

Validação final da combinação atualizada em cópia isolada: **45 testes backend aprovados, nenhum ignorado**, incluindo Análise e Radar, com servidor temporário, PostgreSQL em schemas exclusivos e OpenRouter mockado, sem cobrança. Dados operacionais e volumes preservados; schemas de teste removidos ao final. **12 cenários frontend de Empresas aprovados**, arquivo de testes do Radar aprovado, lint e build `npm run build -- --webpack` aprovados. O build incluiu `/analise`, `/radar`, `/empresas`, `/empresas/cadastro` e o BFF. `git diff --check` aprovado. Nenhuma validação visual ou entre dois notebooks físicos foi declarada como executada.

Limites que permanecem: autenticação compartilhada de um único workspace no cadastro real, inspeção de PDF apenas por envelope, histórico documental sem paginação, ausência de auditoria individual e de política corporativa de retenção. A demonstração local não sincroniza computadores automaticamente e não deve conter dados sensíveis. Esses limites já são explícitos no produto/documentação; autenticação por organização e validação documental completa continuam necessários antes de produção.
