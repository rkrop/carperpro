---
name: Carper one-number-per-product stock model
description: Canonical stock model — stock lives on the product row, API exposes stock+stockState, NULL=unknown.
---

Stock is **one number per product, stored on the product row** (`products.erpStockQty`, integer nullable, plus `stockUpdatedAt`). The `inventory` table is **legacy and no longer written or read for stock** — sync and webhooks both write `erpStockQty` directly; the catalog readers and the checkout fallback read `erpStockQty`.

**Three states (the whole model hinges on this):**
- `erpStockQty IS NULL` → **unknown** — ERP hasn't reported a count yet. Product stays VISIBLE; no count shown.
- `erpStockQty = 0` → **confirmed out of stock** — HIDDEN from all listings by `sellableProduct()`.
- `erpStockQty > 0` → real on-hand **count**, shown to users.

**API contract** (`lib/api-spec/openapi.yaml`, regenerated into api-zod + api-client-react): every product carries `stock: integer|null` AND `stockState: "in_stock"|"out_of_stock"|"unknown"`. `serializeProduct()` in `artifacts/api-server/src/routes/catalog.ts` derives `stockState` from `erpStockQty`.

**Query layer** (catalog.ts): `sellableProduct()` now hides on `status = 'sin_precio'` (the never-price-0 rule, see excel-seed.md / pricing-fallback.md), NOT on stock — unknown AND confirmed-0 stock both stay visible/orderable. The old stock-based hide (`coalesce(erpStockQty,1)>0`), `UNKNOWN_STOCK=10` sentinel and `stockExpr()` inventory-subquery are GONE. The `sucursalId` query param is still accepted but ignored (single store).

**Per-warehouse initial stock:** `product_stock_inicial` (PK productId+almacenId; 001=Matriz, 005=Bodega; existencia+disponible) is the snapshot loaded by the master importer. `erpStockQty` on the product row = sum of disponible and is what catalog/checkout read; the inicial table is the breakdown record, not the live read path.

**Checkout fallback** (`lib/admintotal/liveStock.ts` getDbStock): reads `erpStockQty`, treating NULL as **0 on purpose** — this only runs when the live ERP is unreachable, and blocking an unconfirmable sale beats overselling. The live Stripe checkout stock gate itself is unchanged.

**Frontends:** carper `lib/format.ts` `stockStatus(stock: number|null)` adds `"consultar"` (null) alongside alto/bajo/agotado; detail page + ProductRow show the real count ("15 PZA", "15 EN EXISTENCIA"). tienda ProductCard + producto.tsx render three states ("15 disp." / "Agotado" / "Consultar"); JSON-LD `inStock = product.stock !== 0` (unknown counts as in stock for SEO).

**Why:** the `inventory` mirror was sparsely populated and the sentinel made unknown items read as a fake "10 in stock". One nullable number per product distinguishes "unknown" from a real count honestly, and 0 means genuinely hidden.

**How to apply:** real counts arrive in prod via the precios-existencias webhook (per-sku) and the full `productos` sync (`info_almacenes[].disponible` summed). Until then everything reads "unknown/Consultar" — that's expected, not a bug. Backfill prod by re-publishing (schema diff) then running a bulk sync.
