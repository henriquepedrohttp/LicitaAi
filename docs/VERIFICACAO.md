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
