# Escopo documental, PNCP e Docling

## Pedido e esclarecimento de produto

Usuário definiu requisitos como exigências de documentação e conformidade da empresa, com análise automática do conjunto documental, sem seleção manual página a página. Página deve ser referência de auditoria.

## Inspeção e pesquisa

- Conferido PRD: prevê evidências empresariais, requisitos rastreáveis e elegibilidade preliminar; falta de documento é não verificado.
- Consultados portal oficial PNCP e manuais oficiais: há metadados estruturados e serviços para documentos; isso não demonstra um layout único dos PDFs nem requisitos documentais normalizados.
- Consultada documentação oficial Docling: processamento de estrutura, tabelas e OCR configurável; `do_ocr` pode ser desativado e conversão pode limitar páginas. Não foi instalado nem medido consumo nesta sessão.
- Não foi analisada amostra de editais de diferentes órgãos; padrões de seções ainda são hipóteses a validar.

## Proposta

- Botão para analisar edital e anexos, job em segundo plano e progresso por documento.
- Extração textual leve primeiro; priorização por títulos e referências cruzadas, sem pressupor páginas fixas e sem omitir silenciosamente páginas não analisadas.
- Docling como alternativa para estrutura/tabelas difíceis, avaliado em benchmark; OCR seletivo com limites.
- Requisito: documento/evidência exigida, categoria, condição de aplicação, prazo/validade, quantidade/limiar quando expresso e fonte.
- Comparação com evidências da empresa separada da extração; resultados preliminares e revisáveis.
- Próxima validação: amostra de editais/anexos de órgãos e objetos distintos; medir cobertura contra gabarito humano, tempo e memória.

## Fontes

- https://www.gov.br/pncp/pt-br
- https://www.gov.br/pncp/pt-br/pncp/manuais
- https://pncp.gov.br/manual/pt-br/latest/singlehtml/index.html
- https://docling-project.github.io/docling/
- https://docling-project.github.io/docling/reference/pipeline_options/
- https://github.com/docling-project/docling/blob/main/docs/examples/full_page_ocr.py

Nenhum código funcional alterado e nenhum documento enviado a modelos nesta etapa.
