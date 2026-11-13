"""Initial document workspace. Native extraction only; OCR remains explicit."""
import hashlib
import io
import os
from uuid import UUID, uuid4

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import Response
from pypdf import PdfReader

router = APIRouter(prefix="/documents", tags=["documents"])
MAX_BYTES = 20 * 1024 * 1024
MAX_PAGES = 200


def connect():
    url = os.getenv("DATABASE_URL")
    if not url:
        raise HTTPException(503, "Banco de dados não configurado.")
    try:
        connection = psycopg.connect(url, connect_timeout=3, row_factory=dict_row)
        with connection.cursor() as cursor:
            cursor.execute("""CREATE TABLE IF NOT EXISTS analysis_documents (
                id UUID PRIMARY KEY, filename TEXT NOT NULL,
                sha256 TEXT UNIQUE NOT NULL, content BYTEA NOT NULL,
                pages JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )""")
        connection.commit()
        return connection
    except psycopg.Error:
        raise HTTPException(503, "Não foi possível acessar o banco de dados.") from None


def summarize(row):
    pages = row["pages"]
    extracted = sum(page["status"] == "text_extracted" for page in pages)
    return {
        "id": str(row["id"]), "filename": row["filename"],
        "sha256": row["sha256"], "created_at": row["created_at"].isoformat(),
        "page_count": len(pages), "extracted_pages": extracted,
        "ocr_pending_pages": sum(page["status"] == "ocr_pending" for page in pages),
        "failed_pages": sum(page["status"] == "failed" for page in pages),
        "coverage": "partial" if extracted != len(pages) else "native_text_extracted",
    }


@router.get("")
def list_documents():
    with connect() as connection:
        rows = connection.execute("SELECT id, filename, sha256, pages, created_at FROM analysis_documents ORDER BY created_at DESC LIMIT 100").fetchall()
    return [summarize(row) for row in rows]


@router.post("", status_code=201)
def upload_document(file: UploadFile):
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(415, "Selecione um arquivo PDF.")
    content = file.file.read(MAX_BYTES + 1)
    if len(content) > MAX_BYTES:
        raise HTTPException(413, "O limite é de 20 MB por arquivo.")
    if not content.startswith(b"%PDF-"):
        raise HTTPException(415, "O conteúdo do arquivo não é um PDF válido.")
    digest = hashlib.sha256(content).hexdigest()
    try:
        reader = PdfReader(io.BytesIO(content))
        if reader.is_encrypted:
            raise HTTPException(422, "PDF protegido. Envie uma cópia sem senha.")
        count = len(reader.pages)
        if not 1 <= count <= MAX_PAGES:
            raise HTTPException(422, "Envie um PDF de 1 a 200 páginas nesta versão.")
        pages = []
        for number, page in enumerate(reader.pages, start=1):
            try:
                text = (page.extract_text() or "").strip()
                # A small amount of text may be a page number over a scanned image.
                usable = sum(character.isalnum() for character in text) >= 30
                pages.append({"page": number, "text": text, "method": "native",
                              "status": "text_extracted" if usable else "ocr_pending",
                              "warning": None if usable else "Texto ausente ou insuficiente. OCR ainda não executado; confira a página original."})
            except Exception:
                pages.append({"page": number, "text": "", "method": "native", "status": "failed",
                              "warning": "Falha na extração desta página. Revisão manual necessária."})
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(422, "Não foi possível ler o PDF. Verifique se está íntegro.") from None
    filename = (file.filename or "documento.pdf").replace("\\", "/").split("/")[-1][:200]
    with connect() as connection:
        row = connection.execute("""INSERT INTO analysis_documents (id,filename,sha256,content,pages)
            VALUES (%s,%s,%s,%s,%s) ON CONFLICT (sha256) DO UPDATE SET sha256=EXCLUDED.sha256
            RETURNING id,filename,sha256,pages,created_at""",
            (uuid4(), filename, digest, content, Jsonb(pages))).fetchone()
    return {**summarize(row), "pages": row["pages"]}


@router.get("/{document_id}")
def get_document(document_id: UUID):
    with connect() as connection:
        row = connection.execute("SELECT id,filename,sha256,pages,created_at FROM analysis_documents WHERE id=%s", (document_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Documento não encontrado.")
    return {**summarize(row), "pages": row["pages"]}


@router.get("/{document_id}/file")
def get_file(document_id: UUID):
    with connect() as connection:
        row = connection.execute("SELECT content FROM analysis_documents WHERE id=%s", (document_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Documento não encontrado.")
    return Response(bytes(row["content"]), media_type="application/pdf", headers={
        "Content-Disposition": 'inline; filename="documento.pdf"',
        "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
    })
