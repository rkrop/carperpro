// Shared Twilio credential access. We read the connection credentials from the
// Replit connectors REST API (the same pattern the Stripe client uses) instead
// of the SDK (which never exposes raw credentials) or the connector proxy (it is
// locked to api.twilio.com, so verify.twilio.com would be unreachable).
//
// WARNING: never cache the credentials — connection tokens rotate, so fetch
// fresh on each call.

export interface TwilioCredentials {
  // This connection stores the API Key SID in `account_sid` and the API Key
  // secret in `api_key_secret`. Basic auth = (API Key SID):(secret).
  apiKeySid: string;
  apiKeySecret: string;
  phoneNumber?: string;
  // The connector's `api_key` field — occasionally the AC account SID. Used as a
  // hint when resolving the Messages API account path (validated before use).
  accountSidHint?: string;
}

export async function getTwilioCredentials(): Promise<TwilioCredentials> {
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

  if (!settings?.account_sid || !settings?.api_key_secret) {
    throw new Error("Conexión de Twilio no encontrada o incompleta.");
  }

  return {
    apiKeySid: settings.account_sid,
    apiKeySecret: settings.api_key_secret,
    phoneNumber: settings.phone_number,
    accountSidHint: settings.api_key,
  };
}

export function twilioBasicAuth(sid: string, secret: string): string {
  return "Basic " + Buffer.from(`${sid}:${secret}`).toString("base64");
}
