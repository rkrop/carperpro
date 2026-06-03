import { getOpenAI, isOpenAIConfigured } from "@workspace/integrations-openai-ai-server";

// Natural-language search assist (Task #46). Turns a shopper's free-text phrase
// ("balatas para un tsuru 1992") into structured catalog keywords the existing
// full-text search already understands. This is a thin layer on top of the text
// engine: it only ever REWRITES the query into better keywords — the actual
// results still come from the real catalog with the usual stock/price rules.
// Every failure path falls back to the original search, so assisted search can
// never be worse than plain search.
//
// The interpretation is intentionally SPLIT into `parts` (the refacción the
// shopper wants) and `vehicle` (make/model). The catalog often does NOT colocate
// the part and the vehicle in one product's searchable text (e.g. "balata"
// matches 7 rows, "tsuru" matches 144, but "balata tsuru" matches 0). Keeping
// them separate lets the caller try the most specific combination first and then
// relax to the part alone — which is the shopper's primary intent — instead of
// returning nothing.

const MODEL = "gpt-5-nano"; // fastest/cheapest — search is high-volume + latency-sensitive
const AI_TIMEOUT_MS = 4000;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const CACHE_MAX = 500;
const MAX_TERMS = 6;

export interface QueryInterpretation {
  /** Part/refacción keywords (primary intent), e.g. ["balatas"]. */
  parts: string[];
  /** Vehicle make/model keywords (filter), e.g. ["tsuru"]. */
  vehicle: string[];
}

interface CacheEntry {
  value: QueryInterpretation;
  expires: number;
}

const cache = new Map<string, CacheEntry>();

function normalizeKey(phrase: string): string {
  return phrase.toLowerCase().normalize("NFC").replace(/\s+/g, " ").trim();
}

function setCache(key: string, value: QueryInterpretation): void {
  // Simple bounded LRU-ish eviction: drop the oldest insertion when full.
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
}

// Clean a model-provided string into individual lowercase, accent-free tokens.
function cleanTerms(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, " ").trim())
    .flatMap((t) => t.split(/\s+/))
    .filter((t) => t.length > 0)
    .slice(0, MAX_TERMS);
}

const SYSTEM_PROMPT = `Eres un asistente de búsqueda para una refaccionaria mexicana de autopartes (Carper Autopartes).
El usuario escribe en lenguaje natural lo que busca, por ejemplo "balatas para un tsuru 1992" o "necesito el filtro de aceite de una lobo".
Tu tarea es separar la frase en dos grupos de palabras clave para buscar en el catálogo.

"parts": el nombre de la refacción o pieza que busca.
"vehicle": la marca y/o modelo del vehículo (si lo menciona).

Reglas:
- Usa términos comunes en México (ej. "balatas", "birlos", "bujías", "marcha", "clutch", "amortiguador").
- Normaliza sinónimos al término más común (ej. "pastillas de freno" -> "balatas").
- NO incluyas el año, el tipo de motor (1.6, v6), ni palabras genéricas ("para", "necesito", "quiero", "de", "un", "una").
- NO inventes marcas, números de parte ni modelos que el usuario no mencionó.
- Si el usuario describe un síntoma ("no frena", "no arranca"), deduce la pieza probable y ponla en "parts".
- Usa minúsculas, sin acentos. Pocas palabras por grupo (1 a 3).
- Si un grupo no aplica, déjalo como lista vacía.

Responde ÚNICAMENTE en JSON con este formato exacto: {"parts": ["..."], "vehicle": ["..."]}`;

/**
 * Interpret a free-text phrase into structured catalog keywords. Returns:
 *  - a {parts, vehicle} interpretation on success (either list may be empty).
 *  - `null` on any failure (timeout, API/network error, bad JSON) so the caller
 *    falls back to the original query. Failures are NOT cached so a transient
 *    timeout doesn't poison future requests; successes are cached.
 */
export async function interpretQuery(phrase: string): Promise<QueryInterpretation | null> {
  const key = normalizeKey(phrase);
  if (!key) return null;

  // If the OpenAI integration isn't provisioned, skip the AI path entirely so
  // search falls back to plain text matching (and the API still boots fine).
  if (!isOpenAIConfigured()) return null;

  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;

  try {
    const completion = await getOpenAI().chat.completions.create(
      {
        model: MODEL,
        max_completion_tokens: 300,
        reasoning_effort: "minimal",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: phrase },
        ],
      },
      { signal: AbortSignal.timeout(AI_TIMEOUT_MS) },
    );

    const content = completion.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as { parts?: unknown; vehicle?: unknown };
    const value: QueryInterpretation = {
      parts: cleanTerms(parsed.parts),
      vehicle: cleanTerms(parsed.vehicle),
    };

    setCache(key, value);
    return value;
  } catch {
    // Timeout / network / API / parse error → graceful fallback to plain search.
    return null;
  }
}
