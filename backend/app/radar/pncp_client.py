import json
import time
from collections import OrderedDict
from datetime import datetime, timezone
from http.client import HTTPException
from threading import Lock
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, Request, build_opener

from .exceptions import PNCPError

CONSULTA = "https://pncp.gov.br/api/consulta"
DOCUMENTOS = "https://pncp.gov.br/api/pncp"


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class PNCPClient:
    # shortcut: cache por processo por 60s, adotar cache compartilhado se houver múltiplas réplicas.
    def __init__(self):
        self.cache = OrderedDict()
        self.lock = Lock()
        self.opener = build_opener(NoRedirect())

    def get(self, path: str, params: dict | None = None, *, documents=False):
        base = DOCUMENTOS if documents else CONSULTA
        url = base + path + ("?" + urlencode(params) if params else "")
        with self.lock:
            cached = self.cache.get(url)
            if cached and time.monotonic() - cached[0] < 60:
                return cached[1], cached[2], url
        for attempt in range(2):
            try:
                request = Request(url, headers={"Accept": "application/json", "User-Agent": "LicitaAI-Radar/1.0"})
                with self.opener.open(request, timeout=30) as response:
                    if response.status == 204:
                        payload = None
                    else:
                        raw = response.read(5_000_001)
                        if len(raw) > 5_000_000:
                            raise PNCPError("A resposta do PNCP excedeu o limite. Reduza o período da pesquisa.")
                        payload = json.loads(raw)
                collected = datetime.now(timezone.utc)
                with self.lock:
                    self.cache[url] = (time.monotonic(), payload, collected)
                    self.cache.move_to_end(url)
                    if len(self.cache) > 64:
                        self.cache.popitem(last=False)
                return payload, collected, url
            except HTTPError as error:
                error.close()
                if error.code == 404:
                    raise PNCPError("Oportunidade ou recurso indisponível no PNCP.", 404) from None
                if error.code in (400, 422):
                    raise PNCPError("O PNCP recusou os parâmetros. Revise os filtros.", 502) from None
                if error.code == 429:
                    raise PNCPError("O PNCP limitou as consultas. Aguarde um minuto e tente novamente.", 503) from None
                if error.code < 500 or attempt:
                    raise PNCPError("O PNCP está indisponível. Tente novamente em instantes.", 503) from None
            except TimeoutError:
                raise PNCPError("O PNCP demorou a responder. Reduza o período da consulta ou tente novamente.", 504) from None
            except URLError as error:
                if isinstance(error.reason, TimeoutError):
                    raise PNCPError("O PNCP demorou a responder. Reduza o período da consulta ou tente novamente.", 504) from None
                if attempt:
                    raise PNCPError("Não foi possível conectar ao PNCP. Tente novamente.", 503) from None
            except (OSError, HTTPException):
                if attempt:
                    raise PNCPError("Não foi possível conectar ao PNCP. Tente novamente.", 503) from None
            except (ValueError, UnicodeError):
                raise PNCPError("O PNCP retornou uma resposta inválida. Tente novamente.") from None
            time.sleep(0.3)
        raise PNCPError("PNCP indisponível.", 503)


client = PNCPClient()
