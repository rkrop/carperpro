// Twilio Verify (SMS OTP) over plain HTTPS. We do NOT use the connector proxy
// (it is locked to api.twilio.com, so verify.twilio.com is unreachable) nor the
// SDK client (it never exposes raw credentials). Instead we read the connection
// credentials from the Replit connectors REST API — the same pattern the Stripe
// client uses — and call the Verify REST API directly.
//
// WARNING: never cache the credentials — connection tokens rotate, so fetch
// fresh on each call.
import { logger } from "../logger";

const VERIFY_BASE = "https://verify.twilio.com/v2";

interface TwilioAuth {
  username: string;
  password: string;
}

function requireServiceSid(): string {
  const sid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!sid) {
    throw new Error(
      "Falta TWILIO_VERIFY_SERVICE_SID: el servicio de verificación de Twilio no está configurado.",
    );
  }
  return sid;
}

async function getTwilioAuth(): Promise<TwilioAuth> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error(
      "Twilio no está disponible: faltan variables de entorno de Replit. " +
        "Conecta Twilio desde la pestaña de Integraciones.",
    );
  }

  // The single Twilio connection is registered once and shared across dev/prod,
  // so (unlike Stripe) we do not pin an environment here.
  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", "twilio");

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json", "X-Replit-Token": xReplitToken },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(
      `No se pudieron obtener las credenciales de Twilio: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as {
    items?: {
      settings?: {
        account_sid?: string;
        api_key?: string;
        api_key_secret?: string;
        phone_number?: string;
      };
    }[];
  };
  const settings = data.items?.[0]?.settings;

  // This connection stores the API Key SID in `account_sid` and the API Key
  // secret in `api_key_secret`. Verify Basic auth = (API Key SID):(secret).
  if (!settings?.account_sid || !settings?.api_key_secret) {
    throw new Error("Conexión de Twilio no encontrada o incompleta.");
  }

  return { username: settings.account_sid, password: settings.api_key_secret };
}

function basicAuthHeader({ username, password }: TwilioAuth): string {
  return "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
}

/**
 * Start an SMS verification: Twilio sends a one-time code to `phoneE164`.
 * Throws (with a Spanish message) when the send fails so the caller can 502.
 */
export async function startPhoneVerification(phoneE164: string): Promise<void> {
  const serviceSid = requireServiceSid();
  const auth = await getTwilioAuth();
  const body = new URLSearchParams({ To: phoneE164, Channel: "sms" });

  const r = await fetch(`${VERIFY_BASE}/Services/${serviceSid}/Verifications`, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(auth),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    signal: AbortSignal.timeout(15_000),
  });

  if (!r.ok) {
    const detail = (await r.json().catch(() => ({}))) as {
      code?: number;
      message?: string;
    };
    logger.warn(
      { status: r.status, code: detail.code },
      "Twilio Verify: no se pudo enviar el código",
    );
    throw new Error("No se pudo enviar el código de verificación.");
  }
}

/**
 * Check the code the user entered. Returns true only when Twilio reports the
 * verification as "approved". An expired/missing verification (404) or any
 * non-approved status returns false (caller surfaces "código incorrecto").
 */
export async function checkPhoneVerification(
  phoneE164: string,
  code: string,
): Promise<boolean> {
  const serviceSid = requireServiceSid();
  const auth = await getTwilioAuth();
  const body = new URLSearchParams({ To: phoneE164, Code: code });

  const r = await fetch(
    `${VERIFY_BASE}/Services/${serviceSid}/VerificationCheck`,
    {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader(auth),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(15_000),
    },
  );

  // 404 = no pending verification (already used or expired). Treat as not approved.
  if (r.status === 404) return false;

  if (!r.ok) {
    const detail = (await r.json().catch(() => ({}))) as { code?: number };
    logger.warn(
      { status: r.status, code: detail.code },
      "Twilio Verify: fallo al comprobar el código",
    );
    return false;
  }

  const data = (await r.json()) as { status?: string };
  return data.status === "approved";
}

/**
 * Normalize user-entered phone numbers to E.164, defaulting to Mexico (+52).
 * Returns null when the input can't be made into a plausible E.164 number.
 */
export function normalizeMxPhone(input: string): string | null {
  const trimmed = (input || "").trim();
  if (!trimmed) return null;

  // Already in international form.
  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    return /^\d{8,15}$/.test(digits) ? `+${digits}` : null;
  }

  const digits = trimmed.replace(/\D/g, "");
  // 10-digit national MX number.
  if (digits.length === 10) return `+52${digits}`;
  // 12 digits already prefixed with the MX country code.
  if (digits.length === 12 && digits.startsWith("52")) return `+${digits}`;
  // 11 digits prefixed with US/Canada country code.
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}
