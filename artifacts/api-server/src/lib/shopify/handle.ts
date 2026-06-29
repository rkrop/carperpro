/**
 * Canonical Shopify product handle for a given SKU.
 *
 * Convention: "sku-{sku.toLowerCase().replace(/[^a-z0-9]/g, '-')}"
 * Example: "BOBTIDA" → "sku-bobtida"
 *          "U52351-UNIFLOW" → "sku-u52351-uniflow"
 *
 * This function is the single source of truth used by BOTH the checkout route
 * and the catalog sync — they MUST stay in sync or /api/shopify/checkout will
 * return { available: false } for products that exist in Shopify.
 */
export function productHandle(sku: string): string {
  return `sku-${sku.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
}
