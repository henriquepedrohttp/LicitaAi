# Empresa de demonstração e tentativa de reinício

- A pedido do usuário, executada criação idempotente da empresa Aurora Sistemas — demonstração fictícia no banco configurado do projeto.
- Conferidos quatro registros documentais em texto, todos identificados como fictícios: contrato social, certidão federal vencida em 14/10/2026, CNDT com validade demonstrativa até 12/01/2027 e atestado técnico de experiência em 10 TB. São registros de demonstração, sem arquivos PDF oficiais anexados.
- A pedido do usuário, tentado `docker compose up -d --force-recreate backend` na raiz do projeto.
- Comando falhou com acesso negado ao socket Docker `/var/run/docker.sock`. O backend não foi recriado por esta sessão.
- Não alteradas permissões do Docker nem removidos volumes. Próximo passo: usuário executar o mesmo comando em seu terminal com acesso ao daemon.
