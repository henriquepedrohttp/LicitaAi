-- Tabelas exclusivas de Elegibilidade. IDs de Análise e Empresas são referências sem FK:
-- os módulos têm ciclos de migração independentes e os hashes/revisões registram a versão usada.
CREATE TABLE elegibilidade_avaliacoes (
    id uuid PRIMARY KEY,
    documento_id uuid NOT NULL,
    documento_nome text NOT NULL,
    documento_sha256 varchar(64) NOT NULL,
    oportunidade_pncp varchar(32),
    empresa_id uuid NOT NULL,
    empresa_nome text NOT NULL,
    empresa_cnpj varchar(14) NOT NULL,
    empresa_revisao integer NOT NULL,
    requisitos_excluidos integer NOT NULL DEFAULT 0,
    avisos jsonb NOT NULL DEFAULT '[]',
    criada_em timestamptz NOT NULL DEFAULT now(),
    atualizada_em timestamptz NOT NULL DEFAULT now(),
    UNIQUE (documento_id, empresa_id)
);
CREATE TABLE elegibilidade_itens (
    id uuid PRIMARY KEY,
    avaliacao_id uuid NOT NULL REFERENCES elegibilidade_avaliacoes(id),
    requisito_id uuid NOT NULL,
    requisito jsonb NOT NULL,
    categoria text NOT NULL,
    automatico jsonb NOT NULL,
    estado text NOT NULL CHECK (estado IN ('atendido_preliminarmente','nao_atendido','nao_verificado','revisao_especializada')),
    origem_estado text NOT NULL CHECK (origem_estado IN ('automatico','humano')),
    justificativa text NOT NULL,
    evidencias jsonb NOT NULL DEFAULT '[]',
    criticidade text CHECK (criticidade IN ('alta','media','baixa')),
    observacoes jsonb NOT NULL DEFAULT '[]',
    revisado boolean NOT NULL DEFAULT false,
    reconferir text,
    versao integer NOT NULL DEFAULT 1 CHECK (versao > 0),
    historico jsonb NOT NULL,
    UNIQUE (avaliacao_id, requisito_id)
);
CREATE INDEX elegibilidade_itens_avaliacao ON elegibilidade_itens(avaliacao_id);
