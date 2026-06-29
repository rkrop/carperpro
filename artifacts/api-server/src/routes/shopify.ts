import { Router } from "express";
import { shopifyStorefrontRequest, getShopifyStorefrontConfig } from "../lib/shopify/client";
import { productHandle } from "../lib/shopify/handle";
import {
  triggerFullCatalogSync,
  syncDeltaToShopify,
  isFullSyncRunning,
} from "../lib/shopify/catalog-sync";
import { ingestShopifyOrders } from "../lib/shopify/order-ingestion";
import { isLocalDevConnection } from "../lib/loopback";
import { logger } from "../lib/logger";

const router = Router();

// Lookup a product in Shopify by SKU handle (convention: "sku-{sku}").
// Returns variant ID + checkoutUrl if found, null if not yet synced to Shopify.
const PRODUCT_BY_HANDLE_QUERY = `#graphql
  query ProductByHandle($handle: String!) {
    productByHandle(handle: $handle) {
      id
      title
      availableForSale
      variants(first: 1) {
        nodes {
          id
          availableForSale
          price { amount currencyCode }
        }
      }
    }
  }
`;

const CART_CREATE_QUERY = `#graphql
  mutation CartCreate($variantId: ID!, $quantity: Int!) {
    cartCreate(input: { lines: [{ merchandiseId: $variantId, quantity: $quantity }] }) {
      cart { id checkoutUrl }
      userErrors { field message }
    }
  }
`;

const CART_CREATE_MULTI_QUERY = `#graphql
  mutation CartCreateMulti($lines: [CartLineInput!]!) {
    cartCreate(input: { lines: $lines }) {
      cart { id checkoutUrl }
      userErrors { field message }
    }
  }
`;

/**
 * POST /shopify/cart-checkout
 * Body: { items: Array<{ sku: string; quantity: number }> }
 * Creates a Shopify cart with multiple line items and returns { checkoutUrl }.
 * Items not yet synced to Shopify are skipped; if ALL are unavailable returns { available: false }.
 */
