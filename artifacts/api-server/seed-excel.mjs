/**
 * Seeds the DB to be an EXACT mirror of the two current Admintotal inventory
 * exports (one file per warehouse: Bodega + Matriz).
 *
 *   node seed-excel.mjs
 *
 * What it does:
 *   1. Aggregates both Excel files by "Código" (the product SKU). A product can
 *      appear in both warehouse files: stock (Disponible) is SUMMED across them,
 *      price/cost take the MAX (one warehouse often exports 0 when no price is
 *      assigned there).
 *   2. Stores the BASE price ("Precio Venta MXN", sin IVA) — the same convention
 *      the ERP sync and the price/stock webhook use. The customer-facing IVA is
 *      added at read time in `effectivePrice`, so the path stays consistent.
 *   3. Matches existing rows by SKU to PRESERVE their Admintotal numeric `id`
 *      (so the ERP sync/webhook keep aligning by id/sku) and their enrichment
 *      (brand, image, descripcion, oem, vehicles, original_price, category).
 *      Only the Excel-provided fields are updated: name, price, costo, proveedor,
 *      sku_proveedor, erp_stock_qty.
 *   4. DELETES every product whose SKU is NOT in the Excel — making the catalog
 *      an exact mirror of the current ERP catalog (removes stale/discontinued
 *      rows that the rate-limited full sync never got to prune).
 */
import { createRequire } from "module";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const { Pool } = require("../../lib/db/node_modules/pg/lib/index.js");
const { read: xlsxRead, utils } = require("xlsx");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const FILES = ["productos-001.xlsx", "productos-005.xlsx"];
const IVA_RATE = 0.16;

// ── Safety guardrails for the destructive (exact-mirror) phase ────────────────
// This script DELETES every product not present in the Excel. If the wrong/empty
// files are passed it could wipe the catalog, so two gates protect a real run:
//   • MIN_PRODUCTS  – abort if the aggregated Excel yields fewer than this.
//   • MAX_DELETE_PCT – abort if the delete would remove more than this share of
//     the current catalog.
// Bypass with `--force` (or SEED_FORCE=1). Preview without writing with
// `--dry-run` (or SEED_DRY_RUN=1).
const MIN_PRODUCTS = 5000;
const MAX_DELETE_PCT = 0.7;
const FORCE = process.argv.includes("--force") || process.env.SEED_FORCE === "1";
const DRY_RUN =
  process.argv.includes("--dry-run") || process.env.SEED_DRY_RUN === "1";

/** Repair double-encoded UTF-8 (Latin-1 mojibake), roundtrip-checked. */
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

/** Normalize a category name for matching against existing ERP categories. */
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
  return v === null || v === undefined ? "" : String(v).trim();
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

