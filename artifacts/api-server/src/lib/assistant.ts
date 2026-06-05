import { getOpenAI, isOpenAIConfigured } from "@workspace/integrations-openai-ai-server";
import { searchCatalog, type CatalogProduct } from "./catalogSearch";
import { decodeVin, extractVin, type DecodedVin } from "./vinDecode";

// Conversational "Asistente para encontrar la pieza" (Task #48, smarter in #62).
// A shopper describes their car (marca/modelo/año/motor) and a symptom or the
// part they need; the assistant asks for whatever is missing, then recommends
// REAL catalog products. This is a thin conversational layer on top of the SAME
// catalog search used everywhere else (`searchCatalog`, with phase-1 AI assist +
// phase-2 semantic widening enabled): the model only ever decides WHAT to search
// for — every recommended product comes from the real catalog with the usual
// stock/price rules. The model never invents parts, prices, SKUs or brands; those
// live on the product cards the client renders.
//
// "Smarter" (Task #62) means: a more capable model at higher reasoning effort
// (this is low-volume chat, not latency-critical type-ahead, so it can afford
// it), real VIN decoding via vPIC, richer autoparts domain guidance in the
// prompt, a formal/serious es-MX register, and fallbacks that PRESERVE the
// conversation instead of resetting to a generic greeting.

// More capable than the type-ahead search assist (which stays on gpt-5-nano):
// the chat needs real technical reasoning about parts/vehicles.
const MODEL = "gpt-5-mini";
// Higher reasoning effort than search — chat tolerates the latency and benefits
// from multi-step reasoning about symptoms → parts and vehicle compatibility.
const REASONING_EFFORT = "medium" as const;
const AI_TIMEOUT_MS = 30000; // a reasoning turn can take longer; no server cap exists
// Reasoning models spend completion tokens on hidden reasoning. A tight budget
// can be fully consumed by reasoning, returning EMPTY content → the old code then
// fell back to a context-free greeting (the reported "reset"). Keep it generous.
const MAX_COMPLETION_TOKENS = 2000;
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

