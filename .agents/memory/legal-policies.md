---
name: Legal policies (app + web)
description: How Carper's e-commerce legal policies are stored and kept in sync across the Expo app and the website.
---

# Legal policies — Carper Autopartes

The MX e-commerce policy set (Aviso de Privacidad/LFPDPPP, Términos, Envíos, Devoluciones/Garantías, Pagos/Facturación, Cookies) lives as ONE structured data module duplicated **byte-for-byte** in two places:
- `artifacts/carper/lib/policies.ts` (app)
- `artifacts/tienda/src/lib/policies.ts` (web)

Rendered at: app `app/politicas.tsx` (reached from Cuenta › Acerca de Carper › "Políticas y privacidad"), web `src/pages/politicas.tsx` (`/politicas`, linked in footer + sitemap).

**Why duplicated instead of a shared workspace package:** the app must show its policies even offline for app-store review, so each artifact stays self-contained; a new cross-bundler (Metro + Vite) package added setup/resolution risk for content that rarely changes.

**How to apply:**
- Any edit to one policy file MUST be mirrored in the other or app/web legal text diverges (`cmp` the two files; they must be identical).
- Icons are NOT in the data (Feather names ≠ lucide names); each UI maps `doc.id` → its icon.
- Contact/identity values come from `STORE`, never hard-coded, so they don't drift.
- The text contains a `[RAZÓN SOCIAL]` placeholder (RFC `CDI960919J54` is a persona-moral RFC but the registered legal name is unknown) — must be filled and the whole text lawyer-reviewed before public launch.
