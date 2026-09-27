from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from fastapi.testclient import TestClient


def create_stream(
    client: TestClient,
    pricing: dict[str, int | str],
    headers: dict[str, str],
) -> dict[str, object]:
    response = client.post(
        "/streams",
        json={
            "creator_wallet": "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf",
            "creator_display_name": "Sammy Jay",
            "slug": "futo-tech-conference",
            "title": "FUTO Tech Conference",
            "description": "A live creator event.",
            "stream_type": "livestream",
            "pricing": pricing,
            "free_preview_seconds": 30,
            "playback_url": "https://cdn.example.com/futo/master.m3u8",
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["service"] == "api"


def test_stream_creation_requires_authenticated_creator(client: TestClient, creator_headers: dict[str, str]) -> None:
    body = {
        "creator_wallet": "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf",
        "creator_display_name": "Sammy Jay",
        "slug": "protected-stream",
        "title": "Protected stream",
        "stream_type": "video",
        "pricing": {"model": "pay_per_view", "price_atomic": 1_000},
        "playback_url": "https://cdn.example.com/protected/master.m3u8",
    }
    assert client.post("/streams", json=body).status_code == 401
    assert client.post("/streams", json=body, headers=creator_headers).status_code == 201

    body["slug"] = "mismatched-wallet"
    body["creator_wallet"] = "0x2222222222222222222222222222222222222222"
    assert client.post("/streams", json=body, headers=creator_headers).status_code == 403


def test_creator_can_list_update_and_unpublish_own_stream(
    client: TestClient,
    creator_headers: dict[str, str],
) -> None:
    stream = create_stream(client, {"model": "pay_per_view", "price_atomic": 1_500_000}, creator_headers)
    stream_id = stream["id"]

    assert client.get("/creator/streams").status_code == 401
    owned = client.get("/creator/streams", headers=creator_headers)
    assert owned.status_code == 200
    assert owned.json()[0]["id"] == stream_id

    updated = client.patch(
        f"/creator/streams/{stream_id}",
        headers=creator_headers,
        json={
            "title": "Updated conference",
            "pricing": {"model": "metered", "rate_atomic_per_minute": 600_000},
            "is_published": False,
        },
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["title"] == "Updated conference"
    assert updated.json()["pricing"]["model"] == "metered"
    assert updated.json()["is_published"] is False

    public = client.get(f"/streams/{stream['slug']}")
    assert public.status_code == 404

    republished = client.patch(
        f"/creator/streams/{stream_id}",
        headers=creator_headers,
        json={"is_published": True},
    )
    assert republished.status_code == 200
    assert client.delete(f"/creator/streams/{stream_id}", headers=creator_headers).status_code == 204


def test_pay_per_view_session_returns_receipt(client: TestClient, creator_headers: dict[str, str]) -> None:
    stream = create_stream(client, {"model": "pay_per_view", "price_atomic": 1_500_000}, creator_headers)
    stream_id = stream["id"]

    listed = client.get("/streams")
    assert listed.status_code == 200
    assert listed.json()[0]["slug"] == "futo-tech-conference"

    session = client.post(
        f"/streams/{stream_id}/sessions",
        json={"viewer_wallet": "0x2222222222222222222222222222222222222222", "max_spend_atomic": 2_000_000},
    )
    assert session.status_code == 201, session.text
    assert session.json()["status"] == "completed"
    assert session.json()["settled_atomic"] == 1_500_000

    state = client.get(f"/sessions/{session.json()['id']}")
    assert state.status_code == 200
    assert state.json()["settled_atomic"] == 1_500_000

    receipt = client.get(f"/sessions/{session.json()['id']}/receipt")
    assert receipt.status_code == 200, receipt.text
    assert receipt.json()["amount_atomic"] == 1_500_000
    assert receipt.json()["transaction_reference"].startswith("local-")

    playback_token = client.post(f"/sessions/{session.json()['id']}/playback-token")
    assert playback_token.status_code == 200, playback_token.text
    manifest = client.get(playback_token.json()["playback_url"], follow_redirects=False)
    assert manifest.status_code == 307
    assert manifest.headers["location"] == "https://cdn.example.com/futo/master.m3u8"

    tampered = playback_token.json()["token"][:-1] + "x"
    rejected = client.get(
        f"/playback/{stream_id}/manifest",
        params={"token": tampered},
        follow_redirects=False,
    )
    assert rejected.status_code == 401

    requirement = client.get("/streams/futo-tech-conference/payment-requirement")
    assert requirement.status_code == 200
    assert requirement.json()["payment_required"]["accepts"][0]["amount"] == "1500000"
    assert requirement.json()["payment_required"]["accepts"][0]["payTo"] == "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf"


def test_metered_session_settles_when_stopped(client: TestClient, creator_headers: dict[str, str]) -> None:
    stream = create_stream(client, {"model": "metered", "rate_atomic_per_minute": 600_000}, creator_headers)
    session = client.post(
        f"/streams/{stream['id']}/sessions",
        json={"viewer_wallet": "0x2222222222222222222222222222222222222222", "max_spend_atomic": 50_000},
    )
    assert session.status_code == 201, session.text
    assert session.json()["status"] == "active"

    stopped = client.post(f"/sessions/{session.json()['id']}/stop")
    assert stopped.status_code == 200, stopped.text
    assert stopped.json()["status"] == "completed"
    assert stopped.json()["consumed_seconds"] >= 1
    assert 0 < stopped.json()["settled_atomic"] <= 50_000


def test_circle_mode_requires_payment_signature(client: TestClient, creator_headers: dict[str, str], monkeypatch) -> None:
    monkeypatch.setenv("SUBGATE_SETTLEMENT_MODE", "circle")
    stream = create_stream(client, {"model": "pay_per_view", "price_atomic": 1_500_000}, creator_headers)

    response = client.post(
        f"/streams/{stream['id']}/sessions",
        json={"viewer_wallet": "0x2222222222222222222222222222222222222222"},
    )

    assert response.status_code == 402
    assert "PAYMENT-REQUIRED" in response.headers
    body = response.json()
    assert body["payment_required"]["accepts"][0]["amount"] == "1500000"


def test_circle_mode_requires_payment_signature_to_stop_metered(client: TestClient, creator_headers: dict[str, str], monkeypatch) -> None:
    monkeypatch.setenv("SUBGATE_SETTLEMENT_MODE", "circle")
    stream = create_stream(client, {"model": "metered", "rate_atomic_per_minute": 600_000}, creator_headers)
    session = client.post(
        f"/streams/{stream['id']}/sessions",
        json={"viewer_wallet": "0x2222222222222222222222222222222222222222"},
    )
    assert session.status_code == 201

    stopped = client.post(f"/sessions/{session.json()['id']}/stop")
    assert stopped.status_code == 402
    assert "PAYMENT-REQUIRED" in stopped.headers


def test_heartbeat_uses_server_time_not_client_position(client: TestClient, creator_headers: dict[str, str]) -> None:
    stream = create_stream(client, {"model": "metered", "rate_atomic_per_minute": 600_000}, creator_headers)
    initial_time = datetime(2026, 9, 21, tzinfo=UTC)
    heartbeat_time = initial_time + timedelta(seconds=10)

    with patch("subgate_api.routers.streams.now_utc", side_effect=[initial_time, heartbeat_time]):
        session = client.post(
            f"/streams/{stream['id']}/sessions",
            json={"viewer_wallet": "0x2222222222222222222222222222222222222222"},
        )
        heartbeat = client.post(
            f"/sessions/{session.json()['id']}/heartbeat",
            json={"playing": True, "playback_position_seconds": 999_999},
        )

    assert heartbeat.status_code == 200, heartbeat.text
    assert heartbeat.json()["consumed_seconds"] == 10
    assert heartbeat.json()["accrued_atomic"] == 100_000
