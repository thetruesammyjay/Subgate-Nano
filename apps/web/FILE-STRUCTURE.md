# Subgate Nano frontend file structure

This document describes the intended Next.js App Router structure for the
Subgate Nano web application. It is based on `DESIGN.md` and separates the
public viewer experience, creator dashboard, and admin dashboard while keeping
shared visual primitives in one place.

The tree below is a living implementation map. Entries marked `[current]`
already exist; entries marked `[planned]` are future implementation boundaries
and may or may not have a placeholder yet. Route-group folders such as `(auth)`
and `(public)` are optional because they do not change the URL; they may be
added when the route count grows.

## Target tree

```text
apps/web/
|-- app/
|   |-- layout.tsx                         # [current] Root metadata and providers
|   |-- page.tsx                           # [current] Public landing page
|   |-- globals.css                        # [current] Design tokens and global styles
|   |-- how-it-works/page.tsx              # [current] Viewer access and payment flow
|   |-- for-creators/page.tsx              # [current] Creator product overview
|   |-- payments/page.tsx                  # [current] Pay-per-view and metered model guide
|   |
|   |-- login/                             # Legacy wallet sign-in entry
|   |   |-- page.tsx
|   |   `-- login-form.tsx
|   |-- creator/
|   |   |-- login/page.tsx                  # Creator email/password sign-in
|   |   |-- login/login-form.tsx
|   |   |-- register/page.tsx               # Creator registration
|   |   `-- register/register-form.tsx
|   |
|   |-- streams/
|   |   |-- page.tsx                       # [current] Public stream directory
|   |   `-- [slug]/
|   |       |-- page.tsx                   # [current] Stream viewer and paywall
|   |       |-- loading.tsx                # [planned] Viewer loading state
|   |       |-- error.tsx                  # [planned] Recoverable viewer error
|   |       |-- not-found.tsx              # [planned] Unknown stream state
|   |       `-- viewer-client.tsx           # [planned] Playback and session client
|   |
|   |-- dashboard/                         # Creator workspace
|   |   |-- layout.tsx                     # [planned] Creator shell and auth guard
|   |   |-- page.tsx                       # [current] Creator overview entry
|   |   |-- loading.tsx                    # [planned] Dashboard shell skeleton
|   |   |-- error.tsx                      # [planned] Dashboard error boundary
|   |   |-- streams/
|   |   |   |-- page.tsx                   # [planned] Creator stream inventory
|   |   |   |-- new/page.tsx               # [planned] Create a stream
|   |   |   `-- [streamId]/
|   |   |       |-- page.tsx               # [planned] Stream details and metrics
|   |   |       |-- edit/page.tsx          # [planned] Edit stream metadata
|   |   |       `-- loading.tsx            # [planned] Stream detail skeleton
|   |   |-- sessions/
|   |   |   |-- page.tsx                   # [planned] Viewer session history
|   |   |   `-- [sessionId]/page.tsx       # [planned] Session and receipt detail
|   |   |-- receipts/page.tsx              # [planned] Creator settlement receipts
|   |   |-- profile/page.tsx               # [planned] Creator profile
|   |   `-- settings/page.tsx              # [planned] Creator preferences
|   |
|   |-- admin/                             # Platform operations workspace
|   |   |-- layout.tsx                     # Admin shell and role guard
|   |   |-- login/page.tsx                 # Seeded admin sign-in
|   |   |-- login/login-form.tsx
|   |   |-- page.tsx                       # Admin overview
|   |   |-- loading.tsx                    # [planned] Admin shell skeleton
|   |   |-- creators/page.tsx              # [planned] Creator review and search
|   |   |-- streams/page.tsx               # [planned] Platform stream moderation
|   |   |-- sessions/page.tsx              # [planned] Active and historical sessions
|   |   |-- settlements/page.tsx           # [planned] Settlement queue
|   |   |-- reports/page.tsx               # [planned] Operational reports
|   |   |-- audit/page.tsx                 # [planned] Audit log
|   |   `-- settings/page.tsx              # [planned] Platform settings
|   |
|   `-- api/                               # Next route handlers (BFF boundary)
|       `-- auth/
|           |-- creator/login/route.ts     # Creator password login proxy
|           |-- creator/register/route.ts  # Creator registration proxy
|           |-- admin/login/route.ts       # Seeded admin login proxy
|           |-- admin/logout/route.ts      # Admin session revocation proxy
|           |-- login/route.ts              # Wallet compatibility proxy
|           |-- logout/route.ts             # Creator session revocation proxy
|           |-- challenge/route.ts          # Wallet challenge proxy
|           |-- verify/route.ts             # Signature verification proxy
|           `-- session/route.ts          # Current-user/session proxy
|       |-- streams/
|       |   `-- [slug]/sessions/route.ts  # Viewer payment/session proxy
|       `-- creator/
|           `-- streams/[streamId]/chain-registration/route.ts # Creator registration verification proxy
|
|-- components/
|   |-- site-header.tsx                    # [current] Public navigation
|   |-- site-footer.tsx                    # [current] Linked public footer
|   |-- brand-mark.tsx                     # [planned] Logo/wordmark using public assets
|   |-- floating-icons.tsx                 # [current] Decorative landing visuals
|   |-- logout-button.tsx                  # [current] Session logout action
|   |
|   |-- ui/                                # Shared, low-level interface primitives
|   |   |-- button.tsx
|   |   |-- icon-button.tsx
|   |   |-- input.tsx
|   |   |-- textarea.tsx
|   |   |-- select.tsx
|   |   |-- checkbox.tsx
|   |   |-- dialog.tsx
|   |   |-- drawer.tsx
|   |   |-- dropdown-menu.tsx
|   |   |-- tabs.tsx
|   |   |-- tooltip.tsx
|   |   |-- status-badge.tsx
|   |   |-- toast.tsx
|   |   |-- skeleton.tsx
|   |   |-- empty-state.tsx
|   |   `-- pagination.tsx
|   |
|   |-- navigation/
|   |   |-- dashboard-sidebar.tsx           # Shared shell behavior
|   |   |-- mobile-bottom-nav.tsx           # Compact mobile navigation
|   |   |-- mobile-nav-drawer.tsx
|   |   `-- breadcrumb.tsx
|   |
|   |-- streams/
|   |   |-- stream-card.tsx                 # Directory and dashboard card
|   |   |-- stream-price.tsx                # Price and access label
|   |   |-- stream-status.tsx
|   |   |-- playback-player.tsx             # Player frame and controls
|   |   |-- payment-required-panel.tsx      # x402 payment prompt
|   |   |-- session-meter.tsx               # Usage/time/payment state
|   |   `-- receipt-card.tsx
|   |
|   |-- dashboards/
|   |   |-- dashboard-icons.tsx            # [current] Hugeicons aliases used by workspaces and public UI
|   |   |-- metric-card.tsx                 # Live now, published, revenue, etc.
|   |   |-- data-table.tsx
|   |   |-- filter-bar.tsx
|   |   |-- activity-feed.tsx
|   |   |-- settlement-queue.tsx
|   |   |-- moderation-panel.tsx
|   |   |-- stream-table.tsx
|   |   |-- session-table.tsx
|   |   |-- creator-table.tsx
|   |   `-- dashboard-date-range.tsx
|   |
|   `-- wallet/
|       |-- wallet-button.tsx
|       |-- wallet-address.tsx
|       |-- connect-wallet-dialog.tsx
|       `-- network-warning.tsx
|
|-- features/                              # Feature-specific composition
|   |-- auth/
|   |   |-- wallet-login.tsx
|   |   |-- auth-status.tsx
|   |   `-- auth-boundary.tsx
|   |-- creator/
|   |   |-- creator-sidebar.tsx
|   |   |-- creator-header.tsx
|   |   |-- creator-overview.tsx
|   |   |-- stream-editor.tsx
|   |   |-- stream-form.tsx
|   |   |-- creator-stream-list.tsx
|   |   `-- creator-settlement-feed.tsx
|   |-- admin/
|   |   |-- admin-sidebar.tsx
|   |   |-- admin-header.tsx
|   |   |-- admin-overview.tsx
|   |   |-- approval-queue.tsx
|   |   |-- admin-settlement-table.tsx
|   |   `-- audit-log-table.tsx
|   `-- viewer/
|       |-- stream-viewer.tsx
|       |-- unlock-flow.tsx
|       |-- viewer-session-panel.tsx
|       `-- viewer-receipt.tsx
|
|-- hooks/
|   |-- use-auth-session.ts                # Current authenticated user
|   |-- use-wallet.ts                      # Wallet connection/signing state
|   |-- use-streams.ts                     # Public stream queries
|   |-- use-creator-streams.ts             # Creator-owned stream queries
|   |-- use-viewing-session.ts             # Viewer access/session lifecycle
|   |-- use-payment.ts                     # x402 payment state
|   |-- use-media-query.ts                 # Responsive behavior
|   `-- use-mobile-nav.ts                  # Drawer/bottom-nav state
|
|-- lib/
|   |-- subgate-api.ts                     # [current] Legacy API helpers to migrate
|   |-- dashboard-auth.ts                  # [current] Legacy dashboard auth helper
|   |-- api-client.ts                      # [planned] Typed FastAPI client
|   |-- api-errors.ts                      # [planned] Normalized API errors
|   |-- auth.ts                            # [planned] Cookie/session helpers
|   |-- wallet.ts                          # [planned] Wallet and signature helpers
|   |-- arbitrum.ts                        # Arbitrum Sepolia wallet transactions and receipt links
|   |-- x402.ts                            # [planned] Legacy x402 payment helpers
|   |-- formatters.ts                      # [planned] Dates, money, addresses, durations
|   |-- validators.ts                      # [planned] Shared client form validation
|   |-- routes.ts                          # [planned] Central route constants
|   `-- dashboard-nav.ts                   # [planned] Creator/admin navigation config
|
|-- types/
|   |-- api.ts                             # API response/request types
|   |-- auth.ts                            # User, wallet, session types
|   |-- stream.ts                          # Stream and access policy types
|   |-- session.ts                         # Viewing session types
|   |-- payment.ts                         # Payment and receipt types
|   |-- dashboard.ts                       # Metrics, tables, activity types
|   `-- x402.ts                            # x402 request/settlement types
|
|-- providers/
|   |-- app-providers.tsx                  # Root client provider composition
|   |-- auth-provider.tsx                  # Auth/session context
|   `-- wallet-provider.tsx                # Wallet provider adapter (if required)
|
|-- public/
|   |-- subgate-logo.png                   # [current] Primary wordmark
|   |-- subgate-ico.png                    # [current] Favicon/app icon
|   |-- images/
|   |   |-- streams/                       # Stream thumbnails and posters
|   |   |-- creators/                      # Creator avatars (non-user-upload fallback)
|   |   `-- backgrounds/                   # Deliberate decorative textures only
|   |-- icons/                             # Product-specific SVG/PNG icons
|   `-- fonts/                             # Only self-hosted fonts approved for the brand
|
|-- tests/
|   |-- components/                        # UI primitive and feature tests
|   |-- app/                               # Route-level rendering tests
|   |-- fixtures/                          # API and wallet fixtures
|   `-- e2e/                               # Viewer, creator, and admin journeys
|
|-- .env.example                           # [current] Browser-safe environment template
|-- next.config.ts                         # [current] Next.js configuration
|-- next-env.d.ts                          # [current] Next.js generated types
|-- package.json                           # [current] Scripts and workspace dependencies
|-- tsconfig.json                           # [current] TypeScript configuration
|-- middleware.ts                          # [planned] Lightweight cookie/role redirects
|-- README.md                              # [planned] Web app setup and route notes
`-- FILE-STRUCTURE.md                      # This document
```

