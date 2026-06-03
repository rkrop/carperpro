import type { Request, Response, NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { logger } from "../lib/logger";
import type { PhoneAuthedRequest } from "./phoneAuth";

// Express's Request augmented with the authenticated Clerk user id, set by
// `requireAuth`. Routes downstream can read `req.userId` safely.
export interface AuthedRequest extends Request {
  userId: string;
}

/**
 * Gate a route on a valid Clerk session. Reads the auth context attached by the
 * global `clerkMiddleware` (cookie on web, bearer token on mobile). Responds 401
 * when there is no signed-in user. Login is optional app-wide — only the
 * account endpoints use this.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const userId = getOptionalUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Inicia sesión para continuar" });
    return;
  }
  (req as AuthedRequest).userId = userId;
  next();
}

/**
 * Reads the signed-in user id without requiring it (for optional-auth routes).
 * Accepts either auth method: a Clerk session (email/Google) takes precedence,
 * otherwise a phone (SMS-OTP) session resolved by `attachPhoneAuth`.
 */
export function getOptionalUserId(req: Request): string | null {
  try {
    const clerkUserId = getAuth(req)?.userId;
    if (clerkUserId) return clerkUserId;
  } catch {
    // No Clerk session for this request — fall through to the phone session.
  }
  return (req as PhoneAuthedRequest).phoneUserId ?? null;
}

/**
 * Just-in-time account provisioning. The first time a Clerk user touches the
 * API, create their local row (the central account that favorites/addresses/
 * orders hang off). On creation, best-effort enrich the profile from Clerk so
 * the store has a name/email/phone for the account.
 */
export async function ensureUser(userId: string): Promise<void> {
  const inserted = await db
    .insert(usersTable)
    .values({ id: userId })
    .onConflictDoNothing()
    .returning({ id: usersTable.id });
  if (inserted.length === 0) return; // already provisioned

  // Phone (SMS-OTP) users aren't Clerk users — their row (with the phone) is
  // created at verify time, so skip the Clerk profile enrichment for them.
  if (userId.startsWith("phone_")) return;

  try {
    const u = await clerkClient.users.getUser(userId);
    const email =
      u.primaryEmailAddress?.emailAddress ??
      u.emailAddresses?.[0]?.emailAddress ??
      null;
    const name =
      [u.firstName, u.lastName].filter(Boolean).join(" ").trim() ||
      u.username ||
      null;
    const phone = u.primaryPhoneNumber?.phoneNumber ?? null;
    await db
      .update(usersTable)
      .set({ email, name, phone })
      .where(eq(usersTable.id, userId));
  } catch (err) {
    // Non-fatal: the row exists; profile enrichment can be retried later.
    logger.warn({ userId, err }, "Clerk: no se pudo enriquecer el perfil del usuario");
  }
}

/** Middleware that runs `requireAuth` then ensures the local account exists. */
export async function provisionUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await ensureUser((req as AuthedRequest).userId);
    next();
  } catch (err) {
    logger.error({ err }, "No se pudo aprovisionar la cuenta del usuario");
    res.status(500).json({ error: "No se pudo cargar tu cuenta" });
  }
}
