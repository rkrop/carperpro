---
name: Cart quantity stock cap
description: How cart quantity is capped to available stock across client and the two checkout paths.
---

# Cart quantity stock cap

Cart lines carry a denormalized `stock: number | null` captured at add time
(CartItem/CartProduct). The cap rule is uniform everywhere:
**`null` stock = unknown availability = NO cap; a number caps the line.**

**Why:** Carper's catalog is mostly unknown-stock (sparse ERP inventory).
A cap that treated unknown as 0 would block the bulk of the catalog. Unknown
must always stay orderable; only confirmed counts cap.

## How to apply
- Client (CartContext) `add`/`setQty` clamp to the line's stock; `setQty` also
  clamps stale/restored lines down. producto/[id].tsx self-heals a stale line
  on load by clamping to current live `product.stock`.
- Two server checkout gates, intentionally different strictness:
  - **Card / Stripe** (stripe/service.ts): strict LIVE ERP gate via
    `getLiveSellableStock`; fails CLOSED (503) on any unverifiable id — money is
    involved, refuse rather than oversell.
  - **Cash / SPEI** (`POST /orders`): softer gate against the LOCAL mirror
    `erpStockQty` (same source as the UI cap); unknown (null) stays orderable.
    Do NOT use `getAvailableStock` here — it collapses unknown→0 and would block
    the unknown-stock catalog.
- Both server paths sum qty per product across lines and MUST normalize qty to a
  positive integer (`Math.max(1, Math.floor(qty))`) BEFORE the stock sum, or a
  negative/fractional line can offset a positive one and bypass the check.

## Cart-open stock refresh (warn before checkout)
- `GET /products/availability?ids=a,b,c` is the lightweight batch stock refresh
  for a saved cart. It reads the LOCAL mirror `erpStockQty` (same source as the
  /orders soft gate & catalog display) — NOT live ERP — so cart-open stays fast
  and avoids Admintotal rate limits.
- It intentionally does NOT apply `sellableProduct()`: a now-confirmed-0 /
  deleted / test product MUST still be reported (out_of_stock); missing ids →
  out_of_stock too. The listing/detail routes DO filter, so don't reuse them.
- Must be registered BEFORE `/products/:id` in catalog.ts or `:id` swallows it.
- Client: `CartContext.refreshStock(updates)` refreshes caps, clamps over-limit
  lines, drops confirmed-0 lines, returns `{clamped, removed}`; carrito.tsx runs
  it once on open (snapshot ids first — cart hydrates async) and surfaces a
  banner + per-line "Ajustamos la cantidad" flag.