## Route ownership

| Area | URL examples | Primary shell | Data boundary |
| --- | --- | --- | --- |
| Public | `/`, `/how-it-works`, `/for-creators`, `/payments`, `/streams`, `/streams/:slug` | `site-header` and shared `site-footer` | Server components call the typed API client; viewer interactions use client components |
| Auth | `/creator/login`, `/creator/register`, `/admin/login` | Role-specific auth layouts | Next route handlers proxy FastAPI auth endpoints and set separate HttpOnly creator/admin cookies |
| Creator | `/dashboard`, `/dashboard/streams`, `/dashboard/sessions` | Creator sidebar on desktop, bottom navigation on mobile | Protected FastAPI creator endpoints |
| Admin | `/admin`, `/admin/creators`, `/admin/settlements` | Admin sidebar on desktop, drawer/bottom navigation on mobile | Protected FastAPI admin endpoints |

The browser must never connect directly to the database or contain privileged
admin credentials. Next route handlers are a thin boundary for cookies,
redirects, and browser-safe request shaping; FastAPI remains the source of
truth for authentication, authorization, payments, and persistence.

## Shared component boundaries

- `components/ui` contains visual primitives with no Subgate business rules.
- `components/streams` contains reusable stream and viewer presentation.
- `components/dashboards` contains tables, metrics, filters, and states shared
  by creator and admin workspaces.
