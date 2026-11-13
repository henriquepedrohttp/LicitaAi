"""Whole-document workflow checks with real PostgreSQL and mocked AI (no charges)."""
import hashlib
import json
import unittest
from unittest.mock import patch, MagicMock
from uuid import uuid4

from fastapi import BackgroundTasks, HTTPException
from psycopg.types.json import Jsonb

from app.main import app  # loads local environment
from app.documents import connect
from app.requirements import Candidate, ManualRequirement, Review, add_requirement, list_requirements, review_requirement, extract_pages_with_openrouter
from app.workflow import Approval, Start, approve, get_analysis, run_stage, start_analysis

TEXT = 'A empresa deverá apresentar certidão fiscal válida. O projeto deverá armazenar 20 TB.'


class WorkflowTests(unittest.TestCase):
    def setUp(self):
        batch_env = patch.dict('os.environ', {'ANALYSIS_BATCH_PAGES': '1'})
        batch_env.start()
        self.addCleanup(batch_env.stop)
        self.document_id = uuid4()
        with connect() as connection:
            connection.execute('INSERT INTO analysis_documents (id,filename,sha256,content,pages) VALUES (%s,%s,%s,%s,%s)',
                (self.document_id, 'workflow-test.pdf', hashlib.sha256(str(self.document_id).encode()).hexdigest(), b'%PDF-test',
                 Jsonb([{'page': n, 'text': TEXT, 'status': 'text_extracted'} for n in (1, 2)])))
        self.candidate = Candidate(title='Apresentar certidão fiscal válida', category='fiscal', excerpt=TEXT.split(' O projeto')[0])

    def tearDown(self):
        with connect() as connection:
            connection.execute('DELETE FROM analysis_documents WHERE id=%s', (self.document_id,))

    def validate(self):
        current = get_analysis(self.document_id)
        return approve(self.document_id, Approval(author='Analista', reason='Conferido no edital original', expected_snapshot=current['snapshot']))

    @patch('app.workflow.extract_pages_with_openrouter')
    def test_whole_document_gate_and_separate_stages(self, extract):
        with self.assertRaises(HTTPException) as error:
            start_analysis(self.document_id, Start(stage='technical'), BackgroundTasks())
        self.assertEqual(error.exception.status_code, 409)
        extract.assert_not_called()
        extract.side_effect = lambda pages, **kwargs: ({page['page']: [self.candidate] for page in pages}, 'test/mock')
        run_stage(self.document_id, 'conformity')
        self.assertEqual(extract.call_count, 2)
        self.assertEqual(get_analysis(self.document_id)['stages']['conformity']['processed_pages'], 2)
        with self.assertRaises(HTTPException):
            self.validate()
        for item in list_requirements(self.document_id)['requirements']:
            review_requirement(self.document_id, item['id'], Review(status='confirmed', author='Analista', reason='Trecho conferido', title=item['title'], category=item['category'], expected_version=item['version']))
        self.assertTrue(self.validate()['conformity_approved'])
        extract.side_effect = lambda pages, **kwargs: ({page['page']: [Candidate(title='Armazenar 20 TB no projeto', category='technical', excerpt='O projeto deverá armazenar 20 TB.')] for page in pages}, 'test/mock')
        run_stage(self.document_id, 'technical')
        items = list_requirements(self.document_id)['requirements']
        self.assertEqual({item['stage'] for item in items}, {'conformity', 'technical'})
        self.assertEqual(get_analysis(self.document_id)['stages']['technical']['processed_pages'], 2)
        before = extract.call_count
        run_stage(self.document_id, 'technical')
        self.assertEqual(extract.call_count, before)
        add_requirement(self.document_id, ManualRequirement(title='Conferir comprovação fiscal adicional',category='fiscal', excerpt=self.candidate.excerpt,page=1,author='Analista',stage='conformity'))
        self.assertFalse(get_analysis(self.document_id)['conformity_approved'])
        with self.assertRaises(HTTPException):
            start_analysis(self.document_id, Start(stage='technical'), BackgroundTasks())

    @patch('app.workflow.extract_pages_with_openrouter')
    def test_partial_coverage_cannot_be_approved(self, extract):
        with connect() as connection:
            connection.execute('UPDATE analysis_documents SET pages=%s WHERE id=%s',
                (Jsonb([{'page': 1,'text': TEXT,'status':'text_extracted'}, {'page':2,'text':'','status':'ocr_pending'}]), self.document_id))
        extract.side_effect = lambda pages, **kwargs: ({page['page']: [] for page in pages}, 'test/mock')
        run_stage(self.document_id, 'conformity')
        state = get_analysis(self.document_id)
        self.assertEqual(extract.call_count, 1)
        self.assertEqual(state['blocked_pages'], [2])
        self.assertEqual(state['stages']['conformity']['job']['status'], 'partial')
        with self.assertRaises(HTTPException):
            self.validate()

    @patch('app.workflow.extract_pages_with_openrouter')
    def test_failure_preserves_progress_and_resume_skips_completed_pages(self, extract):
        extract.side_effect = [({1: []}, 'test/mock'), HTTPException(502, 'Falha simulada')]
        run_stage(self.document_id, 'conformity')
        state = get_analysis(self.document_id)
        self.assertEqual(state['stages']['conformity']['processed_pages'], 1)
        self.assertEqual(state['stages']['conformity']['job']['status'], 'failed')
        extract.side_effect = None
        extract.side_effect = lambda pages, **kwargs: ({page['page']: [] for page in pages}, 'test/mock')
        run_stage(self.document_id, 'conformity')
        self.assertEqual(extract.call_count, 3)
        self.assertTrue(get_analysis(self.document_id)['conformity_complete'])
        # An empty result requires the same explicit human approval.
        self.assertFalse(get_analysis(self.document_id)['conformity_approved'])
        self.assertTrue(self.validate()['conformity_approved'])

    @patch('app.workflow.extract_pages_with_openrouter')
    def test_bad_citation_rolls_back_entire_page(self, extract):
        bad = Candidate(title='Exigência inexistente',category='fiscal',excerpt='Texto inventado não presente na página.')
        extract.side_effect = lambda pages, **kwargs: ({page['page']: [self.candidate, bad] for page in pages}, 'test/mock')
        run_stage(self.document_id, 'conformity')
        self.assertEqual(list_requirements(self.document_id)['requirements'], [])
        self.assertEqual(get_analysis(self.document_id)['stages']['conformity']['processed_pages'], 0)

    @patch('app.workflow.extract_pages_with_openrouter')
    def test_concurrent_worker_does_not_call_provider(self, extract):
        with connect() as connection:
            lock_id = int.from_bytes(hashlib.sha256(str(self.document_id).encode()).digest()[:8], 'big', signed=True)
            connection.execute('SELECT pg_advisory_xact_lock(%s)', (lock_id,))
            run_stage(self.document_id, 'conformity')
        extract.assert_not_called()

    def test_manual_technical_requirement_cannot_bypass_gate(self):
        with self.assertRaises(HTTPException) as error:
            add_requirement(self.document_id, ManualRequirement(title='Armazenar 20 TB no projeto', category='technical', excerpt='O projeto deverá armazenar 20 TB.', page=1, author='Analista', stage='technical'))
        self.assertEqual(error.exception.status_code, 409)

    @patch('app.workflow.extract_pages_with_openrouter')
    def test_outdated_approval_is_rejected(self, extract):
        extract.side_effect = lambda pages, **kwargs: ({page['page']: [] for page in pages}, 'test/mock')
        run_stage(self.document_id, 'conformity')
        snapshot = get_analysis(self.document_id)['snapshot']
        add_requirement(self.document_id, ManualRequirement(**self.candidate.model_dump(), page=1,author='Analista'))
        with self.assertRaises(HTTPException) as error:
            approve(self.document_id, Approval(author='Analista',reason='Conferido anteriormente',expected_snapshot=snapshot))
        self.assertEqual(error.exception.status_code,409)

    @patch.dict('os.environ', {'ANALYSIS_BATCH_PAGES': '4'})
    @patch('app.workflow.extract_pages_with_openrouter')
    def test_batch_reduces_calls_and_keeps_page_sources(self, extract):
        extract.return_value = ({1: [self.candidate], 2: [self.candidate]}, 'test/mock')
        run_stage(self.document_id, 'conformity')
        self.assertEqual(extract.call_count, 1)
        self.assertEqual([page['page'] for page in extract.call_args.args[0]], [1, 2])
        self.assertEqual([item['source']['page'] for item in list_requirements(self.document_id)['requirements']], [1, 2])
        self.assertEqual(get_analysis(self.document_id)['stages']['conformity']['processed_pages'], 2)
        run_stage(self.document_id, 'conformity')
        self.assertEqual(extract.call_count, 1)

    @patch.dict('os.environ', {'ANALYSIS_BATCH_PAGES': '4'})
    @patch('app.workflow.extract_pages_with_openrouter')
    def test_missing_page_does_not_mark_batch_completed(self, extract):
        extract.return_value = ({1: []}, 'test/mock')
        run_stage(self.document_id, 'conformity')
        self.assertEqual(get_analysis(self.document_id)['stages']['conformity']['processed_pages'], 0)

    @patch.dict('os.environ', {'ANALYSIS_BATCH_PAGES': '4'})
    @patch('app.workflow.extract_pages_with_openrouter')
    def test_wrong_page_citation_rolls_back_entire_batch(self, extract):
        with connect() as connection:
            connection.execute('UPDATE analysis_documents SET pages=%s WHERE id=%s',
                (Jsonb([{'page':1,'text':TEXT,'status':'text_extracted'},
                        {'page':2,'text':'A empresa deverá apresentar declaração de independência.', 'status':'text_extracted'}]), self.document_id))
        extract.return_value = ({1: [self.candidate], 2: [self.candidate]}, 'test/mock')
        run_stage(self.document_id, 'conformity')
        self.assertEqual(list_requirements(self.document_id)['requirements'], [])
        self.assertEqual(get_analysis(self.document_id)['stages']['conformity']['processed_pages'], 0)

    @patch.dict('os.environ', {'ANALYSIS_BATCH_PAGES': '4'})
    @patch('app.workflow.extract_pages_with_openrouter')
    def test_resume_skips_completed_batch(self, extract):
        with connect() as connection:
            connection.execute('UPDATE analysis_documents SET pages=%s WHERE id=%s',
                (Jsonb([{'page':n,'text':TEXT,'status':'text_extracted'} for n in range(1,6)]), self.document_id))
        extract.side_effect = [({n: [] for n in range(1,5)}, 'test/mock'), HTTPException(502, 'Falha simulada')]
        run_stage(self.document_id, 'conformity')
        self.assertEqual(get_analysis(self.document_id)['stages']['conformity']['processed_pages'], 4)
        extract.side_effect = None
        extract.return_value = ({5: []}, 'test/mock')
        run_stage(self.document_id, 'conformity')
        self.assertEqual([page['page'] for page in extract.call_args.args[0]], [5])
        self.assertEqual(get_analysis(self.document_id)['stages']['conformity']['processed_pages'], 5)

    @patch.dict('os.environ', {'OPENROUTER_API_KEY': 'test-only'})
    @patch('app.requirements.urlopen')
    def test_provider_batch_schema_and_page_coverage(self, request):
        response = MagicMock()
        request.return_value.__enter__.return_value = response
        for pages in ([{'page':1,'requirements':[]}],
                      [{'page':1,'requirements':[]},{'page':1,'requirements':[]}],
                      [{'page':1,'requirements':[]},{'page':3,'requirements':[]}]):
            response.read.return_value = json.dumps({'choices':[{'finish_reason':'stop','message':{'content':json.dumps({'pages':pages})}}]}).encode()
            with self.assertRaises(HTTPException):
                extract_pages_with_openrouter([{'page':1,'text':TEXT},{'page':2,'text':TEXT}], 'conformity')
        response.read.return_value = json.dumps({'choices':[{'finish_reason':'stop','message':{'content':json.dumps({'pages':[{'page':1,'requirements':[]},{'page':2,'requirements':[]}]})}}]}).encode()
        by_page, _ = extract_pages_with_openrouter([{'page':1,'text':TEXT},{'page':2,'text':TEXT}], 'conformity')
        self.assertEqual(by_page, {1:[],2:[]})
        payload = json.loads(request.call_args.args[0].data)
        self.assertIn('document_pages', json.loads(payload['messages'][1]['content']))
        self.assertIn('CADA página', payload['messages'][0]['content'])
        self.assertEqual(payload['reasoning'], {'enabled': False})
        self.assertIn('classifique pelo que a obrigação exige', payload['messages'][0]['content'])

    @patch.dict('os.environ', {'ANALYSIS_BATCH_PAGES': '4'})
    def test_batch_size_and_text_budget(self):
        from app.workflow import page_batches
        pages = [{'page':n,'text':'a'*10000,'status':'text_extracted'} for n in range(1,7)]
        batches = list(page_batches(pages, {1}))
        self.assertEqual([[page['page'] for page in batch] for batch in batches], [[2,3],[4,5],[6]])


if __name__ == '__main__':
    unittest.main()
