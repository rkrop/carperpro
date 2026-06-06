import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";
import fichaData from "../data/apymsa-fichas.json";

/**
 * Backfill ADITIVO de fichas técnicas (products.specs) e imagen principal
 * (products.image) extraídas de las fichas PÚBLICAS de APYMSA para los códigos
 * nativos de 7 dígitos.
 *
 * Por qué vive aquí y no en el scraper: el WAF de APYMSA bloquea la IP de salida
 * del runtime (workspace y producción), así que ni este servidor ni la app
 * desplegada pueden alcanzar APYMSA. Los datos se scrapean una sola vez desde el
 * sandbox del agente (egress permitido) y se versionan en
 * `src/data/apymsa-fichas.json`. Este cargador los aplica de forma aditiva en
 * CUALQUIER base de datos a la que el servidor esté conectado (dev o prod), de
 * modo que un `publish` los lleve a producción al arrancar.
 *
 * REGLAS (idénticas al scraper, no negociables):
 *   - ADITIVO: specs solo si está vacío; image solo si es null/''. Nunca pisa
 *     datos existentes.
 *   - NUNCA toca precio, costo, stock, status, marca, nombre, oem, etc.
 *   - IDEMPOTENTE: tras la primera corrida el UPDATE afecta 0 filas (la guarda
 *     de "vacío" deja de cumplirse), así que es seguro correrlo en cada arranque.
 */

type Ficha = {
  base: string;
  specs: { label: string; value: string }[] | null;
  image: string | null;
};

export async function backfillApymsaFichas(): Promise<void> {
  const data = fichaData as Ficha[];
  if (!Array.isArray(data) || data.length === 0) return;

  try {
    const json = JSON.stringify(data);
    const res = await db.execute<{ n: number }>(sql`
      WITH d AS (
        SELECT
          x.base,
          -- CASE anidado: jsonb_array_length() SOLO se evalúa dentro de la rama
          -- 'array', así no depende del cortocircuito del AND (que SQL no
          -- garantiza) para no llamarse sobre un jsonb no-array.
          CASE jsonb_typeof(x.specs)
            WHEN 'array' THEN
              CASE WHEN jsonb_array_length(x.specs) > 0 THEN x.specs ELSE NULL END
            ELSE NULL
          END AS specs,
          NULLIF(x.image, '') AS image
        FROM jsonb_to_recordset(${json}::jsonb)
          AS x(base text, specs jsonb, image text)
      ),
      upd AS (
        UPDATE products p SET
          specs = CASE
            WHEN (p.specs IS NULL OR p.specs = '[]'::jsonb) AND d.specs IS NOT NULL
            THEN d.specs ELSE p.specs END,
          image = CASE
            WHEN (p.image IS NULL OR p.image = '') AND d.image IS NOT NULL
            THEN d.image ELSE p.image END
        FROM d
        WHERE regexp_replace(p.sku, '-[A-Za-z0-9]+$', '') = d.base
          AND (
            ((p.specs IS NULL OR p.specs = '[]'::jsonb) AND d.specs IS NOT NULL)
            OR ((p.image IS NULL OR p.image = '') AND d.image IS NOT NULL)
          )
        RETURNING 1
      )
      SELECT count(*)::int AS n FROM upd
    `);

    const n = (res as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0;
    if (n > 0) {
      logger.info(
        { filled: n, source: data.length },
        "apymsa-fichas: campos rellenados (aditivo)",
      );
    } else {
      logger.info(
        { source: data.length },
        "apymsa-fichas: nada que rellenar (ya aplicado)",
      );
    }
  } catch (err) {
    logger.error({ err }, "apymsa-fichas: backfill falló (no fatal)");
  }
}
