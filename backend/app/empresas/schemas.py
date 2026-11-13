import re
from datetime import date, datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

Text = Annotated[str, StringConstraints(strip_whitespace=True, max_length=5000)]
Short = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]
Item = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]
UF = Literal['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']
DocumentType = Literal['juridico', 'fiscal_trabalhista', 'atestado_tecnico', 'economico_financeiro', 'outro']


class Profile(BaseModel):
    model_config = ConfigDict(extra='forbid')
    razao_social: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=200)]
    nome_fantasia: Short | None = None
    cnpj: str
    porte: Literal['MEI', 'ME', 'EPP', 'demais'] | None = None
    cnae_principal: str | None = None
    cnaes_secundarios: list[str] = Field(default_factory=list, max_length=50)
    municipio: Short | None = None
    uf: UF | None = None
    segmento: Short | None = None
    produtos_servicos: Text | None = None
    areas_atuacao: list[Item] = Field(default_factory=list, max_length=50)
    capacidades: list[Item] = Field(default_factory=list, max_length=50)
    experiencia: Text | None = None
    projetos: Text | None = None
    tecnologias: list[Item] = Field(default_factory=list, max_length=50)

    @field_validator('cnpj')
    @classmethod
    def validate_cnpj(cls, value):
        value = value.strip().upper()
        if not re.fullmatch(r'(?:[A-Z0-9]{12}[0-9]{2}|[A-Z0-9]{2}\.[A-Z0-9]{3}\.[A-Z0-9]{3}/[A-Z0-9]{4}-[0-9]{2})', value):
            raise ValueError('Informe CNPJ com 14 caracteres, com ou sem pontuação.')
        digits = re.sub(r'[./-]', '', value)
        if len(set(digits)) == 1:
            raise ValueError('CNPJ inválido.')
        for length in (12, 13):
            weights = ([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] if length == 12 else [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
            remainder = sum((ord(n) - 48) * w for n, w in zip(digits[:length], weights)) % 11
            if int(digits[length]) != (0 if remainder < 2 else 11 - remainder):
                raise ValueError('Dígitos verificadores do CNPJ inválidos.')
        return digits

    @field_validator('cnae_principal')
    @classmethod
    def validate_cnae(cls, value):
        if value is not None and not re.fullmatch(r'[0-9]{7}', value):
            raise ValueError('CNAE deve conter sete dígitos sem pontuação.')
        return value

    @field_validator('cnaes_secundarios')
    @classmethod
    def validate_cnaes(cls, values):
        return [cls.validate_cnae(value) for value in values]


class Update(Profile):
    revisao: int = Field(ge=1)


class Company(Profile):
    id: UUID
    revisao: int
    criado_em: datetime
    atualizado_em: datetime
    documentos_quantidade: int
    campos_pendentes: list[str]
    preenchimento: Literal['parcial', 'campos_preenchidos']
    origem: Literal['declarado'] = 'declarado'


class Evidence(BaseModel):
    id: UUID
    empresa_id: UUID
    anterior_id: UUID | None
    versao: int
    titulo: str
    tipo: DocumentType
    validade: date | None
    enviado_em: datetime
    excluido_em: datetime | None
    tamanho: int
    sha256: str
    atual: bool
    vencido: bool
    verificacao: Literal['nao_verificado'] = 'nao_verificado'
    referencia: str


class EligibilityContext(BaseModel):
    contrato: Literal['empresas.elegibilidade.v1'] = 'empresas.elegibilidade.v1'
    consultado_em: datetime
    empresa: Company
    declaracoes_verificadas: Literal[False] = False
    documentos: list[Evidence]
    avisos: list[str]
