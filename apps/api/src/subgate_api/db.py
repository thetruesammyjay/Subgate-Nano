from collections.abc import AsyncIterator
import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import event
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from subgate_api.config import database_schema, normalize_async_database_url


load_dotenv(Path(__file__).resolve().parents[2] / ".env")


def _database_url() -> str:
    value = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/subgate_nano")
    return normalize_async_database_url(value)


_DATABASE_URL = _database_url()
engine = create_async_engine(_DATABASE_URL, pool_pre_ping=True)


@event.listens_for(engine.sync_engine, "begin")
def set_transaction_search_path(connection: Connection) -> None:
    """Set the app schema for each transaction, including through Neon pooler."""
    if connection.dialect.name == "postgresql":
        schema = database_schema()
        connection.exec_driver_sql(f'SET LOCAL search_path TO "{schema}"')


SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
