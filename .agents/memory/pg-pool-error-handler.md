---
name: pg pool error handler (crash-loop fix)
description: Why the deployed API needs 'error' listeners on the pg Pool AND on long-held checked-out clients, or managed-Postgres idle drops crash-loop production.
---

# pg unhandled 'error' = production crash-loop

## Symptom
Deployed API showed many short outage windows in a day. Deployment logs:
`error: terminating connection due to administrator command` (severity FATAL) →
`Emitted 'error' event on Client/BoundPool instance` → `throw er; // Unhandled
'error' event` → `artifact process exited (exit status 1)` → `crash loop
detected` → SIGKILL. Each crash ≈ one outage window.

## Root cause
Managed Postgres terminates IDLE connections (scale-down/maintenance). pg emits
an `'error'` event for that client. A Node EventEmitter with no `'error'`
listener THROWS, killing the whole process. Our pool (`lib/db/src/index.ts`)
had no listener.
**The Gemini 429 embeddings error in the same logs is a red herring — it's logged
"no fatal" and never crashes anything.**

## Fix (two listeners, both required)
1. `pool.on('error', …)` on the shared pool — covers IDLE pooled clients. This is
   the dominant fix.
2. A listener on the CHECKED-OUT client inside `withAdvisoryLock`
   (`artifacts/api-server/src/lib/advisory-lock.ts`). The pool stops watching a
   client's errors once it's checked out, and the embedding/description backfills
   hold that client for MINUTES, so a mid-run disconnect would crash with the
   pool handler alone.

## Gotchas that bit us
- The checked-out-client listener MUST be a NAMED handler removed
  (`client.removeListener`) before EVERY `client.release()`. Pooled clients are
  reused; an anonymous re-added listener accumulates →
  MaxListenersExceededWarning + leak on a hot scheduled path.
- On disconnect Postgres auto-frees the advisory lock, so the client listener
  also sets a `connectionDied` flag; the finally block then skips the unlock
  query and destroys the connection (`release(err)`) instead of recycling it —
  don't keep running singleton work after the lock is gone.
- Last-resort `process.on('uncaughtException')` (log + exit for clean restart)
  and `unhandledRejection` (log, keep serving) added in
  `artifacts/api-server/src/index.ts` as defense-in-depth — NOT the real fix.

**Why it matters:** any new long-lived pg client (checked-out connection, LISTEN/
NOTIFY client, a second Pool) needs its own `'error'` handler or it reintroduces
this crash-loop.
