import Stripe from "stripe";

const STRIPE_API_VERSION = "2025-11-17.clover" as const;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} must be set. Configure it in the deployment provider secrets.`,
    );
  }
  return value;
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  return new Stripe(getStripeSecretKey(), {
    apiVersion: STRIPE_API_VERSION,
  });
}

export function getStripePublishableKey(): string {
  return requiredEnv("STRIPE_PUBLISHABLE_KEY");
}

export function getStripeSecretKey(): string {
  return requiredEnv("STRIPE_SECRET_KEY");
}

export function getStripeWebhookSecret(): string {
  return requiredEnv("STRIPE_WEBHOOK_SECRET");
}
