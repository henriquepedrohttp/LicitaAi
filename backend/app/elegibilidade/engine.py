"""Comparação preliminar requisito × empresa.

Regras explícitas e auditáveis. Quando a conclusão depende de interpretação, o motor não decide:
reúne texto original, evidências candidatas e incertezas e encaminha para revisão humana.
Ausência de evidência nunca gera `nao_atendido` (PRD RN-02).
"""
import re
import unicodedata

from .schemas import DocumentoEmpresa, Evidencia, Quantidade, RequisitoAnalise, ResultadoAutomatico

CATEGORIAS = {'legal': 'habilitacao_juridica', 'technical': 'qualificacao_tecnica', 'fiscal': 'fiscal_social_trabalhista',
              'financial': 'economico_financeira', 'contractual': 'contratual', 'other': 'nao_classificada'}
TIPO_DOCUMENTO = {'habilitacao_juridica': 'juridico', 'qualificacao_tecnica': 'atestado_tecnico',
                  'fiscal_social_trabalhista': 'fiscal_trabalhista', 'economico_financeira': 'economico_financeiro'}
# Palavras genéricas que fariam qualquer certidão "corresponder" a qualquer exigência.
GENERICAS = set('''para pela pelo pelos pelas como deve devera deverao empresa licitante comprovar comprovacao apresentar
documento documentos certidao certidoes prova emitida emitido orgao competente conforme sobre entre qualquer todos todas
mesma mesmo esta este sera serao caso termos atraves nome sede domicilio relativa relativo junto quanto perante regularidade
vigente valida validade prazo dias edital item anexo seguinte seguintes acordo forma quando possuir contratacao objeto
licitacao demonstrar declaracao atestado atestados capacidade tecnica'''.split())
AMBIGUOS = re.compile(r'\b(compativ\w*|similar\w*|semelhante\w*|pertinente\w*|a criterio|equivalente\w*|satisfatori\w*|adequad\w*|suficiente\w*)')
INDICES = re.compile(r'\b(liquidez|indice\w*|patrimonio liquido|capital social|endividamento|solvencia)\b')
QUANTIDADE = re.compile(r'(?P<valor>\d[\d.,]*)\s*(?P<unidade>TB|GB|MB|h/m[eê]s|horas?(?:/m[eê]s| por m[eê]s)?|%|m²|m2|m³|km|kg|anos?|meses|usu[aá]rios|unidades|licen[cç]as)(?!\w)', re.I)


def normalizar(texto):
    return unicodedata.normalize('NFKD', texto.lower()).encode('ascii', 'ignore').decode()


def termos(texto):
    return {palavra for palavra in re.findall(r'[a-z0-9]{3,}', normalizar(texto)) if palavra not in GENERICAS and not palavra.isdigit()}


def quantidades(texto):
    # Valor e unidade como escritos; nenhum comparador é inferido (PRD RN-06).
    return [Quantidade(valor=m['valor'].rstrip('.,'), unidade=m['unidade'], texto=m.group(0)) for m in QUANTIDADE.finditer(texto)]


def evidencia(documento: DocumentoEmpresa, origem='sugerida_por_regra'):
    return Evidencia(documento_id=documento.id, titulo=documento.titulo, tipo=documento.tipo, versao=documento.versao,
                     sha256=documento.sha256, validade=documento.validade, vencido=documento.vencido, origem=origem)


