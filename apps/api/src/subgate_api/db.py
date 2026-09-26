from collections.abc import AsyncIterator
import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from subgate_api.config import database_schema, normalize_async_database_url


load_dotenv(Path(__file__).resolve().parents[2] / ".env")


def _database_url() -> str:
    value = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/subgate_nano")
    return normalize_async_database_url(value)


def _connect_args(database_url: str) -> dict[str, object]:
    if database_url.startswith("postgresql+asyncpg://"):
        return {"server_settings": {"search_path": database_schema()}}
    return {}


_DATABASE_URL = _database_url()
engine = create_async_engine(_DATABASE_URL, connect_args=_connect_args(_DATABASE_URL), pool_pre_ping=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
