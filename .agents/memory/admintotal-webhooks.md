---
name: Admintotal inbound webhooks
description: How Admintotal push webhooks update catalog price/stock and create products.
---

Admintotal pushes near-real-time updates via POST webhooks (docs.admintotal.com → Webhooks), received by the api-server under `/api/webhooks/admintotal/*`:
- `precios-existencias` — body is an ARRAY of `{sku, precio, costo, stock}` (batched ≤50 per request, every ~4 min, NOT real-time). Matches products by **sku** (not id); updates price/costo and writes stock.
- `productos` — single product object on creation; reuses `mapProduct` to upsert.

**Auth:** shared token in `ADMINTOTAL_WEBHOOK_TOKEN`, accepted via the `Api-key` header OR HTTP Basic password (timing-safe compare). If the secret is unset the webhook **fails closed in production** (401) but is accepted with a warning in dev (NODE_ENV !== production).

**Stock model (important):** the webhook sends ONE aggregate `stock` per sku (summed across the almacenes configured in Admintotal). It is written to `products.erpStockQty` on the product row (NOT the `inventory` table) — see [stock-model.md](stock-model.md). Only write stock when the payload actually carried it (stock defined); never zero out a product just because a payload omitted stock. Until a webhook/sync provides stock, `erpStockQty` is NULL so the product reads "unknown / Consultar" (still visible), not "Agotado".

**Why sync no longer touches inventory:** an older sync DELETED inventory for products whose `productos` payload had no existencias (the normal case), wiping stock every ~15 min. Now both sync and webhooks write `erpStockQty` only when stock is present and never wipe on absent data — the webhook is the authoritative live stock source.

**How to apply:** the ERP `productos` endpoint is heavily rate-limited and slow, so the webhook is the practical path for fresh prices/stock. Don't write `erpStockQty` (or 0) when a payload omits stock.
