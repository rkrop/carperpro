# Threat Model

## Project Overview

Carper is a public-facing auto-parts commerce platform with an Express 5 API (`artifacts/api-server`), an Expo mobile app (`artifacts/carper`), and a Vite storefront (`artifacts/tienda`). The production system uses PostgreSQL via Drizzle, Clerk for primary authentication, a custom Twilio Verify phone-OTP flow for secondary authentication, Stripe for card payments, AdminTotal for ERP sync/order fulfillment, and AI-backed catalog search/assistant features. Replit provides TLS at the platform edge; this model focuses on production-reachable application behavior.

## Assets

- **User accounts and sessions** — Clerk-backed sessions, phone OTP session tokens, and local user rows. Compromise allows impersonation and access to saved addresses, favorites, and account-linked orders.
- **Order and checkout data** — order contents, totals, fulfillment status, payment state, branch selection, phone numbers, and shipping addresses. This is both business-sensitive and customer-sensitive data.
- **Payment integrity** — Stripe Checkout sessions, payment status transitions, refund paths, and the local order queue. Weaknesses here can lead to fraud, order tampering, or unauthorized disclosure of purchase activity.
- **Catalog and ERP trust** — product metadata, price/stock updates, and outbound order pushes synchronized with AdminTotal. Unauthorized mutation would directly affect what customers can buy and what the business fulfills.
- **Push/SMS delivery channels** — Expo push tokens and Twilio messaging/verification credentials. Abuse can enable spam, account takeover support flows, or disclosure of customer activity.
- **Application secrets and connector credentials** — database connection string, Stripe/Twilio/AI connector credentials, Clerk secret key, and webhook shared secrets. Exposure would grant privileged access to external systems.

## Trust Boundaries

- **Browser/mobile client to API** — all request bodies, query params, headers, and deep-link return URLs are untrusted until validated server-side.
- **API to PostgreSQL** — the API can read and mutate all commerce data; injection or broken authorization here exposes the full application dataset.
- **API to external services** — Stripe, Twilio, AdminTotal, OpenAI, Gemini, Expo Push, and the postal code proxy each receive data that must be bounded and authenticated appropriately.
- **Public to authenticated surfaces** — catalog browsing, OTP start/verify, assistant/scan, push registration, checkout, and some Stripe order lookups are public; `/api/me` surfaces are authenticated. The distinction must be enforced server-side, not by client assumptions.
- **Guest to account-linked orders** — guest checkout stays enabled, but guest-readable flows must not disclose other customers' order data or become enumerable.
- **External callback to API** — Stripe and AdminTotal call into public endpoints. Those routes must authenticate the sender and avoid letting unverified traffic bypass protections.
- **Production to dev-only workspace code** — `artifacts/mockup-sandbox`, most `scripts/`, local skill folders, and package-development helpers are normally out of scope unless production reachability is demonstrated.

## Scan Anchors

- Production entry points: `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`, `artifacts/carper/app/_layout.tsx`, `artifacts/tienda/src/main.tsx`.
- Highest-risk server areas: `src/routes/stripe.ts`, `src/lib/stripe/service.ts`, `src/routes/orders.ts`, `src/routes/auth.ts`, `src/routes/account.ts`, `src/routes/webhooks.ts`, `src/middlewares/requireAuth.ts`, `src/lib/phoneSession.ts`.
- Public surfaces: catalog/search, postal codes, phone OTP, assistant chat, visual scan, push/restock registration, Stripe return/verify/order routes.
- Authenticated surfaces: `/api/me` profile/favorites/addresses/orders.
- Dev-only areas usually skip: `artifacts/mockup-sandbox`, `scripts/`, package publishing/build helpers unless they are invoked in production request paths.

## Threat Categories

### Spoofing

This project accepts both Clerk sessions and custom `cps_` bearer tokens for authentication, and it also accepts inbound callbacks from Stripe and AdminTotal. The system must only treat requests as authenticated when the session or webhook proof is verified server-side, session tokens are unpredictable and expired correctly, and no route allows an attacker to impersonate a user or trusted integration by supplying a guessed identifier or forged header.

The phone OTP path delegates code issuance and code-check attempt ceilings to Twilio Verify. Future scans should treat Twilio's built-in verification attempt caps as an existing control unless the application adds a bypass around that service or exposes an alternate local verification path.

### Tampering

Customers can submit carts, delivery details, checkout parameters, push tokens, and OTP inputs; external systems can submit price and stock changes. The API must recompute prices and totals from authoritative data, bound and validate all user-controlled inputs, and ensure that public endpoints cannot mutate catalog, order, or notification state beyond what the business explicitly allows.

### Information Disclosure

The platform handles order details, addresses, phone numbers, saved account data, and connector-backed operational data. Public endpoints must not expose account-linked or guest order information through predictable identifiers, verbose errors, reflective redirects, logs, or over-broad API responses. Secrets, session material, and sensitive PII must never be returned to clients or written to logs.

### Denial of Service

Several public endpoints trigger expensive work: OTP sends/checks, Stripe checkout creation, image-based scan requests, LLM-backed assistant requests, postal-code lookups, and webhook-driven catalog updates. The production service must apply effective abuse controls so unauthenticated users cannot exhaust SMS quotas, model quotas, database capacity, or external API budgets through repeated requests or oversized payloads.

### Elevation of Privilege

The most important privilege boundaries are between unauthenticated users, authenticated users, guest orders, and trusted external integrations. The system must prevent IDOR on order/account resources, reject open redirects that let attackers reuse trusted payment endpoints, ensure public routes cannot read or act on another user's data, and preserve server-side authorization even when the client supplies identifiers or destination URLs.