---
name: Full-text search & the search_vector column
description: How product search works (relevance-ranked tsvector) and why search_vector must stay in the Drizzle schema
---

# Catalog search

- Product search in `artifacts/api-server/src/routes/catalog.ts` is **relevance-ranked full-text**: it queries `search_vector` with `to_tsquery('simple', unaccent(...))` (per-word AND + prefix `foo:*`), orders by `ts_rank(...) desc, name asc, id asc`. The query config MUST be `simple` + `unaccent` to match how the vector was built, or it silently returns 0 hits.
  - **Weighting:** trigger builds the vector with sku/name = weight A, brand/oem = B, descripcion = C, so name/SKU matches outrank description matches automatically via `ts_rank`.
  - **Stopwords** (de, la, el, los, las, para, con, y, o, del, un, una) are dropped before building the tsquery. If nothing is left (e.g. "de la"), it falls back to the old `unaccent()+ILIKE` substring AND path so search never empties.
  - **ILIKE safety net** is kept ONLY for sku/oem (partial part-number fragments). Do **not** ILIKE-substring name/description — that reintroduces mid-word false positives. Tradeoff: punctuation-glued tokens like `P/VALVULAS`, `COMBU.VALVULA` no longer match "valvula" (the simple parser keeps them as one lexeme); accepted for precision.
- **search_vector is backfilled, not lazy anymore.** Two idempotent, batched (2000/tx) backfills touch rows where `search_vector IS NULL` so the trigger recomputes: `artifacts/api-server/src/lib/search-backfill.ts` runs on **every server boot** (so a publish indexes prod, which the agent can only read), and `seed-excel.ts` step 5 does the same. Any insert/update (sync, webhooks, raw UPDATE) fires the BEFORE trigger, so the index self-heals.

# search_vector must live in the Drizzle schema

- `search_vector` (tsvector) is declared in `lib/db/src/schema/products.ts` via a `customType` (Drizzle has no native tsvector). It is omitted from `insertProductSchema` — the app never writes it; the `products_search_trigger` / `products_search_vector_update()` trigger+function (created out-of-band) populate it.
- **Why it must be in the schema (hard-won):** the column, trigger, and GIN index were originally created by raw SQL, NOT in the Drizzle schema. `drizzle-kit push --force` (runs post-merge against dev) and the publish-time schema diff (runs against prod) only know the Drizzle schema, so they saw `search_vector` as an "extra" column and **DROPPED it** — in both dev and prod — while leaving the trigger+function behind.
- **Failure mode that caused:** the orphan trigger does `NEW.search_vector := ...` on every insert/update, so with the column gone, **every write to `products` fails** (`record "new" has no field "search_vector"`) — breaking the Admintotal price/stock webhook and any sync — and search SELECTs 500 with `column "search_vector" does not exist`.
- **How to apply:** any DB object the app depends on (columns, and ideally indexes) must be in the Drizzle source of truth, or push/publish will silently drop it. Triggers/functions/GIN index are still out-of-band — keep the column in Drizzle so the trigger always has its target.
