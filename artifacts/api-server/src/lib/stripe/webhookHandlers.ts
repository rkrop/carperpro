import { getUncachableStripeClient, getStripeWebhookSecret } from "./client";
import { reconcileStripeOrder } from "./service";
import { logger } from "../logger";

/**
 * Verifies Stripe's signature with STRIPE_WEBHOOK_SECRET and reconciles checkout
 * sessions using the local order id stored in session metadata.
 */
export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        "STRIPE WEBHOOK ERROR: el payload debe ser un Buffer. Tipo recibido: " +
          typeof payload +
          ". Suele indicar que express.json() procesó el body antes de este handler. " +
          "Registra la ruta del webhook ANTES de app.use(express.json()).",
      );
    }

    const stripe = await getUncachableStripeClient();
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      getStripeWebhookSecret(),
    );

    if (
      event.type !== "checkout.session.completed" &&
      event.type !== "checkout.session.async_payment_succeeded"
    ) {
      return;
    }

    const session = event.data.object;
    const rawOrderId = session.metadata?.orderId ?? session.client_reference_id;
    const orderId = rawOrderId ? Number(rawOrderId) : NaN;
    if (!Number.isFinite(orderId)) {
      logger.warn(
        { eventId: event.id, sessionId: session.id },
        "Stripe: webhook sin orderId reconciliable",
      );
      return;
    }

    await reconcileStripeOrder(orderId);
  }
}
