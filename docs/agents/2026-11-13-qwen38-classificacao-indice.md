# Qwen 3.8 27B, reasoning desativado e priorização por estrutura

## Alterações solicitadas

- Modelo trocado para `qwen/qwen3.8-27b` no `.env` local (sem exibir credenciais), exemplo de ambiente, Compose, padrões do backend e README.
- Payload de chamadas simples e agrupadas passou a enviar `reasoning: {"enabled": false}`. Isso solicita desligar o thinking, não apenas ocultar sua saída.
- Prompt reforçado com exemplos que diferenciam comprovação da capacidade da empresa (conformidade) e capacidade da solução (objeto). Títulos de sumário, descrições informativas e referências legais sem obrigação concreta não devem virar requisitos.
- Não alterada a interface, que já separa as etapas e apresenta os requisitos com fonte.

## Verificação

- 13 testes de workflow e 6 de requisitos aprovados (19), com banco real e IA simulada. Teste do payload confirma reasoning desativado e inclusão do critério de classificação.
- `git diff --check` aprovado.
- Realizadas duas chamadas reais ao Qwen 3.8 27B, apenas com três frases sintéticas, sem envio do edital e sem persistir resultados no acervo:
  - Conformidade retornou certidão fiscal e atestado de experiência em armazenamento de 20 TB.
  - Objeto retornou capacidade da solução de armazenar 20 TB.
- Essa amostra mínima confirma comportamento nos exemplos; não mede precisão/cobertura no edital real nem comprova que o provedor reportou zero tokens de reasoning (o teste verificou o parâmetro enviado).

## Pesquisa e inspeção do edital

- Confirmados identificador e thinking configurável na página oficial do modelo e parâmetros na documentação OpenRouter.
- Consultado texto já persistido de `EDITAL_E_ANEXOS.pdf`, sem executar OCR ou conversão PDF.
- Títulos encontrados nas páginas físicas: 1 participação, 2 apresentação de proposta/documentos de habilitação, 6 fase de habilitação, 22 declarações complementares. Outras páginas identificam termos de referência e especificações técnicas.
- Uma busca inicial por palavra índice também encontrou índice de reajuste; esse falso positivo reforça que detectar sumário exige estrutura/títulos e não mera ocorrência da palavra.

## Conclusão sobre índice e relevância

É possível priorizar por sumário, marcadores e títulos no texto. A hipótese é mapear intervalos de seções, localizar seus títulos reais no PDF (numeração impressa pode divergir), selecionar seções documentais e seguir referências a anexos. Não se deve presumir irrelevância de todo termo de referência: pode conter exigências de qualificação. Seções não priorizadas devem ter status explícito de não analisadas até conferência complementar, em vez de serem marcadas como concluídas.

A seleção automática por índice NÃO foi implementada nesta entrega. O fluxo continua percorrendo todas as páginas utilizáveis, em lotes, com as duas etapas já existentes. Próxima avaliação proposta: comparar classificação em seções candidatas contra gabarito humano e contra leitura integral, medindo omissões e tempo.

## Aplicar

`docker compose up -d --force-recreate backend` na raiz, depois continuar/retomar a análise. Resultados já salvos não mudam de modelo nem são apagados automaticamente.

## Fontes

- https://openrouter.ai/qwen/qwen3.8-27b
- https://openrouter.ai/docs/guides/best-practices/reasoning-tokens
