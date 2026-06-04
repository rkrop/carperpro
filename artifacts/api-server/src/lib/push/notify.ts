// Fire-and-forget push helpers for customer-facing notifications:
//   - order state: "Pago confirmado" / "No pudimos procesar tu pedido"
//   - back-in-stock: "Avísame cuando vuelva a haber"
// All sends are best-effort: a push failure must never block order fulfillment
// or stock sync. Tokens Expo reports as permanently invalid are pruned from the
// DB so the tables don't accumulate dead devices.
import { eq, and, inArray, isNull, gt } from "drizzle-orm";
import {
  db,
  productsTable,
  pushTokensTable,
  backInStockSubsTable,
  type OutboundOrder,
} from "@workspace/db";
import { sendExpoPush } from "./expoPush";
import { logger } from "../logger";

// Delete dead tokens from every table that stores them.
async function pruneInvalidTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  try {
    await db
      .delete(pushTokensTable)
      .where(inArray(pushTokensTable.token, tokens));
    await db
      .delete(backInStockSubsTable)
      .where(inArray(backInStockSubsTable.token, tokens));
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : err },
      "Push: no se pudieron limpiar tokens inválidos",
    );
  }
}

/** Push "Pago confirmado" to the device that placed the order (if registered). */
export function notifyOrderPaidPush(order: OutboundOrder): void {
  if (!order.pushToken) return;
  void sendExpoPush([order.pushToken], {
    title: "Pago confirmado",
    body: `Tu pedido ${order.folio} fue confirmado. ¡Gracias por tu compra!`,
    data: { type: "order", folio: order.folio },
  })
    .then(({ invalidTokens }) => pruneInvalidTokens(invalidTokens))
    .catch(() => {});
}

/** Push "No pudimos procesar tu pedido" (payment failed or order cancelled). */
export function notifyOrderProblemPush(order: OutboundOrder): void {
  if (!order.pushToken) return;
  void sendExpoPush([order.pushToken], {
    title: "No pudimos procesar tu pedido",
    body: `Hubo un problema con tu pedido ${order.folio}. Te contactaremos para ayudarte.`,
    data: { type: "order", folio: order.folio },
  })
    .then(({ invalidTokens }) => pruneInvalidTokens(invalidTokens))
    .catch(() => {});
}

/**
 * Notify every pending subscriber that one of the given products is back in
 * stock. Call with the product ids that just transitioned from 0/unknown to a
 * positive count. Best-effort: errors are logged and swallowed.
 *
 * Concurrency & one-shot guarantees: subscriptions are CLAIMED atomically by
 * stamping `notifiedAt` in a single `UPDATE ... WHERE notifiedAt IS NULL
 * RETURNING`, so two concurrent callers (webhook burst + sync sweep) can never
 * both grab the same row → no duplicate pushes. If a product's push then fails
 * to reach Expo at the transport level (outage), we UN-CLAIM that product's
 * rows (reset `notifiedAt` to null) so a later sweep retries instead of
 * silently dropping the alert.
 */
export async function notifyBackInStock(productIds: string[]): Promise<void> {
  const ids = Array.from(new Set(productIds)).filter(Boolean);
  if (ids.length === 0) return;
  try {
    // Atomically claim the pending subscriptions for these products. Only the
    // caller that wins the UPDATE sees each row, which serializes concurrent
    // webhook/sweep invocations.
    const subs = await db
      .update(backInStockSubsTable)
      .set({ notifiedAt: new Date() })
      .where(
        and(
          inArray(backInStockSubsTable.productId, ids),
          isNull(backInStockSubsTable.notifiedAt),
        ),
      )
      .returning();
    if (subs.length === 0) return;

    const names = await db
      .select({ id: productsTable.id, name: productsTable.name })
      .from(productsTable)
      .where(inArray(productsTable.id, ids));
    const nameById = new Map(names.map((p) => [p.id, p.name]));

    // Group claimed subscription rows by product so each push names the right
    // part and we can un-claim per product if its send fails.
    const subsByProduct = new Map<string, typeof subs>();
    for (const s of subs) {
      const list = subsByProduct.get(s.productId) ?? [];
      list.push(s);
      subsByProduct.set(s.productId, list);
    }

    const invalid: string[] = [];
    const failedSubIds: number[] = [];
    for (const [productId, productSubs] of subsByProduct) {
      const name = nameById.get(productId) ?? "una refacción";
      const { invalidTokens, delivered } = await sendExpoPush(
        productSubs.map((s) => s.token),
        {
          title: "¡Volvió a haber!",
          body: `${name} ya está disponible de nuevo. Aprovecha antes de que se agote.`,
          data: { type: "restock", productId },
        },
      );
      invalid.push(...invalidTokens);
      // Transport failure: release the claim so a future sweep retries.
      if (!delivered) failedSubIds.push(...productSubs.map((s) => s.id));
    }

    if (failedSubIds.length > 0) {
      await db
        .update(backInStockSubsTable)
        .set({ notifiedAt: null })
        .where(inArray(backInStockSubsTable.id, failedSubIds));
    }

    await pruneInvalidTokens(invalid);
    logger.info(
      {
        products: ids.length,
        subscribers: subs.length,
        retried: failedSubIds.length,
      },
      "Push: notificación de reabasto enviada",
    );
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : err },
      "Push: error al notificar reabasto",
    );
  }
}

/**
 * Sweep all pending back-in-stock subscriptions and notify any whose product
 * now has positive stock. Idempotent (notifyBackInStock stamps notifiedAt), so
 * it's safe to call repeatedly — e.g. once per full ERP sync pass, which is the
 * mirror path that complements the real-time webhook detection.
 */
export async function sweepBackInStock(): Promise<void> {
  try {
    const pending = await db
      .selectDistinct({ productId: backInStockSubsTable.productId })
      .from(backInStockSubsTable)
      .where(isNull(backInStockSubsTable.notifiedAt));
    if (pending.length === 0) return;
    const ids = pending.map((p) => p.productId);
    const inStock = await db
      .select({ id: productsTable.id })
      .from(productsTable)
      .where(and(inArray(productsTable.id, ids), gt(productsTable.erpStockQty, 0)));
    if (inStock.length === 0) return;
    await notifyBackInStock(inStock.map((r) => r.id));
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : err },
      "Push: error en barrido de reabasto",
    );
  }
}

/** Upsert an Expo push token for a device, linking it to a user when known. */
export async function registerPushToken(
  token: string,
  userId: string | null,
  platform: string | null,
): Promise<void> {
  await db
    .insert(pushTokensTable)
    .values({ token, userId, platform })
    .onConflictDoUpdate({
      target: pushTokensTable.token,
      set: { userId, platform, updatedAt: new Date() },
    });
}

/** Subscribe a device (push token) to a product's back-in-stock notification. */
export async function subscribeRestock(
  productId: string,
  token: string,
  userId: string | null,
): Promise<void> {
  await db
    .insert(backInStockSubsTable)
    .values({ productId, token, userId })
    .onConflictDoUpdate({
      target: [backInStockSubsTable.productId, backInStockSubsTable.token],
      // Re-subscribing resets the one-shot flag so a future restock notifies again.
      set: { userId, notifiedAt: null, createdAt: new Date() },
    });
}

/** True when this product id exists in the catalog. */
export async function productExists(productId: string): Promise<boolean> {
  const rows = await db
    .select({ id: productsTable.id })
    .from(productsTable)
    .where(eq(productsTable.id, productId))
    .limit(1);
  return rows.length > 0;
}
