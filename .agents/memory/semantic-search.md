---
name: Semantic search (pgvector embeddings)
description: How Carper catalog semantic search is wired, the Gemini embedding model gotchas, and the free-tier rate limit that shapes the backfill.
---

# Semantic search (embeddings)

Hybrid search on `GET /api/products`: text (FTS + the NL AI-assist path) runs
first; semantic only kicks in for opted-in, thin, non-empty queries when a key is
present, and re-runs a combined `(textCondition OR semantically-close)` query.
**Why:** the result must be a strict SUPERSET of the text result (text hits
ordered first) and is adopted only if it doesn't shrink the total, so semantic
can only ADD matches, never degrade text search. Everything is gated on the
key being configured → no key = plain text search untouched.

## Embedding model gotchas
- **No managed provider does embeddings.** Replit managed OpenAI AND managed
  Gemini both list embeddings as unsupported; `external_apis` has none. Must call
  Google directly with user `GEMINI_API_KEY` (or `GOOGLE_API_KEY`).
- **`text-embedding-004` is GONE** on the Gemini Developer API (404 "not found for
  v1beta / not supported for embedContent"). Use `gemini-embedding-001`.
- That model's native dim is 3072; we store `vector(768)`, so you MUST pass
  `config.outputDimensionality: 768`. At non-native dims output is NOT unit-
  normalized — fine because we use cosine distance (`<=>` / `vector_cosine_ops`),
  which is scale-invariant.
- `embedContent` accepts an array `contents` for batch; response is
  `resp.embeddings[i].values`.

## Free-tier rate limit shapes the backfill
**Why:** free tier = 100 embed requests/minute, and EACH text in a batch counts
as one request (a batch of 100 instantly hits the cap). There is also likely a
daily cap; if the backfill stops mid-way with RESOURCE_EXHAUSTED it resumes on
the next boot.
**How to apply:** batch size is kept <100 (95) so one call never self-exceeds;
`withRetry` parses the 429 `retryDelay` (~59s) and waits it out instead of giving
up, so the backfill self-paces at ~100/min. Full ~4k catalog takes ~40+ min in
the background. A paid key removes the wait.

## Auto re-embed (no hot-path cost) — boot is NOT enough
A `BEFORE UPDATE` trigger NULLs `embedding` only when searchable content changes
(name/brand/descripcion/specs/vehicles/oem/category); price/stock churn from ERP
sync + webhooks does NOT re-embed. The backfill's own embedding-only UPDATE
doesn't self-trigger (content unchanged).
**Why:** re-embedding ONLY at server boot is a correctness gap — products
created/content-changed by the recurring sync or webhooks would stay unembedded
until the next restart. The fix: the Admintotal scheduler tick calls
`backfillEmbeddings()` after each inbound sync, so NULLed/new rows are picked up
within one cycle. `backfillEmbeddings()` therefore has a module-level `running`
guard so the long (~40 min) boot pass and the periodic tick can never run
concurrently and double-spend the per-minute quota.

## Perf footgun
The 768-float `embedding` column must be EXCLUDED from catalog selects
(`getTableColumns(productsTable)` minus embedding → `productColumns`), or every
listing drags the vectors over the wire. `serializeProduct` is typed
`Omit<Product,"embedding">` to enforce this.

## Publish blocker — pgvector must pre-exist in PROD
The `embedding vector(768)` column makes the publish-time DB migration FAIL with
"Failed to validate database migrations" whenever production lacks the `vector`
extension. **Why:** dev enables `vector`+`unaccent` via `ensure-extensions.mjs`
(runs before `drizzle-kit push`), but the PUBLISH flow does NOT run that script
and cannot `CREATE EXTENSION` itself — and `executeSql({environment:"production"})`
is read-only, so the agent cannot enable it either. Replit prod DB is Neon-backed
(supports pgvector) but the prod data pane only edits DATA, not DDL.
**How to apply:** if a Drizzle column uses an extension-backed type (pgvector
`vector`, etc.), that extension must already be enabled in the PROD database
before republishing. The supported path is Replit Support enabling it once; then
republish (the migration adds the column cleanly). The only agent-side alternative
is dropping the extension-typed column from the schema (loses the feature). Carper
chose to keep semantic search; pgvector was enabled in prod by the user running
`CREATE EXTENSION vector;` over the prod connection string (Database → Production →
Settings → Environment variables → DATABASE_URL) in an external client.

## Publish blocker #2 — HNSW index opclass is dropped by the diff
After pgvector was enabled, the next publish failed on
`CREATE INDEX products_embedding_hnsw ON products USING hnsw ("embedding")` with
"data type vector has no default operator class for access method hnsw". **Why:**
the HNSW index is created out-of-band at runtime (`ensure-embedding-setup.ts`,
WITH `vector_cosine_ops`), NOT in the Drizzle schema. The publish diff is
introspection-based (dev DB vs prod DB) — proof: it emits the runtime index NAME
`products_embedding_hnsw`, not a drizzle-generated name — and the introspection
DROPS the `vector_cosine_ops` opclass, so the regenerated CREATE INDEX is invalid.
The migration is TRANSACTIONAL, so the failed index rolls back the ADD COLUMN too
(prod ends up with neither column). Declaring the index in the Drizzle schema does
NOT fix it (introspection reads the DB, not the schema file).
**How to apply:** pre-create the column AND index in PROD so dev/prod match and the
diff stops emitting the broken statement — run over the prod connection:
`ALTER TABLE products ADD COLUMN IF NOT EXISTS embedding vector(768);` then
`CREATE INDEX IF NOT EXISTS products_embedding_hnsw ON products USING hnsw (embedding vector_cosine_ops);`
Then republish (only the plain `descripcion_generada` text column remains in the
diff). Fully-automated alternative = drop the HNSW index from dev + runtime so it's
never in the diff (semantic search falls back to a sequential scan).
