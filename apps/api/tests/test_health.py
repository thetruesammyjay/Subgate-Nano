from fastapi.testclient import TestClient

from subgate_api.main import app


def test_health() -> None:
    response = TestClient(app).get("/health")
    assert response.status_code == 200
    assert response.json()["service"] == "api"
