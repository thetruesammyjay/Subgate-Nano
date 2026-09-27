from fastapi.testclient import TestClient


def _create_paid_stream(client: TestClient, creator_headers: dict[str, str]) -> tuple[dict[str, object], dict[str, object]]:
    created = client.post(
        "/streams",
        headers=creator_headers,
        json={
            "creator_wallet": "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf",
            "creator_display_name": "Sammy Jay",
            "slug": "creator-workspace-test",
            "title": "Creator Workspace Test",
            "stream_type": "video",
            "pricing": {"model": "pay_per_view", "price_atomic": 1_250_000},
            "playback_url": "https://cdn.example.com/test/master.m3u8",
        },
    )
    assert created.status_code == 201, created.text
    stream = created.json()
    viewing = client.post(
        f"/streams/{stream['id']}/sessions",
        json={"viewer_wallet": "0x2222222222222222222222222222222222222222"},
    )
    assert viewing.status_code == 201, viewing.text
    return stream, viewing.json()


def test_admin_review_and_operations_endpoints(
    client: TestClient,
    admin_headers: dict[str, str],
) -> None:
    assert client.get("/admin/overview").status_code == 401

    registered = client.post(
        "/auth/creator/register",
        json={
            "email": "review-me@example.com",
            "password": "correct-horse-battery",
            "username": "review_me",
            "display_name": "Review Me",
        },
    )
    assert registered.status_code == 201, registered.text
    creator_id = registered.json()["creator"]["id"]
    assert registered.json()["creator"]["approval_status"] == "pending"
    pending_headers = {"Authorization": f"Bearer {registered.json()['access_token']}"}
    blocked_publish = client.post(
        "/streams",
        headers=pending_headers,
        json={
            "creator_wallet": "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf",
            "creator_display_name": "Review Me",
            "slug": "pending-review-stream",
            "title": "Pending Review Stream",
            "stream_type": "video",
            "pricing": {"model": "pay_per_view", "price_atomic": 1000},
            "playback_url": "https://cdn.example.com/pending/master.m3u8",
        },
    )
    assert blocked_publish.status_code == 403

    queued = client.get("/admin/creators?approval_status=pending", headers=admin_headers)
    assert queued.status_code == 200, queued.text
    assert queued.json()["total"] == 1
    assert queued.json()["items"][0]["id"] == creator_id
    creator_detail = client.get(f"/admin/creators/{creator_id}", headers=admin_headers)
    assert creator_detail.status_code == 200, creator_detail.text
    assert creator_detail.json()["approval_status"] == "pending"

    changed = client.patch(
        f"/admin/creators/{creator_id}/status",
        headers=admin_headers,
        json={"approval_status": "approved", "reason": "Identity reviewed"},
    )
    assert changed.status_code == 200, changed.text
    assert changed.json()["approval_status"] == "approved"

    audit = client.get("/admin/audit?event_type=creator.status_changed", headers=admin_headers)
    assert audit.status_code == 200, audit.text
    assert audit.json()["items"][0]["entity_id"] == creator_id
    assert client.get("/admin/settings", headers=admin_headers).json()["editable_in_dashboard"] is False


def test_creator_overview_profile_sessions_receipts_and_admin_views(
    client: TestClient,
    creator_headers: dict[str, str],
    admin_headers: dict[str, str],
) -> None:
    overview = client.get("/creator/overview", headers=creator_headers)
    assert overview.status_code == 200, overview.text
    assert overview.json()["approval_status"] == "approved"

    profile = client.patch(
        "/creator/profile",
        headers=creator_headers,
        json={"display_name": "Updated Creator", "social_links": {"website": "https://example.com"}},
    )
    assert profile.status_code == 200, profile.text
    assert profile.json()["display_name"] == "Updated Creator"

    settings = client.get("/creator/settings", headers=creator_headers)
    assert settings.status_code == 200, settings.text
    assert settings.json()["default_preview_seconds"] == 30
    saved_settings = client.patch(
        "/creator/settings",
        headers=creator_headers,
        json={"default_preview_seconds": 45, "email_notifications": False},
    )
    assert saved_settings.status_code == 200, saved_settings.text
    assert saved_settings.json()["default_preview_seconds"] == 45
    assert client.get("/creator/settings", headers=creator_headers).json()["email_notifications"] is False

    stream, viewing = _create_paid_stream(client, creator_headers)
    creator_stream = client.get(f"/creator/streams/{stream['id']}", headers=creator_headers)
    assert creator_stream.status_code == 200, creator_stream.text
    assert creator_stream.json()["id"] == stream["id"]
    creator_sessions = client.get("/creator/sessions?session_status=completed", headers=creator_headers)
    assert creator_sessions.status_code == 200, creator_sessions.text
    assert creator_sessions.json()["total"] == 1
    assert creator_sessions.json()["items"][0]["id"] == viewing["id"]
    assert client.get(f"/creator/sessions/{viewing['id']}", headers=creator_headers).status_code == 200

    receipts = client.get("/creator/receipts", headers=creator_headers)
    assert receipts.status_code == 200, receipts.text
    assert receipts.json()["total"] == 1
    assert receipts.json()["items"][0]["amount_atomic"] == 1_250_000

    overview = client.get("/admin/overview", headers=admin_headers)
    assert overview.status_code == 200, overview.text
    assert overview.json()["streams_published"] == 1
    assert overview.json()["settlements_atomic"] == 1_250_000

    streams = client.get("/admin/streams?is_published=true", headers=admin_headers)
    assert streams.status_code == 200, streams.text
    assert streams.json()["items"][0]["id"] == stream["id"]
    hidden = client.patch(
        f"/admin/streams/{stream['id']}/visibility",
        headers=admin_headers,
        json={"is_published": False, "reason": "Moderation review"},
    )
    assert hidden.status_code == 200, hidden.text
    assert hidden.json()["is_published"] is False

    sessions = client.get("/admin/sessions?session_status=completed", headers=admin_headers)
    assert sessions.status_code == 200, sessions.text
    assert sessions.json()["total"] == 1
    settlements = client.get("/admin/settlements", headers=admin_headers)
    assert settlements.status_code == 200, settlements.text
    assert settlements.json()["total"] == 1
    report = client.get("/admin/reports/revenue?days=30", headers=admin_headers)
    assert report.status_code == 200, report.text
    assert report.json()["totals"]["amount_atomic"] == 1_250_000

    republished = client.patch(
        f"/admin/streams/{stream['id']}/visibility",
        headers=admin_headers,
        json={"is_published": True},
    )
    assert republished.status_code == 200, republished.text
    creator = client.get("/auth/me", headers=creator_headers).json()
    suspended = client.patch(
        f"/admin/creators/{creator['id']}/status",
        headers=admin_headers,
        json={"approval_status": "suspended"},
    )
    assert suspended.status_code == 200, suspended.text
    assert suspended.json()["streams_unpublished"] == 1
