---
name: Full-text search setup
description: PostgreSQL FTS infrastructure on the products table.
---

**Infrastructure (already applied, no migration needed):**
- `unaccent` extension enabled
- `search_vector tsvector` column on `products`
- GIN index `idx_products_search`
- Trigger `products_search_vector_update()` fires on INSERT/UPDATE:
  - Weight A: sku, name
  - Weight B: brand, oem codes
  - Weight C: descripcion
  - Dictionary: 'simple' + unaccent (language-agnostic, works for Spanish)

**Query pattern (catalog.ts):**
```ts
sql`${productsTable}.search_vector @@ to_tsquery('simple', unaccent(${tsq}))`
```
Each word gets `:*` suffix for prefix/as-you-type matching. Words joined with ` & `.

**Why:** descripcion contains vehicle applications (e.g. "NISSAN TSURU 1.6 1986") and OEM codes embedded as text — FTS is the only way to make them searchable.

**Rebuild after bulk insert:** `UPDATE products SET updated_at = now()` fires the trigger on all rows.
