import asyncio
import os
import unittest
from unittest.mock import patch
from urllib.parse import quote
from uuid import uuid4

import httpx
import psycopg
from fastapi import FastAPI
from psycopg import sql
from psycopg.conninfo import make_conninfo
from pydantic import ValidationError

from app.empresas.migrate import migrate
from app.empresas.router import MAX_FILE, router
from app.empresas.schemas import Profile

KEY = 'teste-exclusivo-empresas-' + 'a' * 32
PROFILE = {'razao_social': 'Empresa fictícia de teste', 'cnpj': '11.222.333/0001-81'}
# Fixture de envelope; não representa PDF processado/verificado ou documento real.
PDF = b'%PDF-1.4\n1 0 obj <</Type /Catalog>> endobj\n%%EOF\n'


class HTTPTests(unittest.TestCase):
    def setUp(self):
        self.app = FastAPI()
        self.app.include_router(router)
        self.env = patch.dict(os.environ, {'EMPRESAS_ACCESS_KEY': KEY})
        self.env.start()
        self.addCleanup(self.env.stop)

    def request(self, method='GET', path='', key=KEY, **kwargs):
        async def send():
            async def inline(function, *args, **options):
                return function(*args, **options)
            headers = kwargs.pop('headers', {})
            if key is not None:
                headers['Authorization'] = f'Bearer {key}'
            # Mesmo handler ASGI sem dependência de sockets/wakeups entre threads.
            with patch('fastapi.routing.run_in_threadpool', inline), patch('fastapi.dependencies.utils.run_in_threadpool', inline):
                async with httpx.AsyncClient(transport=httpx.ASGITransport(app=self.app), base_url='http://test') as client:
                    return await client.request(method, '/api/empresas' + path, headers=headers, **kwargs)
        return asyncio.run(send())

    def test_access_fails_closed_on_every_resource(self):
        for method, path in [('GET', ''), ('POST', ''), ('GET', f'/{uuid4()}/documentos'),
                             ('GET', f'/{uuid4()}/documentos/{uuid4()}/arquivo'), ('DELETE', f'/{uuid4()}'),
                             ('GET', f'/{uuid4()}/contexto-elegibilidade')]:
            self.assertEqual(self.request(method, path, key=None).status_code, 401)
            self.assertEqual(self.request(method, path, key='errada').status_code, 401)
        with patch.dict(os.environ, {'EMPRESAS_ACCESS_KEY': ''}):
            self.assertEqual(self.request().status_code, 503)

    def test_input_validation(self):
        for data in [{}, {**PROFILE, 'cnpj': '00000000000000'}, {**PROFILE, 'uf': 'XX'},
                     {**PROFILE, 'razao_social': ' '}, {**PROFILE, 'cnae_principal': '123'},
                     {**PROFILE, 'capacidades': [' ']}]:
            self.assertEqual(self.request('POST', json=data).status_code, 422)
        self.assertEqual(self.request(path='?pagina=0').status_code, 422)

    def test_numeric_and_alphanumeric_cnpj(self):
        self.assertEqual(Profile(**PROFILE).cnpj, '11222333000181')
        self.assertEqual(Profile(**{**PROFILE, 'cnpj': '12.ABC.345/01DE-35'}).cnpj, '12ABC34501DE35')
        for value in ['12ABC34501DE36', '11!222333000181', '1122233300018', '11111111111111']:
            with self.assertRaises(ValidationError):
                Profile(**{**PROFILE, 'cnpj': value})

    def test_upload_rejects_type_size_and_bad_envelope(self):
        path = f'/{uuid4()}/documentos?tipo=juridico'
        headers = {'X-Document-Title': 'Teste', 'Content-Type': 'application/pdf'}
        self.assertEqual(self.request('POST', path, content=b'not pdf', headers={**headers, 'Content-Type': 'text/plain'}).status_code, 415)
        self.assertEqual(self.request('POST', path, content=b'not pdf', headers=headers).status_code, 422)
        self.assertEqual(self.request('POST', path, content=b'x' * (MAX_FILE + 1), headers=headers).status_code, 413)

    def test_database_unavailable_is_recoverable_without_details(self):
        with patch.dict(os.environ, {'DATABASE_URL': ''}):
            response = self.request()
            self.assertEqual(response.status_code, 503)
            self.assertNotIn(PROFILE['cnpj'], response.text)


