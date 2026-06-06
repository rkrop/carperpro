---
name: GRUPO CIOSA supplier enrichment
description: Reachability + enrichment status for supplier "GRUPO CIOSA" — identity in our catalog, Admintotal gaps, and the B2B login wall on ciosa.com that gates photos.
---

# GRUPO CIOSA — enrichment reachability

Per-supplier topic (see additive-enrichment-propagation.md for the general playbook).
Each supplier differs; Ciosa is NOT like APYMSA (no public page-per-code).

## Identity in our catalog
- Cleanly identified by `products.proveedor = 'GRUPO CIOSA'` (532 products) — NO
  code-format guessing needed (unlike APYMSA's 7-digit native code).
- Lookup handle = `sku_base` (strips `-BRAND` suffix like `-INJETECH`/`-TOTALPARTS`).
  `sku_proveedor` is UNRELIABLE (sometimes literal "GRUPO CIOSA", sometimes the code,
  sometimes null). Codes are MIXED format (`47334C`, `60002RS`, `TU25USA`, `05054`).
- `sku_base` is almost certainly == Ciosa's own código (NPC), because that's the code
  the user procures by. (Couldn't verify live — catalog is login-gated; see below.)

## Admintotal has nothing to enrich Ciosa with
- For Ciosa códigos, Admintotal v2 `productos/?codigo=` returns `imagen_url: ""`
  (EMPTY) and NO ficha-técnica fields (no medidas/peso/aplicaciones/modelo). Only
  descripcion, linea/sublinea, costo, precio. So Admintotal = no photos, no specs.
- A user-offered Admintotal Excel of "códigos + descripción" adds NOTHING: both are
  already in our catalog (código=sku_base, descripción=name).

## ciosa.com is an AngularJS SPA with a B2B LOGIN WALL (photos gated)
- Sites: www.ciosa.com, mx.ciosa.net (same app), grupociosa.mx. Brochure pages render
  ~360 chars of shell via JS; real data via `/webservices/*`, `php/getData.php`,
  `productos/...`. AngularJS 1.5.8.
- Product search = **POST `lazy_list=1&limit=N` to `/productos/resultado/{query}`**
  (the JS posts to `window.location.href`). Token from `php/getData.php?opc=1`.
- WITHOUT a dealer session the search response is the page shell + "REGÍSTRATE" /
  "REACTIVACIÓN" modals ("iniciar sesión / contraseña / refaccionario") — ZERO product
  cards. It's a B2B distributor catalog (pedidoB2B, descuentos cedis/región/comercial).
- Product photos live on `img.ciosa.com` (product images, not the public promo/logo
  ones). Reaching them needs the gated catalog (to map código→NPC→image URL).
- **Conclusion: photos require the USER's Ciosa dealer login.** Not publicly reachable.
  The slug in `/productos/resultado/{x}` is the search query; results are auth-gated.

## Enrichment (specs/OEM/aplicaciones) ALREADY ran on all 532
- All 532 have `enriched_at` set (covered by the full-catalog sweep, see
  enrichment-pipeline.md). Result: 243 have OEM codes, 137 have vehicle applications,
  but 371 still have EMPTY `specs` and 296 are still `brand='SIN MARCA'`.
- The 371 empty-specs are genuine sparse-name cases: grounding (anti-hallucination)
  declined because the names carry no anchorable ficha attribute. Re-running the SAME
  additive+grounded pipeline will NOT fill them. Improving coverage would require
  loosening grounding, which is a CATALOG-WIDE risk (affects all suppliers) — do not do
  it unilaterally for one supplier.
