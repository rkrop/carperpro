import { and, eq, getTableColumns, sql, type SQL } from "drizzle-orm";
import { db, productsTable, type Product as DbProduct } from "@workspace/db";
import {
  tokenizeQuery,
  buildFtsSearch,
  buildFallbackSearch,
  buildCodeMatch,
  buildApplicationMatch,
} from "./productSearch";
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

// Catálogo visible: qué productos aparecen en listado, búsqueda, detalle y la
// navegación por subcategoría. A DIFERENCIA de sellableProduct(), SÍ incluye los
// 'sin_precio' — se muestran como ficha "para consulta" (sin precio, sin carrito,
// con cotización por WhatsApp; el flag quoteOnly del producto lo indica). El único
// estado oculto hoy es de prueba (inexistente), así que muestra todo. Mantener
// separado de sellableProduct(), que gobierna la COMPRA y los trabajos de backfill.
export function catalogVisibleProduct(): SQL {
  return sql`true`;
}

// Serializa un producto para la API. El precio se expone exactamente como
// está almacenado (sin transformaciones ni IVA adicional). Las reglas de
// presentación de precio/stock se definirán con el archivo maestro.
// Datos estructurados opcionales (códigos OEM + aplicaciones de vehículo) que
// SOLO el endpoint de detalle adjunta: el listado los deja vacíos para no incurrir
// en un N+1 contra las tablas product_oem_codes / product_applications.
export interface ProductApplicationOut {
  make: string;
  model: string;
  yearFrom: number | null;
  yearTo: number | null;
  motor: string | null;
}
export interface ProductOemCodeOut {
  code: string;
  brand: string | null;
}
export interface SerializeExtras {
  applications?: ProductApplicationOut[];
  oemCodes?: ProductOemCodeOut[];
}

export function serializeProduct(
  row: CatalogProduct,
  extras?: SerializeExtras,
): Record<string, unknown> {
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
    // Producto sin precio vendible → ficha "para consulta": el cliente oculta
    // precio + carrito y ofrece cotizar por WhatsApp. La compra ya se rechaza
    // en orders/Stripe, esto solo gobierna la presentación.
    quoteOnly: row.status === "sin_precio",
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
    applications: extras?.applications ?? [],
    oemCodes: extras?.oemCodes ?? [],
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
  /**
   * When true, sort peripheral/accessory products (conectores, arneses,
   * sensores, repuestos…) BELOW the primary part the shopper asked for, so a
   * search for "bomba" surfaces real pumps before connectors/sensors. Opt-in
   * (the assistant uses it); the catalog listing and scanner leave it off so
   * their ordering is unchanged. Any accessory marker that the shopper actually
   * typed is exempt, so a search for "conector" is never demoted.
   */
  deprioritizeAccessories?: boolean;
  /**
   * When true, only products with a non-empty image are returned.
   * When false, only products without an image are returned.
   * When undefined, no image filter is applied.
   */
  hasImage?: boolean;
}

export interface SearchCatalogResult {
  rows: CatalogProduct[];
  total: number;
  /**
   * True when the result set was NOT obtained from the literal query: i.e. the
   * AI-assist pass had to drop the vehicle term and match the part alone, or the
   * semantic pass widened beyond the text match. Callers (the assistant) use
   * this to be honest that the rows may not be confirmed-compatible with the
   * shopper's vehicle. Absent/false means the literal query matched.
   */
  relaxed?: boolean;
}