@unittest.skipUnless(os.getenv('EMPRESAS_TEST_DATABASE_URL'), 'Defina EMPRESAS_TEST_DATABASE_URL para integração PostgreSQL em schema isolado.')
class PersistenceTests(HTTPTests):
    @classmethod
    def setUpClass(cls):
        cls.base_url = os.environ['EMPRESAS_TEST_DATABASE_URL']
        cls.schema = 'empresas_test_' + uuid4().hex
        with psycopg.connect(cls.base_url, connect_timeout=5) as db:
            db.execute(sql.SQL('CREATE SCHEMA {}').format(sql.Identifier(cls.schema)))
        cls.url = make_conninfo(cls.base_url, options=f'-c search_path={cls.schema}')
        migrate(cls.url)
        migrate(cls.url)  # Idempotência real da migração.

    @classmethod
    def tearDownClass(cls):
        with psycopg.connect(cls.base_url, connect_timeout=5) as db:
            db.execute(sql.SQL('DROP SCHEMA {} CASCADE').format(sql.Identifier(cls.schema)))

    def setUp(self):
        super().setUp()
        env = patch.dict(os.environ, {'DATABASE_URL': self.url})
        env.start()
        self.addCleanup(env.stop)
        with psycopg.connect(self.url) as db:
            db.execute('TRUNCATE empresas_arquivos, empresas_documentos, empresas_perfis')

    def create(self):
        response = self.request('POST', json=PROFILE)
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def upload(self, identifier, previous=None):
        path = f'/{identifier}/documentos?tipo=atestado_tecnico&validade=2020-01-01'
        if previous:
            path += f'&anterior_id={previous}'
        return self.request('POST', path, content=PDF, headers={'Content-Type': 'application/pdf', 'X-Document-Title': quote('Atestado fictício')})

    def test_crud_pagination_and_revision_conflict(self):
        self.assertEqual(self.request().json(), [])
        created = self.create()
        identifier = created['id']
        self.assertEqual(created['origem'], 'declarado')
        self.assertEqual(created['preenchimento'], 'parcial')
        self.assertEqual(self.request(path=f'/{identifier}').json()['cnpj'], '11222333000181')
        self.assertEqual(self.request('POST', json=PROFILE).status_code, 409)
        updated = self.request('PUT', f'/{identifier}', json={**PROFILE, 'revisao': 1, 'capacidades': ['Transmissão declarada']})
        self.assertEqual(updated.status_code, 200, updated.text)
        self.assertEqual(updated.json()['revisao'], 2)
        self.assertEqual(self.request('PUT', f'/{identifier}', json={**PROFILE, 'revisao': 1}).status_code, 409)
        self.assertEqual(len(self.request().json()), 1)
        self.assertEqual(self.request(path='?pagina=2').json(), [])
        self.assertEqual(self.request('DELETE', f'/{identifier}').status_code, 204)
        self.assertEqual(self.request(path=f'/{identifier}').status_code, 404)

    def test_document_history_private_files_context_and_erasure(self):
        identifier = self.create()['id']
        upload = self.upload(identifier)
        self.assertEqual(upload.status_code, 201, upload.text)
        first = upload.json()
        self.assertTrue(first['vencido'])
        self.assertEqual(first['verificacao'], 'nao_verificado')
        self.assertEqual(first['titulo'], 'Atestado fictício')
        self.assertEqual(self.request(path=f'/{identifier}').json()['documentos_quantidade'], 1)
        file_path = first['referencia'].removeprefix('/api/empresas')
        file = self.request(path=file_path)
        self.assertEqual(file.content, PDF)
        self.assertIn('no-store', file.headers['cache-control'])
        self.assertIn('sandbox', file.headers['content-security-policy'])
        self.assertIn('attachment', self.request(path=file_path + '?download=true').headers['content-disposition'])
        self.assertEqual(self.request(path=file_path, key=None).status_code, 401)
        second = self.upload(identifier, first['id']).json()
        self.assertEqual(second['versao'], 2)
        self.assertEqual(self.upload(identifier, first['id']).status_code, 409)
        docs = self.request(path=f'/{identifier}/documentos').json()
        self.assertEqual(len(docs), 2)
        self.assertEqual(sum(doc['atual'] for doc in docs), 1)
        self.assertEqual(self.upload(uuid4(), second['id']).status_code, 404)
        other = self.request('POST', json={**PROFILE, 'cnpj': '00.000.000/0001-91'}).json()['id']
        self.assertEqual(self.upload(other, second['id']).status_code, 409)
        self.assertEqual(self.request(path=f'/{other}/documentos/{first["id"]}/arquivo').status_code, 404)
        context = self.request(path=f'/{identifier}/contexto-elegibilidade').json()
        self.assertEqual(context['contrato'], 'empresas.elegibilidade.v1')
        self.assertFalse(context['declaracoes_verificadas'])
        self.assertEqual(context['empresa']['id'], identifier)
        self.assertEqual(len(context['documentos']), 2)
        self.assertEqual(self.request('DELETE', f'/{identifier}/documentos/{second["id"]}').status_code, 204)
        self.assertEqual(self.request(path=second['referencia'].removeprefix('/api/empresas')).status_code, 404)
        self.assertEqual(self.request(path=f'/{identifier}').json()['documentos_quantidade'], 0)
        self.assertEqual(self.request('DELETE', f'/{identifier}').status_code, 409)
        self.assertEqual(self.request(path=file_path).status_code, 200)  # Histórico preservado.
        self.assertEqual(self.request('DELETE', f'/{identifier}/documentos/{first["id"]}').status_code, 204)
        with psycopg.connect(self.url) as db:
            self.assertEqual(db.execute('SELECT count(*) FROM empresas_arquivos').fetchone()[0], 0)
            self.assertEqual(db.execute('SELECT count(*) FROM empresas_documentos').fetchone()[0], 2)


if __name__ == '__main__':
    unittest.main()
