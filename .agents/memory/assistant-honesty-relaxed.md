---
name: Assistant honesty & relaxed search
description: How the Carper assistant stays honest when catalog search can't confirm vehicle compatibility, plus accessory ranking — and why this is assistant-scoped.
---

# Assistant honesty: the "relaxed" signal + accessory ranking

## The constraint that drives everything
The catalog has NO structured fitment (vehicles/oem arrays empty across ~13.9k
products) — "compatibility" is pure text match on name+descripcion. So search
can never *prove* a part fits a given car. The assistant must never imply it can.

## relaxed flag (shared `searchCatalog`)
- `SearchCatalogResult.relaxed` = the rows did NOT come from the literal query:
  AI-assist dropped the vehicle term (part-only candidate won) OR semantic widen
  grew the set. Literal-query matches stay `relaxed=false`.
- The assistant OVERRIDES the model's intro with an honest "opciones generales,
  confirme por OEM/año" disclaimer whenever `relaxed` is true. This is the fix for
  the "shows connectors/sensors as if vehicle-compatible" bug.
- **Why:** prompt rules alone don't stop the model from implying fit; the override
  is server-enforced, like the price/SKU grounding guard.

## deprioritizeAccessories (opt-in)
- Pushes peripheral rows (conector/arnes/sensor/interruptor/fusible/relevador/
  repuesto) below the primary part, so "bomba" surfaces real pumps first. Markers
  the shopper typed are exempt by PREFIX (so "sensores" exempts "sensor").

## Hard rule: don't degrade shared search
- `searchCatalog` is shared by `/products` (catalog.ts), `/scan` (scan.ts) and the
  assistant. The new param/field are opt-in/optional; only the assistant passes
  `deprioritizeAccessories`. Keep any future precision/ranking tweaks opt-in or
  strictly additive — never change the listing/scanner ordering implicitly.

## Anti-loop behavior
- No-match no longer re-asks "modelo y año" (the dead-end loop); it offers
  actionable alternatives (other term / OEM / category), rotated by user-turn
  count so consecutive turns never repeat verbatim. Prompt also: search once you
  have part+marca+modelo, year doesn't filter (ranges live in text), and flag
  obvious vehicle+engine incongruence with ONE question.
