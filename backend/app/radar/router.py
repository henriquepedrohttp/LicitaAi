from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

from . import service
from .exceptions import PNCPError
from .schemas import Detail, Results, Search

router = APIRouter(prefix="/api/radar/oportunidades", tags=["Radar"])


@router.get("", response_model=Results)
def opportunities(filters: Annotated[Search, Query()]):
    try:
        return service.search(filters)
    except PNCPError as error:
        raise HTTPException(status_code=error.status, detail=str(error)) from None


@router.get("/{official_id:path}", response_model=Detail)
def opportunity(official_id: str, documentos_pagina: Annotated[int, Query(ge=1, le=10000)] = 1):
    try:
        return service.detail(official_id, documentos_pagina)
    except PNCPError as error:
        raise HTTPException(status_code=error.status, detail=str(error)) from None
