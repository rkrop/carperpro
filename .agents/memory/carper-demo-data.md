---
name: Carper catalog test/placeholder data & cleanup filters
description: How junk/unsellable rows enter the catalog and how they are kept out of the app.
---

The catalog is a **live mirror of the Admintotal ERP** (sync writes products/categories/brands/sucursales; `sync_state` row key `catalog` tracks progress). IDs are the ERP's own **numeric** ids — numeric ids are LEGIT, not test data. (The older "all category ids are `cat-*`" Excel-seed rule is obsolete; that only held before the ERP sync existed.)

Because rows come from the ERP, **deleting rows from the DB does not stick** — the next sync re-inserts them.

**Rule:** filter unwanted rows at the API query layer, never by DELETE. Two helpers in `artifacts/api-server/src/routes/catalog.ts` are applied to every product-serving endpoint (list + its count, by-id, deals):
- `notTestProduct()` — excludes ERP test placeholders (name `ARTICULO PRUEBA`, `%producto de prueba%`, brand `%test brand%`/`%reptil test%`). `/brands` has a matching brand-name exclusion.
- `sellableProduct()` — hides unsellable/junk rows. Keep = `coalesce(erpStockQty, 1) > 0 AND (price>0 OR costo>0) AND (name<>'' OR descripcion<>'')`.

**Stock semantics:** stock is now ONE nullable number per product on the product row (`products.erpStockQty`), NOT the `inventory` table — see [stock-model.md](stock-model.md) for the canonical model. Rule: hide only `erpStockQty = 0` (confirmed off-shelf); NULL = unknown and stays VISIBLE (`coalesce(erpStockQty, 1) > 0`). With this rule the catalog shows ~4,121 products (price/cost + name/desc filters do the real junk removal). The old `UNKNOWN_STOCK = 10` sentinel and `stockExpr()` inventory subquery are gone; the API now returns `stock` (nullable) + `stockState` and the app shows real counts.

**Why:** placeholders and junk live in the ERP itself, so only a query-layer filter keeps them out of production permanently. by-id intentionally 404s for filtered SKUs ("remove the SKU entirely").

**How to apply (test matching):** match narrowly — generic placeholders only. Do NOT match real diagnostic tools that legitimately contain "prueba" (e.g. "PINZA PRUEBA", "FOCO DE PRUEBA", injector/coil testers).
