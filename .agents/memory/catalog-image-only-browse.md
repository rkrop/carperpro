---
name: Catalog image-only default browse
description: Products without a photo are hidden from default catalog browsing but still fully searchable — the rule and where it lives.
---

Browsing the catalog with no typed query (`q` empty) shows ONLY products that
have an image; products without a photo are hidden. The moment a shopper types
a search query, the image restriction lifts and every match shows regardless
of image — search must never come up empty just because a real part lacks a
photo.

**Why:** business decision — a placeholder/no-photo card in a browse grid
looks broken, but a shopper searching a specific part number/name expects to
find it either way. Coverage is low (~6% of SKUs have images), so this is an
intentional, large reduction in what's visible during plain browsing.

**How to apply:**
- Single source of truth: `searchCatalog()` in `catalogSearch.ts` — when
  `hasImage` param is not explicitly set AND `q` is empty, it defaults to
  "has image". An explicit `hasImage` param (e.g. a future internal/admin
  tool) always overrides this default in either direction.
- Pure-navigation endpoints that never carry `q` (subcategory counts, `/deals`
  featured cards) apply the same "has image" filter unconditionally so counts
  match what's actually shown.
- There is intentionally NO customer-facing "con imagen/sin imagen" toggle in
  Tienda or Carper catalog UIs anymore — it was removed because it let users
  bypass the hide-by-default rule from browsing, contradicting the feature.
- `scan.ts` (visual scanner) and `assistant.ts` (chat) always pass a non-empty
  `q`, so they naturally behave like search and are unaffected.
- Product detail (`/products/:id`) is never filtered by image — direct
  navigation/deep links to a no-image product must still work.
