---
name: Carper Tienda SEO
description: How SEO (meta/JSON-LD/sitemap) is wired for the static tienda SPA + api-server.
---

# Carper Tienda SEO

The tienda (`artifacts/tienda`) is a **static** Vite SPA (`serve = "static"`, `/*` → index.html). It has no server of its own, so dynamic SEO is split two ways:

- **Per-route head tags + JSON-LD**: `src/lib/seo.ts` `useSeo()` hook imperatively sets `document.title`, description, canonical, OG/Twitter, robots, and injects `<script data-seo-jsonld>` blocks in a `useEffect`. Applied in home/catalogo/producto/contacto. Relies on Googlebot rendering JS (no SSR/prerender — infeasible for ~4k product pages at build).
- **Sitemap**: served DYNAMICALLY by the api-server at `/api/sitemap.xml` (`src/routes/sitemap.ts`), generated fresh from the DB using the SAME `notTestProduct()`/`sellableProduct()` filters exported from `routes/catalog.ts`. URLs point at `<origin>/tienda/...`. Origin from `PUBLIC_SITE_URL` env or request forwarded headers. ~4,160 URLs.

**Why dynamic sitemap (not build-time static):** catalog changes constantly via Admintotal webhooks; a build-time file goes stale and would couple the tienda build to the DB.

## Gotchas
- **Vite rewrites root-relative URLs in index.html** by prepending `base` (`/tienda/`). So in `index.html` write `content="/opengraph.jpg"` (Vite emits `/tienda/opengraph.jpg`). Writing `/tienda/opengraph.jpg` double-prefixes to `/tienda/tienda/opengraph.jpg`. The runtime `useSeo` uses `window.location.origin + BASE_URL` so it's already absolute/correct.
- `robots.txt` (in `public/`) is served at `/tienda/robots.txt`; its `Sitemap:` line hardcodes the published domain (`https://carperautopartes.replit.app/api/sitemap.xml`) since a static file can't know the host. Path-routing means the host-root `/robots.txt` is owned by the root artifact, not the tienda — submit the sitemap via Search Console regardless.
- Search-result views (`?q=`) are `noindex`; plain category views stay indexable with a clean `?categoryId=` canonical.
