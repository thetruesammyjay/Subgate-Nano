from datetime import UTC, datetime

from fastapi import FastAPI
from pydantic import BaseModel, Field


app = FastAPI(
    title="Subgate Nano API",
    version="0.1.0",
    description="Streaming access, metered sessions, and USDC settlement on Arbitrum.",
)


class HealthResponse(BaseModel):
    service: str = "api"
    status: str = "ok"
    timestamp: datetime


class Pricing(BaseModel):
    model: str = Field(pattern="^(pay_per_view|metered)$")
    price_usdc: float | None = Field(default=None, ge=0)
    rate_usdc_per_minute: float | None = Field(default=None, ge=0)


class StreamSummary(BaseModel):
    id: str
    slug: str
    title: str
    stream_type: str = Field(pattern="^(video|livestream)$")
    pricing: Pricing
    free_preview_seconds: int = Field(default=0, ge=0)


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(timestamp=datetime.now(UTC))


@app.get("/streams", response_model=list[StreamSummary])
async def list_streams() -> list[StreamSummary]:
    """Return published streams. Repository integration is added in the next slice."""
    return []
