import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
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

// Stock for a product: summed across all sucursales, or for one sucursal when
// `sucursalId` is provided.
function stockExpr(sucursalId?: string): SQL<number> {
  if (sucursalId) {
    return sql<number>`coalesce((select ${inventoryTable.quantity} from ${inventoryTable} where ${inventoryTable.productId} = ${productsTable.id} and ${inventoryTable.sucursalId} = ${sucursalId}), 0)`;
  }
  return sql<number>`coalesce((select sum(${inventoryTable.quantity})::int from ${inventoryTable} where ${inventoryTable.productId} = ${productsTable.id}), 0)`;
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
  const rows = await db.select().from(brandsTable).orderBy(brandsTable.name);
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

  const conditions: SQL[] = [];
  if (q) {
    const like = `%${q}%`;
    const cond = or(
      ilike(productsTable.name, like),
      ilike(productsTable.sku, like),
      ilike(productsTable.brand, like),
    );
    if (cond) conditions.push(cond);
  }
  if (categoryId) conditions.push(eq(productsTable.categoryId, categoryId));
  if (brand) conditions.push(eq(productsTable.brand, brand));
  const where = conditions.length ? and(...conditions) : undefined;

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
    .where(eq(productsTable.id, id))
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
