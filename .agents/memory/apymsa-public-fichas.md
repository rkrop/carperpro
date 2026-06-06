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
- IMPORTANT: this writes to whichever DB DATABASE_URL points at (the DEV catalog).
  The published site uses a SEPARATE production DB — re-run there (prod DATABASE_URL)
  to make specs/images appear live. Additive guard makes re-runs safe/idempotent.

## Caveats before building
- Addressable cleanly today = ~1,301 products (7-digit). The richest field (OEM refs)
  is not yet extractable without more work.
- Scraping at scale (1,300+ requests) is a ToS gray area + rate-limit/block risk; it's
  the user's commercial decision. Keep it slow/polite if pursued.
