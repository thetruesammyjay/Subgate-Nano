This scaffold establishes the first runnable slice of Subgate Nano:

- Monorepo root with `pnpm` workspaces and Turborepo
- Shared TypeScript config
- `@subgate/types` shared package
- `@subgate/db` shared database package with Drizzle schema and content queries
- `@subgate/api` Fastify app consuming the shared packages

Production-oriented defaults included:

- Explicit environment contracts via `.env.example` files
- Shared database schema and connection setup for PostgreSQL
- API catalog endpoint backed by the database layer instead of a hardcoded in-memory stub
- Shared pricing logic and access-grant service packages
- x402 seller flow aligned with Circle Gateway Nanopayments on Arc Testnet
- `apps/agent-demo` buyer flow using Circle GatewayClient for x402 payments

Local reference material:

- `canteen/context-arc`: Arc, Circle, Gateway, and x402 documentation snapshots
- `canteen/circle-agent`: minimal seller/buyer x402 batching demo
- `canteen/arc-nanopayments`: fuller seller dashboard and autonomous buyer-agent demo

The `canteen/` folder is intentionally ignored by Git and should remain local-only.

Local tooling installed:

- Circle CLI via `npm install -g @circle-fin/cli`

Next recommended slices:

1. `packages/wallets` for Circle/Gateway wallet operations and balance checks
2. `apps/web` using the local Nothing design skill as the visual reference
3. `apps/worker` for settlement indexing and streaming metering
