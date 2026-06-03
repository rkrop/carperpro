---
name: Sublíneas nav & vehicle search
description: How 2-level Línea→Sublínea navigation and "buscar por vehículo" work in Carper, and why.
---

# Sublíneas (2-level catalog navigation)

- Data: `subcategoriesTable` (sublínea) + `products.subcategoryId`. Sublíneas come from Admintotal `sublineas/`; product sublínea from the `sublinea` field.
- **subcategoryId is set only when referentially valid** (the sync builds `validSubIds` from persisted subcategories and nulls anything not in it). Avoids dangling ids.
- **The table fills over time, like stock** — it's empty until a full sync (rate-limited, minutes) and is topped up by webhooks.
- **`/subcategories` MUST derive counts live**, not read `subcategories.count`. The stored `count` column only recomputes at the END of a full sync (minutes, rate-limited), so it sits at 0 even when products already reference the sublínea → every sublínea looked empty and got hidden. The endpoint now `innerJoin`s products with `notTestProduct()`+`sellableProduct()`, `groupBy`s, and counts live. **Why:** a stored aggregate that only refreshes at sync-end is stale for the whole sync window; if a list is "mysteriously empty" check whether it depends on a sync-end-computed count.
- Coverage is uneven: ~5% on low/legacy product ids, ~73% on newer products. That's expected.
- **Graceful degradation rule:** `app/subcategorias.tsx` always renders the "Ver todo / Todas las refacciones" row, so a category with zero (or not-yet-synced) sublíneas is still fully browsable → `/resultados?category=`.
- Nav flow: `categorias.tsx` → `/subcategorias?category=&name=` → `/resultados?category=&subcategory=`. `resultados.tsx` looks up the sublínea name via `useSubcategories(category)` for its title.
- `useSubcategories(categoryId)` is enabled-gated (`enabled: !!categoryId`) and MUST pass a `queryKey` (orval's options.query type requires it when you also set `enabled`).

# Buscar por vehículo (camino 2)

- `buscar-vehiculo.tsx` navigates to `/resultados?q=<marca> <modelo>` (FTS), NOT the old `?compat=1` path.
- **`?compat=1` was dead** — `compatible` was always false, so it filtered everything out. Removed from `resultados.tsx`.
- **Año is deliberately omitted from the query.** Descriptions store year RANGES (e.g. "1992-2017"), so a literal year in the unaccent+ILIKE FTS would wrongly exclude matching parts. Año/motor are still saved on the vehicle for context.
