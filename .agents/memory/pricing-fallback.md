---
name: Carper effective-price (precio venta else costo) rule
description: Business rule for the price shown/charged when a product's sale price is 0.
---

Some catalog rows mirror from Admintotal with `precio` (precio de venta) = 0 but a real `costo`. Owner's rule: the **final price = precio de venta when > 0, otherwise the costo** (so the product never shows $0.00 / is never free).

This is one helper, `effectivePrice({price, costo})` in `artifacts/api-server/src/lib/pricing.ts`, and it MUST be applied at **every** place a price is shown OR charged so display and checkout can never diverge: catalog serialization, Stripe checkout line items, manual order line items, and the `/deals` filter/ranking (which compares `originalPrice` against the effective price via a CASE expression, not raw `price`).

**Why:** `price` and `costo` are separate ERP fields; reading the raw `price` column anywhere makes that surface disagree with the rest. A product priced from its costo would otherwise show a bogus discount in /deals or be charged $0 at checkout.

**How to apply:** the ERP `costo` is now persisted (mapper maps it; sync + both webhooks upsert it). The fallback is computed at READ time, so existing rows with price=0 are fixed without a re-sync. If `price=0 AND costo` is null/0 the effective price stays 0 and Stripe's `payable` filter rejects online payment (correct). NOTE: products with precio=0 are now charged at costo in online checkout — if the owner ever wants those to be display-only (WhatsApp), gate them out of checkout instead of changing this rule.
