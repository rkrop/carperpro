// Shopify catalog sync — push Carper products into the Shopify store.
//
// Design rules:
//  • Idempotent: looks up product by handle before creating; updates in-place.
//  • Never-price-0: products with no usable price (effectivePrice = 0) are
//    skipped with a warning (they would show $0 and confuse buyers).
//  • Stock null = unknown (don't touch Shopify inventory); 0 = confirmed out;
//    positive = set the on-hand quantity at the default location.
//  • Handle convention: "sku-{sku.toLowerCase().replace(/[^a-z0-9]/g, '-')}".
//    Both this file and the checkout route MUST use this same function.
//  • Rate-limit friendly: 250 ms cooldown between products in a batch; the
//    throttleIfNeeded helper backs off further when the Shopify cost bucket
//    is low.
//
// Entry points:
//  syncDeltaToShopify(sinceMs?)  — push products modified in the last N ms
//                                   (default 30 min); used by the scheduler.
//  triggerFullCatalogSync()      — syncs ALL sellable products; admin-only;
//                                   runs in background, returns immediately.

import { and, eq, gte, not } from "drizzle-orm";
import { db, productsTable } from "@workspace/db";
import { effectivePrice } from "../pricing";
import { logger } from "../logger";
import { shopifyAdminRequest, throttleIfNeeded } from "./admin";
import { productHandle } from "./handle";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductByHandleResponse = {
  productByHandle: null | {
    id: string;
    variants: { edges: Array<{ node: { id: string; inventoryItem: { id: string } } }> };
  };
};

type ProductCreateResponse = {
  productCreate: {
    product: { id: string; variants: { edges: Array<{ node: { id: string; inventoryItem: { id: string } } }> } } | null;
    userErrors: Array<{ field: string[]; message: string }>;
  };
};

type ProductUpdateResponse = {
  productUpdate: {
    product: { id: string } | null;
    userErrors: Array<{ field: string[]; message: string }>;
  };
};

type InventorySetResponse = {
  inventorySetOnHandQuantities: {
    userErrors: Array<{ field: string[]; message: string }>;
  };
};

type LocationResponse = {
  locations: { edges: Array<{ node: { id: string; name: string } }> };
};

type PublicationsResponse = {
  publications: { edges: Array<{ node: { id: string; name: string } }> };
};

type PublishResponse = {
  publishablePublish: {
    userErrors: Array<{ field: string[]; message: string }>;
  };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SYNC_BATCH_DELAY_MS = 300;
let defaultLocationId: string | null = null;
let onlineStorePublicationId: string | null = null;

async function getDefaultLocationId(): Promise<string | null> {
  if (defaultLocationId) return defaultLocationId;
  try {
    const resp = await shopifyAdminRequest<LocationResponse>(
      `query { locations(first: 1) { edges { node { id name } } } }`,
    );
    const loc = resp.data.locations.edges[0]?.node;
    if (loc) {
      defaultLocationId = loc.id;
      logger.info({ locationId: loc.id, name: loc.name }, "Shopify: ubicación por defecto");
    }
  } catch (err) {
    logger.warn({ err }, "Shopify: no se pudo obtener ubicación por defecto");
  }
  return defaultLocationId;
}

async function getOnlineStorePublicationId(): Promise<string | null> {
  if (onlineStorePublicationId) return onlineStorePublicationId;
  try {
    const resp = await shopifyAdminRequest<PublicationsResponse>(
      `query { publications(first: 10) { edges { node { id name } } } }`,
    );
    const pub = resp.data.publications.edges.find(
      (e) =>
        e.node.name.toLowerCase().includes("online store") ||
        e.node.name.toLowerCase().includes("tienda en línea"),
    );
    if (pub) {
      onlineStorePublicationId = pub.node.id;
      logger.info(
        { publicationId: pub.node.id, name: pub.node.name },
        "Shopify: publicación Online Store",
      );
    }
  } catch (err) {
    logger.warn({ err }, "Shopify: no se pudo obtener publicación Online Store");
  }
  return onlineStorePublicationId;
}

/**
 * Publish a product to the Online Store channel.
 * Returns an error string on failure (so callers can surface it), null on success.
 */
async function publishProduct(productGid: string): Promise<string | null> {
  const publicationId = await getOnlineStorePublicationId();
  if (!publicationId) return "No se pudo obtener el ID de publicación Online Store";
  try {
    const resp = await shopifyAdminRequest<PublishResponse>(
      `mutation publishablePublish($id: ID!, $input: [PublicationInput!]!) {
        publishablePublish(id: $id, input: $input) {
          userErrors { field message }
        }
      }`,
      { id: productGid, input: [{ publicationId }] },
    );
    const errs = resp.data.publishablePublish.userErrors;
    if (errs.length) {
      const msg = errs.map((e) => e.message).join("; ");
      logger.warn({ productGid, errs }, `Shopify: userErrors al publicar producto: ${msg}`);
      return msg;
    }
    return null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ err, productGid }, "Shopify: no se pudo publicar producto");
    return msg;
  }
}

