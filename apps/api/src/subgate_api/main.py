from datetime import UTC, datetime

from fastapi import FastAPI
from pydantic import BaseModel

from subgate_api.routers.auth import router as auth_router
from subgate_api.routers.streams import router as streams_router


app = FastAPI(
    title="Subgate Nano API",
    version="0.1.0",
    description="Streaming access, metered sessions, and USDC settlement on Arbitrum.",
)


class HealthResponse(BaseModel):
    service: str = "api"
    status: str = "ok"
    timestamp: datetime


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(timestamp=datetime.now(UTC))


app.include_router(streams_router)
app.include_router(auth_router)
