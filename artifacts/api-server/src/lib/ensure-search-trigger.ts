import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";

// The product `search_vector` is maintained by a BEFORE INSERT/UPDATE trigger.
// The trigger + function are created out-of-band (Postgres tsvector triggers
// have no Drizzle representation), but the `search_vector` COLUMN lives in the
// Drizzle schema so `push`/publish never drops it. We (re)create the function
// here on EVERY boot so its definition is versioned in code and self-applies to
// dev AND prod (a publish boots the server). When the definition changes we NULL
// every `search_vector` so the batched backfill that runs right after re-indexes
// the whole catalog under the new rules.
//
// Weights: sku/name = A, brand/oem = B, descripcion = C, vehicles/specs = D
// (lowest) so a vehicle/spec match surfaces the product without outranking
// name/SKU. Config is 'simple' + unaccent to match the tsquery the search route
// builds — using a different config/accents makes matches silently return 0.
//
// IMPORTANT: keep this body in sync with the copy in `seed-excel.mjs`, which
// recreates the same function so a standalone reseed indexes vehicles/specs too.
const FUNCTION_BODY = `
      BEGIN
        NEW.search_vector :=
          setweight(to_tsvector('simple', unaccent(coalesce(NEW.sku, ''))), 'A') ||
          setweight(to_tsvector('simple', unaccent(coalesce(NEW.name, ''))), 'A') ||
          setweight(to_tsvector('simple', unaccent(coalesce(NEW.brand, ''))), 'B') ||
          setweight(to_tsvector('simple', unaccent(coalesce(NEW.descripcion, ''))), 'C') ||
          setweight(to_tsvector('simple', unaccent(coalesce(array_to_string(NEW.oem, ' '), ''))), 'B') ||
          setweight(to_tsvector('simple', unaccent(coalesce(array_to_string(NEW.vehicles, ' '), ''))), 'D') ||
          setweight(to_tsvector('simple', unaccent(coalesce((
            SELECT string_agg(coalesce(spec.value->>'value', '') || ' ' || coalesce(spec.value->>'label', ''), ' ')
            FROM jsonb_array_elements(
              CASE WHEN jsonb_typeof(NEW.specs) = 'array' THEN NEW.specs ELSE '[]'::jsonb END
            ) AS spec
          ), ''))), 'D');
        RETURN NEW;
      END;
`;

const FUNCTION_NAME = "products_search_vector_update";

const normalize = (s: string): string => s.replace(/\s+/g, " ").trim();

export async function ensureSearchTrigger(): Promise<void> {
  try {
    const current = await db.execute(
      sql`SELECT prosrc FROM pg_proc WHERE proname = ${FUNCTION_NAME} LIMIT 1`,
    );
    const existing = (current.rows[0]?.["prosrc"] as string | undefined) ?? "";
    const changed = normalize(existing) !== normalize(FUNCTION_BODY);

    // CREATE OR REPLACE is cheap and idempotent; it keeps the function oid so the
    // existing trigger binding survives. We still (re)create the trigger so a DB
    // that has the column but lost the trigger self-heals.
    await db.execute(
      sql.raw(
        `CREATE OR REPLACE FUNCTION ${FUNCTION_NAME}() RETURNS trigger AS $$${FUNCTION_BODY}$$ LANGUAGE plpgsql;`,
      ),
    );
    await db.execute(
      sql.raw(`DROP TRIGGER IF EXISTS products_search_trigger ON products;`),
    );
    await db.execute(
      sql.raw(
        `CREATE TRIGGER products_search_trigger BEFORE INSERT OR UPDATE ON products FOR EACH ROW EXECUTE FUNCTION ${FUNCTION_NAME}();`,
      ),
    );

    if (changed) {
      // Definition changed → existing vectors are stale. NULL them (one fast
      // UPDATE) so backfillSearchVectors() re-touches them in batches and the
      // trigger rebuilds each vector under the new rules.
      const res = await db.execute(sql`UPDATE products SET search_vector = NULL`);
      logger.info(
        { invalidated: res.rowCount ?? 0 },
        "search_vector: definición del trigger actualizada (vehículos/especificaciones), índice invalidado para reconstrucción",
      );
    } else {
      logger.info("search_vector: trigger al día");
    }
  } catch (err) {
    // Never fatal: search still works for already-indexed rows, and the next
    // boot retries.
    logger.error({ err }, "search_vector: ensureSearchTrigger falló (no fatal)");
  }
}
