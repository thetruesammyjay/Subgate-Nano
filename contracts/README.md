# Subgate Nano Contracts

The contracts keep a minimal on-chain record for the streaming MVP:

- `SubgateStreamRegistry`: creator-owned stream registration, pricing, preview duration, and active status.
- `SubgateReceipts`: authorized, immutable session-settlement receipts.

Amounts use USDC atomic units: `1 USDC = 1_000_000` units. The contracts do not store video, accept custody, or meter heartbeats. FastAPI validates playback and handles settlement; the authorized settlement operator then records the resulting receipt.

## Commands

```bash
cd contracts
forge build
forge test
```

The first deploy flow should deploy `SubgateStreamRegistry` and pass its address plus the FastAPI settlement-operator wallet to `SubgateReceipts`.