def avaliar(requisito: RequisitoAnalise, documentos: list[DocumentoEmpresa], capacidades: list[str]):
    """Retorna (categoria, ResultadoAutomatico). Usa somente documentos atuais e não excluídos."""
    categoria = CATEGORIAS.get(requisito.category, 'nao_classificada')
    texto = f'{requisito.title}\n{requisito.source.excerpt}'
    alvo = termos(texto)
    normal = normalizar(texto)
    qtd = quantidades(requisito.source.excerpt)  # somente do texto de origem, nunca da paráfrase
    declaracoes = [c for c in capacidades if termos(c) & alvo]
    incertezas = ['Capacidades declaradas não são evidência documental.'] if declaracoes else []
    tipo = TIPO_DOCUMENTO.get(categoria)
    vigentes = [d for d in documentos if d.atual and d.excluido_em is None]
    do_tipo = [d for d in vigentes if d.tipo == tipo]
    correspondentes = [d for d in do_tipo if termos(d.titulo) & alvo]

    def resultado(estado, regra, justificativa, docs=(), metodo='regra_deterministica', extra=()):
        return categoria, ResultadoAutomatico(estado=estado, regra=regra, justificativa=justificativa, metodo=metodo,
                                              evidencias=[evidencia(d) for d in docs], incertezas=[*extra, *incertezas],
                                              quantidades=qtd, declaracoes_relacionadas=declaracoes)

    def especializada(regra, justificativa, extra=()):
        return resultado('revisao_especializada', regra, justificativa, correspondentes or do_tipo,
                         'encaminhamento_revisao_humana', extra)

    if not requisito.source.verified:
        return resultado('nao_verificado', 'fonte_nao_confirmada',
                         'A origem do requisito não foi confirmada no documento; nenhuma conclusão é possível.')
    if requisito.review_status == 'specialist_review':
        return especializada('analise_solicitou_especialista', 'A Análise encaminhou este requisito para revisão especializada.')
    if categoria == 'contratual':
        return especializada('obrigacao_contratual', 'Obrigação de execução contratual: depende de interpretação jurídica/comercial, não de documento cadastrado.')
    if categoria == 'nao_classificada':
        return resultado('nao_verificado', 'categoria_nao_classificada',
                         'Categoria não classificada pela Análise; não há regra documental aplicável. Associe evidências manualmente.')
    if match := AMBIGUOS.search(normal):
        return especializada('termo_interpretativo', f'O texto usa termo que exige interpretação ("{match.group(0)}").',
                             ['Critério de equivalência não definido de forma objetiva no trecho.'])
    if categoria == 'economico_financeira' and INDICES.search(normal):
        return especializada('indice_contabil', 'Exigência de índice ou valor contábil: requer conferência contábil das demonstrações.',
                             ['Empresas não fornece demonstrações estruturadas para cálculo.'])
    if categoria == 'qualificacao_tecnica' and qtd:
        return especializada('quantitativo_sem_dado_estruturado',
                             'Exigência quantitativa (' + '; '.join(q.texto for q in qtd) + '): os atestados não possuem quantidades estruturadas para comparação.',
                             ['Conteúdo dos atestados não foi lido pelo sistema.'])
    if not do_tipo:
        return resultado('nao_verificado', 'sem_documento',
                         'Nenhum documento atual da categoria correspondente está cadastrado. Ausência de evidência é informação insuficiente, não descumprimento.')
    if not correspondentes:
        return resultado('nao_verificado', 'sem_correspondencia',
                         'Há documentos da categoria, mas nenhum título corresponde aos termos do requisito. Associe manualmente se aplicável.')
    validos = [d for d in correspondentes if not d.vencido]
    if not validos:
        datas = ', '.join(sorted(str(d.validade) for d in correspondentes))
        return resultado('nao_atendido', 'documento_vencido',
                         f'A(s) evidência(s) correspondente(s) está(ão) vencida(s) segundo a validade informada ({datas}). Renovação pode sanar a pendência.',
                         correspondentes, extra=['Validade informada pelo usuário; autenticidade não verificada.'])
    sem_validade = [d.titulo for d in validos if d.validade is None]
    return resultado('atendido_preliminarmente', 'documento_correspondente',
                     'Documento atual da categoria com título correspondente ao requisito e sem vencimento informado.', validos,
                     extra=['Correspondência pelo título; o conteúdo do documento não foi lido pelo sistema.',
                            *([f'Validade não informada: {", ".join(sem_validade)}.'] if sem_validade else [])])
