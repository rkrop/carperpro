---
name: Attribute extraction pilot (own-names mining)
description: Why we mine our OWN product names for marca/OEM/vehicles instead of scraping suppliers, and the grounding contract that keeps it safe.
---

# Attribute extraction — the "vía segura"

We enrich empty catalog fields (brand ~90% 'SIN MARCA', oem=0, equivalents=0) by
having AI STRUCTURE attributes that are **already literally written in our own
product names** (manufacturer like BOSCH/DELCO/NIPPONDENSO/TECNOFUEL, cross codes
like `=AC270`/`C09694`, vehicle apps like `CHEVROLET AVEO 08-18`). We do NOT scrape
supplier sites.

**Why NOT scrape APYMSA/CIOSA:** both are JS SPAs. APYMSA detail pages & search
results render via JS and return the homepage shell (~112KB) to plain fetchers
(bot wall). Worse, there is **no clean cross key**: our `sku_base` is NOT the
APYMSA productoID (padding it to 7 digits hits the homepage), and APYMSA
`/Producto/Buscar?cadena=<our code>` returns 0. So scraping = fragile + matching
is unsolved + risk of attaching the WRONG part's OEM. User explicitly chose the
own-names route over scraping.

## Grounding contract (the safety guarantee)
The model only PARSES; it never adds world knowledge. Every extracted value is
validated server-side before use:
- brand: must be a substring of the normalized name; rejected if it's a vehicle
  make (CHEVROLET/FORD/…) or a generic descriptor (AUTOMOTIVE/ORIGINAL/…).
- oem/cross codes: alphanumeric core (≥3) must appear in the name's alnum stream.
- vehicle apps: make AND model must appear in the name; years validated against
  the source (2-digit form ok), mirroring the description job's ungrounded-year guard.
Design bias = **precision over recall**: better to leave a field empty than fill
it wrong (matches the app's "never invent" philosophy).

**Residual caveat:** grounding stops INVENTION but not mislabeling — a token that
is literally in the name but isn't truly a manufacturer can still slip through
(seen: INJEKTION, KEM, truncated MITSUBI). So a human spot-check before a full
write run is warranted; the denylist is the place to add new non-brand words.

## Operational facts
- Writes are ADDITIVE-only and guarded: each UPDATE applies only if the field is
  STILL empty (brand='SIN MARCA' / oem null-or-empty / vehicles empty). Price &
  stock are never touched.
- Writing brand/oem/vehicles trips `products_embedding_reset_trigger` → NULLs
  descripcion_generada (+embedding) → description backfill regenerates copy. Fine
  (semantic off = no embed cost), but a full write run regenerates many descriptions.
- Triggered via `POST /api/admin/attributes/pilot` (dry-run default; `?write=1`
  to write). Auth: `Api-key` HEADER only in prod (never query string); dev bypass.
  NOT wired into boot/scheduler yet — pilot stays manual until results approved.
- Uses the SAME OpenAI client as description-backfill (gpt-5-nano, json_object),
  NOT Gemini — avoids Gemini quota and reuses a proven path.
