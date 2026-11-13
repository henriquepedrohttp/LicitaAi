from datetime import datetime
from decimal import Decimal
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

from pydantic import BaseModel, Field, ValidationError

from .exceptions import PNCPError
from .pncp_client import CONSULTA, client
from .schemas import AnalysisHandoff, Detail, Document, OFFICIAL_ID, Opportunity, Results, Search


class Agency(BaseModel):
    cnpj: str | None = None
    razaoSocial: str | None = None


class Unit(BaseModel):
    municipioNome: str | None = None
    ufSigla: str | None = None


class RawOpportunity(BaseModel):
    numeroControlePNCP: str
    objetoCompra: str | None = None
    orgaoEntidade: Agency | None = None
    unidadeOrgao: Unit | None = None
    modalidadeNome: str | None = None
    numeroCompra: str | None = None
    anoCompra: int | None = None
    sequencialCompra: int | None = None
    valorTotalEstimado: Decimal | None = Field(default=None, ge=0, allow_inf_nan=False)
    dataPublicacaoPncp: datetime | None = None
    dataAberturaProposta: datetime | None = None
    dataEncerramentoProposta: datetime | None = None
    dataAtualizacao: datetime | None = None
    situacaoCompraNome: str | None = None
    situacaoCompraId: int | None = None


class Envelope(BaseModel):
    data: list[RawOpportunity]
    totalRegistros: int = Field(ge=0)
    totalPaginas: int = Field(ge=0)
    numeroPagina: int = Field(ge=1)


class RawDocument(BaseModel):
    sequencialDocumento: int = Field(gt=0)
    titulo: str | None = None
    tipoDocumentoNome: str | None = None
    url: str | None = None
    dataPublicacaoPncp: datetime | None = None


def identifier(value: str):
    match = OFFICIAL_ID.fullmatch(value)
    if not match or int(match[2]) == 0 or not 2000 <= int(match[3]) <= 2100:
        raise PNCPError("Identificador PNCP inválido.", 422)
    return match[1], int(match[3]), int(match[2])


def brasilia(value: datetime | None):
    if value is None:
        return None
    return value.replace(tzinfo=ZoneInfo("America/Sao_Paulo")) if value.tzinfo is None else value


def normalize(raw: RawOpportunity, collected: datetime):
    try:
        cnpj, year, sequence = identifier(raw.numeroControlePNCP)
    except PNCPError:
        raise PNCPError("O PNCP retornou um identificador inválido.") from None
    if ((raw.orgaoEntidade and raw.orgaoEntidade.cnpj and raw.orgaoEntidade.cnpj != cnpj)
            or (raw.anoCompra is not None and raw.anoCompra != year)
            or (raw.sequencialCompra is not None and raw.sequencialCompra != sequence)):
        raise PNCPError("O PNCP retornou uma identificação inconsistente.")
    unit = raw.unidadeOrgao or Unit()
    return Opportunity(
        id=raw.numeroControlePNCP, objeto=raw.objetoCompra,
        orgao=raw.orgaoEntidade.razaoSocial if raw.orgaoEntidade else None,
        cnpj=cnpj, municipio=unit.municipioNome, uf=unit.ufSigla,
        modalidade=raw.modalidadeNome, numero=raw.numeroCompra, ano=year,
        # shortcut: zero pode ocultar orçamento sigiloso, só exibir como valor quando positivo.
        valor_estimado=raw.valorTotalEstimado if raw.valorTotalEstimado else None,
        publicado_em=brasilia(raw.dataPublicacaoPncp), abertura_em=brasilia(raw.dataAberturaProposta),
        encerramento_em=brasilia(raw.dataEncerramentoProposta), atualizado_em=brasilia(raw.dataAtualizacao),
        situacao=raw.situacaoCompraNome, situacao_id=raw.situacaoCompraId,
        url_oficial=f"https://pncp.gov.br/app/editais/{cnpj}/{year}/{sequence}",
        url_api=f"{CONSULTA}/v1/orgaos/{cnpj}/compras/{year}/{sequence}", consultado_em=collected,
    )


