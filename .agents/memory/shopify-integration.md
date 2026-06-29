---
name: Shopify integration
description: Architectural decisions and operational constraints for the Shopify sales channel layered on top of Carper's Admintotal ERP.
---

# Shopify integration

## Product handle convention (CRITICAL — must stay in sync)

All Shopify code uses `productHandle(sku)` from `lib/shopify/handle.ts`:
```
"sku-" + sku.toLowerCase().replace(/[^a-z0-9]/g, "-")
```
If this ever diverges between sync and checkout routes, checkout returns `{ available: false }` for products that DO exist in Shopify.

**Why:** Handle is the lookup key for Storefront API (`productByHandle`); Admin and Storefront must agree.

## Inventory update requires InventoryItem GID, NOT Variant GID

`inventorySetOnHandQuantities` expects `inventoryItemId = variant.inventoryItem.id`, not `variant.id`.
Query must fetch `inventoryItem { id }` alongside the variant.

**Why:** Shopify separates Product/Variant from Inventory concerns — different GID types. Passing variant GID to the inventory mutation silently returns `userErrors` and stock never syncs.

## Auth header for connector connection lookup

`fetch(connectionUrl, { headers: { "X-Replit-Token": token } })` — hyphenated, NOT underscore (`X_REPLIT_TOKEN`). The underscore form is silently ignored and the request returns 401/empty, breaking all credential lookups.

## v1 connector scopes (Replit-managed Shopify)

Available: `write_products`, `write_inventory`, `read_locations`, `read_publications`, `write_publications`
NOT available: `read_orders` (order ingestion via polling fails with PERMISSION_DENIED)

**How to apply:** Order ingestion in `lib/shopify/order-ingestion.ts` catches the PERMISSION_DENIED error and logs a guidance message once, never crashing. Full order ingestion requires merchant to add `read_orders` via Integrations → Shopify → Manage.

## Sync architecture

- **Delta sync (scheduler, every ~15 min):** `syncDeltaToShopify(30min)` picks up products where `updated_at > now - 30min`. Advisory lock prevents double-run across Autoscale replicas.
- **Immediate push (Admintotal webhook):** After price/stock webhook updates DB, fires `syncDeltaToShopify(2min)` fire-and-forget. Skips silently if another sync is running.
- **Full sync (admin-triggered only):** `POST /api/shopify/admin/sync/full` — runs in background, takes minutes for 14k+ products.
- **Never-price-0:** Products with `effectivePrice = 0` are skipped entirely (same rule as the rest of the catalog).

## dev-store checkout URL

Append `?channel=online_store` to checkout URL from Storefront cart API. Dev stores are password-gated; without this param the buyer lands on the password page, not checkout.

**Remove this parameter** when the merchant claims the store and goes live (Integrations → Shopify → Manage → initiate transfer).

## productCreate vs productUpdate mutation shape

On **create**, `productCreate` returns `variants.edges[0].node.inventoryItem.id` which is needed immediately for inventory init. On **update**, you must pass `variant.id` in the `variants` input to target the right variant; passing no id creates a second variant.
