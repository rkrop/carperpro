import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { and, desc, eq, like } from "drizzle-orm";
import { db, pool, phoneSessionsTable, usersTable } from "@workspace/db";
import {
  checkPhoneVerification,
  normalizeMxPhone,
  startPhoneVerification,
} from "../lib/twilio/verify";
import {
  createPhoneSession,
  revokePhoneSession,
} from "../lib/phoneSession";
import { writeLimiter } from "../middlewares/rateLimit";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Per-phone OTP send cooldown — stored in the shared rate_limit_buckets table
// so the limit is enforced across ALL autoscale instances, not just the one
// that handled the previous request. Max=1 within a 30-second window means
// exactly one SMS can be sent per phone per 30 seconds regardless of how many
// server instances are running or which instance the attacker hits.
const SEND_COOLDOWN_MS = 30_000;

async function checkPhoneCooldown(
  phone: string,
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const key = `sms_cooldown:${phone}`;
  try {
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
      [key, SEND_COOLDOWN_MS],
    );
    const row = result.rows[0];
    const count = row?.count ?? 1;
    const msRemaining = Number(row?.ms_remaining ?? 0);
    if (count > 1) {
      return { allowed: false, retryAfterSec: Math.max(1, Math.ceil(msRemaining / 1000)) };
    }
    return { allowed: true, retryAfterSec: 0 };
  } catch (err) {
    // Fail-closed: when the shared cooldown store is unreachable we deny the
    // send rather than allow it. Permitting sends during a DB outage would let
    // an attacker bypass the per-phone Twilio billing gate entirely by timing
    // requests to DB-error windows. A transient 429 is far safer than an
    // uncontrolled SMS flood.
    logger.warn({ err, phone }, "Phone auth: cooldown store no disponible, envío denegado para proteger cuota SMS");
    return { allowed: false, retryAfterSec: Math.ceil(SEND_COOLDOWN_MS / 1000) };
  }
}

async function clearPhoneCooldown(phone: string): Promise<void> {
  const key = `sms_cooldown:${phone}`;
  try {
    await pool.query("DELETE FROM rate_limit_buckets WHERE key = $1", [key]);
  } catch (err) {
    logger.warn({ err }, "Phone auth: fallo al limpiar cooldown de teléfono");
  }
}

function bearerToken(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return null;
  const token = h.slice(7).trim();
  return token || null;
}

/**
 * POST /api/auth/phone/start — send an SMS OTP to the given phone number.
 * Body: { phone: string }. Always returns 200 on success; the code itself is
 * delivered via SMS by Twilio Verify.
 */
router.post(
  "/auth/phone/start",
  writeLimiter,
  async (req: Request, res: Response) => {
    const phoneRaw = typeof req.body?.phone === "string" ? req.body.phone : "";
    const phone = normalizeMxPhone(phoneRaw);
    if (!phone) {
      res.status(400).json({ error: "Número de teléfono inválido." });
      return;
    }

    // Per-phone cooldown enforced in the shared DB so rotating across autoscale
    // instances doesn't bypass it (writeLimiter covers the per-IP burst case).
    const { allowed, retryAfterSec } = await checkPhoneCooldown(phone);
    if (!allowed) {
      res.setHeader("Retry-After", String(retryAfterSec));
      res.status(429).json({
        error: `Espera ${retryAfterSec} segundos antes de pedir otro código.`,
      });
      return;
    }

    try {
      await startPhoneVerification(phone);
      res.json({ ok: true });
    } catch (err) {
      logger.error({ err }, "Phone auth: fallo al iniciar verificación");
      // Roll back the cooldown slot so the user can retry immediately after a
      // transient Twilio error without waiting out the full window.
      await clearPhoneCooldown(phone);
      res.status(502).json({
        error: "No se pudo enviar el código. Inténtalo de nuevo.",
      });
    }
  },
);

/**
 * POST /api/auth/phone/verify — check the OTP and, on success, find/create the
 * phone user and issue an opaque session token.
 * Body: { phone: string, code: string }. Returns { token, expiresAt, userId }.
 */
