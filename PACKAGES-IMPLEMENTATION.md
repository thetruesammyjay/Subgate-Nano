# Packages Implementation Map

This is the implementation plan for `packages/` after the FastAPI migration. The key rule is ownership: backend business logic belongs to Python in `apps/api`; TypeScript packages support the Next.js client and worker only. The API contract is the bridge between the two runtimes.

## Target layout

```text
apps/api/src/subgate_api/
  domain/
    pricing.py          # Pure PPV and per-minute calculations
    access.py           # Entitlements and playback-grant decisions
    streaming.py        # Heartbeat validation and metering rules
    payments.py         # USDC amounts and settlement lifecycle
    arbitrum.py         # Chain configuration and contract adapters
    x402.py             # Payment-required payloads and verification
  repositories/         # PostgreSQL persistence interfaces and implementations
  services/             # Orchestration of the domain modules
  routers/              # FastAPI route modules

packages/
  api-client/           # Typed frontend client generated from FastAPI OpenAPI
  types/                # Frontend-only DTOs generated from the same OpenAPI schema
  ui/                   # Shared React UI primitives
```

`apps/api` must not import a TypeScript package. The current TypeScript business-logic packages are migration sources, not long-term runtime dependencies for FastAPI.

## Package decisions

| Current package | Decision | Destination / responsibility |
| --- | --- | --- |
| `access` | Migrate, then retire | `domain/access.py`: viewer entitlement, expiry, playback grant and revocation rules. |
| `arbitrum` | Implement in Python | `domain/arbitrum.py`: chain IDs, USDC address, RPC client, contract event adapters. |
| `db` | Migrate, then retire | `apps/api/src/subgate_api/models` and `repositories/` with SQLAlchemy 2; Alembic migrations are owned by FastAPI. |
| `payments` | Migrate, then retire | `domain/payments.py`: decimal-safe USDC values, threshold and final settlements. |
| `pricing` | Migrate, then retire | `domain/pricing.py`: only `pay_per_view` and `metered` pricing. |
| `streaming` | Migrate, then retire | `domain/streaming.py`: signed playback claims, heartbeat validation, usage accrual. |
| `types` | Replace | Generated TypeScript API DTOs; no server domain model duplication. |
| `x402` | Migrate only if retained | `domain/x402.py`; isolate it because it is optional to the MVP payment adapter. |
| `arc`, `wallets` | Remove | Empty/obsolete Arc and Circle-agent remnants; neither fits the Arbitrum streaming MVP. |
| `ui` | Implement | Shared React components for player controls, price badges, session meter, and receipts. |

## Domain contracts

Use integer USDC atomic units (`1 USDC = 1_000_000` units) for every stored or settled amount. Convert to display decimals only in the client.

```python
# domain/pricing.py
class PayPerViewPricing(BaseModel):
    price_atomic: int

class MeteredPricing(BaseModel):
    rate_atomic_per_minute: int

def quote_ppv(pricing: PayPerViewPricing) -> int: ...
def accrue_metered(rate_atomic_per_minute: int, validated_seconds: int) -> int: ...
```

```python
# domain/streaming.py
class Heartbeat(BaseModel):
    session_id: UUID
    playback_position_seconds: int
    playing: bool

def validate_heartbeat(previous: SessionState, heartbeat: Heartbeat, now: datetime) -> int:
    """Return billable seconds; reject impossible drift or stale sessions."""
```

```python
# domain/payments.py
class SettlementGateway(Protocol):
    async def settle(self, request: SettlementRequest) -> SettlementResult: ...

def should_settle(pending_atomic: int, threshold_atomic: int, closing: bool) -> bool: ...
```

```python
# domain/access.py
def can_play(grant: PlaybackGrant, now: datetime) -> bool: ...
def issue_playback_claims(session: ViewingSession, ttl_seconds: int) -> PlaybackTokenClaims: ...
```

## Build order

1. **Contract first:** Define Pydantic request/response models in FastAPI and publish `/openapi.json`. Create `packages/api-client` from it so the Next.js app never hand-maintains API shapes.
2. **Pricing:** Port only PPV and per-minute logic to `domain/pricing.py`; delete legacy per-access, per-second, timed, and citation variants.
3. **Persistence:** Add SQLAlchemy models and Alembic migrations for `creators`, `streams`, `viewing_sessions`, `playback_tokens`, and `payments`. Do not carry forward article, integration, or Arc-wallet tables. The Next.js app accesses this data only through FastAPI; it never connects to PostgreSQL directly.
4. **Viewing session:** Implement start, heartbeat, pause, resume, stop, and receipt services. Validate time on the server and maintain usage in atomic units.
5. **Access and HLS:** Issue short-lived signed playback tokens only after PPV entitlement or an active metered session is present.
6. **Settlement:** Add an injectable Arbitrum/USDC settlement gateway. Ship a deterministic fake gateway for local development and tests before connecting the real adapter.
7. **Client packages:** Generate the API client, then build `ui` player and receipt components on top of it.
8. **Remove legacy packages:** Delete the TypeScript `access`, `db`, `payments`, `pricing`, `streaming`, `x402`, and old `types` packages only after all consumers have moved.

## First API slices

```text
POST /auth/challenge                   # request wallet sign-in message
POST /auth/verify                      # verify signature and issue bearer token
GET  /auth/me                          # current creator
POST /auth/logout                      # revoke current creator session
GET  /streams
GET  /streams/{slug}
GET  /streams/{slug}/payment-requirement
POST /streams                         # creator only
POST /streams/{stream_id}/sessions    # start PPV or metered session
POST /sessions/{session_id}/heartbeat
POST /sessions/{session_id}/stop
GET  /sessions/{session_id}/receipt
```

The x402 seam is also available for Circle mode: pay-per-view starts and metered stops challenge with `402 Payment Required`, validate the supplied signature, and persist the facilitator transaction reference.

The first implementation milestone is complete when a local fake payment gateway can create a metered session, accept validated heartbeats, stop it, and return a correct receipt—all through these FastAPI endpoints and with no TypeScript backend dependency.