// Peripheral/secondary part markers. When `deprioritizeAccessories` is on, rows
// whose name contains one of these (and the shopper didn't type it) sort after
// the primary part. Conservative on purpose — only clearly-secondary items.
const ACCESSORY_MARKERS = [
  "conector",
  "arnes",
  "sensor",
  "interruptor",
  "fusible",
  "relevador",
  "repuesto",
];

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

  // Optional accessory-deprioritization order term, computed once. Demotes rows
  // whose name mentions a peripheral marker the shopper did NOT type, so primary
  // parts sort first. Null when disabled or every marker was typed (nothing to
  // demote). Added as the FIRST order key so it groups primary parts above
  // accessories before relevance/name tiebreakers apply.
  let accessoryOrder: SQL | null = null;
  if (params.deprioritizeAccessories) {
    const typed = new Set(
      q
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .split(/[^a-z0-9]+/)
        .filter(Boolean),
    );
    // Exempt any marker the shopper actually typed, matching morphological
    // variants by prefix so "sensores"/"conectores" exempt "sensor"/"conector".
    const typedTokens = Array.from(typed);
    const markers = ACCESSORY_MARKERS.filter(
      (m) => !typedTokens.some((t) => t.startsWith(m)),
    );
    if (markers.length > 0) {
      const pattern = markers.join("|");
      accessoryOrder = sql`(case when unaccent(lower(${productsTable.name})) ~ ${pattern} then 1 else 0 end) asc`;
    }
  }

  // Filters that apply regardless of the search terms. Kept separate from the
  // search predicate so the AI-assist path can re-run the search with rewritten
  // keywords while preserving the same category/brand scope.
  const filterConditions: SQL[] = [notTestProduct(), catalogVisibleProduct()];
  if (params.categoryId)
    filterConditions.push(eq(productsTable.categoryId, params.categoryId));
  if (params.subcategoryId)
    filterConditions.push(eq(productsTable.subcategoryId, params.subcategoryId));
  if (params.brand) filterConditions.push(eq(productsTable.brand, params.brand));
  // Image visibility rule: browsing (no typed query) only shows products that
  // HAVE an image — the catalog/lines/subcategories grids should never surface
  // a photo-less placeholder card. Products without a photo stay in the
  // database and are still fully searchable: the moment the shopper types a
  // query (q non-empty) this default lifts and every match is shown regardless
  // of image, so a real part number/name search never comes up empty just
  // because the product lacks a photo. An explicit hasImage param (e.g. an
  // internal admin tool) always wins over this default in either direction.
  if (params.hasImage === true)
    filterConditions.push(sql`${productsTable.image} is not null and ${productsTable.image} <> ''`);
  else if (params.hasImage === false)
    filterConditions.push(sql`(${productsTable.image} is null or ${productsTable.image} = '')`);
  else if (!q)
    filterConditions.push(sql`${productsTable.image} is not null and ${productsTable.image} <> ''`);

  // Run the catalog query for a given search predicate (may be empty for a
  // pure browse/filter request) and relevance order. Returns the page rows plus
  // the total match count.
  async function runSearch(
    searchConditions: SQL[],
    rankOrders: SQL[],
  ): Promise<SearchCatalogResult> {
    const where = and(...filterConditions, ...searchConditions);
    // Deterministic order: relevance keys first when ranking (code-exact >
    // code-prefix > application > text relevance), then name, then id as a final
    // tiebreaker. Rows are unique by primary key, so no DISTINCT needed.
    const orderBy: SQL[] = rankOrders.length
      ? [...rankOrders, sql`${productsTable.name} asc`, sql`${productsTable.id} asc`]
      : [sql`${productsTable.name} asc`];
    if (accessoryOrder) orderBy.unshift(accessoryOrder);
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
    textRanks: SQL[],
    queryVector: number[],
  ): Promise<SearchCatalogResult> {
    const distance = sql`(${productsTable.embedding} <=> ${toVectorLiteral(queryVector)}::vector)`;
    const semanticClose = sql`(${productsTable.embedding} is not null and ${distance} < ${SEMANTIC_MAX_DISTANCE})`;
    const where = and(
      ...filterConditions,
      sql`(${textCondition} or ${semanticClose})`,
    );
    const orderBy: SQL[] = [
      ...(accessoryOrder ? [accessoryOrder] : []), // primary parts above accessories
      sql`(${textCondition}) desc`, // text hits (TRUE) before pure-semantic hits
      ...textRanks,
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

  // FASE D structured signals, derived once from the raw query:
  //  - codeMatch: query normalized like product_oem_codes.code_norm → exact/prefix
  //    OEM-code match (highest priority).
  //  - appMatch: "model + year" phrase → product_applications filter.
  // Both are null for queries that aren't a code / vehicle phrase, and match
  // nothing while their tables are empty — so they only ever ADD on top of the
  // existing full-text search, never narrow or break it.
  const codeMatch = q ? buildCodeMatch(q) : null;
  const appMatch = q ? buildApplicationMatch(q) : null;

  // Combine a full-text predicate (and its relevance order) with the structured
  // signals: OR the conditions so a pure code / vehicle query still returns even
  // when full-text misses, and prepend the structured order keys so code-exact >
  // code-prefix > application rank above text relevance.
  function withSignals(
    ftsCondition: SQL,
    ftsRank: SQL,
  ): { condition: SQL; rankOrders: SQL[] } {
    const conds: SQL[] = [ftsCondition];
    const rankOrders: SQL[] = [];
    if (codeMatch) {
      conds.push(codeMatch.condition);
      rankOrders.push(codeMatch.exactOrder, codeMatch.prefixOrder);
    }
    if (appMatch) {
      conds.push(appMatch.condition);
      rankOrders.push(appMatch.order);
    }
    rankOrders.push(ftsRank);
    const condition =
      conds.length > 1 ? sql`(${sql.join(conds, sql` or `)})` : ftsCondition;
    return { condition, rankOrders };
  }

  // Build the plain (non-AI) search predicate from the raw query.
  const searchConditions: SQL[] = [];
  let rankOrders: SQL[] = [];
  let plainWords: string[] = [];
  // The predicate (and its rank orders) that produced the current result — fed to
  // the semantic widen so text matches are preserved and ranked first. Starts as
  // the plain query and is reassigned if an AI-assist candidate wins below.
  let winningCondition: SQL | null = null;
  let winningRanks: SQL[] = [];
  if (q) {
    const { allWords, words } = tokenizeQuery(q);
    plainWords = words;
    if (words.length > 0) {
      const fts = buildFtsSearch(words);
      const sig = withSignals(fts.condition, fts.rankOrder);
      searchConditions.push(sig.condition);
      rankOrders = sig.rankOrders;
      winningCondition = sig.condition;
      winningRanks = sig.rankOrders;
    } else {
      // Only stopwords/punctuation survived — substring fallback so search never
      // breaks or returns empty for inputs like "de la". Code/vehicle signals are
      // still OR-ed on so a code with no word tokens (e.g. "23100-4JA0B") matches.
      const fallback = and(...buildFallbackSearch(allWords)) as SQL;
      const conds: SQL[] = [fallback];
      if (codeMatch) conds.push(codeMatch.condition);
      if (appMatch) conds.push(appMatch.condition);
      const condition =
        conds.length > 1 ? sql`(${sql.join(conds, sql` or `)})` : fallback;
      searchConditions.push(condition);
      if (codeMatch) rankOrders.push(codeMatch.exactOrder, codeMatch.prefixOrder);
      if (appMatch) rankOrders.push(appMatch.order);
      winningCondition = condition;
      winningRanks = rankOrders;
    }
  }

  let { rows, total } = await runSearch(searchConditions, rankOrders);
  // True once results stop coming from the literal query (vehicle term dropped,
  // or semantic widening). The literal-query result above is never relaxed.
  let relaxed = false;

  // AI assist: when the caller opted in, the query has real terms, and plain
  // search came back thin, ask the model to split the phrase into part + vehicle
  // keywords and re-run. We try candidates from most specific (part + vehicle)
  // to least (part only), and adopt the FIRST candidate that beats plain search.
  // Any AI failure leaves the plain result untouched. The interpretation is
  // cached, so paginated screens stay consistent across pages.
  if (assist && plainWords.length > 0 && total < ASSIST_MIN_RESULTS) {
    const interp = await interpretQuery(q);
    if (interp) {
      // Candidates from most specific (part + vehicle) to least (part only). The
      // part-only candidate "relaxes" the search — it drops the vehicle filter,
      // so its results aren't confirmed-compatible with the shopper's car.
      const candidates: { words: string[]; relaxes: boolean }[] = [];
      const full = [...interp.parts, ...interp.vehicle];
      if (full.length > 0) candidates.push({ words: full, relaxes: false });
      if (interp.parts.length > 0)
        candidates.push({ words: interp.parts, relaxes: interp.vehicle.length > 0 });

      // Skip candidates identical to the plain query or already tried.
      const seen = new Set<string>([plainWords.join(" ")]);
      for (const candidate of candidates) {
        const key = candidate.words.join(" ");
        if (key === "" || seen.has(key)) continue;
        seen.add(key);
        const aiFts = buildFtsSearch(candidate.words);
        const sig = withSignals(aiFts.condition, aiFts.rankOrder);
        const aiResult = await runSearch([sig.condition], sig.rankOrders);
        if (aiResult.total > total) {
          ({ rows, total } = aiResult);
          winningCondition = sig.condition;
          winningRanks = sig.rankOrders;
          relaxed = candidate.relaxes;
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
          winningRanks,
          queryVector,
        );
        if (semantic.total >= total) {
          // Semantic widening pulls in meaning-based matches beyond the literal
          // query, so the set is no longer a confirmed vehicle/part text match.
          if (semantic.total > total) relaxed = true;
          ({ rows, total } = semantic);
        }
      }
    } catch {
      // Keep the text result; semantic is purely additive.
    }
  }

  return { rows, total, relaxed };
}
