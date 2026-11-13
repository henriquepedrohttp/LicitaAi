# Agrupamento de páginas na análise automática

## Solicitação

Reduzir demora agrupando páginas por chamada ao modelo, preservando etapas de conformidade e requisitos técnicos.

## Alterações

- Padrão de até 4 páginas por chamada, configurável via `ANALYSIS_BATCH_PAGES` (1 a 8).
- Orçamento adicional de 24 mil caracteres por lote; páginas individuais até o limite existente de 30 mil podem ser enviadas sozinhas.
- Enviados textos com números originais de página. Resposta estruturada exige exatamente uma entrada por página recebida, incluindo resultados vazios.
- Rejeitados números desconhecidos, duplicados, páginas omitidas, saída truncada e citações que não pertencem à página indicada.
- Até 30 requisitos por página no schema; orçamento de saída aumentado para 12 mil tokens por lote. Saída truncada não é aceita como completa.
- Persistência atômica do lote; progresso continua registrado por página e etapa. Lotes concluídos são reaproveitados ao retomar, inclusive páginas do processamento anterior.
- Uma falha preserva lotes anteriores. Retomar reenvia o lote não salvo e pode incorrer em cobrança adicional. Não há retry automático ou chamadas paralelas nesta entrega.
- Progresso visual informa faixa de páginas atual e tamanho máximo do lote. Mantidos bloqueio por cobertura parcial e validação humana antes da etapa técnica.
- Atualizados Compose, exemplo de ambiente e README. Nenhuma credencial exposta e nenhum arquivo `.env` modificado nesta entrega.

## Validação

- Compilação dos módulos Python aprovada.
- 24 testes aprovados com PostgreSQL real e IA simulada, incluindo redução de chamadas, fontes por página, atomicidade do lote, retomada, validação do schema e orçamento de texto.
- Lint e build Next.js/TypeScript aprovados; `git diff --check` aprovado.
- A primeira tentativa de testes ficou aguardando a API principal na porta 8000, que não respondeu ao health em 4 segundos. Interrompido somente o processo de testes iniciado nesta tarefa.
- Executada API temporária na porta 18001 para testes de integração, sem reload e sem chamadas pagas. Encerrada após testes.
- Não medido ganho real com OpenRouter nem avaliada qualidade em edital real. Para 110 páginas, se couberem 4 por lote, são 28 chamadas por etapa em vez de 110; isso não promete aceleração de 4 vezes.

## Aplicar

Executar na raiz: `docker compose up -d --force-recreate backend`. A sessão não tem acesso ao socket Docker para recriar o serviço. Atualizar a tela Análise e usar continuar/retomar na etapa desejada. Páginas já persistidas são preservadas; uma chamada em andamento pode ser interrompida na recriação e seu lote pendente precisará ser reenviado.
