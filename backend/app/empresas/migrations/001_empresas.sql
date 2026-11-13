CREATE TABLE empresas_perfis (
    id uuid PRIMARY KEY,
    cnpj varchar(14) NOT NULL UNIQUE,
    perfil jsonb NOT NULL,
    revisao integer NOT NULL DEFAULT 1 CHECK (revisao > 0),
    criado_em timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE empresas_documentos (
    id uuid PRIMARY KEY,
    empresa_id uuid NOT NULL REFERENCES empresas_perfis(id),
    anterior_id uuid UNIQUE REFERENCES empresas_documentos(id),
    versao integer NOT NULL CHECK (versao > 0),
    titulo varchar(200) NOT NULL,
    tipo text NOT NULL CHECK (tipo IN ('juridico','fiscal_trabalhista','atestado_tecnico','economico_financeiro','outro')),
    validade date,
    enviado_em timestamptz NOT NULL DEFAULT now(),
    excluido_em timestamptz,
    tamanho integer NOT NULL CHECK (tamanho BETWEEN 1 AND 10485760),
    sha256 varchar(64) NOT NULL,
    verificacao text NOT NULL DEFAULT 'nao_verificado' CHECK (verificacao = 'nao_verificado')
);
CREATE INDEX empresas_documentos_empresa ON empresas_documentos(empresa_id);
-- Os bytes são privados e separados dos metadados, sem URL pública ou serviço externo.
CREATE TABLE empresas_arquivos (
    documento_id uuid PRIMARY KEY REFERENCES empresas_documentos(id),
    conteudo bytea NOT NULL
);
