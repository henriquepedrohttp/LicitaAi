import re
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

OFFICIAL_ID = re.compile(r"([0-9]{14})-1-([0-9]{6})/([0-9]{4})")
UFS = set("AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split())


class Search(BaseModel):
    model_config = ConfigDict(extra="forbid")
    inicio: date
    fim: date
    modalidade: int = Field(default=6, ge=1, le=13)
    uf: str = "PE"
    municipio: str = Field(default="", pattern=r"^([0-9]{7})?$")
    pagina: int = Field(default=1, ge=1, le=100000)
    tamanho: int = Field(default=20, ge=10, le=50)
    palavra: str = Field(default="", max_length=200)
    situacao: Literal["", "1", "2", "3", "4"] = ""
    minimo: Decimal | None = Field(default=None, ge=0, allow_inf_nan=False)
    maximo: Decimal | None = Field(default=None, ge=0, allow_inf_nan=False)
    ordem: Literal["publicacao", "prazo", "maior", "menor"] = "publicacao"

    @model_validator(mode="after")
    def bounds(self):
        if self.uf and self.uf not in UFS:
            raise ValueError("UF inválida")
        if self.fim < self.inicio or (self.fim - self.inicio).days > 90:
            raise ValueError("Informe um período de publicação de até 90 dias, em ordem cronológica")
        if self.minimo is not None and self.maximo is not None and self.minimo > self.maximo:
            raise ValueError("O valor mínimo não pode superar o máximo")
        return self


class Document(BaseModel):
    id: int
    titulo: str | None = None
    tipo: str | None = None
    url: str
    publicado_em: datetime | None = None


class Opportunity(BaseModel):
    id: str
    fonte: Literal["PNCP"] = "PNCP"
    objeto: str | None = None
    orgao: str | None = None
    cnpj: str
    municipio: str | None = None
    uf: str | None = None
    modalidade: str | None = None
    numero: str | None = None
    ano: int
    valor_estimado: Decimal | None = None
    publicado_em: datetime | None = None
    abertura_em: datetime | None = None
    encerramento_em: datetime | None = None
    atualizado_em: datetime | None = None
    situacao: str | None = None
    situacao_id: int | None = None
    criterio_julgamento: str | None = None
    url_oficial: str
    url_api: str
    consultado_em: datetime


class AnalysisHandoff(BaseModel):
    versao: Literal["1"] = "1"
    oportunidade: Opportunity
    documentos: list[Document]
    documentos_completos: bool
    documentos_consultados_em: datetime | None
    referencias: list[str]


class Detail(BaseModel):
    oportunidade: Opportunity
    documentos: list[Document]
    documentos_pagina: int
    documentos_proxima_pagina: bool
    documentos_consultados_em: datetime | None = None
    avisos: list[str] = Field(default_factory=list)
    encaminhamento: AnalysisHandoff
    analise_disponivel: Literal[False] = False


class Results(BaseModel):
    oportunidades: list[Opportunity]
    pagina: int
    tamanho: int
    total_fonte: int
    total_paginas: int
    registros_na_pagina: int
    consultado_em: datetime
    url_fonte: str
    cobertura: Literal["pagina"] = "pagina"
    aviso: str = "Palavra-chave, situação, faixa de valor e ordenação aplicam-se apenas à página consultada, não a todos os resultados do PNCP."