- `features/creator`, `features/admin`, and `features/viewer` compose those
  primitives around a specific workflow.
- A route `page.tsx` owns data loading and page composition; it should not grow
  into a global component library.
- Dashboard shells own navigation and responsive layout. They do not own API
  mutation logic; mutations live in `lib`, hooks, or feature components.

## Responsive implementation map

The desktop wireframes in `DESIGN.md` use a persistent sidebar and two-column
content where appropriate. At mobile widths:

- Creator navigation becomes `mobile-bottom-nav` with Overview, Streams,
  Sessions, and Menu destinations.
- Admin navigation becomes a drawer plus a compact bottom navigation for
  Overview, Approvals, Settlements, and More.
- Stream editors collapse from two columns to a single ordered form.
- Tables become stacked rows or horizontal scroll containers; primary actions
  remain reachable without hover.
- The stream viewer keeps the player and unlock action above secondary metadata.

## Data and authentication flow

```text
Browser
  |-- public server component --------------------> FastAPI public stream API
  |-- Next route handler (cookie/BFF) ------------> FastAPI auth API
  |-- creator/admin server component ------------> FastAPI protected API
  `-- viewer client + wallet -- x402 payment ----> FastAPI session/payment API
                                                        |
                                                        `--> PostgreSQL
```

Wallet signatures prove control of an address. The resulting opaque session is
stored in an HttpOnly cookie; client components may read session status through
the app boundary but should not receive long-lived secrets.

## Suggested implementation order

1. Replace the temporary header mark with `subgate-logo.png` and add the shared
   UI tokens/states described in `DESIGN.md`.
2. Consolidate `lib/subgate-api.ts` and `lib/dashboard-auth.ts` into a typed
   FastAPI client plus challenge/verify/session route handlers.
3. Build the creator shell and stream inventory/editor first, including the
   mobile navigation and loading/empty/error states.
4. Build the public stream viewer and x402 unlock flow using the same stream
   primitives.
5. Add the admin shell, moderation, settlement queue, and audit views.
6. Add component, route, and end-to-end tests, then review each route at the
   mobile and desktop breakpoints from `DESIGN.md`.

This map intentionally leaves implementation files marked `[planned]` until
their corresponding feature is built and tested.
