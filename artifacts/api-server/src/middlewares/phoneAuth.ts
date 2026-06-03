import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { isPhoneSessionToken, validatePhoneSession } from "../lib/phoneSession";

// Request augmented with a resolved phone-session user id (when present). Clerk
// users never set this — `getOptionalUserId` prefers the Clerk id when it exists.
export interface PhoneAuthedRequest extends Request {
  phoneUserId?: string | null;
}

function bearerToken(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return null;
  const token = h.slice(7).trim();
  return token || null;
}

/**
 * Resolve a phone (SMS-OTP) session from the Authorization header and attach the
 * user id to the request. Runs globally after `clerkMiddleware`: if Clerk already
 * authenticated the request, it wins and we do nothing. Otherwise, when the
 * bearer token is one of our `cps_` tokens, we validate it against the
 * phone_sessions table. Never throws — auth resolution is best-effort here, and
 * `requireAuth` enforces the gate downstream.
 */
export async function attachPhoneAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (getAuth(req)?.userId) {
      next();
      return;
    }
  } catch {
    // Clerk couldn't resolve a session for this request — fall through to phone.
  }

  const token = bearerToken(req);
  if (token && isPhoneSessionToken(token)) {
    try {
      const userId = await validatePhoneSession(token);
      if (userId) (req as PhoneAuthedRequest).phoneUserId = userId;
    } catch {
      // Non-fatal: leave the request unauthenticated.
    }
  }

  next();
}
