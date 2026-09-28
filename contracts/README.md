# Subgate Nano Contracts

The Arbitrum Sepolia demo uses two contracts:

- `SubgateStreamRegistry`: creator-owned stream registration, pricing, preview duration, and active status.
- `SubgateReceipts`: charges a pay-per-view price in USDC and records the receipt in the same transaction. The older operator-only method is reserved for future metered settlement; it deliberately records a zero payment-token address because it does not transfer tokens.

Amounts use USDC atomic units: `1 USDC = 1_000_000` units. The contracts do not store video or meter heartbeats. For pay-per-view, the viewer approves the receipt contract for the exact stream price and calls `settlePayPerView(sessionId, streamId, expectedAmountAtomic)`. The contract reverts if the registered price changed after the viewer reviewed it. USDC goes directly to the registered creator and the immutable receipt is emitted atomically. FastAPI checks both the settlement event and the USDC `Transfer` event before it grants playback.

## Commands

```bash
cd contracts
forge build
forge test
```

## Arbitrum Sepolia deployment

The creator signs `registerStream` directly from the wallet saved on their Subgate account. The API keeps a new stream unpublished until it confirms the matching `StreamRegistered` event. The viewer then signs an exact USDC approval followed by `settlePayPerView`. The API verifies the contract receipt and only then issues a playback token.

Deploy to **Arbitrum Sepolia (chain ID 421614)**. In Remix, compile both source files with Solidity 0.8.24, deploy `SubgateStreamRegistry`, then deploy `SubgateReceipts` with these constructor arguments:

1. The deployed registry address.
2. A non-zero settlement-operator address (reserved for metered settlement; no private key is needed by FastAPI for pay-per-view).
3. The official USDC token contract address for Arbitrum Sepolia: `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`. Circle lists this as its Arbitrum Sepolia testnet token; do not substitute USDC.e or the Arbitrum One address. See [Circle's current USDC contract list](https://developers.circle.com/stablecoins/usdc-contract-addresses).

Copy the deployed addresses into `apps/api/.env`:

```dotenv
ARBITRUM_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
ARBITRUM_CHAIN_ID=421614
USDC_ADDRESS=0x...
SUBGATE_STREAM_REGISTRY_ADDRESS=0x...
SUBGATE_RECEIPTS_ADDRESS=0x...
SUBGATE_SETTLEMENT_MODE=arbitrum
```

Restart FastAPI, then check `GET http://127.0.0.1:8000/chain/status`. It reports ready only when the RPC is on Arbitrum Sepolia and the token and both contracts have deployed bytecode. Never put a deployer private key in the API or web environment. Fund demo wallets with Sepolia ETH for gas and the matching Sepolia USDC token.

The registry ID is `keccak256(stream UUID bytes)`. Receipt IDs use the API session UUID left-padded to `bytes32`; the web client and API share these encodings. After registration, changing a stream's price or preview duration through the API is blocked until an on-chain update flow is added.