def search(filters: Search) -> Results:
    params = {"dataInicial": filters.inicio.strftime("%Y%m%d"), "dataFinal": filters.fim.strftime("%Y%m%d"),
              "codigoModalidadeContratacao": filters.modalidade, "pagina": filters.pagina, "tamanhoPagina": filters.tamanho}
    if filters.uf:
        params["uf"] = filters.uf
    if filters.municipio:
        params["codigoMunicipioIbge"] = filters.municipio
    payload, collected, url = client.get("/v1/contratacoes/publicacao", params)
    if payload is None:
        return Results(oportunidades=[], pagina=filters.pagina, tamanho=filters.tamanho, total_fonte=0,
                       total_paginas=0, registros_na_pagina=0, consultado_em=collected, url_fonte=url)
    try:
        page = Envelope.model_validate(payload)
        if page.numeroPagina != filters.pagina or len(page.data) > filters.tamanho:
            raise PNCPError("O PNCP retornou paginação inconsistente.")
        items = [normalize(raw, collected) for raw in page.data]
    except ValidationError:
        raise PNCPError("O PNCP retornou uma estrutura inesperada. Tente novamente.") from None
    count = len(items)
    word = filters.palavra.strip().casefold()
    items = [item for item in items if (
        (not word or word in " ".join((item.objeto or "", item.orgao or "", item.numero or "")).casefold())
        and (not filters.situacao or item.situacao_id == int(filters.situacao))
        and (filters.minimo is None or item.valor_estimado is not None and item.valor_estimado >= filters.minimo)
        and (filters.maximo is None or item.valor_estimado is not None and item.valor_estimado <= filters.maximo)
    )]
    if filters.ordem == "publicacao":
        items.sort(key=lambda item: (item.publicado_em is None, -(item.publicado_em.timestamp() if item.publicado_em else 0)))
    elif filters.ordem == "prazo":
        items.sort(key=lambda item: (item.encerramento_em is None, item.encerramento_em.timestamp() if item.encerramento_em else 0))
    else:
        direction = -1 if filters.ordem == "maior" else 1
        items.sort(key=lambda item: (item.valor_estimado is None, direction * (item.valor_estimado or 0)))
    return Results(oportunidades=items, pagina=page.numeroPagina, tamanho=filters.tamanho,
                   total_fonte=page.totalRegistros, total_paginas=page.totalPaginas, registros_na_pagina=count,
                   consultado_em=collected, url_fonte=url)


def detail(official_id: str, documents_page: int = 1) -> Detail:
    cnpj, year, sequence = identifier(official_id)
    path = f"/v1/orgaos/{cnpj}/compras/{year}/{sequence}"
    payload, collected, _ = client.get(path)
    if payload is None:
        raise PNCPError("Oportunidade indisponível no PNCP.", 404)
    try:
        opportunity = normalize(RawOpportunity.model_validate(payload), collected)
    except ValidationError:
        raise PNCPError("O PNCP retornou uma estrutura inesperada.") from None
    if opportunity.id != official_id:
        raise PNCPError("O PNCP retornou uma oportunidade diferente da solicitada.")
    documents, warnings, docs_collected = [], [], None
    next_documents = False
    try:
        raw_documents, docs_collected, _ = client.get(path + "/arquivos", {"pagina": documents_page, "tamanhoPagina": 20}, documents=True)
        if raw_documents is None:
            raw_documents = []
        if not isinstance(raw_documents, list) or len(raw_documents) > 20:
            raise PNCPError("A lista de documentos retornada pelo PNCP é inválida.")
        # shortcut: sem total oficial, uma página cheia permite consultar a próxima, que pode estar vazia.
        next_documents = len(raw_documents) == 20
        for item in raw_documents:
            doc = RawDocument.model_validate(item)
            url = f"https://pncp.gov.br/api/pncp{path}/arquivos/{doc.sequencialDocumento}"
            if doc.url:
                parsed = urlsplit(doc.url)
                if (parsed.scheme != "https" or parsed.hostname != "pncp.gov.br"
                        or parsed.port not in (None, 443) or parsed.username or parsed.password):
                    warnings.append("Um documento trouxe endereço externo não validado. Consulte a fonte oficial.")
                    continue
                url = doc.url
            documents.append(Document(id=doc.sequencialDocumento, titulo=doc.titulo, tipo=doc.tipoDocumentoNome,
                                      url=url, publicado_em=brasilia(doc.dataPublicacaoPncp)))
    except (PNCPError, ValidationError, ValueError):
        documents, docs_collected, next_documents = [], None, False
        warnings.append("Não foi possível consultar os documentos. Tente novamente ou consulte a fonte oficial.")
    return Detail(oportunidade=opportunity, documentos=documents, avisos=warnings,
                  documentos_pagina=documents_page, documentos_proxima_pagina=next_documents,
                  documentos_consultados_em=docs_collected,
                  encaminhamento=AnalysisHandoff(oportunidade=opportunity, documentos=documents,
                      documentos_completos=documents_page == 1 and not next_documents and not warnings,
                      documentos_consultados_em=docs_collected,
                      referencias=[opportunity.url_oficial, opportunity.url_api,
                          f"https://pncp.gov.br/api/pncp{path}/arquivos"]))
