import type { Request, RequestHandler } from "express";
import { logger } from "../lib/logger";

// Lightweight, dependency-free, in-memory rate limiter (fixed window per key).
// This server runs as a single instance, so an in-process counter is enough to
// blunt bursts of abusive traffic without the overhead of an external store.
// Legitimate webhooks (verified by signature/token) are exempted via `skip` so
// the ERP/Stripe integrations are never throttled.

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Max requests allowed per key within the window. */
  max: number;
  /** Client-facing message returned on 429. */
  message?: string;
  /** Namespaces the counter so multiple limiters don't share buckets. */
  keyPrefix?: string;
  /** Return true to bypass the limiter for this request. */
  skip?: (req: Request) => boolean;
}

// Resolve a stable client key. With `trust proxy` set, req.ip reflects the real
// client IP forwarded by Replit's edge proxy.
function clientKey(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

export function rateLimit(opts: RateLimitOptions): RequestHandler {
  const buckets = new Map<string, Bucket>();

  // Periodically drop expired buckets so memory can't grow unbounded under a
  // wide spread of client IPs. unref() keeps this timer from holding the process
  // open during shutdown.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, opts.windowMs);
  sweep.unref?.();

  return (req, res, next) => {
    // Never count CORS preflight — it must always pass for the browser to send
    // the real request.
    if (req.method === "OPTIONS") {
      next();
      return;
    }
    if (opts.skip?.(req)) {
      next();
      return;
    }

    const key = `${opts.keyPrefix ?? ""}:${clientKey(req)}`;
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + opts.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    const remaining = Math.max(0, opts.max - bucket.count);
    res.setHeader("RateLimit-Limit", String(opts.max));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(retryAfterSec));

    if (bucket.count > opts.max) {
      res.setHeader("Retry-After", String(retryAfterSec));
      logger.warn(
        {
          ip: clientKey(req),
          method: req.method,
          path: req.path,
          count: bucket.count,
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

// General limiter for all /api traffic. Generous enough that normal browsing /
// catalog usage never trips it, while still capping abusive bursts per IP.
// NOTE: The Stripe webhook is registered before this limiter in the middleware
// chain (app.ts) so it never reaches this handler. Admintotal webhook paths
// are intentionally NOT exempted here — authentication must happen first, and
// exempting by path alone would allow unauthenticated traffic to bypass limits.
export const generalLimiter: RequestHandler = rateLimit({
  windowMs: 60_000,
  max: 300,
  keyPrefix: "general",
  message: "Demasiadas peticiones. Espera un momento e inténtalo de nuevo.",
});

// Stricter limiter for sensitive write endpoints (order creation, card checkout,
// payment verification). These mutate state / touch Stripe & the ERP, so they
// get a much tighter per-IP budget.
export const writeLimiter: RequestHandler = rateLimit({
  windowMs: 60_000,
  max: 20,
  keyPrefix: "write",
  message:
    "Demasiados intentos. Espera un momento antes de volver a intentarlo.",
});

// AI-assist limiter for the public catalog search endpoint.
// When `assist=1` is present, each request can trigger an OpenAI completion
// AND a Gemini embedding call, so unauthenticated callers must be held to the
// same 20 req/min budget as the dedicated assistant and scan endpoints.
// Requests without `assist` are skipped so normal browsing is unaffected.
export const aiAssistLimiter: RequestHandler = rateLimit({
  windowMs: 60_000,
  max: 20,
  keyPrefix: "ai-assist",
  skip: (req) => req.query.assist !== "1" && req.query.assist !== "true",
  message:
    "Demasiadas búsquedas con asistencia IA. Espera un momento e inténtalo de nuevo.",
});
