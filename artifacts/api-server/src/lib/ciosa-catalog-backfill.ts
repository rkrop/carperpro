import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";
import catalogData from "../data/ciosa-catalog.json";

/**
 * Carga ADITIVA del catálogo de GRUPO CIOSA versionado en
 * `src/data/ciosa-catalog.json` (1,032 códigos del Excel del proveedor, con
 * fotos públicas de ciosa.com resueltas por su "Código XML").
 *
 * Por qué vive aquí y no en un script suelto: producción es una base SEPARADA y
 * de solo lectura para el agente. Igual que `apymsa-ficha-backfill`, los datos se
 * versionan en código y este cargador los aplica en CUALQUIER base a la que el
 * servidor se conecte (dev o prod), de modo que un `publish` los lleve a
 * producción al arrancar. Se auto-repara: si el importador maestro borra un
 * producto Ciosa, el siguiente arranque lo vuelve a insertar.
 *
 * REGLAS (no negociables):
 *   - ALTA de los códigos NUEVOS (que no existen por id ni por sku_base Ciosa),
 *     respetando la regla NUNCA-PRECIO-0 ya aplicada al construir el JSON
 *     (venta>0 → venta; si no costo*1.30 → "Estimado"; si no → sin_precio/oculto).
 *     erp_stock_qty = NULL (stock DESCONOCIDO ⇒ visible), nunca 0 (ocultaría).
 *   - RELLENO ADITIVO de los EXISTENTES: solo campos vacíos (image, descripciones,
 *     clave_sat, sku_proveedor, marca si era SIN MARCA, categoría/sublínea si era
 *     NULL). NUNCA toca precio, costo, status, stock ni nombre.
 *   - El emparejado por sku_base se limita a productos GRUPO CIOSA (o sin
 *     proveedor) para no contaminar otros proveedores que compartan código base.
 *   - IDEMPOTENTE: en el segundo arranque el INSERT no encuentra nuevos y el
 *     UPDATE no encuentra huecos, así que ambos afectan 0 filas.
 */

type Rec = {
  id: string;
  sku: string;
  skuBase: string;
  name: string;
  brand: string;
  linea: string | null;
  sublinea: string | null;
  price: number;
  priceSource: string | null;
  status: string;
  costo: number | null;
  proveedor: string;
  skuProveedor: string | null;
  claveSat: string | null;
  descripcionEcommerce: string | null;
  descripcionAdicional: string | null;
  image: string | null;
};

