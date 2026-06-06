---
name: GRUPO CIOSA catalog import (full 1,032)
description: How the full GRUPO CIOSA supplier catalog (incl. no-stock "para consulta" items) was imported additively+durably via versioned JSON + boot loader, and the rules that keep it safe.
---

# GRUPO CIOSA full-catalog import

Supplier Excel imported as VISIBLE catalog products (user decision: show like the rest,
not internal-only). Same durable pattern as APYMSA fichas: prod is a SEPARATE DB the
agent can't write to directly, so data is versioned in code and applied at boot.

## Pieces
- Dataset: `artifacts/api-server/src/data/ciosa-catalog.json` (built OFFLINE in sandbox
  from the supplier Excel + scraped public photos). identity: `id = código = sku`.
- Boot loader: `artifacts/api-server/src/lib/ciosa-catalog-backfill.ts`, wired in
  `index.ts` AFTER apymsa-fichas and AFTER autoImportIfDirty (so it self-heals if the
  exact-mirror master import deletes Ciosa rows).

## Non-negotiable rules (encoded in the loader)
- **never-price-0** (applied when BUILDING the JSON): venta>0 → venta; else costo*1.30
  tagged `priceSource='Estimado'`; else `status='sin_precio'` (hidden). No `activo` row
  ever has price ≤ 0.
- New rows: `erp_stock_qty = NULL` (unknown ⇒ VISIBLE). NEVER 0 (would hide). Don't
  insert `sku_base`/`proveedor_sufijo` — they're trigger-maintained. `search_vector`
  trigger auto-fills on insert/update.
- INSERT only truly-new: guard `NOT EXISTS by id AND NOT EXISTS by sku_base scoped to
  proveedor='GRUPO CIOSA' OR NULL` (don't duplicate, don't contaminate other suppliers).
- Additive UPDATE for existing: fill ONLY empty columns (image, descripciones, clave_sat,
  sku_proveedor, brand-if-SIN-MARCA, category/subcategory/sub_linea). NEVER touch price,
  costo, status, stock, name.

## Two lessons learned the hard way
- **DEDUPE the source JSON by `id`** at build time (the Excel HAS duplicate Códigos, e.g.
  04854/07398/10398). Keep the richest row (has-image > has-ficha > has-price > real-brand).
  Otherwise intra-batch dups make INSERT/UPDATE nondeterministic. A skuBase appearing on
  two distinct ids (e.g. `36A00` & `36A00-7787`) is LEGIT (suffixed variants) — keep both.
- **Additive UPDATE must NOT use `WHERE p.id=x.id OR p.sku_base=x.skuBase`** — with shared
  bases, multiple source rows match one product and Postgres `UPDATE...FROM` picks an
  arbitrary one (fan-out). Split into Phase A (by id) + Phase B (by sku_base with a
  `DISTINCT ON (skuBase)` richest-first source). Both fill holes only.

## Result (first run)
~305 inserted + ~462 additively filled; 837 GRUPO CIOSA total; idempotent on next boot
("nada que aplicar"). Photo source per product = Excel googleapis URL else the public
ciosa img CDN by Código XML (see ciosa-public.md).
