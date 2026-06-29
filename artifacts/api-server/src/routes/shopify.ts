import { Router } from "express";
import { shopifyStorefrontRequest, getShopifyStorefrontConfig } from "../lib/shopify/client";

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
    const handle = `sku-${sku.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;

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

export default router;
