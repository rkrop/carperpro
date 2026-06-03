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
import { notTestProduct, sellableProduct } from "../routes/catalog";

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

// Embed up to BATCH products at a time (matches the embed API's max per request).
const BATCH = 100;
// Bounds the loop so a persistent embed failure can't spin forever. Far above
// any realistic sellable catalog size (~4k) / BATCH.
const MAX_ITER = 1000;

// Embed every sellable, non-test product that has no embedding yet. Self-healing
// and idempotent like backfillSearchVectors: only touches rows where
// `embedding IS NULL`, so after the first full pass it's a single cheap check;
// rows re-NULLed by the reset trigger (content changed) get picked up here too.
// No-ops with a log when no embedding provider is configured.
export async function backfillEmbeddings(): Promise<void> {
  if (!isEmbeddingsConfigured()) {
    logger.info(
      "embeddings: GEMINI_API_KEY ausente; backfill omitido (búsqueda semántica desactivada, texto intacto)",
    );
    return;
  }
  try {
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
        // Whole batch failed to embed (API down / invalid key) — stop instead of
        // re-selecting the same NULL rows forever. Next boot retries.
        logger.error(
          "embeddings: ningún vector generado en el lote, backfill detenido (se reintenta en el próximo arranque)",
        );
        break;
      }
    }
    if (total > 0) {
      logger.info({ embedded: total }, "embeddings: backfill completado");
    } else {
      logger.info("embeddings: sin filas pendientes (índice semántico al día)");
    }
  } catch (err) {
    logger.error({ err }, "embeddings: backfill falló (no fatal)");
  }
}
