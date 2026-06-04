---
name: Master inventory importer
description: How import-maestro.mjs loads the INVENTARIO MAESTRO Excel (FASE 1) and the never-price-0 / exact-mirror rules.
---

# Master importer (`artifacts/api-server/import-maestro.mjs`)

FASE 1 of the inventory lifecycle: a **manual** master Excel load that is the
source of truth for the catalog. FASE 2 = live AdminTotal webhooks. Auto API sync
stays disabled. Run from `artifacts/api-server`:
`node import-maestro.mjs` (`--dry-run` is truly read-only; `--force` bypasses guards).

- **Source:** `attached_assets/INVENTARIO_MAESTRO_*.xlsx`, sheet `MAESTRO`, ONE row
  per product (~13,905). Replace the file to re-import. `pg` from `lib/db/node_modules`,
  `xlsx` via `require("xlsx")`. The OLD `seed-excel.mjs` + `productos-001/005.xlsx`
  two-file warehouse flow is DELETED — do not reintroduce.
- **Identity = Código** → `products.id` AND `sku` (so FASE 1 import and FASE 2
  webhooks converge on the same row). Upsert ON CONFLICT(id).
- **Stock:** `erp_stock_qty = Disp. Matriz + Disp. Bodega`. Per-warehouse breakdown
  saved to `product_stock_inicial` (2 rows/product: almacén `001`=Matriz, `005`=Bodega;
  existencia + disponible). 13905×2 = 27810 rows.
- **Never-price-0:** `resolvePrice()` (mirror of `src/lib/admintotal/sku.ts`):
  Precio Venta>0 → use it, `price_source` = the Excel "Fuente Precio" column (e.g.
  "Bodega"/"Matriz"/"Estimado (costo+30%)" — the master pre-computes its own
  estimates); else costo>0 → costo*1.30 source "Estimado"; else `status='sin_precio'`.
  In the current master EVERY row has a price, so 0 fall to estimate/sin_precio.
- **Categories/sublíneas:** Línea matched by normalized name → existing id, else
  `cat-<slug>`. SubLínea has NO id in the Excel, so a stable `sub-<slugLinea>-<slugSub>`
  is generated; products reference it; `/subcategories` counts live by join.
- **Exact mirror:** DELETES products not in the master (guards: MIN_PRODUCTS 5000,
  MAX_DELETE_PCT 0.7), cleans orphan `product_stock_inicial`/`inventory`, drops
  non-`matriz` sucursales and product-less subcategories. Recomputes category +
  subcategory counts (excluding sin_precio). Recreates the search_vector trigger
  (KEEP body in sync with `ensure-search-trigger.ts`).
- **Auto-import on boot (prod cleanup):** `src/lib/auto-catalog-import.ts`
  `autoImportIfDirty()` runs at server start; if catalog is dirty (total > 15,000
  OR > 5% price=0) it spawns `import-maestro.mjs --force` as a child process.
  `--force` is MANDATORY here: replacing a full ERP catalog (e.g. prod had 32,162
  old rows) with the ~13,905-row master deletes > 90%, which trips MAX_DELETE_PCT
  (70%) and aborts without it. Idempotent: once clean it no-ops. Needs
  `import-maestro.mjs` + the Excel present in the deployment bundle.
- **Preserves enrichment** the master lacks: `descripcion` (AI), `oem`, `vehicles`,
  `original_price`, `specs`, and `image`/proveedor fields via COALESCE; real `brand`
  is only overwritten when the master brand ≠ 'SIN MARCA'.

# IVA note
Prices are stored as given by the master (the "Precio Venta" base). Read-boundary
IVA handling lives in `effectivePrice()`/pricing — see pricing-fallback.md.
