# Filtro de requisitos por categoria

- Pedido: esclarecer disponibilidade das categorias e permitir filtrar por elas.
- Inspecionados enum `Category` do backend e mapeamento do frontend. Todo requisito salvo tem categoria validada: técnica, financeira, jurídica, fiscal, contratual ou outra. Isso não implica existência de requisitos em todas as categorias de cada edital.
- Adicionado filtro de categoria com contagens por etapa, combinável com filtro de revisão. Categorias sem registros aparecem com zero.
- Incluídos contagem dos resultados e botão para limpar filtros. Troca de etapa reinicia filtros para evitar ocultar resultados por seleção anterior.
- Filtros atuam sobre registros já extraídos, sem novas chamadas à IA, sem modificar exigências nem a validação da etapa.
- Estado vazio esclarece que ausência de resultados filtrados não comprova ausência de exigência no edital.
- Categorias são a taxonomia atual do protótipo; não foi feita afirmação de equivalência integral com classificações legais.
- Verificação: lint, build TypeScript/Next.js e `git diff --check` (resultados abaixo).
- Resultado: lint e build aprovados, incluindo TypeScript; diff sem erros de whitespace. Não realizada verificação visual no navegador.
