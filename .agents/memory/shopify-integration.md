---
name: Shopify integration
description: Shopify as additional sales channel wired into Carper Tienda website; infrastructure, routes, and product handle convention.
---

# Shopify Integration

**Store:** sunny-kite-tjjx5c.myshopify.com (Replit-provisioned dev store; user must claim via Integrations tab → Shopify → Manage)

**Connection ID:** conn_shopify-store_01KWA9EK44XZZ7X6ZKYMRJYMPT (assigned to this Repl)

## Files

- `shopify-admin-api.mjs` — root-level Admin GraphQL helper via OpenInt proxy (for catalog sync scripts, shell only)
- `artifacts/api-server/src/lib/shopify/client.ts` — Storefront API client; fetches shop_domain + storefront_access_token from connector; 60s TTL cache; auto-retry on 401/403
- `artifacts/api-server/src/routes/shopify.ts` — registered in routes/index.ts:
  - `POST /api/shopify/checkout` — body `{ sku, quantity }` → `{ checkoutUrl }` or `{ available: false }`
  - `GET /api/shopify/status` — `{ connected, shopDomain }`
- `artifacts/tienda/src/lib/shopify-cart.ts` — browser fetch helper for the checkout route
- Seed reference: `.local/skills/shopify/references/seed-products.mjs` (golden script, copy + replace PRODUCTS array)

## Product handle convention

Shopify products are stored with handle `sku-{sku.toLowerCase().replace(/[^a-z0-9]/g, "-")}`.

Example: SKU "BOBTIDA" → handle "sku-bobtida"

**Why:** Storefront API lookup by handle is O(1) and stable. The seed script uses `productByHandle` before `productCreate` for idempotency.

## Tienda checkout flow

1. User clicks "Comprar ahora" (blue button, ShoppingCart icon) on `producto.tsx`
2. Calls `POST /api/shopify/checkout` with SKU
3. If product exists in Shopify → opens `checkoutUrl` in new tab (Shopify-hosted checkout, `channel=online_store` for dev-store preview)
4. If `available: false` → shows "no disponible en línea" message + WhatsApp fallback remains visible

## Catalog sync (next step)

Admintotal products are NOT yet in Shopify. To add products:
1. Adapt `seed-products.mjs` (from skill references) with real catalog data
2. Run `node shopify-admin-api.mjs` for Admin GraphQL via proxy
3. Handle convention must match above or checkout route returns `available: false`

## Go Live

When merchant is ready: Integrations tab → Shopify → Manage → initiate transfer.
After transfer: turn OFF `channel=online_store` param in checkout URL (currently hardcoded in shopify.ts route — change to env-driven flag).

**Why keep `channel=online_store` now:** Dev stores are password-protected; without this param the buyer lands on the password page instead of checkout.
