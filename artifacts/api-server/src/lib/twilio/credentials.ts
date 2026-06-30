// Shared Twilio credential access. Outside Replit we read secrets directly from
// the deployment provider environment.

export interface TwilioCredentials {
  apiKeySid: string;
  apiKeySecret: string;
  phoneNumber?: string;
  accountSidHint?: string;
}

function env(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

export async function getTwilioCredentials(): Promise<TwilioCredentials> {
  const apiKeySid = env("TWILIO_API_KEY_SID") ?? env("TWILIO_ACCOUNT_SID");
  const apiKeySecret = env("TWILIO_API_KEY_SECRET") ?? env("TWILIO_AUTH_TOKEN");
  const accountSidHint = env("TWILIO_ACCOUNT_SID");

  if (!apiKeySid || !apiKeySecret) {
    throw new Error(
      "Twilio no está disponible: configura TWILIO_API_KEY_SID/TWILIO_API_KEY_SECRET " +
        "o TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN en el proveedor de despliegue.",
    );
  }

  return {
    apiKeySid,
    apiKeySecret,
    phoneNumber: env("TWILIO_PHONE_NUMBER"),
    accountSidHint,
  };
}

export function twilioBasicAuth(sid: string, secret: string): string {
  return "Basic " + Buffer.from(`${sid}:${secret}`).toString("base64");
}
