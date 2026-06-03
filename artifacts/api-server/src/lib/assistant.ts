import { getOpenAI, isOpenAIConfigured } from "@workspace/integrations-openai-ai-server";
import { searchCatalog, type CatalogProduct } from "./catalogSearch";

// Conversational "Asistente para encontrar la pieza" (Task #48). A shopper
// describes their car (marca/modelo/año/motor) and a symptom or the part they
// need; the assistant asks for whatever is missing, then recommends REAL catalog
// products. This is a thin conversational layer on top of the SAME catalog
// search used everywhere else (`searchCatalog`, with phase-1 AI assist + phase-2
// semantic widening enabled): the model only ever decides WHAT to search for —
// every recommended product comes from the real catalog with the usual
// stock/price rules. The model never invents parts, prices, SKUs or brands; those
// live on the product cards the client renders.

const MODEL = "gpt-5-nano"; // same cheap/fast model as the search assist
const AI_TIMEOUT_MS = 12000; // chat tolerates more latency than type-ahead search
// How many recommendations to surface per turn. Small so the reply stays focused
// and the client can render them as a tidy set of cards.
const MAX_RESULTS = 6;
// Cap the conversation history sent to the model so token cost stays bounded on
// long chats. The most recent turns carry the active intent.
const MAX_HISTORY = 12;

export type AssistantRole = "user" | "assistant";

export interface AssistantMessage {
  role: AssistantRole;
  content: string;
}

export interface AssistantResult {
  /** Conversational reply in es-MX (a question or a short intro to the cards). */
  reply: string;
  /** Real catalog rows to render as cards. Empty when still gathering info. */
  products: CatalogProduct[];
}

const SYSTEM_PROMPT = `Eres el asistente de Carper Autopartes, una refaccionaria mexicana. Ayudas al cliente a encontrar la refacción correcta para su auto.

Hablas en español de México, con un tono breve, amable y claro. Tuteas al cliente.

Para recomendar una pieza necesitas saber:
1. El vehículo: marca, modelo y año (el motor solo si es relevante, p. ej. 1.6 vs 2.0).
2. El síntoma o la pieza que busca (p. ej. "rechina al frenar" -> balatas; "no arranca" -> marcha o batería).

Cómo te comportas:
- Si te falta el vehículo o la pieza/síntoma, haz UNA sola pregunta corta para conseguir lo que más falte. No pidas todo de golpe.
- Si ya tienes vehículo + pieza/síntoma, deduce la refacción más probable y prepara una búsqueda en el catálogo.
- Cuando un síntoma puede deberse a varias piezas, elige la más común primero y menciónalo brevemente.

Reglas estrictas (MUY IMPORTANTE):
- NUNCA inventes piezas, precios, números de parte (SKU) ni marcas. Los productos reales y sus precios aparecen como tarjetas que el cliente verá; tú solo das la guía.
- En tu mensaje NO escribas precios ni SKUs. No prometas existencias ("hay 5 en stock").
- No inventes datos de compatibilidad. Si no estás seguro, sugiere confirmar el modelo/año.
- Mantente en el tema de autopartes y este catálogo.

Responde SIEMPRE en JSON con este formato exacto:
{"message": "tu mensaje para el cliente", "search_query": "palabras clave para el catálogo o cadena vacía"}

- "message": lo que le dices al cliente (la pregunta, o una intro corta a los resultados).
- "search_query": cuando ya tienes suficiente info, pon aquí las palabras clave para buscar en el catálogo, combinando pieza + vehículo en términos comunes de México (ej. "balatas tsuru", "marcha jetta", "filtro aceite sentra"). Si todavía estás preguntando y aún no debes buscar, déjalo como cadena vacía "".`;

