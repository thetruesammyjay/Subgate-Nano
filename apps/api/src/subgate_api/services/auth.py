import hashlib
import base64
import hmac
import os
import re
import secrets
from datetime import UTC, datetime, timedelta

from eth_account import Account
from eth_account.messages import encode_defunct
from eth_keys.exceptions import BadSignature


WALLET_PATTERN = re.compile(r"^0x[a-fA-F0-9]{40}$")
PASSWORD_SCHEME = "scrypt"


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


def normalize_email(value: str) -> str:
    email = value.strip().lower()
    if len(email) > 320 or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        raise ValueError("email must be a valid email address")
    return email


def normalize_username(value: str) -> str:
    username = value.strip().lower()
    if not re.fullmatch(r"[a-z0-9](?:[a-z0-9_-]{1,38}[a-z0-9])?", username):
        raise ValueError("username must use 3-40 letters, numbers, underscores, or hyphens")
    return username


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    derived = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
    encode = lambda value: base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")
    return f"{PASSWORD_SCHEME}$16384$8$1${encode(salt)}${encode(derived)}"


def verify_password(password: str, encoded: str | None) -> bool:
    if not encoded:
        return False
    try:
        scheme, n, r, p, salt_text, digest_text = encoded.split("$", 5)
        if scheme != PASSWORD_SCHEME:
            return False
        decode = lambda value: base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
        salt = decode(salt_text)
        expected = decode(digest_text)
        actual = hashlib.scrypt(
            password.encode("utf-8"),
            salt=salt,
            n=int(n),
            r=int(r),
            p=int(p),
            dklen=len(expected),
        )
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False
