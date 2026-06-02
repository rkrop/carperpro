import { sql, notInArray } from "drizzle-orm";
import {
  db,
  categoriesTable,
  brandsTable,
  sucursalesTable,
  productsTable,
  inventoryTable,
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

    // 3) Productos -> products + brands + inventory
    const rawProductos = await client.getProductos();
    const brandSet = new Set<string>();
    const seenProductIds: string[] = [];
    const categoryCounts = new Map<string, number>();
    let productsSynced = 0;

    const defaultSucursalId = sucursales[0]?.id;

    for (const raw of rawProductos) {
      const mapped = mapProduct(raw);
      if (!mapped) continue;
      const { product, inventory, fallbackStock } = mapped;

      await db
        .insert(productsTable)
        .values(product)
        .onConflictDoUpdate({
          target: productsTable.id,
          set: {
            sku: product.sku,
            name: product.name,
            brand: product.brand,
            categoryId: product.categoryId,
            price: product.price,
            originalPrice: product.originalPrice,
            image: product.image,
            specs: product.specs,
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

      // Inventory: prefer per-sucursal breakdown, else attach flat stock to the
      // first sucursal so the app still reflects availability.
      const rows =
        inventory.length > 0
          ? inventory
          : fallbackStock !== undefined && defaultSucursalId
            ? [{ sucursalId: defaultSucursalId, quantity: Math.max(0, Math.round(fallbackStock)) }]
            : [];
      for (const inv of rows) {
        await db
          .insert(inventoryTable)
          .values({
            productId: product.id,
            sucursalId: inv.sucursalId,
            quantity: inv.quantity,
          })
          .onConflictDoUpdate({
            target: [inventoryTable.productId, inventoryTable.sucursalId],
            set: { quantity: inv.quantity },
          });
      }
    }
    logger.info({ count: productsSynced }, "Admintotal: productos sincronizados");

    // 4) Brands
    const seenBrands = Array.from(brandSet);
    for (const name of seenBrands) {
      await db
        .insert(brandsTable)
        .values({ name })
        .onConflictDoNothing({ target: brandsTable.name });
    }
    // Prune stale products and their inventory, then stale brands.
    if (seenProductIds.length > 0) {
      await db.delete(inventoryTable).where(notInArray(inventoryTable.productId, seenProductIds));
      await db.delete(productsTable).where(notInArray(productsTable.id, seenProductIds));
    }
    if (seenBrands.length > 0) {
      await db.delete(brandsTable).where(notInArray(brandsTable.name, seenBrands));
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

    const finishedAt = new Date();
    await setSyncState({
      status: "success",
      lastFinishedAt: finishedAt,
      lastSuccessAt: finishedAt,
      lastError: null,
      message: "Sincronización completada",
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
