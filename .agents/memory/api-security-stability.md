---
name: API security & stability
description: Rate limiting, transactional order writes, health/error logging on api-server
---

# API security & stability (api-server)

- **Rate limiting** is dependency-free, in-process (`src/middlewares/rateLimit.ts`): single-instance server, fixed-window per client IP. `generalLimiter` (300/min) mounted globally in `app.ts`; `writeLimiter` (20/min) on POST `/orders`, `/stripe/checkout`, `/stripe/verify`. **Why:** avoided express-rate-limit to dodge esbuild externalization risk; in-memory is enough for one instance.
  - Verified webhooks are EXEMPT via `skip` matching `req.path` `/api/webhooks/*` + `/api/stripe/webhook`. **How to apply:** any new verified-webhook route must be added to that skip set or it will get throttled.
  - `app.set("trust proxy", 1)` is required so `req.ip` is the real client behind Replit's edge proxy (not the proxy IP). Without it, all clients share one bucket.
  - OPTIONS is always allowed (CORS preflight must pass).

- **Order creation is transactional** (`routes/orders.ts`): product re-read with `.for("update")` + stock/existence validation + insert run inside `db.transaction`. Client-facing failures throw a local `OrderError(status, body)` to roll back, caught after the tx to send the HTTP response; unexpected errors rethrow to the central handler. `ensureUser` + `pushOrder` (network calls) stay OUTSIDE the tx so a remote call never holds a DB connection. **Why:** "all-or-nothing" + FOR UPDATE serializes concurrent orders for the same part.

- **Central error handler** (`src/middlewares/errorHandler.ts`) is the LAST `app.use`. Express 5 forwards rejected async handlers to it automatically — so async routes can `throw` and get logged (with method/path/requestId, no secrets/PII) + a generic 500. Logger already redacts auth/cookie headers.

- **Health** (`routes/healthz`) pings DB (`select 1`): 200 `status:ok` + `{uptime,timestamp,database:{ok,latencyMs}}`, 503 `degraded` when DB down. Spec shape lives in `lib/api-spec/openapi.yaml` `HealthStatus`; regen with `pnpm --filter @workspace/api-spec run codegen` after editing.

- Monitoring how-to: `artifacts/api-server/MONITORING.md` (deploy logs, log patterns by prefix Stripe:/Admintotal:/Healthcheck/Rate limit).
