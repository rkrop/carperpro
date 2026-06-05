// Curated Mexican-Spanish auto-parts synonyms for the catalog full-text search.
//
// Why this exists: the catalog uses the words the ERP happened to store, but
// shoppers use regional/colloquial equivalents ("balatas" vs "pastillas",
// "mofle" vs "silenciador"). A query for any member of a group also matches the
// others (OR *within* a group), while the distinct concepts the shopper typed
// are still AND-ed together, so recall improves WITHOUT losing precision. This
// is a cheaper, more predictable and offline alternative to semantic embeddings.
//
// Conventions for terms: single tokens, lowercase, WITHOUT accents (both the
// query and the stored search vector are unaccented before matching). Keep
// groups unambiguous — only add equivalences that mean the same PART, never a
// generic word that would flood unrelated results. Extend freely: add a term to
// an existing row or add a new row.
const SYNONYM_GROUPS: string[][] = [
  ["balata", "pastilla"], // pastillas de freno
  ["disco", "rotor"], // disco de freno / rotor
  ["mofle", "silenciador"], // escape
  ["clutch", "embrague", "croche"], // conjunto de clutch
  ["marcha", "arrancador"], // motor de arranque
  ["bateria", "acumulador"], // batería
  ["llanta", "neumatico"], // llantas
  ["foco", "bombilla"], // foco / bombilla
  ["limpiaparabrisas", "plumilla", "pluma"], // plumas limpiaparabrisas
  ["empaque", "junta"], // junta / empaque (gasket)
  ["reten", "estopera"], // retén de aceite
  ["buje", "casquillo"], // buje / casquillo
  ["balero", "rodamiento"], // balero / rodamiento
  ["maza", "cubo"], // maza de rueda
  ["defensa", "fascia", "parachoques"], // defensa
  ["cofre", "capo"], // cofre / capó
  ["espejo", "retrovisor"], // espejo retrovisor
  ["salpicadera", "guardafango"], // salpicadera
  ["anticongelante", "refrigerante"], // anticongelante
  ["relevador", "rele", "relay"], // relevador / relé
  ["tijera", "horquilla"], // tijera / horquilla de suspensión
];

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Normalize a term/token the same way matching does: lowercase, accent-free, and
// only letters/digits, so map lookups line up with the unaccented search vector.
export function normalizeTerm(word: string): string {
  return stripAccents(word.toLowerCase()).replace(/[^a-z0-9]+/g, "");
}

// term -> every term in its group (including itself), all normalized & deduped.
const SYNONYM_MAP: Map<string, string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const group of SYNONYM_GROUPS) {
    const norm = Array.from(new Set(group.map(normalizeTerm))).filter(Boolean);
    for (const term of norm) {
      const existing = map.get(term) ?? [];
      map.set(term, Array.from(new Set([...existing, ...norm])));
    }
  }
  return map;
})();

// Rough Spanish singularizer: "balatas" -> "balata", "neumaticos" -> "neumatico".
// Returned only as an EXTRA prefix term, so over-stripping just adds a slightly
// broader prefix (matching is AND-ed across words, so precision is preserved).
function singular(word: string): string | null {
  if (word.length > 4 && word.endsWith("es")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s")) return word.slice(0, -1);
  return null;
}

/**
 * Expand one query token into the set of equivalent terms to OR together in the
 * tsquery. Always includes the token itself (normalized) and its singular form
 * (so a plural query still matches a singular product name via prefix), plus any
 * curated synonyms of either. Returns normalized tokens WITHOUT the `:*` prefix;
 * the caller adds prefix/operators.
 */
export function expandSynonyms(word: string): string[] {
  const norm = normalizeTerm(word);
  if (!norm) return [];
  const result = new Set<string>([norm]);
  const sing = singular(norm);
  if (sing) result.add(sing);
  for (const cand of sing ? [norm, sing] : [norm]) {
    const group = SYNONYM_MAP.get(cand);
    if (group) for (const t of group) result.add(t);
  }
  return Array.from(result);
}
