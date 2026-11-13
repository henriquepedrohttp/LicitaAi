# Verificação da base

- npm run lint: aprovado.
- npm run build: aprovado, incluindo TypeScript.
- HTTP 200: início, Radar, Análise, Empresas, Elegibilidade e Relatórios.
- Rota desconhecida: HTTP 404.
- Frontend /api/health consultou FastAPI real: api=ok.
- FastAPI /health: HTTP 200.
- FastAPI /health/ready sem banco: HTTP 503 com database=unreachable, sem expor credenciais.
- docker compose config --quiet: aprovado.
- PostgreSQL real e build Docker: não executados; acesso ao daemon Docker negado nesta sessão.
- npm audit --omit=dev: zero vulnerabilidades na execução.
- npm audit completo: alertas moderados transitivos nas ferramentas de lint (minimatch / typescript-eslint), sem correção automática disponível. Não foi forçada atualização incompatível.

O frontend e a API são base funcional; upload, OCR, PNCP, persistência de domínio, elegibilidade e relatórios ainda precisam ser implementados.

## Branch feature/analise

- Lint e build de produção aprovados após implementação.
- Cinco testes de integração aprovados: persistência/duplicidade/download, conteúdo inválido, PDF corrompido, PDF protegido e documento inexistente.
- Edital original importado pelo proxy do Next.js: 110 páginas com texto nativo extraído, zero páginas com OCR pendente. Isso não comprova cobertura dos requisitos nem qualidade integral da extração.
- Interface verificada no navegador: seleção do edital, cobertura e troca da página 1 para a 2 atualizam o texto e o link ao PDF original. Visualização gráfica do PDF no iframe não foi confirmada no navegador integrado.
- OCR, requisitos por IA, vínculo com oportunidade e revisão humana: pendentes.

## Requisitos rastreáveis

- 11 testes aprovados (5 documentais + 6 de requisitos), com PostgreSQL real e chamadas de IA simuladas nos testes.
- Verificados: fonte inexistente rejeitada, salvamento atômico de candidatos, idempotência por página, páginas com OCR pendente bloqueadas, histórico anterior/novo, conflito de versão e saída truncada do provedor rejeitada.
- Lint e build aprovados. Formulário de requisitos e campos manuais conferidos no navegador.
- Chamada real ao OpenRouter/Haiku 4.5: retornou créditos insuficientes. Nenhum resultado de IA salvo. A qualidade real da extração ainda não foi validada.

## Retomada em 13/11/2026

- Lint executado novamente: aprovado.
- Tentativa de repetir os 11 testes de integração bloqueada neste ambiente: abertura de sockets não permitida e banco indisponível. O resultado anterior acima não foi revalidado nesta sessão.
- Extração real com IA continua pendente de validação.

## Análises independentes e comparação empresarial

- Removido pré-requisito de aprovação de conformidade para análise técnica; cenários de início/execução antes da conformidade aprovados.
- Cadastro de empresas e documentos PDF/texto, perfil fictício e matriz preliminar implementados.
- 37 testes aprovados com PostgreSQL e IA simulada; lint e build aprovados.
- Comparação automática limitada a tipos documentais e validade cadastrados, sem leitura semântica do conteúdo. Correspondência é candidata; ausência é não verificado e vencimento gera alerta preliminar.
- Verificação visual e avaliação com documentos empresariais reais ainda pendentes. Detalhes em `docs/agents/2026-11-13-empresas-comparacao-independente.md`.