const SYSTEM_PROMPT = `Eres el asistente técnico de Carper Autopartes, una refaccionaria mexicana. Tu función es ayudar al cliente a encontrar la refacción correcta para su vehículo.

REGISTRO Y TONO (IMPORTANTE):
- Hablas en español de México con un trato formal, serio y profesional. Diríjete al cliente de "usted".
- No uses jerga, modismos ni lenguaje coloquial, ni imites el habla de un mecánico. Sé claro, cortés y directo.
- Respuestas breves y bien redactadas.

PARA RECOMENDAR UNA PIEZA NECESITAS:
1. El vehículo: marca, modelo y año. El motor SOLO cuando es determinante para la pieza (p. ej. distribución, empaques, banda, bomba de agua, clutch). Para muchas refacciones (balatas, filtros, focos, limpiabrisas, amortiguadores) el motor no es necesario; no lo pidas si no aporta.
2. La pieza que busca, o el síntoma que presenta.

CONOCIMIENTO TÉCNICO (guía de síntoma → pieza más probable):
- Rechinido o vibración al frenar → balatas (y posiblemente discos/rotores).
- No enciende y solo se escucha un "clic" → marcha (motor de arranque) o batería.
- Marca temperatura alta o se sobrecalienta → termostato, bomba de agua o radiador.
- Humo azul por el escape → posible consumo de aceite (anillos o sellos de válvula); humo blanco → posible empaque de cabeza.
- Chillido agudo al acelerar → banda de accesorios (poly-V) o tensor.
- Fuga de aceite en la parte baja → empaque de cárter o retén.
- Vibración del volante a cierta velocidad → balanceo, rótulas o terminales.
Cuando un síntoma puede deberse a varias piezas, menciona primero la causa más común, de forma breve.

CÓMO TE COMPORTAS:
- Si falta el vehículo o la pieza/síntoma, haz UNA sola pregunta corta para obtener lo que más falte. No pidas todo de golpe.
- Si el sistema ya identificó el vehículo a partir de un VIN (verás una nota con los datos), úsalos y NO vuelvas a preguntar marca, modelo o año.
- NO prometas capacidades que no tienes. NUNCA digas que vas a "extraer el motor del VIN": el sistema decodifica el VIN automáticamente y te entrega los datos disponibles; trabaja solo con lo que recibes.
- Cuando tengas vehículo + pieza/síntoma, deduce la refacción más probable y prepara la búsqueda en el catálogo.

LÍMITES DE COMPATIBILIDAD (IMPORTANTE):
- El catálogo no siempre tiene la compatibilidad exacta por motor o año. Por eso busca primero por pieza + marca/modelo y presenta opciones.
- Sé honesto: invita al cliente a confirmar la compatibilidad con el número de parte original (OEM) o con el modelo y año exactos. No afirmes compatibilidad que no puedas verificar.

REGLAS ESTRICTAS:
- NUNCA inventes piezas, precios, números de parte (SKU) ni marcas. Los productos reales y sus precios aparecen como tarjetas que el cliente verá; tú solo orientas.
- En tu mensaje NO escribas precios, SKUs ni prometas existencias ("hay 5 en stock").
- Mantente en el tema de autopartes y de este catálogo.

FORMATO DE RESPUESTA (obligatorio):
Responde SIEMPRE en JSON con este formato exacto:
{"message": "tu mensaje para el cliente", "search_query": "palabras clave para el catálogo o cadena vacía"}

- "message": lo que le dice al cliente (la pregunta, o una introducción breve a los resultados), siempre con trato de "usted".
- "search_query": cuando ya tiene suficiente información, las palabras clave para buscar en el catálogo, combinando pieza + marca/modelo en términos usados en México (ej. "balatas tsuru", "marcha jetta", "filtro aceite sentra"). NO incluya el año ni el VIN. Si todavía está preguntando y aún no debe buscar, déjelo como cadena vacía "".`;

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
  // Generic opener for the very first turn (no prior context to preserve).
  const GENERIC_FALLBACK =
    "Con gusto le ayudo a encontrar la refacción. ¿Qué vehículo tiene (marca, modelo y año) y qué pieza necesita o qué falla presenta?";

  if (!isOpenAIConfigured())
    return { reply: GENERIC_FALLBACK, products: [] };

  // Only the user/assistant turns, most recent window, trimmed of empties.
  const history = messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && m.content.trim())
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.trim() }));

  if (history.length === 0 || history[history.length - 1].role !== "user") {
    // Nothing to respond to (no user turn yet) — prompt for the basics.
    return { reply: GENERIC_FALLBACK, products: [] };
  }

  // Decode a VIN if the shopper pasted one (scan from the most recent turn back,
  // so a VIN given earlier still applies). Fully optional and time-bounded — a
  // failed/uncovered decode just leaves `decoded` null and we ask for the car.
  let decoded: DecodedVin | null = null;
  let vinSeen = false;
  for (let i = history.length - 1; i >= 0; i--) {
    const vin = extractVin(history[i].content);
    if (vin) {
      vinSeen = true;
      decoded = await decodeVin(vin);
      break;
    }
  }

  // Context-aware fallback: never reset the conversation to a blank greeting when
  // something goes wrong (timeout, empty model output, bad JSON). Acknowledge
  // what the shopper already told us (decoded vehicle, or that they're mid-chat).
  const contextualFallback = (): string => {
    if (decoded)
      return `Identifiqué su vehículo: ${decoded.summary}. ¿Qué refacción necesita o qué falla presenta?`;
    if (vinSeen)
      return "No fue posible decodificar el VIN automáticamente. ¿Me indica la marca, el modelo y el año de su vehículo, y qué refacción necesita?";
    if (history.length > 1)
      return "Continuemos. ¿Me confirma la marca, el modelo y el año de su vehículo, y qué refacción necesita o qué falla presenta?";
    return GENERIC_FALLBACK;
  };

  // When a VIN was provided, give the model a grounding note so it uses the
  // decoded vehicle (or apologizes honestly) instead of looping on the engine.
  const contextNotes: AssistantMessage[] = [];
  if (decoded) {
    contextNotes.push({
      role: "user",
      content: `[Nota del sistema: el cliente proporcionó un VIN que ya fue decodificado. Vehículo identificado: ${decoded.summary}. Usa estos datos directamente y NO vuelvas a preguntar marca, modelo ni año. Para buscar en el catálogo combina la pieza con la marca y el modelo (no incluyas el año ni el VIN).]`,
    });
  } else if (vinSeen) {
    contextNotes.push({
      role: "user",
      content:
        "[Nota del sistema: el cliente proporcionó un VIN pero no fue posible decodificarlo. Discúlpate brevemente y pídele la marca, el modelo y el año. No afirmes que puedes extraer datos del VIN.]",
    });
  }

  let message = "";
  let searchQuery = "";
  try {
    const completion = await getOpenAI().chat.completions.create(
      {
        model: MODEL,
        max_completion_tokens: MAX_COMPLETION_TOKENS,
        reasoning_effort: REASONING_EFFORT,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...history,
          ...contextNotes,
        ],
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
    // Timeout / network / API / parse error → context-preserving fallback.
    return { reply: contextualFallback(), products: [] };
  }

  if (!message && !searchQuery)
    return { reply: contextualFallback(), products: [] };

  // No search this turn (still gathering info) — just return the question. If the
  // model slipped a price/SKU/stock specific into the prose, drop it for the safe
  // contextual prompt rather than forward an unverifiable claim.
  if (!searchQuery) {
    const safe =
      message && !hasForbiddenSpecifics(message) ? message : contextualFallback();
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
        "No encontré esa refacción en nuestro catálogo en este momento. ¿Me confirma el modelo y el año exactos, o desea que busque otra pieza?",
      products: [],
    };
  }

  // Recommendation turn: the cards carry the real price/SKU/stock. If the model's
  // intro stayed clean, keep it; if it tried to state specifics itself, replace it
  // with a safe intro that points the customer to the cards.
  const intro =
    message && !hasForbiddenSpecifics(message)
      ? message
      : "Estas son las opciones que encontré en el catálogo. Revise las tarjetas para ver precio y disponibilidad:";

  return {
    reply: intro,
    products: rows,
  };
}
