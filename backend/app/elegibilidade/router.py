import os
from contextlib import contextmanager
from datetime import datetime, timezone
from uuid import UUID, uuid4

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Response
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from pydantic import ValidationError

from ..documents import get_document
from ..empresas.router import authorize, eligibility_context
from ..requirements import list_requirements
from .engine import avaliar, evidencia
from .schemas import (Avaliacao, ContextoEmpresa, Item, ItemRelatorio, NovaAvaliacao, Relatorio, RequisitoAnalise,
                      Revisao)

# Mesma chave de Empresas: a matriz expõe dados e documentos privados da empresa.
router = APIRouter(prefix='/api/elegibilidade', tags=['Elegibilidade'], dependencies=[Depends(authorize)])
AVISOS = ['Resultado preliminar de apoio à decisão; não constitui habilitação jurídica nem parecer.',
          'Documentos e capacidades da empresa não foram verificados quanto a autenticidade ou conteúdo.',
          'Ausência de evidência é tratada como informação insuficiente (não verificado), nunca como descumprimento.']
ACOES_DE_ESTADO = {'confirmar', 'corrigir', 'revisao_especializada'}


def agora():
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def database():
    url = os.getenv('DATABASE_URL')
    if not url:
        raise HTTPException(503, 'Banco de Elegibilidade não configurado.')
    try:
        with psycopg.connect(url, connect_timeout=5, row_factory=dict_row) as db:
            db.execute("SET LOCAL statement_timeout = '10s'")
            yield db
    except psycopg.Error:
        raise HTTPException(503, 'Banco indisponível ou migração de Elegibilidade pendente.') from None


def falha_integracao(modulo, erro: HTTPException):
    if erro.status_code == 404:
        return HTTPException(404, f'{modulo}: registro não encontrado.')
    return HTTPException(502, f'{modulo} indisponível no momento ({erro.status_code}). Nenhuma avaliação foi alterada.')


def entrada_analise(documento_id: UUID):
    """Requisitos e metadados do edital pelo contrato da Análise, validados antes do uso."""
    try:
        documento = get_document(documento_id)
        dados = list_requirements(documento_id)
    except HTTPException as erro:
        raise falha_integracao('Análise', erro) from None
    try:
        requisitos = [RequisitoAnalise.model_validate(r) for r in dados['requirements']]
        cobertura = f"{len(dados['runs'])}/{dados['total_pages']} páginas do edital processadas na Análise; requisitos de páginas não processadas não aparecem na matriz."
    except (KeyError, TypeError, ValidationError):
        raise HTTPException(502, 'Análise retornou requisitos fora do contrato esperado. Nenhuma avaliação foi alterada.') from None
    if any(r.source.document_id != documento_id for r in requisitos):
        raise HTTPException(502, 'Análise retornou requisito de outro documento. Nenhuma avaliação foi alterada.')
    avisos = [cobertura] + (['Cobertura parcial: há páginas do edital sem texto extraído (OCR pendente ou falha).']
                            if documento.get('coverage') == 'partial' else [])
    return documento, requisitos, avisos


def entrada_empresa(empresa_id: UUID) -> ContextoEmpresa:
    try:
        bruto = eligibility_context(empresa_id, Response())
        contexto = ContextoEmpresa.model_validate(bruto.model_dump(mode='json'))
    except HTTPException as erro:
        raise falha_integracao('Empresas', erro) from None
    except (AttributeError, ValidationError):
        raise HTTPException(502, 'Empresas retornou contexto fora do contrato esperado.') from None
    if contexto.empresa.id != empresa_id or any(d.empresa_id != empresa_id for d in contexto.documentos):
        raise HTTPException(502, 'Empresas retornou documentos de outra empresa. Nenhuma avaliação foi alterada.')
    return contexto


def item_modelo(row) -> Item:
    return Item(id=row['id'], requisito=row['requisito'], categoria=row['categoria'],
                categoria_original=row['requisito']['category'], estado=row['estado'], origem_estado=row['origem_estado'],
                justificativa=row['justificativa'], evidencias=row['evidencias'], criticidade=row['criticidade'],
                observacoes=row['observacoes'], automatico=row['automatico'], revisado=row['revisado'],
                reconferir=row['reconferir'], versao=row['versao'], historico=row['historico'])


