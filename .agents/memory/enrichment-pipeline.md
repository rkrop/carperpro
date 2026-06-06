---
name: Enrichment pipeline (Fase A/D)
description: How the catalog enrichment extraction is built — direct OpenAI key, model/effort tuning, grounding hooks, additive-only writes.
---

# Enrichment pipeline (Fase A estructurar / Fase D búsqueda)

Goal: structure marca/OEM/aplicaciones (today trapped as free text in product names)
and index them so search by OEM code ("23100-4JA0B") and vehicle+year ("NP300 2019")
works. ADDITIVE only — never touches price or stock; only fills empty fields.

## OpenAI client: direct credited key, NOT the integration proxy
- The plan FILE text said "reuse getOpenAI proxy, no own key", but the user later
  added secret `OPENAI_REPLIT` (a real OpenAI key with credits) and told us to use
  it. The user's later instruction wins.
- Added `getOpenAIDirect()` / `isOpenAIDirectConfigured()` in
  `lib/integrations-openai-ai-server/src/client.ts` (reads `OPENAI_REPLIT`, falls
  back to `OPENAI_API_KEY`, no baseURL = api.openai.com direct). Cached lazily,
  mirrors getOpenAI. Existing consumers (assistant, description-backfill) STAY on
  the integration proxy — only the enrichment module uses the direct key.
- **Why:** the shared integration proxy hits quota (cf. Gemini 429 history); the
  credited key gives reliable throughput for a multi-thousand-row batch.

## Model + reasoning effort: gpt-5-nano at "low" (NOT "minimal")
- `reasoning_effort: "minimal"` FAILED two ways on real catalog rows: it
  UNDER-extracted (missed obvious vehicle applications + ficha técnica) AND
  OVER-reached (invented `marca: "GONHER"` not present in the text — a grounding
  violation). `"low"` extracted the real data without hallucinating, still cheap.
- A one-shot worked EXAMPLE in the system prompt is what unlocked vehicle-app
  extraction (CADILLAC DEVILLE + ELDORADO 82-89 → both, expanded to 1982/1989).
- **How to apply:** if you touch the enrichment prompt/model, re-run the smoke
  test on real rows before trusting it; don't drop back to "minimal".

## Grounding is now REAL (anti-hallucination lock) — keep dry-run gate as default
- `validateGrounding(values, sourceText)` is the user-supplied real version: keeps
  ONLY values literally anchored in the source (nombre + descripción). marca =
  word-present AND not a VEHICLE_MAKES / NON_BRAND_WORDS term; oem = alnum core ≥3
  present in source alnum stream; ficha = value alnum core present; aplicaciones =
  model present as word + any year present (2- or 4-digit). It RECOMPUTES confidence
  by the kept/proposed ratio. Reuses existing helpers (norm, alnum, clamp01,
  VEHICLE_MAKES, NON_BRAND_WORDS) + new tokenInSource/yearInSource.
- `normalizeCodes(oem)` still the shared `normalizeCode` (codes.ts) — DON'T touch.
- Even with grounding real, default to dry-run (writes only to `enrichment_staging`),
  review, then enable writes (additive, empty-only).

## Write threshold = 0.6 (gates ONLY the write path)
- `CONFIDENCE_THRESHOLD` (enrichment-runner.ts) lowered 0.8 → 0.6 at user request.
  It is checked ONLY in `applyEnrichmentWrites`; `stageProposals` records EVERY
  proposal regardless. So staging stays a full audit log; 0.6 only decides what is
  ADDITIVELY written to products / product_oem_codes / product_applications.
- **Why:** a 0.6 floor still cleared grounding (validateGrounding recomputes
  confidence by kept/proposed ratio, so anything below ~0.5 is already half-dropped),
  and the first controlled write produced only real part-maker brands (Bosch, Delco,
  VALEO, UNIPOINT, MITSUBA…), zero vehicle makes.

## Controlled writes: dev flag, re-gate after
- Real writes run via dev-only env `ENRICHMENT_WRITES_ENABLED=1` + workflow restart
  (no hot-reload!), then DELETE the flag + restart so write=1 returns 403 again.
  Treat EVERY write run this way: enable → restart → run → disable → restart. NEVER
  set this flag in production.
- After any write batch, run the safety query (brand ∈ VEHICLE_MAKES scoped by
  enriched_at >= run start) — it must be 0; written brands should be part makers
  (Bosch, Delco, VALEO, UNIPOINT, MITSUBA…), never vehicle makes.
- Note `written.products` in the report is an UPDATE count (one per filled field),
  NOT distinct products; scope "this batch" by `enriched_at >= start_ts`.

## Shapes
- `extractAttributes({codigo,nombre,descripcion})` →
  `{marca, ficha_tecnica: ProductSpec[], oem:[{brand?,code,code_norm}], aplicaciones:[{make,model,year_from?,year_to?,motor?}], confidence}`.
  Returns `{ok:false, retryable}` distinguishing transient API failure (abort run)
  from empty/invalid output (skip row).
- `ficha_tecnica` is stored as canonical `products.specs` (ProductSpec[]); the
  model's `{etiqueta:valor}` object is converted in `parseFicha`.
- `computeEnrichmentWouldWrite(before, attrs)` = what would be filled, comparing
  against currently-empty fields (brand==='SIN MARCA', specs/oem/apps counts==0).
- The old name-only pilot (`extractFromName` + `runAttributeExtractionPilot`,
  route POST /api/admin/attributes/pilot) is UNCHANGED and still uses the proxy;
  the new extractAttributes was renamed-around it, not on top of it.

