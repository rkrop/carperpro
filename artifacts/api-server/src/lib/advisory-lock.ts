import { pool } from "@workspace/db";
import { logger } from "./logger";

// Distinct ids for each always-running background job that must behave as a
// cross-instance singleton. Postgres advisory locks are global to the database,
// so when Autoscale runs more than one instance only the lock holder runs the
// job; the others skip that tick. Values are stable on purpose: changing one
// would let an old build and a new build run the same job at once mid-rollout.
export const JOB_LOCK = {
  outboundQueue: 1,
  stripeReconcile: 2,
  embeddingBackfill: 3,
  descriptionBackfill: 4,
  inboundSync: 5,
  enrichmentSweep: 6,
  shopifyDeltaSync: 7,
  shopifyOrderIngestion: 8,
} as const;

// First key of the two-int form of pg_advisory_lock. Namespacing the job ids
// under a fixed, app-specific number keeps them from ever colliding with an
// advisory lock taken anywhere else in the database.
const LOCK_NAMESPACE = 0x43415250; // "CARP", fits int4

/**
 * Run `fn` only if this process can take the Postgres advisory lock for `jobId`.
 *
 * Cross-instance mutex for best-effort background jobs: it uses a NON-blocking
 * try-lock, so when another instance already holds the lock this returns
 * immediately without running `fn` (the caller simply skips this tick) instead
 * of duplicating the work or piling up behind it.
 *
 * The lock is session-scoped, so it is taken and released on the SAME dedicated
 * pooled connection. If the unlock ever fails the connection is destroyed
 * rather than returned to the pool, so Postgres ends that session and frees the
 * lock — a still-locked connection is never recycled.
 *
 * @returns true if the lock was acquired and `fn` ran, false if it was skipped.
 */
export async function withAdvisoryLock(
  jobId: number,
  fn: () => Promise<void>,
): Promise<boolean> {
  const client = await pool.connect();

  // While a client is checked out, the pool stops listening for its 'error'
  // events. Background jobs (embedding/description backfill) hold this client
  // for minutes, so if Postgres terminates the connection mid-run the client
  // would emit an unhandled 'error' and crash the whole process. We attach our
  // own listener so the emitter has a handler (no crash) and we record that the
  // lock session died, so we never keep running singleton work after Postgres
  // has already freed the lock on disconnect.
  //
  // The handler is NAMED and removed before every release(): pooled clients are
  // reused, so leaving it attached would accumulate handlers across calls
  // (MaxListenersExceededWarning + leak) on this hot scheduled path.
  let connectionDied = false;
  const onClientError = (err: unknown) => {
    connectionDied = true;
    logger.warn(
      { err: err instanceof Error ? err.message : String(err), jobId },
      "advisory-lock: la conexión del lock murió durante el job; se aborta para no correr sin lock",
    );
  };
  client.on("error", onClientError);

  // Always strip our listener before handing the client back (or destroying it)
  // so it never leaks onto a recycled connection.
  const releaseClient = (err?: Error) => {
    client.removeListener("error", onClientError);
    client.release(err);
  };

  let acquired = false;
  try {
    const { rows } = await client.query<{ locked: boolean }>(
      "select pg_try_advisory_lock($1, $2) as locked",
      [LOCK_NAMESPACE, jobId],
    );
    acquired = rows[0]?.locked === true;
  } catch (err) {
    // Couldn't even attempt the lock: drop the connection instead of returning
    // a possibly half-initialized session to the pool.
    releaseClient(err instanceof Error ? err : new Error(String(err)));
    throw err;
  }

  if (!acquired) {
    releaseClient();
    return false;
  }

  try {
    await fn();
    return true;
  } finally {
    if (connectionDied) {
      // The lock session is already gone (Postgres freed the lock on disconnect),
      // so there is nothing to unlock and the connection must not be recycled.
      releaseClient(new Error("advisory-lock connection died mid-job"));
    } else {
      try {
        await client.query("select pg_advisory_unlock($1, $2)", [
          LOCK_NAMESPACE,
          jobId,
        ]);
        releaseClient();
      } catch (err) {
        // Destroy the connection so its session ends and Postgres frees the
        // lock; never recycle a connection that may still hold it.
        logger.warn(
          { err: err instanceof Error ? err.message : String(err), jobId },
          "advisory-lock: no se pudo liberar el lock; se descarta la conexión para forzar su liberación",
        );
        releaseClient(err instanceof Error ? err : new Error(String(err)));
      }
    }
  }
}
