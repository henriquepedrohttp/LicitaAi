"""Elegibilidade. Todos os dados são fixtures fictícias de teste; nenhum serviço externo é chamado."""
import asyncio
import hashlib
import os
import unittest
from datetime import date, timedelta
from unittest.mock import patch
from uuid import uuid4

import httpx
import psycopg
from fastapi import FastAPI, HTTPException
from psycopg import sql
from psycopg.conninfo import make_conninfo
from psycopg.types.json import Jsonb

from app.elegibilidade import router as modulo
from app.elegibilidade.engine import avaliar
from app.elegibilidade.migrate import migrate as migrate_elegibilidade
from app.elegibilidade.schemas import DocumentoEmpresa, RequisitoAnalise
from app.empresas.migrate import migrate as migrate_empresas

KEY = 'teste-exclusivo-elegibilidade-' + 'b' * 32
DOC_ID = uuid4()
EMPRESA_ID = uuid4()


def requisito(title, category, excerpt=None, **extra):
    return RequisitoAnalise.model_validate({
        'id': uuid4(), 'title': title, 'category': category, 'review_status': extra.get('review_status', 'pending'), 'version': 1,
        'source': {'document_id': DOC_ID, 'filename': 'edital-ficticio.pdf', 'sha256': 'a' * 64, 'page': 3,
                   'excerpt': excerpt or title, 'verified': extra.get('verified', True)}})


def documento(titulo, tipo, validade=None, vencido=False, **extra):
    return DocumentoEmpresa(id=uuid4(), empresa_id=EMPRESA_ID, versao=1, titulo=titulo, tipo=tipo, validade=validade,
                            excluido_em=extra.get('excluido_em'), sha256='b' * 64, atual=extra.get('atual', True), vencido=vencido)


FUTURO, PASSADO = date.today() + timedelta(days=90), date.today() - timedelta(days=1)


