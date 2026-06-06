---
name: APYMSA público fichas (code→ficha reachability)
description: How far the PUBLIC (no-login) APYMSA product pages can be reached from our own código, what data is fetchable, and the hard limits. Corrects the earlier "no cross key / dead end" belief.
---

# APYMSA público — reaching a ficha from our código

**Earlier belief was wrong.** APYMSA's distributor SEARCH-by-code is login-gated
(anonymous `/Producto/Buscar?cadena=...` returns 0 even for generic terms like
"alternador"), BUT the product DETAIL pages are PUBLIC and reachable by código.

## The mechanism
Detail URL = `https://www.apymsa.com.mx/Categorias/<anything>/<CODIGO>`. The route
resolves on the **last path segment (the código)** and **ignores the slug entirely**
— a wrong/minimal slug (`/Categorias/x/x/x/x/0107902`) returns the SAME page. So you
only need the código, not the SEO slug. Fetch returns server-rendered HTML (works
with a plain GET → markdown).

## Hard limit: only NATIVE 7-digit codes map
- 7-digit numeric base: **12/12 exact match** in testing. ~1,301 of ~13,905 products.
- 6-digit native: **0/8** — all return the "BUSCAR POR SERVICIO LIGERO" fallback (not found).
- **NEVER zero-pad** a short code to 7 digits: padding produced a page for a DIFFERENT
  product (e.g. our 12536 → padded 0012536 → returned código 3168000). False hit = would
  attach the WRONG part's data. Codes with letters / our ERP codes don't map either.

## Mandatory safety guard
The page renders its own `Código: NNNNNNN`. **Accept scraped data only if that printed
código equals the código you requested.** This rejects both false-pad hits and the
not-found fallback. Non-negotiable if anyone builds an importer.

## What's actually fetchable publicly (plain GET)
- Server-rendered (in the HTML/markdown): product name, código, brand, **ficha técnica**
  (Amperaje, Voltaje, Giro, Serie, Sistema, Terminales…), product **images**
  (`https://resources.apymsa.com.mx/imagenes/FotosSpeed/<internalId>/...`), components list.
- **NOT in the initial HTML** (loaded via an AJAX call NOT discovered with markdown-only
  fetching; guesses like `/Producto/Referencias/{id}`, `/VerReferencias/{id}`,
  `/Aplicaciones/{id}` all returned empty len-52): the **"Ver referencias" OEM
  cross-codes** (e.g. CATERPILLAR 2128561, MITSUBISHI A4TU3586, LESTER 12748) — the most
  valuable data — and probably the Aplicaciones list. Cracking these needs browser-level
  network inspection or a headless render, not the web-search webFetch tool.

## Running the importer (the egress quirk)
- APYMSA's WAF returns 403 to the workspace egress IP, so `node apymsa-ficha-enrich.mjs`
  from shell/api-server CANNOT reach it. RUN IT from the agent code_execution sandbox
  (permitted egress) by `await import(...apymsa-ficha-enrich.mjs)` and calling its
  exports (resolve/buildAdditiveUpdate). Sandbox gotchas: bare `process.env` is
  undefined → use `(await import('node:process')).env.DATABASE_URL`; pg via
  `await import('/home/runner/workspace/lib/db/node_modules/pg/lib/index.js')`;
  `executeSql` returns a STRING (CSV-ish), not row objects (fine for counts, not loops).
- One full additive sweep of the 7-digit pool completed cleanly at delay ~1200ms,
  batches ~100-150, sequential only: 0 WAF blocks / 0 false-positive guards. ~19% of
  codes are notfound (not in APYMSA catalog) — expected, harmless.
- IMPORTANT: scraping writes to whichever DB DATABASE_URL points at (the DEV
  catalog). Prod is a SEPARATE DB, agent prod access is READ-ONLY, and the deployed
  app can't reach APYMSA (same WAF). So you CANNOT re-scrape against prod.

## Propagating enrichment to PRODUCTION (the only viable path)
Scrape once in dev → version the result as a committed JSON
(`api-server/src/data/apymsa-fichas.json`: `[{base, specs, image}]`, deduped by base,
non-empty fields only) → a boot loader applies it ADDITIVELY to whatever DB the
server is connected to. So a **publish** carries it to prod automatically.
- Loader: `api-server/src/lib/apymsa-ficha-backfill.ts`, wired in `src/index.ts`
  boot IIFE AFTER `autoImportIfDirty()` + search backfill. ONE `jsonb_to_recordset`
  UPDATE matched by `regexp_replace(sku,'-[A-Za-z0-9]+$','')=base`, fills specs only
  if NULL/`[]` and image only if NULL/'' → never overwrites, never touches
  price/cost/stock/status/brand/name, idempotent (0 rows on re-run).
- esbuild `bundle:true` inlines the JSON; tsc needs `resolveJsonModule` (added to
  api-server tsconfig only). To refresh the data later: re-scrape dev, regenerate the
  JSON from dev DB, republish. Guard `jsonb_array_length` behind a nested CASE on
  `jsonb_typeof='array'` (SQL doesn't guarantee AND short-circuit).

## Caveats before building
- Addressable cleanly today = ~1,301 products (7-digit). The richest field (OEM refs)
  is not yet extractable without more work.
- Scraping at scale (1,300+ requests) is a ToS gray area + rate-limit/block risk; it's
  the user's commercial decision. Keep it slow/polite if pursued.
