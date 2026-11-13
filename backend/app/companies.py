"""Company evidence and reviewable, explicitly preliminary comparisons."""
import hashlib
import io
import json
import re
import unicodedata
from datetime import date, timedelta
from typing import Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field
from psycopg.types.json import Jsonb
from pypdf import PdfReader

from app.documents import connect, MAX_BYTES, MAX_PAGES
from app.requirements import initialize, document_row

router = APIRouter(prefix='/companies', tags=['companies'])
Kind = Literal['legal_registration', 'federal_tax', 'state_tax', 'municipal_tax', 'fgts', 'labor', 'bankruptcy', 'technical_certificate', 'other']
KINDS = {'legal_registration': 'Contrato social / registro empresarial', 'federal_tax': 'Regularidade fiscal federal',
         'state_tax': 'Regularidade fiscal estadual', 'municipal_tax': 'Regularidade fiscal municipal',
         'fgts': 'Regularidade FGTS', 'labor': 'Certidão trabalhista (CNDT)', 'bankruptcy': 'Certidão de falência',
         'technical_certificate': 'Atestado de capacidade técnica', 'other': 'Outro documento'}


class CompanyInput(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    name: str = Field(min_length=2, max_length=200)


class EvidenceInput(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    title: str = Field(min_length=3, max_length=200)
    kind: Kind
    text: str = Field(min_length=15, max_length=100000)
    valid_until: date | None = None


class AssessmentInput(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    status: Literal['conforming', 'needs_validation', 'not_conforming']
    author: str = Field(min_length=2, max_length=100)
    reason: str = Field(min_length=3, max_length=2000)
    evidence_id: UUID | None = None
    effort: str = Field(default='', max_length=2000)
    estimated_days: int | None = Field(default=None, ge=0, le=36500)
    estimated_cost: float | None = Field(default=None, ge=0, le=1e12, allow_inf_nan=False)
    expected_snapshot: str


def setup(connection):
    initialize(connection)
    connection.execute('''CREATE TABLE IF NOT EXISTS companies (
        id UUID PRIMARY KEY, name TEXT NOT NULL, demo BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now())''')
    connection.execute('''CREATE TABLE IF NOT EXISTS company_evidence (
        id UUID PRIMARY KEY, company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
        title TEXT NOT NULL, kind TEXT NOT NULL, text TEXT NOT NULL, valid_until DATE,
        demo BOOLEAN NOT NULL, filename TEXT, content BYTEA, sha256 TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now())''')
    connection.execute('''CREATE TABLE IF NOT EXISTS company_assessments (
        id BIGSERIAL PRIMARY KEY, company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
        requirement_id UUID REFERENCES analysis_requirements(id) ON DELETE CASCADE,
        snapshot TEXT NOT NULL, assessment JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())''')


def company_row(connection, company_id):
    company = connection.execute('SELECT * FROM companies WHERE id=%s', (company_id,)).fetchone()
    if not company:
        raise HTTPException(404, 'Empresa não encontrada.')
    return company


def evidence_rows(connection, company_id):
    return connection.execute('SELECT id,title,kind,text,valid_until,demo,filename,sha256,created_at FROM company_evidence WHERE company_id=%s ORDER BY created_at,id', (company_id,)).fetchall()


def store_evidence(connection, company, request, content=None, filename=None):
    evidence_id = uuid4()
    digest = hashlib.sha256(content if content is not None else request.text.encode()).hexdigest()
    connection.execute('''INSERT INTO company_evidence
        (id,company_id,title,kind,text,valid_until,demo,filename,content,sha256) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)''',
        (evidence_id, company['id'], request.title, request.kind, request.text, request.valid_until, company['demo'], filename, content, digest))
    return evidence_id


@router.get('')
def list_companies():
    with connect() as connection:
        setup(connection)
        return {'companies': connection.execute('SELECT id,name,demo FROM companies ORDER BY created_at').fetchall(), 'kinds': KINDS}


@router.post('', status_code=201)
def create_company(request: CompanyInput):
    with connect() as connection:
        setup(connection)
        row = connection.execute('INSERT INTO companies (id,name) VALUES (%s,%s) RETURNING id,name,demo', (uuid4(), request.name)).fetchone()
    return row


@router.post('/demo', status_code=201)
def create_demo():
    with connect() as connection:
        setup(connection)
        # Seed explicitly, once, without mixing fictional documents into real companies.
        connection.execute('SELECT pg_advisory_xact_lock(141332026)')
        company = connection.execute('SELECT * FROM companies WHERE demo=true ORDER BY created_at LIMIT 1').fetchone()
        if not company:
            company = connection.execute('INSERT INTO companies (id,name,demo) VALUES (%s,%s,true) RETURNING *', (uuid4(), 'Aurora Sistemas — demonstração fictícia')).fetchone()
            for title, kind, text, validity in [
                ('Contrato social fictício', 'legal_registration', 'DOCUMENTO FICTÍCIO: registro empresarial da Aurora Sistemas, somente para demonstração.', None),
                ('Certidão federal fictícia — vencida', 'federal_tax', 'DOCUMENTO FICTÍCIO: certidão fiscal federal com validade vencida, para testar uma pendência.', date.today()-timedelta(days=30)),
                ('CNDT fictícia', 'labor', 'DOCUMENTO FICTÍCIO: certidão trabalhista sem débitos, para demonstração; não é evidência real.', date.today()+timedelta(days=60)),
                ('Atestado técnico fictício', 'technical_certificate', 'DOCUMENTO FICTÍCIO: experiência em armazenamento de 10 TB. Quantidade sujeita a comparação manual.', None),
            ]:
                store_evidence(connection, company, EvidenceInput(title=title,kind=kind,text=text,valid_until=validity))
    return {'id':company['id'], 'name':company['name'], 'demo':True}


@router.get('/{company_id}')
def get_company(company_id: UUID):
    with connect() as connection:
        setup(connection)
        company = company_row(connection, company_id)
        return {'id':company['id'],'name':company['name'],'demo':company['demo'], 'evidence':evidence_rows(connection, company_id), 'kinds':KINDS}


@router.post('/{company_id}/evidence', status_code=201)
def add_evidence(company_id: UUID, request: EvidenceInput):
    with connect() as connection:
        setup(connection)
        company = company_row(connection, company_id)
        connection.execute('SELECT id FROM companies WHERE id=%s FOR UPDATE', (company_id,))
        evidence_id = store_evidence(connection, company, request)
    return {'id':evidence_id}


@router.post('/{company_id}/evidence/upload', status_code=201)
def upload_evidence(company_id: UUID, title: str = Form(min_length=3,max_length=200), kind: Kind = Form(),
                    valid_until: date | None = Form(default=None), file: UploadFile = File()):
    content = file.file.read(MAX_BYTES+1)
    if len(content)>MAX_BYTES:
        raise HTTPException(413, 'O limite é de 20 MB por PDF.')
    if not content.startswith(b'%PDF-'):
        raise HTTPException(415, 'Envie um PDF válido.')
    try:
        reader = PdfReader(io.BytesIO(content))
        if reader.is_encrypted or not 1<=len(reader.pages)<=MAX_PAGES:
            raise HTTPException(422, 'Envie PDF sem senha, de 1 a 200 páginas.')
        page_texts = [page.extract_text() or '' for page in reader.pages]
        text = '\n'.join(f'Página {number}:\n{page_text}' for number,page_text in enumerate(page_texts,1))
        if len(text)>100000:
            raise HTTPException(422, 'Texto acima do limite desta demonstração. Envie um documento menor.')
        if sum(ch.isalnum() for ch in ''.join(page_texts))<30:
            raise HTTPException(422, 'PDF sem texto suficiente. OCR de documentos empresariais ainda não está disponível.')
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(422, 'Não foi possível extrair o texto deste PDF.') from None
    filename = (file.filename or 'documento.pdf').replace('\\','/').split('/')[-1][:200]
    with connect() as connection:
        setup(connection)
        company = company_row(connection, company_id)
        connection.execute('SELECT id FROM companies WHERE id=%s FOR UPDATE', (company_id,))
        evidence_id = store_evidence(connection, company, EvidenceInput(title=title,kind=kind,text=text,valid_until=valid_until), content, filename)
    return {'id':evidence_id}


@router.get('/{company_id}/evidence/{evidence_id}/file')
def evidence_file(company_id: UUID, evidence_id: UUID):
    with connect() as connection:
        setup(connection)
        row = connection.execute('SELECT content FROM company_evidence WHERE company_id=%s AND id=%s', (company_id,evidence_id)).fetchone()
        if not row or row['content'] is None:
            raise HTTPException(404, 'Arquivo não encontrado; este registro pode conter apenas texto cadastrado.')
    return Response(bytes(row['content']),media_type='application/pdf',headers={'Cache-Control':'no-store','Content-Disposition':'inline; filename="documento-empresa.pdf"','X-Content-Type-Options':'nosniff'})


def normalize(value):
    return ''.join(ch for ch in unicodedata.normalize('NFKD', value.lower()) if not unicodedata.combining(ch))


def identify_kind(requirement):
    text = normalize(requirement['title']+' '+requirement['excerpt'])
    patterns = {'legal_registration': r'contrato social|registro empresarial|ato constitutivo',
                'federal_tax':r'regularidade.{0,40}federal|certidao.{0,80}federal|fazenda nacional|receita federal',
                'state_tax':r'regularidade.{0,40}estadual|certidao.{0,80}estadual|fazenda estadual',
                'municipal_tax':r'regularidade.{0,40}municipal|certidao.{0,80}municipal|fazenda municipal',
                'fgts':r'\bfgts\b', 'labor':r'\bcndt\b|certidao.{0,40}trabalhista|debitos trabalhistas',
                'bankruptcy':r'certidao.{0,60}falencia', 'technical_certificate':r'atestado.{0,60}(tecnic|capacidade|experiencia)'}
    matches=[kind for kind,pattern in patterns.items() if re.search(pattern,text,re.S)]
    return matches[0] if len(matches)==1 else None


def snapshot(requirement, evidence):
    return hashlib.sha256(json.dumps({'requirement':str(requirement['id']), 'version':requirement['version'], 'reference_date':date.today().isoformat(),
        'evidence':[{key:str(item[key]) for key in ('id','sha256','valid_until','kind')} for item in evidence]},sort_keys=True).encode()).hexdigest()


def compare(requirement, evidence):
    kind = identify_kind(requirement)
    matches = [item for item in evidence if item['kind']==kind] if kind else []
    base = {'status':'needs_validation','kind':kind,'evidence_ids':[str(item['id']) for item in matches]}
    if not kind:
        return {**base,'reason':'Tipo documental ambíguo ou não reconhecido. Conferência humana necessária.'}
    if not matches:
        return {**base,'reason':'Documento correspondente não localizado no cadastro. Ausência de evidência não comprova não conformidade.'}
    # Only metadata is checked. It is never an automatic positive compliance decision.
    if all(item['valid_until'] is not None and item['valid_until']<date.today() for item in matches):
        return {**base,'status':'incompatibility','reason':f'Todos os documentos cadastrados deste tipo têm validade informada anterior a {date.today().isoformat()}. Possível incompatibilidade; confira o prazo exigido no edital e eventual renovação.'}
    return {**base,'reason':'Documento candidato localizado pelo tipo informado no cadastro. Conteúdo, autenticidade, quantidades e condições do edital ainda precisam de validação.'}


@router.get('/{company_id}/comparison/{document_id}')
def comparison(company_id: UUID, document_id: UUID):
    with connect() as connection:
        setup(connection)
        company = company_row(connection, company_id)
        document_row(connection, document_id)
        evidence = evidence_rows(connection, company_id)
        requirements = connection.execute("SELECT * FROM analysis_requirements WHERE document_id=%s AND stage='conformity' AND review_status<>'rejected' ORDER BY page,created_at", (document_id,)).fetchall()
        results=[]
        for requirement in requirements:
            current = snapshot(requirement,evidence)
            history = connection.execute('SELECT snapshot,assessment,created_at FROM company_assessments WHERE company_id=%s AND requirement_id=%s ORDER BY id DESC', (company_id,requirement['id'])).fetchall()
            saved = history[0] if history else None
            stale = bool(saved and saved['snapshot']!=current)
            results.append({'requirement_id':str(requirement['id']),'title':requirement['title'],'page':requirement['page'],'excerpt':requirement['excerpt'],
                            'snapshot':current,'automatic':compare(requirement,evidence), 'assessment':saved['assessment'] if saved and not stale else None,
                            'assessment_stale':stale,'history':history})
        return {'company':{'id':company['id'],'name':company['name'],'demo':company['demo']}, 'reference_date':date.today(),
                'method':'Triagem por tipo documental e validade informados no cadastro; não há validação semântica automática do conteúdo.',
                'evidence':evidence,'results':results}


@router.post('/{company_id}/assessments/{requirement_id}')
def assess(company_id: UUID, requirement_id: UUID, request: AssessmentInput):
    with connect() as connection:
        setup(connection)
        company_row(connection, company_id)
        connection.execute('SELECT id FROM companies WHERE id=%s FOR UPDATE', (company_id,))
        requirement = connection.execute("SELECT * FROM analysis_requirements WHERE id=%s AND stage='conformity' AND review_status<>'rejected' FOR UPDATE", (requirement_id,)).fetchone()
        if not requirement:
            raise HTTPException(404, 'Requisito de conformidade não encontrado.')
        evidence=evidence_rows(connection,company_id)
        current=snapshot(requirement,evidence)
        if request.expected_snapshot!=current:
            raise HTTPException(409,'Requisito ou documentos mudaram. Atualize a comparação antes de avaliar.')
        if request.evidence_id and not any(item['id']==request.evidence_id for item in evidence):
            raise HTTPException(422,'A evidência precisa pertencer à empresa selecionada.')
        if request.status=='conforming' and not request.evidence_id:
            raise HTTPException(422,'Selecione uma evidência para registrar empresa conforme.')
        assessment=request.model_dump(mode='json')
        connection.execute('INSERT INTO company_assessments (company_id,requirement_id,snapshot,assessment) VALUES (%s,%s,%s,%s)',(company_id,requirement_id,current,Jsonb(assessment)))
    return {'assessment':assessment}
