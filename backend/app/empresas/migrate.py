"""Aplicação explícita e transacional das migrações exclusivas de Empresas."""
import hashlib
import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv


def apply_migrations(database_url, folder: Path, table: str, lock: int):
    """Aplica em transação os .sql de `folder` ainda não registrados em `table`; recusa migração já aplicada e alterada."""
    with psycopg.connect(database_url, connect_timeout=5) as connection:
        connection.execute('SELECT pg_advisory_xact_lock(%s)', (lock,))
        connection.execute(f'CREATE TABLE IF NOT EXISTS {table} (nome text PRIMARY KEY, sha256 text NOT NULL, aplicado_em timestamptz NOT NULL DEFAULT now())')
        for path in sorted(folder.glob('*.sql')):
            sql = path.read_text()
            digest = hashlib.sha256(sql.encode()).hexdigest()
            applied = connection.execute(f'SELECT sha256 FROM {table} WHERE nome = %s', (path.name,)).fetchone()
            if applied:
                if applied[0] != digest:
                    raise RuntimeError('Migração aplicada foi alterada; crie nova migração.')
                continue
            connection.execute(sql)
            connection.execute(f'INSERT INTO {table}(nome, sha256) VALUES (%s, %s)', (path.name, digest))


def migrate(database_url):
    apply_migrations(database_url, Path(__file__).parent / 'migrations', 'empresas_migracoes', 8731021)

if __name__ == '__main__':
    load_dotenv(Path(__file__).resolve().parents[3] / '.env')
    migrate(os.environ['DATABASE_URL'])
    print('Migrações de Empresas aplicadas.')
