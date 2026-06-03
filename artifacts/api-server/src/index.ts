import app from "./app";
import { logger } from "./lib/logger";
import { startScheduler } from "./lib/admintotal/scheduler";
import { initStripe } from "./lib/stripe/init";
import { backfillSearchVectors } from "./lib/search-backfill";
import { ensureSearchTrigger } from "./lib/ensure-search-trigger";
import { ensureEmbeddingSetup } from "./lib/ensure-embedding-setup";
import { backfillEmbeddings } from "./lib/embedding-backfill";
import { backfillDescriptions } from "./lib/description-backfill";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  // Ensure the search_vector trigger/function are present and up to date
  // (versioned in code so dev AND prod self-apply on boot), then backfill any
  // rows missing a search_vector (idempotent, self-healing). Runs here so a
  // publish indexes the live catalog for relevance-ranked search. Ordered:
  // ensureSearchTrigger() may NULL vectors when its definition changes, and
  // backfillSearchVectors() repopulates those NULLs in batches.
  void (async () => {
    await ensureSearchTrigger();
    await backfillSearchVectors();
    // Semantic search (pgvector): ensure the extension/index/reset-trigger, then
    // embed any product missing an embedding. Both no-op gracefully when no
    // embedding provider (GEMINI_API_KEY) is configured — plain text search is
    // never affected.
    await ensureEmbeddingSetup();
    await backfillEmbeddings();
    // AI sales descriptions (Task #49): generate one for every product the ERP
    // left without a `descripcion`, served as a fallback so the catalog never
    // shows "sin descripción". Offline, idempotent, resumable; no-ops without the
    // OpenAI integration. Runs after embeddings so the two backfills don't both
    // start a heavy pass at the same instant on boot.
    await backfillDescriptions();
  })();
  // Kick off the Admintotal inbound sync + outbound queue scheduler.
  startScheduler();
  // Best-effort Stripe setup (schema, managed webhook, backfill). Never fatal.
  void initStripe();
});
