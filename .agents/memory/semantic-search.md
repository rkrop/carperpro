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

## Auto re-embed (no hot-path cost)
A `BEFORE UPDATE` trigger `products_embedding_reset_trigger` NULLs `embedding`
only when searchable content changes (name/brand/descripcion/specs/vehicles/oem/
category). Price/stock updates from ERP sync + webhooks do NOT re-embed. The
boot-time backfill then re-embeds the NULLed rows. The backfill's own
embedding-only UPDATE doesn't self-trigger (content unchanged).

## Perf footgun
The 768-float `embedding` column must be EXCLUDED from catalog selects
(`getTableColumns(productsTable)` minus embedding → `productColumns`), or every
listing drags the vectors over the wire. `serializeProduct` is typed
`Omit<Product,"embedding">` to enforce this.
