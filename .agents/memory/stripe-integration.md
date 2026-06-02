---
name: Stripe integration (Carper)
description: How online card payments work in the Carper checkout and the build-system gotcha that breaks stripe-replit-sync migrations.
---

# Stripe card payments (Carper)

Only the checkout "Tarjeta" option goes through Stripe; efectivo/spei keep the WhatsApp flow.

- Catalog is ERP-driven, NOT Stripe products. Card orders use Stripe **Checkout Sessions** with dynamic `price_data` (currency mxn, unit_amount = round(price*100), IVA-included). Never create Stripe products for the catalog.
- Prices are always recomputed from the DB at checkout — never trust client amounts.
- Order lifecycle: insert `outbound_orders` with status `awaiting_payment` + paymentStatus `unpaid`. The Admintotal queue only selects status `pending`, so unpaid card orders are skipped. On confirmed payment → paymentStatus `paid`, paidAt, status `pending`, then push to Admintotal immediately.
- Three confirmation paths (defense in depth): verify-on-return (app calls POST /api/stripe/verify), scheduler `reconcilePendingStripeOrders()` backstop, and the managed webhook.

## Build gotcha — esbuild bundling breaks stripe-replit-sync migrations
**Symptom:** `runMigrations` resolves with no error ("esquema listo") but creates ZERO tables, then `findOrCreateManagedWebhook` fails with `relation "stripe.accounts" does not exist`.
**Why:** the api-server is bundled into a single `dist/index.mjs` by esbuild. stripe-replit-sync loads its migration .sql files via `path.resolve(__dirname, "./migrations")`, which after bundling points to the api-server `dist/` (no migrations there). `fs.existsSync` fails → migrations silently skipped.
**Fix:** add `"stripe-replit-sync"` to the `external` array in `artifacts/api-server/build.mjs` so it loads from node_modules at runtime where its migrations dir exists.
**How to apply:** any bundled Node service using a dependency that reads sibling data files by relative path must externalize that dependency.

## Stripe client credentials
Use the Replit connection API (REPLIT_CONNECTORS_HOSTNAME + REPL_IDENTITY/WEB_REPL_RENEWAL token), connector_names=stripe, settings.publishable / settings.secret. Environment = production when REPLIT_DEPLOYMENT==="1", else development. apiVersion pinned to the installed SDK's version (stripe@20 → "2025-11-17.clover").
