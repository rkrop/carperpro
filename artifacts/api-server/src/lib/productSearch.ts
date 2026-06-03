import { and, sql, type SQL } from "drizzle-orm";
import { productsTable } from "@workspace/db";

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
  const tsqueryStr = words.map((w) => `${w}:*`).join(" & ");
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
