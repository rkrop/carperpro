import { inArray } from "drizzle-orm";
import { db, productsTable } from "@workspace/db";
import { AdmintotalClient } from "./client";
import { mapProduct } from "./mapper";
import { isAdmintotalConfigured } from "./config";
import { logger } from "../logger";

// How many product detail lookups to run against the ERP at once. Kept small to
// stay well under Admintotal's aggressive rate limiting.
const CONCURRENCY = 5;

export interface LiveStockResult {
  // productId -> sellable units, ONLY for ids we could confirm live (a 404 is a
  // confirmed "0/unavailable"). Ids the ERP couldn't answer for are absent here.
  available: Map<string, number>;
  // Ids whose live stock could not be verified (ERP unreachable / errored).
  unverified: string[];
}

// Sellable units for a single raw ERP product: inactive products are never
// sellable; otherwise sum sellable warehouses (the mapper already drops
// "MAL ESTADO"), falling back to a flat existencia when there is no breakdown.
function sellableFromRaw(raw: Record<string, unknown>): number {
  if (raw.activo === false) return 0;
  const mapped = mapProduct(raw);
  if (!mapped) return 0;
  if (mapped.inventory.length > 0) {
    return mapped.inventory.reduce((sum, r) => sum + Math.max(0, r.quantity), 0);
  }
  if (typeof mapped.fallbackStock === "number") {
    return Math.max(0, Math.round(mapped.fallbackStock));
  }
  return 0;
}

/**
 * Look up CURRENT sellable stock for the given product ids directly from
 * Admintotal (one detail request per id, bounded concurrency). This is the
 * authoritative, real-time source used at checkout and after payment.
 *
 * Failures are NOT fatal: ids that error out are returned in `unverified` so the
 * caller can decide how to degrade (e.g. fall back to the local mirror, or — at
 * payment time — choose NOT to refund on mere uncertainty).
 */
export async function getLiveSellableStock(
  productIds: string[],
): Promise<LiveStockResult> {
  const ids = Array.from(new Set(productIds.filter(Boolean)));
  const available = new Map<string, number>();
  const unverified: string[] = [];

  if (ids.length === 0) return { available, unverified };
  if (!isAdmintotalConfigured()) {
    return { available, unverified: ids };
  }

  const client = new AdmintotalClient();
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      try {
        const raw = await client.getProductoById(id);
        // 404 -> the product no longer exists in the ERP: treat as unavailable.
        available.set(id, raw ? sellableFromRaw(raw) : 0);
      } catch (err) {
        logger.warn(
          { id, err },
          "Stock en vivo: no se pudo verificar contra Admintotal",
        );
        unverified.push(id);
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, ids.length) }, () => worker()),
  );
  return { available, unverified };
}

// Local mirror stock per product, read from the product row. Unknown stock
// (NULL erpStockQty) is treated as 0 here on purpose: this fallback only runs at
// checkout when the live ERP can't be reached, and we'd rather block a sale we
// can't confirm than risk overselling.
async function getDbStock(productIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (productIds.length === 0) return map;
  const rows = await db
    .select({
      productId: productsTable.id,
      qty: productsTable.erpStockQty,
    })
    .from(productsTable)
    .where(inArray(productsTable.id, productIds));
  for (const r of rows) map.set(r.productId, r.qty ?? 0);
  return map;
}

/**
 * Best-effort availability for checkout: live ERP stock when reachable, falling
 * back to the local synced mirror for any id the ERP couldn't answer for. Every
 * requested id is present in the returned map (0 when unknown).
 */
export async function getAvailableStock(
  productIds: string[],
): Promise<Map<string, number>> {
  const ids = Array.from(new Set(productIds.filter(Boolean)));
  const { available, unverified } = await getLiveSellableStock(ids);
  if (unverified.length > 0) {
    const dbStock = await getDbStock(unverified);
    for (const id of unverified) available.set(id, dbStock.get(id) ?? 0);
  }
  for (const id of ids) {
    if (!available.has(id)) available.set(id, 0);
  }
  return available;
}
