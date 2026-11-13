"""Integration checks against a running local API and PostgreSQL.
Run: backend/.venv/bin/python -m unittest discover -s backend/tests -v
"""
import io
import json
import os
import unittest
import uuid
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from pypdf import PdfWriter
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

BASE = os.getenv("TEST_API_URL", "http://127.0.0.1:8000")


def upload(content, filename="test.pdf"):
    boundary = "----" + uuid.uuid4().hex
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{filename}"\r\nContent-Type: application/pdf\r\n\r\n'.encode()
            + content + f'\r\n--{boundary}--\r\n'.encode())
    return urlopen(Request(BASE + "/documents", data=body, headers={"Content-Type": "multipart/form-data; boundary=" + boundary}))


class DocumentTests(unittest.TestCase):
    def test_blank_pdf_is_partial_and_duplicate_is_reused(self):
        writer = PdfWriter()
        writer.add_blank_page(width=200, height=200)
        writer.add_metadata({"/Test": uuid.uuid4().hex})
        stream = io.BytesIO()
        writer.write(stream)
        content = stream.getvalue()
        document = json.load(upload(content))
        try:
            self.assertEqual(document["coverage"], "partial")
            self.assertEqual(document["extracted_pages"], 0)
            self.assertEqual(document["ocr_pending_pages"], 1)
            self.assertEqual(document["pages"][0]["page"], 1)
            self.assertEqual(document["pages"][0]["status"], "ocr_pending")
            duplicate = json.load(upload(content))
            self.assertEqual(duplicate["id"], document["id"])
            self.assertEqual(urlopen(BASE + "/documents/" + document["id"] + "/file").read(), content)
            persisted = json.load(urlopen(BASE + "/documents/" + document["id"]))
            self.assertEqual(persisted["pages"], document["pages"])
        finally:
            # Remove only the row created by this test; never reset the database.
            from app.documents import connect
            with connect() as connection:
                connection.execute("DELETE FROM analysis_documents WHERE id=%s", (document["id"],))

    def test_invalid_content_rejected(self):
        with self.assertRaises(HTTPError) as raised:
            upload(b"not a pdf")
        self.assertEqual(raised.exception.code, 415)

    def test_corrupt_pdf_rejected(self):
        with self.assertRaises(HTTPError) as raised:
            upload(b"%PDF-broken")
        self.assertEqual(raised.exception.code, 422)

    def test_missing_document(self):
        with self.assertRaises(HTTPError) as raised:
            urlopen(BASE + "/documents/" + str(uuid.uuid4()))
        self.assertEqual(raised.exception.code, 404)

    def test_encrypted_pdf_rejected(self):
        writer=PdfWriter()
        writer.add_blank_page(width=200,height=200)
        writer.encrypt("test-password")
        stream=io.BytesIO()
        writer.write(stream)
        with self.assertRaises(HTTPError) as raised:
            upload(stream.getvalue())
        self.assertEqual(raised.exception.code, 422)


if __name__ == "__main__":
    unittest.main()
