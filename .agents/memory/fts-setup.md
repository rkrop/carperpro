---
name: Full-text search & the search_vector column
description: How product search works and why search_vector must stay in the Drizzle schema
---

# Catalog search

- Product search in `artifacts/api-server/src/routes/catalog.ts` uses **`unaccent()` + `ILIKE`** over a concatenated haystack (name, descripcion, sku, brand, oem). Each whitespace word is AND-matched. It does **not** query `search_vector`.
  - **Why ILIKE and not tsvector:** `search_vector` is populated lazily by the `products_search_trigger` DB trigger, so it is NULL for any row not re-written since the column was (re)created. ILIKE matches every existing row regardless of backfill state.

# search_vector must live in the Drizzle schema

- `search_vector` (tsvector) is declared in `lib/db/src/schema/products.ts` via a `customType` (Drizzle has no native tsvector). It is omitted from `insertProductSchema` — the app never writes it; the `products_search_trigger` / `products_search_vector_update()` trigger+function (created out-of-band) populate it.
- **Why it must be in the schema (hard-won):** the column, trigger, and GIN index were originally created by raw SQL, NOT in the Drizzle schema. `drizzle-kit push --force` (runs post-merge against dev) and the publish-time schema diff (runs against prod) only know the Drizzle schema, so they saw `search_vector` as an "extra" column and **DROPPED it** — in both dev and prod — while leaving the trigger+function behind.
- **Failure mode that caused:** the orphan trigger does `NEW.search_vector := ...` on every insert/update, so with the column gone, **every write to `products` fails** (`record "new" has no field "search_vector"`) — breaking the Admintotal price/stock webhook and any sync — and search SELECTs 500 with `column "search_vector" does not exist`.
- **How to apply:** any DB object the app depends on (columns, and ideally indexes) must be in the Drizzle source of truth, or push/publish will silently drop it. Triggers/functions/GIN index are still out-of-band — keep the column in Drizzle so the trigger always has its target. After recreating the column, existing rows have NULL search_vector until re-written (prod is read-only to the agent; do not try to backfill it directly — rely on ILIKE search + the trigger filling rows on future writes).
