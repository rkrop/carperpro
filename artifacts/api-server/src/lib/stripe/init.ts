import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./client";
import { getPublicBaseUrl } from "./service";
import { logger } from "../logger";

/**
 * Best-effort Stripe setup on startup: create the `stripe` schema, register the
 * managed webhook, and backfill data. Failures are logged but never crash the
 * server — order payment is confirmed via verify-on-return + scheduler backstop,
 * both of which use the Stripe API directly and don't depend on this.
 */
export async function initStripe(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn("Stripe: DATABASE_URL ausente, se omite la inicialización");
    return;
  }

  try {
    await runMigrations({ databaseUrl });
    logger.info("Stripe: esquema listo");

    const sync = await getStripeSync();

    try {
      const webhookUrl = `${getPublicBaseUrl()}/api/stripe/webhook`;
      const result = await sync.findOrCreateManagedWebhook(webhookUrl);
      logger.info(
        { url: result?.url ?? webhookUrl },
        "Stripe: webhook administrado configurado",
      );
    } catch (err) {
      logger.warn({ err }, "Stripe: no se pudo configurar el webhook administrado");
    }

    // Background backfill — don't block startup.
    sync
      .syncBackfill()
      .then(() => logger.info("Stripe: datos sincronizados"))
      .catch((err) => logger.warn({ err }, "Stripe: backfill falló"));
  } catch (err) {
    logger.warn({ err }, "Stripe: inicialización falló (los pagos pueden seguir funcionando)");
  }
}
