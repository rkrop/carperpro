import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";
import { isEmbeddingsConfigured } from "./embeddings";

// Semantic-search (pgvector) self-healing setup, mirroring ensure-search-trigger.
// Runs on every boot so dev AND prod (a publish boots the server) converge:
//  1. the `vector` extension exists (defensive — the db `push` script also
//     creates it before the column),
//  2. an HNSW cosine index backs nearest-neighbor scans,
//  3. a BEFORE UPDATE trigger NULLs `embedding` AND `descripcion_generada`
//     whenever the searchable content changes, so the next backfill pass
//     automatically re-embeds the row and regenerates its AI sales description
//     (Task #49). This is how new/changed products (ERP sync + webhooks) keep
//     both AI-derived fields current without any per-write model call on the hot
//     path. The two backfills (embeddings, descriptions) pick up the NULLed rows.
//
// All steps are idempotent and NON-FATAL: if the column doesn't exist yet
// (push hasn't run), the index/trigger creation throws and is logged, and the
// next boot retries. Plain text search is never affected.
const RESET_FUNCTION = `
  BEGIN
    IF (
      NEW.name IS DISTINCT FROM OLD.name
      OR NEW.brand IS DISTINCT FROM OLD.brand
      OR NEW.descripcion IS DISTINCT FROM OLD.descripcion
      OR NEW.descripcion_ecommerce IS DISTINCT FROM OLD.descripcion_ecommerce
      OR NEW.descripcion_adicional IS DISTINCT FROM OLD.descripcion_adicional
      OR NEW.specs IS DISTINCT FROM OLD.specs
      OR NEW.vehicles IS DISTINCT FROM OLD.vehicles
      OR NEW.oem IS DISTINCT FROM OLD.oem
      OR NEW.category_id IS DISTINCT FROM OLD.category_id
      OR NEW.subcategory_id IS DISTINCT FROM OLD.subcategory_id
    ) THEN
      NEW.embedding := NULL;
      NEW.descripcion_generada := NULL;
    END IF;
    RETURN NEW;
  END;
`;

export async function ensureEmbeddingSetup(): Promise<void> {
  // Skip all pgvector/extension/index work when semantic search is disabled.
  if (!isEmbeddingsConfigured()) return;
  try {
    await db.execute(sql.raw(`CREATE EXTENSION IF NOT EXISTS vector`));
    await db.execute(
      sql.raw(
        `CREATE INDEX IF NOT EXISTS products_embedding_hnsw ON products USING hnsw (embedding vector_cosine_ops)`,
      ),
    );
    await db.execute(
      sql.raw(
        `CREATE OR REPLACE FUNCTION products_embedding_reset() RETURNS trigger AS $$${RESET_FUNCTION}$$ LANGUAGE plpgsql;`,
      ),
    );
    await db.execute(
      sql.raw(
        `DROP TRIGGER IF EXISTS products_embedding_reset_trigger ON products;`,
      ),
    );
    await db.execute(
      sql.raw(
        `CREATE TRIGGER products_embedding_reset_trigger BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION products_embedding_reset();`,
      ),
    );
    logger.info(
      "embeddings: setup al día (extensión vector, índice HNSW, trigger de reseteo)",
    );
  } catch (err) {
    logger.error(
      { err },
      "embeddings: ensureEmbeddingSetup falló (no fatal, búsqueda de texto intacta)",
    );
  }
}
