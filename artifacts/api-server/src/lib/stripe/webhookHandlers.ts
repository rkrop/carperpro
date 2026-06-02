import { getStripeSync } from "./client";

/**
 * Verifies + processes a Stripe webhook via stripe-replit-sync, which keeps the
 * `stripe` schema in sync. Order payment status is reconciled separately
 * (verify-on-return + scheduler backstop) using the Stripe API directly.
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
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);
  }
}
