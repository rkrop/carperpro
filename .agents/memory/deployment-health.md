---
name: Deployment health check & autoscale fit
description: Why /api/healthz must be liveness-only, and why this app fits Reserved VM better than autoscale.
---

# Production deployment: health check & target

## /api/healthz must be liveness-only (not DB-gated)
- The deploy platform's startup probe AND the uptime monitor hit `/api/healthz` (set in `artifacts/api-server/.replit-artifact/artifact.toml` → `[services.production.health.startup]`).
- It must return **200 when the process is serving**. The DB is probed with a bounded timeout and reported as `status:"degraded"`/`database.ok:false`, but a DB miss MUST NOT return 5xx.
- **Why:** the old version returned 503 the instant `select 1` failed. On an autoscale cold start the first query has to wake the suspended managed Postgres → slow/failed → 503 → the uptime monitor recorded a false-positive outage that "recovered" once warm. Real DB outages still surface as 5xx on actual data endpoints.
- **How to apply:** never reintroduce a hard 503 on the health endpoint for a transient DB blip; keep the DB ping time-bounded.

## Autoscale vs Reserved VM mismatch (not yet changed — needs user consent, cost)
- Production `deploymentType` is **autoscale** (live at autopartescarper.com). The api-server runs an always-on background scheduler (Admintotal inbound sync + outbound order queue, `setInterval` in `lib/admintotal/scheduler.ts`) plus heavy self-healing boot backfills (catalog import, embeddings, descriptions).
- Autoscale scales to zero (scheduler STOPS with no traffic) and runs N instances under load (N concurrent schedulers hammering the rate-limited ERP + duplicate backfills). That background/stateful work fits **Reserved VM** (always-on, single instance), which also removes cold-start blips.
- **Why not done:** switching target is a cost + re-publish decision the user owns. The health-check fix alone resolves the reported false-positive outage on either target.
