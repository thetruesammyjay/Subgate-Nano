# Subgate Nano web app

This Next.js App Router application contains the public stream viewer, creator
dashboard, and admin dashboard. The implementation map is documented in
[`FILE-STRUCTURE.md`](./FILE-STRUCTURE.md), and the visual contract is in the
repository-level [`DESIGN.md`](../../DESIGN.md).

Creator access is available at `/creator/login` and `/creator/register`; the
legacy `/login` route remains the wallet-signature compatibility flow. Admins
sign in at `/admin/login` using credentials seeded by the API. Next route
handlers set separate HttpOnly creator and admin cookies, while FastAPI remains
the source of truth for authentication, authorization, payments, and
persistence.
