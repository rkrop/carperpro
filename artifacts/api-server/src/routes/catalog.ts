import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import {
  db,
  productsTable,
  categoriesTable,
  brandsTable,
  sucursalesTable,
  inventoryTable,
  syncStateTable,
  type Product as DbProduct,
} from "@workspace/db";
import {
  ListCategoriesResponse,
  ListBrandsResponse,
  ListSucursalesResponse,
  ListProductsResponse,
  GetProductResponse,
  GetDealsResponse,
  GetSyncStatusResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// Stock reported when a product's inventory is UNKNOWN — i.e. it has no rows in
// the `inventory` mirror. The Admintotal sync only ever reports a handful of
// inventory rows (frequently none at all), so the overwhelming majority of the
// catalog has no stock data. Those products are intentionally kept VISIBLE by
// sellableProduct(), and they must ALSO be reported as available: returning 0
// for "unknown" made every such product render as "Agotado" in the app even
// though we have no evidence it's out of stock. We surface a small positive
// sentinel (above the app's "últimas piezas" threshold of 3) so unknown items
// read as "En existencia" and stay orderable. Checkout still performs a live
// stock check, so an unknown-stock item can never let a customer over-buy.
//
// Confirmed-out-of-stock products (those that DO have inventory rows, summing to
// 0) are removed entirely by sellableProduct() and never reach serialization, so
// a real 0 is never reported as available here — only the genuine "no data" case
// gets the sentinel.
const UNKNOWN_STOCK = 10;

// Stock for a product: summed across all sucursales, or for one sucursal when
// `sucursalId` is provided. When no inventory data exists the result falls back
// to UNKNOWN_STOCK so the catalog treats the item as available (see above).
function stockExpr(sucursalId?: string): SQL<number> {
  if (sucursalId) {
    return sql<number>`coalesce((select ${inventoryTable.quantity} from ${inventoryTable} where ${inventoryTable.productId} = ${productsTable.id} and ${inventoryTable.sucursalId} = ${sucursalId}), ${UNKNOWN_STOCK})`;
  }
  return sql<number>`coalesce((select sum(${inventoryTable.quantity})::int from ${inventoryTable} where ${inventoryTable.productId} = ${productsTable.id}), ${UNKNOWN_STOCK})`;
}

// Test/placeholder rows that leak in from the Admintotal ERP sync (e.g.
// "ARTICULO PRUEBA", "REPTIL TEST BRAND"). Excluded at the query layer so they
// never surface in the app, even after a re-sync re-inserts them. Real
// diagnostic tools ("pinza de prueba", "foco de prueba") are intentionally NOT
// matched — only generic test placeholders and test brands.
function notTestProduct(): SQL {
  return sql`not (
    unaccent(lower(${productsTable.name})) = 'articulo prueba'
    or unaccent(lower(${productsTable.name})) like '%producto de prueba%'
    or lower(${productsTable.brand}) like '%test brand%'
    or lower(${productsTable.brand}) like '%reptil test%'
  )`;
}

// Unsellable / junk rows hidden from the catalog:
//  - CONFIRMED 0 stock → hidden. A product is only hidden for stock when it has
//    inventory rows that sum to 0 (i.e. we know it's off the shelf). Products
//    with NO inventory rows are treated as "stock unknown" and stay VISIBLE —
//    the `inventory` mirror is sparsely populated (Admintotal sync only reports
//    a handful of rows), so treating "no data" as "out of stock" would hide the
//    entire catalog. Checkout performs a live stock check, so showing an
//    unknown-stock item never lets a customer over-buy.
//  - no price AND no cost (price=0 and costo=0/null) → nothing to sell
//  - no name AND no description → empty junk row
// Like notTestProduct(), enforced at the query layer so a re-sync from
// Admintotal can't resurface them.
function sellableProduct(): SQL {
  return sql`(
    coalesce((select sum(${inventoryTable.quantity})::int from ${inventoryTable} where ${inventoryTable.productId} = ${productsTable.id}), 1) > 0
    and (coalesce(${productsTable.price}, 0) > 0 or coalesce(${productsTable.costo}, 0) > 0)
    and (
      btrim(coalesce(${productsTable.name}, '')) <> ''
      or btrim(coalesce(${productsTable.descripcion}, '')) <> ''
    )
  )`;
}

function serializeProduct(
  row: DbProduct & { stock: number },
): Record<string, unknown> {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    brand: row.brand,
    price: row.price,
    originalPrice: row.originalPrice ?? null,
    stock: row.stock ?? 0,
    categoryId: row.categoryId ?? null,
    image: row.image ?? null,
    compatible: row.compatible,
    specs: row.specs ?? [],
    vehicles: row.vehicles ?? [],
    oem: row.oem ?? null,
    equivalents: row.equivalents ?? null,
    descripcion: row.descripcion ?? null,
  };
}

router.get("/categories", async (_req: Request, res: Response): Promise<void> => {
  const rows = await db.select().from(categoriesTable).orderBy(categoriesTable.name);
  const data = ListCategoriesResponse.parse(
    rows.map((r) => ({ id: r.id, name: r.name, icon: r.icon, count: r.count })),
  );
  res.json(data);
});

router.get("/brands", async (_req: Request, res: Response): Promise<void> => {
  const rows = await db
    .select()
    .from(brandsTable)
    .where(sql`not (lower(${brandsTable.name}) like '%test brand%' or lower(${brandsTable.name}) like '%reptil test%')`)
    .orderBy(brandsTable.name);
  const data = ListBrandsResponse.parse(rows.map((r) => r.name));
  res.json(data);
});

