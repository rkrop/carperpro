---
name: Carper Tienda web showcase
description: The public catalog website artifact (slug "tienda") for Carper Autopartes — how it reuses the existing API and its hard product constraints.
---

# Carper Tienda (web catalog showcase)

`artifacts/tienda` (react-vite, previewPath `/tienda/`) is a SHOWCASE site for the
same Carper Autopartes product as the mobile app (`artifacts/carper`). It is a
sibling consumer of the existing `api-server` + `lib/db` — it has NO backend of
its own.

**Reuses the API with zero config:** the generated client
(`@workspace/api-client-react`) bakes `/api/...` into every path, and the default
base is null → relative same-origin fetches. So the web app must NOT call
`setBaseUrl` — relative `/api/...` is routed to api-server by the proxy in both
dev and prod. (The mobile app DOES call setBaseUrl because it needs the absolute
domain.)

**Hard product constraints (do not violate):** browse + search + category filter +
product detail only. NO cart, NO checkout, NO payment, NO order form, never import
`useCreateOrder`. The only purchase action is "Pedir por WhatsApp" — a wa.me link
to 526441225597 with a prefilled Spanish message (name + SKU). A "Descarga la app"
QR/link (qrcode.react) points to https://carperautopartes.replit.app. Static store
config + the whatsappUrl() helper live in `src/lib/store.ts` (mirrors
`artifacts/carper/lib/store.ts`).

**Brand:** matches the mobile app — Polestar-editorial, electric blue #0055FF,
white/off-white bg, near-black text, SHARP corners (radius 0), Inter Black uppercase
headers, Space Mono for SKUs/prices, wordmark "Carper.".

**Catalog filters** (`src/pages/catalogo.tsx`): Línea + Sublínea + Marca + free text.
Sublínea (`useListSubcategories({categoryId})`, enabled only when a línea is picked)
renders between Líneas and Marcas with a "Ver todo" reset. All filters hydrate from
URL query params (deep-link friendly). KEY: reset a dependent filter (sublínea) in the
línea CLICK HANDLER, never in a `useEffect([categoryId])` — the effect also fires on
mount and would wipe an initial `subcategoryId` from the URL.
**Why:** deep links like `?categoryId=…&subcategoryId=…` must survive first render.

**Gotchas hit during build:**
- react-query v5: use `placeholderData: keepPreviousData` (not `keepPreviousData: true`);
  when passing a `query` options object you must also include `queryKey`.
- `useGetProduct(id, params?, options?)` — params (sucursalId) is the 2nd arg; pass
  `undefined` then the options object as the 3rd arg.
- Import the `Product` type from the package root `@workspace/api-client-react`, not
  from a deep `/src/generated/...` path.
- Scaffold ships unused shadcn `button-group.tsx` + `calendar.tsx` that fail
  typecheck under React 19 @types — pre-existing, not used by app pages.
