"""Evidence comparisons use local fixtures, PostgreSQL and no external model calls."""
import hashlib
import io
import unittest
from datetime import date, timedelta
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from psycopg.types.json import Jsonb
from pypdf import PdfWriter
from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject

from app.main import app
from app.documents import connect
from app.requirements import Candidate, ManualRequirement, add_requirement
from app.companies import (CompanyInput, EvidenceInput, AssessmentInput, create_company, get_company,
                           add_evidence, comparison, assess, compare, upload_evidence, evidence_file)

TEXT='A empresa deverá apresentar certidão fiscal federal válida.'


class CompanyTests(unittest.TestCase):
    def setUp(self):
        self.company=create_company(CompanyInput(name='Empresa sintética de teste'))
        self.company_ids=[self.company['id']]
        self.document_id=uuid4()
        with connect() as connection:
            connection.execute('INSERT INTO analysis_documents (id,filename,sha256,content,pages) VALUES (%s,%s,%s,%s,%s)',
                (self.document_id,'company-test.pdf',hashlib.sha256(str(self.document_id).encode()).hexdigest(),b'%PDF-test',Jsonb([{'page':1,'text':TEXT,'status':'text_extracted'}])))
        self.requirement=add_requirement(self.document_id,ManualRequirement(title='Apresentar certidão fiscal federal válida',category='fiscal',excerpt=TEXT,page=1,author='Teste'))

    def tearDown(self):
        with connect() as connection:
            connection.execute('DELETE FROM analysis_documents WHERE id=%s',(self.document_id,))
            for company_id in self.company_ids:
                connection.execute('DELETE FROM companies WHERE id=%s',(company_id,))

    def evidence(self, validity=None, company_id=None, kind='federal_tax'):
        return add_evidence(company_id or self.company['id'],EvidenceInput(title='Certidão sintética de teste',kind=kind,text='Texto cadastrado para testar uma evidência empresarial.',valid_until=validity))['id']

    def result(self):
        return comparison(self.company['id'],self.document_id)['results'][0]

    def request(self,status,**kwargs):
        return AssessmentInput(status=status,author='Analista de teste',reason='Conferido no documento empresarial e no edital',expected_snapshot=self.result()['snapshot'],**kwargs)

    def test_missing_evidence_is_not_noncompliance(self):
        result=self.result()
        self.assertEqual(result['automatic']['status'],'needs_validation')
        self.assertEqual(result['automatic']['evidence_ids'],[])
        self.assertIsNone(result['assessment'])

    def test_expired_document_flags_only_preliminary_incompatibility(self):
        evidence_id=self.evidence(date.today()-timedelta(days=1))
        result=self.result()
        self.assertEqual(result['automatic']['status'],'incompatibility')
        self.assertEqual(result['automatic']['evidence_ids'],[str(evidence_id)])
        self.assertIsNone(result['assessment'])

    def test_candidate_document_does_not_automatically_confirm_compliance(self):
        self.evidence(date.today()+timedelta(days=30))
        self.assertEqual(self.result()['automatic']['status'],'needs_validation')

    def test_valid_alternative_avoids_blanket_expiry_flag(self):
        self.evidence(date.today()-timedelta(days=1))
        self.evidence(date.today()+timedelta(days=30))
        self.assertEqual(self.result()['automatic']['status'],'needs_validation')

    def test_confirming_requires_evidence_from_same_company(self):
        with self.assertRaises(HTTPException):
            assess(self.company['id'],self.requirement['id'],self.request('conforming'))
        other=create_company(CompanyInput(name='Outra empresa de teste'))
        self.company_ids.append(other['id'])
        evidence_id=self.evidence(company_id=other['id'])
        with self.assertRaises(HTTPException):
            assess(self.company['id'],self.requirement['id'],self.request('conforming',evidence_id=evidence_id))

    def test_human_assessment_and_effort_history_are_saved(self):
        evidence_id=self.evidence()
        assess(self.company['id'],self.requirement['id'],self.request('conforming',evidence_id=evidence_id))
        self.assertEqual(self.result()['assessment']['status'],'conforming')
        assess(self.company['id'],self.requirement['id'],self.request('not_conforming',evidence_id=evidence_id,effort='Solicitar renovação e avaliar custo-benefício',estimated_days=4,estimated_cost=150))
        result=self.result()
        self.assertEqual(result['assessment']['estimated_days'],4)
        self.assertEqual(result['assessment']['estimated_cost'],150)
        self.assertEqual(len(result['history']),2)

    def test_evidence_change_invalidates_old_assessment_and_stale_save(self):
        request=self.request('needs_validation')
        assess(self.company['id'],self.requirement['id'],request)
        self.evidence()
        result=self.result()
        self.assertTrue(result['assessment_stale'])
        self.assertIsNone(result['assessment'])
        with self.assertRaises(HTTPException) as error:
            assess(self.company['id'],self.requirement['id'],request)
        self.assertEqual(error.exception.status_code,409)

    def test_company_evidence_never_crosses_company_boundaries(self):
        other=create_company(CompanyInput(name='Outra empresa de teste'))
        self.company_ids.append(other['id'])
        self.evidence(date.today()-timedelta(days=1),company_id=other['id'])
        self.assertEqual(self.result()['automatic']['evidence_ids'],[])

    def test_technical_requirements_are_not_compared_as_company_documents(self):
        add_requirement(self.document_id,ManualRequirement(title='Requisito técnico sintético',category='technical',excerpt=TEXT,page=1,author='Teste',stage='technical'))
        self.assertEqual(len(comparison(self.company['id'],self.document_id)['results']),1)

    def test_ambiguous_type_requires_review(self):
        requirement={'title':'Apresentar certidões federal e municipal', 'excerpt':'Apresentar certidão fiscal federal e certidão fiscal municipal.'}
        self.assertEqual(compare(requirement,[])['status'],'needs_validation')
        self.assertIsNone(compare(requirement,[])['kind'])

    def test_demo_company_keeps_new_evidence_marked_fictional(self):
        with connect() as connection:
            connection.execute('UPDATE companies SET demo=true WHERE id=%s',(self.company['id'],))
        self.evidence()
        self.assertTrue(get_company(self.company['id'])['evidence'][0]['demo'])

    def test_upload_pdf_persists_original_and_rejects_empty_scan(self):
        writer=PdfWriter();page=writer.add_blank_page(width=300,height=200)
        font=DictionaryObject({NameObject('/Type'):NameObject('/Font'),NameObject('/Subtype'):NameObject('/Type1'),NameObject('/BaseFont'):NameObject('/Helvetica')})
        page[NameObject('/Resources')]=DictionaryObject({NameObject('/Font'):DictionaryObject({NameObject('/F1'):font})})
        stream=DecodedStreamObject();stream.set_data(b'BT /F1 12 Tf 10 100 Td (Synthetic company evidence with sufficient native text for extraction.) Tj ET')
        page[NameObject('/Contents')]=writer._add_object(stream)
        buffer=io.BytesIO();writer.write(buffer);content=buffer.getvalue()
        result=upload_evidence(self.company['id'],title='Documento PDF de teste',kind='other',valid_until=None,file=UploadFile(io.BytesIO(content),filename='test.pdf'))
        self.assertEqual(evidence_file(self.company['id'],result['id']).body,content)
        blank=PdfWriter();blank.add_blank_page(width=200,height=200);buffer=io.BytesIO();blank.write(buffer)
        with self.assertRaises(HTTPException):
            upload_evidence(self.company['id'],title='Documento vazio de teste',kind='other',valid_until=None,file=UploadFile(io.BytesIO(buffer.getvalue()),filename='blank.pdf'))


if __name__=='__main__':
    unittest.main()
