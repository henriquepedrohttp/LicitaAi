"""Database-backed tests; OpenRouter is mocked and never billed by this suite."""
import hashlib
import json
import unittest
from unittest.mock import patch, MagicMock
from uuid import uuid4
from fastapi import HTTPException
from psycopg.types.json import Jsonb
from app.main import app  # loads local .env
from app.documents import connect
from app.requirements import (Candidate, ManualRequirement, ExtractionRequest, Review, add_requirement,
                              list_requirements, extract_requirements, review_requirement, extract_with_openrouter)

TEXT = 'A empresa deverá comprovar capacidade de armazenamento de 20 TB.\nDeverá apresentar experiência em streaming de 200 TB.'


class RequirementTests(unittest.TestCase):
    def setUp(self):
        self.document_id = uuid4()
        self.candidate = Candidate(title='Comprovar armazenamento de 20 TB', category='technical', excerpt=TEXT.split('\n')[0])
        with connect() as connection:
            connection.execute('INSERT INTO analysis_documents (id,filename,sha256,content,pages) VALUES (%s,%s,%s,%s,%s)',
                               (self.document_id, 'synthetic-requirements-test.pdf', hashlib.sha256(str(self.document_id).encode()).hexdigest(), b'%PDF-test',
                                Jsonb([{'page':1,'text':TEXT,'status':'text_extracted'},{'page':2,'text':'','status':'ocr_pending'}])))

    def tearDown(self):
        with connect() as connection:
            connection.execute('DELETE FROM analysis_documents WHERE id=%s', (self.document_id,))

    def create(self):
        return add_requirement(self.document_id, ManualRequirement(**self.candidate.model_dump(), page=1, author='Teste'))

    def test_manual_source_and_review_history(self):
        item = self.create()
        self.assertTrue(item['source']['verified'])
        self.assertEqual(item['source']['page'], 1)
        updated = review_requirement(self.document_id, item['id'], Review(status='corrected', author='Analista', reason='Ajustar interpretação',
                    title='Comprovar capacidade de armazenamento de 20 TB', category='technical', expected_version=1))
        self.assertEqual(updated['source'], item['source'])
        self.assertEqual(updated['history'][1]['before']['title'], item['title'])
        self.assertEqual(updated['version'], 2)
        with self.assertRaises(HTTPException) as raised:
            review_requirement(self.document_id,item['id'], Review(status='confirmed',author='Analista',reason='Conferido',title=updated['title'],category='technical',expected_version=1))
        self.assertEqual(raised.exception.status_code, 409)

    def test_invented_source_is_rejected(self):
        with self.assertRaises(HTTPException) as raised:
            add_requirement(self.document_id, ManualRequirement(title='Exigência inexistente',category='technical',excerpt='Comprovar capacidade de 999 TB de armazenamento.',page=1,author='Teste'))
        self.assertEqual(raised.exception.status_code,422)
        self.assertEqual(list_requirements(self.document_id)['requirements'],[])

    @patch('app.requirements.extract_with_openrouter')
    def test_ai_atomicity_and_idempotency(self, extract):
        extract.return_value=([self.candidate],'test/mock')
        result=extract_requirements(self.document_id,ExtractionRequest(page=1))
        self.assertEqual(result['created'],1)
        self.assertTrue(extract_requirements(self.document_id,ExtractionRequest(page=1))['already_processed'])
        self.assertEqual(extract.call_count,1)
        self.assertEqual(len(list_requirements(self.document_id)['runs']),1)

    @patch('app.requirements.extract_with_openrouter')
    def test_ai_bad_citation_saves_nothing(self, extract):
        bad=Candidate(title='Requisito falso de capacidade',category='technical',excerpt='Comprovar capacidade de 999 TB.')
        extract.return_value=([self.candidate,bad],'test/mock')
        with self.assertRaises(HTTPException):
            extract_requirements(self.document_id,ExtractionRequest(page=1))
        data=list_requirements(self.document_id)
        self.assertEqual(data['requirements'],[])
        self.assertEqual(data['runs'],[])

    @patch('app.requirements.extract_with_openrouter')
    def test_ocr_pending_does_not_call_ai(self,extract):
        with self.assertRaises(HTTPException):
            extract_requirements(self.document_id,ExtractionRequest(page=2))
        extract.assert_not_called()

    @patch.dict('os.environ',{'OPENROUTER_API_KEY':'test-only'})
    @patch('app.requirements.urlopen')
    def test_provider_incomplete_response_rejected(self, request):
        response=MagicMock()
        response.read.return_value=json.dumps({'choices':[{'finish_reason':'length','message':{'content':'{}'}}]}).encode()
        request.return_value.__enter__.return_value=response
        with self.assertRaises(HTTPException) as raised:
            extract_with_openrouter(TEXT)
        self.assertEqual(raised.exception.status_code,502)


if __name__=='__main__':unittest.main()
