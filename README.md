# Subgate Nano

### Pay only for what you consume.

Subgate Nano is a pay-per-view streaming platform built on Arbitrum. Viewers use USDC to watch premium videos and livestreams without committing to a monthly subscription.

Creators choose one focused pricing model per stream:

| Model | How it works |
| --- | --- |
| Pay per view | Pay once to unlock a video or livestream. |
| Pay as you watch | Pay for validated watch time at a per-minute rate. |

```
Start watching → pay as you watch → stop watching → stop paying
```

## For viewers

Open a stream, connect a USDC wallet, and begin watching. A metered session tracks validated playback; billing stops when the session ends. Every session produces a receipt with watch time, amount paid, and settlement status.

## For creators

Create a recorded video or livestream, select pay-per-view or pay-per-minute pricing, optionally set a free preview, then share the stream page. The creator dashboard surfaces revenue, live viewers, watch time, and settled sessions.

## Scope

The MVP is deliberately streaming-only: premium recorded video and live streams, USDC on Arbitrum, HLS playback, signed viewing sessions, and creator analytics. It does not include subscriptions, articles, Telegram distribution, an API marketplace, AI agents, social features, or multi-chain support.

## Technology

Next.js, React, TypeScript, Python, FastAPI, uv, SQLAlchemy, Alembic, PostgreSQL, Redis, HLS, USDC, Arbitrum, Solidity, Turborepo, and pnpm.

For architecture, package boundaries, data models, payment flow, and local setup, see [PROJECT-STRUCTURE.md](./PROJECT-STRUCTURE.md).

## Local development

```bash
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

## License

MIT
