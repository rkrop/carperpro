import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";

// Rows synced from the ERP before the search_vector column existed were never
// run through the BEFORE INSERT/UPDATE trigger, so their search_vector is NULL
// and they are invisible to relevance-ranked search. This backfill re-touches
// those rows in batches so the trigger recomputes the vector.
//
// It is IDEMPOTENT and self-healing: it only ever touches rows where
// search_vector IS NULL, so after the first successful run it costs a single
// cheap "are there any NULLs?" check. It runs on every boot (including in
// production, where the agent's tooling can only read the DB) so a publish is
// all it takes to index the live catalog.
const BATCH = 2000;
// Safety cap: if the trigger ever regresses and stops setting search_vector,
// the same NULL rows would be re-touched every batch forever (affected stays
// == BATCH). This bounds the loop to ~MAX_ITER*BATCH rows, far above any
// realistic catalog size, and logs the anomaly instead of spinning.
const MAX_ITER = 10000;

export async function backfillSearchVectors(): Promise<void> {
  try {
    let total = 0;
    let iterations = 0;
    for (;;) {
      if (++iterations > MAX_ITER) {
        logger.error(
          { total, iterations },
          "search_vector: backfill abortado por límite de iteraciones (¿trigger roto?)",
        );
        break;
      }
      const res = await db.execute(sql`
        WITH batch AS (
          SELECT id FROM products WHERE search_vector IS NULL LIMIT ${BATCH}
        )
        UPDATE products p SET updated_at = updated_at
        FROM batch
        WHERE p.id = batch.id
      `);
      const affected = res.rowCount ?? 0;
      total += affected;
      if (affected < BATCH) break;
    }
    if (total > 0) {
      logger.info({ backfilled: total }, "search_vector: backfill completado");
    } else {
      logger.info("search_vector: sin filas pendientes (índice al día)");
    }
  } catch (err) {
    // Never fatal: search still works for already-indexed rows, and the next
    // boot retries.
    logger.error({ err }, "search_vector: backfill falló (no fatal)");
  }
}
