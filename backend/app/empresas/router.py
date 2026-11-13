import hashlib
import os
import secrets
from contextlib import contextmanager
from datetime import date, datetime
from uuid import UUID, uuid4
from urllib.parse import unquote
from zoneinfo import ZoneInfo

import psycopg
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from .schemas import Company, DocumentType, EligibilityContext, Evidence, Profile, Update

MAX_FILE = 10 * 1024 * 1024


def authorize(authorization: str | None = Header(default=None)):
    # shortcut: chave de workspace único, adotar identidade/tenant antes do uso multi-organização.
    expected = os.getenv('EMPRESAS_ACCESS_KEY', '')
    if len(expected) < 32:
        raise HTTPException(503, 'Empresas bloqueado: configure uma chave privada com ao menos 32 caracteres.')
    if not secrets.compare_digest((authorization or '').encode(), f'Bearer {expected}'.encode()):
        raise HTTPException(401, 'Chave de acesso inválida ou ausente.')


router = APIRouter(prefix='/api/empresas', tags=['Empresas'], dependencies=[Depends(authorize)])


@contextmanager
def database():
    url = os.getenv('DATABASE_URL')
    if not url:
        raise HTTPException(503, 'Banco de Empresas não configurado.')
    try:
        with psycopg.connect(url, connect_timeout=5, row_factory=dict_row) as connection:
            connection.execute("SET LOCAL statement_timeout = '10s'")
            yield connection
    except psycopg.errors.UniqueViolation:
        raise HTTPException(409, 'CNPJ já cadastrado ou versão já substituída.') from None
    except psycopg.Error:
        # Não registrar SQL, parâmetros, CNPJ, conteúdo ou credenciais.
        raise HTTPException(503, 'Banco indisponível ou migração de Empresas pendente.') from None


def company_row(db, identifier, lock=False):
    row = db.execute('SELECT * FROM empresas_perfis WHERE id = %s' + (' FOR UPDATE' if lock else ''), (identifier,)).fetchone()
    if not row:
        raise HTTPException(404, 'Empresa não encontrada.')
    return row


def company(db, row):
    profile = row['perfil']
    pending = [key for key in Profile.model_fields if key not in ('nome_fantasia', 'cnaes_secundarios') and not profile.get(key)]
    count = db.execute('''SELECT count(*) AS n FROM empresas_documentos d
        WHERE empresa_id = %s AND excluido_em IS NULL
        AND NOT EXISTS (SELECT 1 FROM empresas_documentos n WHERE n.anterior_id = d.id)''', (row['id'],)).fetchone()['n']
    return Company(**profile, id=row['id'], revisao=row['revisao'], criado_em=row['criado_em'], atualizado_em=row['atualizado_em'],
                   documentos_quantidade=count, campos_pendentes=pending, preenchimento='parcial' if pending else 'campos_preenchidos')


@router.get('', response_model=list[Company])
def list_companies(response: Response, pagina: int = Query(1, ge=1, le=100000)):
    response.headers['Cache-Control'] = 'private, no-store'
    with database() as db:
        rows = db.execute('SELECT * FROM empresas_perfis ORDER BY criado_em, id LIMIT 20 OFFSET %s', ((pagina - 1) * 20,)).fetchall()
        return [company(db, row) for row in rows]


@router.post('', response_model=Company, status_code=201)
def create_company(profile: Profile):
    with database() as db:
        row = db.execute('INSERT INTO empresas_perfis(id, cnpj, perfil) VALUES (%s, %s, %s) RETURNING *',
                         (uuid4(), profile.cnpj, Jsonb(profile.model_dump()))).fetchone()
        return company(db, row)


@router.get('/{identifier}', response_model=Company)
def get_company(identifier: UUID, response: Response):
    response.headers['Cache-Control'] = 'private, no-store'
    with database() as db:
        return company(db, company_row(db, identifier))


@router.put('/{identifier}', response_model=Company)
def update_company(identifier: UUID, profile: Update):
    with database() as db:
        current = company_row(db, identifier, lock=True)
        if current['revisao'] != profile.revisao:
            raise HTTPException(409, 'Perfil alterado em outra sessão. Reabra o perfil antes de editar.')
        row = db.execute('''UPDATE empresas_perfis SET cnpj = %s, perfil = %s, revisao = revisao + 1,
            atualizado_em = now() WHERE id = %s RETURNING *''',
            (profile.cnpj, Jsonb(profile.model_dump(exclude={'revisao'})), identifier)).fetchone()
        return company(db, row)


@router.delete('/{identifier}', status_code=204)
def delete_company(identifier: UUID):
    with database() as db:
        company_row(db, identifier, lock=True)
        if db.execute('SELECT 1 FROM empresas_documentos WHERE empresa_id = %s LIMIT 1', (identifier,)).fetchone():
            raise HTTPException(409, 'Empresa com histórico documental não pode ser excluída neste MVP.')
        db.execute('DELETE FROM empresas_perfis WHERE id = %s', (identifier,))


def evidence(row):
    return Evidence(**row, vencido=row['validade'] is not None and row['validade'] < datetime.now(ZoneInfo('America/Recife')).date(),
                    referencia=f"/api/empresas/{row['empresa_id']}/documentos/{row['id']}/arquivo")


