import { getPublicBaseUrl } from "./service";
import { getStripeSecretKey, getStripeWebhookSecret } from "./client";
import { logger } from "../logger";

/**
 * Validate Stripe configuration on startup. Webhook registration now happens in
 * the Stripe dashboard or provider IaC, not through Replit's managed connector.
 */
export async function initStripe(): Promise<void> {
  try {
    getStripeSecretKey();
    getStripeWebhookSecret();
    logger.info(
      { webhookUrl: `${getPublicBaseUrl()}/api/stripe/webhook` },
      "Stripe: configuración lista",
    );
  } catch (err) {
    logger.warn(
      { err },
      "Stripe: configuración incompleta; los pagos con tarjeta no estarán disponibles",
    );
  }
}
