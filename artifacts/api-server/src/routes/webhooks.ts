import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, productsTable, brandsTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { getWebhookToken } from "../lib/admintotal/config";
import { mapProduct } from "../lib/admintotal/mapper";

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

    for (const item of items) {
      const sku = asSku(item.sku);
      if (!sku) continue;

      const precio = asNumber(item.precio);
      const costo = asNumber(item.costo);
      const stock = asNumber(item.stock);

      // Stock lives on the product row (one-number-per-product). Price, cost and
      // stock all update the same row in a single statement, matched by SKU.
      const set: Partial<typeof productsTable.$inferInsert> = {};
      if (precio !== undefined) set.price = precio;
      if (costo !== undefined) set.costo = costo;
      if (stock !== undefined) {
        set.erpStockQty = Math.max(0, Math.round(stock));
        set.stockUpdatedAt = new Date();
      }

      if (Object.keys(set).length === 0) continue;

      const updated = await db
        .update(productsTable)
        .set(set)
        .where(eq(productsTable.sku, sku))
        .returning({ id: productsTable.id });

      if (updated.length === 0) {
        notFound += 1;
        continue;
      }
      if (precio !== undefined || costo !== undefined) pricesUpdated += updated.length;
      if (stock !== undefined) stockUpdated += updated.length;
    }

    logger.info(
      { received: items.length, pricesUpdated, stockUpdated, notFound },
      "Webhook Admintotal: precios/existencias procesados",
    );
    res.json({ ok: true, received: items.length, pricesUpdated, stockUpdated, notFound });
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

      // Stock lives on the product row. Only set it when this payload carried
      // existencias; otherwise leave any existing value untouched.
      const stockSet =
        stockQty !== undefined
          ? { erpStockQty: stockQty, stockUpdatedAt: new Date() }
          : {};

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
            originalPrice: product.originalPrice,
            image: product.image,
            specs: product.specs,
            ...stockSet,
          },
        });

      if (product.brand) {
        await db
          .insert(brandsTable)
          .values({ name: product.brand })
          .onConflictDoNothing({ target: brandsTable.name });
      }

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
