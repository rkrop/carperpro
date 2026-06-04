import { asc, desc, gt, isNotNull, sql } from "drizzle-orm";
import { db, productsTable, outboundOrdersTable } from "@workspace/db";
import { logger } from "../logger";
import { getAdmintotalClient } from "./client";
import { mapProduct } from "./mapper";
import { isAdmintotalConfigured } from "./config";
import {
  getTargetedRefreshBatchSize,
  getTargetedRefreshOrderLookbackDays,
} from "./config";
import { isSyncing } from "./sync";

// Lightweight, high-frequency stock refresh that complements (never replaces)
// the full resumable `productos` pass. The full pass eventually touches all
// ~32k rows, but a single rate-limited pass spans many ticks, so a hot product
// can sell several times before the bulk pull revisits it. This targeted pass
// keeps the quantities that matter most — products customers actually order, and
// the stalest known-stock rows — fresh between full passes by hitting the
// per-product detail endpoint (`getProductoById`) for a small prioritized batch.
//
// It deliberately uses a SEPARATE, small per-tick budget and yields to the full
// pass (skips entirely while a full sync is running) so the two never fight over
// the same ERP rate-limit allowance.

// One detail lookup at a time per worker; a few workers in parallel. Kept low to
// stay well under Admintotal's aggressive rate limiting (mirrors liveStock.ts).
const CONCURRENCY = 3;

let refreshing = false;

export function isTargetedRefreshing(): boolean {
  return refreshing;
}

export interface TargetedRefreshResult {
  ok: boolean;
  attempted: number;
  updated: number;
  confirmedZero: number;
  notFound: number;
  errored: number;
  skipped?: string;
}

// Product ids that appear on orders placed within the lookback window, newest
// first. These are the fastest-changing quantities (something just sold), so
// they get top priority. Parsing the jsonb `lines` in JS keeps this simple and
// avoids a brittle jsonb path query.
async function recentlyOrderedIds(
  sinceDays: number,
  limit: number,
): Promise<string[]> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      lines: outboundOrdersTable.lines,
      createdAt: outboundOrdersTable.createdAt,
    })
    .from(outboundOrdersTable)
    .where(gt(outboundOrdersTable.createdAt, since))
    .orderBy(desc(outboundOrdersTable.createdAt))
    .limit(500);

  const ids: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const line of row.lines ?? []) {
      const id = line?.productId;
      if (id && !seen.has(id)) {
        seen.add(id);
        ids.push(id);
        if (ids.length >= limit) return ids;
      }
    }
  }
  return ids;
}

// Round-robin fill: known-stock products whose mirror is the most stale (oldest
// `stockUpdatedAt`, NULLs first). This ensures popular items that haven't sold
// recently still get periodically re-verified, so the targeted pass covers the
// whole "has real stock" set over time rather than only churning order history.
async function stalestKnownStockIds(
  limit: number,
  exclude: Set<string>,
): Promise<string[]> {
  if (limit <= 0) return [];
  const rows = await db
    .select({ id: productsTable.id })
    .from(productsTable)
    .where(isNotNull(productsTable.erpStockQty))
    .orderBy(
      sql`${productsTable.stockUpdatedAt} asc nulls first`,
      asc(productsTable.updatedAt),
    )
    .limit(limit + exclude.size);

  const out: string[] = [];
  for (const row of rows) {
    if (exclude.has(row.id)) continue;
    out.push(row.id);
    if (out.length >= limit) break;
  }
  return out;
}

// Sellable on-hand units for a single raw ERP product. Inactive products are
// never sellable; otherwise reuse the shared mapper so the rule matches the full
// sync exactly (sums sellable warehouses, drops "MAL ESTADO"). Returns
// `undefined` ONLY when the payload carried no stock signal at all, so the
// caller leaves the stored value untouched (never wipes a known quantity).
function sellableFromRaw(raw: Record<string, unknown>): number | undefined {
  if (raw.activo === false) return 0;
  const mapped = mapProduct(raw);
  if (!mapped) return undefined;
  return mapped.stockQty;
}

async function applyStock(id: string, qty: number): Promise<void> {
  const now = new Date();
  await db
    .update(productsTable)
    .set({ erpStockQty: qty, stockUpdatedAt: now, updatedAt: now })
    .where(sql`${productsTable.id} = ${id}`);
}

/**
 * Run one targeted refresh tick: pick a small prioritized batch and refresh its
 * stock from the ERP detail endpoint. Safe to call on a short interval — it is
 * idempotent, self-bounded, and yields to the full sync.
 */
export async function runTargetedStockRefresh(): Promise<TargetedRefreshResult> {
  const empty: TargetedRefreshResult = {
    ok: true,
    attempted: 0,
    updated: 0,
    confirmedZero: 0,
    notFound: 0,
    errored: 0,
  };

  if (!isAdmintotalConfigured()) {
    return { ...empty, ok: false, skipped: "admintotal no configurado" };
  }
  if (refreshing) {
    return { ...empty, skipped: "refresh ya en progreso" };
  }
  // Yield the rate-limit budget to the full resumable pass: when a bulk sync is
  // mid-flight, skip this tick rather than competing for the same allowance.
  if (isSyncing()) {
    return { ...empty, skipped: "sync completo en progreso" };
  }

  refreshing = true;
  try {
    const batchSize = getTargetedRefreshBatchSize();
    const lookbackDays = getTargetedRefreshOrderLookbackDays();

    // Prioritize recently ordered products; backfill the rest of the batch with
    // the stalest known-stock rows so coverage rotates over the whole catalog.
    const ordered = await recentlyOrderedIds(lookbackDays, batchSize);
    const exclude = new Set(ordered);
    const stale = await stalestKnownStockIds(batchSize - ordered.length, exclude);
    const ids = [...ordered, ...stale];

    if (ids.length === 0) {
      logger.info("Admintotal: refresh dirigido sin productos por actualizar");
      return empty;
    }

    const client = getAdmintotalClient();
    let updated = 0;
    let confirmedZero = 0;
    let notFound = 0;
    let errored = 0;
    let cursor = 0;

    async function worker(): Promise<void> {
      while (cursor < ids.length) {
        const id = ids[cursor++];
        try {
          // Our ids ARE códigos; look up by código (detail-by-id route keys on
          // the internal pk and returns the WRONG product).
          const raw = await client.getProductoByCodigo(id);
          if (!raw) {
            // No match -> the product no longer exists in the ERP. Mark it off-shelf
            // (the full pass will prune it on its next complete cycle).
            await applyStock(id, 0);
            notFound += 1;
            confirmedZero += 1;
            continue;
          }
          const qty = sellableFromRaw(raw);
          if (qty === undefined) continue; // no stock signal -> leave untouched
          await applyStock(id, qty);
          updated += 1;
          if (qty === 0) confirmedZero += 1;
        } catch (err) {
          errored += 1;
          logger.warn(
            { id, err },
            "Admintotal: refresh dirigido no pudo actualizar producto",
          );
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, ids.length) }, () => worker()),
    );

    logger.info(
      {
        attempted: ids.length,
        ordered: ordered.length,
        stale: stale.length,
        updated,
        confirmedZero,
        notFound,
        errored,
      },
      "Admintotal: refresh dirigido de stock completado",
    );

    return {
      ok: errored < ids.length,
      attempted: ids.length,
      updated,
      confirmedZero,
      notFound,
      errored,
    };
  } finally {
    refreshing = false;
  }
}
