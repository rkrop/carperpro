---
name: Carper catalog test/placeholder data & cleanup filters
description: How junk/unsellable rows enter the catalog and how they are kept out of the app.
---

The catalog is a **live mirror of the Admintotal ERP** (sync writes products/categories/brands/sucursales; `sync_state` row key `catalog` tracks progress). IDs are the ERP's own **numeric** ids — numeric ids are LEGIT, not test data. (The older "all category ids are `cat-*`" Excel-seed rule is obsolete; that only held before the ERP sync existed.)

Because rows come from the ERP, **deleting rows from the DB does not stick** — the next sync re-inserts them.

**Rule:** filter unwanted rows at the API query layer, never by DELETE. Two helpers in `artifacts/api-server/src/routes/catalog.ts` are applied to every product-serving endpoint (list + its count, by-id, deals):
- `notTestProduct()` — excludes ERP test placeholders (name `ARTICULO PRUEBA`, `%producto de prueba%`, brand `%test brand%`/`%reptil test%`). `/brands` has a matching brand-name exclusion.
- `sellableProduct()` — hides unsellable/junk rows. Keep = `coalesce(sum(inventory.quantity), 1) > 0 AND (price>0 OR costo>0) AND (name<>'' OR descripcion<>'')`.

**Stock semantics (IMPORTANT, corrected):** `inventory` is **sparsely populated — frequently EMPTY (0 rows)** in both dev and prod against the 32k catalog. An earlier assumption that prod had full stock data was WRONG. So the stock rule is: hide a product only when it has inventory rows that **sum to 0** (confirmed off-shelf); products with **no inventory rows are "unknown" and stay VISIBLE** (`coalesce(sum, 1) > 0`). Treating "no data" as 0 would hide essentially the whole catalog. Over-buying is prevented by the **live stock check at checkout**, so showing unknown-stock items is safe. With this rule the catalog shows ~4,121 products (price/cost + name/desc filters do the real junk removal).

**Unknown stock MUST serialize as available, not 0 (root cause of "all products AGOTADO"):** `stockExpr()` in catalog.ts must `coalesce(..., UNKNOWN_STOCK)` where `UNKNOWN_STOCK = 10` (a positive sentinel > the app's "últimas piezas" threshold of 3) — NOT `coalesce(..., 0)`. The mobile app's `stockStatus(stock)` (`lib/format.ts`) maps `stock <= 0` → "agotado" and disables ordering. Since inventory is usually empty, defaulting unknown to 0 made the **entire catalog show AGOTADO**. The visibility filter (`coalesce(sum,1)>0`) and the serialized stock MUST agree on "unknown = available". Confirmed-0 products are filtered out before serialization, so the sentinel never masks a real zero. The app never displays the raw stock number (only thresholds + `stock>0` toggles), so the sentinel is invisible to users. **Why:** keeps the two coalesce defaults consistent; a future re-sync that populates real quantities still works (real sums override the sentinel).

**Why:** placeholders and junk live in the ERP itself, so only a query-layer filter keeps them out of production permanently. by-id intentionally 404s for filtered SKUs ("remove the SKU entirely").

**How to apply (test matching):** match narrowly — generic placeholders only. Do NOT match real diagnostic tools that legitimately contain "prueba" (e.g. "PINZA PRUEBA", "FOCO DE PRUEBA", injector/coil testers).
