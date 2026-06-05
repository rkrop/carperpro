import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Bound the DB ping so a slow or suspended database (e.g. the managed Postgres
// waking up on an autoscale cold start) can never make the health check hang.
const DB_PING_TIMEOUT_MS = 2500;

// Ping the DB but never throw and never hang: resolves false on error or timeout.
function pingDb(): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), DB_PING_TIMEOUT_MS);
  });
  const ping = db
    .execute(sql`select 1`)
    .then(() => true)
    .catch(() => false);
  return Promise.race([ping, timeout]).finally(() => clearTimeout(timer));
}

// Liveness health check — used by the deploy platform's startup probe AND the
// uptime monitor (see api-server artifact.toml: health.startup -> /api/healthz).
//
// It returns 200 whenever the PROCESS is serving. A transient database blip must
// NOT flag the whole deployment as down: previously this endpoint returned 503
// the instant `select 1` failed, so on an autoscale cold start (which has to wake
// the suspended managed Postgres) the first probe got a 503 and the monitor
// recorded a false-positive outage that then "recovered" once warm.
//
// We still probe the DB (bounded) and surface it as `database.ok` / status
// "degraded" for observability, and we log misses — but they no longer fail the
// instance. Real DB outages still surface as 5xx on the actual data endpoints.
router.get("/healthz", async (_req, res) => {
  const startedAt = Date.now();
  const dbOk = await pingDb();
  if (!dbOk) {
    logger.warn(
      "Healthcheck: la base de datos no respondió a tiempo; servicio degradado pero vivo",
    );
  }

  res.status(200).json({
    status: dbOk ? "ok" : "degraded",
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    database: { ok: dbOk, latencyMs: Date.now() - startedAt },
  });
});

export default router;
