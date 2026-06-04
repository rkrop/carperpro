---
name: Artifact routing topology
description: Which artifact serves which path on the published domain, and the gotchas when changing the root
---

# Production routing layout

The published domain routes by path (Replit path-router, longest-prefix wins):

- `/`     → **tienda** (react-vite website) — the public storefront/showcase
- `/app`  → **carper** (Expo) — NOTE: the Expo *web* build only serves an Expo Go
  landing/manifest page (download + QR instructions), NOT a usable web app UI.
  The real app is iOS/Android via Expo Go. So the web route is just a landing.
- `/api`  → **api-server** (Express)

**Why this layout:** the custom domain should open the *website* first. Before this,
carper held `/` and only showed the Expo Go landing page, so visitors never saw the
storefront.

## How to change which artifact is at root
- Edit routing ONLY via the artifacts skill `verifyAndReplaceArtifactToml` (never edit
  `artifact.toml` directly). Each artifact's `.replit-artifact/artifact.toml` has
  `previewPath`, `[[services]].paths`, and `[services.env].BASE_PATH` that must all move
  together.
- **Order matters:** you cannot assign `/` to one artifact while another still owns it —
  you get `DUPLICATE_PREVIEW_PATH`. Move the current root artifact OFF `/` first, then
  claim `/` for the new one.
- `BASE_PATH` drives everything downstream: tienda Vite `base` (vite.config reads
  `process.env.BASE_PATH`), and carper's `server/serve.js` + `scripts/build.js` both
  strip/prefix `BASE_PATH` for the Expo static serve. Dev is unaffected (dev commands
  don't use BASE_PATH; Expo dev uses its own REPLIT_EXPO_DEV_DOMAIN).
- Things that must follow a tienda base change: `api-server/src/routes/sitemap.ts`
  `TIENDA_BASE` (now `""`), and tienda `src/lib/store.ts` `APP_URL` (points at the app's
  path, now `/app`). `seo.ts` auto-adapts (reads `import.meta.env.BASE_URL`).
- Routing changes only take effect in production after **re-publishing**. Connecting the
  actual custom domain (DNS) is a separate manual step in the Replit Deployments UI.
