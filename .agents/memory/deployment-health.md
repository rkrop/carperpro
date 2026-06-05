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

## Autoscale is FINE for this app — do NOT push Reserved VM (revised)
- Production `deploymentType` is **autoscale** (live at autopartescarper.com). Earlier I thought the always-on scheduler made Reserved VM the right target. That was wrong once you read `lib/admintotal/scheduler.ts`:
  - The heavy ERP **inbound polling sync is OFF by default** (gated on `ADMINTOTAL_AUTO_SYNC=1`, which is NOT set). Catalog stock/price freshness comes from **inbound Admintotal webhooks** (real-time push) — which work fine on autoscale. The ~3-min targeted stock refresh is also only scheduled when auto-sync is on.
  - The scheduler tick that always runs is just best-effort: outbound order-queue retries, Stripe reconcile, and embedding/description enrichment. The PRIMARY paths (immediate ERP push on paid in stripe `service.ts`; Stripe webhook reconcile) happen during requests, not via the scheduler.
- So the only autoscale downside is that those best-effort retry/enrichment loops pause when the app idles to zero (resume on next request) and could run on >1 instance under load. Minor; harden in code if needed (queue claim/idempotency) rather than switching target.
- **Switching deployment type is DESTRUCTIVE on Replit:** it unpublishes & republishes, destroying the saved `*.replit.app` domain, deployment history/tiers, and forcing custom-domain re-setup. Not worth it here.
- **Bottom line:** the liveness health-check fix is what resolved the false outage. Recommend staying on autoscale.
- **How to change type if ever truly needed:** Publishing tool → **Manage** tab → "Change deployment type" (paid plans only). It's NOT in the main publish flow.
