import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";
import enrichmentData from "../data/enrichment-data.json";
import enrichmentProducts from "../data/enrichment-products.json";

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

/**
 * Carga ADITIVA del enriquecimiento que vive en la propia tabla `products`
 * (marca, ficha técnica/specs, compatibilidad/vehicles y equivalencias/oem),
 * versionado en `src/data/enrichment-products.json`.
 *
 * Por qué: el enriquecimiento por IA se corrió contra la base de DESARROLLO y
 * escribió estos campos directo en products. Producción es una base SEPARADA y
 * la IA no se recorre ahí, así que — igual que el enriquecimiento estructurado —
 * los valores ya revisados se versionan en código y este cargador los aplica en
 * CUALQUIER base a la que el servidor se conecte, de modo que un `publish` los
 * lleve a producción al arrancar.
 *
 * REGLAS (no negociables):
 *   - Rellena SOLO campos VACÍOS, con las MISMAS guardas que el pipeline de
 *     escritura (applyEnrichmentWrites): brand solo si = 'SIN MARCA'; specs solo
 *     si el arreglo está vacío; vehicles/oem solo si la cardinalidad es 0/NULL.
 *   - NUNCA toca precio, costo, status, stock ni descripción. Es puramente
 *     aditivo y no sobre-escribe un dato existente.
 *   - IDEMPOTENTE: el UPDATE solo afecta filas con algún campo todavía vacío, así
 *     que un segundo arranque actualiza 0 filas. Una guarda previa evita incluso
 *     recorrer el join cuando ya no queda nada pendiente.
 */
type ProductEnrich = {
  id: string;
  brand?: string;
  specs?: unknown[];
  vehicles?: string[];
  oem?: string[];
};

export async function backfillEnrichmentProducts(): Promise<void> {
  const data = enrichmentProducts as { products?: ProductEnrich[] };
  const prods = Array.isArray(data?.products) ? data.products : [];
  if (prods.length === 0) return;

  try {
    const payload = JSON.stringify(prods);

    // Guarda barata: ¿queda algún producto del JSON con un campo todavía vacío
    // que este cargador llenaría? Si no, los datos ya se aplicaron y se omite.
    const pending = await db.execute<{ pending: number }>(sql`
      WITH x AS (
        SELECT * FROM jsonb_to_recordset(${payload}::jsonb) AS t(
          id text, brand text, specs jsonb, vehicles jsonb, oem jsonb
        )
      )
      SELECT count(*)::int AS pending
      FROM x JOIN products p ON p.id = x.id
      WHERE (x.brand IS NOT NULL AND p.brand = 'SIN MARCA')
         OR (x.specs IS NOT NULL AND coalesce(jsonb_array_length(
              case when jsonb_typeof(p.specs) = 'array' then p.specs else '[]'::jsonb end), 0) = 0)
         OR (x.vehicles IS NOT NULL AND cardinality(p.vehicles) = 0)
         OR (x.oem IS NOT NULL AND (p.oem IS NULL OR cardinality(p.oem) = 0))
    `);
    const pendingN = pending.rows[0]?.pending ?? 0;
    if (pendingN === 0) {
      logger.info({ total: prods.length }, "enrichment-products: datos ya aplicados, omitido");
      return;
    }

    // UPDATE aditivo: cada campo se llena SOLO si está vacío; el WHERE final
    // limita a filas que realmente cambian (idempotencia + conteo significativo).
    const res = await db.execute<{ n: number }>(sql`
      WITH x AS (
        SELECT * FROM jsonb_to_recordset(${payload}::jsonb) AS t(
          id text, brand text, specs jsonb, vehicles jsonb, oem jsonb
        )
      ),
      upd AS (
        UPDATE products p SET
          brand = CASE WHEN p.brand = 'SIN MARCA' AND x.brand IS NOT NULL
                       THEN x.brand ELSE p.brand END,
          specs = CASE WHEN coalesce(jsonb_array_length(
                            case when jsonb_typeof(p.specs) = 'array' then p.specs else '[]'::jsonb end), 0) = 0
                        AND x.specs IS NOT NULL
                       THEN x.specs ELSE p.specs END,
          vehicles = CASE WHEN cardinality(p.vehicles) = 0 AND x.vehicles IS NOT NULL
                          THEN ARRAY(SELECT jsonb_array_elements_text(x.vehicles)) ELSE p.vehicles END,
          oem = CASE WHEN (p.oem IS NULL OR cardinality(p.oem) = 0) AND x.oem IS NOT NULL
                     THEN ARRAY(SELECT jsonb_array_elements_text(x.oem)) ELSE p.oem END
        FROM x
        WHERE p.id = x.id
          AND (
            (x.brand IS NOT NULL AND p.brand = 'SIN MARCA')
            OR (x.specs IS NOT NULL AND coalesce(jsonb_array_length(
                 case when jsonb_typeof(p.specs) = 'array' then p.specs else '[]'::jsonb end), 0) = 0)
            OR (x.vehicles IS NOT NULL AND cardinality(p.vehicles) = 0)
            OR (x.oem IS NOT NULL AND (p.oem IS NULL OR cardinality(p.oem) = 0))
          )
        RETURNING 1
      )
      SELECT count(*)::int AS n FROM upd
    `);
    const n = (res as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0;
    logger.info({ updated: n, total: prods.length }, "enrichment-products: campos rellenados");
  } catch (err) {
    logger.error({ err }, "enrichment-products: falló (no fatal)");
  }
}
