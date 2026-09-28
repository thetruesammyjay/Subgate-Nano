"""Read-only verification for creator registration and atomic Arbitrum PPV receipts."""

import os
import re
from uuid import UUID

import httpx
from eth_abi import decode
from eth_utils import keccak


EXPECTED_CHAIN_ID = 421614
EXPECTED_TESTNET_USDC = "0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d"
_ADDRESS_PATTERN = re.compile(r"^0x[a-fA-F0-9]{40}$")
_HASH_PATTERN = re.compile(r"^0x[a-fA-F0-9]{64}$")
_STREAM_REGISTERED_TOPIC = "0x" + keccak(text="StreamRegistered(bytes32,address,uint8,uint128,uint32)").hex()
_SESSION_SETTLED_TOPIC = "0x" + keccak(text="ViewingSessionSettled(bytes32,bytes32,address,address,uint64,uint128)").hex()
_TRANSFER_TOPIC = "0x" + keccak(text="Transfer(address,address,uint256)").hex()


class ArbitrumConfigurationError(RuntimeError):
    """Raised when the demo is missing an explicit Sepolia contract configuration."""


class ArbitrumRpcError(RuntimeError):
    """Raised when the configured RPC cannot verify a transaction."""


class ArbitrumVerificationError(ValueError):
    """Raised when a transaction does not prove the expected stream or payment."""


def _required_address(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not _ADDRESS_PATTERN.fullmatch(value) or int(value[2:], 16) == 0:
        raise ArbitrumConfigurationError(f"{name} must be set to a non-zero EVM address")
    return value.lower()


def chain_id() -> int:
    try:
        configured = int(os.getenv("ARBITRUM_CHAIN_ID", str(EXPECTED_CHAIN_ID)))
    except ValueError as error:
        raise ArbitrumConfigurationError("ARBITRUM_CHAIN_ID must be an integer") from error
    if configured != EXPECTED_CHAIN_ID:
        raise ArbitrumConfigurationError("The demo is configured for Arbitrum Sepolia (chain ID 421614) only")
    return configured


def public_chain_config(*, required: bool = False) -> dict[str, object] | None:
    rpc_url = os.getenv("ARBITRUM_RPC_URL", "").strip()
    if not rpc_url:
        if required:
            raise ArbitrumConfigurationError("ARBITRUM_RPC_URL is required for Arbitrum settlement")
        return None
    try:
        token_address = _required_address("USDC_ADDRESS")
        if token_address != EXPECTED_TESTNET_USDC:
            raise ArbitrumConfigurationError(
                "USDC_ADDRESS must be Circle's official Arbitrum Sepolia USDC contract"
            )
        config = {
            "chain_id": chain_id(),
            "network": "Arbitrum Sepolia",
            "payment_token_address": token_address,
            "registry_contract_address": _required_address("SUBGATE_STREAM_REGISTRY_ADDRESS"),
            "receipts_contract_address": _required_address("SUBGATE_RECEIPTS_ADDRESS"),
            "explorer_base_url": "https://sepolia.arbiscan.io",
        }
    except (ValueError, ArbitrumConfigurationError):
        if required:
            raise
        return None
    return config


def stream_id_bytes32(stream_id: UUID) -> str:
    """Return the stable registry ID used for a Subgate database stream UUID."""
    return "0x" + keccak(stream_id.bytes).hex()


def session_id_bytes32(session_id: UUID) -> str:
    """Represent the 128-bit API UUID as a left-padded bytes32 contract identifier."""
    return "0x" + session_id.hex.rjust(64, "0")


def _hex_bytes(value: object, *, field: str) -> bytes:
    if not isinstance(value, str) or not value.startswith("0x"):
        raise ArbitrumVerificationError(f"The RPC returned an invalid {field}")
    try:
        return bytes.fromhex(value[2:])
    except ValueError as error:
        raise ArbitrumVerificationError(f"The RPC returned an invalid {field}") from error


def _topic_address(value: object) -> str:
    raw = _hex_bytes(value, field="address topic")
    if len(raw) != 32:
        raise ArbitrumVerificationError("The event contains a malformed address")
    return "0x" + raw[-20:].hex()


def _address_topic(address: str) -> str:
    return "0x" + address.lower().removeprefix("0x").rjust(64, "0")


async def _rpc(method: str, params: list[object]) -> object:
    rpc_url = os.getenv("ARBITRUM_RPC_URL", "").strip()
    if not rpc_url:
        raise ArbitrumConfigurationError("ARBITRUM_RPC_URL is required for Arbitrum settlement")
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(rpc_url, json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params})
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError) as error:
        raise ArbitrumRpcError("Unable to read Arbitrum Sepolia right now") from error
    if not isinstance(payload, dict) or payload.get("error"):
        raise ArbitrumRpcError(f"Arbitrum RPC could not complete {method}")
    return payload.get("result")


async def assert_arbitrum_sepolia() -> None:
    actual = await _rpc("eth_chainId", [])
    if not isinstance(actual, str) or int(actual, 16) != chain_id():
        raise ArbitrumRpcError("The configured RPC endpoint is not connected to Arbitrum Sepolia")


async def chain_readiness() -> dict[str, object]:
    config = public_chain_config(required=True)
    assert config is not None
    await assert_arbitrum_sepolia()
    for label, key in (
        ("USDC token", "payment_token_address"),
        ("stream registry", "registry_contract_address"),
        ("receipt contract", "receipts_contract_address"),
    ):
        code = await _rpc("eth_getCode", [config[key], "latest"])
        if not isinstance(code, str) or code in {"0x", "0x0"}:
            raise ArbitrumVerificationError(f"No deployed bytecode was found for the configured {label}")
    return {"ready": True, "mode": "arbitrum", "chain": config}