// Server-side grounding guard. Prompt rules alone don't *guarantee* the model
// won't slip an invented price, SKU or stock promise into its prose, so we
// detect those specifics in the model's free text and refuse to forward them.
// Real prices/SKUs/stock only ever reach the client on the grounded product
// cards — never in the assistant's message.
const FORBIDDEN_PATTERNS: RegExp[] = [
  /\$\s?\d/, // "$1,200", "$ 350"
  /\d[\d.,]*\s?(pesos|mxn|m\.n\.|mn)\b/i, // "350 pesos", "1200 mxn"
  /\b\d+\s*(piezas?|en stock|en existencia|disponibles?|existencias?)/i, // stock promises
  /\b(?:hay|tenemos|quedan)\s+\d+/i, // "hay 5", "tenemos 3"
  /\b(?=[a-z0-9-]*\d)(?=[a-z0-9-]*[a-z])[a-z0-9-]{5,}\b/i, // SKU-like (letters+digits)
  /\b\d{5,}\b/, // long bare number sequences (part numbers)
];

function hasForbiddenSpecifics(text: string): boolean {
  return FORBIDDEN_PATTERNS.some((re) => re.test(text));
}

/**
 * Run one turn of the assistant conversation. Takes the full message history
 * (client-held) and returns the assistant's reply plus any grounded product
 * recommendations. The model decides whether it has enough info to search; when
 * it does, we run the real catalog search and attach those rows. When the model
 * proposes a search but the catalog has no match, we replace the reply with an
 * honest no-match message rather than letting the model imply results exist.
 *
 * Degrades gracefully: if the OpenAI integration isn't configured or the model
 * call fails, returns a friendly fallback asking for the car + part so the
 * feature never hard-errors on the client.
 */
export async function runAssistant(
  messages: AssistantMessage[],
): Promise<AssistantResult> {
  const fallback: AssistantResult = {
    reply:
      "Con gusto te ayudo a encontrar la pieza. ¿Qué auto tienes (marca, modelo y año) y qué refacción necesitas o qué falla notas?",
    products: [],
  };

  if (!isOpenAIConfigured()) return fallback;

  // Only the user/assistant turns, most recent window, trimmed of empties.
  const history = messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && m.content.trim())
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.trim() }));

  if (history.length === 0 || history[history.length - 1].role !== "user") {
    // Nothing to respond to (no user turn yet) — prompt for the basics.
    return fallback;
  }

  let message = "";
  let searchQuery = "";
  try {
    const completion = await getOpenAI().chat.completions.create(
      {
        model: MODEL,
        max_completion_tokens: 500,
        reasoning_effort: "minimal",
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
      },
      { signal: AbortSignal.timeout(AI_TIMEOUT_MS) },
    );
    const content = completion.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content) as {
        message?: unknown;
        search_query?: unknown;
      };
      if (typeof parsed.message === "string") message = parsed.message.trim();
      if (typeof parsed.search_query === "string")
        searchQuery = parsed.search_query.trim();
    }
  } catch {
    // Timeout / network / API / parse error → graceful fallback.
    return fallback;
  }

  if (!message && !searchQuery) return fallback;

  // No search this turn (still gathering info) — just return the question. If the
  // model slipped a price/SKU/stock specific into the prose, drop it for the safe
  // clarifying prompt rather than forward an unverifiable claim.
  if (!searchQuery) {
    const safe = message && !hasForbiddenSpecifics(message) ? message : fallback.reply;
    return { reply: safe, products: [] };
  }

  // Ground the recommendation in the real catalog, reusing the shared pipeline
  // with AI assist + semantic widening on (same behavior as the search screen).
  const { rows } = await searchCatalog({
    q: searchQuery,
    assist: true,
    limit: MAX_RESULTS,
  });

  if (rows.length === 0) {
    // Honest no-match: never imply products exist when they don't.
    return {
      reply:
        "No encontré esa pieza en nuestro catálogo en este momento. ¿Me confirmas el modelo y año exactos, o quieres que busque otra refacción?",
      products: [],
    };
  }

  // Recommendation turn: the cards carry the real price/SKU/stock. If the model's
  // intro stayed clean, keep it; if it tried to state specifics itself, replace it
  // with a safe intro that points the customer to the cards.
  const intro =
    message && !hasForbiddenSpecifics(message)
      ? message
      : "Esto es lo que encontré en el catálogo que podría servirte. Revisa las tarjetas para ver precio y disponibilidad:";

  return {
    reply: intro,
    products: rows,
  };
}
