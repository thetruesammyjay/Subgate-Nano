from eth_account import Account
from eth_account.messages import encode_defunct
from fastapi.testclient import TestClient


PRIVATE_KEY = "0x" + "1".zfill(64)
WALLET = Account.from_key(PRIVATE_KEY).address.lower()


def test_creator_can_verify_wallet_and_logout(client: TestClient) -> None:
    challenge = client.post("/auth/challenge", json={"wallet_address": WALLET})
    assert challenge.status_code == 200, challenge.text
    challenge_body = challenge.json()

    signature = Account.sign_message(
        encode_defunct(text=challenge_body["message"]),
        private_key=PRIVATE_KEY,
    ).signature.hex()
    verified = client.post(
        "/auth/verify",
        json={
            "challenge_id": challenge_body["challenge_id"],
            "wallet_address": WALLET,
            "signature": signature,
            "display_name": "Sammy Jay",
        },
    )
    assert verified.status_code == 200, verified.text
    auth = verified.json()
    headers = {"Authorization": f"Bearer {auth['access_token']}"}

    me = client.get("/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["wallet_address"] == WALLET
    assert me.json()["display_name"] == "Sammy Jay"

    logged_out = client.post("/auth/logout", headers=headers)
    assert logged_out.status_code == 204
    assert client.get("/auth/me", headers=headers).status_code == 401


def test_invalid_signature_cannot_create_session(client: TestClient) -> None:
    challenge = client.post("/auth/challenge", json={"wallet_address": WALLET})
    assert challenge.status_code == 200

    response = client.post(
        "/auth/verify",
        json={
            "challenge_id": challenge.json()["challenge_id"],
            "wallet_address": WALLET,
            "signature": "0x" + "00" * 65,
        },
    )
    assert response.status_code == 401
