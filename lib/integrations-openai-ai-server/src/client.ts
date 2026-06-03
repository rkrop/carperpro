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
