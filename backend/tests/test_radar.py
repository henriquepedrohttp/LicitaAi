import asyncio
import copy
import json
import unittest
from datetime import datetime, timezone
from io import BytesIO
from http.client import IncompleteRead
from unittest.mock import patch
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode

from fastapi import FastAPI

from app.radar import service
from app.radar.exceptions import PNCPError
from app.radar.pncp_client import PNCPClient
from app.radar.router import router
from app.radar.schemas import Search

# Fixtures exclusivamente de teste; nunca apresentadas como dados reais.
ID = "12345678000199-1-000123/2026"
NOW = datetime(2026, 11, 13, 12, tzinfo=timezone.utc)
RAW = {"numeroControlePNCP": ID, "orgaoEntidade": {"cnpj": "12345678000199", "razaoSocial": "Órgão de teste"},
       "unidadeOrgao": {"municipioNome": "Recife", "ufSigla": "PE"}, "anoCompra": 2026, "sequencialCompra": 123,
       "objetoCompra": "Desenvolvimento de software", "valorTotalEstimado": 100000.1234,
       "dataPublicacaoPncp": "2026-11-12T12:00:00", "situacaoCompraId": 1, "situacaoCompraNome": "Divulgada no PNCP"}
FILTERS = {"inicio": "2026-11-06", "fim": "2026-11-13"}


def envelope(rows=None, page=1):
    return {"data": [RAW] if rows is None else rows, "totalRegistros": 30, "totalPaginas": 2, "numeroPagina": page}


class ASGIClient:
    """Exercita HTTP/validação sem sockets ou threads; I/O PNCP permanece mockado."""
    def __init__(self, app):
        self.app = app

    def get(self, path, params=None):
        messages = []
        async def request():
            scope = {"type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1", "method": "GET",
                     "scheme": "http", "path": path, "raw_path": path.encode(), "root_path": "",
                     "query_string": urlencode(params or {}).encode(), "headers": [],
                     "client": ("test", 1), "server": ("test", 80)}
            async def receive():
                return {"type": "http.request", "body": b"", "more_body": False}
            async def send(message):
                messages.append(message)
            # O ambiente bloqueia wakeups entre threads; testar o mesmo handler inline.
            async def inline(func, *args, **kwargs):
                return func(*args, **kwargs)
            with patch("fastapi.routing.run_in_threadpool", inline):
                await self.app(scope, receive, send)
        asyncio.run(request())
        class Response:
            status_code = messages[0]["status"]
            def json(self):
                return json.loads(b"".join(m.get("body", b"") for m in messages))
        return Response()


class RadarTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.include_router(router)
        self.api = ASGIClient(app)
        self.mock = patch.object(service.client, "get").start()
        self.mock.return_value = (envelope(), NOW, "https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao")
        self.addCleanup(patch.stopall)

    def test_valid_query_normalization_and_provenance(self):
        result = self.api.get("/api/radar/oportunidades", params=FILTERS)
        self.assertEqual(result.status_code, 200)
        body = result.json()
        item = body["oportunidades"][0]
        self.assertEqual(item["id"], ID)
        self.assertEqual(item["orgao"], "Órgão de teste")
        self.assertEqual(item["valor_estimado"], "100000.1234")
        self.assertTrue(item["publicado_em"].endswith("-03:00"))
        self.assertTrue(item["url_oficial"].endswith("/2026/123"))
        self.assertEqual(body["total_fonte"], 30)
        self.assertEqual(body["cobertura"], "pagina")
        self.assertEqual(self.mock.call_args.args[1]["dataInicial"], "20261106")
        self.assertEqual(self.mock.call_args.args[1]["uf"], "PE")

    def test_pagination_forwarded_without_collecting_all(self):
        self.mock.return_value = (envelope(page=2), NOW, "https://pncp.gov.br")
        response = self.api.get("/api/radar/oportunidades", params={**FILTERS, "pagina": 2, "municipio": "2611606", "uf": ""})
        self.assertEqual(response.json()["pagina"], 2)
        self.mock.assert_called_once()
        params = self.mock.call_args.args[1]
        self.assertEqual(params["codigoMunicipioIbge"], "2611606")
        self.assertNotIn("uf", params)

    def test_invalid_parameters_never_call_pncp(self):
        cases = [{"pagina": 0}, {"modalidade": 14}, {"uf": "XX"}, {"municipio": "123"}, {"tamanho": 500},
                 {"fim": "2026-01-01"}, {"inicio": "2025-01-01"}, {"minimo": "-1"}, {"minimo": "NaN"},
                 {"minimo": "10", "maximo": "1"}, {"ordem": "arbitraria"}, {"inicio": "invalid"}, {"destino": "http://localhost"}]
        for case in cases:
            with self.subTest(case=case):
                self.assertEqual(self.api.get("/api/radar/oportunidades", params={**FILTERS, **case}).status_code, 422)
        self.mock.assert_not_called()

    def test_empty_and_no_content(self):
        for payload in (envelope([]), None):
            self.mock.return_value = (payload, NOW, "https://pncp.gov.br")
            response = self.api.get("/api/radar/oportunidades", params=FILTERS)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["oportunidades"], [])

    def test_invalid_response(self):
        for payload in ({}, [], {**envelope(), "data": "bad"}, envelope([{"numeroControlePNCP": "bad"}]), envelope(page=2)):
            self.mock.return_value = (payload, NOW, "https://pncp.gov.br")
            self.assertEqual(self.api.get("/api/radar/oportunidades", params=FILTERS).status_code, 502)

    def test_missing_fields_and_hidden_budget(self):
        self.mock.return_value = (envelope([{"numeroControlePNCP": ID, "valorTotalEstimado": 0}]), NOW, "https://pncp.gov.br")
        body = self.api.get("/api/radar/oportunidades", params=FILTERS).json()["oportunidades"][0]
        for key in ("objeto", "orgao", "publicado_em", "valor_estimado"):
            self.assertIsNone(body[key])

    def test_local_filters_do_not_change_source_totals(self):
        body = self.api.get("/api/radar/oportunidades", params={**FILTERS, "palavra": "inexistente"}).json()
        self.assertEqual(body["oportunidades"], [])
        self.assertEqual(body["total_fonte"], 30)
        self.assertEqual(body["total_paginas"], 2)
        self.assertEqual(body["registros_na_pagina"], 1)
        response = self.api.get("/api/radar/oportunidades", params={**FILTERS, "palavra": "SOFTWARE", "minimo": "100000", "situacao": "1"})
        self.assertEqual(len(response.json()["oportunidades"]), 1)
        self.assertNotIn("palavra", self.mock.call_args.args[1])

    def test_sort_and_missing_values_last(self):
        second, third = copy.deepcopy(RAW), copy.deepcopy(RAW)
        second.update(numeroControlePNCP=ID.replace("000123", "000124"), sequencialCompra=124, valorTotalEstimado=None, dataPublicacaoPncp=None)
        third.update(numeroControlePNCP=ID.replace("000123", "000125"), sequencialCompra=125, valorTotalEstimado=10, dataPublicacaoPncp="2026-11-13T09:00:00", dataEncerramentoProposta="2026-11-15T09:00:00")
        self.mock.return_value = (envelope([RAW, second, third]), NOW, "https://pncp.gov.br")
        for order, expected in (("maior", ID), ("menor", third["numeroControlePNCP"]), ("publicacao", third["numeroControlePNCP"]), ("prazo", third["numeroControlePNCP"])):
            body = self.api.get("/api/radar/oportunidades", params={**FILTERS, "ordem": order}).json()
            self.assertEqual(body["oportunidades"][0]["id"], expected)

    def test_identifier_validation_and_consistency(self):
        for value in ("bad", "12345678000199-2-000123/2026", "12345678000199-1-000000/2026"):
            self.assertEqual(self.api.get("/api/radar/oportunidades/" + value).status_code, 422)
        self.mock.assert_not_called()
        self.mock.return_value = (envelope([{**RAW, "anoCompra": 2025}]), NOW, "https://pncp.gov.br")
        self.assertEqual(self.api.get("/api/radar/oportunidades", params=FILTERS).status_code, 502)

    def test_details_documents_and_analysis_contract(self):
        self.mock.side_effect = [(RAW, NOW, "https://pncp.gov.br"), ([{"sequencialDocumento": 1, "titulo": "Edital de teste"}], NOW, "https://pncp.gov.br")]
        response = self.api.get("/api/radar/oportunidades/" + ID)
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertFalse(body["analise_disponivel"])
        self.assertTrue(body["encaminhamento"]["documentos_completos"])
        self.assertEqual(body["encaminhamento"]["oportunidade"]["id"], ID)
        self.assertIn("/arquivos/1", body["documentos"][0]["url"])
        self.assertIsNone(body["oportunidade"]["criterio_julgamento"])
        self.assertEqual(self.mock.call_args.kwargs, {"documents": True})

    def test_document_failure_preserves_metadata(self):
        for failure in (PNCPError("Timeout", 504), ({}, NOW, "https://pncp.gov.br")):
            self.mock.side_effect = [(RAW, NOW, "https://pncp.gov.br"), failure]
            body = self.api.get("/api/radar/oportunidades/" + ID).json()
            self.assertEqual(body["oportunidade"]["id"], ID)
            self.assertTrue(body["avisos"])
            self.assertIsNone(body["documentos_consultados_em"])

    def test_unsafe_document_url_not_exposed_or_fetched(self):
        for url in ("http://pncp.gov.br/file", "https://evil.example/file", "https://pncp.gov.br@127.0.0.1/file", "https://pncp.gov.br:444/file", "javascript:alert(1)"):
            self.mock.side_effect = [(RAW, NOW, "https://pncp.gov.br"), ([{"sequencialDocumento": 1, "url": url}], NOW, "https://pncp.gov.br")]
            body = self.api.get("/api/radar/oportunidades/" + ID).json()
            self.assertEqual(body["documentos"], [])
            self.assertTrue(body["avisos"])

    def test_not_found_and_external_failures(self):
        for code in (404, 502, 503, 504):
            self.mock.side_effect = PNCPError("Falha segura", code)
            response = self.api.get("/api/radar/oportunidades/" + ID)
            self.assertEqual(response.status_code, code)
            self.assertEqual(response.json()["detail"], "Falha segura")

    def test_document_pagination_and_incomplete_handoff(self):
        docs = [{"sequencialDocumento": i + 1} for i in range(20)]
        self.mock.side_effect = [(RAW, NOW, "https://pncp.gov.br"), (docs, NOW, "https://pncp.gov.br")]
        body = self.api.get("/api/radar/oportunidades/" + ID, params={"documentos_pagina": 2}).json()
        self.assertEqual(body["documentos_pagina"], 2)
        self.assertTrue(body["documentos_proxima_pagina"])
        self.assertFalse(body["encaminhamento"]["documentos_completos"])
        self.assertEqual(self.mock.call_args.args[1], {"pagina": 2, "tamanhoPagina": 20})
        self.assertEqual(self.api.get("/api/radar/oportunidades/" + ID, params={"documentos_pagina": 0}).status_code, 422)

    def test_wrong_detail_identity(self):
        self.mock.return_value = ({**RAW, "numeroControlePNCP": ID.replace("000123", "000124"), "sequencialCompra": 124}, NOW, "https://pncp.gov.br")
        self.assertEqual(self.api.get("/api/radar/oportunidades/" + ID).status_code, 502)


