"""Aplicação explícita e transacional das migrações exclusivas de Elegibilidade (mesmo mecanismo de Empresas)."""
import os
from pathlib import Path

from dotenv import load_dotenv

from app.empresas.migrate import apply_migrations


def migrate(database_url):
    apply_migrations(database_url, Path(__file__).parent / 'migrations', 'elegibilidade_migracoes', 8731022)


if __name__ == '__main__':
    load_dotenv(Path(__file__).resolve().parents[3] / '.env')
    migrate(os.environ['DATABASE_URL'])
    print('Migrações de Elegibilidade aplicadas.')
