/**
 * FASE 1 — Importación del INVENTARIO MAESTRO (carga manual).
 *
 *   node import-maestro.mjs            # importa (con guardas)
 *   node import-maestro.mjs --dry-run  # calcula y reporta, sin escribir
 *   node import-maestro.mjs --force    # ignora las guardas de seguridad
 *
 * El maestro (attached_assets/INVENTARIO_MAESTRO_*.xlsx, hoja "MAESTRO") es UNA
 * fila por producto y es la FUENTE DE VERDAD del catálogo. Este importador:
 *
 *   1. Hace upsert de cada producto por id = Código (la IDENTIDAD es el código,
 *      igual que los webhooks de FASE 2, para que ambos converjan en la misma
 *      fila). El trigger deriva sku_base/proveedor_sufijo del sku.
 *   2. Aplica la regla NUNCA-PRECIO-0: si "Precio Venta" > 0 se usa (fuente =
 *      columna "Fuente Precio"); si no, se estima de "Costo" * 1.30 (fuente
 *      "Estimado"); si no hay ninguno, status = 'sin_precio' (oculto en catálogo).
 *   3. Guarda el desglose inicial por almacén en product_stock_inicial
 *      (001 = Matriz, 005 = Bodega) y deja erp_stock_qty = Disp. Matriz + Bodega.
 *   4. Crea/empata líneas (categories) y sublíneas (subcategories) por nombre.
 *   5. Es un ESPEJO EXACTO: borra todo producto que NO esté en el maestro y limpia
 *      stock inicial / inventario huérfano y sucursales que no sean "matriz".
 *   6. Recalcula los contadores de categorías y sublíneas.
 *
 * Preserva el enriquecimiento que el maestro no trae (descripcion AI, oem,
 * vehicles, original_price, specs, e image cuando el maestro no trae URL).
 */
import { createRequire } from "module";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const { Pool } = require("../../lib/db/node_modules/pg/lib/index.js");
const ExcelJS = require("exceljs");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const MASTER_FILE = "INVENTARIO_MAESTRO_1780532154007.xlsx";
const SHEET = "MAESTRO";

// Almacenes del modelo de una sola tienda.
const ALMACEN_MATRIZ = "001";
const ALMACEN_BODEGA = "005";

// Regla "nunca precio 0": cuando no hay precio de venta se estima del costo.
const ESTIMATED_PRICE_MARKUP = 1.3;

// ── Guardas para la fase destructiva (espejo exacto) ──────────────────────────
const MIN_PRODUCTS = 5000;
const MAX_DELETE_PCT = 0.7;
const FORCE = process.argv.includes("--force") || process.env.SEED_FORCE === "1";
const DRY_RUN =
  process.argv.includes("--dry-run") || process.env.SEED_DRY_RUN === "1";

/** Repara UTF-8 doble-codificado (mojibake Latin-1), validado por roundtrip. */
function fixEncoding(value) {
  if (typeof value !== "string" || value.length === 0) return value;
  let decoded;
  try {
    decoded = Buffer.from(value, "latin1").toString("utf8");
  } catch {
    return value;
  }
  if (
    decoded !== value &&
    !decoded.includes("\uFFFD") &&
    Buffer.from(decoded, "utf8").toString("latin1") === value
  ) {
    return decoded;
  }
  return value;
}

