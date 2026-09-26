import hashlib
import os
import re
import secrets
from datetime import UTC, datetime, timedelta

from eth_account import Account
from eth_account.messages import encode_defunct
from eth_keys.exceptions import BadSignature


WALLET_PATTERN = re.compile(r"^0x[a-fA-F0-9]{40}$")


def now_utc() -> datetime:
    return datetime.now(UTC)


def as_utc(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def normalize_wallet(value: str) -> str:
    wallet = value.strip()
    if not WALLET_PATTERN.fullmatch(wallet):
        raise ValueError("wallet_address must be a valid 20-byte hexadecimal address")
    return wallet.lower()


def challenge_ttl_seconds() -> int:
    return max(60, int(os.getenv("CREATOR_AUTH_CHALLENGE_TTL_SECONDS", "300")))


def session_ttl_seconds() -> int:
    return max(300, int(os.getenv("CREATOR_SESSION_TTL_SECONDS", "604800")))


def create_challenge_message(wallet_address: str, nonce: str, expires_at: datetime) -> str:
    return "\n".join(
        (
            "Subgate Nano wants you to sign in.",
            "",
            f"Wallet: {wallet_address}",
            f"Nonce: {nonce}",
            f"Expires: {expires_at.isoformat()}",
            "",
            "Signing this message does not authorize a blockchain transaction.",
        )
    )


def verify_wallet_signature(message: str, signature: str, expected_wallet: str) -> bool:
    try:
        recovered_wallet = Account.recover_message(encode_defunct(text=message), signature=signature)
        return normalize_wallet(recovered_wallet) == normalize_wallet(expected_wallet)
    except (BadSignature, TypeError, ValueError):
        return False


def issue_session_token() -> tuple[str, str, datetime]:
    raw_token = secrets.token_urlsafe(48)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    expires_at = now_utc() + timedelta(seconds=session_ttl_seconds())
    return raw_token, token_hash, expires_at
