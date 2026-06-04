// Thin client for Expo's Push API (https://exp.host/--/api/v2/push/send).
// No credentials are required for sending to ExponentPushTokens, so this works
// without any extra secret. All sends are best-effort and fire-and-forget at the
// call sites: a push failure must never block order fulfillment or stock sync.
//
// Returns the set of tokens Expo reports as permanently invalid
// (DeviceNotRegistered), so callers can prune them from the DB.
import { logger } from "../logger";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
// Expo accepts up to 100 messages per request.
const CHUNK_SIZE = 100;

export interface ExpoPushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

interface ExpoTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

/** True for a well-formed Expo push token, so we never send junk to the API. */
export function isExpoPushToken(token: unknown): token is string {
  return (
    typeof token === "string" &&
    /^ExponentPushToken\[[^\]]+\]$/.test(token.trim())
  );
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Send the same notification to one or more Expo push tokens. De-dupes and
 * filters out malformed tokens first. Resolves with:
 *   - `invalidTokens`: tokens Expo says are no longer registered (caller deletes)
 *   - `delivered`: true only if EVERY batch reached Expo (HTTP-OK + parsed). When
 *     false, a transport/API failure swallowed at least one batch, so callers
 *     with one-shot semantics (back-in-stock) must NOT treat the send as done.
 * Never throws — network/API errors are logged and folded into `delivered`.
 */
export async function sendExpoPush(
  tokens: string[],
  message: ExpoPushMessage,
): Promise<{ invalidTokens: string[]; delivered: boolean }> {
  const valid = Array.from(new Set(tokens.filter(isExpoPushToken)));
  // Nothing to send is a no-op "success": there is no work left to retry.
  if (valid.length === 0) return { invalidTokens: [], delivered: true };

  const invalidTokens: string[] = [];
  let delivered = true;

  for (const batch of chunk(valid, CHUNK_SIZE)) {
    const payload = batch.map((to) => ({
      to,
      title: message.title,
      body: message.body,
      sound: "default" as const,
      ...(message.data ? { data: message.data } : {}),
    }));

    try {
      const r = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      });
      if (!r.ok) {
        delivered = false;
        logger.warn(
          { status: r.status, count: batch.length },
          "Expo push: respuesta no OK al enviar lote",
        );
        continue;
      }
      const json = (await r.json()) as { data?: ExpoTicket[] };
      const tickets = json.data ?? [];
      tickets.forEach((t, i) => {
        if (
          t.status === "error" &&
          t.details?.error === "DeviceNotRegistered"
        ) {
          invalidTokens.push(batch[i]);
        }
      });
    } catch (err) {
      delivered = false;
      logger.warn(
        { err: err instanceof Error ? err.message : err, count: batch.length },
        "Expo push: error de red al enviar lote",
      );
    }
  }

  return { invalidTokens, delivered };
}
