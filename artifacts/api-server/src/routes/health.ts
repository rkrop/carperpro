import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Health check. Pings the database so the endpoint reflects real serviceability,
// not just "the process is up": returns 200 when healthy and 503 when the DB is
// unreachable, so uptime monitors / the deploy platform can detect outages.
router.get("/healthz", async (_req, res) => {
  const startedAt = Date.now();
  let dbOk = true;
  try {
    await db.execute(sql`select 1`);
  } catch (err) {
    dbOk = false;
    logger.error({ err }, "Healthcheck: la base de datos no responde");
  }

  const body = {
    status: dbOk ? "ok" : "degraded",
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    database: { ok: dbOk, latencyMs: Date.now() - startedAt },
  };

  res.status(dbOk ? 200 : 503).json(body);
});

export default router;
