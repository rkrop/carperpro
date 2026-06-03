---
name: Assistant grounding guard
description: How the conversational part-finder assistant stays grounded to the real catalog and never invents prices/SKUs.
---

# Assistant grounding (Asistente para encontrar la pieza)

The conversational assistant (`api-server/src/lib/assistant.ts`, route `POST /api/assistant/chat`,
carper screen `app/asistente.tsx`) is a thin layer over the SAME `searchCatalog()` used everywhere.

**Rule:** the model NEVER supplies product facts. It returns `{message, search_query}`; only
`search_query` drives `searchCatalog(assist:true, limit 6)`, and the real rows become the cards.
Prices/SKUs/stock reach the client ONLY on those grounded cards, never in assistant prose.

**Why:** task required strict grounding ("never invent parts/prices/SKUs"). A prompt rule alone is
not a guarantee — a model deviation/jailbreak could emit an invented `$850` or `SKU BR1234` in the
free-text `message`. Code review (architect) flagged this as a FAIL until enforced server-side.

**How to apply:** `hasForbiddenSpecifics()` regex-screens the model's `message` for price tokens
(`$\d`, `\d+ pesos|mxn`), stock promises (`hay/tenemos/quedan \d`, `\d piezas/en existencia`), and
SKU-like tokens (letters+digits len≥5, or bare `\d{5,}`). If it trips, the reply is replaced with a
safe canned intro (recommendation turn) or the fallback clarifying prompt (question turn). Vehicle
years/trims like "Jetta A4 2003 1.8T" pass (each token <5 chars), so legitimate prose survives.
Server is stateless: the carper client sends the whole conversation each turn.

**gpt-5-nano quirk:** often asks ONE extra clarifying question before searching even when car+symptom
are present; returns the 6 grounded products once the user confirms. Acceptable behavior.
