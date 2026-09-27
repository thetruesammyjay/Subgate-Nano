"""Expose the FastAPI application at ``app.main:app`` for local Uvicorn runs."""

import sys
from pathlib import Path


_SOURCE_DIRECTORY = str(Path(__file__).resolve().parents[1] / "src")
if _SOURCE_DIRECTORY not in sys.path:
    sys.path.insert(0, _SOURCE_DIRECTORY)

from subgate_api.main import app as app  # noqa: E402

__all__ = ["app"]
