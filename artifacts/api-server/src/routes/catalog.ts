import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import {
  db,
  productsTable,
  categoriesTable,
  subcategoriesTable,
  brandsTable,
  sucursalesTable,
  syncStateTable,
  type Product as DbProduct,
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
import { effectivePrice, withIva } from "../lib/pricing";
import { tokenizeQuery, buildFtsSearch, buildFallbackSearch } from "../lib/productSearch";
import { interpretQuery } from "../lib/nlSearch";

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
    // Strike-through "precio anterior" must carry IVA too, so the displayed
    // discount stays consistent with the IVA-included current price.
    originalPrice:
      row.originalPrice && row.originalPrice > 0
        ? withIva(row.originalPrice)
        : null,
    stock: qty ?? null,
    stockState,
    categoryId: row.categoryId ?? null,
    subcategoryId: row.subcategoryId ?? null,
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

router.get("/subcategories", async (req: Request, res: Response): Promise<void> => {
  const categoryId =
    typeof req.query.categoryId === "string" ? req.query.categoryId : undefined;
  // Only surface subcategories that actually have sellable products in them, so
  // the second-level nav never shows an empty grouping.
  const conditions: SQL[] = [sql`${subcategoriesTable.count} > 0`];
  if (categoryId) conditions.push(eq(subcategoriesTable.categoryId, categoryId));
  const rows = await db
    .select()
    .from(subcategoriesTable)
    .where(and(...conditions))
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

// When a shopper opts into AI assist, only invoke the language model if plain
// search came back thin (this many results or fewer). Well-formed searches that
// already work skip the AI entirely — keeping it cheap and guaranteeing assisted
// search is never worse than today's search.
const ASSIST_MIN_RESULTS = 6;

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

  // Filters that apply regardless of the search terms. Kept separate from the
  // search predicate so the AI-assist path can re-run the search with rewritten
  // keywords while preserving the same category/brand scope.
  const filterConditions: SQL[] = [notTestProduct(), sellableProduct()];
  if (categoryId) filterConditions.push(eq(productsTable.categoryId, categoryId));
  if (subcategoryId) filterConditions.push(eq(productsTable.subcategoryId, subcategoryId));
  if (brand) filterConditions.push(eq(productsTable.brand, brand));

  // Run the catalog query for a given search predicate (may be empty for a
  // pure browse/filter request) and relevance order. Returns the page rows plus
  // the total match count.
  async function runSearch(
    searchConditions: SQL[],
    rankOrder: SQL | null,
  ): Promise<{ rows: DbProduct[]; total: number }> {
    const where = and(...filterConditions, ...searchConditions);
    // Deterministic order: relevance first when ranking, then name, then id as a
    // final tiebreaker. Rows are unique by primary key, so no DISTINCT needed.
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
    return { rows, total: countRows[0]?.count ?? 0 };
  }

  // Build the plain (non-AI) search predicate from the raw query.
  const searchConditions: SQL[] = [];
  let rankOrder: SQL | null = null;
  let plainWords: string[] = [];
  if (q) {
    const { allWords, words } = tokenizeQuery(q);
    plainWords = words;
    if (words.length > 0) {
      const fts = buildFtsSearch(words);
      searchConditions.push(fts.condition);
      rankOrder = fts.rankOrder;
    } else {
      // Only stopwords/punctuation survived — substring fallback so search never
      // breaks or returns empty for inputs like "de la".
      searchConditions.push(...buildFallbackSearch(allWords));
    }
  }

  let { rows, total } = await runSearch(searchConditions, rankOrder);

  // AI assist: when the shopper opted in, the query has real terms, and plain
  // search came back thin, ask the model to split the phrase into part + vehicle
  // keywords and re-run. We try candidates from most specific (part + vehicle)
  // to least (part only), and adopt the FIRST candidate that beats plain search.
  // This prefers a precise "balatas para tsuru" match when the catalog has one,
  // but still relaxes to "balatas" (the shopper's primary intent) rather than
  // returning nothing when part and vehicle don't co-occur in product text.
  // Any AI failure leaves the plain result untouched. The interpretation is
  // cached, so paginated screens stay consistent across pages.
  if (assist && plainWords.length > 0 && total < ASSIST_MIN_RESULTS) {
    const interp = await interpretQuery(q);
    if (interp) {
      const candidates: string[][] = [];
      const full = [...interp.parts, ...interp.vehicle];
      if (full.length > 0) candidates.push(full);
      if (interp.parts.length > 0) candidates.push(interp.parts);

      // Skip candidates identical to the plain query or already tried.
      const seen = new Set<string>([plainWords.join(" ")]);
      for (const candidate of candidates) {
        const key = candidate.join(" ");
        if (key === "" || seen.has(key)) continue;
        seen.add(key);
        const aiFts = buildFtsSearch(candidate);
        const aiResult = await runSearch([aiFts.condition], aiFts.rankOrder);
        if (aiResult.total > total) {
          ({ rows, total } = aiResult);
          break;
        }
      }
    }
  }

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
