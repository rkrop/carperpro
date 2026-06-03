---
name: Excel seed script
description: How seed-excel.mjs mirrors the DB to the Admintotal Excel exports, and the IVA read-boundary convention.
---

# Excel seed (`artifacts/api-server/seed-excel.mjs`)

Run from `artifacts/api-server` with `node seed-excel.mjs`. It makes the
`products` table an **exact mirror** of the current Admintotal catalog as given
by the warehouse Excel exports in `attached_assets/`.

- **Source files:** stable names `productos-001.xlsx` (Bodega) + `productos-005.xlsx`
  (Matriz). These two together = ALL current Admintotal products. Replace the
  contents of both files (keep the names) to re-mirror. The old single backup
  `inventario_carper_*.xlsx` was deleted — do not reintroduce it.
- **Column keys (exact):** `Código`(sku), `Descripción`(name), `Línea`(category),
  `Precio Venta MXN`(base price, sin IVA), `Precio Neto MXN`(con IVA),
  `Costo Promedio`, `Disponible`(stock), `Proveedor`, `Código Origen`(sku_proveedor).
- **Aggregation:** a `Código` can appear in BOTH files (same product, 2 warehouses).
  stock = SUM(Disponible) across files; price/costo = MAX (one warehouse often
  exports 0). Base price falls back to `Precio Neto / 1.16` when venta is 0.
- **Preserves enrichment:** matches existing rows by SKU to keep the Admintotal
  numeric `id` + brand/image/descripcion/oem/vehicles/original_price/category.
  ON CONFLICT updates ONLY Excel fields (sku,name,price,costo,proveedor,
  sku_proveedor coalesce, erp_stock_qty). New products get brand `SIN MARCA`.
- **Exact mirror = it DELETES** every product whose id is not in the Excel (uses a
  TEMP `keep_ids` table — NOTE: no transaction wraps the script, so the temp table
  must NOT use `ON COMMIT DROP` or it vanishes before the inserts).
- Categories matched by normalized `Línea` name → existing numeric ERP id; missing
  ones created as slug categories. Single `matriz` sucursal; `inventory` table dead.

# IVA convention (the key rule)

Prices are stored EVERYWHERE as the **base price (sin IVA)** — seed, ERP sync,
mapper, and the price/stock webhook all write base. The 16% IVA is added at the
**single read boundary** `effectivePrice()` in `src/lib/pricing.ts` via
`withIva()` (IVA_RATE=0.16). catalog/orders/stripe all read through
`effectivePrice`, so the customer sees Precio Neto. `serializeProduct` also wraps
`originalPrice` in `withIva()`. **Why:** keeps ingestion paths zero-risk (no
double-IVA) while showing IVA-inclusive prices. Do NOT add IVA in ingestion.
