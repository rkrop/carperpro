---
name: Admintotal inbound webhooks
description: How Admintotal push webhooks update catalog price/stock and create products.
---

Admintotal pushes near-real-time updates via POST webhooks (docs.admintotal.com → Webhooks), received by the api-server under `/api/webhooks/admintotal/*`:
- `precios-existencias` — body is an ARRAY (batched ≤50 per request, every ~4 min, NOT real-time). Matches products by **sku_base** = `normalizeSkuBase(incoming)` (so a bare `00234` payload updates the master `00234-WPS` row); updates price/costo and writes stock. CASE-based pricing NEVER lowers a valid price to 0 (keeps existing, or estimates costo*1.30, and sets `status`/`price_source` accordingly).
- `productos` — single product object on creation; reuses `mapProduct` to upsert by id(=codigo); guards price (never set to 0) and COALESCEs descriptive/master fields so a partial payload never erases master data.

**FASE 2 of the inventory lifecycle:** webhooks are the live layer on top of the FASE 1 master Excel import (see excel-seed.md). Both converge because identity = código = id = sku, and `sku_base`/`proveedor_sufijo` are trigger-derived from `sku`. `normalizeSkuBase()` (JS, sku.ts) must stay in sync with the SQL trigger derivation (upper + strip whitespace + split on first `-`).

**Field names are Spanish, not English (root cause of a silent no-op bug):** the original `precios-existencias` handler read only exact English keys (`sku`/`precio`/`costo`/`stock`) and returned `ok:true` while updating nothing, because Admintotal sends Spanish names (`clave`/`existencia`, etc.) — the same reason the ERP `mapper.ts` is defensive. The handler now uses the same `pick(raw, keys)` tolerant strategy: identifier from `["sku","clave","codigo","codigo_barras","clave_producto"]`, precio from `["precio","precio_publico","precio1","price"]`, costo from `["costo","precio_costo","costo_promedio"]`, stock from `["stock","existencia","existencias","cantidad","inventario","disponible"]`. Items with no recognizable id or no matching product are counted in `notFound` and listed in `notFoundSkus` in the JSON response (no more silent `continue`). A diagnostic `logger.info` dumps the RAW body + first-item keys on every call — kept ON to confirm the real key names against a live sync.

**Auth:** shared token in `ADMINTOTAL_WEBHOOK_TOKEN`, accepted via the `Api-key` header OR HTTP Basic password (timing-safe compare). If the secret is unset the webhook **fails closed in production** (401) but is accepted with a warning in dev (NODE_ENV !== production).

**Stock model (important):** the webhook sends ONE aggregate `stock` per sku (summed across the almacenes configured in Admintotal). It is written to `products.erpStockQty` on the product row (NOT the `inventory` table) — see [stock-model.md](stock-model.md). Only write stock when the payload actually carried it (stock defined); never zero out a product just because a payload omitted stock. Until a webhook/sync provides stock, `erpStockQty` is NULL so the product reads "unknown / Consultar" (still visible), not "Agotado".

**Why sync no longer touches inventory:** an older sync DELETED inventory for products whose `productos` payload had no existencias (the normal case), wiping stock every ~15 min. Now both sync and webhooks write `erpStockQty` only when stock is present and never wipe on absent data — the webhook is the authoritative live stock source.

**How to apply:** the ERP `productos` endpoint is heavily rate-limited and slow, so the webhook is the practical path for fresh prices/stock. Don't write `erpStockQty` (or 0) when a payload omits stock.