router.post(
  "/auth/phone/verify",
  writeLimiter,
  async (req: Request, res: Response) => {
    const phoneRaw = typeof req.body?.phone === "string" ? req.body.phone : "";
    const codeRaw = typeof req.body?.code === "string" ? req.body.code : "";
    const phone = normalizeMxPhone(phoneRaw);
    const code = codeRaw.replace(/\D/g, "");

    if (!phone) {
      res.status(400).json({ error: "Número de teléfono inválido." });
      return;
    }
    if (code.length < 4 || code.length > 10) {
      res.status(400).json({ error: "Código inválido." });
      return;
    }

    let approved = false;
    try {
      approved = await checkPhoneVerification(phone, code);
    } catch (err) {
      logger.error({ err }, "Phone auth: fallo al comprobar verificación");
      res.status(502).json({
        error: "No se pudo verificar el código. Inténtalo de nuevo.",
      });
      return;
    }

    if (!approved) {
      res.status(400).json({ error: "Código incorrecto o expirado." });
      return;
    }

    // Find an existing phone user for this number, else provision a new one.
    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(and(eq(usersTable.phone, phone), like(usersTable.id, "phone_%")))
      .limit(1);

    let userId = existing[0]?.id;
    if (!userId) {
      userId = `phone_${randomUUID()}`;
      await db.insert(usersTable).values({ id: userId, phone }).onConflictDoNothing();
    } else {
      // Guard against recycled phone numbers. Carriers typically reassign
      // abandoned numbers after 30-90 days. Anyone who later receives that
      // number can request an OTP and, without this check, would inherit the
      // prior owner's full account. We use 30 days — the shortest observed
      // carrier recycling window — as the inactivity threshold, so the old
      // account is never reused within the carrier's reassignment window.
      //
      // Two independent signals are evaluated. The account is treated as
      // dormant if EITHER is absent or stale:
      //   1. phone_sessions.lastUsedAt — last authenticated API call; updated
      //      on every request passing through phoneAuth middleware.
      //   2. users.updatedAt — last profile write; guards against the edge
      //      case where a session's lastUsedAt is still recent because the
      //      prior owner had an active session at the moment of reassignment.
      //
      // When dormant, we sever the phone link from the old account (clearing
      // users.phone so it will never be matched again) and provision a fresh
      // account for this caller. Existing unexpired sessions on the old
      // account remain valid until their natural TTL — no forced revocation
      // is needed, and the old user is not actively harmed.
      const INACTIVITY_DAYS = 30;
      const inactivityCutoff = new Date(Date.now() - INACTIVITY_DAYS * 24 * 60 * 60 * 1000);

      const [recentSession, existingUser] = await Promise.all([
        db
          .select({ lastUsedAt: phoneSessionsTable.lastUsedAt })
          .from(phoneSessionsTable)
          .where(eq(phoneSessionsTable.userId, userId))
          .orderBy(desc(phoneSessionsTable.lastUsedAt))
          .limit(1),
        db
          .select({ updatedAt: usersTable.updatedAt })
          .from(usersTable)
          .where(eq(usersTable.id, userId))
          .limit(1),
      ]);

      const lastSessionActivity = recentSession[0]?.lastUsedAt ?? null;
      const lastProfileUpdate = existingUser[0]?.updatedAt ?? null;

      const sessionStale = !lastSessionActivity || lastSessionActivity < inactivityCutoff;
      const profileStale = !lastProfileUpdate || lastProfileUpdate < inactivityCutoff;

      if (sessionStale && profileStale) {
        // Both signals are stale — account is dormant. Sever the phone link
        // and provision a fresh account for this caller.
        logger.warn(
          { userId, lastSessionActivity, lastProfileUpdate, inactivityDays: INACTIVITY_DAYS },
          "Phone auth: cuenta inactiva, posible número reciclado — aprovisionando cuenta nueva",
        );
        await db
          .update(usersTable)
          .set({ phone: null })
          .where(eq(usersTable.id, userId));
        userId = `phone_${randomUUID()}`;
        await db.insert(usersTable).values({ id: userId, phone }).onConflictDoNothing();
      }
    }

    // Clear the send cooldown so a fresh verification flow can begin later.
    await clearPhoneCooldown(phone);

    const { token, expiresAt } = await createPhoneSession(userId);
    res.json({ token, expiresAt: expiresAt.toISOString(), userId });
  },
);

/**
 * POST /api/auth/phone/signout — revoke the caller's phone session token.
 */
router.post("/auth/phone/signout", async (req: Request, res: Response) => {
  const token = bearerToken(req);
  if (token) {
    try {
      await revokePhoneSession(token);
    } catch (err) {
      logger.warn({ err }, "Phone auth: fallo al revocar sesión");
    }
  }
  res.json({ ok: true });
});

export default router;
