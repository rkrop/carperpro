// Precio efectivo del producto. Por ahora se expone exactamente como viene
// del archivo maestro (sin IVA adicional ni fallback a costo).
// Las reglas de precio se definirán junto con el archivo maestro.
export const IVA_RATE = 0.16;

// Utilidad para agregar IVA cuando sea necesario (disponible para uso futuro).
export function withIva(amount: number): number {
  return Math.round(amount * (1 + IVA_RATE) * 100) / 100;
}

export const ESTIMATED_PRICE_MARKUP = 1.3;

export function effectivePrice(row: {
  price: number | null;
  costo: number | null;
}): number {
  if (row.price != null && row.price > 0) return row.price;
  if (row.costo != null && row.costo > 0)
    return Math.round(row.costo * ESTIMATED_PRICE_MARKUP * 100) / 100;
  return 0;
}
