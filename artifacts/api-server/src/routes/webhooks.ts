import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { timingSafeEqual } from "node:crypto";
import { eq, sql, and, or, isNull } from "drizzle-orm";
import { db, productsTable, brandsTable } from "@workspace/db";
import { notifyBackInStock } from "../lib/push/notify";
import { logger } from "../lib/logger";
import { getWebhookToken } from "../lib/admintotal/config";
import { mapProduct } from "../lib/admintotal/mapper";
import { syncDeltaToShopify } from "../lib/shopify/catalog-sync";
import {
  normalizeSkuBase,
  ESTIMATED_PRICE_MARKUP,
} from "../lib/admintotal/sku";

// Inbound Admintotal webhooks. Admintotal POSTs notifications here for:
//  - price/stock changes  -> /webhooks/admintotal/precios-existencias
//  - product creation     -> /webhooks/admintotal/productos
// Auth is via a shared token in the "Api-key" header (or HTTP Basic password),
// matched against ADMINTOTAL_WEBHOOK_TOKEN. See docs.admintotal.com -> Webhooks.

const router: IRouter = Router();

type Raw = Record<string, unknown>;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// Pull the auth token from the "Api-key" header or an HTTP Basic password.
function extractToken(req: Request): string | undefined {
  const apiKey = req.header("Api-key");
  if (apiKey && apiKey.trim()) return apiKey.trim();
  const auth = req.header("authorization");
  if (auth && auth.toLowerCase().startsWith("basic ")) {
    try {
      const decoded = Buffer.from(auth.slice(6).trim(), "base64").toString(
        "utf8",
      );
      const idx = decoded.indexOf(":");
      return idx >= 0 ? decoded.slice(idx + 1) : decoded;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function authWebhook(req: Request, res: Response, next: NextFunction): void {
  const expected = getWebhookToken();
  if (!expected) {
    // Fail closed in production: without a configured token anyone could mutate
    // catalog price/stock, so reject. In dev we allow it (with a warning) so the
    // webhook can be exercised before the secret is set.
    if (process.env.NODE_ENV === "production") {
      logger.error(
        "Webhook Admintotal rechazado: falta ADMINTOTAL_WEBHOOK_TOKEN en producción.",
      );
      res.status(401).json({ error: "No autorizado" });
      return;
    }
    logger.warn(
      "Webhook Admintotal sin token (ADMINTOTAL_WEBHOOK_TOKEN). Se acepta la petición; configura un token para autenticar.",
    );
    next();
    return;
  }
  const provided = extractToken(req);
  if (!provided || !safeEqual(provided, expected)) {
    logger.warn("Webhook Admintotal rechazado: token inválido o ausente");
    res.status(401).json({ error: "No autorizado" });
    return;
  }
  next();
}

// Hard caps on batch size to bound per-request DB work (DoS protection).
// Admintotal sends <=50 price/stock rows per request; we allow generous headroom.
const MAX_PRICE_STOCK_ITEMS = 500;
const MAX_PRODUCT_ITEMS = 100;

// Parse a numeric field. Returns undefined for empty/non-numeric input so that a
// malformed value (e.g. "", "N/A") can never silently zero out price/costo/stock.
function asNumber(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^0-9.\-]/g, "");
    if (cleaned === "" || cleaned === "-" || cleaned === ".") return undefined;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function asSku(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v).trim();
  return "";
}

// Defensive field reader (same strategy as the ERP mapper): Admintotal sends
// Spanish field names that vary by payload, so try a list of plausible keys and
// take the first present, non-empty one.
function pick(raw: Raw, keys: string[]): unknown {
  for (const k of keys) {
    if (raw[k] !== undefined && raw[k] !== null && raw[k] !== "") return raw[k];
  }
  return undefined;
}

// Price / stock changes. Body is an array of { sku, precio, costo, stock }.
// Admintotal batches up to 50 per request, every ~4 minutes.
router.post(
  "/webhooks/admintotal/precios-existencias",
  authWebhook,
  async (req: Request, res: Response): Promise<void> => {
    const body: unknown = req.body;
    const items: Raw[] = Array.isArray(body)
      ? (body as Raw[])
      : body &&
          typeof body === "object" &&
          Array.isArray((body as Raw).productos)
        ? ((body as Raw).productos as Raw[])
        : [];

    // DIAGNOSTIC: log only shape/count, not the full batch. Price/stock payloads
    // are operational data and can be large, so normal logs stay compact.
    logger.info(
      {
        itemCount: items.length,
        firstItemKeys: items[0] ? Object.keys(items[0]) : [],
      },
      "Webhook Admintotal precios/existencias: cuerpo recibido (diagnóstico)",
    );

    if (items.length === 0) {
      res.status(400).json({ error: "Se esperaba un arreglo de productos" });
      return;
    }
    if (items.length > MAX_PRICE_STOCK_ITEMS) {
      logger.warn(
        { received: items.length },
        "Webhook Admintotal: lote de precios/existencias demasiado grande, rechazado",
      );
      res.status(413).json({
        error: `Demasiados productos (máximo ${MAX_PRICE_STOCK_ITEMS})`,
      });
      return;
    }

    let pricesUpdated = 0;
    let stockUpdated = 0;
    let notFound = 0;
    const notFoundSkus: string[] = [];
    // Product ids that go from 0/unknown stock to a positive count this batch —
    // notified to back-in-stock subscribers after the loop (best-effort).
    const restockIds: string[] = [];

    for (const item of items) {
      // Tolerant field matching: Admintotal uses Spanish names (clave/codigo for
      // the identifier, existencia/existencias for stock), same as the ERP
      // mapper assumes — so read each field from a list of plausible keys.
      const sku = asSku(
        pick(item, [
          "sku",
          "clave",
          "codigo",
          "codigo_barras",
          "clave_producto",
        ]),
      );
      // Match on the NORMALIZED base code, so a bare "U52351" updates the stored
      // "U52351-UNIFLOW" (and any other product sharing that base). Same rule as
      // the trigger that maintains products.sku_base.
      const base = normalizeSkuBase(sku);
      if (!base) {
        // No recognizable identifier: count it instead of silently skipping.
        notFound += 1;
        notFoundSkus.push("(sin identificador)");
        continue;
      }

      const precio = asNumber(
        pick(item, ["precio", "precio_publico", "precio1", "price"]),
      );
      const costo = asNumber(
        pick(item, ["costo", "precio_costo", "costo_promedio"]),
      );
      const stock = asNumber(
        pick(item, [
          "stock",
          "existencia",
          "existencias",
          "cantidad",
          "inventario",
          "disponible",
        ]),
      );

      const hasPriceSignal = precio !== undefined || costo !== undefined;
      const hasStock = stock !== undefined;
      if (!hasPriceSignal && !hasStock) continue;

      // Bind null when a field is absent so the SQL CASEs can tell "not sent"
      // apart and fall through to the stored value.
      const precioParam = precio !== undefined ? precio : null;
      const costoParam = costo !== undefined ? costo : null;

      const set: Record<string, unknown> = {};
      if (hasPriceSignal) {
        // NEVER-PRICE-0 + never-lower-a-good-price: a usable incoming price wins;
        // otherwise keep the existing valid price; otherwise estimate from costo
        // (incoming or stored); otherwise leave it. Status/source follow the same
        // resolution so the row is consistent.
        set.price = sql`CASE
          WHEN ${precioParam}::double precision > 0 THEN ${precioParam}::double precision
          WHEN ${productsTable.price} > 0 THEN ${productsTable.price}
          WHEN COALESCE(${costoParam}::double precision, ${productsTable.costo}) > 0
            THEN round((COALESCE(${costoParam}::double precision, ${productsTable.costo}) * ${ESTIMATED_PRICE_MARKUP})::numeric, 2)::double precision
          ELSE ${productsTable.price} END`;
        set.priceSource = sql`CASE
          WHEN ${precioParam}::double precision > 0 THEN 'Webhook'
          WHEN ${productsTable.price} > 0 THEN ${productsTable.priceSource}
          WHEN COALESCE(${costoParam}::double precision, ${productsTable.costo}) > 0 THEN 'Estimado'
          ELSE ${productsTable.priceSource} END`;
        set.status = sql`CASE
          WHEN ${precioParam}::double precision > 0 THEN 'activo'
          WHEN ${productsTable.price} > 0 THEN 'activo'
          WHEN COALESCE(${costoParam}::double precision, ${productsTable.costo}) > 0 THEN 'activo'
          ELSE 'sin_precio' END`;
        // Only overwrite costo when one actually arrived.
        if (costoParam !== null) set.costo = costoParam;
      }
      let incomingQty: number | null = null;
      if (hasStock) {
        incomingQty = Math.max(0, Math.round(stock as number));
        set.erpStockQty = incomingQty;
        set.stockUpdatedAt = new Date();
      }

      // Detect a 0/unknown -> positive transition BEFORE the update so we can
      // notify back-in-stock subscribers. Only query when the incoming stock is
      // positive (the only case that can satisfy a "back in stock" alert).
      let wasOutIds: string[] = [];
      if (incomingQty !== null && incomingQty > 0) {
        wasOutIds = (
          await db
            .select({ id: productsTable.id })
            .from(productsTable)
            .where(
              and(
                eq(productsTable.skuBase, base),
                or(
                  eq(productsTable.erpStockQty, 0),
                  isNull(productsTable.erpStockQty),
                ),
              ),
            )
        ).map((r) => r.id);
      }

      const updated = await db
        .update(productsTable)
        .set(set)
        .where(eq(productsTable.skuBase, base))
        .returning({ id: productsTable.id });

      if (wasOutIds.length > 0) restockIds.push(...wasOutIds);

      if (updated.length === 0) {
        // Valid identifier but no product matched it: surface it instead of
        // failing silently, so a SKU/clave mismatch is visible in the response.
        notFound += 1;
        notFoundSkus.push(base);
        continue;
      }
      if (hasPriceSignal) pricesUpdated += updated.length;
      if (hasStock) stockUpdated += updated.length;
    }

    // Fire-and-forget back-in-stock pushes; never block the webhook response.
    if (restockIds.length > 0) {
      void notifyBackInStock(restockIds);
    }

    // Fire-and-forget: propagate just-updated prices/stock to the Shopify
    // storefront. Window = 2 min to capture this batch's `updated_at` stamps.
    // Silently skipped if another sync is already running (scheduler covers it).
    if (pricesUpdated > 0 || stockUpdated > 0) {
      void syncDeltaToShopify(2 * 60 * 1_000).catch((err) =>
        logger.warn(
          { err },
          "Shopify: no se pudo sincronizar precios/stock tras webhook Admintotal",
        ),
      );
    }

    logger.info(
      {
        received: items.length,
        pricesUpdated,
        stockUpdated,
        notFound,
        notFoundSkus,
      },
      "Webhook Admintotal: precios/existencias procesados",
    );
    res.json({
      ok: true,
      received: items.length,
      pricesUpdated,
      stockUpdated,
      notFound,
      notFoundSkus,
    });
  },
);

// Product creation. Body is a single product object (same shape as the ERP
// "productos" payload). Accepts an array too, for safety.
router.post(
  "/webhooks/admintotal/productos",
  authWebhook,
  async (req: Request, res: Response): Promise<void> => {
    const body: unknown = req.body;
    const list: Raw[] = Array.isArray(body)
      ? (body as Raw[])
      : body && typeof body === "object"
        ? [body as Raw]
        : [];

    if (list.length === 0) {
      res.status(400).json({ error: "Cuerpo inválido" });
      return;
    }
    if (list.length > MAX_PRODUCT_ITEMS) {
      logger.warn(
        { received: list.length },
        "Webhook Admintotal: lote de productos demasiado grande, rechazado",
      );
      res.status(413).json({
        error: `Demasiados productos (máximo ${MAX_PRODUCT_ITEMS})`,
      });
      return;
    }

    let upserted = 0;

    for (const raw of list) {
      const mapped = mapProduct(raw);
      if (!mapped) continue;
      const { product, stockQty } = mapped;

      // Stock lives on the product row. Write it whenever the ERP reported it
      // via the proper channel — including a legitimate 0 (the mapper returns 0
      // when the warehouse breakdown is present but empty). Only when the payload
      // carried NO stock signal at all do we leave any existing value untouched.
      const stockSet =
        stockQty !== undefined
          ? { erpStockQty: stockQty, stockUpdatedAt: new Date() }
          : {};

      // Product upsert + its brand registration are a single logical write, so
      // run them in a transaction: either both land or neither does (no product
      // without its brand recorded).
      await db.transaction(async (tx) => {
        await tx
          .insert(productsTable)
          .values({ ...product, ...stockSet })
          .onConflictDoUpdate({
            target: productsTable.id,
            set: {
              sku: product.sku,
              name: product.name,
              brand: product.brand,
              categoryId: product.categoryId,
              // Don't let a creation payload that omits a field erase curated
              // master data — COALESCE keeps the stored value when none arrived.
              subcategoryId: sql`coalesce(excluded.subcategory_id, ${productsTable.subcategoryId})`,
              subLinea: sql`coalesce(excluded.sub_linea, ${productsTable.subLinea})`,
              // NEVER lower a valid price to 0: only adopt the mapped price/source
              // when it's usable; otherwise keep what's stored.
              price: sql`CASE WHEN excluded.price > 0 THEN excluded.price ELSE ${productsTable.price} END`,
              priceSource: sql`CASE WHEN excluded.price > 0 THEN excluded.price_source ELSE ${productsTable.priceSource} END`,
              status: sql`CASE WHEN excluded.price > 0 THEN 'activo' WHEN ${productsTable.price} > 0 THEN 'activo' ELSE 'sin_precio' END`,
              costo: sql`coalesce(excluded.costo, ${productsTable.costo})`,
              originalPrice: product.originalPrice,
              descripcionEcommerce: sql`coalesce(excluded.descripcion_ecommerce, ${productsTable.descripcionEcommerce})`,
              descripcionAdicional: sql`coalesce(excluded.descripcion_adicional, ${productsTable.descripcionAdicional})`,
              codigoBarras: sql`coalesce(excluded.codigo_barras, ${productsTable.codigoBarras})`,
              claveSat: sql`coalesce(excluded.clave_sat, ${productsTable.claveSat})`,
              proveedor: sql`coalesce(excluded.proveedor, ${productsTable.proveedor})`,
              skuProveedor: sql`coalesce(excluded.sku_proveedor, ${productsTable.skuProveedor})`,
              image: sql`coalesce(excluded.image, ${productsTable.image})`,
              specs: product.specs,
              ...stockSet,
            },
          });

        if (product.brand) {
          await tx
            .insert(brandsTable)
            .values({ name: product.brand })
            .onConflictDoNothing({ target: brandsTable.name });
        }
      });

      upserted += 1;
    }

    logger.info(
      { received: list.length, upserted },
      "Webhook Admintotal: productos creados/actualizados",
    );
    res.json({ ok: true, received: list.length, upserted });
  },
);

export default router;