function slugify(name: string): string {
  return String(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normName(name: string): string {
  return String(name ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

export async function backfillCiosaCatalog(): Promise<void> {
  const data = catalogData as Rec[];
  if (!Array.isArray(data) || data.length === 0) return;

  try {
    // ── 1. Líneas (categories): empatar por nombre, crear las faltantes ────────
    const cats = await db.execute<{ id: string; name: string }>(
      sql`SELECT id, name FROM categories`,
    );
    const catByName = new Map<string, string>();
    for (const r of cats.rows) catByName.set(normName(r.name), r.id);

    const missingCats = new Map<string, string>();
    for (const p of data) {
      if (!p.linea) continue;
      const k = normName(p.linea);
      if (!catByName.has(k) && !missingCats.has(k)) missingCats.set(k, p.linea);
    }
    for (const [k, raw] of missingCats) {
      const id = "cat-" + slugify(raw);
      await db.execute(sql`
        INSERT INTO categories(id, name, icon, count)
        VALUES(${id}, ${raw}, 'cog-outline', 0)
        ON CONFLICT(id) DO UPDATE SET name = EXCLUDED.name
      `);
      catByName.set(k, id);
    }

    // ── 2. Sublíneas (subcategories): id determinístico línea+sublínea ─────────
    const subSeen = new Set<string>();
    for (const p of data) {
      if (!p.linea || !p.sublinea) continue;
      const catId = catByName.get(normName(p.linea));
      if (!catId) continue;
      const subId = `sub-${slugify(p.linea)}-${slugify(p.sublinea)}`;
      if (subSeen.has(subId)) continue;
      subSeen.add(subId);
      await db.execute(sql`
        INSERT INTO subcategories(id, category_id, name, count)
        VALUES(${subId}, ${catId}, ${p.sublinea}, 0)
        ON CONFLICT(id) DO UPDATE SET
          category_id = EXCLUDED.category_id, name = EXCLUDED.name
      `);
    }

    // ── 3. Anotar cada registro con su categoryId / subcategoryId ──────────────
    const enriched = data.map((p) => {
      const categoryId = p.linea ? catByName.get(normName(p.linea)) ?? null : null;
      const subcategoryId =
        p.linea && p.sublinea && categoryId
          ? `sub-${slugify(p.linea)}-${slugify(p.sublinea)}`
          : null;
      return { ...p, categoryId, subcategoryId };
    });
    const json = JSON.stringify(enriched);

    // ── 4. ALTA de códigos nuevos (ni id ni sku_base Ciosa existentes) ─────────
    const ins = await db.execute<{ n: number }>(sql`
      WITH x AS (
        SELECT * FROM jsonb_to_recordset(${json}::jsonb) AS t(
          id text, sku text, name text, brand text,
          "categoryId" text, "subcategoryId" text, sublinea text,
          price double precision, "priceSource" text, status text,
          costo double precision, proveedor text, "skuProveedor" text,
          "claveSat" text, "descripcionEcommerce" text,
          "descripcionAdicional" text, image text, "skuBase" text
        )
      ),
      ins AS (
        INSERT INTO products(
          id, sku, name, brand, category_id, subcategory_id, sub_linea,
          price, price_source, status, costo, proveedor, sku_proveedor,
          clave_sat, descripcion_ecommerce, descripcion_adicional, image,
          erp_stock_qty, specs, compatible, vehicles, updated_at
        )
        SELECT
          x.id, x.sku, x.name, x.brand, x."categoryId", x."subcategoryId",
          x.sublinea, x.price, x."priceSource", x.status, x.costo, x.proveedor,
          x."skuProveedor", x."claveSat", x."descripcionEcommerce",
          x."descripcionAdicional", x.image,
          NULL, '[]'::jsonb, false, '{}'::text[], now()
        FROM x
        WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.id = x.id)
          AND NOT EXISTS (
            SELECT 1 FROM products p
            WHERE p.sku_base = x."skuBase"
              AND (p.proveedor = 'GRUPO CIOSA' OR p.proveedor IS NULL)
          )
        ON CONFLICT(id) DO NOTHING
        RETURNING 1
      )
      SELECT count(*)::int AS n FROM ins
    `);
    const inserted = (ins as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0;

    // ── 5. RELLENO ADITIVO de existentes (solo huecos; nunca precio/stock) ─────
    // Se hace en DOS fases deterministas en vez de un solo `WHERE p.id = x.id OR
    // p.sku_base = x.skuBase`: con códigos que comparten base, el OR permitiría que
    // varias filas de origen empaten un mismo producto y Postgres elegiría una
    // arbitraria (fan-out). Fase A empata por id (origen único por id); Fase B
    // empata por sku_base usando un origen DISTINCT ON (skuBase) que conserva la
    // fila más rica, de modo que cada base aparece una sola vez. Ambas solo rellenan
    // huecos, así que un producto tocado en A puede completar huecos restantes en B
    // sin pisar datos legítimos.
    const SET_FILL = sql`
      image = CASE WHEN (p.image IS NULL OR p.image = '') AND x.image IS NOT NULL
                   THEN x.image ELSE p.image END,
      descripcion_ecommerce = COALESCE(NULLIF(p.descripcion_ecommerce, ''), x."descripcionEcommerce", p.descripcion_ecommerce),
      descripcion_adicional = COALESCE(NULLIF(p.descripcion_adicional, ''), x."descripcionAdicional", p.descripcion_adicional),
      clave_sat = COALESCE(NULLIF(p.clave_sat, ''), x."claveSat", p.clave_sat),
      sku_proveedor = COALESCE(NULLIF(p.sku_proveedor, ''), x."skuProveedor", p.sku_proveedor),
      brand = CASE WHEN (p.brand IS NULL OR p.brand = 'SIN MARCA')
                        AND x.brand IS NOT NULL AND x.brand <> 'SIN MARCA'
                   THEN x.brand ELSE p.brand END,
      category_id = COALESCE(p.category_id, x."categoryId"),
      subcategory_id = COALESCE(p.subcategory_id, x."subcategoryId"),
      sub_linea = COALESCE(NULLIF(p.sub_linea, ''), x.sublinea, p.sub_linea)
    `;
    const HAS_HOLE = sql`(
      ((p.image IS NULL OR p.image = '') AND x.image IS NOT NULL)
      OR ((p.descripcion_ecommerce IS NULL OR p.descripcion_ecommerce = '') AND x."descripcionEcommerce" IS NOT NULL)
      OR ((p.descripcion_adicional IS NULL OR p.descripcion_adicional = '') AND x."descripcionAdicional" IS NOT NULL)
      OR ((p.clave_sat IS NULL OR p.clave_sat = '') AND x."claveSat" IS NOT NULL)
      OR ((p.sku_proveedor IS NULL OR p.sku_proveedor = '') AND x."skuProveedor" IS NOT NULL)
      OR ((p.brand IS NULL OR p.brand = 'SIN MARCA') AND x.brand IS NOT NULL AND x.brand <> 'SIN MARCA')
      OR (p.category_id IS NULL AND x."categoryId" IS NOT NULL)
      OR (p.subcategory_id IS NULL AND x."subcategoryId" IS NOT NULL)
      OR ((p.sub_linea IS NULL OR p.sub_linea = '') AND x.sublinea IS NOT NULL)
    )`;
    const RECORDSET = sql`jsonb_to_recordset(${json}::jsonb) AS t(
      id text, "skuBase" text, brand text,
      "categoryId" text, "subcategoryId" text, sublinea text,
      "skuProveedor" text, "claveSat" text,
      "descripcionEcommerce" text, "descripcionAdicional" text, image text
    )`;

    // Fase A — empate exacto por id (origen único por id).
    const updById = await db.execute<{ n: number }>(sql`
      WITH x AS (SELECT * FROM ${RECORDSET}),
      upd AS (
        UPDATE products p SET ${SET_FILL}
        FROM x
        WHERE p.id = x.id AND ${HAS_HOLE}
        RETURNING 1
      )
      SELECT count(*)::int AS n FROM upd
    `);
    const filledById = (updById as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0;

    // Fase B — empate por sku_base (solo proveedor Ciosa o sin proveedor), con
    // origen colapsado a una fila por base (la más rica) para evitar el fan-out.
    const updByBase = await db.execute<{ n: number }>(sql`
      WITH x AS (
        SELECT DISTINCT ON (t."skuBase") t.*
        FROM ${RECORDSET}
        ORDER BY t."skuBase",
          (t.image IS NOT NULL) DESC,
          (t."descripcionAdicional" IS NOT NULL) DESC,
          (t."descripcionEcommerce" IS NOT NULL) DESC,
          (t.brand IS NOT NULL AND t.brand <> 'SIN MARCA') DESC,
          (t."claveSat" IS NOT NULL) DESC,
          t.id
      ),
      upd AS (
        UPDATE products p SET ${SET_FILL}
        FROM x
        WHERE p.sku_base = x."skuBase"
          AND (p.proveedor = 'GRUPO CIOSA' OR p.proveedor IS NULL)
          AND ${HAS_HOLE}
        RETURNING 1
      )
      SELECT count(*)::int AS n FROM upd
    `);
    const filledByBase = (updByBase as unknown as { rows: { n: number }[] }).rows[0]?.n ?? 0;
    const filled = filledById + filledByBase;

    // ── 6. Recalcular contadores solo si hubo altas (mantiene UI exacta) ───────
    if (inserted > 0) {
      await db.execute(sql`
        UPDATE categories SET count = (
          SELECT count(*) FROM products
          WHERE products.category_id = categories.id AND products.status <> 'sin_precio'
        )
      `);
      await db.execute(sql`
        UPDATE subcategories SET count = (
          SELECT count(*) FROM products
          WHERE products.subcategory_id = subcategories.id AND products.status <> 'sin_precio'
        )
      `);
    }

    if (inserted > 0 || filled > 0) {
      logger.info(
        { inserted, filled, source: data.length },
        "ciosa-catalog: altas + relleno aditivo aplicados",
      );
    } else {
      logger.info(
        { source: data.length },
        "ciosa-catalog: nada que aplicar (ya sincronizado)",
      );
    }
  } catch (err) {
    logger.error({ err }, "ciosa-catalog: backfill falló (no fatal)");
  }
}
