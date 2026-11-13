# LicitaAI — orientações para agentes e colaboradores

## Produto e escopo

Leia `README.md` e `docs/LicitaAI_PRD_v0.3.md` antes de implementar. O PRD distingue decisões confirmadas, propostas e hipóteses; não apresente hipóteses como resultados comprovados.

LicitaAI é um workspace para profissionais que participam de licitações. As cinco áreas são Radar, Análise, Empresas, Elegibilidade e Relatórios. Preserve a identidade da oportunidade e sua origem ao atravessar os módulos. A IA apoia revisão humana; não declara habilitação jurídica definitiva.

O trabalho autorizado nesta sessão é o Radar: descoberta no PNCP, filtros, paginação, detalhes, documentos oficiais e preparação do contrato com Análise. Não implementar Análise, OCR, elegibilidade, relatórios, chatbot, autenticação improvisada, propostas ou lances automáticos.

## Git e colaboração

- Todo desenvolvimento do Radar e seus commits deve ocorrer exclusivamente na branch `radar`. Essa regra substitui a sugestão anterior `feat/radar-pncp`.
- Antes de editar, execute `git status --short`, `git branch --show-current` e confira branches locais e remotas. Se `radar` existir, preserve seu histórico. Caso contrário, crie-a da `main` atualizada somente se isso preservar o trabalho local.
- Nunca desenvolver na `main`, descartar alterações locais, excluir branches de colegas, usar `git reset --hard`, `git clean -fd` ou `git push --force`.
- Não realizar push, abrir PR ou fazer merge sem autorização explícita do usuário.
- Faça commits pequenos e descritivos. Antes de cada commit, revise status e diff, usando caminhos explícitos para não incluir trabalho alheio.
- O módulo Análise pertence a outro integrante. Preserve seus arquivos e contratos. Antes de alterar arquivos compartilhados, identifique e documente o impacto; prefira arquivos específicos do Radar.
- A alteração prévia em `frontend/AGENTS.md` pertence ao usuário e deve ser preservada, sem ser incluída nos commits do Radar.
- Não delegue a outros agentes sem pedido explícito do usuário ou instrução aplicável que exija delegação.

## Arquitetura existente

- `frontend/`: Next.js App Router, React, TypeScript e Tailwind. Consulte `frontend/package.json` para versões e comandos; siga também `frontend/AGENTS.md`.
- Antes de escrever código Next.js, leia os guias pertinentes da versão instalada em `frontend/node_modules/next/dist/docs/`. Não suponha compatibilidade com versões anteriores. `params` e `searchParams` das páginas são assíncronos.
- `frontend/src/app/layout.tsx` e `globals.css` definem navegação e identidade compartilhadas. Preserve os cinco módulos e a identidade visual.
- `frontend/src/app/[area]/page.tsx` contém os estados iniciais das áreas. Prefira rotas específicas em `frontend/src/app/radar/` para o Radar.
- `frontend/src/app/api/health/route.ts` exemplifica comunicação do Next.js com FastAPI usando `API_BASE_URL`, variável exclusiva do servidor.
- `backend/app/main.py`: FastAPI, CORS e verificações `/health` e `/health/ready`. Preserve seu comportamento; esta última verifica PostgreSQL com `SELECT 1`.
- `compose.yaml`: PostgreSQL 17 e backend; frontend executado separadamente. Banco usa volume persistente. Não remover volumes para solucionar problemas.
- `.env.example` e `frontend/.env.example` documentam configuração. Não commitar segredos nem arquivos `.env` reais.

## Integração PNCP e dados

- Fluxo principal: frontend → FastAPI → PNCP. O navegador não consulta PNCP diretamente como integração principal.
- Verifique os endpoints e parâmetros atuais em `https://pncp.gov.br/api/consulta/swagger-ui/index.html` e nos manuais em `https://www.gov.br/pncp/pt-br/pncp/manuais` antes de implementá-los. Registre fontes e limitações na documentação do Radar.
- Não invente busca textual, filtros, ordenação global, limites ou regras de acesso. Quando um filtro ou ordenação operar somente sobre a página consultada, explicite essa cobertura na interface e no contrato.
- Isole o cliente PNCP no backend. Valide entradas e respostas, use timeouts, retentativas limitadas e paginação real. Não carregue todas as oportunidades para simular paginação.
- Preserve o número de controle oficial, referências, origem e horário de consulta. Campos ausentes ficam nulos e aparecem como “Não informado”; nunca complete dados com valores fictícios.
- Diferencie situação oficial de prazo de propostas. Datas sem fuso precisam ser interpretadas conforme documentação da fonte. Valor zero pode representar orçamento sigiloso; não o apresente automaticamente como oportunidade sem custo.
- Valide URLs externas. Não aceite destinos arbitrários nem siga redirecionamentos para endereços não confiáveis no backend; não implemente download remoto por URL fornecida pelo usuário.
- Use cache apenas com limites de tamanho/validade e horário de coleta preservado. Não apresente resposta antiga como consulta nova.
- Evite tabelas e migrações se consulta direta resolver o MVP. Qualquer persistência futura exige migração explícita e não pode alterar tabelas de outros módulos.
- Não salvar favoritos globais sem identidade de usuário. É aceitável adiar o recurso documentando sua dependência de autenticação.
- “Analisar oportunidade” só pode indicar início após confirmação do serviço de Análise. Sem endpoint acordado, mantenha a ação desabilitada e documente um contrato tipado com ID oficial, fonte, metadados, documentos e referências.

## Experiência e qualidade

- Priorize leitura rápida, rastreabilidade, filtros acessíveis e preservação de pesquisa/página ao abrir detalhes e voltar. Não reformule a identidade global sem necessidade.
- Inclua carregamento, busca em andamento, vazio, erro de conexão, erro PNCP, resposta inválida, dados incompletos e oportunidade indisponível, com recuperação quando possível.
- Garanta labels, navegação por teclado, foco visível, feedback acessível e layout desktop/mobile.
- Reutilize os padrões existentes e a biblioteca padrão. Não adicione dependências, abstrações ou configurações sem necessidade concreta.
- Leia os chamadores antes de corrigir funções compartilhadas. Preserve validação e tratamento de erros. Limites conhecidos de atalhos recebem comentário `shortcut: <limite>, <quando evoluir>`.
- Testes backend devem usar mocks sem internet e cobrir consulta, normalização, paginação, parâmetros inválidos, vazio, timeout, erros HTTP, estrutura inválida e identidade oficial.
- Testes frontend devem cobrir renderização, filtros, limpeza, paginação, detalhes/retorno, contexto, loading, vazio, falha e acessibilidade/responsividade básica.
- Execute os testes disponíveis, `npm run lint` e `npm run build` em `frontend/`. Registre comandos e resultados reais; nunca declare teste não executado como aprovado.
- Falhas de rede ou limitações do ambiente devem ser documentadas. Fixtures são permitidas somente em testes ou demonstrações explicitamente identificadas, nunca como consulta oficial ao vivo.

## Execução e entrega

Execução inicial: copie os exemplos de configuração, execute `docker compose up --build -d` e, em `frontend/`, `npm ci` e `npm run dev`. Backend sem Docker: veja o README; requer Python, dependências e `DATABASE_URL` para readiness.

Ao concluir, informe arquitetura, funcionalidades, arquivos alterados, endpoints, contrato com Análise, testes/build executados, instruções de execução, limitações e próximos passos. Não considere a integração validada ao vivo apenas porque mocks passaram. Encerre com o que não foi verificado e riscos relevantes.
