// Single source of truth for "what does this product cost the customer".
//
// Admintotal carries two money fields per product: `precio` (precio de venta,
// the retail/sale price) and `costo` (the business's cost). Some catalog rows
// have `precio = 0` but a real `costo` (the ERP just never got a sale price).
// The owner's rule: show/charge the precio de venta when it exists, otherwise
// fall back to the costo so the product still has a usable final price instead
// of $0.00.
//
// This MUST be applied identically wherever a price is shown OR charged
// (catalog serialization, Stripe checkout, manual orders) so the displayed
// price and the amount the customer pays can never diverge.
//
// IVA: Admintotal stores the *base* price (sin IVA) in `precio`/`costo` — the
// same value the ERP sync and the price/stock webhook write to this row. The
// customer-facing price is the precio neto (IVA included). We add the 16% IVA
// HERE, at the single read boundary, so every surface (catalog, checkout,
// orders) shows/charges the precio neto while ingestion keeps storing the ERP's
// base price untouched. This is why the app's "IVA incluido" label is accurate.
export const IVA_RATE = 0.16;

// Add IVA to a base (sin IVA) amount, rounded to centavos.
export function withIva(amount: number): number {
  return Math.round(amount * (1 + IVA_RATE) * 100) / 100;
}

export function effectivePrice(row: {
  price: number | null;
  costo: number | null;
}): number {
  const venta = row.price ?? 0;
  const base = venta > 0 ? venta : (row.costo ?? 0);
  return withIva(base);
}
