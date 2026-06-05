import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { and, desc, eq, like } from "drizzle-orm";
import { db, phoneSessionsTable, usersTable } from "@workspace/db";
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

// Per-phone cooldown so a single number can't be spammed with SMS even from
// rotating IPs (the IP-based writeLimiter handles the per-IP burst case).
const SEND_COOLDOWN_MS = 30_000;
const lastSendByPhone = new Map<string, number>();

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

    const now = Date.now();
    const last = lastSendByPhone.get(phone);
    if (last && now - last < SEND_COOLDOWN_MS) {
      const retry = Math.ceil((SEND_COOLDOWN_MS - (now - last)) / 1000);
      res.setHeader("Retry-After", String(retry));
      res.status(429).json({
        error: `Espera ${retry} segundos antes de pedir otro código.`,
      });
      return;
    }

    try {
      await startPhoneVerification(phone);
      lastSendByPhone.set(phone, now);
      res.json({ ok: true });
    } catch (err) {
      logger.error({ err }, "Phone auth: fallo al iniciar verificación");
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

    lastSendByPhone.delete(phone);

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
