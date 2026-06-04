---
name: Visual part scanner (Camino B)
description: How the photo→identify→catalog scanner works and why it grounds in shared search instead of pixel-matching
---

# Visual part scanner — "Camino B"

The `escanear` screen takes a PHOTO of a part, a multimodal model says WHAT it is, and we ground the result in the **same** catalog search used everywhere else. We chose this over pixel/barcode matching because the catalog has almost no product images (~6%) and zero `codigo_barras`, so image- or barcode-matching could never hit.

**Why vision→search (not pixel-match):** works against the whole catalog (13.9k products), not just the rows that happen to have an image.

**Contract:** `POST /api/scan/identify`, operationId `scanIdentify`. openapi component schemas must NOT be named `ScanIdentifyResponse`/`ScanIdentifyBody` — orval derives the zod schema names from the operationId, so a same-named component collides at codegen (`typecheck:libs` TS2308). Response schema is named `ScanResult` to avoid the clash; body component is `ScanIdentifyInput` (safe, zod body is `ScanIdentifyBody`).

**Grounding philosophy (mirrors assistant):** the model only picks the search `query`; every returned product is a real catalog row from `searchCatalog({assist:true})` + `serializeProduct`. The route reports `recognized` only when there are actual matches, so a label with zero hits shows as "sin coincidencias". never-price-0 / sellability are inherited from the shared pipeline (`sellableProduct` filters `status<>'sin_precio'`, `effectivePrice`) — do NOT add a scan-only price guard; that would diverge from assistant/search/deals.

**Graceful degradation:** `identifyPartFromImage` swallows ALL Gemini failures (no key, timeout, 429, unparseable) and returns `{recognized:false}` → route still 200s with empty matches. Gemini free-tier embeddings quota can be exhausted while vision (`gemini-2.5-flash`, separate quota) still works.

**Photo plumbing:** base64 photos exceed express.json default 100kb → bumped to `8mb` app-wide; route also caps per-image (`MAX_IMAGE_CHARS`). Frontend strips any `data:...;base64,` prefix (web image-picker adds it). Native = `CameraView` ref `takePictureAsync({base64,quality:0.4})`; web/gallery = `expo-image-picker` `launchImageLibraryAsync({mediaTypes:["images"],base64:true})`.