/**
 * Set on-hand inventory for a product variant using its InventoryItem GID.
 * NOTE: `inventoryItemId` is variant.inventoryItem.id — NOT the variant GID.
 * Returns an error string on failure, null on success.
 */
async function setInventory(
  inventoryItemId: string,
  qty: number,
): Promise<string | null> {
  const locationId = await getDefaultLocationId();
  if (!locationId) return "Ubicación por defecto no disponible";
  try {
    const resp = await shopifyAdminRequest<InventorySetResponse>(
      `mutation inventorySetOnHandQuantities($input: InventorySetOnHandQuantitiesInput!) {
        inventorySetOnHandQuantities(input: $input) {
          userErrors { field message }
        }
      }`,
      {
        input: {
          reason: "correction",
          setQuantities: [
            {
              inventoryItemId,
              locationId,
              quantity: qty,
            },
          ],
        },
      },
    );
    const errs = resp.data.inventorySetOnHandQuantities.userErrors;
    if (errs.length) {
      const msg = errs.map((e) => e.message).join("; ");
      logger.warn({ errs, inventoryItemId }, `Shopify: userErrors al actualizar inventario: ${msg}`);
      return msg;
    }
    return null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ err, inventoryItemId }, "Shopify: error al actualizar inventario");
    return msg;
  }
}

// ─── Core upsert ──────────────────────────────────────────────────────────────

export type SyncResult = {
  sku: string;
  action: "created" | "updated" | "skipped_no_price" | "error";
  error?: string;
};

