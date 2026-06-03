---
name: NL search assist (AI query rewrite)
description: How the natural-language search assist works on the catalog API, and the catalog data quirk that shaped its design.
---

# Natural-language search assist

AI layer that rewrites a shopper's free-text phrase ("balatas para un tsuru 1992")
into catalog keywords the existing unaccent+ILIKE search understands. Lives in the
API (`artifacts/api-server/src/lib/nlSearch.ts` + the `assist` branch of
`GET /products` in `routes/catalog.ts`), so both carper app and tienda web benefit.

## Key design decisions

- **Interpretation is STRUCTURED `{parts, vehicle}`, not a flat keyword list.**
  **Why:** the catalog does NOT co-locate the part and the vehicle in one product's
  searchable text. e.g. `balata` matches ~7 rows, `tsuru` ~144, but `balata tsuru`
  matches **0** (AND-of-all-terms). A flat list AND-ed together returns nothing for
  the most natural shopper phrasing.
  **How to apply:** the route tries candidates most-specific-first
  (`[parts+vehicle]` then `[parts]` alone) and adopts the FIRST candidate whose
  total beats plain. This prefers a precise match when one exists but relaxes to the
  part (the shopper's primary intent) instead of returning 0.

- **"Never worse than plain" is enforced by only adopting an AI candidate when its
  total is strictly greater than the plain total.** Plain search always runs first
  and is the default.

- **Assist is gated:** only runs when `assist=1` AND query has terms AND plain
  `total < ASSIST_MIN_RESULTS` (6). Keeps the AI off the hot path for queries that
  already work.

- **Graceful fallback everywhere:** `interpretQuery` returns `null` on timeout
  (4s `AbortSignal`), API error, or bad JSON → plain result is kept untouched.
  Successful interpretations cached (in-memory, 6h TTL, max 500); failures are NOT
  cached so a transient timeout doesn't poison future requests.

## Integration gotcha (cost a code-review FAIL)

The OpenAI integration client (`lib/integrations-openai-ai-server`) originally
**threw at module import time** when `AI_INTEGRATIONS_OPENAI_*` env vars were
missing. Because routes import it at boot, that would crash the whole API
(including plain search) — violating graceful fallback.
**Fix/rule:** the client must be lazy. It now exports `isOpenAIConfigured()` +
`getOpenAI()` (and a lazy Proxy `openai`); importing is side-effect free. Any
optional-AI consumer must guard with `isOpenAIConfigured()` and bail to the
non-AI path when false.

## Model note

Uses `gpt-5-nano` via the Replit-managed OpenAI integration (no keys needed),
`reasoning_effort: "minimal"`, `response_format: json_object`. Cold call ~1.5s.
OpenAI integration does NOT support embeddings — use Gemini for semantic search.
