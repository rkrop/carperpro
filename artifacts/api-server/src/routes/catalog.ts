import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  productsTable,
  categoriesTable,
  subcategoriesTable,
  brandsTable,
  sucursalesTable,
  syncStateTable,
} from "@workspace/db";
import {
  ListCategoriesResponse,
  ListSubcategoriesResponse,
  ListBrandsResponse,
  ListSucursalesResponse,
  ListProductsResponse,
  GetProductResponse,
  GetProductsAvailabilityResponse,
  GetDealsResponse,
  GetSyncStatusResponse,
} from "@workspace/api-zod";
import {
  notTestProduct,
  sellableProduct,
  productColumns,
  serializeProduct,
  searchCatalog,
} from "../lib/catalogSearch";

const router: IRouter = Router();

router.get("/categories", async (_req: Request, res: Response): Promise<void> => {
  const rows = await db.select().from(categoriesTable).orderBy(categoriesTable.name);
  const data = ListCategoriesResponse.parse(
    rows.map((r) => ({ id: r.id, name: r.name, icon: r.icon, count: r.count })),
  );
  res.json(data);
});

router.get("/subcategories", async (req: Request, res: Response): Promise<void> => {
  const categoryId =
    typeof req.query.categoryId === "string" ? req.query.categoryId : undefined;
  // Derive counts live from the products table using the SAME sellable/test
  // filters as the catalog search, so the second-level nav only surfaces
  // subcategories with products the user can actually see — and the count
  // matches the results screen exactly. We can't rely on the stored
  // `subcategories.count` column: it's only recomputed at the very end of a
  // full, rate-limited ERP sync, so it routinely sits at 0 and hides every
  // subcategory (the bug this replaces).
  const rows = await db
    .select({
      id: subcategoriesTable.id,
      categoryId: subcategoriesTable.categoryId,
      name: subcategoriesTable.name,
      count: sql<number>`count(${productsTable.id})::int`,
    })
    .from(subcategoriesTable)
    .innerJoin(
      productsTable,
      and(
        eq(productsTable.subcategoryId, subcategoriesTable.id),
        notTestProduct(),
        sellableProduct(),
      ),
    )
    .where(categoryId ? eq(subcategoriesTable.categoryId, categoryId) : undefined)
    .groupBy(subcategoriesTable.id, subcategoriesTable.categoryId, subcategoriesTable.name)
    .orderBy(subcategoriesTable.name);
  const data = ListSubcategoriesResponse.parse(
    rows.map((r) => ({
      id: r.id,
      categoryId: r.categoryId,
      name: r.name,
      count: r.count,
    })),
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
  const subcategoryId =
    typeof req.query.subcategoryId === "string" ? req.query.subcategoryId : undefined;
  const brand = typeof req.query.brand === "string" ? req.query.brand : undefined;
  // Opt-in natural-language assist. Enabled by the results/catalog screens, off
  // for the type-ahead suggestions so keystroke latency stays instant.
  const assist = req.query.assist === "1" || req.query.assist === "true";
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;

  const { rows, total } = await searchCatalog({
    q,
    assist,
    categoryId,
    subcategoryId,
    brand,
    limit,
    offset,
  });

  const data = ListProductsResponse.parse({
    items: rows.map((r) => serializeProduct(r)),
    total,
  });
  res.json(data);
});

// Batch stock refresh for a saved cart. Reports the CURRENT (stock, stockState)
// for each requested id from the local ERP-mirrored count — the same source the
// catalog display and the cash/SPEI checkout guard use, so what the shopper sees
// here matches what the order endpoint will allow. Unlike the listing/detail
// routes this intentionally does NOT apply sellableProduct(): a cart line whose
// product is now confirmed-0, deleted, or test-flagged must still be reported
// (as out_of_stock) so the cart can surface it as unavailable instead of letting
// it fail silently at checkout.
router.get("/products/availability", async (req: Request, res: Response): Promise<void> => {
  const raw = typeof req.query.ids === "string" ? req.query.ids : "";
  const ids = Array.from(
    new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  );

  if (ids.length === 0) {
    res.json(GetProductsAvailabilityResponse.parse({ items: [] }));
    return;
  }

  const rows = await db
    .select({ id: productsTable.id, stock: productsTable.erpStockQty })
    .from(productsTable)
    .where(inArray(productsTable.id, ids));

  const stockById = new Map(rows.map((r) => [r.id, r.stock]));

  const items = ids.map((id) => {
    // Missing row → the product no longer exists in the catalog: unavailable.
    const qty = stockById.has(id) ? stockById.get(id)! : 0;
    const stockState =
      qty === null || qty === undefined
        ? "unknown"
        : qty > 0
          ? "in_stock"
          : "out_of_stock";
    return { id, stock: qty ?? null, stockState };
  });

  const data = GetProductsAvailabilityResponse.parse({ items });
  res.json(data);
});

router.get("/products/:id", async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const rows = await db
    .select(productColumns)
    .from(productsTable)
    .where(and(eq(productsTable.id, id), notTestProduct(), sellableProduct()))
    .limit(1);
  const row = rows[0];
  if (!row) {
    res.status(404).json({ error: "Producto no encontrado" });
    return;
  }
  const data = GetProductResponse.parse(serializeProduct(row));
  res.json(data);
});

router.get("/deals", async (_req: Request, res: Response): Promise<void> => {
  // Compare/rank against the EFFECTIVE price (precio de venta, else costo) so a
  // product priced from its costo can't show a bogus discount vs a raw 0 price.
  const effPrice = sql`(case when ${productsTable.price} > 0 then ${productsTable.price} else coalesce(${productsTable.costo}, 0) end)`;
  const rows = await db
    .select(productColumns)
    .from(productsTable)
    .where(
      and(
        notTestProduct(),
        sellableProduct(),
        sql`${productsTable.originalPrice} is not null`,
        sql`${productsTable.originalPrice} > ${effPrice}`,
      ),
    )
    .orderBy(desc(sql`${productsTable.originalPrice} - ${effPrice}`))
    .limit(20);

  const ofertas = rows.map((r) => serializeProduct(r));
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
