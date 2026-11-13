# Análise automática em duas etapas

## Solicitação

Analisar documento completo sem seleção de páginas pelo usuário: primeiro documentação/conformidade, validação humana e somente depois requisitos técnicos do objeto/projeto.

## Estado inicial e escopo

- Checkout encontrado em `feature/analise`, com alterações anteriores de modelos/ambiente e documentação; preservado sem checkout, merge ou descarte.
- `origin/main` consultada em `3438a20`; alterações implementadas na branch atual.
- Não instalado MarkItDown/Docling e não implementado OCR nesta entrega.

## Implementação

- `backend/app/workflow.py`: início em segundo plano, consulta de progresso e aprovação explícita da etapa documental.
- Resultados tipados por etapa e prompts distintos: habilitação/qualificação do licitante versus características do objeto contratado.
- Todos os textos de páginas utilizáveis são percorridos sequencialmente; não depende da página selecionada na interface. Não há filtragem por títulos que exclua silenciosamente páginas.
- Progresso e resultados persistidos por página/etapa; retomada não repete páginas concluídas. Lock PostgreSQL evita execução simultânea no documento.
- Falhas e páginas sem texto/longas impedem cobertura completa. Citações verificadas e persistência atômica por página.
- Validação exige cobertura completa, revisão de todas as sugestões e responsável/justificativa; ausência de requisitos também exige aprovação explícita.
- Aprovação registra snapshot dos requisitos, versões e cobertura. Alterações posteriores invalidam liberação técnica; backend verifica o gate antes e depois de cada chamada técnica.
- Registros antigos preservados como `legacy`, sem conversão automática que pudesse atestar conformidade.
- Interface: duas etapas, progresso periódico, revisão e validação; seleção de página mantida para consulta de fonte/inclusão manual. Aba de resultados anteriores preservada.
- Migração aditiva e tabelas novas inicializadas sem apagar registros existentes.
- Documentado fluxo e limitações no README.

## Verificação

- Python: compilação dos módulos aprovada.
- 18 testes com PostgreSQL real aprovados (11 anteriores + 7 novos), usando IA simulada, sem chamadas pagas.
- Novos testes: gate e etapas separadas, retomada/idempotência, citações inválidas, bloqueio por OCR pendente, validação obsoleta, concorrência e inclusão manual técnica bloqueada antes da validação.
- Lint e build Next.js/TypeScript aprovados.
- API local respondeu health e publicou as novas rotas no OpenAPI.
- Não realizada avaliação de qualidade da IA sobre o edital real nem verificação visual do navegador nesta etapa.

## Limites

- Unidade é um arquivo; anexos separados não são reunidos numa oportunidade nesta entrega.
- Uma chamada por página/etapa pode demorar e consumir créditos. Não enviado documento real ao provedor nesta implementação.
- Worker no processo da API, sem fila externa. Reinício requer retomada explícita; páginas concluídas são preservadas.
- Revisão confirma extração/interpretação; ainda não compara evidências da empresa nem emite habilitação.
- Condições distribuídas entre páginas/anexos precisam de revisão humana; a extração não inventa o contexto ausente.