function slugify(name) {
  return String(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Normaliza un nombre para empatar contra categorías existentes. */
function normName(name) {
  return fixEncoding(String(name ?? ""))
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function num(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function str(v) {
  if (v === null || v === undefined) return "";
  return fixEncoding(String(v).trim());
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Regla NUNCA-PRECIO-0 (idéntica a resolvePrice() en src/lib/admintotal/sku.ts).
 * Devuelve { price, priceSource, status }.
 */
function resolvePrice(precio, costo, sourceWhenValid) {
  const p = num(precio);
  const c = num(costo);
  if (p > 0) return { price: round2(p), priceSource: sourceWhenValid, status: "activo" };
  if (c > 0)
    return {
      price: round2(c * ESTIMATED_PRICE_MARKUP),
      priceSource: "Estimado",
      status: "activo",
    };
  return { price: 0, priceSource: null, status: "sin_precio" };
}

async function main() {
  // ── 1. Leer el maestro ──────────────────────────────────────────────────────
  const filePath = resolve(__dirname, "../../attached_assets/", MASTER_FILE);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(readFileSync(filePath));
  const ws = wb.getWorksheet(SHEET) ?? wb.worksheets[0];

  const headers = [];
  const rows = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        headers[colNumber] = cell.value != null ? String(cell.value) : null;
      });
    } else {
      const obj = {};
      headers.forEach((header, colNumber) => {
        if (header) {
          const cell = row.getCell(colNumber);
          let v = cell.value;
          if (v && typeof v === "object" && "result" in v) v = v.result;
          obj[header] = v ?? null;
        }
      });
      rows.push(obj);
    }
  });

  console.log(`Leídas ${rows.length} filas de ${MASTER_FILE} (hoja ${SHEET}).`);

  const products = [];
  const seen = new Set();
  let dupSkipped = 0;
  let sinPrecio = 0;
  let conStock = 0;

  for (const row of rows) {
    const code = str(row["Código"]);
    if (!code) continue;
    if (seen.has(code)) {
      dupSkipped += 1;
      continue;
    }
    seen.add(code);

    const name = str(row["Descripción"]) || code;
    const marca = str(row["Marca"]);
    const linea = str(row["Línea"]);
    const sublinea = str(row["SubLínea"]);

    const existMatriz = Math.max(0, Math.round(num(row["Exist. Matriz"])));
    const existBodega = Math.max(0, Math.round(num(row["Exist. Bodega"])));
    const dispMatriz = Math.max(0, Math.round(num(row["Disp. Matriz"])));
    const dispBodega = Math.max(0, Math.round(num(row["Disp. Bodega"])));
    const erpStockQty = dispMatriz + dispBodega;
    if (erpStockQty > 0) conStock += 1;

    const fuentePrecio = str(row["Fuente Precio"]) || "Maestro";
    const { price, priceSource, status } = resolvePrice(
      num(row["Precio Venta"]),
      num(row["Costo"]),
      fuentePrecio,
    );
    if (status === "sin_precio") sinPrecio += 1;

    products.push({
      id: code,
      sku: code,
      name,
      brand: marca || "SIN MARCA",
      linea,
      sublinea,
      price,
      priceSource,
      status,
      costo: num(row["Costo"]) > 0 ? round2(num(row["Costo"])) : null,
      proveedor: str(row["Proveedor"]) || null,
      skuProveedor: str(row["Código Proveedor"]) || null,
      codigoBarras: str(row["Código Barras"]) || null,
      claveSat: str(row["ClaveProdServ (SAT)"]) || null,
      descripcionEcommerce: str(row["Descripción e-commerce"]) || null,
      descripcionAdicional: str(row["Descripción Adicional"]) || null,
      image: str(row["Imagen (URL)"]) || null,
      erpStockQty,
      existMatriz,
      existBodega,
      dispMatriz,
      dispBodega,
    });
  }

  console.log(
    `Productos únicos: ${products.length} ` +
      `(con stock: ${conStock}, sin precio/ocultos: ${sinPrecio}, ` +
      `duplicados omitidos: ${dupSkipped}).`,
  );

  // Guarda 1: maestro implausiblemente pequeño => abortar para no vaciar catálogo.
  if (products.length < MIN_PRODUCTS && !FORCE) {
    throw new Error(
      `Abortando: solo ${products.length} productos (< MIN_PRODUCTS=${MIN_PRODUCTS}). ` +
        `Revisa el Excel. Usa --force para forzar.`,
    );
  }

  const client = await pool.connect();
  try {
    // Guarda 2 + dry-run ANTES de cualquier escritura: así un dry-run es
    // realmente de solo lectura y no toca categorías/sublíneas/trigger.
    const totalRes = await client.query(`SELECT count(*)::int AS n FROM products`);
    const currentTotal = totalRes.rows[0].n;
    const existingRes = await client.query(
      `SELECT count(*)::int AS n FROM products WHERE id = ANY($1::text[])`,
      [products.map((p) => p.id)],
    );
    const existingMatched = existingRes.rows[0].n;
    const wouldDelete = Math.max(0, currentTotal - existingMatched);
    const deletePct = currentTotal > 0 ? wouldDelete / currentTotal : 0;
    console.log(
      `Plan: ${products.length} upserts (${existingMatched} existentes, ` +
        `${products.length - existingMatched} nuevos), ${wouldDelete} borrados ` +
        `(${(deletePct * 100).toFixed(1)}% de ${currentTotal}).`,
    );
    if (deletePct > MAX_DELETE_PCT && !FORCE) {
      throw new Error(
        `Abortando: el borrado quitaría ${(deletePct * 100).toFixed(1)}% del ` +
          `catálogo (> ${MAX_DELETE_PCT * 100}%). Usa --force para forzar.`,
      );
    }
    if (DRY_RUN) {
      console.log("Dry run — no se escribió nada. Saliendo.");
      return;
    }

    // ── 2. Tienda única ───────────────────────────────────────────────────────
    await client.query(
      `INSERT INTO sucursales(id, name, address, city, hours)
       VALUES($1,$2,$3,$4,$5)
       ON CONFLICT(id) DO UPDATE SET
         name=EXCLUDED.name, address=EXCLUDED.address,
         city=EXCLUDED.city, hours=EXCLUDED.hours`,
      [
        "matriz",
        "Carper Autopartes",
        "Blvd. Ignacio Ramírez 290, Ciudad Obregón, Sonora, CP 85160",
        "Ciudad Obregón, Sonora",
        "Lun-Vie 8:00-18:00 · Sáb 8:00-14:00",
      ],
    );

    // ── 3. Líneas (categories): empatar por nombre, crear las faltantes ────────
    const catRes = await client.query(`SELECT id, name FROM categories`);
    const catByName = new Map();
    for (const r of catRes.rows) catByName.set(normName(r.name), r.id);

    const missingLineas = new Map(); // norm -> raw
    for (const p of products) {
      if (!p.linea) continue;
      const key = normName(p.linea);
      if (!catByName.has(key) && !missingLineas.has(key))
        missingLineas.set(key, p.linea);
    }
    for (const [key, raw] of missingLineas) {
      const id = "cat-" + slugify(raw);
      await client.query(
        `INSERT INTO categories(id, name, icon, count)
         VALUES($1,$2,'cog-outline',0)
         ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name`,
        [id, raw],
      );
      catByName.set(key, id);
    }

    // ── 4. Sublíneas (subcategories): id estable derivado de línea+sublínea ────
    // El maestro solo trae el NOMBRE de la sublínea, así que generamos un id
    // determinístico. La ruta /subcategories cuenta en vivo por join, así que
    // cualquier id estable sirve mientras products.subcategory_id lo referencie.
    const subById = new Map(); // subId -> {categoryId, name}
    for (const p of products) {
      const categoryId = p.linea ? catByName.get(normName(p.linea)) ?? null : null;
      p.categoryId = categoryId;
      p.subcategoryId = null;
      if (categoryId && p.sublinea) {
        const subId = `sub-${slugify(p.linea)}-${slugify(p.sublinea)}`;
        p.subcategoryId = subId;
        if (!subById.has(subId))
          subById.set(subId, { categoryId, name: p.sublinea });
      }
    }
    for (const [subId, sc] of subById) {
      await client.query(
        `INSERT INTO subcategories(id, category_id, name, count)
         VALUES($1,$2,$3,0)
         ON CONFLICT(id) DO UPDATE SET
           category_id=EXCLUDED.category_id, name=EXCLUDED.name`,
        [subId, sc.categoryId, sc.name],
      );
    }
    console.log(
      `Líneas: ${catByName.size} (nuevas: ${missingLineas.size}), ` +
        `sublíneas: ${subById.size}.`,
    );

    // ── 5. Trigger de search_vector (incluye sku_base/proveedor_sufijo) ────────
    // Recrearlo antes de los upserts garantiza que cada fila se (re)indexe con la
    // definición vigente. MANTENER EN SINCRONÍA con src/lib/ensure-search-trigger.ts.
    await client.query(`
      CREATE OR REPLACE FUNCTION products_search_vector_update() RETURNS trigger AS $$
        BEGIN
          NEW.sku_base := upper(regexp_replace(split_part(coalesce(NEW.sku, ''), '-', 1), '[[:space:]]+', '', 'g'));
          NEW.proveedor_sufijo := nullif(trim(substring(coalesce(NEW.sku, '') from '-(.*)$')), '');
          NEW.search_vector :=
            setweight(to_tsvector('simple', unaccent(coalesce(NEW.sku_base, ''))), 'A') ||
            setweight(to_tsvector('simple', unaccent(coalesce(NEW.sku, ''))), 'A') ||
            setweight(to_tsvector('simple', unaccent(coalesce(NEW.name, ''))), 'A') ||
            setweight(to_tsvector('simple', unaccent(coalesce(NEW.brand, ''))), 'B') ||
            setweight(to_tsvector('simple', unaccent(coalesce(NEW.descripcion_ecommerce, ''))), 'C') ||
            setweight(to_tsvector('simple', unaccent(coalesce(NEW.descripcion_adicional, ''))), 'C') ||
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
      $$ LANGUAGE plpgsql;
    `);
    await client.query(`DROP TRIGGER IF EXISTS products_search_trigger ON products`);
    await client.query(`
      CREATE TRIGGER products_search_trigger BEFORE INSERT OR UPDATE ON products
      FOR EACH ROW EXECUTE FUNCTION products_search_vector_update()
    `);

    // ── 6. Upsert de productos (por lotes) ────────────────────────────────────
    const COLS = 19;
    const BATCH = 300;
    let done = 0;
    for (let i = 0; i < products.length; i += BATCH) {
      const chunk = products.slice(i, i + BATCH);
      const values = [];
      const params = [];
      chunk.forEach((p, j) => {
        const b = j * COLS;
        const ph = Array.from({ length: COLS }, (_, k) => `$${b + k + 1}`);
        values.push(
          `(${ph.join(",")},now(),'[]'::jsonb,false,'{}'::text[],now())`,
        );
        params.push(
          p.id, // 1 id
          p.sku, // 2 sku
          p.name, // 3 name
          p.brand, // 4 brand
          p.categoryId, // 5 category_id
          p.subcategoryId, // 6 subcategory_id
          p.sublinea || null, // 7 sub_linea
          p.price, // 8 price
          p.priceSource, // 9 price_source
          p.status, // 10 status
          p.costo, // 11 costo
          p.proveedor, // 12 proveedor
          p.skuProveedor, // 13 sku_proveedor
          p.codigoBarras, // 14 codigo_barras
          p.claveSat, // 15 clave_sat
          p.descripcionEcommerce, // 16 descripcion_ecommerce
          p.descripcionAdicional, // 17 descripcion_adicional
          p.image, // 18 image
          p.erpStockQty, // 19 erp_stock_qty
        );
      });
      await client.query(
        `INSERT INTO products
           (id, sku, name, brand, category_id, subcategory_id, sub_linea, price,
            price_source, status, costo, proveedor, sku_proveedor, codigo_barras,
            clave_sat, descripcion_ecommerce, descripcion_adicional, image,
            erp_stock_qty, stock_updated_at, specs, compatible, vehicles, updated_at)
         VALUES ${values.join(",")}
         ON CONFLICT(id) DO UPDATE SET
           sku=EXCLUDED.sku,
           name=EXCLUDED.name,
           brand=CASE WHEN EXCLUDED.brand <> 'SIN MARCA' THEN EXCLUDED.brand ELSE products.brand END,
           category_id=EXCLUDED.category_id,
           subcategory_id=EXCLUDED.subcategory_id,
           sub_linea=EXCLUDED.sub_linea,
           price=EXCLUDED.price,
           price_source=EXCLUDED.price_source,
           status=EXCLUDED.status,
           costo=EXCLUDED.costo,
           proveedor=COALESCE(EXCLUDED.proveedor, products.proveedor),
           sku_proveedor=COALESCE(EXCLUDED.sku_proveedor, products.sku_proveedor),
           codigo_barras=COALESCE(EXCLUDED.codigo_barras, products.codigo_barras),
           clave_sat=COALESCE(EXCLUDED.clave_sat, products.clave_sat),
           descripcion_ecommerce=COALESCE(EXCLUDED.descripcion_ecommerce, products.descripcion_ecommerce),
           descripcion_adicional=COALESCE(EXCLUDED.descripcion_adicional, products.descripcion_adicional),
           image=COALESCE(EXCLUDED.image, products.image),
           erp_stock_qty=EXCLUDED.erp_stock_qty,
           stock_updated_at=now(),
           updated_at=now()`,
        params,
      );
      done += chunk.length;
      process.stdout.write(`  upsert ${done}/${products.length}\r`);
    }
    console.log(`\nUpsert de ${products.length} productos.`);

    // ── 7. Stock inicial por almacén (001 Matriz, 005 Bodega) ─────────────────
    const SCOLS = 4;
    const SBATCH = 300;
    let sdone = 0;
    for (let i = 0; i < products.length; i += SBATCH) {
      const chunk = products.slice(i, i + SBATCH);
      const values = [];
      const params = [];
      let n = 0;
      for (const p of chunk) {
        for (const a of [
          { id: ALMACEN_MATRIZ, ex: p.existMatriz, di: p.dispMatriz },
          { id: ALMACEN_BODEGA, ex: p.existBodega, di: p.dispBodega },
        ]) {
          const b = n * SCOLS;
          values.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},now())`);
          params.push(p.id, a.id, a.ex, a.di);
          n += 1;
        }
      }
      await client.query(
        `INSERT INTO product_stock_inicial
           (product_id, almacen_id, existencia, disponible, imported_at)
         VALUES ${values.join(",")}
         ON CONFLICT(product_id, almacen_id) DO UPDATE SET
           existencia=EXCLUDED.existencia,
           disponible=EXCLUDED.disponible,
           imported_at=now()`,
        params,
      );
      sdone += chunk.length;
      process.stdout.write(`  stock inicial ${sdone}/${products.length}\r`);
    }
    console.log(`\nStock inicial cargado para ${products.length} productos.`);

    // ── 8. Espejo exacto: borrar lo que no está en el maestro ─────────────────
    await client.query(`CREATE TEMP TABLE keep_ids(id text PRIMARY KEY)`);
    const keepIds = products.map((p) => p.id);
    for (let i = 0; i < keepIds.length; i += BATCH) {
      const chunk = keepIds.slice(i, i + BATCH);
      const values = chunk.map((_, j) => `($${j + 1})`).join(",");
      await client.query(
        `INSERT INTO keep_ids(id) VALUES ${values} ON CONFLICT DO NOTHING`,
        chunk,
      );
    }
    const del = await client.query(
      `DELETE FROM products WHERE id NOT IN (SELECT id FROM keep_ids)`,
    );
    console.log(`Borrados ${del.rowCount} productos ausentes del maestro.`);

    // Limpiar stock inicial / inventario huérfano y sucursales que no sean matriz.
    await client.query(
      `DELETE FROM product_stock_inicial WHERE product_id NOT IN (SELECT id FROM products)`,
    );
    await client.query(`DELETE FROM inventory WHERE sucursal_id <> 'matriz'`);
    await client.query(`DELETE FROM sucursales WHERE id <> 'matriz'`);
    await client.query(
      `DELETE FROM inventory WHERE product_id NOT IN (SELECT id FROM products)`,
    );
    // Sublíneas sin productos quedan huérfanas; eliminarlas para mantener limpio.
    await client.query(
      `DELETE FROM subcategories WHERE id NOT IN (
         SELECT DISTINCT subcategory_id FROM products WHERE subcategory_id IS NOT NULL
       )`,
    );

    // ── 9. Recalcular contadores ──────────────────────────────────────────────
    await client.query(
      `UPDATE categories SET count = (
         SELECT count(*) FROM products
         WHERE products.category_id = categories.id AND products.status <> 'sin_precio'
       )`,
    );
    await client.query(
      `UPDATE subcategories SET count = (
         SELECT count(*) FROM products
         WHERE products.subcategory_id = subcategories.id AND products.status <> 'sin_precio'
       )`,
    );

    // ── 10. Reporte final ─────────────────────────────────────────────────────
    const totals = await client.query(`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE status <> 'sin_precio')::int AS visibles,
        count(*) FILTER (WHERE status = 'sin_precio')::int AS sin_precio,
        count(*) FILTER (WHERE price_source = 'Estimado')::int AS estimados,
        count(*) FILTER (WHERE erp_stock_qty > 0)::int AS con_stock,
        count(*) FILTER (WHERE sku_base IS NOT NULL AND sku_base <> '')::int AS con_sku_base
      FROM products
    `);
    const t = totals.rows[0];
    console.log(
      `\nListo ✓  Catálogo: ${t.total} productos ` +
        `(visibles: ${t.visibles}, sin precio/ocultos: ${t.sin_precio}, ` +
        `precio estimado: ${t.estimados}, con stock: ${t.con_stock}, ` +
        `sku_base poblado: ${t.con_sku_base}).`,
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
