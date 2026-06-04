import { and, eq, getTableColumns, sql, type SQL } from "drizzle-orm";
import { db, productsTable, type Product as DbProduct } from "@workspace/db";
import { tokenizeQuery, buildFtsSearch, buildFallbackSearch } from "./productSearch";
import { interpretQuery } from "./nlSearch";
import { embedQuery, isEmbeddingsConfigured, toVectorLiteral } from "./embeddings";

// Every product column EXCEPT the heavy `embedding` vector (768 floats), which is
// only used server-side for nearest-neighbor scans and never serialized. Selects
// use this so listing queries don't drag the vectors over the wire.
const { embedding: _omitEmbedding, ...productColumns } = getTableColumns(productsTable);
void _omitEmbedding;
export { productColumns };
export type CatalogProduct = Omit<DbProduct, "embedding">;

// No hay catálogo de "productos de prueba" que filtrar: el inventario es un
// espejo real del ERP. Se conserva como no-op para no reescribir cada query.
export function notTestProduct(): SQL {
  return sql`true`;
}

// Regla de negocio del maestro: un producto sin precio válido (status
// 'sin_precio', es decir sin precio de venta ni costo del cual estimar) NO se
// muestra en el catálogo. Cualquier otro estado es vendible. Aplica la regla
// "nunca precio 0" desde el lado de la presentación.
export function sellableProduct(): SQL {
  return sql`${productsTable.status} <> 'sin_precio'`;
}

// Serializa un producto para la API. El precio se expone exactamente como
// está almacenado (sin transformaciones ni IVA adicional). Las reglas de
// presentación de precio/stock se definirán con el archivo maestro.
export function serializeProduct(row: CatalogProduct): Record<string, unknown> {
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
    price: row.price ?? 0,
    originalPrice:
      row.originalPrice && row.originalPrice > 0 ? row.originalPrice : null,
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
    descripcion:
      (row.descripcion && row.descripcion.trim()) ||
      row.descripcionGenerada ||
      null,
  };
}

// When a shopper opts into AI assist, only invoke the language model if plain
// search came back thin (this many results or fewer). Well-formed searches that
// already work skip the AI entirely — keeping it cheap and guaranteeing assisted
// search is never worse than today's search.
const ASSIST_MIN_RESULTS = 6;

// Semantic (embeddings) gate. Only after text + AI-assist still came back thin do
// we spend an embedding call, then widen the result set with nearest-neighbor
// matches. The semantic result SUPERSETS the text result (text rows stay, ranked
// first), so it can never make search worse — only add meaning-based matches.
const SEMANTIC_MIN_RESULTS = 6;
// Max cosine distance (0 = identical, 2 = opposite) for a row to count as a
// semantic match. ~0.55 keeps reasonably-related parts while filtering noise;
// tunable without touching logic.
const SEMANTIC_MAX_DISTANCE = 0.55;

export interface SearchCatalogParams {
  /** Raw free-text query (may be empty for a pure browse/filter request). */
  q?: string;
  /** Opt into the AI-assist + semantic widening passes (off for type-ahead). */
  assist?: boolean;
  categoryId?: string;
  subcategoryId?: string;
  brand?: string;
  limit?: number;
  offset?: number;
}

export interface SearchCatalogResult {
  rows: CatalogProduct[];
  total: number;
}

/**
 * The single catalog search pipeline used by both the `/products` listing route
 * and the conversational assistant: plain full-text search, then (when opted in
 * and results are thin) AI keyword rewriting, then semantic nearest-neighbor
 * widening. Each later pass is strictly additive — it's only adopted when it
 * returns at least as many rows — so assisted search can never be worse than
 * plain text search. Returns the page rows (embedding column excluded) plus the
 * total match count; callers serialize with `serializeProduct`.
 */