def carregar(db, avaliacao_id: UUID) -> Avaliacao:
    row = db.execute('SELECT * FROM elegibilidade_avaliacoes WHERE id = %s', (avaliacao_id,)).fetchone()
    if not row:
        raise HTTPException(404, 'Avaliação não encontrada.')
    itens = db.execute('''SELECT * FROM elegibilidade_itens WHERE avaliacao_id = %s
        ORDER BY (requisito->'source'->>'page')::int NULLS LAST, requisito->>'title', id''', (avaliacao_id,)).fetchall()
    return Avaliacao(**row, processamento='concluido' if itens else 'sem_requisitos', itens=[item_modelo(i) for i in itens])


def evento(acao, autor, justificativa, antes=None, depois=None):
    return {'acao': acao, 'autor': autor, 'justificativa': justificativa, 'em': agora(), 'antes': antes, 'depois': depois}


@router.post('/avaliacoes', response_model=Avaliacao)
def criar_ou_atualizar(pedido: NovaAvaliacao, response: Response):
    """Cria a avaliação do par (edital, empresa) ou a sincroniza com as entradas atuais, preservando revisões humanas."""
    response.headers['Cache-Control'] = 'private, no-store'
    documento, requisitos, avisos = entrada_analise(pedido.documento_id)
    contexto = entrada_empresa(pedido.empresa_id)
    ativos = [r for r in requisitos if r.review_status != 'rejected']
    with database() as db:
        db.execute('SELECT pg_advisory_xact_lock(hashtext(%s))', (f'{pedido.documento_id}:{pedido.empresa_id}',))
        anterior = db.execute('SELECT * FROM elegibilidade_avaliacoes WHERE documento_id = %s AND empresa_id = %s',
                              (pedido.documento_id, pedido.empresa_id)).fetchone()
        valores = (documento['filename'], documento['sha256'], contexto.empresa.razao_social, contexto.empresa.cnpj,
                   contexto.empresa.revisao, len(requisitos) - len(ativos), Jsonb(AVISOS + avisos))
        if anterior:
            avaliacao_id = anterior['id']
            db.execute('''UPDATE elegibilidade_avaliacoes SET documento_nome=%s, documento_sha256=%s, empresa_nome=%s,
                empresa_cnpj=%s, empresa_revisao=%s, requisitos_excluidos=%s, avisos=%s,
                oportunidade_pncp=COALESCE(%s, oportunidade_pncp), atualizada_em=now() WHERE id=%s''',
                       (*valores, pedido.oportunidade_pncp, avaliacao_id))
        else:
            avaliacao_id = uuid4()
            db.execute('''INSERT INTO elegibilidade_avaliacoes(documento_nome, documento_sha256, empresa_nome, empresa_cnpj,
                empresa_revisao, requisitos_excluidos, avisos, oportunidade_pncp, id, documento_id, empresa_id)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)''',
                       (*valores, pedido.oportunidade_pncp, avaliacao_id, pedido.documento_id, pedido.empresa_id))
        empresa_mudou = bool(anterior) and anterior['empresa_revisao'] != contexto.empresa.revisao
        existentes = {r['requisito_id']: r for r in db.execute(
            'SELECT * FROM elegibilidade_itens WHERE avaliacao_id = %s FOR UPDATE', (avaliacao_id,)).fetchall()}
        for requisito in ativos:
            categoria, auto = avaliar(requisito, contexto.documentos, contexto.empresa.capacidades)
            snapshot, automatico = requisito.model_dump(mode='json'), auto.model_dump(mode='json')
            item = existentes.pop(requisito.id, None)
            if not item:
                db.execute('''INSERT INTO elegibilidade_itens(id, avaliacao_id, requisito_id, requisito, categoria, automatico,
                    estado, origem_estado, justificativa, evidencias, historico) VALUES (%s,%s,%s,%s,%s,%s,%s,'automatico',%s,%s,%s)''',
                           (uuid4(), avaliacao_id, requisito.id, Jsonb(snapshot), categoria, Jsonb(automatico), auto.estado,
                            auto.justificativa, Jsonb(automatico['evidencias']),
                            Jsonb([evento('avaliacao_automatica', 'sistema', auto.justificativa, depois={'estado': auto.estado, 'regra': auto.regra})])))
                continue
            if item['automatico'] == automatico and item['requisito'] == snapshot and not empresa_mudou:
                continue
            motivo = ('Requisito alterado na Análise' if item['requisito']['version'] != requisito.version
                      else 'Perfil ou documentos da empresa mudaram' if empresa_mudou else 'Resultado automático mudou')
            historico = item['historico'] + [evento('reprocessado', 'sistema', motivo, {'estado': item['automatico']['estado']},
                                                    {'estado': auto.estado, 'regra': auto.regra})]
            if item['revisado']:
                # Conclusão humana preservada; somente sinaliza necessidade de reconferência (PRD RN-13/RN-14).
                db.execute('''UPDATE elegibilidade_itens SET requisito=%s, categoria=%s, automatico=%s, reconferir=%s,
                    historico=%s, versao=versao+1 WHERE id=%s''',
                           (Jsonb(snapshot), categoria, Jsonb(automatico), motivo + ' após a revisão humana.', Jsonb(historico), item['id']))
            else:
                manuais = [e for e in item['evidencias'] if e['origem'] == 'associada_por_analista']
                sugeridas = [e for e in automatico['evidencias'] if e['documento_id'] not in {m['documento_id'] for m in manuais}]
                db.execute('''UPDATE elegibilidade_itens SET requisito=%s, categoria=%s, automatico=%s, estado=%s, justificativa=%s,
                    evidencias=%s, historico=%s, versao=versao+1 WHERE id=%s''',
                           (Jsonb(snapshot), categoria, Jsonb(automatico), auto.estado, auto.justificativa,
                            Jsonb(manuais + sugeridas), Jsonb(historico), item['id']))
        for item in existentes.values():
            if item['reconferir'] is None:
                motivo = 'Requisito rejeitado ou ausente na Análise atual; mantido apenas para rastreabilidade.'
                db.execute('UPDATE elegibilidade_itens SET reconferir=%s, historico=%s, versao=versao+1 WHERE id=%s',
                           (motivo, Jsonb(item['historico'] + [evento('requisito_indisponivel', 'sistema', motivo)]), item['id']))
        return carregar(db, avaliacao_id)


