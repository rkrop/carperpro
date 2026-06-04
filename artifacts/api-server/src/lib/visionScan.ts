import { GoogleGenAI } from "@google/genai";
import { logger } from "./logger";

// Visual part identification ("Camino B"): instead of matching a customer photo
// pixel-by-pixel against our (sparse, ~6%) catalog images, we let a multimodal
// model LOOK at the photo and tell us WHAT the part is, then feed that into the
// SAME catalog search used everywhere else. This works against the whole catalog
// (not just products that happen to have an image) and degrades gracefully: when
// no key is configured or the model fails, we return `recognized: false` and the
// route simply shows no matches rather than hard-erroring.
//
// Reuses the user's own Gemini key (GEMINI_API_KEY / GOOGLE_API_KEY) — the same
// key the embeddings pipeline uses. The model is the multimodal flash model
// (overridable via GEMINI_VISION_MODEL).
const VISION_MODEL = process.env["GEMINI_VISION_MODEL"] || "gemini-2.5-flash";
const VISION_TIMEOUT_MS = 15000;

function apiKey(): string | undefined {
  return process.env["GEMINI_API_KEY"] || process.env["GOOGLE_API_KEY"] || undefined;
}

export function isVisionConfigured(): boolean {
  return Boolean(apiKey());
}

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI | null {
  const key = apiKey();
  if (!key) return null;
  if (!client) client = new GoogleGenAI({ apiKey: key });
  return client;
}

const PROMPT = `Eres un experto en refacciones automotrices de una refaccionaria mexicana. Te muestro la FOTO de una pieza (o un kit de piezas) que un cliente quiere identificar.

Tu trabajo:
1. Identifica QUÉ refacción es, usando el nombre común en México (ej. "bomba de gasolina", "balatas", "marcha", "alternador", "filtro de aire", "amortiguador", "bobina de encendido").
2. Si la foto muestra un kit o varias piezas, identifica la pieza PRINCIPAL.
3. Genera palabras clave para buscar esa pieza en un catálogo de autopartes: el tipo de pieza más rasgos distintivos visibles (forma, tipo, conector), en términos comunes de México. NO inventes marcas, modelos de auto, números de parte ni medidas que no puedas ver con certeza.

Si la imagen NO es una refacción automotriz, o no puedes determinar qué pieza es con confianza razonable, marca "recognized": false.

Responde SIEMPRE en JSON con este formato exacto, sin texto adicional:
{"recognized": true/false, "label": "nombre corto de la pieza en español", "query": "palabras clave para el catálogo"}

- "label": el nombre corto y legible para mostrar al cliente (ej. "Bomba de gasolina"). Cadena vacía si recognized es false.
- "query": las palabras clave de búsqueda (ej. "bomba gasolina electrica colador"). Cadena vacía si recognized es false.`;

export interface PartIdentification {
  recognized: boolean;
  label: string;
  query: string;
}

/**
 * Ask the multimodal model to identify the auto part shown in a base64 image.
 * Returns `{ recognized:false, label:"", query:"" }` on any failure (no key,
 * timeout, API error, unparseable output, or a confident "not a part") so the
 * caller can show a clean no-match result instead of erroring.
 */
export async function identifyPartFromImage(
  imageBase64: string,
  mimeType: string,
): Promise<PartIdentification> {
  const empty: PartIdentification = { recognized: false, label: "", query: "" };

  const ai = getClient();
  if (!ai) return empty;

  try {
    const resp = await ai.models.generateContent({
      model: VISION_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: imageBase64 } },
            { text: PROMPT },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
        abortSignal: AbortSignal.timeout(VISION_TIMEOUT_MS),
      },
    });

    const text = resp.text;
    if (!text) return empty;

    const parsed = JSON.parse(text) as {
      recognized?: unknown;
      label?: unknown;
      query?: unknown;
    };
    const recognized = parsed.recognized === true;
    const label = typeof parsed.label === "string" ? parsed.label.trim() : "";
    const query = typeof parsed.query === "string" ? parsed.query.trim() : "";

    // Only treat as recognized when we actually got search terms to ground on.
    if (!recognized || !query) return empty;
    return { recognized: true, label, query };
  } catch (err) {
    logger.error({ err }, "visionScan: identificación de imagen falló (no fatal)");
    return empty;
  }
}
