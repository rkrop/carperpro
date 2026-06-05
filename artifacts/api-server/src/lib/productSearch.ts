import { and, sql, type SQL } from "drizzle-orm";
import { productsTable } from "@workspace/db";
import { expandSynonyms } from "./synonyms";
import { normalizeCode } from "./codes";

// Connector stopwords that carry no search signal. Dropped so a phrase like
// "bomba de gasolina tsuru" doesn't force "de" to match and wrongly exclude a
// "BOMBA GASOLINA TSURU".
const STOPWORDS = new Set([
  "de", "la", "el", "los", "las", "para", "con", "y", "o", "del", "un", "una",
]);

/**
 * Split a raw query into searchable tokens.
 *  - `allWords`: every unicode letter/number token (used by the substring
 *    fallback when nothing useful survives stopword removal).
 *  - `words`: `allWords` minus stopwords (used by the full-text path).
 *
 * Everything that isn't a letter/number is dropped, which also strips the
 * tsquery operators (& | ! : ( ) ' ") so to_tsquery can't choke on real input.
 * Accents are kept here and removed by unaccent() in SQL, matching how
 * search_vector was built.
 */
export function tokenizeQuery(q: string): { allWords: string[]; words: string[] } {
  const allWords = q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
  const words = allWords.filter((w) => !STOPWORDS.has(w));
  return { allWords, words };
}

/**
 * Build the full-text search predicate and relevance order for a set of clean
 * tokens (already stopword-free). AND semantics + per-word prefix (foo:*),
 * unaccented so it matches the stored vector built with to_tsvector('simple',
 * unaccent(...)). An ILIKE net over SKU/OEM only catches partial part-number
 * fragments that full-text prefix matching can't.
 */
export function buildFtsSearch(words: string[]): { condition: SQL; rankOrder: SQL } {
  // Each query word becomes a prefix term. Words with curated synonyms (or a
  // plural form) expand to a parenthesized OR group — "balatas" also matches
  // "pastillas" — while the distinct words the shopper typed stay AND-ed, so
  // recall improves without losing precision.
  const groups = words
    .map((w) => {
      const terms = expandSynonyms(w);
      if (terms.length === 0) return null;
      return `(${terms.map((t) => `${t}:*`).join(" | ")})`;
    })
    .filter((g): g is string => g !== null);
  // Fall back to the plain per-word prefix form if expansion yielded nothing
  // (only possible for degenerate input) so the query is never empty.
  const tsqueryStr =
    groups.length > 0 ? groups.join(" & ") : words.map((w) => `${w}:*`).join(" & ");
  const tsquery = sql`to_tsquery('simple', unaccent(${tsqueryStr}))`;

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

  const condition = sql`(${productsTable.searchVector} @@ ${tsquery} or (${ilikeNet}))`;
  // Weighted ts_rank ranks name/SKU (weight A) above brand/OEM (B) above
  // description (C); SKU/OEM-only ILIKE-net hits rank 0 and sort last.
  // coalesce(...,0) guards a transient NULL vector (pre-backfill) from sorting
  // to the top under DESC's NULLS-FIRST default.
  const rankOrder = sql`coalesce(ts_rank(${productsTable.searchVector}, ${tsquery}), 0) desc`;
  return { condition, rankOrder };
}

/**
 * Accent-insensitive substring AND match used when no full-text tokens remain
 * (e.g. input was only stopwords/punctuation) so search never breaks.
 */
export function buildFallbackSearch(allWords: string[]): SQL[] {
  const haystack = sql`unaccent(lower(
    coalesce(${productsTable.name}, '') || ' ' ||
    coalesce(${productsTable.descripcion}, '') || ' ' ||
    coalesce(${productsTable.sku}, '') || ' ' ||
    coalesce(${productsTable.brand}, '') || ' ' ||
    coalesce(array_to_string(${productsTable.oem}, ' '), '') || ' ' ||
    coalesce(array_to_string(${productsTable.vehicles}, ' '), '')
  ))`;
  return allWords.map((w) => {
    const term = `%${w.replace(/([%_\\])/g, "\\$1")}%`;
    return sql`${haystack} like unaccent(lower(${term}))`;
  });
}

