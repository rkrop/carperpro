---
name: Admintotal inbound webhooks
description: How Admintotal push webhooks update catalog price/stock and create products.
---

Admintotal pushes near-real-time updates via POST webhooks (docs.admintotal.com → Webhooks), received by the api-server under `/api/webhooks/admintotal/*`:
- `precios-existencias` — body is an ARRAY of `{sku, precio, costo, stock}` (batched ≤50 per request, every ~4 min, NOT real-time). Matches products by **sku** (not id); updates price/costo and writes stock.
- `productos` — single product object on creation; reuses `mapProduct` to upsert.

**Auth:** shared token in `ADMINTOTAL_WEBHOOK_TOKEN`, accepted via the `Api-key` header OR HTTP Basic password (timing-safe compare). If the secret is unset the webhook still processes but logs a warning.

**Stock model (important):** the webhook sends ONE aggregate `stock` per sku (summed across the almacenes configured in Admintotal). It is written to a single sucursal (`ADMINTOTAL_WEBHOOK_SUCURSAL_ID`, default `9` = Matriz). The app sums stock across all sucursales (store id empty), so one row == the aggregate == correct total. Until a webhook/sync provides stock, inventory is empty so everything reads "Agotado".

**Why the full sync was changed:** `runInboundSync` used to DELETE all inventory for a product when the ERP `productos` payload had no existencias (which is the normal case). That wiped webhook stock every ~15 min. It now leaves existing inventory untouched when the ERP gives no stock data — the webhook is the authoritative stock source.

**How to apply:** the ERP `productos` endpoint is heavily rate-limited and slow, so the webhook is the practical path for fresh prices/stock. Don't reintroduce per-product inventory deletion in the sync unless the ERP starts returning real existencias.
