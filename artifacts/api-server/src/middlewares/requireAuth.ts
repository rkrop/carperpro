import type { Request, Response, NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { logger } from "../lib/logger";

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
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Inicia sesión para continuar" });
    return;
  }
  (req as AuthedRequest).userId = userId;
  next();
}

/** Reads the signed-in user id without requiring it (for optional-auth routes). */
export function getOptionalUserId(req: Request): string | null {
  try {
    return getAuth(req)?.userId ?? null;
  } catch {
    return null;
  }
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
