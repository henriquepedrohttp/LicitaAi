# Análises independentes e documentos empresariais

## Pedido

Permitir analisar objeto/projeto sem revisão prévia de conformidade e comparar documentos da empresa, inclusive fictícios, com os requisitos do edital.

## Implementação

- Removidos bloqueios de validação prévia no início e execução técnica, inclusão manual e interface. Extrações mantidas separadas, iniciáveis em qualquer ordem.
- Mantido processamento de uma análise por documento por vez para evitar concorrência/cobrança duplicada. Iniciar outra etapa durante execução retorna conflito explícito.
- Aprovações antigas e endpoint compatível preservados para histórico, sem controlar acesso à análise técnica.
- Área `/empresas` deixou de ser placeholder: cadastro de empresas, escolha de perfil, cadastro documental por texto ou PDF, tipo e validade informados pelo usuário.
- PDFs empresariais têm limite de 20 MB/200 páginas e 100 mil caracteres de texto; original e texto persistidos em acervo separado dos editais. Não implementado OCR empresarial.
- Empresa Aurora fictícia criada sob demanda, com registros fictícios de contrato social, certidão federal vencida, CNDT e atestado. Nenhum documento é apresentado como oficial. Novos documentos dessa empresa mantêm identificação fictícia.
- Comparação na aba de conformidade permite escolher empresa e atualizar a matriz requisito × evidência. Apenas requisitos de conformidade não descartados entram na matriz.
- Triagem determinística e explícita: identifica alguns tipos documentais por palavras/expressões do requisito e busca tipos cadastrados; se ambíguo, deixa pendente. Verifica validades cadastradas em relação à data atual.
- Documento ausente é `needs_validation`; documentos candidatos vencidos geram `incompatibility` preliminar; documento encontrado não confirma automaticamente conformidade.
- Avaliação humana separada da extração: empresa conforme, precisa de validação ou empresa não conforme/avaliar esforço. Exige responsável e justificativa, e evidência da mesma empresa para registrar conforme.
- Incluídos ação de adequação, prazo em dias, custo estimado e histórico. Avaliação ligada ao snapshot do requisito, evidências e data de referência; alterações tornam avaliação obsoleta na próxima atualização.
- Ações antigas de revisão da interpretação ficaram em seção secundária, sem confundir com situação empresarial.
- Proxy frontend `/api/companies` e rotas backend `/companies`; documentação README atualizada para substituir o fluxo obrigatório anterior.

## Limites importantes

- A comparação automática não usa IA nem valida semanticamente o conteúdo do PDF. Tipo e validade são declarados no cadastro. Quantidades, autenticidade e condições específicas do edital ainda exigem conferência humana.
- Não foi implementada decisão jurídica de habilitação. Data de hoje é exibida como referência, não se presume data futura da sessão.
- Lista de tipos documentais é organizacional e ilustrativa, não lista universal obrigatória.
- Comparação é atualizada sob demanda; a interface informa que retrata o último carregamento. Alterações não atualizam silenciosamente uma decisão antiga.
- Cadastro e comparação são funcionais; os documentos de demonstração são explicitamente fictícios. Não foram cadastradas empresas/dados reais nesta tarefa nem feitas chamadas pagas.

## Verificação

- 37 testes aprovados com PostgreSQL real e IA simulada.
- 12 testes novos de empresas: documento ausente, candidato válido, validade vencida, alternativa válida, evidência de outra empresa rejeitada, histórico/esforço, snapshot obsoleto, isolamento empresarial, exclusão de requisitos técnicos, ambiguidade, marca fictícia e upload/download de PDF com rejeição de documento sem texto.
- Testes de workflow atualizados e adicionado caso técnico antes de conformidade, verificando execução efetiva sem aprovação.
- Lint e build Next.js/TypeScript aprovados; diff sem erros de whitespace.
- API temporária na porta 18001 para integração; rota `/companies` respondeu HTTP 200. API temporária encerrada ao concluir.
- Não realizada verificação visual em navegador nem validação semântica com um conjunto real de documentos empresariais.

## Uso

Recriar backend se necessário: `docker compose up -d --force-recreate backend`. Atualizar frontend. Em Empresas, usar demonstração fictícia ou cadastrar empresa/documentos. Em Análise → Documentação e conformidade, escolher empresa e comparar/atualizar. A análise de Objeto e projeto está liberada independentemente desse cadastro.
