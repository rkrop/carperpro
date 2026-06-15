import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";
import enrichmentData from "../data/enrichment-data.json";

/**
 * Carga ADITIVA del enriquecimiento estructurado (códigos OEM + aplicaciones de
 * vehículo) versionado en `src/data/enrichment-data.json`.
 *
 * Por qué vive aquí y no se corre la IA en producción: producción es una base
 * SEPARADA y de solo lectura para el agente, y el pipeline de extracción usa una
 * llave DIRECTA de OpenAI que no está garantizada en el runtime desplegado. Igual
 * que `apymsa-ficha-backfill` y `ciosa-catalog-backfill`, los datos ya revisados
 * en desarrollo se versionan en código y este cargador los aplica en CUALQUIER
 * base a la que el servidor se conecte (dev o prod), de modo que un `publish` los
 * lleve a producción al arrancar.
 *
 * REGLAS (no negociables):
 *   - Inserta SOLO en las tablas estructuradas (product_oem_codes,
 *     product_applications). NUNCA toca precio, costo, status, stock ni la tabla
 *     products. Es puramente aditivo.
 *   - Inserta SOLO filas cuyo producto exista en la base destino (sin FK, así que
 *     se filtra con EXISTS para no dejar filas huérfanas).
 *   - IDEMPOTENTE: ON CONFLICT DO NOTHING sobre los índices de deduplicación, más
 *     una guarda de conteo que evita reintentar miles de inserts en cada arranque
 *     una vez que los datos ya están aplicados.
 */

type OemRec = {
  productId: string;
  brand: string | null;
  codeRaw: string;
  codeNorm: string;
};

type AppRec = {
  productId: string;
  make: string;
  model: string;
  yearFrom: number | null;
  yearTo: number | null;
  motor: string | null;
};

type EnrichmentData = { oemCodes: OemRec[]; applications: AppRec[] };

export async function backfillEnrichmentData(): Promise<void> {
  const data = enrichmentData as EnrichmentData;
  const oem = Array.isArray(data?.oemCodes) ? data.oemCodes : [];
  const apps = Array.isArray(data?.applications) ? data.applications : [];
  if (oem.length === 0 && apps.length === 0) return;

  try {
    // Guarda de conteo: si ambas tablas ya tienen al menos tantas filas como el
    // JSON, los datos ya se aplicaron y no hace falta reintentar (evita miles de
    // inserts ON CONFLICT en cada arranque). Si faltan, corre el insert aditivo.
    const counts = await db.execute<{ oem_n: number; app_n: number }>(sql`
      SELECT
        (SELECT count(*)::int FROM product_oem_codes) AS oem_n,
        (SELECT count(*)::int FROM product_applications) AS app_n
    `);
    const oemN = counts.rows[0]?.oem_n ?? 0;
    const appN = counts.rows[0]?.app_n ?? 0;
    if (oemN >= oem.length && appN >= apps.length) {
      logger.info(
        { oemN, appN, oemExpected: oem.length, appExpected: apps.length },
        "enrichment-backfill: datos ya aplicados, omitido",
      );
      return;
    }

    // ── Códigos OEM ───────────────────────────────────────────────────────────
    if (oem.length > 0) {
      const insOem = await db.execute<{ n: number }>(sql`
        WITH x AS (
          SELECT * FROM jsonb_to_recordset(${JSON.stringify(oem)}::jsonb) AS t(
            "productId" text, brand text, "codeRaw" text, "codeNorm" text
          )
        ),
        ins AS (
          INSERT INTO product_oem_codes(product_id, brand, code_raw, code_norm, source)
          SELECT x."productId", x.brand, x."codeRaw", x."codeNorm", 'backfill'
          FROM x
          WHERE EXISTS (SELECT 1 FROM products p WHERE p.id = x."productId")
          ON CONFLICT (product_id, code_norm) DO NOTHING
          RETURNING 1
        )
        SELECT count(*)::int AS n FROM ins
      `);
      const n = (insOem as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0;
      logger.info({ inserted: n, total: oem.length }, "enrichment-backfill: códigos OEM");
    }

    // ── Aplicaciones de vehículo ───────────────────────────────────────────────
    // OJO idempotencia: el índice de deduplicación incluye columnas nullable
    // (year_from, year_to, motor) con NULLS DISTINCT (a propósito; ver schema),
    // así que ON CONFLICT NO atrapa filas con NULL. Si el guard de conteo no se
    // cumple (p. ej. algún producto del JSON no existe en el destino y se filtra
    // por EXISTS, dejando el conteo por debajo del esperado), este insert podría
    // re-correr en cada arranque y DUPLICAR filas con motor/año NULL. Por eso
    // anteponemos un NOT EXISTS null-safe (IS NOT DISTINCT FROM) que hace el
    // insert idempotente sin depender del guard; ON CONFLICT queda de respaldo.
    if (apps.length > 0) {
      const insApp = await db.execute<{ n: number }>(sql`
        WITH x AS (
          SELECT * FROM jsonb_to_recordset(${JSON.stringify(apps)}::jsonb) AS t(
            "productId" text, make text, model text,
            "yearFrom" integer, "yearTo" integer, motor text
          )
        ),
        ins AS (
          INSERT INTO product_applications(product_id, make, model, year_from, year_to, motor, source)
          SELECT x."productId", x.make, x.model, x."yearFrom", x."yearTo", x.motor, 'backfill'
          FROM x
          WHERE EXISTS (SELECT 1 FROM products p WHERE p.id = x."productId")
            AND NOT EXISTS (
              SELECT 1 FROM product_applications pa
              WHERE pa.product_id = x."productId"
                AND pa.make = x.make
                AND pa.model = x.model
                AND pa.year_from IS NOT DISTINCT FROM x."yearFrom"
                AND pa.year_to IS NOT DISTINCT FROM x."yearTo"
                AND pa.motor IS NOT DISTINCT FROM x.motor
            )
          ON CONFLICT ON CONSTRAINT product_applications_dedupe_idx DO NOTHING
          RETURNING 1
        )
        SELECT count(*)::int AS n FROM ins
      `);
      const n = (insApp as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0;
      logger.info({ inserted: n, total: apps.length }, "enrichment-backfill: aplicaciones");
    }
  } catch (err) {
    logger.error({ err }, "enrichment-backfill: falló (no fatal)");
  }
}
