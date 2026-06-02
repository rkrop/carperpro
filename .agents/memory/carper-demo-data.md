---
name: Carper catalog test/placeholder data
description: How test rows enter the catalog and how they are kept out of the app.
---

The catalog is a **live mirror of the Admintotal ERP** (sync writes products/categories/brands/sucursales; `sync_state` row key `catalog` tracks progress). IDs are the ERP's own **numeric** ids — numeric ids are LEGIT, not test data. (The older "all category ids are `cat-*`" Excel-seed rule is obsolete; that only held before the ERP sync existed.)

Because rows come from the ERP, **deleting test rows from the DB does not stick** — the next sync re-inserts them.

**Rule:** filter test/placeholder rows at the API query layer, never by DELETE. `notTestProduct()` in `artifacts/api-server/src/routes/catalog.ts` excludes them from every product-serving endpoint (list, by-id, deals); `/brands` has a matching brand-name exclusion.

**Why:** test placeholders like name `ARTICULO PRUEBA` and brand `REPTIL TEST BRAND` live in the ERP itself, so only a query-layer filter keeps them out of production permanently.

**How to apply:** match narrowly — generic placeholders only (exact `articulo prueba`, `%producto de prueba%`, `%test brand%`, `%reptil test%`). Do NOT match real diagnostic tools that legitimately contain "prueba" (e.g. "PINZA PRUEBA", "FOCO DE PRUEBA", injector/coil testers).
