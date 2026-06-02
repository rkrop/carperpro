---
name: Carper API routes
description: Actual URL structure of the api-server; avoids routing mistakes.
---

Routes mount at `/api/*` directly:
- GET /api/healthz
- GET /api/categories
- GET /api/brands
- GET /api/sucursales
- GET /api/products?q=&categoryId=&brand=&sucursalId=&limit=&offset=
- GET /api/products/:id
- GET /api/deals
- GET /api/sync-status
- POST /api/orders

**NOT** /api/catalog/... — the catalog router is mounted without a /catalog prefix.

**Why:** routes/index.ts does `router.use(catalogRouter)` (no sub-path), so all catalog routes are top-level under /api.

**Port:** reads PORT env var; in dev the workflow sets it, defaults to 8080 for manual curl tests.
