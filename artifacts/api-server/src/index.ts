import app from "./app";
import { logger } from "./lib/logger";
import { startScheduler } from "./lib/admintotal/scheduler";
import { initStripe } from "./lib/stripe/init";
import { backfillSearchVectors } from "./lib/search-backfill";
import { ensureSearchTrigger } from "./lib/ensure-search-trigger";
import { ensureEmbeddingSetup } from "./lib/ensure-embedding-setup";
import { autoImportIfDirty } from "./lib/auto-catalog-import";
import { backfillEmbeddings } from "./lib/embedding-backfill";
import { backfillDescriptions } from "./lib/description-backfill";
import { backfillApymsaFichas } from "./lib/apymsa-ficha-backfill";

// Last-resort safety net. The known production crash-loop (Postgres dropping
// idle connections → unhandled pg 'error' event → process death) is fixed at
// the source in the db pool and advisory-lock client listeners, but these
// handlers ensure any *future* stray emitter error or unawaited rejection is
// logged with full context instead of silently killing the server. A rejected
// promise rarely corrupts process state, so we keep serving; a truly uncaught
// exception may leave the process in an undefined state, so we log and exit so
// the platform restarts a clean instance rather than running a wedged one.
process.on("unhandledRejection", (reason) => {
  logger.error(
    { err: reason instanceof Error ? reason.message : String(reason) },
    "unhandledRejection (no fatal); el servidor sigue activo",
  );
});

process.on("uncaughtException", (err) => {
  logger.error({ err: err.message, stack: err.stack }, "uncaughtException; cerrando para reinicio limpio");
  process.exit(1);
});

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
    // Si la BD tiene datos sucios del ERP antiguo (más productos de los que el
    // maestro puede proveer, o >5% con price=0), corre el importador maestro
    // para restaurar el catálogo a la fuente de verdad (Excel MAESTRO).
    await autoImportIfDirty();
    await ensureSearchTrigger();
    await backfillSearchVectors();
    // Backfill ADITIVO de fichas técnicas + imagen (APYMSA) versionadas en
    // src/data/apymsa-fichas.json. Idempotente: tras la primera corrida no
    // toca nada. Lleva el enriquecimiento a producción al publicar, ya que el
    // WAF de APYMSA impide scrapear desde el runtime desplegado.
    await backfillApymsaFichas();
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
