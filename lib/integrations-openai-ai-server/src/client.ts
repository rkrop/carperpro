import OpenAI from "openai";

// The client is configured lazily so that simply importing this module never
// throws. Consumers that treat AI as an optional enhancement (e.g. graceful
// fallback to plain search) can call `isOpenAIConfigured()` first and skip the
// AI path when the integration isn't provisioned, instead of crashing at boot.

export function isOpenAIConfigured(): boolean {
  return Boolean(
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL &&
      process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  );
}

let cached: OpenAI | null = null;

/**
 * Returns a configured OpenAI client. Throws if the integration env vars are
 * missing — guard with `isOpenAIConfigured()` when AI is optional.
 */
export function getOpenAI(): OpenAI {
  if (cached) return cached;

  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

  if (!baseURL || !apiKey) {
    throw new Error(
      "AI_INTEGRATIONS_OPENAI_BASE_URL and AI_INTEGRATIONS_OPENAI_API_KEY must be set. Did you forget to provision the OpenAI AI integration?",
    );
  }

  cached = new OpenAI({ apiKey, baseURL });
  return cached;
}

// ── Direct OpenAI client (real API key, not the integration proxy) ───────────
// Keyed by OPENAI_REPLIT (a real OpenAI account key with credits), hitting
// api.openai.com directly. Used by the enrichment pipeline (Fase A), which needs
// reliable, credited throughput that the shared integration proxy quota doesn't
// guarantee. Falls back to OPENAI_API_KEY if that's what's configured. Lazy +
// cached like getOpenAI; guard optional callers with isOpenAIDirectConfigured().
function directKey(): string | undefined {
  return process.env.OPENAI_REPLIT || process.env.OPENAI_API_KEY || undefined;
}

export function isOpenAIDirectConfigured(): boolean {
  return Boolean(directKey());
}

let cachedDirect: OpenAI | null = null;

/**
 * Returns an OpenAI client built from a real API key (OPENAI_REPLIT, or
 * OPENAI_API_KEY as fallback), talking to api.openai.com directly. Throws if no
 * key is set — guard with isOpenAIDirectConfigured() when AI is optional.
 */
export function getOpenAIDirect(): OpenAI {
  if (cachedDirect) return cachedDirect;
  const apiKey = directKey();
  if (!apiKey) {
    throw new Error(
      "OPENAI_REPLIT (or OPENAI_API_KEY) must be set to use the direct OpenAI client.",
    );
  }
  cachedDirect = new OpenAI({ apiKey });
  return cachedDirect;
}

/**
 * Lazy proxy kept for backwards compatibility: behaves like an `OpenAI`
 * instance but defers configuration/validation until first property access, so
 * importing this module is always side-effect free.
 */
export const openai: OpenAI = new Proxy({} as OpenAI, {
  get(_target, prop, receiver) {
    return Reflect.get(getOpenAI(), prop, receiver);
  },
});
