import type { Request, RequestHandler } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

// Cross-process rate limiter backed by PostgreSQL.
//
// In autoscale production each server process is a separate instance with its
// own heap. An in-process Map would give every instance a fresh empty counter,
// meaning an attacker can spread N requests across N instances and drain SMS,
// AI, Stripe and ERP quotas N× beyond the intended per-IP limit.
//
// Every call to the limiter performs a single atomic
//   INSERT ... ON CONFLICT DO UPDATE ... RETURNING
// against the shared `rate_limit_buckets` table. All autoscale instances share
// the same Postgres database, so the counters are truly global. The operation is
// one round-trip and does no locking beyond a row-level upsert.
//
// DB unavailable (fallback): if the database is transiently unreachable the
// limiter falls back to a LOCAL in-process counter for that request. This still
// enforces a per-instance limit for the current window — it is not unlimited
// pass-through. The local fallback uses the same window and max settings, so a
// single instance cannot be abused even during a DB outage. When the DB
// recovers, the next successful upsert takes over.

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  keyPrefix?: string;
  skip?: (req: Request) => boolean;
}

function clientKey(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

// ── DB-backed counter ────────────────────────────────────────────────────────

async function dbIncrement(
  key: string,
  windowMs: number,
): Promise<{ count: number; msRemaining: number }> {
  const result = await pool.query<{ count: number; ms_remaining: string }>(
    `
    INSERT INTO rate_limit_buckets (key, count, reset_at)
    VALUES ($1, 1, NOW() + ($2::bigint * interval '1 millisecond'))
    ON CONFLICT (key) DO UPDATE SET
      count    = CASE
                   WHEN rate_limit_buckets.reset_at <= NOW() THEN 1
                   ELSE rate_limit_buckets.count + 1
                 END,
      reset_at = CASE
                   WHEN rate_limit_buckets.reset_at <= NOW() THEN excluded.reset_at
                   ELSE rate_limit_buckets.reset_at
                 END
    RETURNING count,
              GREATEST(0, EXTRACT(EPOCH FROM (reset_at - NOW())) * 1000)::bigint AS ms_remaining
    `,
    [key, windowMs],
  );
  const row = result.rows[0];
  return {
    count: row?.count ?? 1,
    msRemaining: Number(row?.ms_remaining ?? windowMs),
  };
}

// ── Local in-process fallback ────────────────────────────────────────────────
// Used ONLY when the DB is transiently unavailable. Provides per-instance
// protection so a DB hiccup can't open the floodgates entirely.

interface LocalBucket {
  count: number;
  resetAt: number;
}
const localBuckets = new Map<string, LocalBucket>();

function localIncrement(
  key: string,
  windowMs: number,
): { count: number; msRemaining: number } {
  const now = Date.now();
  let bucket = localBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    localBuckets.set(key, bucket);
  }
  bucket.count += 1;
  return {
    count: bucket.count,
    msRemaining: Math.max(0, bucket.resetAt - now),
  };
}

// Sweep expired local fallback buckets periodically.
const localSweep = setInterval(() => {
  const now = Date.now();
  for (const [k, b] of localBuckets) {
    if (b.resetAt <= now) localBuckets.delete(k);
  }
}, 60_000);
localSweep.unref?.();

// ── Shared DB sweep ──────────────────────────────────────────────────────────
// Delete expired rows from the shared table so it can't grow unbounded.
// Runs every 5 minutes; unref() so this never blocks clean process shutdown.
const dbSweep = setInterval(async () => {
  try {
    await pool.query("DELETE FROM rate_limit_buckets WHERE reset_at <= NOW()");
  } catch {
    // Non-fatal — expired rows are reset atomically on next upsert anyway.
  }
}, 5 * 60_000);
dbSweep.unref?.();

// ── Middleware factory ───────────────────────────────────────────────────────

export function rateLimit(opts: RateLimitOptions): RequestHandler {
  return async (req, res, next) => {
    if (req.method === "OPTIONS") {
      next();
      return;
    }
    if (opts.skip?.(req)) {
      next();
      return;
    }

    const key = `${opts.keyPrefix ?? "rl"}:${clientKey(req)}`;

    let count: number;
    let msRemaining: number;
    try {
      ({ count, msRemaining } = await dbIncrement(key, opts.windowMs));
    } catch (err) {
      // DB unavailable — fall back to local per-instance counter rather than
      // allowing the request through unconditionally. This preserves per-IP
      // burst protection while the shared store is recovering.
      logger.warn({ err, key }, "Rate limit: DB no disponible, usando contador local de emergencia");
      ({ count, msRemaining } = localIncrement(key, opts.windowMs));
    }

    const retryAfterSec = Math.max(1, Math.ceil(msRemaining / 1000));
    const remaining = Math.max(0, opts.max - count);
    res.setHeader("RateLimit-Limit", String(opts.max));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(retryAfterSec));

    if (count > opts.max) {
      res.setHeader("Retry-After", String(retryAfterSec));
      logger.warn(
        {
          ip: clientKey(req),
          method: req.method,
          path: req.path,
          count,
          limit: opts.max,
        },
        "Rate limit excedido",
      );
      res.status(429).json({
        error:
          opts.message ??
          "Demasiadas peticiones. Espera un momento e inténtalo de nuevo.",
      });
      return;
    }

    next();
  };
}

// General limiter: applied globally to all /api traffic in app.ts.
// 300 req/min is generous enough for normal browsing while still capping bursts.
export const generalLimiter: RequestHandler = rateLimit({
  windowMs: 60_000,
  max: 300,
  keyPrefix: "general",
  message: "Demasiadas peticiones. Espera un momento e inténtalo de nuevo.",
});

// Stricter limiter for write/sensitive endpoints (order creation, card checkout,
// SMS OTP, AI chat, scan, push registration).
export const writeLimiter: RequestHandler = rateLimit({
  windowMs: 60_000,
  max: 20,
  keyPrefix: "write",
  message:
    "Demasiados intentos. Espera un momento antes de volver a intentarlo.",
});

// AI-assist limiter for the catalog endpoint when ?assist=1 is present.
// Each assisted request can trigger OpenAI + Gemini embedding calls.
export const aiAssistLimiter: RequestHandler = rateLimit({
  windowMs: 60_000,
  max: 20,
  keyPrefix: "ai-assist",
  skip: (req) => req.query.assist !== "1" && req.query.assist !== "true",
  message:
    "Demasiadas búsquedas con asistencia IA. Espera un momento e inténtalo de nuevo.",
});
