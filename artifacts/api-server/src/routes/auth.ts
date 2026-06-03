import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { and, eq, like } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
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