export interface CodeMatch {
  /**
   * EXISTS predicate: the product has a structured OEM/equivalent code (in
   * product_oem_codes) whose code_norm matches the query exactly or by prefix.
   * Used as an OR signal so a pure code query returns even when full-text misses.
   */
  condition: SQL;
  /** Order key: rows with an EXACT code_norm match first. */
  exactOrder: SQL;
  /** Order key: rows whose code_norm starts with the query (exact ⊂ prefix). */
  prefixOrder: SQL;
}

/**
 * Build the OEM-code search signal from the raw query. The query is normalized
 * with the SAME `normalizeCode` used on the write side (product_oem_codes.code_norm)
 * so "23100-4JA0B", "23100 4JA0B" and "231004JA0B" all match the stored code.
 * Returns null only when the normalized query is shorter than 3 chars (a 1–2 char
 * prefix would match nearly every code and carries no signal); any longer query
 * is tested against code_norm, so letter-only OEM codes are matched too. The
 * code EXISTS is indexed (product_oem_codes_code_norm_idx) so the cost on plain
 * word searches is small at this catalog size. While the codes table is empty the
 * EXISTS simply matches nothing — degrades cleanly, never widens or breaks search.
 */
export function buildCodeMatch(rawQuery: string): CodeMatch | null {
  const code = normalizeCode(rawQuery);
  if (code.length < 3) return null;
  const prefixPattern = `${code.replace(/([%_\\])/g, "\\$1")}%`;
  const existsFor = (pred: SQL): SQL =>
    sql`exists (select 1 from product_oem_codes oc where oc.product_id = ${productsTable.id} and ${pred})`;
  const exactExists = existsFor(sql`oc.code_norm = ${code}`);
  const prefixExists = existsFor(sql`oc.code_norm like ${prefixPattern}`);
  return {
    condition: prefixExists, // exact match is a subset of the prefix match
    exactOrder: sql`(case when ${exactExists} then 1 else 0 end) desc`,
    prefixOrder: sql`(case when ${prefixExists} then 1 else 0 end) desc`,
  };
}

export interface ApplicationMatch {
  /** EXISTS predicate: product fits a vehicle application matching model+year. */
  condition: SQL;
  /** Order key: rows with a matching application first. */
  order: SQL;
}

/**
 * Build the vehicle+year search signal. Only fires when the query contains a
 * 4-digit year (19xx/20xx) AND at least one other token to use as the model — so
 * "NP300 2019" matches but bare "2019" or "frenos" does not. Matches
 * product_applications where the model ILIKEs any non-year token AND the year
 * falls within [year_from, year_to]; NULL bounds are treated as open so a row
 * with no declared upper/lower year still matches. While the table is empty the
 * EXISTS matches nothing — degrades cleanly. Returns null for non-vehicle queries.
 */
export function buildApplicationMatch(rawQuery: string): ApplicationMatch | null {
  const yearMatch = rawQuery.match(/\b(?:19|20)\d{2}\b/);
  if (!yearMatch) return null;
  const year = Number(yearMatch[0]);
  const tokens = rawQuery
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && t !== String(year));
  if (tokens.length === 0) return null;
  const modelPreds = tokens.map((t) => {
    const term = `%${t.replace(/([%_\\])/g, "\\$1")}%`;
    return sql`pa.model ilike ${term}`;
  });
  const modelAny = sql.join(modelPreds, sql` or `);
  const yearIn = sql`${year} between coalesce(pa.year_from, ${year}) and coalesce(pa.year_to, ${year})`;
  const condition = sql`exists (select 1 from product_applications pa where pa.product_id = ${productsTable.id} and (${modelAny}) and (${yearIn}))`;
  return {
    condition,
    order: sql`(case when ${condition} then 1 else 0 end) desc`,
  };
}
