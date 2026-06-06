---
name: Quote-only (sin_precio) fichas
description: How no-price products are surfaced as consultation-only "ficha para consulta" across api/tienda/carper.
---

# Quote-only products (status `sin_precio`)

Products with `status='sin_precio'` (no sellable price) are shown as a
**consultation-only ficha**: photo + info VISIBLE, NO price (render "Precio a
consultar"), NO add-to-cart, and a "cotizar por WhatsApp" CTA instead. The API
exposes `quoteOnly: boolean` (= `status === 'sin_precio'`) on the Product schema.

## The two predicates — keep them distinct
- `catalogVisibleProduct()` — what a shopper may SEE. Includes `sin_precio`.
  Used by: search/listing filter (catalogSearch), `/products/:id` detail,
  subcategory counts.
- `sellableProduct()` — what may be SOLD / backfilled / promoted. Still excludes
  `sin_precio`. Used by: `/deals` (must keep excluding quote-only) and the
  purchase/backfill paths.

**Why:** visibility and sellability diverged the moment we surfaced no-price
parts. Conflating them either hides the fichas again or lets a priceless product
into deals/checkout.

## Never let quote-only reach checkout
Server order + Stripe paths already reject `sin_precio` / `effectivePrice<=0` —
do NOT touch them; they are the real guard. Client guards are defensive:
`CartContext.add()` returns prev on `quoteOnly`; add-to-cart UI is replaced by a
cotizar CTA on every surface.

## Don't leak a numeric 0 price
A quote-only row has `price: 0`. Every price render MUST branch on `quoteOnly`
first, including easy-to-miss spots: carper `ProductCardMini` (related/recent),
and tienda SEO — meta description + `productJsonLd` (emit an Offer with
availability only, no `price`). In the carper detail sticky CTA, `quoteOnly`
must take precedence over `agotado` (a sin_precio part with stock 0 should still
get the cotizar CTA, not the restock flow).
