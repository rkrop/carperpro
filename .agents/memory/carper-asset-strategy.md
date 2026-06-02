---
name: Carper uploaded-asset strategy
description: How user-uploaded brand logos / banners / category artwork are wired into the Carper app, and why.
---

# Carper asset strategy

User supplied brand logos, promo banners, and category line-art icons + photos
(in `assets/{brands/logos, brands/banners, categories, icons}`). Wiring lives in
`lib/categoryAssets.ts` and `lib/brandAssets.ts`.

## Decisions (be consistent with these)

- **Brand logos are a non-tappable credibility wall, NOT per-product badges.**
  **Why:** the seeded catalog is ~31k "SIN MARCA"; real brands are sparse
  (INJETECH ~282, BOSCH/WAI/VALEO single/double digits). Per-product brand UI or
  brand-filtered links would mostly dead-end, so logos are a showcase only.

- **Promo/category deep links go through `?q=` (full-text), or `?category=<id>`
  — never `?brand=`.** **Why:** `app/resultados.tsx` only reads `q`, `category`,
  `compat`. `brand` is local chip state (client-side filter on the ~200-item base
  list), so a `?brand=` URL does nothing. Only the two suppliers with real
  inventory get tappable banners: injetech→`?q=injetech`, totalparts→`?q=totalparts`
  (both verified to return results).

- **Custom category icons match by accent-insensitive keyword.**
  `categoryIconAsset(name)` lowercases + strips diacritics (NFD) before keyword
  matching, returns null → caller falls back to a MaterialCommunityIcons glyph.
  Only meaningful categories have art; generic buckets (e.g. "Articulos Nuevos")
  intentionally fall back.

- **Home "Categorías Populares" grid is sorted by product count desc**, so the
  icon-rich high-traffic categories surface instead of alphabetical low-value ones.

- Metro needs static literal `require()` paths — every asset is referenced
  explicitly in the two lib files; do not build require paths dynamically.

- The `images/` folder inside the uploaded zip was intentionally excluded per the
  user.
