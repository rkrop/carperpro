import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import {
  db,
  productsTable,
  categoriesTable,
  brandsTable,
  sucursalesTable,
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
import { effectivePrice } from "../lib/pricing";

const router: IRouter = Router();

// Test/placeholder rows that leak in from the Admintotal ERP sync (e.g.
// "ARTICULO PRUEBA", "REPTIL TEST BRAND"). Excluded at the query layer so they
// never surface in the app, even after a re-sync re-inserts them. Real
// diagnostic tools ("pinza de prueba", "foco de prueba") are intentionally NOT
// matched — only generic test placeholders and test brands.
export function notTestProduct(): SQL {
  return sql`not (
    unaccent(lower(${productsTable.name})) = 'articulo prueba'
    or unaccent(lower(${productsTable.name})) like '%producto de prueba%'
    or lower(${productsTable.brand}) like '%test brand%'
    or lower(${productsTable.brand}) like '%reptil test%'
  )`;
}

// Unsellable / junk rows hidden from the catalog:
//  - CONFIRMED 0 stock → hidden. A product is only hidden for stock when its
//    erpStockQty is 0 (i.e. the ERP told us it's off the shelf). Products whose
//    erpStockQty is NULL are treated as "stock unknown" and stay VISIBLE — the
//    ERP reports stock sparsely (per-SKU webhooks fill it in over time), so
//    treating "no data" as "out of stock" would hide most of the catalog.
//    Checkout performs a live stock check, so showing an unknown-stock item
//    never lets a customer over-buy.
//  - no price AND no cost (price=0 and costo=0/null) → nothing to sell
//  - no name AND no description → empty junk row
// Like notTestProduct(), enforced at the query layer so a re-sync from
// Admintotal can't resurface them.
export function sellableProduct(): SQL {
  return sql`(
    coalesce(${productsTable.erpStockQty}, 1) > 0
    and (coalesce(${productsTable.price}, 0) > 0 or coalesce(${productsTable.costo}, 0) > 0)
    and (
      btrim(coalesce(${productsTable.name}, '')) <> ''
      or btrim(coalesce(${productsTable.descripcion}, '')) <> ''
    )
  )`;
}

// Map the stored stock number into the API's (stock, stockState) pair.
//  - NULL erpStockQty  → unknown availability (count hidden, stays orderable)
//  - 0                 → confirmed out of stock (hidden from listings)
//  - > 0               → real on-hand count
function serializeProduct(row: DbProduct): Record<string, unknown> {
  const qty = row.erpStockQty;
  const stockState =
    qty === null || qty === undefined
      ? "unknown"
      : qty > 0
        ? "in_stock"
        : "out_of_stock";
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    brand: row.brand,
    price: effectivePrice(row),
    originalPrice: row.originalPrice ?? null,
    stock: qty ?? null,
    stockState,
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
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;

  const conditions: SQL[] = [notTestProduct(), sellableProduct()];

  // Order is relevance-ranked when we run a full-text search, otherwise it falls
  // back to alphabetical by name. `rankOrder` carries the ts_rank ordering when
  // active.
  let rankOrder: SQL | null = null;

  if (q) {
    // Connector stopwords that carry no search signal. Dropped so a phrase like
    // "bomba de gasolina tsuru" doesn't force "de" to match and wrongly exclude
    // a "BOMBA GASOLINA TSURU".
    const STOPWORDS = new Set([
      "de", "la", "el", "los", "las", "para", "con", "y", "o", "del", "un", "una",
    ]);
    // Sanitize: drop everything that isn't a unicode letter/number (this also
    // strips the tsquery operators & | ! : ( ) ' " so to_tsquery can't choke on
    // real-world input). Accents are kept here and removed by unaccent() in SQL,
    // matching exactly how search_vector was built.
    const allWords = q
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]+/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 0);
    const words = allWords.filter((w) => !STOPWORDS.has(w));

    if (words.length > 0) {
      // Full-text query: AND semantics + per-word prefix (foo:*), unaccented so
      // it matches the stored vector built with to_tsvector('simple',
      // unaccent(...)). Using the wrong config/accents would silently return 0.
      const tsqueryStr = words.map((w) => `${w}:*`).join(" & ");
      const tsquery = sql`to_tsquery('simple', unaccent(${tsqueryStr}))`;

      // ILIKE safety net for partial SKU / OEM / part-number fragments only —
      // full-text can't prefix-match a code typed mid-string. Restricted to
      // sku/oem so we never reintroduce mid-word false positives in name/desc.
      const skuHaystack = sql`unaccent(lower(
        coalesce(${productsTable.sku}, '') || ' ' ||
        coalesce(array_to_string(${productsTable.oem}, ' '), '')
      ))`;
      const netParts: SQL[] = [];
      for (const w of words) {
        const term = `%${w.replace(/([%_\\])/g, "\\$1")}%`;
        netParts.push(sql`${skuHaystack} like unaccent(lower(${term}))`);
      }
      const ilikeNet = and(...netParts) as SQL;

      conditions.push(
        sql`(${productsTable.searchVector} @@ ${tsquery} or (${ilikeNet}))`,
      );
      // Weighted ts_rank ranks name/SKU (weight A) above brand/OEM (B) above
      // description (C); SKU/OEM-only ILIKE-net hits rank 0 and sort last.
      // coalesce(...,0) guards a transient NULL vector (pre-backfill) from
      // sorting to the top under DESC's NULLS-FIRST default.
      rankOrder = sql`coalesce(ts_rank(${productsTable.searchVector}, ${tsquery}), 0) desc`;
    } else {
      // Nothing searchable left after dropping stopwords/punctuation: fall back
      // to the previous accent-insensitive substring AND match so search never
      // breaks or returns empty for inputs like "de la".
      const haystack = sql`unaccent(lower(
        coalesce(${productsTable.name}, '') || ' ' ||
        coalesce(${productsTable.descripcion}, '') || ' ' ||
        coalesce(${productsTable.sku}, '') || ' ' ||
        coalesce(${productsTable.brand}, '') || ' ' ||
        coalesce(array_to_string(${productsTable.oem}, ' '), '')
      ))`;
      for (const w of allWords) {
        const term = `%${w.replace(/([%_\\])/g, "\\$1")}%`;
        conditions.push(sql`${haystack} like unaccent(lower(${term}))`);
      }
    }
  }
  if (categoryId) conditions.push(eq(productsTable.categoryId, categoryId));
  if (brand) conditions.push(eq(productsTable.brand, brand));
  const where = and(...conditions);

  // Deterministic order: relevance first when ranking, then name, then id as a
  // final tiebreaker. Rows are unique by primary key, so no DISTINCT is needed.
  const orderBy: SQL[] = rankOrder
    ? [rankOrder, sql`${productsTable.name} asc`, sql`${productsTable.id} asc`]
    : [sql`${productsTable.name} asc`];

  const rows = await db
    .select()
    .from(productsTable)
    .where(where)
    .orderBy(...orderBy)
    .limit(limit)
    .offset(offset);

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(productsTable)
    .where(where);
  const total = countRows[0]?.count ?? 0;

  const data = ListProductsResponse.parse({
    items: rows.map((r) => serializeProduct(r)),
    total,
  });
  res.json(data);
});

router.get("/products/:id", async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const rows = await db
    .select()
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
    .select()
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
