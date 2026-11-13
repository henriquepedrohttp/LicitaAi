"""Aplicação explícita e transacional das migrações exclusivas de Empresas."""
import hashlib
import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv


def migrate(database_url):
    with psycopg.connect(database_url, connect_timeout=5) as connection:
        connection.execute('SELECT pg_advisory_xact_lock(8731021)')
        connection.execute('CREATE TABLE IF NOT EXISTS empresas_migracoes (nome text PRIMARY KEY, sha256 text NOT NULL, aplicado_em timestamptz NOT NULL DEFAULT now())')
        for path in sorted((Path(__file__).parent / 'migrations').glob('*.sql')):
            sql = path.read_text()
            digest = hashlib.sha256(sql.encode()).hexdigest()
            applied = connection.execute('SELECT sha256 FROM empresas_migracoes WHERE nome = %s', (path.name,)).fetchone()
            if applied:
                if applied[0] != digest:
                    raise RuntimeError('Migração aplicada foi alterada; crie nova migração.')
                continue
            connection.execute(sql)
            connection.execute('INSERT INTO empresas_migracoes(nome, sha256) VALUES (%s, %s)', (path.name, digest))


if __name__ == '__main__':
    load_dotenv(Path(__file__).resolve().parents[3] / '.env')
    migrate(os.environ['DATABASE_URL'])
    print('Migrações de Empresas aplicadas.')