router.get("/sucursales", async (_req: Request, res: Response): Promise<void> => {
  const rows = await db.select().from(sucursalesTable).orderBy(sucursalesTable.name);
  const data = ListSucursalesResponse.parse(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      address: r.address,
      city: r.city,
      hours: r.hours,
    })),
  );
  res.json(data);
});

router.get("/products", async (req: Request, res: Response): Promise<void> => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const categoryId =
    typeof req.query.categoryId === "string" ? req.query.categoryId : undefined;
  const brand = typeof req.query.brand === "string" ? req.query.brand : undefined;
  const sucursalId =
    typeof req.query.sucursalId === "string" ? req.query.sucursalId : undefined;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;

  const conditions: SQL[] = [notTestProduct(), sellableProduct()];
  if (q) {
    // Accent-insensitive substring search over name, descripcion, sku, brand
    // and OEM codes. We use unaccent()+ILIKE rather than the tsvector column:
    // search_vector is populated lazily by a DB trigger (NULL for any row not
    // re-written since the column was recreated), so ILIKE is the only thing
    // guaranteed to match every existing catalog row. Each whitespace-separated
    // word must match somewhere (AND), so extra words narrow results.
    const haystack = sql`unaccent(lower(
      coalesce(${productsTable.name}, '') || ' ' ||
      coalesce(${productsTable.descripcion}, '') || ' ' ||
      coalesce(${productsTable.sku}, '') || ' ' ||
      coalesce(${productsTable.brand}, '') || ' ' ||
      coalesce(array_to_string(${productsTable.oem}, ' '), '')
    ))`;
    const words = q.split(/\s+/).filter((w) => w.length > 0);
    for (const w of words) {
      // Escape ILIKE wildcards so user-typed % / _ match literally.
      const term = `%${w.replace(/([%_\\])/g, "\\$1")}%`;
      conditions.push(sql`${haystack} like unaccent(lower(${term}))`);
    }
  }
  if (categoryId) conditions.push(eq(productsTable.categoryId, categoryId));
  if (brand) conditions.push(eq(productsTable.brand, brand));
  const where = and(...conditions);

  const stock = stockExpr(sucursalId);

  const rows = await db
    .select({ product: productsTable, stock })
    .from(productsTable)
    .where(where)
    .orderBy(productsTable.name)
    .limit(limit)
    .offset(offset);

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(productsTable)
    .where(where);
  const total = countRows[0]?.count ?? 0;

  const data = ListProductsResponse.parse({
    items: rows.map((r) => serializeProduct({ ...r.product, stock: r.stock })),
    total,
  });
  res.json(data);
});

router.get("/products/:id", async (req: Request, res: Response): Promise<void> => {
  const sucursalId =
    typeof req.query.sucursalId === "string" ? req.query.sucursalId : undefined;
  const stock = stockExpr(sucursalId);
  const id = String(req.params.id);
  const rows = await db
    .select({ product: productsTable, stock })
    .from(productsTable)
    .where(and(eq(productsTable.id, id), notTestProduct(), sellableProduct()))
    .limit(1);
  const row = rows[0];
  if (!row) {
    res.status(404).json({ error: "Producto no encontrado" });
    return;
  }
  const data = GetProductResponse.parse(
    serializeProduct({ ...row.product, stock: row.stock }),
  );
  res.json(data);
});

router.get("/deals", async (req: Request, res: Response): Promise<void> => {
  const sucursalId =
    typeof req.query.sucursalId === "string" ? req.query.sucursalId : undefined;
  const stock = stockExpr(sucursalId);
  const rows = await db
    .select({ product: productsTable, stock })
    .from(productsTable)
    .where(
      and(
        notTestProduct(),
        sellableProduct(),
        sql`${productsTable.originalPrice} is not null`,
        sql`${productsTable.originalPrice} > ${productsTable.price}`,
      ),
    )
    .orderBy(desc(sql`${productsTable.originalPrice} - ${productsTable.price}`))
    .limit(20);

  const ofertas = rows.map((r) =>
    serializeProduct({ ...r.product, stock: r.stock }),
  );
  const data = GetDealsResponse.parse({
    dealOfDay: ofertas[0] ?? null,
    ofertas,
  });
  res.json(data);
});

router.get("/sync-status", async (_req: Request, res: Response): Promise<void> => {
  const rows = await db
    .select()
    .from(syncStateTable)
    .where(eq(syncStateTable.key, "catalog"))
    .limit(1);
  const row = rows[0];
  const data = GetSyncStatusResponse.parse({
    status: row?.status ?? "idle",
    lastStartedAt: row?.lastStartedAt ? row.lastStartedAt.toISOString() : null,
    lastFinishedAt: row?.lastFinishedAt ? row.lastFinishedAt.toISOString() : null,
    lastSuccessAt: row?.lastSuccessAt ? row.lastSuccessAt.toISOString() : null,
    lastError: row?.lastError ?? null,
    message: row?.message ?? null,
    productsSynced: row?.productsSynced ?? 0,
    categoriesSynced: row?.categoriesSynced ?? 0,
    sucursalesSynced: row?.sucursalesSynced ?? 0,
    brandsSynced: row?.brandsSynced ?? 0,
  });
  res.json(data);
});

export default router;