async function main() {
  // ── 1. Read + aggregate both warehouse files by Código ──────────────────────
  const map = new Map(); // code -> aggregated product
  for (const f of FILES) {
    const filePath = resolve(__dirname, "../../attached_assets/", f);
    const buf = readFileSync(filePath);
    const wb = xlsxRead(buf, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = utils.sheet_to_json(ws, { defval: null });
    console.log(`Read ${rows.length} rows from ${f}`);

    for (const row of rows) {
      const code = str(row["Código"]);
      if (!code) continue;
      const cur =
        map.get(code) ??
        {
          code,
          name: "",
          linea: "",
          priceBase: 0,
          neto: 0,
          costo: 0,
          stock: 0,
          proveedor: "",
          origen: "",
        };
      const name = fixEncoding(str(row["Descripción"]));
      const linea = fixEncoding(str(row["Línea"]));
      const proveedor = fixEncoding(str(row["Proveedor"]));
      const origen = str(row["Código Origen"]);
      if (name && !cur.name) cur.name = name;
      if (linea && !cur.linea) cur.linea = linea;
      if (proveedor && !cur.proveedor) cur.proveedor = proveedor;
      if (origen && !cur.origen) cur.origen = origen;
      cur.priceBase = Math.max(cur.priceBase, num(row["Precio Venta MXN"]));
      cur.neto = Math.max(cur.neto, num(row["Precio Neto MXN"]));
      cur.costo = Math.max(cur.costo, num(row["Costo Promedio"]));
      cur.stock += Math.max(0, Math.round(num(row["Disponible"])));
      map.set(code, cur);
    }
  }
  console.log(`Aggregated ${map.size} unique products (by Código).`);

  // Guardrail 1: refuse to mirror from an implausibly small export (wrong/empty
  // files) — that would otherwise wipe most of the catalog.
  if (map.size < MIN_PRODUCTS && !FORCE) {
    throw new Error(
      `Aborting: only ${map.size} products aggregated (< MIN_PRODUCTS=${MIN_PRODUCTS}). ` +
        `Check the Excel files. Re-run with --force to override.`,
    );
  }

  // Finalize: derive base price from neto when a base wasn't exported, and a
  // safe fallback name so NOT NULL never trips.
  for (const p of map.values()) {
    if (p.priceBase === 0 && p.neto > 0) p.priceBase = round2(p.neto / (1 + IVA_RATE));
    if (!p.name) p.name = p.code;
  }

  const client = await pool.connect();
  try {
    // ── 2. Single Carper store ────────────────────────────────────────────────
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

    // ── 3. Category name -> id map (ERP categories use numeric linea ids) ──────
    const catRes = await client.query(`SELECT id, name FROM categories`);
    const catByName = new Map();
    for (const r of catRes.rows) catByName.set(normName(r.name), r.id);

    // Create any Línea present in the Excel but missing from the categories table
    // so new products always have a valid category reference.
    const missingLineas = new Map(); // norm -> raw name
    for (const p of map.values()) {
      if (!p.linea) continue;
      const key = normName(p.linea);
      if (!catByName.has(key) && !missingLineas.has(key))
        missingLineas.set(key, p.linea);
    }
    for (const [key, raw] of missingLineas) {
      const id = slugify(raw);
      await client.query(
        `INSERT INTO categories(id, name, icon, count)
         VALUES($1,$2,'cog-outline',0)
         ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name`,
        [id, raw],
      );
      catByName.set(key, id);
    }

    // ── 4. Existing SKU -> id map (preserve Admintotal numeric ids) ───────────
    const skuRes = await client.query(
      `SELECT sku, id FROM products WHERE sku <> ''`,
    );
    const idBySku = new Map();
    for (const r of skuRes.rows) idBySku.set(r.sku, r.id);

    // ── 5. Upsert products (batched) ──────────────────────────────────────────
    // On conflict we update ONLY Excel-provided columns and preserve enrichment
    // (brand, category_id, image, original_price, descripcion, oem, vehicles).
    const products = [];
    const keepIds = [];
    let existingMatched = 0;
    for (const p of map.values()) {
      const id = idBySku.get(p.code) ?? p.code;
      if (idBySku.has(p.code)) existingMatched++;
      keepIds.push(id);
      products.push({
        id,
        sku: p.code,
        name: p.name,
        categoryId: p.linea ? catByName.get(normName(p.linea)) ?? null : null,
        price: round2(p.priceBase),
        costo: p.costo > 0 ? round2(p.costo) : null,
        proveedor: p.proveedor || null,
        skuProveedor: p.origen || null,
        stock: p.stock,
      });
    }

    // Guardrail 2: reject a run that would prune more than MAX_DELETE_PCT of the
    // current catalog (likely an incomplete export). Also powers the dry-run.
    const totalRes = await client.query(
      `SELECT count(*)::int AS n FROM products`,
    );
    const currentTotal = totalRes.rows[0].n;
    const wouldDelete = Math.max(0, currentTotal - existingMatched);
    const deletePct = currentTotal > 0 ? wouldDelete / currentTotal : 0;
    console.log(
      `Plan: ${products.length} upserts (${existingMatched} existing, ` +
        `${products.length - existingMatched} new), ${wouldDelete} deletes ` +
        `(${(deletePct * 100).toFixed(1)}% of ${currentTotal}).`,
    );
    if (deletePct > MAX_DELETE_PCT && !FORCE) {
      throw new Error(
        `Aborting: delete would remove ${(deletePct * 100).toFixed(1)}% of the ` +
          `catalog (> MAX_DELETE_PCT=${MAX_DELETE_PCT * 100}%). ` +
          `Check the Excel files. Re-run with --force to override.`,
      );
    }
    if (DRY_RUN) {
      console.log("Dry run — no changes written. Exiting.");
      return;
    }

    const COLS = 10;
    const BATCH = 400;
    let done = 0;
    for (let i = 0; i < products.length; i += BATCH) {
      const chunk = products.slice(i, i + BATCH);
      const values = [];
      const params = [];
      chunk.forEach((p, j) => {
        const b = j * COLS;
        // id, sku, name, brand, category_id, price, costo, proveedor,
        // sku_proveedor, erp_stock_qty  + literals
        values.push(
          `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10},now(),'[]'::jsonb,false,'{}'::text[],now())`,
        );
        params.push(
          p.id,
          p.sku,
          p.name,
          "SIN MARCA",
          p.categoryId,
          p.price,
          p.costo,
          p.proveedor,
          p.skuProveedor,
          p.stock,
        );
      });
      await client.query(
        `INSERT INTO products
           (id, sku, name, brand, category_id, price, costo, proveedor,
            sku_proveedor, erp_stock_qty, stock_updated_at, specs, compatible,
            vehicles, updated_at)
         VALUES ${values.join(",")}
         ON CONFLICT(id) DO UPDATE SET
           sku=EXCLUDED.sku,
           name=EXCLUDED.name,
           price=EXCLUDED.price,
           costo=EXCLUDED.costo,
           proveedor=EXCLUDED.proveedor,
           sku_proveedor=COALESCE(EXCLUDED.sku_proveedor, products.sku_proveedor),
           erp_stock_qty=EXCLUDED.erp_stock_qty,
           stock_updated_at=now(),
           updated_at=now()`,
        params,
      );
      done += chunk.length;
      process.stdout.write(`  upserted ${done}/${products.length}\r`);
    }
    console.log(`\nUpserted ${products.length} products.`);

    // ── 6. Delete everything not in the Excel (exact mirror) ──────────────────
    await client.query(`CREATE TEMP TABLE keep_ids(id text PRIMARY KEY)`);
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
    console.log(`Deleted ${del.rowCount} products not present in the Excel.`);

    // Drop orphaned per-sucursal inventory + stray branches (single-store model).
    await client.query(`DELETE FROM inventory WHERE sucursal_id <> 'matriz'`);
    await client.query(`DELETE FROM sucursales WHERE id <> 'matriz'`);
    await client.query(
      `DELETE FROM inventory WHERE product_id NOT IN (SELECT id FROM products)`,
    );

    // ── 7. Recompute category counts ──────────────────────────────────────────
    await client.query(
      `UPDATE categories SET count = (
         SELECT count(*) FROM products WHERE products.category_id = categories.id
       )`,
    );

    const total = await client.query(`SELECT count(*)::int AS n FROM products`);
    console.log(`Done ✓  Catalog now holds ${total.rows[0].n} products.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
