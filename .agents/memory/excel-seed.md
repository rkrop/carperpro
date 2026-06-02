---
name: Excel seed script
description: How the inventory Excel was seeded into Postgres; key constraints for re-runs.
---

Run: `node seed-excel.mjs` from `artifacts/api-server/` (plain ESM, no tsx).

**Dependencies:**
- pg: `../../lib/db/node_modules/pg/lib/index.js`
- xlsx: `/tmp/node_modules/xlsx/xlsx.js` (install with `npm install --prefix /tmp xlsx` if missing)
- Excel: `attached_assets/inventario_carper_1780375030669.xlsx`

**Why:** tsx/ts-node not available in this monorepo. Plain .mjs avoids compile step.

**How to apply:** If re-seeding after schema changes, run the same script — all inserts are ON CONFLICT upserts.
