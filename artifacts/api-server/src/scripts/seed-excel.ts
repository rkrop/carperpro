/**
 * Seeds the DB from the Excel inventory snapshot.
 * Run with: pnpm exec tsx src/scripts/seed-excel.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { read as xlsxRead, utils } from "xlsx";
import { sql } from "drizzle-orm";
import { db, categoriesTable, brandsTable, productsTable, inventoryTable } from "@workspace/db";

function slugify(name: string): string {
  return (
    "cat-" +
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
  );
}

interface ExcelRow {
  sku: string | null;
  nombre: string | null;
  descripcion: string | null;
  categoria: string | null;
  marca: string | null;
  proveedor: string | null;
  sku_proveedor: string | null;
  codigo_oem: string | null;
  precio_venta: number | null;
  costo: number | null;
  stock: number | null;
  imagen_url: string | null;
  actualizado_at: number | null;
}

async function main() {
  const filePath = resolve(
    process.cwd(),
    "../../attached_assets/inventario_carper_1780375030669.xlsx",
  );
  console.log("Reading Excel:", filePath);

  const buf = readFileSync(filePath);
  const wb = xlsxRead(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows = utils.sheet_to_json<ExcelRow>(ws, { defval: null });

  console.log(`Loaded ${rawRows.length} rows`);

  // Collect unique categories and brands
  const catMap = new Map<string, string>(); // id -> name
  const brandSet = new Set<string>();
  for (const row of rawRows) {
    if (row.categoria) catMap.set(slugify(row.categoria), row.categoria);
    if (row.marca) brandSet.add(row.marca);
  }

  // ── 1. Categories ──────────────────────────────────────────────────────────
  console.log(`Upserting ${catMap.size} categories…`);
  for (const [id, name] of catMap) {
    await db
      .insert(categoriesTable)
      .values({ id, name, icon: "cog-outline", count: 0 })
      .onConflictDoUpdate({ target: categoriesTable.id, set: { name } });
  }

  // ── 2. Brands ──────────────────────────────────────────────────────────────
  console.log(`Upserting ${brandSet.size} brands…`);
  for (const name of brandSet) {
    await db
      .insert(brandsTable)
      .values({ name })
      .onConflictDoNothing({ target: brandsTable.name });
  }

  // ── 3. Products ────────────────────────────────────────────────────────────
  console.log("Upserting products…");
  let inserted = 0;
  let skipped = 0;
  const BATCH = 50;

  for (let i = 0; i < rawRows.length; i += BATCH) {
    const chunk = rawRows.slice(i, i + BATCH);
    for (const row of chunk) {
      if (!row.sku || !row.nombre) { skipped++; continue; }

      const id = String(row.sku).trim();
      const sku = id;
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

      await db
        .insert(productsTable)
        .values({
          id,
          sku,
          name,
          brand,
          categoryId,
          price,
          costo,
          proveedor,
          skuProveedor,
          descripcion,
          image: imagen_url,
          specs: [],
          compatible: false,
          vehicles: [],
          oem: row.codigo_oem ? [String(row.codigo_oem)] : null,
          equivalents: null,
        })
        .onConflictDoUpdate({
          target: productsTable.id,
          set: {
            sku,
            name,
            brand,
            categoryId,
            price,
            costo,
            proveedor,
            skuProveedor,
            descripcion,
            image: imagen_url,
            oem: row.codigo_oem ? [String(row.codigo_oem)] : null,
          },
        });

      // Inventory: use a sentinel sucursal "matriz" for flat stock from Excel
      if (stock > 0) {
        await db
          .insert(inventoryTable)
          .values({ productId: id, sucursalId: "matriz", quantity: stock })
          .onConflictDoUpdate({
            target: [inventoryTable.productId, inventoryTable.sucursalId],
            set: { quantity: stock },
          });
      }

      inserted++;
    }
    if ((i / BATCH) % 10 === 0) {
      process.stdout.write(`  ${inserted} / ${rawRows.length}\r`);
    }
  }

  // ── 4. Category counts ─────────────────────────────────────────────────────
  console.log("\nUpdating category counts…");
  await db.execute(
    sql`UPDATE categories SET count = (SELECT count(*) FROM products WHERE products.category_id = categories.id)`,
  );

  // ── 5. Rebuild search_vector for all rows ──────────────────────────────────
  console.log("Rebuilding search vectors…");
  await db.execute(sql`
    UPDATE products SET updated_at = updated_at
    WHERE search_vector IS NULL
  `);

  console.log(`\nDone. Inserted/updated: ${inserted}, skipped: ${skipped}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
