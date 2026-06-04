// Precio efectivo del producto. Por ahora se expone exactamente como viene
// del archivo maestro (sin IVA adicional ni fallback a costo).
// Las reglas de precio se definirán junto con el archivo maestro.
export const IVA_RATE = 0.16;

// Utilidad para agregar IVA cuando sea necesario (disponible para uso futuro).
export function withIva(amount: number): number {
  return Math.round(amount * (1 + IVA_RATE) * 100) / 100;
}

export function effectivePrice(row: {
  price: number | null;
  costo: number | null;
}): number {
  return row.price ?? 0;
}
