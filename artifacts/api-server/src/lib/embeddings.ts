import { GoogleGenAI } from "@google/genai";
import { EMBEDDING_DIM } from "@workspace/db";
import { logger } from "./logger";

// Semantic-search embeddings via Google's `gemini-embedding-001` model,
// requesting EMBEDDING_DIM (768) dimensions to match the DB column. Multilingual
// — good for Spanish auto-parts queries. At dimensions other than the model's
// native 3072 the output is NOT unit-normalized, which is fine here: we compare
// with cosine distance (pgvector `<=>` / vector_cosine_ops), which is
// scale-invariant.
//
// IMPORTANT: neither Replit's managed OpenAI nor managed Gemini AI integration
// supports the embeddings API, so this calls Google directly with the user's own
// key (GEMINI_API_KEY / GOOGLE_API_KEY). EVERYTHING here degrades gracefully:
// when no key is set, `isEmbeddingsConfigured()` is false and the embed helpers
// return null, so the catalog falls back to plain text search untouched.
export const EMBEDDING_MODEL = "gemini-embedding-001";
export { EMBEDDING_DIM };

function apiKey(): string | undefined {
  return process.env["GEMINI_API_KEY"] || process.env["GOOGLE_API_KEY"] || undefined;
}

// Semantic search is OFF by default. It depends on Google's embeddings API
// (free tier = 1,000 requests/day → 429 RESOURCE_EXHAUSTED once the catalog
// backfill exceeds it) and adds little over the text + synonym search, so it is
// opt-in. Set SEMANTIC_SEARCH_ENABLED=1 (and provide GEMINI_API_KEY /
// GOOGLE_API_KEY) to turn it back on. NOTE: this gate is embeddings-only — the
// Gemini Vision photo scanner uses the same key independently and is unaffected.
function semanticSearchEnabled(): boolean {
  const flag = (process.env["SEMANTIC_SEARCH_ENABLED"] ?? "").trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes" || flag === "on";
}

// True only when semantic search is explicitly enabled AND a key is present.
// The single gate for every embeddings code path (query-time widening, boot +
// scheduled backfill, pgvector setup), so flipping the flag turns it all off.
export function isEmbeddingsConfigured(): boolean {
  return semanticSearchEnabled() && Boolean(apiKey());
}

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI | null {
  const key = apiKey();
  if (!key) return null;
  if (!client) client = new GoogleGenAI({ apiKey: key });
  return client;
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// A 429 from the embeddings API includes a `retryDelay` (e.g. "59s") — the free
// tier caps requests-per-minute and each text counts as one request. Honor that
// delay so the mass backfill paces itself instead of giving up.
const MAX_RETRY_WAIT_MS = 70_000;
function isRateLimit(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  const msg = err instanceof Error ? err.message : String(err);
  return status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(msg);
}
function retryDelayMs(err: unknown): number | null {
  const msg = err instanceof Error ? err.message : String(err);
  const m =
    msg.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/) ||
    msg.match(/retry in (\d+(?:\.\d+)?)\s*s/i);
  return m && m[1] ? Math.ceil(parseFloat(m[1]) * 1000) : null;
}

// Retry with backoff. On rate limits, wait the server-provided retryDelay (so
// the next per-minute window opens); on transient blips, exponential backoff +
// jitter. Mass backfill MUST tolerate both.
async function withRetry<T>(fn: () => Promise<T>, tries = 8): Promise<T> {
  let delay = 1000;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= tries - 1) throw err;
      let wait: number;
      if (isRateLimit(err)) {
        wait = Math.min((retryDelayMs(err) ?? 60_000) + 1000, MAX_RETRY_WAIT_MS);
      } else {
        wait = delay + Math.random() * 250;
        delay = Math.min(delay * 2, 30_000);
      }
      await sleep(wait);
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
          config: {
            taskType: "RETRIEVAL_DOCUMENT",
            outputDimensionality: EMBEDDING_DIM,
          },
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
        config: {
          taskType: "RETRIEVAL_QUERY",
          outputDimensionality: EMBEDDING_DIM,
        },
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
