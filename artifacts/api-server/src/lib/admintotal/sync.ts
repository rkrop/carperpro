import { sql, notInArray, eq, lt } from "drizzle-orm";
import {
  db,
  categoriesTable,
  subcategoriesTable,
  brandsTable,
  sucursalesTable,
  productsTable,
  syncStateTable,
} from "@workspace/db";
import { logger } from "../logger";
import { getAdmintotalClient } from "./client";
import { isAdmintotalConfigured, missingConfigMessage } from "./config";
import { mapCategory, mapSubcategory, mapSucursal, mapProduct } from "./mapper";

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

  // Resume bookkeeping: continue the product pull from where the last tick
  // stopped instead of restarting at page 0. A `cursorUrl` means a previous run
  // was cut short by the ERP rate limit; NULL means start a fresh full pass.
  const prevRows = await db
    .select()
    .from(syncStateTable)
    .where(eq(syncStateTable.key, SYNC_KEY))
    .limit(1);
  const prev = prevRows[0];
  const resumeUrl = prev?.cursorUrl ?? null;
  const freshCycle = !resumeUrl;
  // A "cycle" is one full pass over the catalog; it may span several ticks. We
  // stamp when it began so that, once it completes, we can prune products no
  // longer in the ERP (any row not touched since the cycle started).
  const cycleStartedAt = freshCycle
    ? startedAt
    : (prev?.cycleStartedAt ?? startedAt);
  const priorCycleFetched = freshCycle ? 0 : (prev?.cycleFetchedCount ?? 0);

  await setSyncState({
    status: "running",
    lastStartedAt: startedAt,
    lastError: null,
    cycleStartedAt,
    message: resumeUrl
      ? "Reanudando sincronización con Admintotal…"
      : "Sincronizando con Admintotal…",
  });
  logger.info(
    { resuming: !freshCycle, priorCycleFetched },
    "Admintotal: iniciando sincronización entrante",
  );

  try {
    const client = getAdmintotalClient();

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

    // 1b) Sublineas -> subcategories. Only keep named, non-self sublineas whose
    // parent linea still exists, so the second-level nav never points at an
    // orphan category. `validSubIds` is used below to keep products.subcategoryId
    // referentially clean (a product whose sublinea was dropped here is stored
    // with a NULL subcategory rather than a dangling id).
    const categoryIdSet = new Set(categoryIds);
    const rawSublineas = await client.getSublineas();
    const subcategories = rawSublineas
      .map(mapSubcategory)
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .filter((s) => categoryIdSet.has(s.categoryId));
    const subcategoryIds = subcategories.map((s) => s.id);
    const validSubIds = new Set(subcategoryIds);
    for (const s of subcategories) {
      await db
        .insert(subcategoriesTable)
        .values(s)
        .onConflictDoUpdate({
          target: subcategoriesTable.id,
          set: { categoryId: s.categoryId, name: s.name },
        });
    }
    // Remove subcategories no longer in ERP.
    if (subcategoryIds.length > 0) {
      await db
        .delete(subcategoriesTable)
        .where(notInArray(subcategoriesTable.id, subcategoryIds));
    } else {
      await db.delete(subcategoriesTable);
    }
    logger.info(
      { count: subcategories.length },
      "Admintotal: subcategorías sincronizadas",
    );

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
    const categoryCounts = new Map<string, number>();
    let productsSynced = 0;
    let fetchedCount = 0;
    // Per-run stock observability counters.
    let stockKnownThisRun = 0; // rows where the payload carried a stock reading
    let stockZeroThisRun = 0; // ...of which were a confirmed 0 (Agotado)
    let stockUnknownThisRun = 0; // payload had no stock signal -> left untouched

    const { expectedCount, complete, nextUrl } = await client.streamProductos(
      async (rawProductos) => {
        fetchedCount += rawProductos.length;
        for (const raw of rawProductos) {
          const mapped = mapProduct(raw);
          if (!mapped) continue;
          const { product, stockQty } = mapped;
          // Keep subcategoryId referentially clean: only persist it when the
          // sublinea survived as a real subcategories row this cycle.
          const subcategoryId =
            product.subcategoryId && validSubIds.has(product.subcategoryId)
              ? product.subcategoryId
              : null;
          // Stamp every touched row so the cycle-completion prune (which deletes
          // rows untouched since `cycleStartedAt`) keeps everything we saw —
          // even across the multiple ticks a full pass now spans. Relying on the
          // schema's $onUpdate is not safe here because Drizzle does not apply
          // it to onConflictDoUpdate, so we set it explicitly on both paths.
          const touchedAt = new Date();

          // Stock lives on the product row (one-number-per-product). Write it
          // whenever the ERP reported it via the proper channel — including a
          // legitimate 0 (mapper returns 0 when the warehouse breakdown is
          // present but empty). Only when the payload carried NO stock signal at
          // all (stockQty === undefined) do we leave the stored value alone, so
          // we never wipe stock the real-time price/stock webhook already set.
          const stockSet =
            stockQty !== undefined
              ? { erpStockQty: stockQty, stockUpdatedAt: touchedAt }
              : {};
          if (stockQty === undefined) {
            stockUnknownThisRun += 1;
          } else {
            stockKnownThisRun += 1;
            if (stockQty === 0) stockZeroThisRun += 1;
          }

          await db
            .insert(productsTable)
            .values({ ...product, subcategoryId, ...stockSet, updatedAt: touchedAt })
            .onConflictDoUpdate({
              target: productsTable.id,
              set: {
                sku: product.sku,
                name: product.name,
                brand: product.brand,
                categoryId: product.categoryId,
                subcategoryId,
                price: product.price,
                costo: product.costo,
                originalPrice: product.originalPrice,
                image: product.image,
                specs: product.specs,
                updatedAt: touchedAt,
                ...stockSet,
              },
            });
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
      // Resume from where the previous tick stopped (null = fresh full pass).
      resumeUrl,
    );
    // Cumulative rows fetched across every tick of the current pass. The pull
    // now resumes across ticks, so a single run only sees part of the catalog;
    // coverage / prune decisions must be made against the whole cycle, not one
    // run. `complete` (the `next` link became null) signals we reached the end
    // of the catalog and the cycle is therefore finished.
    const cycleFetchedCount = priorCycleFetched + fetchedCount;
    const cycleComplete = complete;
    // The cycle is only "complete enough" to prune when pagination ended
    // naturally AND we fetched ~90% of the advertised count over the whole pass.
    // A partial/cut-short pull must NEVER trigger the destructive prune below,
    // or it would wipe live products on a transient ERP hiccup.
    const pullComplete =
      cycleComplete &&
      cycleFetchedCount > 0 &&
      (expectedCount === null ||
        cycleFetchedCount >= Math.floor(expectedCount * 0.9));
    logger.info(
      {
        productsSynced,
        fetchedCount,
        cycleFetchedCount,
        expectedCount,
        cycleComplete,
        pullComplete,
        resumed: !freshCycle,
        willResume: !cycleComplete,
        stockKnownThisRun,
        stockZeroThisRun,
        stockUnknownThisRun,
      },
      "Admintotal: productos sincronizados",
    );

    // 4) Brands — insert any brand seen this tick (idempotent across the cycle).
    const seenBrands = Array.from(brandSet);
    for (const name of seenBrands) {
      await db
        .insert(brandsTable)
        .values({ name })
        .onConflictDoNothing({ target: brandsTable.name });
    }
    // Prune stale products, then stale brands — but ONLY when the whole pass
    // completed. Because a pass spans multiple ticks, we can't use this run's
    // seen-id list; instead we delete any product not touched since the cycle
    // began (its `updatedAt` predates `cycleStartedAt`). A partial/failed pull
    // must never delete products (that would empty the catalog on a transient
    // ERP hiccup). Stock lives on the product row (products.erpStockQty), so
    // pruning a product removes its stock with it.
    if (pullComplete) {
      await db
        .delete(productsTable)
        .where(lt(productsTable.updatedAt, cycleStartedAt));
      // Drop brands that no longer have any product after the prune above.
      const liveBrandRows = await db
        .selectDistinct({ brand: productsTable.brand })
        .from(productsTable);
      const liveBrands = liveBrandRows
        .map((r) => r.brand)
        .filter((b): b is string => !!b);
      if (liveBrands.length > 0) {
        await db
          .delete(brandsTable)
          .where(notInArray(brandsTable.name, liveBrands));
      } else {
        // No products left at all — clear every brand too (notInArray with an
        // empty list is a no-op, so this case must be handled explicitly).
        await db.delete(brandsTable);
      }
    } else {
      logger.warn(
        { fetched: fetchedCount, cycleFetchedCount, expectedCount },
        "Admintotal: pull de productos incompleto; se omite la limpieza para no borrar productos/inventario",
      );
    }

    // 5) Category counts — recompute straight from the products table rather
    // than from this run's accumulator. A pass now spans several ticks, so the
    // per-run `categoryCounts` only covers part of the catalog; deriving counts
    // from the table keeps them correct on every partial run instead of
    // clobbering them with a fraction of the real total.
    void categoryCounts; // retained for per-run observability only
    await db.update(categoriesTable).set({ count: 0 });
    await db.execute(sql`
      update ${categoriesTable} c
      set count = sub.cnt
      from (
        select ${productsTable.categoryId} as category_id, count(*)::int as cnt
        from ${productsTable}
        where ${productsTable.categoryId} is not null
        group by ${productsTable.categoryId}
      ) sub
      where c.id = sub.category_id
    `);

    // Subcategory counts — same table-derived recompute as categories above, so
    // partial (multi-tick) passes keep correct counts instead of clobbering them.
    await db.update(subcategoriesTable).set({ count: 0 });
    await db.execute(sql`
      update ${subcategoriesTable} sc
      set count = sub.cnt
      from (
        select ${productsTable.subcategoryId} as subcategory_id, count(*)::int as cnt
        from ${productsTable}
        where ${productsTable.subcategoryId} is not null
        group by ${productsTable.subcategoryId}
      ) sub
      where sc.id = sub.subcategory_id
    `);

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
    // Persist where to resume: if the pass finished (reached the end of the
    // catalog) clear the cursor and counters so the next tick starts a fresh
    // full pass; otherwise save the `nextUrl` and the running fetched count so
    // the next tick picks up exactly where this one stopped instead of page 0.
    const resumeMsg = cycleComplete
      ? ""
      : " Continúa en la próxima corrida.";
    await setSyncState({
      status: "success",
      lastFinishedAt: finishedAt,
      lastSuccessAt: finishedAt,
      lastError: null,
      cursorUrl: cycleComplete ? null : nextUrl,
      cycleStartedAt: cycleComplete ? null : cycleStartedAt,
      cycleFetchedCount: cycleComplete ? 0 : cycleFetchedCount,
      message: `Sincronización ${pullComplete ? "completada" : "parcial (límite de tasa del ERP)"}.${coverageMsg}${resumeMsg}`,
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
