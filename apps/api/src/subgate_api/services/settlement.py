import base64
import hashlib
import json
from dataclasses import dataclass
from uuid import UUID

import httpx


@dataclass(frozen=True)
class SettlementResult:
    transaction_reference: str
    payer_address: str | None = None


@dataclass(frozen=True)
class PaymentRequirement:
    resource_url: str
    description: str
    network: str
    asset: str
    amount_atomic: int
    pay_to: str
    gateway_wallet: str
    max_timeout_seconds: int = 300

    def as_dict(self) -> dict[str, object]:
        return {
            "x402Version": 2,
            "resource": {
                "url": self.resource_url,
                "description": self.description,
                "mimeType": "application/json",
            },
            "accepts": [{
                "scheme": "exact",
                "network": self.network,
                "asset": self.asset,
                "amount": str(self.amount_atomic),
                "payTo": self.pay_to,
                "maxTimeoutSeconds": self.max_timeout_seconds,
                "extra": {
                    "name": "GatewayWalletBatched",
                    "version": "1",
                    "verifyingContract": self.gateway_wallet,
                },
            }],
        }


def encode_payment_requirement(requirement: PaymentRequirement) -> str:
    payload = json.dumps(requirement.as_dict(), separators=(",", ":")).encode()
    return base64.b64encode(payload).decode()


def decode_payment_signature(value: str) -> dict[str, object]:
    try:
        decoded = base64.b64decode(value).decode()
        payload = json.loads(decoded)
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError("PAYMENT-SIGNATURE is not valid base64 JSON") from error
    if not isinstance(payload, dict) or not isinstance(payload.get("accepted"), dict):
        raise ValueError("PAYMENT-SIGNATURE has an invalid x402 payload")
    return payload


class CircleGatewaySettlement:
    """x402 facilitator adapter; it never signs or custody-holds viewer funds."""

    def __init__(
        self,
        facilitator_url: str,
        client: httpx.AsyncClient | None = None,
        api_key: str | None = None,
    ) -> None:
        self.facilitator_url = facilitator_url.rstrip("/")
        self.client = client
        self.api_key = api_key

    async def settle(self, payment_signature: str, requirement: PaymentRequirement) -> SettlementResult:
        payload = decode_payment_signature(payment_signature)
        accepted = payload["accepted"]
        assert isinstance(accepted, dict)
        required = requirement.as_dict()["accepts"][0]
        assert isinstance(required, dict)
        for field in ("scheme", "network", "asset", "amount", "payTo"):
            if accepted.get(field) != required[field]:
                raise ValueError(f"PAYMENT-SIGNATURE does not match required {field}")

        own_client = self.client is None
        client = self.client or httpx.AsyncClient(timeout=15)
        try:
            response = await client.post(
                f"{self.facilitator_url}/v1/x402/settle",
                json={"paymentPayload": payload, "paymentRequirements": required},
                headers={"Authorization": f"Bearer {self.api_key}"} if self.api_key else None,
            )
            try:
                body = response.json()
            except ValueError:
                body = None
        finally:
            if own_client:
                await client.aclose()

        if response.status_code >= 400 or not isinstance(body, dict) or body.get("success") is not True:
            message = body.get("message", "x402 settlement was rejected") if isinstance(body, dict) else "Malformed facilitator response"
            raise ValueError(str(message))

        transaction = body.get("transaction")
        if not isinstance(transaction, str) or not transaction:
            transaction = hashlib.sha256(response.content).hexdigest()
        payer = body.get("payer")
        return SettlementResult(transaction_reference=transaction, payer_address=payer if isinstance(payer, str) else None)


class LocalSettlementGateway:
    """Deterministic local settlement substitute used until the Arbitrum adapter is connected."""

    async def settle(self, session_id: UUID, amount_atomic: int) -> SettlementResult:
        return SettlementResult(transaction_reference=f"local-{session_id.hex}-{amount_atomic}")