class EngineTests(unittest.TestCase):
    def estado(self, req, docs=(), capacidades=()):
        return avaliar(req, list(docs), list(capacidades))[1]

    def test_atendido_preliminarmente_com_incertezas_declaradas(self):
        r = self.estado(requisito('Certidão de regularidade do FGTS', 'fiscal'),
                        [documento('CRF FGTS', 'fiscal_trabalhista', FUTURO)])
        self.assertEqual((r.estado, r.regra), ('atendido_preliminarmente', 'documento_correspondente'))
        self.assertEqual(len(r.evidencias), 1)
        self.assertTrue(any('conteúdo' in i for i in r.incertezas))

    def test_ausencia_de_documentos_nunca_e_nao_atendido(self):
        r = self.estado(requisito('Certidão de regularidade do FGTS', 'fiscal'))
        self.assertEqual((r.estado, r.regra), ('nao_verificado', 'sem_documento'))
        self.assertIn('informação insuficiente', r.justificativa)

    def test_evidencia_insuficiente_sem_correspondencia(self):
        r = self.estado(requisito('Certidão de regularidade do FGTS', 'fiscal'),
                        [documento('Certidão municipal ISS', 'fiscal_trabalhista', FUTURO)])
        self.assertEqual((r.estado, r.regra), ('nao_verificado', 'sem_correspondencia'))
        self.assertEqual(r.evidencias, [])

    def test_documento_vencido_e_incompatibilidade_fundamentada(self):
        r = self.estado(requisito('Certidão de regularidade do FGTS', 'fiscal'),
                        [documento('CRF FGTS', 'fiscal_trabalhista', PASSADO, vencido=True)])
        self.assertEqual((r.estado, r.regra), ('nao_atendido', 'documento_vencido'))
        self.assertIn(str(PASSADO), r.justificativa)
        self.assertEqual(len(r.evidencias), 1)

    def test_documento_valido_prevalece_sobre_versao_vencida(self):
        r = self.estado(requisito('Certidão FGTS', 'fiscal'), [documento('CRF FGTS antigo', 'fiscal_trabalhista', PASSADO, vencido=True),
                                                              documento('CRF FGTS', 'fiscal_trabalhista', FUTURO)])
        self.assertEqual(r.estado, 'atendido_preliminarmente')

    def test_documentos_excluidos_ou_substituidos_sao_ignorados(self):
        r = self.estado(requisito('Certidão FGTS', 'fiscal'), [documento('CRF FGTS', 'fiscal_trabalhista', FUTURO, atual=False),
                                                              documento('CRF FGTS', 'fiscal_trabalhista', FUTURO, excluido_em='2026-01-01T00:00:00Z')])
        self.assertEqual(r.regra, 'sem_documento')

    def test_requisito_ambiguo_vai_para_revisao(self):
        r = self.estado(requisito('Atestado de serviço compatível em características com o objeto', 'technical'),
                        [documento('Atestado serviço streaming', 'atestado_tecnico')])
        self.assertEqual((r.estado, r.metodo), ('revisao_especializada', 'encaminhamento_revisao_humana'))
        self.assertTrue(r.incertezas)

    def test_quantitativo_extrai_valor_e_unidade_sem_comparador(self):
        r = self.estado(requisito('Comprovar transcodificação de 720 h/mês', 'technical'), [documento('Atestado transcodificação', 'atestado_tecnico')])
        self.assertEqual(r.estado, 'revisao_especializada')
        self.assertEqual([(q.valor, q.unidade) for q in r.quantidades], [('720', 'h/mês')])
        self.assertEqual(len(r.evidencias), 1)  # candidato apresentado ao especialista, sem concluir

    def test_indice_contabil_e_contratual_exigem_especialista(self):
        self.assertEqual(self.estado(requisito('Índice de liquidez geral igual ou superior a 1', 'financial')).regra, 'indice_contabil')
        self.assertEqual(self.estado(requisito('Prestar suporte técnico durante a vigência', 'contractual')).regra, 'obrigacao_contratual')

    def test_fonte_nao_confirmada_impede_conclusao(self):
        r = self.estado(requisito('Certidão FGTS', 'fiscal', verified=False), [documento('CRF FGTS', 'fiscal_trabalhista', FUTURO)])
        self.assertEqual((r.estado, r.regra), ('nao_verificado', 'fonte_nao_confirmada'))

    def test_declaracao_nao_e_evidencia(self):
        r = self.estado(requisito('Atestado de operação de streaming', 'technical'), capacidades=['Operação de streaming ao vivo'])
        self.assertEqual(r.estado, 'nao_verificado')
        self.assertEqual(r.declaracoes_relacionadas, ['Operação de streaming ao vivo'])
        self.assertIn('Capacidades declaradas não são evidência documental.', r.incertezas)

    def test_categoria_original_preservada_e_mapeada(self):
        categoria, r = avaliar(requisito('Algo sem categoria', 'other'), [], [])
        self.assertEqual((categoria, r.regra), ('nao_classificada', 'categoria_nao_classificada'))


class IntegrationFailureTests(unittest.TestCase):
    def test_analise_indisponivel_ou_fora_do_contrato(self):
        with patch.object(modulo, 'get_document', side_effect=HTTPException(503, 'x')):
            with self.assertRaises(HTTPException) as erro:
                modulo.entrada_analise(DOC_ID)
            self.assertEqual(erro.exception.status_code, 502)
        with patch.object(modulo, 'get_document', side_effect=HTTPException(404, 'x')):
            with self.assertRaises(HTTPException) as erro:
                modulo.entrada_analise(DOC_ID)
            self.assertEqual(erro.exception.status_code, 404)
        with patch.object(modulo, 'get_document', return_value={}), patch.object(modulo, 'list_requirements', return_value={'requirements': [{'id': 'x'}]}):
            with self.assertRaises(HTTPException) as erro:
                modulo.entrada_analise(DOC_ID)
            self.assertEqual(erro.exception.status_code, 502)

    def test_requisito_de_outro_documento_e_rejeitado(self):
        outro = requisito('Certidão FGTS', 'fiscal').model_dump(mode='json')
        outro['source']['document_id'] = str(uuid4())
        with patch.object(modulo, 'get_document', return_value={}), \
                patch.object(modulo, 'list_requirements', return_value={'requirements': [outro], 'runs': [], 'total_pages': 1}):
            with self.assertRaises(HTTPException) as erro:
                modulo.entrada_analise(DOC_ID)
            self.assertIn('outro documento', erro.exception.detail)

    def test_empresas_com_documento_de_outra_empresa_e_rejeitado(self):
        class Bruto:
            def model_dump(self, mode):
                doc = documento('CRF', 'fiscal_trabalhista').model_dump(mode='json') | {'empresa_id': str(uuid4())}
                return {'contrato': 'empresas.elegibilidade.v1', 'consultado_em': '2026-11-13T00:00:00Z', 'documentos': [doc],
                        'empresa': {'id': str(EMPRESA_ID), 'razao_social': 'Fictícia', 'cnpj': '11222333000181', 'revisao': 1}}
        with patch.object(modulo, 'eligibility_context', return_value=Bruto()):
            with self.assertRaises(HTTPException) as erro:
                modulo.entrada_empresa(EMPRESA_ID)
            self.assertEqual(erro.exception.status_code, 502)
        with patch.object(modulo, 'eligibility_context', side_effect=HTTPException(503, 'x')):
            with self.assertRaises(HTTPException) as erro:
                modulo.entrada_empresa(EMPRESA_ID)
            self.assertEqual(erro.exception.status_code, 502)


