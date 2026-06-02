/**
 * Seeds the DB from the Excel inventory snapshot.
 * Run: node seed-excel.mjs
 */
import { createRequire } from "module";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// pg from lib/db (shared dep in monorepo)
const { Pool } = require("../../lib/db/node_modules/pg/lib/index.js");
// xlsx from /tmp install
const { read: xlsxRead, utils } = require("/tmp/node_modules/xlsx/xlsx.js");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function slugify(name) {
  return (
    "cat-" +
    String(name)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
  );
}

async function query(text, params) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

async function main() {
  const filePath = resolve(__dirname, "../../attached_assets/inventario_carper_1780375030669.xlsx");
  console.log("Reading Excel:", filePath);

  const buf = readFileSync(filePath);
  const wb = xlsxRead(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows = utils.sheet_to_json(ws, { defval: null });
  console.log(`Loaded ${rawRows.length} rows`);

  // Collect unique categories and brands
  const catMap = new Map();
  const brandSet = new Set();
  for (const row of rawRows) {
    if (row.categoria) catMap.set(slugify(row.categoria), row.categoria);
    if (row.marca) brandSet.add(row.marca);
  }

  // ── 1. Ensure "matriz" sucursal exists ──────────────────────────────────────
  await query(
    `INSERT INTO sucursales(id, name, address, city, hours)
     VALUES($1,$2,$3,$4,$5)
     ON CONFLICT(id) DO NOTHING`,
    ["matriz", "Matriz Centro", "Calle Principal 1", "Monterrey", "Lun-Sáb 8am-7pm"]
  );

  // ── 2. Categories ──────────────────────────────────────────────────────────
  console.log(`Upserting ${catMap.size} categories…`);
  for (const [id, name] of catMap) {
    await query(
      `INSERT INTO categories(id, name, icon, count)
       VALUES($1,$2,'cog-outline',0)
       ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name`,
      [id, name]
    );
  }

  // ── 3. Brands ──────────────────────────────────────────────────────────────
  console.log(`Upserting ${brandSet.size} brands…`);
  for (const name of brandSet) {
    await query(
      `INSERT INTO brands(name) VALUES($1) ON CONFLICT(name) DO NOTHING`,
      [String(name)]
    );
  }

  // ── 4. Products ────────────────────────────────────────────────────────────
  console.log("Upserting products…");
  let inserted = 0, skipped = 0;

  for (const row of rawRows) {
    if (!row.sku || !row.nombre) { skipped++; continue; }

    const id = String(row.sku).trim();
    const name = String(row.nombre).trim();
    const brand = row.marca ? String(row.marca).trim() : "SIN MARCA";
    const categoryId = row.categoria ? slugify(row.categoria) : null;
    const price = typeof row.precio_venta === "number" ? row.precio_venta : 0;
    const costo = typeof row.costo === "number" ? row.costo : null;
    const stock = typeof row.stock === "number" ? Math.max(0, Math.round(row.stock)) : 0;
    const descripcion = row.descripcion ? String(row.descripcion).trim() : null;
    const proveedor = row.proveedor ? String(row.proveedor).trim() : null;
    const skuProveedor = row.sku_proveedor ? String(row.sku_proveedor).trim() : null;
    const imagen_url = row.imagen_url ? String(row.imagen_url).trim() : null;

    await query(
      `INSERT INTO products(id, sku, name, brand, category_id, price, costo,
         proveedor, sku_proveedor, descripcion, image, specs, compatible,
         vehicles, oem, equivalents, updated_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'[]'::jsonb,false,'{}',
              $12, null, now())
       ON CONFLICT(id) DO UPDATE SET
         sku=$2, name=$3, brand=$4, category_id=$5, price=$6,
         costo=$7, proveedor=$8, sku_proveedor=$9,
         descripcion=$10, image=$11, oem=$12`,
      [id, id, name, brand, categoryId, price, costo,
       proveedor, skuProveedor, descripcion, imagen_url,
       row.codigo_oem ? [String(row.codigo_oem)] : null]
    );

    // Inventory
    if (stock > 0) {
      await query(
        `INSERT INTO inventory(product_id, sucursal_id, quantity)
         VALUES($1,'matriz',$2)
         ON CONFLICT(product_id, sucursal_id) DO UPDATE SET quantity=$2`,
        [id, stock]
      );
    }

    inserted++;
    if (inserted % 500 === 0) process.stdout.write(`  ${inserted}/${rawRows.length}\r`);
  }

  // ── 5. Category counts ─────────────────────────────────────────────────────
  console.log(`\nInserted ${inserted}, skipped ${skipped}. Updating category counts…`);
  await query(
    `UPDATE categories SET count = (
       SELECT count(*) FROM products WHERE products.category_id = categories.id
     )`
  );

  // ── 6. Rebuild search_vector (trigger fires on UPDATE, touch all rows) ─────
  console.log("Rebuilding search vectors…");
  await query(`UPDATE products SET updated_at = now()`);

  console.log("Done ✓");
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
