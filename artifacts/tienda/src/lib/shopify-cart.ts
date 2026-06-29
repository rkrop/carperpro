/**
 * Shopify cart helper for Carper Tienda.
 * Calls the api-server /api/shopify/checkout route (server-side Storefront API)
 * and redirects to Shopify-hosted checkout.
 *
 * If the product is not yet synced to Shopify, returns available=false
 * so the caller can fall back to the WhatsApp CTA.
 */

export type CheckoutResult =
  | { available: true; checkoutUrl: string }
  | { available: false };

export async function createShopifyCheckout(
  sku: string,
  quantity = 1,
): Promise<CheckoutResult> {
  const resp = await fetch("/api/shopify/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sku, quantity }),
  });
  if (!resp.ok) throw new Error(`Checkout error: ${resp.status}`);
  return resp.json() as Promise<CheckoutResult>;
}

export async function createShopifyCartCheckout(
  items: Array<{ sku: string; quantity: number }>,
): Promise<CheckoutResult> {
  const resp = await fetch("/api/shopify/cart-checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!resp.ok) throw new Error(`Cart checkout error: ${resp.status}`);
  return resp.json() as Promise<CheckoutResult>;
}
