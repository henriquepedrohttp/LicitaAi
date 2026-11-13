"""Contratos da Elegibilidade: entrada (Análise + Empresas), revisão humana e saída para Relatórios."""
from datetime import date, datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

Estado = Literal['atendido_preliminarmente', 'nao_atendido', 'nao_verificado', 'revisao_especializada']
Categoria = Literal['habilitacao_juridica', 'qualificacao_tecnica', 'fiscal_social_trabalhista',
                    'economico_financeira', 'obrigacao_operacional', 'contratual', 'nao_classificada']
Criticidade = Literal['alta', 'media', 'baixa']
Texto = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=2000)]


# ---- Entrada: espelhos mínimos dos contratos existentes; campos extras são ignorados ----

class FonteAnalise(BaseModel):
    document_id: UUID
    filename: str
    sha256: str
    page: int | None
    excerpt: str
    verified: bool


class RequisitoAnalise(BaseModel):
    """Item de `GET /documents/{id}/requirements` (módulo Análise)."""
    id: UUID
    title: str
    category: str  # preservada como categoria original
    source: FonteAnalise
    review_status: str
    version: int


class DocumentoEmpresa(BaseModel):
    """Item `documentos` de `empresas.elegibilidade.v1`."""
    id: UUID
    empresa_id: UUID
    versao: int
    titulo: str
    tipo: str
    validade: date | None
    excluido_em: datetime | None
    sha256: str
    atual: bool
    vencido: bool


class EmpresaContexto(BaseModel):
    id: UUID
    razao_social: str
    cnpj: str
    revisao: int
    capacidades: list[str] = []


class ContextoEmpresa(BaseModel):
    contrato: Literal['empresas.elegibilidade.v1']
    consultado_em: datetime
    empresa: EmpresaContexto
    documentos: list[DocumentoEmpresa]


# ---- Avaliação ----

class Evidencia(BaseModel):
    documento_id: UUID
    titulo: str
    tipo: str
    versao: int
    sha256: str
    validade: date | None
    vencido: bool
    origem: Literal['sugerida_por_regra', 'associada_por_analista']


class Quantidade(BaseModel):
    valor: str
    unidade: str
    texto: str


class ResultadoAutomatico(BaseModel):
    estado: Estado
    justificativa: str
    regra: str
    metodo: Literal['regra_deterministica', 'encaminhamento_revisao_humana']
    evidencias: list[Evidencia]
    incertezas: list[str]
    quantidades: list[Quantidade]
    declaracoes_relacionadas: list[str]  # capacidades declaradas; nunca são evidência


class NovaAvaliacao(BaseModel):
    model_config = ConfigDict(extra='forbid')
    documento_id: UUID
    empresa_id: UUID
    oportunidade_pncp: str | None = Field(default=None, pattern=r'^[0-9]{14}-1-[0-9]{6}/[0-9]{4}$')


class Revisao(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    acao: Literal['confirmar', 'corrigir', 'revisao_especializada', 'observacao', 'evidencias', 'criticidade']
    autor: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=100)]
    justificativa: Texto
    estado: Estado | None = None
    evidencias: list[UUID] | None = Field(default=None, max_length=20)
    criticidade: Criticidade | None = None
    versao_esperada: int = Field(ge=1)


class Item(BaseModel):
    id: UUID
    requisito: RequisitoAnalise
    categoria: Categoria
    categoria_original: str
    estado: Estado
    origem_estado: Literal['automatico', 'humano']
    justificativa: str
    evidencias: list[Evidencia]
    criticidade: Criticidade | None
    observacoes: list[dict]
    automatico: ResultadoAutomatico
    revisado: bool
    reconferir: str | None
    versao: int
    historico: list[dict]


class Avaliacao(BaseModel):
    id: UUID
    documento_id: UUID
    documento_nome: str
    documento_sha256: str
    oportunidade_pncp: str | None
    empresa_id: UUID
    empresa_nome: str
    empresa_cnpj: str
    empresa_revisao: int
    criada_em: datetime
    atualizada_em: datetime
    processamento: Literal['concluido', 'sem_requisitos']
    requisitos_excluidos: int
    avisos: list[str]
    itens: list[Item]


# ---- Saída para Relatórios ----

class ItemRelatorio(BaseModel):
    requisito_id: UUID
    requisito_versao: int
    titulo: str
    categoria: Categoria
    fonte: FonteAnalise
    estado: Estado
    origem_estado: Literal['automatico', 'humano']
    justificativa: str
    evidencias: list[Evidencia]
    criticidade: Criticidade | None
    ultima_revisao_humana: dict | None
    pendente: bool
    reconferir: str | None


class Relatorio(BaseModel):
    contrato: Literal['elegibilidade.relatorios.v1'] = 'elegibilidade.relatorios.v1'
    avaliacao_id: UUID
    gerado_em: datetime
    documento_id: UUID
    documento_sha256: str
    oportunidade_pncp: str | None
    empresa_id: UUID
    empresa_revisao: int
    estado_geral: Literal['sem_requisitos', 'revisao_incompleta', 'revisada_com_pendencias', 'revisada_sem_pendencias']
    resumo: dict[str, int]
    itens: list[ItemRelatorio]
    pendencias: list[ItemRelatorio]
    habilitacao_declarada: Literal[False] = False
    avisos: list[str]
