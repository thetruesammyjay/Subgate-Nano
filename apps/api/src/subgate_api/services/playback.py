import base64
import hashlib
import hmac
import json
import os
import time
from dataclasses import dataclass
from uuid import UUID, uuid4


TOKEN_VERSION = "v1"
TOKEN_TTL_SECONDS = 300


def _encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def _secret() -> bytes:
    return os.getenv("PLAYBACK_TOKEN_SECRET", "subgate-local-playback-secret-change-me").encode()


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


@dataclass(frozen=True)
class PlaybackClaims:
    token_id: UUID
    session_id: UUID
    stream_id: UUID
    expires_at: int


def issue_token(session_id: UUID, stream_id: UUID, ttl_seconds: int = TOKEN_TTL_SECONDS) -> tuple[str, PlaybackClaims]:
    claims = PlaybackClaims(uuid4(), session_id, stream_id, int(time.time()) + ttl_seconds)
    payload = {
        "jti": str(claims.token_id),
        "sid": str(claims.session_id),
        "stream": str(claims.stream_id),
        "exp": claims.expires_at,
    }
    encoded_payload = _encode(json.dumps(payload, separators=(",", ":")).encode())
    signature = _encode(hmac.new(_secret(), f"{TOKEN_VERSION}.{encoded_payload}".encode(), hashlib.sha256).digest())
    return f"{TOKEN_VERSION}.{encoded_payload}.{signature}", claims


def parse_token(token: str) -> PlaybackClaims:
    try:
        version, encoded_payload, encoded_signature = token.split(".", 2)
        if version != TOKEN_VERSION:
            raise ValueError("Unsupported playback token version")
        expected_signature = hmac.new(_secret(), f"{version}.{encoded_payload}".encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(expected_signature, _decode(encoded_signature)):
            raise ValueError("Invalid playback token signature")
        payload = json.loads(_decode(encoded_payload))
        claims = PlaybackClaims(
            UUID(payload["jti"]),
            UUID(payload["sid"]),
            UUID(payload["stream"]),
            int(payload["exp"]),
        )
        if claims.expires_at <= int(time.time()):
            raise ValueError("Playback token has expired")
        return claims
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        raise ValueError("Invalid playback token") from error
