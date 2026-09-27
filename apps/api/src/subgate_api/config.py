import os
import re
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit


_SCHEMA_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def frontend_url() -> str:
    """Return the canonical browser origin used by the API deployment."""
    return os.getenv("FRONTEND_URL", "http://localhost:3000").strip().rstrip("/")


def cors_origins() -> list[str]:
    """Parse one or more comma-separated browser origins for CORS."""
    raw = os.getenv("CORS_ORIGIN", frontend_url())
    return [origin.strip().rstrip("/") for origin in raw.split(",") if origin.strip()]


def normalize_async_database_url(value: str) -> str:
    """Convert a libpq URL into the asyncpg URL SQLAlchemy expects."""
    if value.startswith("postgresql://"):
        value = value.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif value.startswith("postgres://"):
        value = value.replace("postgres://", "postgresql+asyncpg://", 1)

    parsed = urlsplit(value)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    sslmode = query.pop("sslmode", None)
    query.pop("channel_binding", None)
    if sslmode and sslmode not in {"disable", "allow", "prefer"}:
        query["ssl"] = sslmode

    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urlencode(query), parsed.fragment))


def database_schema() -> str:
    """Return the isolated PostgreSQL schema used by the streaming API."""
    value = os.getenv("SUBGATE_DB_SCHEMA", "subgate_nano").strip()
    if not _SCHEMA_PATTERN.fullmatch(value):
        raise ValueError("SUBGATE_DB_SCHEMA must be a simple PostgreSQL identifier")
    return value
