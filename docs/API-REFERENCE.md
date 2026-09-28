# Subgate Nano API Reference

This document covers the FastAPI service. For local development, start the API
from `apps/api` with `uv run uvicorn app.main:app --reload`; the base URL is
`http://127.0.0.1:8000`. OpenAPI documentation is available at `/docs`.

All amounts are integer USDC atomic units (6 decimals). Dates use ISO-8601 UTC
timestamps. Admin and creator endpoints require a bearer token unless marked
public. In the web app, these tokens are stored in HTTP-only cookies and the
Next.js routes proxy requests to this API.

## Authentication

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/challenge` | Public | Create a one-time wallet-signature challenge. |
| POST | `/auth/verify` | Public | Verify a challenge and create a wallet-based creator session. |
| POST | `/auth/creator/register` | Public | Register an email/password creator. New accounts start `pending` review. |
| POST | `/auth/creator/login` | Public | Sign in as a creator. |
| GET | `/auth/me` | Creator | Return the authenticated creator profile. |
| POST | `/auth/logout` | Creator | Revoke the current creator session. |
| POST | `/auth/admin/login` | Public | Sign in to a seeded admin account. |
| GET | `/auth/admin/me` | Admin | Return the authenticated admin profile. |
| POST | `/auth/admin/logout` | Admin | Revoke the current admin session. |

Admin users are provisioned from `ADMIN_EMAIL`, `ADMIN_USERNAME`, and
`ADMIN_PASSWORD` in `apps/api/.env`; there is no public admin registration.
After applying migrations, run `uv run python src/subgate_api/seed.py` from
`apps/api` to create or update that account.

## Public streams and viewing sessions

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/chain/status` | Public | Check the selected settlement mode, Arbitrum Sepolia RPC, and deployed token/contracts. |
| GET | `/streams` | Public | List published streams. |
| GET | `/streams/{slug}` | Public | Fetch a published stream by slug. |
| GET | `/streams/{slug}/payment-requirement` | Public | Get the configured Arbitrum USDC payment details or the legacy x402 requirement. |
| POST | `/streams` | Approved creator | Create a stream. In Arbitrum mode it remains unpublished until its registry transaction is verified. |
| POST | `/creator/streams/{stream_id}/chain-registration` | Creator owner | Verify the creator-signed registry transaction and optionally publish the stream. |
| POST | `/streams/{stream_id}/sessions` | Public | Verify the pay-per-view settlement transaction, then create a playable session; missing payment returns `402`. |
| GET | `/sessions/{session_id}` | Session ID | Read session usage and settlement state. |
| POST | `/sessions/{session_id}/playback-token` | Session ID | Issue a playback token for a playable session. |
| POST | `/sessions/{session_id}/heartbeat` | Session ID | Update metered playback usage. |
| POST | `/sessions/{session_id}/stop` | Session ID | Stop and settle a metered session. |
| GET | `/sessions/{session_id}/receipt` | Session ID | Fetch a settled receipt. |
| GET | `/playback/{stream_id}/manifest?token={token}` | Playback token | Validate playback access and redirect to the stream manifest. |

Session control currently uses the high-entropy session ID as a capability.
Avoid exposing session IDs in logs or public analytics; viewer wallet-signature
authorization for these operations is a future hardening step.

### Arbitrum Sepolia pay-per-view flow

Set `SUBGATE_SETTLEMENT_MODE=arbitrum` and configure `ARBITRUM_RPC_URL`,
`ARBITRUM_CHAIN_ID=421614`, `USDC_ADDRESS`,
`SUBGATE_STREAM_REGISTRY_ADDRESS`, and `SUBGATE_RECEIPTS_ADDRESS`. A creator
creates a stream, signs `registerStream` from their connected wallet, then posts
the transaction hash to `/creator/streams/{stream_id}/chain-registration`.
The API checks the transaction sender and the emitted stream ID, price, and
preview before making it public.

For a viewer session, the wallet first approves the receipt contract for the
exact USDC price, then calls
`settlePayPerView(session_id, stream_id, expected_amount_atomic)`. The contract
reverts if the registered price no longer matches the amount the viewer
approved. That single settlement transaction transfers the registered price to
the creator and emits the Subgate receipt with zero watch time (the purchase
precedes playback).
The web app posts `viewer_wallet`, `session_id`, and
`settlement_tx_hash` to `/streams/{stream_id}/sessions`. FastAPI verifies the
Arbitrum Sepolia chain, receipt-contract event, viewer, stream, amount, USDC
token, and matching USDC transfer before it creates a session or playback token.
The payment transaction hash is also returned by the receipt endpoint for an
explorer link.

The mode defaults to `arbitrum`; `local` is an explicit test/demo simulation
only and must not be used to claim an on-chain payment. `metered` settlement is
not enabled on Arbitrum yet, so the live demo should use pay-per-view streams.

