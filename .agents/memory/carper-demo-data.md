---
name: Carper catalog test/placeholder data & cleanup filters
description: How junk/unsellable rows enter the catalog and how they are kept out of the app.
---

The catalog is a **live mirror of the Admintotal ERP** (sync writes products/categories/brands/sucursales; `sync_state` row key `catalog` tracks progress). IDs are the ERP's own **numeric** ids — numeric ids are LEGIT, not test data. (The older "all category ids are `cat-*`" Excel-seed rule is obsolete; that only held before the ERP sync existed.)

Because rows come from the ERP, **deleting rows from the DB does not stick** — the next sync re-inserts them.

**Rule:** filter unwanted rows at the API query layer, never by DELETE. Two helpers in `artifacts/api-server/src/routes/catalog.ts` are applied to every product-serving endpoint (list + its count, by-id, deals):
- `notTestProduct()` — excludes ERP test placeholders (name `ARTICULO PRUEBA`, `%producto de prueba%`, brand `%test brand%`/`%reptil test%`). `/brands` has a matching brand-name exclusion.
- `sellableProduct()` — hides unsellable/junk rows: **0 stock** (summed `inventory.quantity` across sucursales) **OR** (price=0 AND costo=0/null) **OR** (blank name AND blank descripcion). Keep = `stock>0 AND (price>0 OR costo>0) AND (name<>'' OR descripcion<>'')`.

**Why:** placeholders and junk live in the ERP itself, so only a query-layer filter keeps them out of production permanently. by-id intentionally 404s for filtered SKUs ("remove the SKU entirely").

**Stock caveat (IMPORTANT):** the `inventory` table is **EMPTY in the dev DB** (populated only in prod via Admintotal sync/webhooks). Since `sellableProduct()` requires `stock>0`, **the dev catalog returns 0 products by design** — `/products`, `/deals`, etc. are empty in dev. This is expected, NOT a bug. The live app is correct because prod has real inventory. (Store owner explicitly chose to hide out-of-stock everywhere over keeping the dev preview populated.)

**How to apply (test matching):** match narrowly — generic placeholders only. Do NOT match real diagnostic tools that legitimately contain "prueba" (e.g. "PINZA PRUEBA", "FOCO DE PRUEBA", injector/coil testers).