async def _transaction_receipt(tx_hash: str, contract_address: str) -> dict[str, object]:
    if not _HASH_PATTERN.fullmatch(tx_hash):
        raise ArbitrumVerificationError("A valid transaction hash is required")
    await assert_arbitrum_sepolia()
    receipt = await _rpc("eth_getTransactionReceipt", [tx_hash])
    if not isinstance(receipt, dict):
        raise ArbitrumVerificationError("Transaction is not mined yet; wait for confirmation and retry")
    if receipt.get("status") != "0x1":
        raise ArbitrumVerificationError("The transaction failed on-chain")
    if str(receipt.get("to", "")).lower() != contract_address.lower():
        raise ArbitrumVerificationError("The transaction was sent to the wrong contract")
    if str(receipt.get("transactionHash", "")).lower() != tx_hash.lower():
        raise ArbitrumVerificationError("The RPC receipt does not match the submitted transaction hash")
    return receipt


def _logs(receipt: dict[str, object]) -> list[dict[str, object]]:
    values = receipt.get("logs")
    return [value for value in values if isinstance(value, dict)] if isinstance(values, list) else []


async def verify_stream_registration(
    tx_hash: str,
    *,
    expected_stream_id: str,
    expected_creator: str,
    expected_pricing_model: str,
    expected_price_atomic: int,
    expected_preview_seconds: int,
) -> None:
    config = public_chain_config(required=True)
    assert config is not None
    receipt = await _transaction_receipt(tx_hash, str(config["registry_contract_address"]))
    if str(receipt.get("from", "")).lower() != expected_creator.lower():
        raise ArbitrumVerificationError("The registration transaction was not sent by this creator wallet")

    expected_model = 0 if expected_pricing_model == "pay_per_view" else 1
    for log in _logs(receipt):
        topics = log.get("topics")
        if (
            str(log.get("address", "")).lower() != str(config["registry_contract_address"]).lower()
            or not isinstance(topics, list)
            or len(topics) < 3
            or str(topics[0]).lower() != _STREAM_REGISTERED_TOPIC
            or str(topics[1]).lower() != expected_stream_id.lower()
            or _topic_address(topics[2]) != expected_creator.lower()
        ):
            continue
        try:
            model, amount, preview = decode(["uint8", "uint128", "uint32"], _hex_bytes(log.get("data"), field="registration event data"))
        except (ValueError, TypeError) as error:
            raise ArbitrumVerificationError("The stream registration event is malformed") from error
        if model != expected_model or amount != expected_price_atomic or preview != expected_preview_seconds:
            raise ArbitrumVerificationError("The registered price or preview does not match the saved stream")
        return
    raise ArbitrumVerificationError("No matching StreamRegistered event was found in that transaction")


async def verify_pay_per_view_settlement(
    tx_hash: str,
    *,
    expected_session_id: UUID,
    expected_stream_id: str,
    expected_viewer: str,
    expected_creator: str,
    expected_amount_atomic: int,
) -> None:
    config = public_chain_config(required=True)
    assert config is not None
    receipt = await _transaction_receipt(tx_hash, str(config["receipts_contract_address"]))
    if str(receipt.get("from", "")).lower() != expected_viewer.lower():
        raise ArbitrumVerificationError("The payment transaction was not sent by the connected viewer wallet")

    session_topic = session_id_bytes32(expected_session_id)
    event_found = False
    transfer_found = False
    for log in _logs(receipt):
        topics = log.get("topics")
        if not isinstance(topics, list) or not topics:
            continue
        topic0 = str(topics[0]).lower()
        address = str(log.get("address", "")).lower()

        if (
            address == str(config["receipts_contract_address"]).lower()
            and len(topics) >= 4
            and topic0 == _SESSION_SETTLED_TOPIC
            and str(topics[1]).lower() == session_topic
            and str(topics[2]).lower() == expected_stream_id.lower()
            and _topic_address(topics[3]) == expected_viewer.lower()
        ):
            try:
                token, duration, amount = decode(["address", "uint64", "uint128"], _hex_bytes(log.get("data"), field="settlement event data"))
            except (ValueError, TypeError) as error:
                raise ArbitrumVerificationError("The settlement receipt event is malformed") from error
            if (
                str(token).lower() == str(config["payment_token_address"]).lower()
                and duration == 0
                and amount == expected_amount_atomic
            ):
                event_found = True

        if (
            address == str(config["payment_token_address"]).lower()
            and len(topics) >= 3
            and topic0 == _TRANSFER_TOPIC
            and _topic_address(topics[1]) == expected_viewer.lower()
            and _topic_address(topics[2]) == expected_creator.lower()
        ):
            amount = int.from_bytes(_hex_bytes(log.get("data"), field="USDC transfer data"), "big")
            if amount == expected_amount_atomic:
                transfer_found = True

    if not event_found:
        raise ArbitrumVerificationError("No matching Subgate settlement receipt was found in that transaction")
    if not transfer_found:
        raise ArbitrumVerificationError("The transaction does not contain the expected USDC transfer to the creator")


def transaction_explorer_url(tx_hash: str) -> str:
    config = public_chain_config(required=True)
    assert config is not None
    return f"{config['explorer_base_url']}/tx/{tx_hash}"
