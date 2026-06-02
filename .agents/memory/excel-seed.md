---
name: Excel seed script
description: How the inventory Excel was seeded into Postgres; key constraints for re-runs.
---

Run: `node seed-excel.mjs` from `artifacts/api-server/` (plain ESM, no tsx).

**Dependencies:**
- pg: `../../lib/db/node_modules/pg/lib/index.js`
- xlsx: `require("xlsx")` — it is a declared dep of `@workspace/api-server`, resolved from the pnpm store. Do NOT hardcode `/tmp/node_modules` (ephemeral, wiped between sessions).
- Excel: `attached_assets/inventario_carper_1780375030669.xlsx`

**Why:** tsx/ts-node not available in this monorepo. Plain .mjs avoids compile step.

**How to apply:** If re-seeding after schema changes, run the same script — all inserts are ON CONFLICT upserts.

## Single-store invariant (Carper has ONE physical store)
The seed creates exactly one canonical sucursal `id='matriz'` (real Carper identity) and, at the end, deletes `inventory WHERE sucursal_id <> 'matriz'` then `sucursales WHERE id <> 'matriz'`. So a re-run always leaves one store with no orphaned inventory.
**Why:** the app reads stock with no branch filter and sums across whatever branches exist (`catalog.ts` stockExpr); extra branches would split the canonical stock. `inventory` has NO FK to `sucursales`, so orphans must be deleted explicitly.
**Interaction with ERP sync:** the live Admintotal sync re-adds ERP branches (almacenes) and can prune `matriz` inventory; that's accepted because the app sums all branches regardless. The dead `src/scripts/seed-excel.ts` mirrors this logic but needs tsx to run — `seed-excel.mjs` is canonical.

## Encoding (mojibake) repair
The Excel cells contain double-encoded text (UTF-8 bytes stored as Latin-1), e.g. "Ficha tÃ©cnica". The seed script's `fixEncoding()` repairs this with a roundtrip-validated `Buffer.from(s,'latin1').toString('utf8')` — only applies when `Buffer.from(decoded,'utf8').toString('latin1') === original` and no U+FFFD, so correct strings are never corrupted. Applied to category/brand names, product name, descripcion, proveedor.

**Why roundtrip check:** blindly applying latin1→utf8 corrupts already-correct accented strings (a real "É" becomes U+FFFD). The roundtrip proves the string was genuinely double-encoded before fixing.