## Creator workspace

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/creator/overview` | Creator | Return stream, session, watch-time, and settled-revenue totals. |
| GET | `/creator/settings` | Creator | Read creator preferences, using defaults until saved. |
| PATCH | `/creator/settings` | Creator | Save preview-length and notification preferences. |
| GET | `/creator/streams` | Creator | List the authenticated creator’s streams. |
| GET | `/creator/streams/{stream_id}` | Owner | Read one owned stream, including its playback URL and pricing. |
| PATCH | `/creator/streams/{stream_id}` | Owner | Edit stream fields or publish state. |
| DELETE | `/creator/streams/{stream_id}` | Owner | Unpublish an owned stream. |
| PATCH | `/creator/profile` | Creator | Update display name, username, or social links. |
| GET | `/creator/sessions` | Creator | List viewing sessions for the creator’s streams. |
| GET | `/creator/sessions/{session_id}` | Owner | Read a session only when it belongs to the creator. |
| GET | `/creator/receipts` | Creator | List settled receipts for the creator’s streams. |

Session and receipt lists accept `limit` (1–100, default 25) and `offset`
(default 0). `/creator/sessions` also accepts `session_status=active|completed`.
Creators with `pending`, `rejected`, or `suspended` review status can sign in
and view their workspace, but cannot create or publish streams.

## Admin operations

All routes in this section require an active admin bearer token.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/admin/overview` | Platform totals: creators, pending reviews, published streams, active sessions, settled count/amount, and API health marker. |
| GET | `/admin/creators` | Search and paginate creator accounts. |
| GET | `/admin/creators/{creator_id}` | Read creator profile and stream/session counts. |
| PATCH | `/admin/creators/{creator_id}/status` | Set `pending`, `approved`, `rejected`, or `suspended`; rejected/suspended accounts have published streams unpublished. |
| GET | `/admin/streams` | Search and paginate all streams; filter with `is_published=true|false`. |
| PATCH | `/admin/streams/{stream_id}/visibility` | Publish or unpublish a stream. Only approved creators may be published. |
| GET | `/admin/sessions` | List platform viewing sessions and their stream, creator, and settlement context. |
| GET | `/admin/settlements` | List payment records with stream, creator, viewer, amount, and transaction reference. |
| GET | `/admin/audit` | List admin login/logout, creator-status, and stream-visibility events. |
| GET | `/admin/reports/revenue` | Return daily settlement count and amount; accepts `days` from 1 to 365 (default 30). |
| GET | `/admin/settings` | Read non-secret effective network and settlement configuration. This endpoint is read-only; change settings through deployment environment configuration. |

Admin creator, stream, session, settlement, and audit lists accept `limit`
(1–100; 25 by default) and `offset` (0 by default). Creator search accepts
`q` and `approval_status`; stream search accepts `q` and `is_published`;
sessions accept `session_status`; audit accepts `event_type` and `entity_type`.
Settlements accept the optional `payment_status` filter.
List responses use `{ "items": [], "total": 0, "limit": 25, "offset": 0 }`.

### Review request examples

Approve a creator:

```http
PATCH /admin/creators/CREATOR_UUID/status
Authorization: Bearer ADMIN_TOKEN
Content-Type: application/json

{
  "approval_status": "approved",
  "reason": "Creator profile reviewed"
}
```

Unpublish a stream:

```http
PATCH /admin/streams/STREAM_UUID/visibility
Authorization: Bearer ADMIN_TOKEN
Content-Type: application/json

{
  "is_published": false,
  "reason": "Playback source needs review"
}
```

## Endpoints added for the dashboards

The following endpoints were added in this API expansion to back the creator
and admin workspace screens:

- Creator: `GET /creator/overview`, `PATCH /creator/profile`,
  `GET /creator/settings`, `PATCH /creator/settings`,
  `GET /creator/streams/{stream_id}`, `GET /creator/sessions`,
  `GET /creator/sessions/{session_id}`, and `GET /creator/receipts`.
- Admin: `GET /admin/overview`, `GET /admin/creators`,
  `GET /admin/creators/{creator_id}`, `PATCH /admin/creators/{creator_id}/status`,
  `GET /admin/streams`, `PATCH /admin/streams/{stream_id}/visibility`,
  `GET /admin/sessions`, `GET /admin/settlements`, `GET /admin/audit`,
  `GET /admin/reports/revenue`, and `GET /admin/settings`.
- Schema: creator review status and persisted admin audit events.

Apply the new migration before using these routes:

```powershell
cd apps/api
uv run python -m alembic -c alembic.ini upgrade head
uv run python src/subgate_api/seed.py
```

## Common responses

- `200 OK`: successful read or update.
- `201 Created`: successful account, stream, or session creation.
- `204 No Content`: successful logout or unpublish.
- `401 Unauthorized`: missing, invalid, expired, or revoked session token.
- `403 Forbidden`: authenticated account lacks the required role or creator approval.
- `404 Not Found`: requested resource does not exist or is not owned by the caller.
- `409 Conflict`: duplicate data or an invalid state transition.
- `422 Unprocessable Entity`: request validation failed.
- `402 Payment Required`: pay-per-view settlement is required; the response includes the configured chain and token details.

Errors are returned as JSON, usually with a `detail` field. FastAPI’s generated
OpenAPI document at `/openapi.json` is the canonical source for field-level
request and response schemas.