def documents(db, identifier):
    # shortcut: histórico integral do piloto, paginar antes de receber acervos volumosos.
    rows = db.execute('''SELECT d.*, NOT EXISTS (SELECT 1 FROM empresas_documentos n WHERE n.anterior_id = d.id) AS atual
        FROM empresas_documentos d WHERE empresa_id = %s ORDER BY enviado_em DESC, id''', (identifier,)).fetchall()
    return [evidence(row) for row in rows]


@router.get('/{identifier}/documentos', response_model=list[Evidence])
def list_documents(identifier: UUID, response: Response):
    response.headers['Cache-Control'] = 'private, no-store'
    with database() as db:
        company_row(db, identifier)
        return documents(db, identifier)


async def pdf_bytes(request):
    if request.headers.get('content-type', '').split(';')[0] != 'application/pdf':
        raise HTTPException(415, 'Envie um PDF com Content-Type application/pdf.')
    content = bytearray()
    async for chunk in request.stream():
        if len(content) + len(chunk) > MAX_FILE:
            raise HTTPException(413, 'PDF excede o limite de 10 MiB.')
        content.extend(chunk)
    # shortcut: validação de envelope, adotar parser isolado/antimalware antes do uso corporativo.
    if not content.startswith((b'%PDF-1.', b'%PDF-2.')) or not content.rstrip().endswith(b'%%EOF'):
        raise HTTPException(422, 'Arquivo não possui um envelope PDF reconhecido; confira o arquivo.')
    return bytes(content)


@router.post('/{identifier}/documentos', response_model=Evidence, status_code=201)
async def upload_document(identifier: UUID, request: Request, tipo: DocumentType,
                          titulo: str = Header(alias='X-Document-Title', min_length=1, max_length=2400), validade: date | None = None,
                          anterior_id: UUID | None = None):
    titulo = unquote(titulo).strip()
    if not titulo or len(titulo) > 200 or any(ord(c) < 32 for c in titulo):
        raise HTTPException(422, 'Informe um título para o documento.')
    content = await pdf_bytes(request)
    with database() as db:
        company_row(db, identifier, lock=True)
        version = 1
        if anterior_id:
            previous = db.execute('''SELECT d.* FROM empresas_documentos d WHERE id = %s AND empresa_id = %s
                AND excluido_em IS NULL AND NOT EXISTS (SELECT 1 FROM empresas_documentos n WHERE n.anterior_id = d.id)''', (anterior_id, identifier)).fetchone()
            if not previous:
                raise HTTPException(409, 'A versão anterior não está disponível para substituição nesta empresa.')
            version = previous['versao'] + 1
        row = db.execute('''INSERT INTO empresas_documentos(id, empresa_id, anterior_id, versao, titulo, tipo, validade, tamanho, sha256)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *, true AS atual''',
            (uuid4(), identifier, anterior_id, version, titulo.strip(), tipo, validade, len(content), hashlib.sha256(content).hexdigest())).fetchone()
        db.execute('INSERT INTO empresas_arquivos(documento_id, conteudo) VALUES (%s, %s)', (row['id'], content))
        db.execute('UPDATE empresas_perfis SET revisao = revisao + 1, atualizado_em = now() WHERE id = %s', (identifier,))
        return evidence(row)


@router.get('/{identifier}/documentos/{document_id}/arquivo')
def get_file(identifier: UUID, document_id: UUID, download: bool = False):
    with database() as db:
        row = db.execute('''SELECT a.conteudo FROM empresas_arquivos a JOIN empresas_documentos d ON d.id = a.documento_id
            WHERE d.id = %s AND d.empresa_id = %s AND d.excluido_em IS NULL''', (document_id, identifier)).fetchone()
        if not row:
            raise HTTPException(404, 'Arquivo não encontrado ou excluído.')
        return Response(bytes(row['conteudo']), media_type='application/pdf', headers={
            'Content-Disposition': f'{"attachment" if download else "inline"}; filename="documento-{document_id}.pdf"',
            'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
            'Content-Security-Policy': "sandbox; default-src 'none'", 'Referrer-Policy': 'no-referrer'})


@router.delete('/{identifier}/documentos/{document_id}', status_code=204)
def delete_document(identifier: UUID, document_id: UUID):
    with database() as db:
        company_row(db, identifier, lock=True)
        row = db.execute('''UPDATE empresas_documentos SET excluido_em = now()
            WHERE id = %s AND empresa_id = %s AND excluido_em IS NULL RETURNING id''', (document_id, identifier)).fetchone()
        if not row:
            raise HTTPException(404, 'Documento não encontrado ou já excluído.')
        db.execute('DELETE FROM empresas_arquivos WHERE documento_id = %s', (document_id,))
        db.execute('UPDATE empresas_perfis SET revisao = revisao + 1, atualizado_em = now() WHERE id = %s', (identifier,))


@router.get('/{identifier}/contexto-elegibilidade', response_model=EligibilityContext)
def eligibility_context(identifier: UUID, response: Response):
    response.headers['Cache-Control'] = 'private, no-store'
    with database() as db:
        # Snapshot coerente entre perfil, revisão e evidências enquanto há mutações.
        row = company_row(db, identifier, lock=True)
        return EligibilityContext(consultado_em=datetime.now(ZoneInfo('UTC')), empresa=company(db, row), documentos=documents(db, identifier),
            avisos=['Dados cadastrais e capacidades são declarações do usuário.',
                    'Envio, validade informada e presença de PDF não comprovam requisitos nem habilitação.',
                    'Nenhum documento foi verificado neste módulo. Referências exigem a mesma autorização.'])
