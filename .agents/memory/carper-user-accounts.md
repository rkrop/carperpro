---
name: Carper user accounts (Clerk auth)
description: How optional Clerk auth ties favorites/addresses/orders to a central user in the Carper Expo app while keeping guest checkout intact.
---

# Carper optional user accounts (Replit-managed Clerk)

Auth is **optional** — guest checkout must always keep working. Login only upgrades
favorites/addresses/order-history from device-local to a central per-user record that
syncs across devices.

## Conventions / gotchas
- **Expo Clerk import is `@clerk/expo`** (NOT `@clerk/clerk-expo`); token cache is
  `@clerk/expo/token-cache`.
- API account routes live under `/api/me*` (account.ts), gated by
  `router.use("/me", requireAuth, provisionUser)`. `requireAuth` → 401 when no session.
- Server reads auth from **bearer token (native) OR Clerk cookie (web same-origin)** via
  the global `clerkMiddleware`. `getOptionalUserId(req)` returns null for guests.

## Order ownership rule (IDOR guard)
Orders carry a nullable `userId`. Any endpoint that returns an order by id/session
(e.g. `GET /api/stripe/order/:id`, `POST /api/stripe/verify`) MUST:
`if (order.userId && order.userId !== getOptionalUserId(req)) return 404`.
**Why:** account-linked orders are private; guest orders (userId null) stay readable so the
guest flow keeps working. Use 404 (not 403) to avoid leaking existence.

## Confirmation-after-checkout (signed-in)
The order is created server-side first; `AppContext.addOrder` then **optimistically seeds**
the order-history cache (`queryClient.setQueryData(getListMyOrdersQueryKey(), ...)`,
prepend, dedup by `folio`) BEFORE `invalidateQueries`. Confirmation looks up by `folio`
only — never falls back to `orders[0]` (that showed the wrong order). A `folio`-only
loading placeholder covers the brief window before the record propagates.

## Checkout prefill
Address and profile prefill use **separate refs** (a slower `/me/addresses` must not be
skipped by a faster `/me`). Prefill only fills blank fields (`setX(v => v || ...)`), and
must NOT auto-switch delivery mode (no `setEntrega("envio")`) — fields sit ready for if the
shopper picks envío.

## api-server dev script has no watch
`dev` = `build && start`. After editing routes you MUST restart the workflow, or the running
server serves stale code (symptom: new route 404s "Cannot GET").
