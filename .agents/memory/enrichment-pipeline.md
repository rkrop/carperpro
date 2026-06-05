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

## Grounding hooks are USER-OWNED stubs → dry-run gate is mandatory
- `validateGrounding(values, sourceText)` is currently a PASSTHROUGH and
  `normalizeCodes(oem)` a simple `toUpperCase().replace(/[^A-Z0-9]/g,"")` stub.
  The user implements the real word-boundary grounding + code normalization later.
- Because grounding is not yet enforced, the model CAN hallucinate (see GONHER).
  So: default to dry-run (writes only to `enrichment_staging`), review, and only
  enable writes (additive, empty-only, confidence>=0.8) once grounding is real.

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
