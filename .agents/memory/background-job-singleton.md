---
name: Background job cross-instance singletons
description: Why always-running best-effort background jobs are wrapped in a Postgres advisory lock so Autoscale's multiple instances don't duplicate them.
---

# Background jobs must be cross-instance singletons

The api-server runs best-effort background jobs both on boot AND on a setInterval scheduler tick: outbound order-queue push, Stripe reconcile, embedding backfill, description backfill (plus the off-by-default inbound ERP sync). On Autoscale (>1 instance) each instance runs its own scheduler, so without coordination the same job runs N times concurrently — duplicate ERP order pushes, double-spent embed/LLM quota, redundant rate-limited ERP polls.

**Rule:** any always-running background job must be made a cross-instance singleton with `withAdvisoryLock(jobId, fn)` (`artifacts/api-server/src/lib/advisory-lock.ts`). It takes a NON-blocking `pg_try_advisory_lock` (two-int form: fixed namespace + stable per-job id) on a dedicated pooled connection; if another instance holds the lock, the job SKIPS this tick (returns false) rather than queueing behind it.

**Why a non-blocking skip is safe:** these are catch-up/retry backstops, not the primary path. Orders push to the ERP immediately at payment time; inbound webhooks keep stock/price fresh; `/stripe/verify` does an authoritative per-order reconcile. A skipped tick only delays the backstop until the next tick on whichever instance holds the lock.

**How to apply:**
- Put the lock INSIDE the job function (not only at the scheduler call site) so boot, scheduler, and request-path callers are all protected. Keep any in-process `running`/`processing` flag as a cheap same-process fast path.
- For a job whose return value matters (e.g. `runInboundSync` returns SyncResult), wrap at its single scheduler call site instead of restructuring the function.
- Acquire + release MUST be on the same session → the helper holds one dedicated `pool.connect()` for the job's duration; on unlock failure it destroys the connection (`client.release(err)`) so Postgres ends the session and frees the lock. Never recycle a possibly-locked connection.

**Caveat (op-risk, not a bug):** a long job (embedding backfill ~40 min) holds one pooled connection for its whole run. Default `pg` Pool max is 10, so it reserves ~1 slot during the run. If pool pressure ever appears, raise `Pool.max` or give the lock its own tiny pool.
