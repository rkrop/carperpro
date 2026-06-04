import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";

/**
 * Detecta si la base de datos contiene datos del ERP antiguo (más productos de
 * los que el archivo maestro puede proveer, o demasiados con price=0) y, si es
 * así, ejecuta el importador maestro para limpiar el catálogo.
 *
 * El archivo maestro (INVENTARIO_MAESTRO.xlsx) es la ÚNICA fuente de verdad del
 * catálogo. Esta función garantiza que producción quede igual que si se hubiera
 * corrido `node import-maestro.mjs` manualmente.
 *
 * Es idempotente: si el catálogo ya está limpio (≤ MAX_MASTER_PRODUCTS y
 * < 5% con precio cero), no hace nada.
 */

// El maestro tiene ~13,905 productos. Más de 15,000 = datos sucios del ERP.
const MAX_MASTER_PRODUCTS = 15_000;
// Más del 5% con price=0 = datos sucios (regla "nunca precio 0" no aplicada).
const MAX_ZERO_PRICE_RATIO = 0.05;

let _running = false;

export async function autoImportIfDirty(): Promise<void> {
  if (_running) {
    logger.info("catalog: importación ya en curso, saltando");
    return;
  }

  let total = 0;
  let zeroPriceCount = 0;

  try {
    const res = await db.execute<{ total: number; zero_price: number }>(sql`
      SELECT
        count(*)::int                                                            AS total,
        count(*) FILTER (WHERE price = 0 OR price IS NULL)::int                 AS zero_price
      FROM products
    `);
    const row = (res as unknown as { rows: { total: number; zero_price: number }[] }).rows[0];
    total = row?.total ?? 0;
    zeroPriceCount = row?.zero_price ?? 0;
  } catch (err) {
    logger.error({ err }, "catalog: no se pudo consultar el estado del catálogo");
    return;
  }

  const hasTooMany = total > MAX_MASTER_PRODUCTS;
  const hasBadPrices =
    total > 0 && zeroPriceCount / total > MAX_ZERO_PRICE_RATIO;

  if (!hasTooMany && !hasBadPrices) {
    logger.info(
      { total },
      "catalog: catálogo limpio (datos del maestro OK)",
    );
    return;
  }

  logger.warn(
    { total, zeroPriceCount, hasTooMany, hasBadPrices },
    "catalog: datos sucios del ERP antiguo detectados — ejecutando importación del maestro Excel…",
  );

  _running = true;
  try {
    await runImportMaestro();
    logger.info("catalog: importación del maestro completada — catálogo limpio");
  } catch (err) {
    logger.error({ err }, "catalog: importación del maestro falló");
  } finally {
    _running = false;
  }
}

function runImportMaestro(): Promise<void> {
  return new Promise((resolve, reject) => {
    // import-maestro.mjs está en el mismo directorio que este archivo (en src/)
    // pero el bundle vive en dist/, por eso subimos un nivel desde __dirname.
    const distDir = dirname(fileURLToPath(import.meta.url));
    const scriptPath = join(distDir, "..", "import-maestro.mjs");

    logger.info({ scriptPath }, "catalog: iniciando import-maestro.mjs --force");

    // --force es necesario: solo llegamos aquí cuando YA detectamos datos sucios
    // del ERP antiguo, y reemplazar el catálogo completo por el maestro implica
    // borrar > 70% (el guardia de seguridad por defecto), lo cual es intencional.
    const child = spawn("node", [scriptPath, "--force"], {
      env: process.env,
      stdio: "pipe",
    });

    child.stdout.on("data", (data: Buffer) => {
      const line = data.toString().trim();
      if (line) logger.info("import-maestro: %s", line);
    });

    child.stderr.on("data", (data: Buffer) => {
      const line = data.toString().trim();
      if (line) logger.error("import-maestro: %s", line);
    });

    child.on("error", reject);

    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`import-maestro.mjs terminó con código ${code}`));
    });
  });
}
