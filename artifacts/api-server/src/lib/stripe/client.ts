// Stripe client for the Replit-managed Stripe connector.
// Credentials come from the Replit connection API (integration: "stripe").
// WARNING: never cache the client — tokens rotate, so fetch fresh each call.
import Stripe from "stripe";
import { StripeSync } from "stripe-replit-sync";

interface StripeCredentials {
  publishableKey: string;
  secretKey: string;
}

async function getCredentials(): Promise<StripeCredentials> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error(
      "Stripe no está disponible: faltan variables de entorno de Replit. " +
        "Conecta Stripe desde la pestaña de Integraciones.",
    );
  }

  // The environment field on the connection distinguishes dev/prod.
  const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
  const targetEnvironment = isProduction ? "production" : "development";

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", "stripe");
  url.searchParams.set("environment", targetEnvironment);

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json", "X-Replit-Token": xReplitToken },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(
      `No se pudieron obtener las credenciales de Stripe: ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as {
    items?: { settings?: { publishable?: string; secret?: string } }[];
  };
  const settings = data.items?.[0]?.settings;

  if (!settings?.publishable || !settings?.secret) {
    throw new Error(`Conexión de Stripe (${targetEnvironment}) no encontrada.`);
  }

  return { publishableKey: settings.publishable, secretKey: settings.secret };
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey, {
    // Pinned to the version bundled with the installed Stripe SDK types.
    apiVersion: "2025-11-17.clover",
  });
}

export async function getStripePublishableKey(): Promise<string> {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}

export async function getStripeSecretKey(): Promise<string> {
  const { secretKey } = await getCredentials();
  return secretKey;
}

// StripeSync singleton — manages the webhook + syncs Stripe data to the
// `stripe` schema in Postgres.
let stripeSync: StripeSync | null = null;

export async function getStripeSync(): Promise<StripeSync> {
  if (!stripeSync) {
    const secretKey = await getStripeSecretKey();
    stripeSync = new StripeSync({
      poolConfig: {
        connectionString: process.env.DATABASE_URL!,
        max: 2,
      },
      stripeSecretKey: secretKey,
    });
  }
  return stripeSync;
}
