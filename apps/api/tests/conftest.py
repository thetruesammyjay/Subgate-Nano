import asyncio
from collections.abc import AsyncIterator

import pytest
from eth_account import Account
from eth_account.messages import encode_defunct
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from subgate_api.db import get_session
from subgate_api.main import app
from subgate_api.models import Base

TEST_CREATOR_PRIVATE_KEY = "0x" + "1".zfill(64)
TEST_CREATOR_WALLET = Account.from_key(TEST_CREATOR_PRIVATE_KEY).address.lower()


@pytest.fixture()
def client() -> AsyncIterator[TestClient]:
    engine = create_async_engine("sqlite+aiosqlite://")
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def setup() -> None:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

    async def override_session() -> AsyncIterator[AsyncSession]:
        async with session_factory() as session:
            yield session

    asyncio.run(setup())
    app.dependency_overrides[get_session] = override_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    asyncio.run(engine.dispose())


@pytest.fixture()
def creator_headers(client: TestClient) -> dict[str, str]:
    challenge = client.post("/auth/challenge", json={"wallet_address": TEST_CREATOR_WALLET})
    assert challenge.status_code == 200, challenge.text
    message = challenge.json()["message"]
    signature = Account.sign_message(
        encode_defunct(text=message),
        private_key=TEST_CREATOR_PRIVATE_KEY,
    ).signature.hex()
    verified = client.post(
        "/auth/verify",
        json={
            "challenge_id": challenge.json()["challenge_id"],
            "wallet_address": TEST_CREATOR_WALLET,
            "signature": signature,
            "display_name": "Sammy Jay",
        },
    )
    assert verified.status_code == 200, verified.text
    return {"Authorization": f"Bearer {verified.json()['access_token']}"}
