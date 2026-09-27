import asyncio
import base64
import json

import httpx

from subgate_api.config import cors_origins, database_schema, frontend_url, normalize_async_database_url
from subgate_api.services.settlement import CircleGatewaySettlement, PaymentRequirement


def test_normalize_database_url_for_asyncpg() -> None:
    normalized = normalize_async_database_url(
        "postgresql://user:pass@example.com/db?sslmode=require&channel_binding=require"
    )
    assert normalized == "postgresql+asyncpg://user:pass@example.com/db?ssl=require"


def test_database_schema_defaults_to_isolated_namespace(monkeypatch) -> None:
    monkeypatch.delenv("SUBGATE_DB_SCHEMA", raising=False)
    assert database_schema() == "subgate_nano"


def test_database_schema_rejects_unsafe_identifier(monkeypatch) -> None:
    monkeypatch.setenv("SUBGATE_DB_SCHEMA", "public;drop schema")
    try:
        database_schema()
    except ValueError as error:
        assert "simple PostgreSQL identifier" in str(error)
    else:
        raise AssertionError("unsafe schema identifier was accepted")


def test_cors_origins_accepts_multiple_frontends(monkeypatch) -> None:
    monkeypatch.setenv("FRONTEND_URL", "http://localhost:3000/")
    monkeypatch.delenv("CORS_ORIGIN", raising=False)
    assert frontend_url() == "http://localhost:3000"
    assert cors_origins() == ["http://localhost:3000"]

    monkeypatch.setenv("CORS_ORIGIN", "https://app.example.com/, https://preview.example.com")
    assert cors_origins() == ["https://app.example.com", "https://preview.example.com"]


def test_circle_gateway_adapter_settles_matching_x402_payload() -> None:
    requirement = PaymentRequirement(
        resource_url="http://localhost/streams/demo",
        description="Watch demo",
        network="eip155:421614",
        asset="0xasset",
        amount_atomic=1_500_000,
        pay_to="0xcreator",
        gateway_wallet="0xgateway",
    )
    accepted = requirement.as_dict()["accepts"][0]
    payload = {"x402Version": 2, "accepted": accepted, "payload": {"payer": "0xviewer"}}
    signature = base64.b64encode(json.dumps(payload).encode()).decode()

    async def run() -> str:
        async def handler(request: httpx.Request) -> httpx.Response:
            body = json.loads(request.content)
            assert body["paymentPayload"] == payload
            return httpx.Response(200, json={"success": True, "transaction": "0xsettled", "payer": "0xviewer"})

        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            result = await CircleGatewaySettlement("https://gateway.example", client).settle(signature, requirement)
            return result.transaction_reference

    assert asyncio.run(run()) == "0xsettled"
