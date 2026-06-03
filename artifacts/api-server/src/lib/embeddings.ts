import { GoogleGenAI } from "@google/genai";
import { EMBEDDING_DIM } from "@workspace/db";
import { logger } from "./logger";

// Semantic-search embeddings via Google's `text-embedding-004` model (768 dims,
// multilingual — good for Spanish auto-parts queries).
//
// IMPORTANT: neither Replit's managed OpenAI nor managed Gemini AI integration
// supports the embeddings API, so this calls Google directly with the user's own
// key (GEMINI_API_KEY / GOOGLE_API_KEY). EVERYTHING here degrades gracefully:
// when no key is set, `isEmbeddingsConfigured()` is false and the embed helpers
// return null, so the catalog falls back to plain text search untouched.
export const EMBEDDING_MODEL = "text-embedding-004";
export { EMBEDDING_DIM };

function apiKey(): string | undefined {
  return process.env["GEMINI_API_KEY"] || process.env["GOOGLE_API_KEY"] || undefined;
}

export function isEmbeddingsConfigured(): boolean {
  return Boolean(apiKey());
}

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI | null {
  const key = apiKey();
  if (!key) return null;
  if (!client) client = new GoogleGenAI({ apiKey: key });
  return client;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Retry with exponential backoff + jitter. Embedding endpoints rate-limit (429)
// and have transient blips; mass backfill MUST tolerate them.
async function withRetry<T>(fn: () => Promise<T>, tries = 5): Promise<T> {
  let delay = 1000;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= tries - 1) throw err;
      await sleep(delay + Math.random() * 250);
      delay = Math.min(delay * 2, 30000);
    }
  }
}

function isValidVector(v: unknown): v is number[] {
  return (
    Array.isArray(v) &&
    v.length === EMBEDDING_DIM &&
    v.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

// Embed many documents (product texts) in one go. Returns one slot per input,
// `null` for any that failed so the caller can leave that row for a later pass.
// Batched (Google allows up to 100 contents/request) with gentle pacing.
const DOC_CHUNK = 100;
export async function embedDocuments(
  texts: string[],
): Promise<(number[] | null)[]> {
  const ai = getClient();
  if (!ai) return texts.map(() => null);

  const out: (number[] | null)[] = [];
  for (let i = 0; i < texts.length; i += DOC_CHUNK) {
    const chunk = texts.slice(i, i + DOC_CHUNK);
    try {
      const resp = await withRetry(() =>
        ai.models.embedContent({
          model: EMBEDDING_MODEL,
          contents: chunk,
          config: { taskType: "RETRIEVAL_DOCUMENT" },
        }),
      );
      const embs = resp.embeddings ?? [];
      for (let j = 0; j < chunk.length; j++) {
        const values = embs[j]?.values;
        out.push(isValidVector(values) ? values : null);
      }
    } catch (err) {
      logger.error({ err }, "embeddings: lote de documentos falló (no fatal)");
      for (let j = 0; j < chunk.length; j++) out.push(null);
    }
    if (i + DOC_CHUNK < texts.length) await sleep(200);
  }
  return out;
}

// Query embeddings are cached (same phrase across paginated requests embeds
// once) to keep search cheap and snappy. Bounded LRU-ish: clear when full.
const QUERY_CACHE_TTL_MS = 60 * 60 * 1000;
const QUERY_CACHE_MAX = 500;
const queryCache = new Map<string, { vector: number[]; at: number }>();

export async function embedQuery(text: string): Promise<number[] | null> {
  const ai = getClient();
  if (!ai) return null;
  const key = text.trim().toLowerCase();
  if (!key) return null;

  const hit = queryCache.get(key);
  if (hit && Date.now() - hit.at < QUERY_CACHE_TTL_MS) return hit.vector;

  try {
    const resp = await withRetry(() =>
      ai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: key,
        config: { taskType: "RETRIEVAL_QUERY" },
      }),
    );
    const values = resp.embeddings?.[0]?.values;
    if (!isValidVector(values)) return null;
    if (queryCache.size >= QUERY_CACHE_MAX) queryCache.clear();
    queryCache.set(key, { vector: values, at: Date.now() });
    return values;
  } catch (err) {
    logger.error({ err }, "embeddings: query falló (no fatal)");
    return null;
  }
}

// Postgres pgvector literal: '[v1,v2,...]'. Caller casts with `::vector`.
export function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}
