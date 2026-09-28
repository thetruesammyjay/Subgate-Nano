import asyncio
from uuid import uuid4

import pytest
from eth_abi import encode

import subgate_api.services.arbitrum as arbitrum


CHAIN = {
    "chain_id": 421614,
    "network": "Arbitrum Sepolia",
    "payment_token_address": "0x1111111111111111111111111111111111111111",
    "registry_contract_address": "0x2222222222222222222222222222222222222222",
    "receipts_contract_address": "0x3333333333333333333333333333333333333333",
    "explorer_base_url": "https://sepolia.arbiscan.io",
}
VIEWER = "0x4444444444444444444444444444444444444444"
CREATOR = "0x5555555555555555555555555555555555555555"
STREAM_ID = "0x" + "ab" * 32
TX_HASH = "0x" + "cd" * 32


def topic_address(address: str) -> str:
    return "0x" + address.removeprefix("0x").lower().rjust(64, "0")


def test_pay_per_view_verifier_requires_matching_contract_receipt_and_usdc_transfer(monkeypatch) -> None:
    session_id = uuid4()
    settlement_log = {
        "address": CHAIN["receipts_contract_address"],
        "topics": [
            arbitrum._SESSION_SETTLED_TOPIC,
            arbitrum.session_id_bytes32(session_id),
            STREAM_ID,
            topic_address(VIEWER),
        ],
        "data": "0x" + encode(["address", "uint64", "uint128"], [CHAIN["payment_token_address"], 0, 1_500_000]).hex(),
    }
    transfer_log = {
        "address": CHAIN["payment_token_address"],
        "topics": [arbitrum._TRANSFER_TOPIC, topic_address(VIEWER), topic_address(CREATOR)],
        "data": "0x" + encode(["uint256"], [1_500_000]).hex(),
    }
    receipt = {
        "status": "0x1",
        "transactionHash": TX_HASH,
        "to": CHAIN["receipts_contract_address"],
        "from": VIEWER,
        "logs": [settlement_log, transfer_log],
    }

    monkeypatch.setattr(arbitrum, "public_chain_config", lambda required=False: CHAIN)

    async def rpc(method: str, params: list[object]) -> object:
        return hex(arbitrum.EXPECTED_CHAIN_ID) if method == "eth_chainId" else receipt

    monkeypatch.setattr(arbitrum, "_rpc", rpc)
    asyncio.run(arbitrum.verify_pay_per_view_settlement(
        TX_HASH,
        expected_session_id=session_id,
        expected_stream_id=STREAM_ID,
        expected_viewer=VIEWER,
        expected_creator=CREATOR,
        expected_amount_atomic=1_500_000,
    ))

    receipt["logs"] = [settlement_log]
    with pytest.raises(arbitrum.ArbitrumVerificationError, match="USDC transfer"):
        asyncio.run(arbitrum.verify_pay_per_view_settlement(
            TX_HASH,
            expected_session_id=session_id,
            expected_stream_id=STREAM_ID,
            expected_viewer=VIEWER,
            expected_creator=CREATOR,
            expected_amount_atomic=1_500_000,
        ))


def test_registration_verifier_checks_creator_price_and_preview(monkeypatch) -> None:
    event_log = {
        "address": CHAIN["registry_contract_address"],
        "topics": [
            arbitrum._STREAM_REGISTERED_TOPIC,
            STREAM_ID,
            topic_address(CREATOR),
        ],
        "data": "0x" + encode(["uint8", "uint128", "uint32"], [0, 1_500_000, 30]).hex(),
    }
    receipt = {
        "status": "0x1",
        "transactionHash": TX_HASH,
        "to": CHAIN["registry_contract_address"],
        "from": CREATOR,
        "logs": [event_log],
    }
    monkeypatch.setattr(arbitrum, "public_chain_config", lambda required=False: CHAIN)

    async def rpc(method: str, params: list[object]) -> object:
        return hex(arbitrum.EXPECTED_CHAIN_ID) if method == "eth_chainId" else receipt

    monkeypatch.setattr(arbitrum, "_rpc", rpc)
    asyncio.run(arbitrum.verify_stream_registration(
        TX_HASH,
        expected_stream_id=STREAM_ID,
        expected_creator=CREATOR,
        expected_pricing_model="pay_per_view",
        expected_price_atomic=1_500_000,
        expected_preview_seconds=30,
    ))

    with pytest.raises(arbitrum.ArbitrumVerificationError, match="price or preview"):
        asyncio.run(arbitrum.verify_stream_registration(
            TX_HASH,
            expected_stream_id=STREAM_ID,
            expected_creator=CREATOR,
            expected_pricing_model="pay_per_view",
            expected_price_atomic=2_000_000,
            expected_preview_seconds=30,
        ))