## A3 runner + route (runEnrichmentBatch, POST /api/admin/enrichment/run)
- Source text per row = name + descripcion_ecommerce+adicional+descripcion (priority,
  ~4000 char cap); same text grounding will validate against. Concurrency 4.
- dry-run (default, write=false): writes ONLY enrichment_staging, one row per field
  (marca/ficha_tecnica/oem/aplicaciones), deletes prior PENDING rows for the product
  first (idempotent re-runs). before/after report. Never touches products/final tables.
- write=true is HARD-GATED behind env ENRICHMENT_WRITES_ENABLED=1; route returns 403
  (EnrichmentWritesDisabledError) until grounding is real. Write path coded but inert:
  additive empty-only + confidence>=0.8, fills products.brand/oem/vehicles/specs +
  inserts product_oem_codes/product_applications, sets enrichment_source/confidence/at.
- Idempotency: final tables have UNIQUE dedupe indexes (oem: product_id+code_norm;
  apps: product_id+make+model+coalesce(year_from,-1)+coalesce(year_to,-1)+coalesce(motor,''))
  — no nullsNotDistinct() in drizzle 0.45 so apps uses an EXPRESSION index; inserts use
  onConflictDoNothing(). These indexes MUST stay in enrichment.ts schema or push drops them.
- OPCLASS GOTCHA: the apps dedupe index MUST have every part written as a `sql`
  expression (sql`${t.productId}`, …), NOT a mix of plain column refs + sql
  expressions. When mixed, drizzle-kit push misaligns per-column operator classes
  and emits `product_id int4_ops` on a TEXT column → push fails with "operator
  class int4_ops does not accept data type text". All-sql parts make drizzle omit
  typed opclasses so Postgres picks the right default. (migrations = drizzle-kit
  push, introspect/diff; there are no generated migration files.)

## Full-catalog sweep (resumable, in-process, additive)
- The whole catalog (~13.9k) was enriched in ONE write run: applied ~8.7k,
  no_data ~4.6k, no_extract ~0.5k; 0 vehicle-makes written as brand (safety query).
- TERMINATION INVARIANT: a resumable sweep selects rows by `enriched_at IS NULL`,
  so EVERY processed row must be stamped or it loops forever. Rows that produce a
  written proposal get stamped by applyEnrichmentWrites; rows with no proposal /
  below threshold / non-retryable extract failure are stamped by
  `markEnrichmentProcessed` (provenance + review_status 'no_data'|'no_extract',
  guarded on enriched_at IS NULL, touches NO catalog field). Forgetting to stamp
  no-proposal rows was the original infinite-reselection bug.
- **Fire-and-forget survives client disconnect**: the in-process loop
  (`runFullEnrichmentSweep`, batches of 1000 until pool empty, stall-guard =
  2 consecutive batches where scanned===failed) keeps running after the HTTP
  client drops. External `nohup`/`setsid` bg scripts DON'T — they die when the
  bash tool call ends. So drive long jobs from inside the server, not the shell.
- Sweep is wrapped in `withAdvisoryLock(JOB_LOCK.enrichmentSweep)` so Autoscale
  can't double-run it across instances (in-memory `running` flag only guards one
  instance). `sweepStatus` is in-memory/per-instance — fine for a manual op.
- `sweep=1` REQUIRES `write=1` (route returns 400 otherwise): dry-run never stamps
  enriched_at, so a dry-run sweep would re-select the same rows until the batch cap.
  For a dry-run sample use `/admin/enrichment/run?limit=N` instead.

## equivalents: indexing-only (OPEN product decision)
- Added `equivalents` to the search_vector trigger (weight B, like oem) in BOTH
  ensure-search-trigger.ts AND import-maestro.mjs — so EXISTING ERP equivalents become
  searchable (real Fase D win). On boot the changed-trigger detector NULLs+rebuilds.
- BUT the runner does NOT populate products.equivalents: extraction returns a flat `oem`
  list with no grounded signal to split OEM vs cross-reference/equivalent. Left as a
  decision for the user (classify in extraction, or keep equivalents indexing-only).

## Fase D — search by OEM code + vehicle/year (catalogSearch/productSearch)
- INVARIANT: one shared normalizeCode() (codes.ts = upper + strip [^A-Z0-9]) is
  used on BOTH the write side (product_oem_codes.code_norm) and the search side
  (query). They MUST stay identical or "23100-4JA0B" won't find "231004JA0B".
- Structured signals are ADDITIVE: code/vehicle predicates are OR-ed onto the
  existing FTS condition and their order keys are PREPENDED (code-exact >
  code-prefix > application > ts_rank). When the query isn't a code/vehicle phrase
  the builders return null, and while product_oem_codes/product_applications are
  EMPTY every EXISTS is false + every CASE order key is 0 — so plain search is
  provably unchanged (results AND ordering). Verified balatas=113 unchanged.
- code signal = buildCodeMatch (>=3 normalized chars, NO digit gate — letter-only
  OEM codes must match; EXISTS is indexed so cost is fine); exact ⊂ prefix.
- vehicle signal = buildApplicationMatch: fires only with a 4-digit year (19/20xx)
  + >=1 non-year token; model ILIKE any token, year BETWEEN coalesce(year_from,
  year) AND coalesce(year_to, year) so NULL bounds are open.
- D1 index: GIN on products.search_vector (products_search_vector_idx) added to
  the Drizzle schema + pushed; code_norm + (make,model) indexes already existed.