export async function upsertProductToShopify(product: {
  id: string;
  sku: string;
  name: string;
  brand: string;
  price: number;
  costo: number | null;
  image: string | null;
  erpStockQty: number | null;
  status: string;
}): Promise<SyncResult> {
  const sku = product.sku || product.id;
  const price = effectivePrice({ price: product.price, costo: product.costo ?? null });

  if (!price || price <= 0) {
    return { sku, action: "skipped_no_price" };
  }

  const handle = productHandle(sku);
  const priceStr = price.toFixed(2);
  const productTitle = product.name;
  const vendor = product.brand === "SIN MARCA" ? "Carper Autopartes" : product.brand;

  try {
    // 1. Check if product already exists
    const existing = await shopifyAdminRequest<ProductByHandleResponse>(
      `query ($handle: String!) {
        productByHandle(handle: $handle) {
          id
          variants(first: 1) {
            edges { node { id inventoryItem { id } } }
          }
        }
      }`,
      { handle },
    );

    const existingProduct = existing.data.productByHandle;

    if (existingProduct) {
      // Update price and title
      const variantNode = existingProduct.variants.edges[0]?.node;
      const variantGid = variantNode?.id;
      const inventoryItemId = variantNode?.inventoryItem.id;
      const updateResp = await shopifyAdminRequest<ProductUpdateResponse>(
        `mutation productUpdate($input: ProductInput!) {
          productUpdate(input: $input) {
            product { id }
            userErrors { field message }
          }
        }`,
        {
          input: {
            id: existingProduct.id,
            title: productTitle,
            vendor,
            variants: variantGid
              ? [{ id: variantGid, price: priceStr, sku }]
              : [{ price: priceStr, sku }],
          },
        },
      );
      const errs = updateResp.data.productUpdate.userErrors;
      if (errs.length) {
        return { sku, action: "error", error: errs.map((e) => e.message).join("; ") };
      }

      // Update inventory using InventoryItem GID (NOT variant GID)
      if (product.erpStockQty !== null && inventoryItemId) {
        const invErr = await setInventory(inventoryItemId, product.erpStockQty);
        if (invErr) {
          return { sku, action: "error", error: `inventory: ${invErr}` };
        }
      }

      await throttleIfNeeded(updateResp.extensions);
      return { sku, action: "updated" };
    } else {
      // Create new product
      const imageInput =
        product.image
          ? [{ src: product.image, altText: productTitle }]
          : [];

      const createResp = await shopifyAdminRequest<ProductCreateResponse>(
        `mutation productCreate($input: ProductInput!) {
          productCreate(input: $input) {
            product {
              id
              variants(first: 1) {
                edges { node { id inventoryItem { id } } }
              }
            }
            userErrors { field message }
          }
        }`,
        {
          input: {
            handle,
            title: productTitle,
            vendor,
            productType: "Autopartes",
            tags: [sku, product.brand].filter(Boolean),
            variants: [{ price: priceStr, sku }],
            images: imageInput,
          },
        },
      );

      const errs = createResp.data.productCreate.userErrors;
      if (errs.length) {
        return { sku, action: "error", error: errs.map((e) => e.message).join("; ") };
      }

      const newProduct = createResp.data.productCreate.product;
      if (newProduct) {
        const variantNode = newProduct.variants.edges[0]?.node;
        const inventoryItemId = variantNode?.inventoryItem.id;
        // Set inventory using InventoryItem GID (NOT variant GID)
        if (product.erpStockQty !== null && inventoryItemId) {
          const invErr = await setInventory(inventoryItemId, product.erpStockQty);
          if (invErr) {
            // Inventory failure: log but don't fail the create — product is in Shopify
            logger.warn({ sku, invErr }, "Shopify: producto creado pero inventario no actualizado");
          }
        }
        // Publish to Online Store — failure is returned and logged as a warning
        const pubErr = await publishProduct(newProduct.id);
        if (pubErr) {
          logger.warn({ sku, pubErr }, "Shopify: producto creado pero no publicado en Online Store");
        }
      }

      await throttleIfNeeded(createResp.extensions);
      return { sku, action: "created" };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { sku, action: "error", error: msg };
  }
}

// ─── Delta sync ───────────────────────────────────────────────────────────────

let deltaSyncRunning = false;

/**
 * Push products modified in the last `sinceMs` milliseconds to Shopify.
 * Guarded so only one instance runs at a time.
 */
export async function syncDeltaToShopify(
  sinceMs: number = 30 * 60 * 1_000,
): Promise<{ synced: number; errors: number; skipped: number }> {
  if (deltaSyncRunning) {
    logger.debug("Shopify delta sync: ya hay una ejecución en curso, se omite");
    return { synced: 0, errors: 0, skipped: 0 };
  }
  deltaSyncRunning = true;
  try {
    const since = new Date(Date.now() - sinceMs);
    const products = await db
      .select({
        id: productsTable.id,
        sku: productsTable.sku,
        name: productsTable.name,
        brand: productsTable.brand,
        price: productsTable.price,
        costo: productsTable.costo,
        image: productsTable.image,
        erpStockQty: productsTable.erpStockQty,
        status: productsTable.status,
      })
      .from(productsTable)
      .where(
        and(
          not(eq(productsTable.status, "sin_precio")),
          gte(productsTable.updatedAt, since),
        ),
      )
      .limit(500);

    if (products.length === 0) return { synced: 0, errors: 0, skipped: 0 };

    logger.info(
      { count: products.length, since: since.toISOString() },
      "Shopify delta sync: iniciando",
    );

    let synced = 0;
    let errors = 0;
    let skipped = 0;

    for (const product of products) {
      const result = await upsertProductToShopify(product);
      if (result.action === "created" || result.action === "updated") synced++;
      else if (result.action === "error") {
        errors++;
        logger.warn({ sku: result.sku, error: result.error }, "Shopify sync: error en producto");
      } else skipped++;

      await new Promise((r) => setTimeout(r, SYNC_BATCH_DELAY_MS));
    }

    logger.info({ synced, errors, skipped }, "Shopify delta sync: completado");
    return { synced, errors, skipped };
  } finally {
    deltaSyncRunning = false;
  }
}

// ─── Full catalog sync (admin-triggered, background) ─────────────────────────

let fullSyncRunning = false;

/**
 * Sync the entire sellable catalog to Shopify.  This can take many minutes
 * for 14k+ products — it runs entirely in the background and returns
 * immediately.  Only one full sync runs at a time.
 */
export function triggerFullCatalogSync(): { started: boolean; message: string } {
  if (fullSyncRunning) {
    return { started: false, message: "Ya hay una sincronización completa en curso" };
  }
  fullSyncRunning = true;
  void (async () => {
    try {
      logger.info("Shopify full sync: iniciando sincronización completa del catálogo");
      let offset = 0;
      const PAGE_SIZE = 100;
      let totalSynced = 0;
      let totalErrors = 0;
      let totalSkipped = 0;

      while (true) {
        const products = await db
          .select({
            id: productsTable.id,
            sku: productsTable.sku,
            name: productsTable.name,
            brand: productsTable.brand,
            price: productsTable.price,
            costo: productsTable.costo,
            image: productsTable.image,
            erpStockQty: productsTable.erpStockQty,
            status: productsTable.status,
          })
          .from(productsTable)
          .where(not(eq(productsTable.status, "sin_precio")))
          .limit(PAGE_SIZE)
          .offset(offset);

        if (products.length === 0) break;

        for (const product of products) {
          const result = await upsertProductToShopify(product);
          if (result.action === "created" || result.action === "updated") totalSynced++;
          else if (result.action === "error") {
            totalErrors++;
            logger.warn(
              { sku: result.sku, error: result.error },
              "Shopify full sync: error en producto",
            );
          } else totalSkipped++;

          await new Promise((r) => setTimeout(r, SYNC_BATCH_DELAY_MS));
        }

        logger.info(
          { offset, batchSize: products.length, totalSynced, totalErrors },
          "Shopify full sync: lote completado",
        );
        offset += PAGE_SIZE;
      }

      logger.info(
        { totalSynced, totalErrors, totalSkipped },
        "Shopify full sync: sincronización completa terminada",
      );
    } catch (err) {
      logger.error({ err }, "Shopify full sync: error fatal");
    } finally {
      fullSyncRunning = false;
    }
  })();

  return { started: true, message: "Sincronización completa iniciada en segundo plano" };
}

export function isFullSyncRunning(): boolean {
  return fullSyncRunning;
}