class Response(BytesIO):
    status = 200


class ClientTests(unittest.TestCase):
    def setUp(self):
        self.client = PNCPClient()
        self.mock = patch.object(self.client.opener, "open").start()
        patch("app.radar.pncp_client.time.sleep").start()
        self.addCleanup(patch.stopall)

    def test_cache_preserves_collection_time_and_encodes_query(self):
        self.mock.return_value = Response(json.dumps(envelope()).encode())
        first = self.client.get("/v1/contratacoes/publicacao", {"uf": "PE", "pagina": 1})
        second = self.client.get("/v1/contratacoes/publicacao", {"uf": "PE", "pagina": 1})
        self.assertEqual(first, second)
        self.mock.assert_called_once()
        self.assertEqual(self.mock.call_args.kwargs["timeout"], 30)
        self.assertIn("uf=PE&pagina=1", first[2])

    def test_cache_expires_and_is_bounded(self):
        self.mock.side_effect = lambda *a, **kw: Response(b"{}")
        with patch("app.radar.pncp_client.time.monotonic", return_value=0):
            self.client.get("/v1/test")
        with patch("app.radar.pncp_client.time.monotonic", return_value=61):
            self.client.get("/v1/test")
        self.assertEqual(self.mock.call_count, 2)
        for page in range(70):
            self.client.get("/v1/test", {"pagina": page})
        self.assertEqual(len(self.client.cache), 64)

    def test_timeout_and_connection_retry_are_bounded(self):
        for error, expected, calls in ((TimeoutError(), 504, 1), (URLError(TimeoutError()), 504, 1), (URLError("private infrastructure details"), 503, 2), (IncompleteRead(b"partial"), 503, 2)):
            self.mock.reset_mock()
            self.mock.side_effect = error
            with self.assertRaises(PNCPError) as caught:
                self.client.get("/v1/test")
            self.assertEqual(caught.exception.status, expected)
            self.assertNotIn("private", str(caught.exception))
            self.assertEqual(self.mock.call_count, calls)

    def test_http_errors_and_redirects(self):
        for code, expected, calls in ((404, 404, 1), (400, 502, 1), (422, 502, 1), (429, 503, 1), (500, 503, 2), (302, 503, 1), (403, 503, 1)):
            self.mock.reset_mock()
            self.mock.side_effect = HTTPError("https://pncp.gov.br", code, "error", {}, None)
            with self.assertRaises(PNCPError) as caught:
                self.client.get("/v1/test")
            self.assertEqual(caught.exception.status, expected)
            self.assertEqual(self.mock.call_count, calls)

    def test_invalid_json_and_payload_limit(self):
        for payload in (b"not json", b"x" * 5_000_001):
            self.mock.return_value = Response(payload)
            with self.assertRaises(PNCPError):
                self.client.get("/v1/test")
            self.assertFalse(self.client.cache)

    def test_no_content(self):
        response = Response(b"")
        response.status = 204
        self.mock.return_value = response
        self.assertIsNone(self.client.get("/v1/test")[0])

    def test_transient_error_then_success(self):
        self.mock.side_effect = [URLError("temporary connection failure"), Response(b"{}")]
        self.assertEqual(self.client.get("/v1/test")[0], {})
        self.assertEqual(self.mock.call_count, 2)


if __name__ == "__main__":
    unittest.main()