@router.get('/avaliacoes/{avaliacao_id}', response_model=Avaliacao)
def obter(avaliacao_id: UUID, response: Response):
    response.headers['Cache-Control'] = 'private, no-store'
    with database() as db:
        return carregar(db, avaliacao_id)


@router.patch('/avaliacoes/{avaliacao_id}/itens/{item_id}', response_model=Item)
def revisar(avaliacao_id: UUID, item_id: UUID, revisao: Revisao):
    with database() as db:
        avaliacao = db.execute('SELECT empresa_id FROM elegibilidade_avaliacoes WHERE id = %s', (avaliacao_id,)).fetchone()
        if not avaliacao:
            raise HTTPException(404, 'Avaliação não encontrada.')
    documentos = {}
    if revisao.acao == 'evidencias':
        if revisao.evidencias is None:
            raise HTTPException(422, 'Informe os documentos associados (lista vazia remove todos).')
        # Somente documentos atuais da própria empresa da avaliação (separação entre empresas).
        documentos = {d.id: d for d in entrada_empresa(avaliacao['empresa_id']).documentos if d.atual and d.excluido_em is None}
        if any(i not in documentos for i in revisao.evidencias):
            raise HTTPException(422, 'Documento inexistente, substituído, excluído ou de outra empresa.')
    with database() as db:
        item = db.execute('SELECT * FROM elegibilidade_itens WHERE id = %s AND avaliacao_id = %s FOR UPDATE',
                          (item_id, avaliacao_id)).fetchone()
        if not item:
            raise HTTPException(404, 'Requisito não encontrado nesta avaliação.')
        if item['versao'] != revisao.versao_esperada:
            raise HTTPException(409, 'Item alterado em outra sessão ou reprocessado. Recarregue antes de salvar.')
        estado, criticidade, evidencias, observacoes = item['estado'], item['criticidade'], item['evidencias'], item['observacoes']
        if revisao.acao == 'confirmar' and revisao.estado not in (None, estado):
            raise HTTPException(422, 'Para mudar o estado, use Corrigir.')
        if revisao.acao == 'corrigir':
            if revisao.estado in (None, estado):
                raise HTTPException(422, 'Selecione um estado diferente do atual para corrigir.')
            estado = revisao.estado
        if revisao.acao == 'revisao_especializada':
            estado = 'revisao_especializada'
        if revisao.acao == 'criticidade':
            if revisao.criticidade is None:
                raise HTTPException(422, 'Informe a criticidade e seu fundamento.')
            criticidade = revisao.criticidade
        if revisao.acao == 'evidencias':
            atuais = {e['documento_id']: e for e in evidencias}
            evidencias = [atuais.get(str(i)) or evidencia(documentos[i], 'associada_por_analista').model_dump(mode='json')
                          for i in dict.fromkeys(revisao.evidencias)]
        if revisao.acao == 'observacao':
            observacoes = observacoes + [{'autor': revisao.autor, 'texto': revisao.justificativa, 'em': agora()}]
        decide = revisao.acao in ACOES_DE_ESTADO
        resumo = lambda e, c, ev: {'estado': e, 'criticidade': c, 'evidencias': [x['documento_id'] for x in ev]}
        historico = item['historico'] + [evento(revisao.acao, revisao.autor, revisao.justificativa,
                                                resumo(item['estado'], item['criticidade'], item['evidencias']),
                                                resumo(estado, criticidade, evidencias))]
        row = db.execute('''UPDATE elegibilidade_itens SET estado=%s, criticidade=%s, evidencias=%s, observacoes=%s,
            justificativa=CASE WHEN %s THEN %s ELSE justificativa END,
            origem_estado=CASE WHEN %s THEN 'humano' ELSE origem_estado END,
            revisado=revisado OR %s, reconferir=CASE WHEN %s THEN NULL ELSE reconferir END,
            historico=%s, versao=versao+1 WHERE id=%s RETURNING *''',
                         (estado, criticidade, Jsonb(evidencias), Jsonb(observacoes), decide, revisao.justificativa,
                          decide, decide, decide, Jsonb(historico), item_id)).fetchone()
        db.execute('UPDATE elegibilidade_avaliacoes SET atualizada_em = now() WHERE id = %s', (avaliacao_id,))
        return item_modelo(row)


