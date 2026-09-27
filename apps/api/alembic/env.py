from __future__ import annotations

import asyncio
import os
from pathlib import Path
from logging.config import fileConfig

from alembic import context
from dotenv import load_dotenv
from sqlalchemy import pool, text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from subgate_api.models import Base
from subgate_api.config import database_schema, normalize_async_database_url

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

database_url = os.getenv("DATABASE_URL")
if database_url:
    config.set_main_option("sqlalchemy.url", normalize_async_database_url(database_url))

target_metadata = Base.metadata
schema = database_schema()


def run_migrations_offline() -> None:
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        version_table_schema=schema,
    )
    context.execute(f'CREATE SCHEMA IF NOT EXISTS "{schema}"')
    context.execute(f'SET search_path TO "{schema}"')
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    if connection.dialect.name == "postgresql":
        connection.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema}"'))
        connection.commit()
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        version_table_schema=schema if connection.dialect.name == "postgresql" else None,
    )
    with context.begin_transaction():
        if connection.dialect.name == "postgresql":
            connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = async_engine_from_config(config.get_section(config.config_ini_section, {}), prefix="sqlalchemy.", poolclass=pool.NullPool)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
