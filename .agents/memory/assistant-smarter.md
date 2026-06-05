---
name: Assistant intelligence & VIN
description: Carper AI part-finder assistant model/reasoning config, VIN decode, context-preserving fallbacks, formal-usted tone rule.
---

# Carper assistant ("Asistente para encontrar la pieza")

## Model & reasoning budget (root-cause of the "context reset" bug)
- Chat assistant runs `gpt-5-mini` at `reasoning_effort: "medium"`, `max_completion_tokens: 2000`, 30s timeout. `nlSearch.ts` (type-ahead) stays on `gpt-5-nano`/`minimal` — high volume, latency-critical.
- **Why:** reasoning models spend completion tokens on hidden reasoning. The old 500-token budget on a reasoning model could be fully consumed by reasoning → EMPTY content → code fell back to a generic greeting that wiped the conversation. Any reasoning-model call here needs a generous completion budget or it silently returns nothing.
- **How to apply:** if you lower the model/budget, verify non-empty content on multi-step inputs (VIN paste, symptom) before shipping; empty content = the reset bug returns.

## VIN decoding
- `lib/vinDecode.ts`: `extractVin()` finds a 17-char VIN (excl I/O/Q, needs ≥1 letter+1 digit); `decodeVin()` hits the free NHTSA vPIC API (`DecodeVinValues`, no key), 6s timeout, 24h/10min cache, **returns null on any failure, never throws**. Some Mexican-market models aren't covered → null is normal, assistant then asks for make/model/year.
- `runAssistant` scans history for the latest VIN, decodes it, and injects a grounding note so the model uses the decoded vehicle and stops re-asking make/model/year. Never promise "extract engine from VIN" in prose — the system decodes automatically.

## Fallbacks must preserve context
- `contextualFallback()` replaces every generic-greeting return (decoded-vehicle / vin-seen-but-undecoded / mid-chat / first-turn variants). Timeouts, empty output, and bad JSON must NEVER reset to a blank greeting. The grounding guard (`FORBIDDEN_PATTERNS`) is NOT run on our own fallbacks, so keep those strings free of prices/SKUs/long numbers by construction.

## Tone (standing user preference)
- All customer-facing assistant copy is FORMAL es-MX, "usted", serious/professional — no slang, no "mecánico mexicano" stereotype. This applies to server replies AND client strings (`carper/app/asistente.tsx`). System-prompt text that instructs the model (tú) is fine; customer-visible output must be usted. STARTERS in the client are the customer's own voice and stay first-person.