def relatorio(avaliacao: Avaliacao) -> Relatorio:
    itens = []
    for item in avaliacao.itens:
        humanas = [e for e in item.historico if e['acao'] in ACOES_DE_ESTADO]
        itens.append(ItemRelatorio(
            requisito_id=item.requisito.id, requisito_versao=item.requisito.version, titulo=item.requisito.title,
            categoria=item.categoria, fonte=item.requisito.source, estado=item.estado, origem_estado=item.origem_estado,
            justificativa=item.justificativa, evidencias=item.evidencias, criticidade=item.criticidade,
            ultima_revisao_humana=humanas[-1] if humanas else None, reconferir=item.reconferir,
            pendente=not item.revisado or item.reconferir is not None or item.estado != 'atendido_preliminarmente'))
    resumo = {estado: sum(i.estado == estado for i in itens) for estado in
              ('atendido_preliminarmente', 'nao_atendido', 'nao_verificado', 'revisao_especializada')}
    resumo |= {'total': len(itens), 'revisados': sum(i.revisado for i in avaliacao.itens),
               'reconferir': sum(i.reconferir is not None for i in itens)}
    if not itens:
        geral = 'sem_requisitos'
    elif resumo['revisados'] < len(itens) or resumo['reconferir']:
        geral = 'revisao_incompleta'
    else:
        geral = 'revisada_com_pendencias' if any(i.pendente for i in itens) else 'revisada_sem_pendencias'
    return Relatorio(avaliacao_id=avaliacao.id, gerado_em=datetime.now(timezone.utc), documento_id=avaliacao.documento_id,
                     documento_sha256=avaliacao.documento_sha256, oportunidade_pncp=avaliacao.oportunidade_pncp,
                     empresa_id=avaliacao.empresa_id, empresa_revisao=avaliacao.empresa_revisao, estado_geral=geral,
                     resumo=resumo, itens=itens, pendencias=[i for i in itens if i.pendente], avisos=avaliacao.avisos)


@router.get('/avaliacoes/{avaliacao_id}/relatorio', response_model=Relatorio)
def obter_relatorio(avaliacao_id: UUID, response: Response):
    response.headers['Cache-Control'] = 'private, no-store'
    with database() as db:
        return relatorio(carregar(db, avaliacao_id))
