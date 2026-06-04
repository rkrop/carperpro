import { createRequire } from "module";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const { Pool } = require("../../lib/db/node_modules/pg/lib/index.js");
const { utils, writeFile } = require("xlsx");

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../../exports/inventario_carper.xlsx");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const arr = (v) => (Array.isArray(v) ? v.filter(Boolean).join(", ") : v ?? "");

async function main() {
  const { rows } = await pool.query(`
    SELECT
      p.id              AS "Código (SKU)",
      p.name            AS "Nombre",
      p.brand           AS "Marca",
      c.name            AS "Línea",
      p.sub_linea       AS "Sublínea",
      p.price           AS "Precio Venta",
      p.costo           AS "Costo",
      p.price_source    AS "Fuente Precio",
      p.erp_stock_qty   AS "Stock",
      p.status          AS "Estatus",
      p.oem             AS "OEM",
      p.codigo_barras   AS "Código Barras",
      p.clave_sat       AS "Clave SAT",
      p.proveedor       AS "Proveedor",
      p.descripcion     AS "Descripción"
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    ORDER BY c.name NULLS LAST, p.name
  `);

  const data = rows.map((r) => ({ ...r, OEM: arr(r.OEM) }));

  // Hoja 1: productos
  const wb = utils.book_new();
  const ws = utils.json_to_sheet(data);
  utils.book_append_sheet(wb, ws, "MAESTRO");

  // Hoja 2: resumen por línea
  const { rows: resumen } = await pool.query(`
    SELECT
      COALESCE(c.name, '(sin línea)') AS "Línea",
      count(*)                        AS "Productos",
      count(*) FILTER (WHERE p.price > 0) AS "Con precio",
      round(avg(p.price)::numeric, 2) AS "Precio promedio"
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    GROUP BY c.name
    ORDER BY count(*) DESC
  `);
  utils.book_append_sheet(wb, utils.json_to_sheet(resumen), "RESUMEN");

  writeFile(wb, OUT);
  console.log(`Exportados ${data.length} productos a ${OUT}`);
  console.log(`Líneas: ${resumen.length}`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