router.post("/shopify/cart-checkout", async (req, res, next) => {
  try {
    const raw: unknown = req.body?.items;
    if (!Array.isArray(raw) || raw.length === 0) {
      res.status(400).json({ error: "Se requiere 'items' (array no vacío)" });
      return;
    }

    type RawItem = { sku?: unknown; quantity?: unknown };
    const lines = raw as RawItem[];
    const validItems = lines
      .map((l) => ({
        sku: typeof l.sku === "string" ? l.sku.trim() : "",
        quantity: Number.isInteger(l.quantity) && (l.quantity as number) > 0 ? (l.quantity as number) : 1,
      }))
      .filter((l) => l.sku.length > 0);

    if (validItems.length === 0) {
      res.status(400).json({ error: "Ningún ítem válido" });
      return;
    }

    // Resolve variant IDs for all SKUs in parallel.
    const resolved = await Promise.all(
      validItems.map(async (item) => {
        try {
          const data = await shopifyStorefrontRequest<{
            productByHandle: {
              availableForSale: boolean;
              variants: { nodes: Array<{ id: string; availableForSale: boolean }> };
            } | null;
          }>(PRODUCT_BY_HANDLE_QUERY, { handle: productHandle(item.sku) });

          const product = data.productByHandle;
          const variant = product?.variants.nodes[0];
          if (!product || !variant) return null;
          return { merchandiseId: variant.id, quantity: item.quantity };
        } catch {
          return null;
        }
      }),
    );

    const cartLines = resolved.filter(Boolean) as Array<{ merchandiseId: string; quantity: number }>;

    if (cartLines.length === 0) {
      res.json({ available: false });
      return;
    }

    const cartData = await shopifyStorefrontRequest<{
      cartCreate: {
        cart: { id: string; checkoutUrl: string } | null;
        userErrors: Array<{ field: string; message: string }>;
      };
    }>(CART_CREATE_MULTI_QUERY, { lines: cartLines });

    const userError = cartData.cartCreate.userErrors[0];
    if (userError) {
      throw new Error(`Shopify cart error: ${userError.message}`);
    }

    const cart = cartData.cartCreate.cart;
    if (!cart?.checkoutUrl) {
      throw new Error("Shopify did not return a checkout URL");
    }

    const checkoutUrl = new URL(cart.checkoutUrl);
    checkoutUrl.searchParams.set("channel", "online_store");

    res.json({ available: true, checkoutUrl: checkoutUrl.toString() });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /shopify/checkout
 * Body: { sku: string, quantity?: number }
 * Returns { checkoutUrl: string } or { available: false } if product not yet in Shopify.
 *
 * Products are stored in Shopify with handle "sku-{sku}".
 * If the product is not yet synced, the client falls back to WhatsApp.
 */
router.post("/shopify/checkout", async (req, res, next) => {
  try {
    const sku = typeof req.body?.sku === "string" ? req.body.sku.trim() : "";
    const quantity = Number.isInteger(req.body?.quantity) && req.body.quantity > 0 ? req.body.quantity : 1;
    if (!sku) {
      res.status(400).json({ error: "Parámetro 'sku' requerido" });
      return;
    }
    const handle = productHandle(sku);

    // 1. Look up the product in Shopify by handle.
    const productData = await shopifyStorefrontRequest<{
      productByHandle: {
        id: string;
        title: string;
        availableForSale: boolean;
        variants: { nodes: Array<{ id: string; availableForSale: boolean; price: { amount: string; currencyCode: string } }> };
      } | null;
    }>(PRODUCT_BY_HANDLE_QUERY, { handle });

    const product = productData.productByHandle;
    if (!product || !product.variants.nodes.length) {
      // Product not yet synced to Shopify — tienda falls back to WhatsApp.
      res.json({ available: false });
      return;
    }

    const variant = product.variants.nodes[0];
    if (!variant) {
      res.json({ available: false });
      return;
    }

    // 2. Create a Shopify cart and get the hosted checkout URL.
    const cartData = await shopifyStorefrontRequest<{
      cartCreate: {
        cart: { id: string; checkoutUrl: string } | null;
        userErrors: Array<{ field: string; message: string }>;
      };
    }>(CART_CREATE_QUERY, { variantId: variant.id, quantity });

    const userError = cartData.cartCreate.userErrors[0];
    if (userError) {
      throw new Error(`Shopify cart error: ${userError.message}`);
    }

    const cart = cartData.cartCreate.cart;
    if (!cart?.checkoutUrl) {
      throw new Error("Shopify did not return a checkout URL");
    }

    // Append channel=online_store for dev-store preview (password-gated Vibe stores).
    const checkoutUrl = new URL(cart.checkoutUrl);
    checkoutUrl.searchParams.set("channel", "online_store");

    res.json({ available: true, checkoutUrl: checkoutUrl.toString() });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /shopify/status
 * Returns the connected shop domain (public info only).
 */
router.get("/shopify/status", async (_req, res, next) => {
  try {
    const config = await getShopifyStorefrontConfig();
    res.json({ connected: true, shopDomain: config.shopDomain });
  } catch {
    res.json({ connected: false });
  }
});

// ─── Admin-only catalog sync routes ──────────────────────────────────────────
// Protected by API key header OR local dev connection (same as other admin routes).

function requireAdmin(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) {
  const apiKey = process.env["ADMIN_API_KEY"];
  const headerKey = req.headers["x-admin-api-key"];
  const isLocal = isLocalDevConnection({
    nodeEnv: process.env["NODE_ENV"],
    remoteAddress: req.socket.remoteAddress,
    hasForwardedHeaders: Boolean(
      req.headers["x-forwarded-for"] || req.headers["x-forwarded-host"],
    ),
  });
  if (isLocal || (apiKey && headerKey === apiKey)) {
    next();
    return;
  }
  res.status(401).json({ error: "Acceso no autorizado" });
}

/**
 * POST /shopify/admin/sync/full
 * Triggers a full catalog sync (Admintotal DB → Shopify) in the background.
 * Can take many minutes for 14k+ products.
 */
router.post("/shopify/admin/sync/full", requireAdmin, (_req, res) => {
  const result = triggerFullCatalogSync();
  logger.info(result, "Shopify full catalog sync solicitada por admin");
  res.json(result);
});

/**
 * POST /shopify/admin/sync/delta
 * Pushes products modified in the last N minutes (default 30) to Shopify.
 * Body: { sinceMinutes?: number }
 */
router.post("/shopify/admin/sync/delta", requireAdmin, async (req, res, next) => {
  try {
    const sinceMinutes = typeof req.body?.sinceMinutes === "number" ? req.body.sinceMinutes : 30;
    const result = await syncDeltaToShopify(sinceMinutes * 60 * 1_000);
    logger.info(result, "Shopify delta sync completado por admin");
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /shopify/admin/orders/ingest
 * Manually triggers Shopify → Admintotal order ingestion.
 * In production this also runs automatically every scheduler tick.
 */
router.post("/shopify/admin/orders/ingest", requireAdmin, async (_req, res, next) => {
  try {
    const result = await ingestShopifyOrders();
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /shopify/admin/sync/status
 * Returns the current sync status (full sync running, etc.)
 */
router.get("/shopify/admin/sync/status", requireAdmin, (_req, res) => {
  res.json({ fullSyncRunning: isFullSyncRunning() });
});

export default router;
