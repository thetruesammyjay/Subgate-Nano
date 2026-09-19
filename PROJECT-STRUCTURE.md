# Subgate Nano — Project Structure

This document describes the focused streaming MVP. For the product overview, see [README.md](./README.md).
For the package migration and implementation sequence, see [PACKAGES-IMPLEMENTATION.md](./PACKAGES-IMPLEMENTATION.md).

## Architecture

```mermaid
graph TD
  V[Viewer Web App] --> API[FastAPI]
  C[Creator Dashboard] --> API
  P[HLS Player] --> API
  API --> A[Access and Playback Tokens]
  API --> M[Metered Session Service]
  M --> W[Worker]
  API --> DB[(PostgreSQL)]
  W --> R[(Redis)]
  W --> U[USDC Settlement]
  U --> ARB[Arbitrum]
  P --> H[Signed HLS URL]
```

## Workspace layout

```text
apps/
  web/       Next.js: viewer discovery, playback, receipts, creator dashboard
  api/       Python FastAPI: catalogue, sessions, payments, playback authorization
  worker/    Heartbeat expiry, metering, settlement, and analytics jobs
packages/
  db/        Legacy TypeScript database layer; removed after Python migration
  streaming/ HLS helpers, playback tokens, heartbeat validation
  payments/  USDC amounts and settlement interfaces
  arbitrum/  Chain configuration and contract clients
  access/    Playback grants and expiry
  pricing/   Pay-per-view and per-minute pricing
  x402/      Payment requirement and verification helpers
  types/     Shared TypeScript contracts
contracts/
  src/       Stream registry and viewing-receipt contracts
  test/      Contract tests
  script/    Deployment scripts
```

## Core flows

### Pay per view

1. Viewer requests a stream.
2. API returns a USDC payment requirement.
3. Settlement is confirmed on Arbitrum.
4. API creates a playback entitlement and short-lived HLS token.

### Pay as you watch

1. Viewer creates a signed stream session with a maximum spend.
2. The player sends a heartbeat every five seconds while playing.
3. The server validates elapsed time and accrues USDC off-chain.
4. The worker settles at a configured threshold and once more when the session stops.
5. The viewer receives a final receipt; the creator dashboard updates.

The server uses timestamps, heartbeat cadence, playback state, and bounded drift; it never trusts a client-provided position alone. Sessions without a heartbeat for 30 seconds are paused or closed.

## Data model

The application persists creators, streams, viewing sessions, playback/access grants, payments, and fee-ledger records. A stream stores its type (`video` or `livestream`), playback reference, pricing model, fixed price or per-minute rate, free-preview duration, and publication status. A session stores validated seconds, accrued/settled USDC, heartbeat time, and its lifecycle state.

## Environment

```env
DATABASE_URL=
REDIS_URL=
ARBITRUM_RPC_URL=
ARBITRUM_CHAIN_ID=421614
USDC_ADDRESS=
PLAYBACK_TOKEN_SECRET=
STREAMING_HEARTBEAT_INTERVAL_SECONDS=5
STREAMING_SESSION_TIMEOUT_SECONDS=30
STREAMING_SETTLEMENT_THRESHOLD_USDC=0.10
```

The API uses `uv`. Run it with `uv run --directory apps/api fastapi dev src/subgate_api/main.py`.

## Database migrations

FastAPI owns the database. SQLAlchemy models live in `apps/api/src/subgate_api/models`, repositories live in `apps/api/src/subgate_api/repositories`, and Alembic revisions live in `apps/api/alembic/versions`.

```bash
pnpm db:revision -- "add streams and viewing sessions"
pnpm db:migrate
pnpm db:seed
```

The hackathon target is Arbitrum Sepolia; production targets Arbitrum One.

## MVP boundaries

Required: creator authentication, wallet connection, stream creation, both pricing models, free preview, HLS playback, signed sessions, heartbeats, metered usage, USDC settlement, receipts, and creator analytics.

Excluded: subscriptions, articles, Telegram, generic API monetization, AI agents, NFTs, chat, social feeds, tipping, creator tokens, and multi-chain support.
