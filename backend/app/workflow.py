"""Resumable whole-document analysis, with a human gate between stages."""
import hashlib
import json
import logging
import os
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from psycopg.types.json import Jsonb

from app.documents import connect
from app.requirements import (Stage, document_row, initialize, insert_requirement,
                              verified_excerpt, extract_pages_with_openrouter)

router = APIRouter(prefix="/documents", tags=["analysis-workflow"])


class Start(BaseModel):
    model_config = ConfigDict(extra="forbid")
    stage: Stage


class Approval(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    author: str = Field(min_length=2, max_length=100)
    reason: str = Field(min_length=3, max_length=2000)
    expected_snapshot: str


def setup(connection):
    initialize(connection)
    connection.execute("""CREATE TABLE IF NOT EXISTS document_stage_runs (
        document_id UUID REFERENCES analysis_documents(id) ON DELETE CASCADE,
        stage TEXT NOT NULL, page INTEGER NOT NULL, model TEXT NOT NULL,
        requirement_count INTEGER NOT NULL, PRIMARY KEY(document_id,stage,page))""")
    connection.execute("""CREATE TABLE IF NOT EXISTS document_stage_jobs (
        document_id UUID REFERENCES analysis_documents(id) ON DELETE CASCADE,
        stage TEXT NOT NULL, status TEXT NOT NULL, current_page INTEGER,
        error TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY(document_id,stage))""")
    connection.execute("ALTER TABLE document_stage_jobs ADD COLUMN IF NOT EXISTS current_page_end INTEGER")
    connection.execute("""CREATE TABLE IF NOT EXISTS conformity_approvals (
        id BIGSERIAL PRIMARY KEY, document_id UUID REFERENCES analysis_documents(id) ON DELETE CASCADE,
        snapshot TEXT NOT NULL, author TEXT NOT NULL, reason TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now())""")


def state(connection, document_id):
    document = document_row(connection, document_id)
    runs = connection.execute("SELECT stage,page FROM document_stage_runs WHERE document_id=%s ORDER BY stage,page", (document_id,)).fetchall()
    items = connection.execute("SELECT id,version,review_status FROM analysis_requirements WHERE document_id=%s AND stage='conformity' ORDER BY id", (document_id,)).fetchall()
    conformity_pages = [row['page'] for row in runs if row['stage'] == 'conformity']
    snapshot = hashlib.sha256(json.dumps({'sha256': document['sha256'], 'runs': conformity_pages,
                                         'items': items}, default=str, sort_keys=True).encode()).hexdigest()
    blocked = [page['page'] for page in document['pages'] if page['status'] != 'text_extracted' or len(page['text']) > 30000]
    complete = not blocked and len(conformity_pages) == len(document['pages'])
    unresolved = sum(item['review_status'] not in ('confirmed', 'corrected', 'rejected') for item in items)
    approval = connection.execute("SELECT author,reason,created_at,snapshot FROM conformity_approvals WHERE document_id=%s ORDER BY id DESC LIMIT 1", (document_id,)).fetchone()
    approved = bool(complete and not unresolved and approval and approval['snapshot'] == snapshot)
    jobs = connection.execute("SELECT stage,status,current_page,current_page_end,error,updated_at FROM document_stage_jobs WHERE document_id=%s", (document_id,)).fetchall()
    return {'total_pages': len(document['pages']), 'blocked_pages': blocked,
            'stages': {stage: {'processed_pages': sum(row['stage'] == stage for row in runs),
                              'job': next((job for job in jobs if job['stage'] == stage), None)}
                       for stage in ('conformity', 'technical')},
            'batch_pages': batch_page_limit(), 'snapshot': snapshot, 'unresolved': unresolved, 'conformity_complete': complete,
            'conformity_approved': approved, 'approval': approval if approved else None}


@router.get('/{document_id}/analysis')
def get_analysis(document_id: UUID):
    with connect() as connection:
        setup(connection)
        return state(connection, document_id)


@router.post('/{document_id}/analysis/approve')
def approve(document_id: UUID, request: Approval):
    with connect() as connection:
        setup(connection)
        # Creation/review of requirements takes this same row lock.
        connection.execute('SELECT id FROM analysis_documents WHERE id=%s FOR UPDATE', (document_id,))
        current = state(connection, document_id)
        if request.expected_snapshot != current['snapshot']:
            raise HTTPException(409, 'A análise mudou. Atualize os requisitos antes de validar.')
        if not current['conformity_complete'] or current['unresolved']:
            raise HTTPException(409, 'Conclua a análise de todas as páginas e revise os requisitos de conformidade antes de validar.')
        connection.execute('INSERT INTO conformity_approvals (document_id,snapshot,author,reason) VALUES (%s,%s,%s,%s)',
                           (document_id, current['snapshot'], request.author, request.reason))
        return state(connection, document_id)


@router.post('/{document_id}/analysis', status_code=202)
def start_analysis(document_id: UUID, request: Start, tasks: BackgroundTasks):
    with connect() as connection:
        setup(connection)
        current = state(connection, document_id)
        if request.stage == 'technical' and not current['conformity_approved']:
            raise HTTPException(409, 'Valide primeiro a etapa de documentação e conformidade.')
        if not os.getenv('OPENROUTER_API_KEY'):
            raise HTTPException(503, 'Configure OPENROUTER_API_KEY no backend.')
    # A session advisory lock in the worker prevents parallel or duplicate charges.
    tasks.add_task(run_stage, document_id, request.stage)
    return {'stage': request.stage, 'status': 'requested'}


def update_job(connection, document_id, stage, status, page=None, error=None, page_end=None):
    connection.execute('''INSERT INTO document_stage_jobs (document_id,stage,status,current_page,error,current_page_end)
        VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT(document_id,stage) DO UPDATE SET
        status=EXCLUDED.status,current_page=EXCLUDED.current_page,error=EXCLUDED.error,current_page_end=EXCLUDED.current_page_end,updated_at=now()''',
        (document_id, stage, status, page, error, page_end))


def batch_page_limit():
    try:
        return max(1, min(8, int(os.getenv("ANALYSIS_BATCH_PAGES", "4"))))
    except ValueError:
        return 4


def page_batches(pages, completed):
    """Bound both page count and input size; never re-send completed pages."""
    batch, size = [], 0
    for page in pages:
        if page['page'] in completed or page['status'] != 'text_extracted' or len(page['text']) > 30000:
            continue
        if batch and (len(batch) >= batch_page_limit() or size + len(page['text']) > 24000):
            yield batch
            batch, size = [], 0
        batch.append({'page': page['page'], 'text': page['text']})
        size += len(page['text'])
    if batch:
        yield batch


def run_stage(document_id, stage):
    """Bounded page batches; successful pages are durable and skipped on resume.

    This prototype runs inside the API process. After a restart the user can resume;
    no automatic retry or external queue is implied.
    """
    with connect() as lock_connection:
        setup(lock_connection)
        lock_id = int.from_bytes(hashlib.sha256(str(document_id).encode()).digest()[:8], 'big', signed=True)
        locked = lock_connection.execute('SELECT pg_try_advisory_lock(%s) AS locked', (lock_id,)).fetchone()['locked']
        lock_connection.commit()
        if not locked:
            return
        number = None
        try:
            with connect() as connection:
                document = document_row(connection, document_id)
                update_job(connection, document_id, stage, 'running')
            blocked = [page['page'] for page in document['pages']
                       if page['status'] != 'text_extracted' or len(page['text']) > 30000]
            with connect() as connection:
                completed = {row['page'] for row in connection.execute(
                    'SELECT page FROM document_stage_runs WHERE document_id=%s AND stage=%s',
                    (document_id, stage)).fetchall()}
            for batch in page_batches(document['pages'], completed):
                number, page_end = batch[0]['page'], batch[-1]['page']
                with connect() as connection:
                    if stage == 'technical' and not state(connection, document_id)['conformity_approved']:
                        raise HTTPException(409, 'Validação de conformidade ausente ou alterada. Valide novamente antes de continuar.')
                    update_job(connection, document_id, stage, 'running', number, page_end=page_end)
                by_page, model = extract_pages_with_openrouter(batch, stage=stage)
                if set(by_page) != {page['page'] for page in batch}:
                    raise HTTPException(502, 'A IA não retornou todas as páginas do lote. Nenhuma página deste lote foi salva.')
                # Validate every citation before saving the whole batch atomically.
                for page in batch:
                    for candidate in by_page[page['page']]:
                        verified_excerpt(page['text'], candidate.excerpt)
                with connect() as connection:
                    connection.execute('SELECT id FROM analysis_documents WHERE id=%s FOR UPDATE', (document_id,))
                    if stage == 'technical' and not state(connection, document_id)['conformity_approved']:
                        raise HTTPException(409, 'A conformidade mudou durante a extração. Valide novamente.')
                    for page in batch:
                        count = 0
                        for candidate in by_page[page['page']]:
                            if insert_requirement(connection, document, page['page'], candidate, 'ai', model, stage=stage):
                                count += 1
                        connection.execute('INSERT INTO document_stage_runs (document_id,stage,page,model,requirement_count) VALUES (%s,%s,%s,%s,%s)',
                                           (document_id, stage, page['page'], model, count))
            with connect() as connection:
                update_job(connection, document_id, stage, 'partial' if blocked else 'completed',
                           error='Há páginas sem texto utilizável ou acima do limite. A análise está incompleta.' if blocked else None)
        except Exception as error:
            logging.getLogger(__name__).exception('Document analysis failed: stage=%s', stage)
            with connect() as connection:
                update_job(connection, document_id, stage, 'failed', page=number, error=error.detail if isinstance(error, HTTPException) else 'Falha no processamento. As páginas concluídas foram preservadas; retome a análise.')
        finally:
            lock_connection.execute('SELECT pg_advisory_unlock(%s)', (lock_id,))
            lock_connection.commit()
