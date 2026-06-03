import { sql, notInArray } from "drizzle-orm";
import {
  db,
  categoriesTable,
  brandsTable,
  sucursalesTable,
  productsTable,
  syncStateTable,
} from "@workspace/db";
import { logger } from "../logger";
import { AdmintotalClient } from "./client";
import { isAdmintotalConfigured, missingConfigMessage } from "./config";
import { mapCategory, mapSucursal, mapProduct } from "./mapper";

const SYNC_KEY = "catalog";

// In-process lock so overlapping interval ticks / boot sync don't run together.
let syncing = false;

export function isSyncing(): boolean {
  return syncing;
}

async function setSyncState(
  patch: Partial<typeof syncStateTable.$inferInsert>,
): Promise<void> {
  await db
    .insert(syncStateTable)
    .values({ key: SYNC_KEY, ...patch })
    .onConflictDoUpdate({ target: syncStateTable.key, set: patch });
}

interface SyncResult {
  ok: boolean;
  productsSynced: number;
  categoriesSynced: number;
  sucursalesSynced: number;
  brandsSynced: number;
  error?: string;
}

export async function runInboundSync(): Promise<SyncResult> {
  if (syncing) {
    logger.warn("Admintotal: sync ya en progreso, se omite esta corrida");
    return {
      ok: false,
      productsSynced: 0,
      categoriesSynced: 0,
      sucursalesSynced: 0,
      brandsSynced: 0,
      error: "sync en progreso",
    };
  }

  if (!isAdmintotalConfigured()) {
    const msg = missingConfigMessage();
    logger.error(msg);
    await setSyncState({
      status: "error",
      lastStartedAt: new Date(),
      lastFinishedAt: new Date(),
      lastError: msg,
      message: msg,
    });
    return {
      ok: false,
      productsSynced: 0,
      categoriesSynced: 0,
      sucursalesSynced: 0,
      brandsSynced: 0,
      error: msg,
    };
  }

  syncing = true;
  const startedAt = new Date();
  await setSyncState({
    status: "running",
    lastStartedAt: startedAt,
    lastError: null,
    message: "Sincronizando con Admintotal…",
  });
  logger.info("Admintotal: iniciando sincronización entrante");

  try {
    const client = new AdmintotalClient();

    // 1) Lineas -> categories
    const rawLineas = await client.getLineas();
    const categories = rawLineas
      .map(mapCategory)
      .filter((c): c is NonNullable<typeof c> => c !== null);
    const categoryIds = categories.map((c) => c.id);
    for (const c of categories) {
      await db
        .insert(categoriesTable)
        .values(c)
        .onConflictDoUpdate({
          target: categoriesTable.id,
          set: { name: c.name },
        });
    }
    // Remove categories no longer in ERP.
    if (categoryIds.length > 0) {
      await db.delete(categoriesTable).where(notInArray(categoriesTable.id, categoryIds));
    }
    logger.info({ count: categories.length }, "Admintotal: categorías sincronizadas");

    // 2) Almacenes -> sucursales
    const rawAlmacenes = await client.getAlmacenes();
    const sucursales = rawAlmacenes
      .map(mapSucursal)
      .filter((s): s is NonNullable<typeof s> => s !== null);
    const sucursalIds = sucursales.map((s) => s.id);
    for (const s of sucursales) {
      await db
        .insert(sucursalesTable)
        .values(s)
        .onConflictDoUpdate({
          target: sucursalesTable.id,
          set: {
            name: s.name,
            address: s.address,
            city: s.city,
            hours: s.hours,
          },
        });
    }
    // Remove sucursales no longer in ERP.
    if (sucursalIds.length > 0) {
      await db.delete(sucursalesTable).where(notInArray(sucursalesTable.id, sucursalIds));
    }
    logger.info({ count: sucursales.length }, "Admintotal: sucursales sincronizadas");

    // 3) Productos -> products (with stock on the row) + brands.
    //
    // We STREAM the catalog page-by-page and upsert each page as it arrives
    // (see client.streamProductos). The catalog is large (~32k rows) and the ERP
    // is heavily rate-limited, so buffering the whole result set before writing
    // meant a single 429 partway through threw away the entire run and NO stock
    // ever landed in the DB. Persisting per page makes every run durable: even a
    // cut-short pull leaves stock for the pages it managed to fetch.
    const brandSet = new Set<string>();
    const seenProductIds: string[] = [];
    const categoryCounts = new Map<string, number>();
    let productsSynced = 0;
    let fetchedCount = 0;
    // Per-run stock observability counters.
    let stockKnownThisRun = 0; // rows where the payload carried a stock reading
    let stockZeroThisRun = 0; // ...of which were a confirmed 0 (Agotado)
    let stockUnknownThisRun = 0; // payload had no stock signal -> left untouched

    const { expectedCount, complete } = await client.streamProductos(
      async (rawProductos) => {
        fetchedCount += rawProductos.length;
        for (const raw of rawProductos) {
          const mapped = mapProduct(raw);
          if (!mapped) continue;
          const { product, stockQty } = mapped;

          // Stock lives on the product row (one-number-per-product). Write it
          // whenever the ERP reported it via the proper channel — including a
          // legitimate 0 (mapper returns 0 when the warehouse breakdown is
          // present but empty). Only when the payload carried NO stock signal at
          // all (stockQty === undefined) do we leave the stored value alone, so
          // we never wipe stock the real-time price/stock webhook already set.
          const stockSet =
            stockQty !== undefined
              ? { erpStockQty: stockQty, stockUpdatedAt: new Date() }
              : {};
          if (stockQty === undefined) {
            stockUnknownThisRun += 1;
          } else {
            stockKnownThisRun += 1;
            if (stockQty === 0) stockZeroThisRun += 1;
          }

          await db
            .insert(productsTable)
            .values({ ...product, ...stockSet })
            .onConflictDoUpdate({
              target: productsTable.id,
              set: {
                sku: product.sku,
                name: product.name,
                brand: product.brand,
                categoryId: product.categoryId,
                price: product.price,
                costo: product.costo,
                originalPrice: product.originalPrice,
                image: product.image,
                specs: product.specs,
                ...stockSet,
              },
            });
          seenProductIds.push(product.id);
          productsSynced += 1;
          if (product.brand) brandSet.add(product.brand);
          if (product.categoryId) {
            categoryCounts.set(
              product.categoryId,
              (categoryCounts.get(product.categoryId) ?? 0) + 1,
            );
          }
        }
      },
    );
    // A pull is only "complete" when pagination ended naturally AND we got at
    // least ~90% of the count the API advertised. A partial/cut-short pull must
    // NEVER trigger the destructive prune below, or it would wipe live products.
    const pullComplete =
      complete &&
      fetchedCount > 0 &&
      (expectedCount === null ||
        fetchedCount >= Math.floor(expectedCount * 0.9));
    logger.info(
      {
        productsSynced,
        fetchedCount,
        expectedCount,
        pullComplete,
        stockKnownThisRun,
        stockZeroThisRun,
        stockUnknownThisRun,
      },
      "Admintotal: productos sincronizados",
    );

    // 4) Brands
    const seenBrands = Array.from(brandSet);
    for (const name of seenBrands) {
      await db
        .insert(brandsTable)
        .values({ name })
        .onConflictDoNothing({ target: brandsTable.name });
    }
    // Prune stale products, then stale brands — but ONLY when the product pull
    // looked complete. A partial/failed pull must never delete products (that
    // would empty the catalog on a transient ERP hiccup); we keep the existing
    // rows and try again next sync. Stock lives on the product row
    // (products.erpStockQty), so pruning a product removes its stock with it.
    if (pullComplete) {
      if (seenProductIds.length > 0) {
        await db.delete(productsTable).where(notInArray(productsTable.id, seenProductIds));
      }
      if (seenBrands.length > 0) {
        await db.delete(brandsTable).where(notInArray(brandsTable.name, seenBrands));
      }
    } else {
      logger.warn(
        { fetched: fetchedCount, expectedCount },
        "Admintotal: pull de productos incompleto; se omite la limpieza para no borrar productos/inventario",
      );
    }

    // 5) Category counts — zero out categories not seen in this sync.
    if (categoryCounts.size < categories.length) {
      const seenCategoryIds = Array.from(categoryCounts.keys());
      if (seenCategoryIds.length > 0) {
        await db
          .update(categoriesTable)
          .set({ count: 0 })
          .where(notInArray(categoriesTable.id, seenCategoryIds));
      }
    }
    for (const [id, count] of categoryCounts) {
      await db
        .update(categoriesTable)
        .set({ count })
        .where(sql`${categoriesTable.id} = ${id}`);
    }

    // Observability: catalog-wide stock coverage AFTER this run, so we can see
    // how many products now show a real quantity ("known") vs. still read
    // "Consultar" (NULL) — and confirm the gap is closing over time.
    const statsRows = await db
      .select({
        total: sql<number>`count(*)::int`,
        known: sql<number>`count(${productsTable.erpStockQty})::int`,
        zero: sql<number>`count(*) filter (where ${productsTable.erpStockQty} = 0)::int`,
        unknown: sql<number>`count(*) filter (where ${productsTable.erpStockQty} is null)::int`,
      })
      .from(productsTable);
    const stats = statsRows[0] ?? { total: 0, known: 0, zero: 0, unknown: 0 };
    logger.info(
      {
        pullComplete,
        knownThisRun: stockKnownThisRun,
        zeroThisRun: stockZeroThisRun,
        unknownThisRun: stockUnknownThisRun,
        catalogTotal: stats.total,
        catalogKnown: stats.known,
        catalogZero: stats.zero,
        catalogUnknown: stats.unknown,
      },
      "Admintotal: cobertura de stock tras sincronización",
    );

    const finishedAt = new Date();
    const coverageMsg =
      stats.total > 0
        ? ` ${stats.known}/${stats.total} con stock conocido (${stats.unknown} en "Consultar").`
        : "";
    await setSyncState({
      status: "success",
      lastFinishedAt: finishedAt,
      lastSuccessAt: finishedAt,
      lastError: null,
      message: `Sincronización ${pullComplete ? "completada" : "parcial (límite de tasa del ERP)"}.${coverageMsg}`,
      productsSynced,
      categoriesSynced: categories.length,
      sucursalesSynced: sucursales.length,
      brandsSynced: brandSet.size,
    });
    logger.info("Admintotal: sincronización entrante completada");

    return {
      ok: true,
      productsSynced,
      categoriesSynced: categories.length,
      sucursalesSynced: sucursales.length,
      brandsSynced: brandSet.size,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Admintotal: sincronización entrante falló");
    await setSyncState({
      status: "error",
      lastFinishedAt: new Date(),
      lastError: msg,
      message: `Error de sincronización: ${msg}`,
    });
    return {
      ok: false,
      productsSynced: 0,
      categoriesSynced: 0,
      sucursalesSynced: 0,
      brandsSynced: 0,
      error: msg,
    };
  } finally {
    syncing = false;
  }
}
