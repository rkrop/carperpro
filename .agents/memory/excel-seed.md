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

## Encoding (mojibake) repair
The Excel cells contain double-encoded text (UTF-8 bytes stored as Latin-1), e.g. "Ficha tÃ©cnica". The seed script's `fixEncoding()` repairs this with a roundtrip-validated `Buffer.from(s,'latin1').toString('utf8')` — only applies when `Buffer.from(decoded,'utf8').toString('latin1') === original` and no U+FFFD, so correct strings are never corrupted. Applied to category/brand names, product name, descripcion, proveedor.

**Why roundtrip check:** blindly applying latin1→utf8 corrupts already-correct accented strings (a real "É" becomes U+FFFD). The roundtrip proves the string was genuinely double-encoded before fixing.
