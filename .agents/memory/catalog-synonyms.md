---
name: Catalog synonym dictionary (offline, no AI)
description: App-level Spanish auto-parts synonym expansion in the FTS query — the non-AI replacement for semantic search recall.
---

# Catalog synonyms

`lib/synonyms.ts` holds curated Mexican-Spanish auto-parts equivalence groups
(balata↔pastilla, mofle↔silenciador, balero↔rodamiento, llanta↔neumático, etc.).
`buildFtsSearch` (productSearch.ts) expands EACH query token via `expandSynonyms`
into a parenthesized OR group `(a:* | b:* | c:*)`, AND-ed across the distinct
words the shopper typed.

**Why:** OR-within-group lifts recall (a search for any member finds the others)
while AND-across-words preserves precision — cheaper, deterministic and offline vs
Gemini embeddings. It also fixes the prefix-match plural gap: `expandSynonyms`
always adds a rough singular form, so a plural query still matches a singular
product name.

**How to apply / invariants:**
- Terms are single tokens, lowercase, accent-free (both query and stored
  `search_vector` are unaccented; operators `:* | & ()` survive `unaccent()`).
- Keep groups UNAMBIGUOUS — only equivalences for the same PART. Avoid generic
  words (bocina, volante, tornillo) that would flood unrelated results.
- It's a shared path: `/products`, `/scan`, and the assistant all go through
  `searchCatalog`→`buildFtsSearch`, so changes affect every surface consistently.
- Verify a change by totals: two members of one group must return the SAME total
  (e.g. `q=balata` == `q=pastilla`), since they compile to an identical tsquery.
- Extend by adding a row/term to `SYNONYM_GROUPS`. Multi-word concepts: pick the
  one distinctive single token (e.g. "marcha"/"arrancador", not "motor de arranque").