export async function searchCatalog(
  params: SearchCatalogParams,
): Promise<SearchCatalogResult> {
  const q = (params.q ?? "").trim();
  const assist = params.assist ?? false;
  const limit = Math.min(params.limit ?? 50, 200);
  const offset = params.offset ?? 0;

  // Filters that apply regardless of the search terms. Kept separate from the
  // search predicate so the AI-assist path can re-run the search with rewritten
  // keywords while preserving the same category/brand scope.
  const filterConditions: SQL[] = [notTestProduct(), sellableProduct()];
  if (params.categoryId)
    filterConditions.push(eq(productsTable.categoryId, params.categoryId));
  if (params.subcategoryId)
    filterConditions.push(eq(productsTable.subcategoryId, params.subcategoryId));
  if (params.brand) filterConditions.push(eq(productsTable.brand, params.brand));

  // Run the catalog query for a given search predicate (may be empty for a
  // pure browse/filter request) and relevance order. Returns the page rows plus
  // the total match count.
  async function runSearch(
    searchConditions: SQL[],
    rankOrder: SQL | null,
  ): Promise<SearchCatalogResult> {
    const where = and(...filterConditions, ...searchConditions);
    // Deterministic order: relevance first when ranking, then name, then id as a
    // final tiebreaker. Rows are unique by primary key, so no DISTINCT needed.
    const orderBy: SQL[] = rankOrder
      ? [rankOrder, sql`${productsTable.name} asc`, sql`${productsTable.id} asc`]
      : [sql`${productsTable.name} asc`];
    const rows = await db
      .select(productColumns)
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

  // Hybrid widen: keep every text match (ranked first) and ADD products whose
  // embedding is close to the query embedding. `textCondition` is the predicate
  // that produced the current text result (plain or the winning AI-assist
  // candidate); `textRank` its relevance order. The combined WHERE is
  // (text match OR semantically close), so the row set is a strict superset of
  // the text result and ordering puts text hits first, then closest-by-meaning.
  async function runSemanticSearch(
    textCondition: SQL,
    textRank: SQL | null,
    queryVector: number[],
  ): Promise<SearchCatalogResult> {
    const distance = sql`(${productsTable.embedding} <=> ${toVectorLiteral(queryVector)}::vector)`;
    const semanticClose = sql`(${productsTable.embedding} is not null and ${distance} < ${SEMANTIC_MAX_DISTANCE})`;
    const where = and(
      ...filterConditions,
      sql`(${textCondition} or ${semanticClose})`,
    );
    const orderBy: SQL[] = [
      sql`(${textCondition}) desc`, // text hits (TRUE) before pure-semantic hits
      ...(textRank ? [textRank] : []),
      sql`coalesce(${distance}, 2) asc`, // then closest by meaning
      sql`${productsTable.name} asc`,
      sql`${productsTable.id} asc`,
    ];
    const rows = await db
      .select(productColumns)
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
  // The predicate (and its rank order) that produced the current result — fed to
  // the semantic widen so text matches are preserved and ranked first. Starts as
  // the plain query and is reassigned if an AI-assist candidate wins below.
  let winningCondition: SQL | null = null;
  let winningRank: SQL | null = null;
  if (q) {
    const { allWords, words } = tokenizeQuery(q);
    plainWords = words;
    if (words.length > 0) {
      const fts = buildFtsSearch(words);
      searchConditions.push(fts.condition);
      rankOrder = fts.rankOrder;
      winningCondition = fts.condition;
      winningRank = fts.rankOrder;
    } else {
      // Only stopwords/punctuation survived — substring fallback so search never
      // breaks or returns empty for inputs like "de la".
      searchConditions.push(...buildFallbackSearch(allWords));
    }
  }

  let { rows, total } = await runSearch(searchConditions, rankOrder);

  // AI assist: when the caller opted in, the query has real terms, and plain
  // search came back thin, ask the model to split the phrase into part + vehicle
  // keywords and re-run. We try candidates from most specific (part + vehicle)
  // to least (part only), and adopt the FIRST candidate that beats plain search.
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
          winningCondition = aiFts.condition;
          winningRank = aiFts.rankOrder;
          break;
        }
      }
    }
  }

  // Semantic widen: same cost gate as AI assist (opted in, real query, still
  // thin). Embed the query (cached) and re-run with the hybrid predicate so
  // meaning-based matches join the text hits. Only adopted when it returns at
  // least as many rows as text alone, and any failure (no key, API error) leaves
  // the text result untouched — text search is never degraded.
  if (
    assist &&
    q &&
    winningCondition &&
    total < SEMANTIC_MIN_RESULTS &&
    isEmbeddingsConfigured()
  ) {
    try {
      const queryVector = await embedQuery(q);
      if (queryVector) {
        const semantic = await runSemanticSearch(
          winningCondition,
          winningRank,
          queryVector,
        );
        if (semantic.total >= total) {
          ({ rows, total } = semantic);
        }
      }
    } catch {
      // Keep the text result; semantic is purely additive.
    }
  }

  return { rows, total };
}
