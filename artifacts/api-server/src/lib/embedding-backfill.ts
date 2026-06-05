import { and, eq, sql } from "drizzle-orm";
import {
  db,
  productsTable,
  categoriesTable,
  subcategoriesTable,
  type ProductSpec,
} from "@workspace/db";
import { logger } from "./logger";
import {
  embedDocuments,
  isEmbeddingsConfigured,
  toVectorLiteral,
} from "./embeddings";
import { notTestProduct, sellableProduct } from "./catalogSearch";
import { withAdvisoryLock, JOB_LOCK } from "./advisory-lock";

// Compose the text we embed for a product. Same signal as the full-text vector
// (name/brand/category/description/specs/vehicles/OEM) but as natural language
// so the embedding captures meaning. Truncated to keep well under the model's
// token limit and avoid a single long row failing its whole batch.
const MAX_TEXT = 2000;
interface EmbedRow {
  id: string;
  name: string;
  brand: string;
  descripcion: string | null;
  specs: ProductSpec[];
  vehicles: string[];
  oem: string[] | null;
  categoryName: string | null;
  subcategoryName: string | null;
}

function buildEmbeddingText(row: EmbedRow): string {
  const specs = (row.specs ?? [])
    .map((s) => `${s.label}: ${s.value}`)
    .join(", ");
  const parts = [
    row.name,
    row.brand && row.brand !== "SIN MARCA" ? row.brand : "",
    row.categoryName ?? "",
    row.subcategoryName ?? "",
    row.descripcion ?? "",
    specs,
    (row.vehicles ?? []).join(", "),
    (row.oem ?? []).join(" "),
  ];
  return parts
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(". ")
    .slice(0, MAX_TEXT);
}

// Embed up to BATCH products per request. Kept just under the embed API's
// free-tier limit of 100 requests/minute (each text counts as one request) so a
// single batch never self-exceeds the quota; withRetry then waits out the
// per-minute window between batches. Full ~4k backfill therefore runs ~100/min
// in the background and is fully resumable across restarts.
const BATCH = 95;
// Bounds the loop so a persistent embed failure can't spin forever. Far above
// any realistic sellable catalog size (~4k) / BATCH.
const MAX_ITER = 1000;

// Guards against overlapping runs: the boot backfill can take ~40 min on the
// free tier, and the periodic catch-up tick fires every few minutes — without
// this flag a tick could start a second concurrent pass over the same NULL rows
// and burn the per-minute quota twice. Concurrent calls simply no-op.
let running = false;

// Embed every sellable, non-test product that has no embedding yet. Self-healing
// and idempotent like backfillSearchVectors: only touches rows where
// `embedding IS NULL`, so after the first full pass it's a single cheap check;
// rows re-NULLed by the reset trigger (content changed) get picked up here too.
// Safe to call repeatedly (boot + periodic catch-up): overlapping calls no-op.
// No-ops with a log when no embedding provider is configured.
export async function backfillEmbeddings(): Promise<void> {
  if (!isEmbeddingsConfigured()) {
    logger.info(
      "embeddings: búsqueda semántica desactivada (SEMANTIC_SEARCH_ENABLED apagado o sin API key); backfill omitido, texto intacto",
    );
    return;
  }
  if (running) {
    logger.debug("embeddings: backfill ya en curso, se omite esta ejecución");
    return;
  }
  running = true;
  try {
    const ran = await withAdvisoryLock(
      JOB_LOCK.embeddingBackfill,
      runEmbeddingBackfill,
    );
    if (!ran) {
      logger.debug(
        "embeddings: otra instancia tiene el lock del backfill, se omite esta ejecución",
      );
    }
  } catch (err) {
    logger.error({ err }, "embeddings: backfill falló (no fatal)");
  } finally {
    running = false;
  }
}

// The real pass, run under a Postgres advisory lock so only one instance embeds
// at a time across an Autoscale fleet.
async function runEmbeddingBackfill(): Promise<void> {
  logger.info(
    "embeddings: iniciando backfill (free tier ~100/min, se reanuda tras reinicios)",
  );
  let total = 0;
  let iterations = 0;
  for (;;) {
    if (++iterations > MAX_ITER) {
      logger.error(
        { total, iterations },
        "embeddings: backfill abortado por límite de iteraciones",
      );
      break;
    }
    const batch: EmbedRow[] = await db
      .select({
        id: productsTable.id,
        name: productsTable.name,
        brand: productsTable.brand,
        descripcion: productsTable.descripcion,
        specs: productsTable.specs,
        vehicles: productsTable.vehicles,
        oem: productsTable.oem,
        categoryName: categoriesTable.name,
        subcategoryName: subcategoriesTable.name,
      })
      .from(productsTable)
      .leftJoin(
        categoriesTable,
        eq(productsTable.categoryId, categoriesTable.id),
      )
      .leftJoin(
        subcategoriesTable,
        eq(productsTable.subcategoryId, subcategoriesTable.id),
      )
      .where(
        and(
          sql`${productsTable.embedding} is null`,
          notTestProduct(),
          sellableProduct(),
        ),
      )
      .limit(BATCH);

    if (batch.length === 0) break;

    const vectors = await embedDocuments(batch.map(buildEmbeddingText));
    let updated = 0;
    for (let i = 0; i < batch.length; i++) {
      const vector = vectors[i];
      const row = batch[i];
      if (!vector || !row) continue;
      await db.execute(
        sql`update products set embedding = ${toVectorLiteral(vector)}::vector where id = ${row.id}`,
      );
      updated++;
    }
    total += updated;
    if (updated === 0) {
      // Whole batch failed to embed (API down / invalid key / daily quota
      // exhausted) — stop instead of re-selecting the same NULL rows forever.
      // Next boot retries.
      logger.error(
        "embeddings: ningún vector generado en el lote, backfill detenido (se reintenta en el próximo arranque)",
      );
      break;
    }
    logger.info({ embedded: total }, "embeddings: progreso de backfill");
  }
  if (total > 0) {
    logger.info({ embedded: total }, "embeddings: backfill completado");
  } else {
    logger.info("embeddings: sin filas pendientes (índice semántico al día)");
  }
}
