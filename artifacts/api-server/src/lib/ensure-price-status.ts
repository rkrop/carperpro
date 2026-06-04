import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

/**
 * Aplica la regla "nunca precio 0" a todos los productos existentes.
 *
 * Idempotente: solo actualiza productos con price=0/NULL que todavía tienen
 * status='activo'. Corre al arranque para que dev Y prod se auto-sanen,
 * independientemente de cómo llegaron los datos (sync ERP antiguo, webhook
 * sin precio, etc.).
 *
 * Los productos marcados 'sin_precio' quedan ocultos del catálogo via
 * sellableProduct() = status <> 'sin_precio'.
 */
export async function ensurePriceStatus(): Promise<void> {
  const result = await db.execute(sql`
    UPDATE products
    SET status     = 'sin_precio',
        price_source = 'sin_precio'
    WHERE (price IS NULL OR price = 0)
      AND status <> 'sin_precio'
  `);

  const count = (result as { rowCount?: number }).rowCount ?? 0;
  if (count > 0) {
    logger.info(
      { count },
      "price-status: %d producto(s) sin precio marcados como sin_precio",
      count,
    );
  } else {
    logger.info("price-status: todos los productos tienen precio válido");
  }
}
