// Opaque, server-issued sessions for phone (SMS-OTP) users. Clerk users keep
// using their Clerk JWT; phone users get a random token we mint here. We store
// only the sha256 hash of the token, never the token itself. Tokens are prefixed
// `cps_` so the Clerk middleware ignores them (they aren't JWTs) and our
// phone-auth middleware claims them instead.
import { randomBytes, createHash } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db, phoneSessionsTable } from "@workspace/db";

const TOKEN_PREFIX = "cps_";
const SESSION_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Cheap check used by the middleware to claim only our tokens, not Clerk JWTs. */
export function isPhoneSessionToken(token: string): boolean {
  return token.startsWith(TOKEN_PREFIX);
}

/** Mint a new session for a phone user and persist its hash + expiry. */
export async function createPhoneSession(
  userId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = TOKEN_PREFIX + randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db
    .insert(phoneSessionsTable)
    .values({ userId, tokenHash: hashToken(token), expiresAt });
  return { token, expiresAt };
}

/** Resolve a token to its user id, or null if missing/expired. Touches last_used_at. */
export async function validatePhoneSession(token: string): Promise<string | null> {
  if (!isPhoneSessionToken(token)) return null;
  const tokenHash = hashToken(token);
  const now = new Date();
  const rows = await db
    .select({
      id: phoneSessionsTable.id,
      userId: phoneSessionsTable.userId,
    })
    .from(phoneSessionsTable)
    .where(
      and(
        eq(phoneSessionsTable.tokenHash, tokenHash),
        gt(phoneSessionsTable.expiresAt, now),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  // Best-effort activity touch — never block auth on it.
  void db
    .update(phoneSessionsTable)
    .set({ lastUsedAt: now })
    .where(eq(phoneSessionsTable.id, row.id))
    .catch(() => {});

  return row.userId;
}

/** Revoke (delete) a session by its token. No-op for non-phone tokens. */
export async function revokePhoneSession(token: string): Promise<void> {
  if (!isPhoneSessionToken(token)) return;
  await db
    .delete(phoneSessionsTable)
    .where(eq(phoneSessionsTable.tokenHash, hashToken(token)));
}
