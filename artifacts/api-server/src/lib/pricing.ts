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
export function effectivePrice(row: {
  price: number | null;
  costo: number | null;
}): number {
  const venta = row.price ?? 0;
  if (venta > 0) return venta;
  return row.costo ?? 0;
}