TEXTO = ('Apresentar Certidão de Regularidade do FGTS emitida pela Caixa.\n'
         'Apresentar Certidão negativa de débitos trabalhistas.\n'
         'Comprovar transcodificação ao vivo de 720 h/mês.')


@unittest.skipUnless(os.getenv('ELEGIBILIDADE_TEST_DATABASE_URL'), 'Defina ELEGIBILIDADE_TEST_DATABASE_URL para integração PostgreSQL em schema isolado.')
class PersistenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        base = os.environ['ELEGIBILIDADE_TEST_DATABASE_URL']
        cls.schema = 'elegibilidade_test_' + uuid4().hex
        with psycopg.connect(base, autocommit=True) as db:
            db.execute(sql.SQL('CREATE SCHEMA {}').format(sql.Identifier(cls.schema)))
        cls.url = make_conninfo(base, options=f'-c search_path={cls.schema}')
        migrate_empresas(cls.url)
        migrate_elegibilidade(cls.url)
        migrate_elegibilidade(cls.url)  # idempotente

    @classmethod
    def tearDownClass(cls):
        with psycopg.connect(os.environ['ELEGIBILIDADE_TEST_DATABASE_URL'], autocommit=True) as db:
            db.execute(sql.SQL('DROP SCHEMA {} CASCADE').format(sql.Identifier(cls.schema)))

    def setUp(self):
        self.env = patch.dict(os.environ, {'DATABASE_URL': self.url, 'EMPRESAS_ACCESS_KEY': KEY})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.app = FastAPI()
        self.app.include_router(modulo.router)
        from app.documents import connect
        from app.requirements import ManualRequirement, add_requirement
        self.documento_id = uuid4()
        with connect() as db:
            db.execute('INSERT INTO analysis_documents (id,filename,sha256,content,pages) VALUES (%s,%s,%s,%s,%s)',
                       (self.documento_id, 'edital-ficticio-teste.pdf', hashlib.sha256(self.documento_id.bytes).hexdigest(), b'%PDF-teste',
                        Jsonb([{'page': 1, 'text': TEXTO, 'status': 'text_extracted', 'method': 'native', 'warning': None}])))
        for title, category, line in [('Certidão de regularidade do FGTS', 'fiscal', 0), ('Certidão negativa de débitos trabalhistas', 'fiscal', 1),
                                      ('Transcodificação ao vivo de 720 h/mês', 'technical', 2)]:
            add_requirement(self.documento_id, ManualRequirement(title=title, category=category, excerpt=TEXTO.split('\n')[line], page=1, author='Teste'))
        self.empresa_a, self.doc_a = self.empresa('11222333000181', [('CRF FGTS', 'fiscal_trabalhista', FUTURO)])
        self.empresa_b, self.doc_b = self.empresa('11444777000161', [('CNDT débitos trabalhistas', 'fiscal_trabalhista', PASSADO)])

    def empresa(self, cnpj, documentos):
        empresa_id, ids = uuid4(), []
        with psycopg.connect(self.url) as db:
            db.execute('INSERT INTO empresas_perfis(id,cnpj,perfil) VALUES (%s,%s,%s)',
                       (empresa_id, cnpj, Jsonb({'razao_social': 'Empresa fictícia de teste ' + cnpj, 'cnpj': cnpj})))
            for titulo, tipo, validade in documentos:
                ids.append(uuid4())
                db.execute('INSERT INTO empresas_documentos(id,empresa_id,versao,titulo,tipo,validade,tamanho,sha256) VALUES (%s,%s,1,%s,%s,%s,10,%s)',
                           (ids[-1], empresa_id, titulo, tipo, validade, 'c' * 64))
        return empresa_id, ids

    def tearDown(self):
        with psycopg.connect(self.url) as db:
            db.execute('DELETE FROM elegibilidade_itens')
            db.execute('DELETE FROM elegibilidade_avaliacoes')
            db.execute('DELETE FROM empresas_documentos')
            db.execute('DELETE FROM empresas_perfis')
            db.execute('DELETE FROM analysis_documents WHERE id=%s', (self.documento_id,))

    def request(self, method, path, key=KEY, **kwargs):
        async def send():
            async def inline(function, *args, **options):
                return function(*args, **options)
            with patch('fastapi.routing.run_in_threadpool', inline), patch('fastapi.dependencies.utils.run_in_threadpool', inline):
                async with httpx.AsyncClient(transport=httpx.ASGITransport(app=self.app), base_url='http://test') as client:
                    headers = {'Authorization': f'Bearer {key}'} if key else {}
                    return await client.request(method, '/api/elegibilidade' + path, headers=headers, **kwargs)
        return asyncio.run(send())

    def criar(self, empresa_id):
        response = self.request('POST', '/avaliacoes', json={'documento_id': str(self.documento_id), 'empresa_id': str(empresa_id),
                                                             'oportunidade_pncp': '00394460005887-1-000001/2026'})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def item(self, avaliacao, inicio):
        return next(i for i in avaliacao['itens'] if i['requisito']['title'].startswith(inicio))

    def test_acesso_exige_chave_de_empresas(self):
        self.assertEqual(self.request('GET', f'/avaliacoes/{uuid4()}', key=None).status_code, 401)
        self.assertEqual(self.request('GET', f'/avaliacoes/{uuid4()}', key='errada').status_code, 401)

    def test_matriz_estados_e_integridade_das_referencias(self):
        avaliacao = self.criar(self.empresa_a)
        self.assertEqual(avaliacao['oportunidade_pncp'], '00394460005887-1-000001/2026')
        self.assertEqual(self.item(avaliacao, 'Certidão de regularidade')['estado'], 'atendido_preliminarmente')
        self.assertEqual(self.item(avaliacao, 'Certidão negativa')['estado'], 'nao_verificado')
        self.assertEqual(self.item(avaliacao, 'Transcodificação')['estado'], 'revisao_especializada')
        from app.requirements import list_requirements
        fontes = {str(r['id']): r['source'] for r in list_requirements(self.documento_id)['requirements']}
        for item in avaliacao['itens']:
            self.assertEqual(item['requisito']['source'], fontes[item['requisito']['id']])
        self.assertEqual(self.request('POST', '/avaliacoes', json={'documento_id': str(uuid4()), 'empresa_id': str(self.empresa_a)}).status_code, 404)
        self.assertEqual(self.request('POST', '/avaliacoes', json={'documento_id': str(self.documento_id), 'empresa_id': str(uuid4())}).status_code, 404)
        self.assertEqual(self.request('POST', '/avaliacoes', json={'documento_id': str(self.documento_id), 'empresa_id': str(self.empresa_a),
                                                                   'oportunidade_pncp': 'qualquer'}).status_code, 422)

    def test_revisao_humana_persistida_rastreavel_e_preservada(self):
        avaliacao = self.criar(self.empresa_a)
        item = self.item(avaliacao, 'Certidão negativa')
        base = f"/avaliacoes/{avaliacao['id']}/itens/{item['id']}"
        corrigido = self.request('PATCH', base, json={'acao': 'corrigir', 'estado': 'nao_atendido', 'autor': 'Analista teste',
                                                      'justificativa': 'Empresa informou débito em aberto.', 'versao_esperada': item['versao']})
        self.assertEqual(corrigido.status_code, 200, corrigido.text)
        corrigido = corrigido.json()
        self.assertEqual((corrigido['estado'], corrigido['origem_estado'], corrigido['revisado']), ('nao_atendido', 'humano', True))
        evento = corrigido['historico'][-1]
        self.assertEqual((evento['autor'], evento['antes']['estado'], evento['depois']['estado']), ('Analista teste', 'nao_verificado', 'nao_atendido'))
        conflito = self.request('PATCH', base, json={'acao': 'confirmar', 'autor': 'Outro', 'justificativa': 'Conferido.', 'versao_esperada': item['versao']})
        self.assertEqual(conflito.status_code, 409)
        sem_mudanca = self.request('PATCH', base, json={'acao': 'corrigir', 'estado': 'nao_atendido', 'autor': 'Outro', 'justificativa': 'Conferido.',
                                                        'versao_esperada': corrigido['versao']})
        self.assertEqual(sem_mudanca.status_code, 422)
        obs = self.request('PATCH', base, json={'acao': 'observacao', 'autor': 'Outro', 'justificativa': 'Solicitar CNDT atualizada.',
                                                'versao_esperada': corrigido['versao']}).json()
        self.assertEqual((obs['estado'], obs['observacoes'][-1]['texto']), ('nao_atendido', 'Solicitar CNDT atualizada.'))
        # Reprocessar sem mudanças não altera revisão; mudança na empresa sinaliza reconferência sem apagar a decisão humana.
        self.assertEqual(self.item(self.criar(self.empresa_a), 'Certidão negativa')['versao'], obs['versao'])
        with psycopg.connect(self.url) as db:
            db.execute('UPDATE empresas_perfis SET revisao = revisao + 1 WHERE id=%s', (self.empresa_a,))
        depois = self.item(self.criar(self.empresa_a), 'Certidão negativa')
        self.assertEqual((depois['estado'], depois['origem_estado']), ('nao_atendido', 'humano'))
        self.assertIn('empresa', depois['reconferir'])
        relatorio = self.request('GET', f"/avaliacoes/{avaliacao['id']}/relatorio").json()
        self.assertEqual(relatorio['contrato'], 'elegibilidade.relatorios.v1')
        self.assertIs(relatorio['habilitacao_declarada'], False)
        self.assertEqual(relatorio['estado_geral'], 'revisao_incompleta')
        self.assertEqual(relatorio['resumo']['total'], 3)
        revisado = next(i for i in relatorio['itens'] if i['requisito_id'] == item['requisito']['id'])
        self.assertEqual(revisado['ultima_revisao_humana']['autor'], 'Analista teste')
        self.assertTrue(revisado['pendente'])

    def test_separacao_entre_empresas(self):
        a, b = self.criar(self.empresa_a), self.criar(self.empresa_b)
        self.assertNotEqual(a['id'], b['id'])
        self.assertEqual(self.item(b, 'Certidão negativa')['estado'], 'nao_atendido')  # CNDT vencida da empresa B
        self.assertEqual(self.item(a, 'Certidão negativa')['estado'], 'nao_verificado')
        item = self.item(a, 'Certidão negativa')
        base = f"/avaliacoes/{a['id']}/itens/{item['id']}"
        outra = self.request('PATCH', base, json={'acao': 'evidencias', 'evidencias': [str(self.doc_b[0])], 'autor': 'Analista',
                                                  'justificativa': 'Associar documento.', 'versao_esperada': item['versao']})
        self.assertEqual(outra.status_code, 422)
        propria = self.request('PATCH', base, json={'acao': 'evidencias', 'evidencias': [str(self.doc_a[0])], 'autor': 'Analista',
                                                    'justificativa': 'Associar documento.', 'versao_esperada': item['versao']}).json()
        self.assertEqual([(e['documento_id'], e['origem']) for e in propria['evidencias']], [(str(self.doc_a[0]), 'associada_por_analista')])
        self.assertEqual(self.request('PATCH', f"/avaliacoes/{b['id']}/itens/{item['id']}",
                                      json={'acao': 'observacao', 'autor': 'Analista', 'justificativa': 'Cruzado.', 'versao_esperada': 1}).status_code, 404)
